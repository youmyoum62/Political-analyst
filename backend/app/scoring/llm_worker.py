"""
LLM非同期評価ワーカー

- キューに積まれた Activity を取り出し、発言品質スコアを付ける
- リトライ: 最大5回、指数バックオフ（1→2→4→8→16秒）
- LLM応答が JSON パースできない場合は confidence=0 として保存
- `OPENAI_API_KEY` 環境変数が未設定のときはスタブ（confidence=0）で埋める
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import TYPE_CHECKING

from sqlalchemy.orm import Session

from app.models import Activity, LlmEvaluation
from app.scoring.prompts import PROMPT_VERSION, build_quality_prompt

if TYPE_CHECKING:
    pass

log = logging.getLogger(__name__)

_MAX_RETRIES = 5
_BACKOFF_BASE = 1.0   # 秒


async def _call_llm(messages: list[dict]) -> dict:
    """OpenAI chat completion を呼ぶ。APIキー未設定ならスタブを返す。"""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return {"score": 50, "confidence": 0.0, "reason": "API key not set (stub)"}

    try:
        import openai  # type: ignore
    except ImportError:
        return {"score": 50, "confidence": 0.0, "reason": "openai package not installed (stub)"}

    client = openai.AsyncOpenAI(api_key=api_key)
    model = os.getenv("LLM_MODEL", "gpt-4o-mini")

    resp = await client.chat.completions.create(
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
            }
        except Exception as exc:
            last_err = exc
            wait = _BACKOFF_BASE * (2 ** attempt)
            log.warning("LLM評価失敗 (attempt=%d, activity_id=%d): %s — %.1f秒後リトライ",
                        attempt + 1, activity.id, exc, wait)
            await asyncio.sleep(wait)

    log.error("LLM評価断念 (activity_id=%d): %s", activity.id, last_err)
    return {"quality_score": 50.0, "confidence": 0.0, "status": "failed"}


def process_pending_evaluations(db: Session, batch_size: int = 50) -> int:
    """
    status='queued' の LlmEvaluation を batch_size 件処理する（同期ラッパー）。
    処理件数を返す。
    """
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
    return {"quality_score": 50.0, "confidence": 0.0, "status": "failed"}
