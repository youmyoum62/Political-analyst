"""
インジェスト是正（フェーズ2 P0）の単体テスト。

- filters: 人名バリデーション / 進行アナウンス判定
- hashing: speechID ベースの決定的ハッシュ
- ndl_client._parse_record / iter_speeches: ゴミ除外・進行文分類・speechURL採用・
  nextRecordPosition ページング・API障害時の partial(incomplete) フラグ
- snapshot._count_crossparty_passed: 3党以上の成立法案カウント
"""

from datetime import date, datetime

import pytest

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


# ── 衆議院議員名簿 全ページ巡回（house 取りこぼし回帰） ──────────────────────

def test_shugiin_page_urls_collects_all_pages_dedup():
    from scripts.ingest import SHUGIIN_URL, _shugiin_page_urls

    html = """
    <html><body>
      <a href="1giin.htm">1</a>
      <a href="2giin.htm">2</a>
      <a href="10giin.htm">10</a>
      <a href="profile/001.html">議員プロフィール</a>
      <a href="1giin.htm">重複</a>
    </body></html>
    """
    urls = _shugiin_page_urls(html, SHUGIIN_URL)
    # index(=1giin.htm) を先頭に含み、profile は除外、重複なし
    assert urls[0] == SHUGIIN_URL
    assert [u.split("/")[-1] for u in urls] == ["1giin.htm", "2giin.htm", "10giin.htm"]


def test_shugiin_page_urls_prepends_index_when_not_linked():
    from scripts.ingest import SHUGIIN_URL, _shugiin_page_urls

    html = '<a href="2giin.htm">2</a>'
    urls = _shugiin_page_urls(html, SHUGIIN_URL)
    assert urls[0] == SHUGIIN_URL  # 自分自身へのリンクが無くても必ず巡回対象に含む
    assert urls[1].endswith("2giin.htm")


def test_parse_shugiin_page_extracts_members_and_skips_header():
    from scripts.ingest import _parse_shugiin_page

    html = """
    <table>
    <tr><td>氏名</td><td>よみがな</td><td>会派</td><td>選挙区</td><td>当選</td></tr>
    <tr><td>逢沢　一郎君</td><td>あいさわ</td><td>自由民主党</td><td>岡山1</td><td>13</td></tr>
    <tr><td>青柳仁士</td><td>あおやぎ</td><td>日本維新の会</td><td>大阪14</td><td>2</td></tr>
    </table>
    """
    members = _parse_shugiin_page(html)
    assert [m["name"] for m in members] == ["逢沢一郎", "青柳仁士"]  # 君・空白除去、ヘッダ除外
    assert all(m["house"] == "representatives" for m in members)
    assert members[0]["district"] == "岡山1"


# ── 過去議員の is_active 無効化（現職のみ表示） ─────────────────────────────

def test_deactivate_former_members(tmp_path):
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    from app import models  # noqa: F401
    from app.database import Base
    from app.models import Party, Politician
    from scripts.ingest import _deactivate_former_members

    engine = create_engine(
        f"sqlite:///{tmp_path / 'deact.db'}", connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(bind=engine)
    db = sessionmaker(bind=engine)()
    try:
        party = Party(name_ja="自民", abbreviation="自民")
        db.add(party)
        db.flush()
        # 現職: 現一郎(衆)・参子(参)  / 過去: 元三郎(衆, 名簿に無い)
        for nm, house in [("現一郎", "representatives"), ("参子", "councillors"),
                          ("元三郎", "representatives")]:
            db.add(Politician(name_ja=nm, party_id=party.id, house=house,
                              role_profile="ruling", is_active=True))
        db.commit()

        roster = [
            {"name": "現一郎", "house": "representatives"},
            {"name": "参子", "house": "councillors"},
        ]
        # ガード: 名簿が min_roster 未満なら何もしない
        assert _deactivate_former_members(db, roster, min_roster=5) == 0
        assert db.query(Politician).filter(Politician.is_active == True).count() == 3  # noqa: E712

        # 名簿が十分: 名簿に無い 元三郎 のみ無効化
        n = _deactivate_former_members(db, roster, min_roster=2)
        assert n == 1
        moto = db.query(Politician).filter(Politician.name_ja == "元三郎").first()
        assert moto.is_active is False
        actives = {p.name_ja for p in db.query(Politician).filter(Politician.is_active == True)}  # noqa: E712
        assert actives == {"現一郎", "参子"}
    finally:
        db.close()
        engine.dispose()


# ── スコア計算期間の分離（取得ウィンドウと独立） ─────────────────────────────

def test_default_score_since_is_2024():
    from scripts.ingest import DEFAULT_SCORE_SINCE

    assert DEFAULT_SCORE_SINCE == "2024-01-01"


def test_resolve_score_period_defaults_to_2024_and_run_date():
    from scripts.ingest import DEFAULT_SCORE_SINCE, _resolve_score_period

    start, end = _resolve_score_period(DEFAULT_SCORE_SINCE, datetime(2026, 7, 9, 3, 0, 0))
    assert start == date(2024, 1, 1)
    assert end == date(2026, 7, 9)  # period_end は常に実行日


def test_resolve_score_period_independent_of_days_window():
    """--days が短くてもスコア期間の開始は --score-since 起点で変わらない（夜間上書き回帰）。"""
    from scripts.ingest import DEFAULT_SCORE_SINCE, _resolve_score_period

    # days=90 のローリング開始日(≈2026-04-10)ではなく、既定の2024-01-01が採用される
    start, _ = _resolve_score_period(DEFAULT_SCORE_SINCE, datetime(2026, 7, 9))
    assert start == date(2024, 1, 1)


def test_resolve_score_period_explicit_override():
    from scripts.ingest import _resolve_score_period

    start, end = _resolve_score_period("2026-04-10", datetime(2026, 7, 9))
    assert start == date(2026, 4, 10)
    assert end == date(2026, 7, 9)


def test_resolve_score_period_rejects_future_start():
    from scripts.ingest import _resolve_score_period

    with pytest.raises(ValueError):
        _resolve_score_period("2027-01-01", datetime(2026, 7, 9))


def test_parser_defaults_and_score_since_override():
    from scripts.ingest import DEFAULT_SCORE_SINCE, _build_parser

    parser = _build_parser()
    args = parser.parse_args([])
    assert args.days == 90
    assert args.score_since == DEFAULT_SCORE_SINCE
    assert args.rescore_only is False

    args2 = parser.parse_args(["--score-since", "2025-01-01", "--days", "30"])
    assert args2.score_since == "2025-01-01"
    assert args2.days == 30  # 取得ウィンドウは独立して指定できる


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
