"""
衆院法案（SmartNews gian.csv）を bills / bill_sponsors に投入する CLI。

本番は認証情報を含むため、自分のターミナルで実行すること（DB接続文字列を安全に扱う）。

使い方（PowerShell）:
  cd C:\\Users\\Yu\\Desktop\\development\\political-analyst\\backend
  $env:DATABASE_URL="postgresql://...（Render/Supabase）"

  # ① まず DRY RUN で件数・status内訳・変換例を確認（DBへの書き込みなし）
  python scripts/ingest_shugiin_bills.py --since-kaiji 211 --dry-run

  # ② 問題なければ本実行
  python scripts/ingest_shugiin_bills.py --since-kaiji 211

出典表記「スマートニュース メディア研究所」を UI に明記すること（MIT ライセンス）。
"""

import argparse
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import SessionLocal  # noqa: E402
from app.ingest.bills_shugiin import (  # noqa: E402
    GIAN_CSV_URL,
    _download,
    ingest_shugiin_bills,
    parse_csv,
    row_to_bill,
)


def main() -> None:
    ap = argparse.ArgumentParser(description="衆院法案インジェスト")
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
        rows = parse_csv(csv_text)
        bills = []
        for r in rows:
            if args.since_kaiji is not None:
                try:
                    if int((r.get("提出回次") or "0").strip()) < args.since_kaiji:
                        continue
                except ValueError:
                    continue
            br = row_to_bill(r)
            if br:
                bills.append(br)
        print(f"[DRY RUN] 対象議案={len(bills)} / status内訳={dict(Counter(b.status for b in bills))}")
        with_primary = sum(1 for b in bills if b.primary_sponsors)
        print(f"[DRY RUN] 個人提出者ありの議案={with_primary}（閣法等は提出者=内閣で0）")
        for b in bills[:5]:
            print(
                f"  例: {b.bill_code} | {b.status} | {b.title[:28]} | "
                f"primary={len(b.primary_sponsors)} co={len(b.co_sponsors)} | submitted={b.submitted_date}"
            )
        return

    db = SessionLocal()
    try:
        res = ingest_shugiin_bills(
            db, csv_text=csv_text, since_kaiji=args.since_kaiji, limit=args.limit
        )
        print("完了:", res)
    finally:
        db.close()


if __name__ == "__main__":
    main()
