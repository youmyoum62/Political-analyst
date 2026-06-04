"""
参院法案（SmartNews house-of-councillors gian.csv の法律案（参法））を bills へ投入する CLI。

本番は各自のターミナルで実行（DB接続文字列を安全に扱う）。
衆院コネクタとの重複を避けるため参法のみを hc- 名前空間で投入する。
共同発議者(co)の会派は公式に存在しないため bill_sponsors は primary（筆頭発議者）のみ。

使い方（PowerShell）:
  cd C:\\Users\\Yu\\Desktop\\development\\political-analyst\\backend
  $env:DATABASE_URL="postgresql://...（Render/Supabase）"
  python scripts/ingest_sangiin_bills.py --since-kaiji 211 --dry-run
  python scripts/ingest_sangiin_bills.py --since-kaiji 211

出典表記「スマートニュース メディア研究所」を UI に明記すること（MIT）。
"""

import argparse
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import SessionLocal  # noqa: E402
from app.ingest.bills_sangiin import (  # noqa: E402
    GIAN_CSV_URL,
    _download,
    ingest_sangiin_bills,
    parse_csv,
    row_to_bill,
)


def main() -> None:
    ap = argparse.ArgumentParser(description="参院法案（参法）インジェスト")
    ap.add_argument("--since-kaiji", type=int, default=None, help="提出回次がこの値以上のみ対象")
    ap.add_argument("--limit", type=int, default=None, help="処理する議案数の上限")
    ap.add_argument("--dry-run", action="store_true", help="DBへ書き込まず件数・内訳を表示")
    ap.add_argument("--csv", default=None, help="ローカルCSVパス（省略時はSmartNewsからDL）")
    args = ap.parse_args()

    if args.csv:
        csv_text = Path(args.csv).read_text(encoding="utf-8")
    else:
        print(f"CSV取得中: {GIAN_CSV_URL}")
        csv_text = _download(GIAN_CSV_URL)

    if args.dry_run:
        bills = []
        for r in parse_csv(csv_text):
            if args.since_kaiji is not None:
                try:
                    if int((r.get("提出回次") or "0").strip()) < args.since_kaiji:
                        continue
                except ValueError:
                    continue
            br = row_to_bill(r)
            if br:
                bills.append(br)
        print(f"[DRY RUN] 対象参法={len(bills)} / status内訳={dict(Counter(b.status for b in bills))}")
        with_lead = sum(1 for b in bills if b.primary_sponsors)
        print(f"[DRY RUN] 筆頭発議者ありの参法={with_lead}")
        for b in bills[:5]:
            print(f"  例: {b.bill_code} | {b.status} | {b.title[:28]} | lead={b.primary_sponsors}")
        return

    db = SessionLocal()
    try:
        res = ingest_sangiin_bills(
            db, csv_text=csv_text, since_kaiji=args.since_kaiji, limit=args.limit
        )
        print("完了:", res)
    finally:
        db.close()


if __name__ == "__main__":
    main()
