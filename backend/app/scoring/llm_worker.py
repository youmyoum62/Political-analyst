"""
LLM非同期評価ワーカー

- キューに積まれた Activity を取り出し、発言品質スコアを付ける
- リトライ: 最大5回、指数バックオフ（1→2→4→8→16秒）
- LLM応答が JSON パースできない場合はリトライし、最終的に status='failed'（quality_score=None）とする
- `OPENAI_API_KEY` 未設定 / openai 未インストール時は評価を実行せず queued のまま据え置く
  （中立値50を succeeded として書き込むサイレント・フォールバックを行わない）
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy.orm import Session

from app.models import Activity, LlmEvaluation
from app.scoring.prompts import PROMPT_VERSION, build_quality_prompt

if TYPE_CHECKING:
    pass

log = logging.getLogger(__name__)

_MAX_RETRIES = 5
_BACKOFF_BASE = 1.0   # 秒


def _llm_availability() -> tuple[bool, str]:
    """LLM評価が実行可能か（APIキー設定済み & openai 導入済み）を判定する。"""
    if not os.getenv("OPENAI_API_KEY"):
        return False, "OPENAI_API_KEY が未設定"
    try:
        import openai  # noqa: F401
    except ImportError:
        return False, "openai パッケージが未インストール"
    return True, ""


async def _call_llm(messages: list[dict]) -> dict:
    """OpenAI chat completion を呼ぶ。設定不備なら例外を送出する（スタブは返さない）。"""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY not set")

    try:
        import openai
    except ImportError as exc:
        raise RuntimeError("openai package not installed") from exc

    client = openai.AsyncOpenAI(api_key=api_key)
    model = os.getenv("LLM_MODEL", "gpt-4o-mini")

    resp = await client.chat.completions.create(  # type: ignore[call-overload]
        model=model,
        messages=messages,
        temperature=0.1,
        max_tokens=256,
        response_format={"type": "json_object"},
    )
    raw = resp.choices[0].message.content or "{}"
    return json.loads(raw)


async def _evaluate_one(activity: Activity) -> dict:
    """1件の Activity を評価し、スコア dict を返す（リトライあり）。"""
    messages = build_quality_prompt(activity.activity_type, activity.content_text or "")
    last_err: Exception | None = None

    for attempt in range(_MAX_RETRIES):
        try:
            result = await _call_llm(messages)
            score = float(result.get("score", 50))
            confidence = float(result.get("confidence", 0.0))
            return {
                "quality_score": max(0.0, min(100.0, score)),
                "confidence": max(0.0, min(1.0, confidence)),
                "status": "succeeded",
                "rationale": (result.get("reason") or None),
            }
        except Exception as exc:
            last_err = exc
            wait = _BACKOFF_BASE * (2 ** attempt)
            log.warning("LLM評価失敗 (attempt=%d, activity_id=%d): %s — %.1f秒後リトライ",
                        attempt + 1, activity.id, exc, wait)
            await asyncio.sleep(wait)

    log.error("LLM評価断念 (activity_id=%d): %s", activity.id, last_err)
    # 失敗時は中立値50を実スコアとして残さない（quality_score=None / status=failed）
    return {"quality_score": None, "confidence": 0.0, "status": "failed",
            "rationale": f"評価失敗: {last_err}"}


def process_pending_evaluations(db: Session, batch_size: int = 50) -> int:
    """
    status='queued' の LlmEvaluation を batch_size 件処理する（同期ラッパー）。
    処理件数を返す。

    LLMが利用不可（APIキー未設定 / openai 未導入）の場合は何も書き込まず0を返す。
    中立値50を succeeded として保存するサイレント・フォールバックは行わない。
    """
    available, reason = _llm_availability()
    if not available:
        queued = db.query(LlmEvaluation).filter(LlmEvaluation.status == "queued").count()
        log.warning(
            "LLM評価をスキップ: %s。%d件を queued のまま据え置きます。", reason, queued
        )
        return 0

    pending = (
        db.query(LlmEvaluation)
        .filter(LlmEvaluation.status == "queued")
        .limit(batch_size)
        .all()
    )
    if not pending:
        return 0

    activity_ids = [e.activity_id for e in pending]
    activities = {a.id: a for a in db.query(Activity).filter(Activity.id.in_(activity_ids)).all()}

    results = asyncio.run(_evaluate_batch([(e, activities.get(e.activity_id)) for e in pending]))

    for evaluation, result in results:
        evaluation.quality_score = result["quality_score"]
        evaluation.confidence = result["confidence"]
        evaluation.status = result["status"]
        evaluation.prompt_version = PROMPT_VERSION
        evaluation.rationale_summary = result.get("rationale")
        if result["status"] == "succeeded":
            evaluation.evaluated_at = datetime.utcnow()

    db.commit()
    return len(pending)


async def _evaluate_batch(pairs: list[tuple]) -> list[tuple]:
    """(LlmEvaluation, Activity | None) のリストを並列評価する。"""
    tasks = []
    for evaluation, activity in pairs:
        if activity is None:
            tasks.append(_stub_result(evaluation))
        else:
            tasks.append(_evaluate_one(activity))

    results_data = await asyncio.gather(*tasks)
    return list(zip([e for e, _ in pairs], results_data))


async def _stub_result(evaluation: LlmEvaluation) -> dict:
    log.warning("Activity not found for LlmEvaluation id=%d", evaluation.id)
    return {"quality_score": None, "confidence": 0.0, "status": "failed",
            "rationale": "対象 Activity が見つかりません"}
