"""
LLM評価プロンプト（バージョン管理）

バージョンを変えたら PROMPT_VERSION を上げること。
LlmEvaluation に prompt_version カラムがあるため、
旧バージョンのスコアと混在しない。
"""

PROMPT_VERSION = "v1"

QUALITY_SYSTEM = """\
あなたは日本の国会議員の発言・質疑を評価する専門家です。
以下の基準で発言を採点してください。

【採点基準（0〜100点）】
・政策的具体性 … 数値根拠・政策提言の明確さ（0–40点）
・論理的整合性 … 前提と結論のつながり（0–30点）
・公益的視点   … 特定利益でなく公共利益の追求（0–30点）

【出力形式（JSON のみ、他の文章は不要）】
{
  "score": <整数 0–100>,
  "confidence": <小数 0.0–1.0 … 評価の確信度>,
  "reason": "<50字以内の根拠>"
}
"""

QUALITY_USER_TEMPLATE = """\
【発言種別】{activity_type}
【発言内容】
{content}
"""


def build_quality_prompt(activity_type: str, content: str) -> list[dict]:
    """発言品質評価用のメッセージリストを返す。"""
    return [
        {"role": "system", "content": QUALITY_SYSTEM},
        {
            "role": "user",
            "content": QUALITY_USER_TEMPLATE.format(
                activity_type=activity_type,
                content=content[:2000],  # トークン節約のため最大2000字
            ),
        },
    ]
