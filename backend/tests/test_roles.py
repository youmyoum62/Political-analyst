"""
役職コネクタ（roles）の単体テスト。

- 衆/参 委員会名簿パーサ（実HTML構造に基づく最小フィクスチャ）
- influence_roles への投入・氏名突合・ROLE_LEVEL_WEIGHTS連動・source_url単位の置換
"""

from datetime import date

from app.ingest import roles as rr

_SHU_HTML = """
<html><head><title>委員名簿 内閣委員会</title></head><body>
<p>令和 8年 4月24日現在</p>
<table>
<tr><td headers="IIN.YAKUSHOKU">委員長</td><td headers="IIN.SHIMEI">山下　貴司君</td>
    <td headers="IIN.KANA">やました</td><td headers="IIN.KAIHA">自民</td></tr>
<tr><td headers="IIN.YAKUSHOKU">理事</td><td headers="IIN.SHIMEI">安藤　たかお君</td>
    <td headers="IIN.KANA">あんどう</td><td headers="IIN.KAIHA">自民</td></tr>
<tr><td headers="IIN.YAKUSHOKU">委員</td><td headers="IIN.SHIMEI">後藤　祐一君</td>
    <td headers="IIN.KANA">ごとう</td><td headers="IIN.KAIHA">立憲</td></tr>
</table></body></html>
"""

_SAN_HTML = """
<html><head><title>内閣委員会委員名簿：参議院</title></head><body>
<p>令和8年6月3日現在</p>
<table>
<tr><th>役職</th><th>氏名</th><th>会派名（略称）</th><th></th></tr>
<tr><td>委員長</td><td>北村　　経夫</td><td>（自民）</td><td></td></tr>
<tr><td>理事</td><td>今井　絵理子</td><td>（自民）</td><td></td></tr>
<tr><td>委員</td><td>杉尾　秀哉</td><td>（立憲）</td><td></td></tr>
</table></body></html>
"""

_SHU_URL = "https://www.shugiin.go.jp/.../iin_j0010.htm"
_SAN_URL = "https://www.sangiin.go.jp/.../l0063.htm"


def test_parse_shugiin_committee():
    recs = rr.parse_shugiin_committee(_SHU_HTML, _SHU_URL)
    assert [(r.role_name, r.name) for r in recs] == [
        ("委員長", "山下　貴司君"),
        ("理事", "安藤　たかお君"),
        ("委員", "後藤　祐一君"),
    ]
    assert all(r.house == "representatives" for r in recs)
    assert all(r.role_scope == "committee" for r in recs)
    assert recs[0].start_date == "2026-04-24"


def test_parse_sangiin_committee():
    recs = rr.parse_sangiin_committee(_SAN_HTML, _SAN_URL)
    assert [(r.role_name, r.name) for r in recs] == [
        ("委員長", "北村　　経夫"),
        ("理事", "今井　絵理子"),
        ("委員", "杉尾　秀哉"),
    ]
    assert all(r.house == "councillors" for r in recs)
    assert recs[0].start_date == "2026-06-03"


def test_sangiin_roster_urls_extraction():
    """参委員会インデックスから名簿(list/l*.htm)のみを絶対URLで重複なく抽出する。"""
    index = (
        "https://www.sangiin.go.jp/japanese/kon_kokkaijyoho/iinkai/tiinkai.html"
    )
    html = """
    <html><body>
      <a href="../../joho1/kousei/konkokkai/current/list/l0063.htm">内閣</a>
      <a href="/japanese/joho1/kousei/konkokkai/current/list/l0064.htm">総務</a>
      <a href="../../joho1/kousei/konkokkai/current/list/l0063.htm">内閣(重複)</a>
      <a href="../../joho1/kousei/konkokkai/current/plist/p0063.htm">内閣(写真)</a>
      <a href="/japanese/giin/giin.htm">議員一覧</a>
      <a href="https://www.sangiin.go.jp/japanese/joho1/kousei/konkokkai/current/list/l0435.htm">特別委員会</a>
    </body></html>
    """
    urls = rr.sangiin_roster_urls(html, index)
    assert urls == [
        "https://www.sangiin.go.jp/japanese/joho1/kousei/konkokkai/current/list/l0063.htm",
        "https://www.sangiin.go.jp/japanese/joho1/kousei/konkokkai/current/list/l0064.htm",
        "https://www.sangiin.go.jp/japanese/joho1/kousei/konkokkai/current/list/l0435.htm",
    ]


def test_special_committee_chair_role_name():
    html = _SHU_HTML.replace("内閣委員会", "政治改革に関する特別委員会")
    recs = rr.parse_shugiin_committee(html, _SHU_URL)
    assert recs[0].role_name == "特別委員長"


def test_ingest_roles_db(tmp_path):
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    from app import models  # noqa: F401
    from app.database import Base
    from app.models import InfluenceRole, Party, Politician

    engine = create_engine(
        f"sqlite:///{tmp_path / 'roles.db'}", connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(bind=engine)
    db = sessionmaker(bind=engine)()
    try:
        jimin = Party(name_ja="自民", abbreviation="自民")
        rikken = Party(name_ja="立憲", abbreviation="立憲")
        db.add_all([jimin, rikken])
        db.flush()
        # 衆: 山下貴司(委員長) と 後藤祐一(委員) のみDBに存在（安藤は未登録→未突合）
        db.add_all([
            Politician(name_ja="山下貴司", party_id=jimin.id, house="representatives", role_profile="ruling"),
            Politician(name_ja="後藤祐一", party_id=rikken.id, house="representatives", role_profile="opposition"),
        ])
        db.commit()

        recs = rr.parse_shugiin_committee(_SHU_HTML, _SHU_URL)
        res = rr.ingest_roles(db, recs)
        assert res["inserted"] == 2      # 山下・後藤
        assert res["unmatched"] == 1     # 安藤（未登録）
        assert res["committees"] == 1

        chair = (
            db.query(InfluenceRole)
            .join(Politician, Politician.id == InfluenceRole.politician_id)
            .filter(Politician.name_ja == "山下貴司")
            .first()
        )
        assert chair.role_name == "委員長"
        assert chair.level_weight == 5.0        # ROLE_LEVEL_WEIGHTS['委員長']
        assert chair.start_date == date(2026, 4, 24)

        # 置換（再取得）: 同URLで再投入しても重複せず2件のまま
        res2 = rr.ingest_roles(db, recs)
        assert res2["inserted"] == 2
        assert db.query(InfluenceRole).count() == 2
    finally:
        db.close()
        engine.dispose()
