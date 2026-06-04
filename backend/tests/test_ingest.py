"""
インジェスト是正（フェーズ2 P0）の単体テスト。

- filters: 人名バリデーション / 進行アナウンス判定
- hashing: speechID ベースの決定的ハッシュ
- ndl_client._parse_record / iter_speeches: ゴミ除外・進行文分類・speechURL採用・
  nextRecordPosition ページング・API障害時の partial(incomplete) フラグ
- snapshot._count_crossparty_passed: 3党以上の成立法案カウント
"""

from datetime import date

from app.ingest import ndl_client as nc
from app.ingest.filters import is_person_name, is_procedural_speech
from app.ingest.hashing import speech_hash

# ── filters ──────────────────────────────────────────────────────────────

def test_is_person_name_rejects_meta_and_committees():
    assert is_person_name("重徳和彦") is True
    assert is_person_name("会議録情報") is False
    assert is_person_name("予算委員会") is False
    assert is_person_name("本会議") is False
    assert is_person_name("") is False
    assert is_person_name("   ") is False


def test_is_procedural_speech():
    assert is_procedural_speech("これより会議を開きます。") is True
    assert is_procedural_speech("本日はこれにて散会いたします。") is True
    assert is_procedural_speech("ただいまから総務委員会を開会いたします。") is True
    assert is_procedural_speech("社会保障制度の持続可能性について質問します。") is False
    assert is_procedural_speech("") is False


# ── hashing ──────────────────────────────────────────────────────────────

def test_speech_hash_deterministic_and_length():
    h1 = speech_hash("122115254X00720260331_000")
    h2 = speech_hash("122115254X00720260331_000")
    assert h1 == h2
    assert len(h1) == 64
    assert speech_hash("A_0") != speech_hash("B_0")


# ── _parse_record ────────────────────────────────────────────────────────

def _raw(**over):
    base = {
        "speechID": "X_0",
        "date": "2026-03-01",
        "speaker": "山田太郎",
        "speakerGroup": "自由民主党",
        "nameOfHouse": "衆議院",
        "nameOfMeeting": "外務委員会",
        "speakerRole": "",
        "speech": "外交政策について意見を申し上げます。",
        "speechURL": "https://kokkai.ndl.go.jp/txt/X/0",
        "meetingURL": "https://kokkai.ndl.go.jp/txt/X",
        "isMinister": False,
    }
    base.update(over)
    return base


def test_parse_record_skips_ghost_speaker():
    assert nc._parse_record(_raw(speaker="会議録情報")) is None


def test_parse_record_skips_non_member_role():
    assert nc._parse_record(_raw(speakerRole="政府参考人")) is None


def test_parse_record_uses_speech_url_and_hash():
    rec = nc._parse_record(_raw())
    assert rec is not None
    assert rec.url == "https://kokkai.ndl.go.jp/txt/X/0"
    assert rec.source_hash == speech_hash("X_0")
    assert rec.activity_type == "speech"


def test_parse_record_falls_back_to_meeting_url():
    rec = nc._parse_record(_raw(speechURL=""))
    assert rec is not None
    assert rec.url == "https://kokkai.ndl.go.jp/txt/X"


def test_parse_record_question_classification():
    rec = nc._parse_record(_raw(nameOfMeeting="予算委員会質疑"))
    assert rec is not None
    assert rec.activity_type == "question"


def test_parse_record_procedural_is_committee_action():
    rec = nc._parse_record(_raw(speech="これより会議を開きます。"))
    assert rec is not None
    assert rec.is_procedural is True
    assert rec.activity_type == "committee_action"


# ── iter_speeches（ページング / incomplete） ───────────────────────────────

class _FakeResp:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        pass

    def json(self):
        return self._payload


def test_iter_speeches_paginates_and_filters(monkeypatch):
    client = nc.NdlClient(rate_sleep=0)
    pages = [
        {
            "numberOfRecords": 3,
            "nextRecordPosition": 101,
            "speechRecord": [
                _raw(speechID="A_0", speaker="山田太郎"),
                _raw(speechID="meta", speaker="会議録情報"),  # ゴミ → 除外
            ],
        },
        {
            "numberOfRecords": 3,
            "nextRecordPosition": None,  # 終端
            "speechRecord": [
                _raw(speechID="B_0", speaker="佐藤花子", speech="これより会議を開きます。"),
            ],
        },
    ]
    calls = {"i": 0}

    def fake_get(url, params=None, timeout=None):
        resp = _FakeResp(pages[calls["i"]])
        calls["i"] += 1
        return resp

    monkeypatch.setattr(client._session, "get", fake_get)
    recs = list(client.iter_speeches(date(2026, 3, 1), date(2026, 3, 31), limit=100))

    assert calls["i"] == 2  # 2ページ取得した
    assert [r.speaker for r in recs] == ["山田太郎", "佐藤花子"]  # ゴミ除外
    assert recs[1].activity_type == "committee_action"  # 進行文
    assert client.incomplete is False


def test_iter_speeches_marks_incomplete_on_error(monkeypatch):
    client = nc.NdlClient(rate_sleep=0)

    def boom(url, params=None, timeout=None):
        raise RuntimeError("network down")

    monkeypatch.setattr(client._session, "get", boom)
    recs = list(client.iter_speeches(date(2026, 3, 1), date(2026, 3, 31), limit=10))

    assert recs == []
    assert client.incomplete is True


# ── snapshot crossparty ──────────────────────────────────────────────────

def test_count_crossparty_passed():
    from app.database import SessionLocal
    from app.models import Bill, BillSponsor, Party, Politician
    from app.scoring.snapshot import _count_crossparty_passed

    db = SessionLocal()
    try:
        parties = [Party(name_ja=f"テスト党{i}", abbreviation=f"TP{i}") for i in range(3)]
        db.add_all(parties)
        db.flush()
        pols = [
            Politician(
                name_ja=f"テスト議員{i}",
                party_id=parties[i].id,
                house="representatives",
                role_profile="ruling",
                external_ref=f"test:cp:{i}",
            )
            for i in range(3)
        ]
        db.add_all(pols)
        db.flush()

        b3 = Bill(bill_code="TEST-CP-3", title="超党派法案", status="passed")
        b2 = Bill(bill_code="TEST-CP-2", title="二党法案", status="passed")
        db.add_all([b3, b2])
        db.flush()

        db.add_all([
            BillSponsor(bill_id=b3.id, politician_id=pols[0].id, sponsor_role="primary"),
            BillSponsor(bill_id=b3.id, politician_id=pols[1].id, sponsor_role="co"),
            BillSponsor(bill_id=b3.id, politician_id=pols[2].id, sponsor_role="co"),
            BillSponsor(bill_id=b2.id, politician_id=pols[0].id, sponsor_role="primary"),
            BillSponsor(bill_id=b2.id, politician_id=pols[1].id, sponsor_role="co"),
        ])
        db.flush()

        assert _count_crossparty_passed(db, [b3.id, b2.id]) == 1
        assert _count_crossparty_passed(db, []) == 0
    finally:
        db.rollback()
        db.close()
