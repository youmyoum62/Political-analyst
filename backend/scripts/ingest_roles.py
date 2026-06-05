"""
役職（委員会名簿）→ influence_roles 投入 CLI。本番は各自の DATABASE_URL で実行。

衆議院は list.htm から委員会ページを自動巡回（Shift_JIS）。
参議院は委員会ページURLを --sangiin-url で個別指定する（参の一覧索引は本実装では未巡回）。
取得は数秒間隔・User-Agent明示で礼儀的に行う。

使い方（PowerShell）:
  cd C:\\Users\\Yu\\Desktop\\development\\political-analyst\\backend
  $env:DATABASE_URL="postgresql://...（Render/Supabase）"
  python scripts/ingest_roles.py --dry-run
  python scripts/ingest_roles.py
"""

import argparse
import sys
import time
from collections import Counter
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import SessionLocal  # noqa: E402
from app.ingest.roles import (  # noqa: E402
    SANGIIN_COMMITTEE_INDEX,
    ingest_roles,
    parse_sangiin_committee,
    parse_shugiin_committee,
    sangiin_roster_urls,
)

SHU_LIST = "https://www.shugiin.go.jp/internet/itdb_iinkai.nsf/html/iinkai/list.htm"
HEADERS = {"User-Agent": "political-analyst-bot/1.0 (committee roster ingest)"}


def _get(url: str, encoding: str) -> str:
    r = requests.get(url, headers=HEADERS, timeout=30)
    r.raise_for_status()
    r.encoding = encoding
    return r.text


def crawl_shugiin() -> list:
    html = _get(SHU_LIST, "cp932")
    soup = BeautifulSoup(html, "html.parser")
    records = []
    seen = set()
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if not href.endswith(".htm") or not ("iin_j" in href or "iin_t" in href):
            continue
        url = urljoin(SHU_LIST, href)
        if url in seen:
            continue
        seen.add(url)
        try:
            recs = parse_shugiin_committee(_get(url, "cp932"), url)
            records.extend(recs)
            print(f"  衆 {url} -> {len(recs)}名")
        except Exception as e:  # noqa: BLE001
            print(f"  取得失敗 {url}: {e}")
        time.sleep(1.0)
    return records


def crawl_sangiin() -> list:
    """参議院の今国会委員会一覧から各委員名簿を自動巡回して役職レコードを収集する。"""
    index_html = _get(SANGIIN_COMMITTEE_INDEX, "utf-8")
    urls = sangiin_roster_urls(index_html)
    print(f"  参委員会一覧: {len(urls)} 委員会を検出")
    records = []
    for url in urls:
        try:
            recs = parse_sangiin_committee(_get(url, "utf-8"), url)
            records.extend(recs)
            print(f"  参 {url} -> {len(recs)}名")
        except Exception as e:  # noqa: BLE001
            print(f"  取得失敗 {url}: {e}")
        time.sleep(1.0)
    return records


def main() -> None:
    ap = argparse.ArgumentParser(description="役職(委員会名簿)インジェスト")
    ap.add_argument("--dry-run", action="store_true", help="DBへ書き込まず内訳を表示")
    ap.add_argument(
        "--sangiin-auto",
        action="store_true",
        help="参委員会一覧から各名簿を自動巡回（衆と同様に全委員会を取得）",
    )
    ap.add_argument(
        "--sangiin-url", action="append", default=[], help="参委員会ページURL（個別指定・複数可）"
    )
    args = ap.parse_args()

    records = crawl_shugiin()
    if args.sangiin_auto:
        records.extend(crawl_sangiin())
    for url in args.sangiin_url:
        try:
            records.extend(parse_sangiin_committee(_get(url, "utf-8"), url))
            print(f"  参 {url}")
        except Exception as e:  # noqa: BLE001
            print(f"  取得失敗 {url}: {e}")
        time.sleep(1.0)

    print(f"収集: {len(records)} 役職レコード")
    if args.dry_run:
        print("role_name内訳:", dict(Counter(r.role_name for r in records)))
        for r in records[:8]:
            print(f"  {r.house} | {r.role_name} | {r.name}")
        return

    db = SessionLocal()
    try:
        print("完了:", ingest_roles(db, records))
    finally:
        db.close()


if __name__ == "__main__":
    main()
