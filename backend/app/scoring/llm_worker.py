"""
LLM非同期評価ワーカー

- キューに積まれた Activity を取り出し、発言品質スコアを付ける
- リトライ: 最大5回、指数バックオフ（1→2→4→8→16秒）
- LLM応答が JSON パースできない場合はリトライし、最終的に status='failed'（quality_score=None）とする
- `ANTHROPIC_API_KEY`（優先）/ `OPENAI_API_KEY` のいずれも未設定、または対応 SDK が未導入の
  ときは評価を実行せず queued のまま据え置く
  （中立値50を succeeded として書き込むサイレント・フォールバックを行わない）
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy.orm import Session

from app.llm.provider import AnthropicProvider, OpenAIProvider
from app.models import Activity, LlmEvaluation
from app.scoring.prompts import PROMPT_VERSION, build_quality_prompt

if TYPE_CHECKING:
    pass

log = logging.getLogger(__name__)

_MAX_RETRIES = 5
_BACKOFF_BASE = 1.0   # 秒

# 既定モデル。LLM_MODEL 環境変数で上書きできる。
# 採点は「0〜100点＋50字の理由」という短い定型タスクのため Haiku を既定にしている
# （2,143件のバッチでコストが Opus の 1/5 程度に収まる。品質を上げたいときは
#  LLM_MODEL=claude-opus-5 で切り替える）。
_DEFAULT_ANTHROPIC_MODEL = "claude-haiku-4-5"
_DEFAULT_OPENAI_MODEL = "gpt-4o-mini"

# Claude Opus 5 等は思考が既定で ON で、max_tokens は「思考＋本文」の合算上限になる。
# 採点 JSON 自体は 100 トークン程度だが、思考分の余裕が無いと途中で切れる
# （Haiku では思考が無いため実際の出力分しか課金されない）。
_ANTHROPIC_MAX_TOKENS = 2048

# effort（思考量）パラメータに非対応で、渡すと 400 になるモデル。
_NO_EFFORT_PREFIXES = ("claude-haiku-4-5", "claude-sonnet-4-5")

# temperature が削除され、渡すと 400 になるモデル。
# これ以外（Haiku 4.5 等）では採点のブレを抑えるため低い値を渡す。
_NO_TEMPERATURE_PREFIXES = (
    "claude-fable-5",
    "claude-mythos-5",
    "claude-opus-5",
    "claude-opus-4-7",
    "claude-opus-4-8",
    "claude-sonnet-5",
)

# 応答からの JSON 抽出用（コードフェンスや前置きが混ざったときの保険）。
_JSON_OBJECT_RE = re.compile(r"\{.*\}", re.DOTALL)


def _llm_availability() -> tuple[bool, str]:
    """LLM評価が実行可能か（APIキー設定済み & 対応SDK導入済み）を判定する。"""
    if os.getenv("ANTHROPIC_API_KEY"):
        try:
            import anthropic  # noqa: F401
        except ImportError:
            return False, "anthropic パッケージが未インストール"
        return True, ""
    if os.getenv("OPENAI_API_KEY"):
        try:
            import openai  # noqa: F401
        except ImportError:
            return False, "openai パッケージが未インストール"
        return True, ""
    return False, "ANTHROPIC_API_KEY / OPENAI_API_KEY のいずれも未設定"


def resolve_model_name() -> str:
    """実際に使われるモデル名を返す。

    LlmEvaluation.model_name に記録する値と実際の呼び出し先を一致させるため、
    キュー登録側（scripts/ingest.py）もこの関数を使う。
    """
    if os.getenv("ANTHROPIC_API_KEY"):
        return os.getenv("LLM_MODEL", _DEFAULT_ANTHROPIC_MODEL)
    return os.getenv("LLM_MODEL", _DEFAULT_OPENAI_MODEL)


def _effort_for(model: str) -> str | None:
    """採点は短い定型タスクのため低 effort で足りる。非対応モデルには渡さない。"""
    if model.startswith(_NO_EFFORT_PREFIXES):
        return None
    return (os.getenv("LLM_EFFORT") or "").strip() or "low"


def _int_env(name: str, default: int) -> int:
    """整数の環境変数を読む。未設定・空文字・不正値なら既定値を使う。

    GitHub Actions は未入力の workflow_dispatch 入力を空文字で渡してくるため、
    os.getenv の第2引数だけでは既定値にフォールバックしない。
    """
    raw = (os.getenv(name) or "").strip()
    if not raw:
        return default
    try:
        return max(1, int(raw))
    except ValueError:
        log.warning("%s の値が不正なため既定値 %d を使います: %r", name, default, raw)
        return default


def _batch_size() -> int:
    """1回の実行で処理する queued 件数。LLM_BATCH_SIZE で調整する。

    キューに数千件溜まった状態を数回の実行で消化するために引き上げられるようにした
    （既定の 100 のままだと全件消化に何十日もかかる）。
    """
    return _int_env("LLM_BATCH_SIZE", 100)


def _concurrency() -> int:
    """同時リクエスト数の上限。LLM_CONCURRENCY で調整する。

    batch_size をそのまま同時実行するとレート制限やソケット枯渇を招くため、
    件数と並列度を分離する。100 並列は実測で問題なかったが、余裕を見て 20 を既定にする。
    """
    return _int_env("LLM_CONCURRENCY", 20)


def _temperature_for(model: str) -> float | None:
    """採点を安定させるため低い temperature を渡す。受け付けないモデルには渡さない。"""
    if model.startswith(_NO_TEMPERATURE_PREFIXES):
        return None
    return 0.1


def _parse_json_object(raw: str) -> dict:
    """LLM 応答から採点 JSON を取り出す。

    Anthropic には OpenAI の json_mode に相当する強制モードが無く、コードフェンスや
    前置きが混ざることがあるため、素の json.loads が失敗したら最外の {...} を拾う。
    """
    text = (raw or "").strip()
    if not text:
        raise ValueError("LLM 応答が空です")

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        match = _JSON_OBJECT_RE.search(text)
        if not match:
            raise ValueError(f"LLM 応答から JSON を抽出できません: {text[:200]}") from None
        parsed = json.loads(match.group(0))

    if not isinstance(parsed, dict):
        raise ValueError(f"LLM 応答が JSON オブジェクトではありません: {text[:200]}")
    return parsed


async def _call_llm(messages: list[dict]) -> dict:
    """LLM を呼んで採点 JSON を返す。設定不備なら例外を送出する（スタブは返さない）。

    Anthropic を優先し、キーが無ければ OpenAI にフォールバックする。
    """
    system = next((m["content"] for m in messages if m["role"] == "system"), None)
    user = next(m["content"] for m in messages if m["role"] == "user")

    anthropic_key = os.getenv("ANTHROPIC_API_KEY")
    if anthropic_key:
        try:
            import anthropic  # noqa: F401  # 未導入時に ImportError を検出するための存在確認
        except ImportError as exc:
            raise RuntimeError("anthropic package not installed") from exc

        model = resolve_model_name()
        raw = await AnthropicProvider(api_key=anthropic_key).complete(
            user=user,
            system=system,
            model=model,
            temperature=_temperature_for(model),
            max_tokens=_ANTHROPIC_MAX_TOKENS,
            effort=_effort_for(model),
        )
        return _parse_json_object(raw)

    openai_key = os.getenv("OPENAI_API_KEY")
    if not openai_key:
        raise RuntimeError("ANTHROPIC_API_KEY / OPENAI_API_KEY not set")

    try:
        import openai  # noqa: F401  # 未導入時に ImportError を検出するための存在確認
    except ImportError as exc:
        raise RuntimeError("openai package not installed") from exc

    raw = await OpenAIProvider(api_key=openai_key).complete(
        user=user,
        system=system,
        model=resolve_model_name(),
        temperature=0.1,
        max_tokens=256,
        json_mode=True,
    )
    return _parse_json_object(raw)


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


def process_pending_evaluations(db: Session, batch_size: int | None = None) -> int:
    """
    status='queued' の LlmEvaluation を batch_size 件処理する（同期ラッパー）。
    処理件数を返す。batch_size 省略時は LLM_BATCH_SIZE 環境変数（既定100）に従う。

    LLMが利用不可（APIキー未設定 / SDK 未導入）の場合は何も書き込まず0を返す。
    中立値50を succeeded として保存するサイレント・フォールバックは行わない。
    """
    if batch_size is None:
        batch_size = _batch_size()

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
    """(LlmEvaluation, Activity | None) のリストを並列評価する。

    batch_size をそのまま同時実行するとレート制限に当たるため、
    セマフォで同時リクエスト数を絞る（件数と並列度を分離する）。
    """
    sem = asyncio.Semaphore(_concurrency())

    async def _run(evaluation: LlmEvaluation, activity: Activity | None) -> dict:
        if activity is None:
            return await _stub_result(evaluation)
        async with sem:
            return await _evaluate_one(activity)

    results_data = await asyncio.gather(*(_run(e, a) for e, a in pairs))
    return list(zip([e for e, _ in pairs], results_data))


async def _stub_result(evaluation: LlmEvaluation) -> dict:
    log.warning("Activity not found for LlmEvaluation id=%d", evaluation.id)
    return {"quality_score": None, "confidence": 0.0, "status": "failed",
            "rationale": "対象 Activity が見つかりません"}
