"""
NDL インジェストパイプライン

フロー:
  1. NDL 国会会議録 API から発言データを取得
  2. 議員マスタを自動登録 (external_ref = "ndl:{name}:{house}")
  3. activities テーブルに保存（重複スキップ）
  4. recompute_snapshot でスコア再計算
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from app.models import Activity, IngestionRun, Party, Politician
from app.scoring.snapshot import recompute_snapshot

from .ndl_client import NdlClient, SpeechRecord

log = logging.getLogger(__name__)

# ── 与党判定 ────────────────────────────────────────────────────────────────
# 2026年時点の与党連立政党（会派名で判定）
_RULING_KEYWORDS = {"自由民主党", "自民", "公明党", "公明"}

_PARLIAMENTARY_ROLES = {"議長", "副議長", "委員長", "副委員長"}


def _infer_role_profile(speaker_group: str, speaker_role: str, is_minister: bool) -> str:
    if is_minister:
        return "cabinet"
    if any(r in speaker_role for r in _PARLIAMENTARY_ROLES):
        return "parliamentary"
    if any(k in speaker_group for k in _RULING_KEYWORDS):
        return "ruling"
    return "opposition"


# ── 議員取得/作成 ───────────────────────────────────────────────────────────

def _get_or_create_politician(db: Session, rec: SpeechRecord) -> Politician:
    house = "representatives" if rec.name_of_house == "衆議院" else "councillors"
    ext_ref = f"ndl:{rec.speaker}:{house}"

    pol = db.query(Politician).filter(Politician.external_ref == ext_ref).first()
    if pol:
        return pol

    party_name = rec.speaker_group or "無所属"
    party = db.query(Party).filter(Party.name_ja == party_name).first()
    if not party:
        abbr = party_name[:8] if len(party_name) > 8 else party_name
        party = Party(name_ja=party_name, abbreviation=abbr)
        db.add(party)
        db.flush()

    role = _infer_role_profile(
        rec.speaker_group or "",
        rec.speaker_role or "",
        rec.is_minister,
    )
    pol = Politician(
        external_ref=ext_ref,
        name_ja=rec.speaker,
        party_id=party.id,
        house=house,
        role_profile=role,
        is_active=True,
    )
    db.add(pol)
    db.flush()
    log.debug("新規議員登録: %s (%s / %s)", rec.speaker, party_name, role)
    return pol


def _upsert_activity(db: Session, rec: SpeechRecord, run_id: int) -> bool:
    """既存なら False、新規挿入なら True を返す。"""
    if db.query(Activity.id).filter(Activity.source_hash == rec.source_hash).first():
        return False

    politician = _get_or_create_politician(db, rec)
    act = Activity(
        politician_id=politician.id,
        ingestion_run_id=run_id,
        activity_type=rec.activity_type,
        session_date=rec.session_date,
        source_url=rec.url,
        source_hash=rec.source_hash,
        content_text=rec.speech_text or None,
    )
    db.add(act)
    return True


# ── メインパイプライン ───────────────────────────────────────────────────────

def run_ingest(
    db: Session,
    period_start: Optional[date] = None,
    period_end: Optional[date] = None,
    max_records_per_house: int = 1000,
    skip_scoring: bool = False,
) -> dict:
    """
    NDL からインジェストを実行してスコアを再計算する。
    ingestion_runs に実行記録を残す。
    """
    if period_end is None:
        period_end = date.today()
    if period_start is None:
        period_start = period_end - timedelta(days=90)

    run = IngestionRun(
        source_name="ndl_kokkai",
        started_at=datetime.utcnow(),
        status="running",
        records_seen=0,
        records_inserted=0,
        records_updated=0,
        records_failed=0,
    )
    db.add(run)
    db.commit()

    client = NdlClient()
    seen = inserted = failed = 0

    try:
        for house in ["衆議院", "参議院"]:
            log.info("NDL インジェスト開始: %s (%s〜%s)", house, period_start, period_end)
            for rec in client.iter_speeches(
                period_start,
                period_end,
                name_of_house=house,
                limit=max_records_per_house,
            ):
                seen += 1
                try:
                    if _upsert_activity(db, rec, run.id):
                        inserted += 1
                    # 500件ごとに中間コミット（メモリ節約）
                    if inserted % 500 == 0 and inserted > 0:
                        db.commit()
                        log.info("中間コミット: %d件挿入済み", inserted)
                except Exception:
                    log.exception("activity 保存失敗: %s", rec.speech_id)
                    failed += 1

        db.commit()
        log.info("データ取得完了: seen=%d inserted=%d failed=%d", seen, inserted, failed)

        if not skip_scoring:
            log.info("スコア再計算開始")
            recompute_snapshot(db, period_start, period_end)
            log.info("スコア再計算完了")

        run.status = "success"
    except Exception as exc:
        log.exception("インジェストパイプライン失敗")
        db.rollback()
        run.status = "failure"
        run.error_summary = str(exc)[:500]
        raise
    finally:
        run.finished_at = datetime.utcnow()
        run.records_seen = seen
        run.records_inserted = inserted
        run.records_failed = failed
        try:
            db.commit()
        except Exception:
            db.rollback()

    return {
        "status": run.status,
        "period_start": period_start.isoformat(),
        "period_end": period_end.isoformat(),
        "records_seen": seen,
        "records_inserted": inserted,
        "records_failed": failed,
    }
