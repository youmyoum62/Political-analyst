"""
スコア再計算 CLI。指定期間で全アクティブ議員のスコアスナップショットを書き込む。

会議録・法案・役職を本番DBへ投入した後にこれを実行すると、立法実績(legislative)・
影響力(influence)などが反映される。ランキングは各議員の最新 computed_at を採用する
ため、新しい期間で再計算すれば period に関係なく最新として表示される。

冪等性: recompute_snapshot は同一 (period_start, period_end) の既存スナップショットを
スキップする。反映させたい場合はこれまで未使用の期間を指定すること。

使い方（PowerShell）:
  cd C:\\Users\\Yu\\Desktop\\development\\political-analyst\\backend
  $env:DATABASE_URL="postgresql://...（Render/Supabase）"
  python scripts/recompute_snapshot.py --period-start 2024-01-01 --period-end 2026-06-05
"""

import argparse
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import SessionLocal, wait_for_db  # noqa: E402
from app.scoring.snapshot import recompute_snapshot  # noqa: E402


def main() -> None:
    ap = argparse.ArgumentParser(description="スコアスナップショット再計算")
    ap.add_argument(
        "--period-start", required=True, help="集計期間の開始日 (ISO, 例 2024-01-01)"
    )
    ap.add_argument(
        "--period-end", required=True, help="集計期間の終了日 (ISO, 例 2026-06-05)"
    )
    args = ap.parse_args()

    period_start = date.fromisoformat(args.period_start)
    period_end = date.fromisoformat(args.period_end)
    if period_end < period_start:
        ap.error("--period-end は --period-start 以降である必要があります")

    print(f"=== スコア再計算 period {period_start} 〜 {period_end} ===")
    # Supabase pooler への断続的な接続 timeout に備え、接続確立まで待ってから進む
    wait_for_db()
    db = SessionLocal()
    try:
        written = recompute_snapshot(
            db, period_start=period_start, period_end=period_end
        )
    finally:
        db.close()
    print(f"完了: {written} 件のスコアスナップショットを書き込み")


if __name__ == "__main__":
    main()
