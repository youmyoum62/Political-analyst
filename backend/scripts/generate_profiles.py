#!/usr/bin/env python3
"""
LLM プロフィール生成スクリプト

各議員の summary / top_question / key_achievement を LLM で生成し DB に書き込む。

使い方:
  cd backend
  DATABASE_URL=... ANTHROPIC_API_KEY=... python scripts/generate_profiles.py --all --limit 50
  DATABASE_URL=... ANTHROPIC_API_KEY=... python scripts/generate_profiles.py --politician-id 1
  DATABASE_URL=... python scripts/generate_profiles.py --all --force
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import SessionLocal, engine
from app.llm.provider import AnthropicProvider, OpenAIProvider
from app.models import Activity, Base, LlmEvaluation, Party, Politician, ScoreComponent

# ─────────────────────────────────────────────
# LLM クライアント選択
# ─────────────────────────────────────────────

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

ANTHROPIC_MODEL = "claude-haiku-4-5-20251001"
OPENAI_MODEL = "gpt-4o-mini"


def _call_llm_anthropic(prompt: str) -> str:
    provider = AnthropicProvider(api_key=ANTHROPIC_API_KEY)
    return asyncio.run(provider.complete(user=prompt, model=ANTHROPIC_MODEL, max_tokens=512))


def _call_llm_openai(prompt: str) -> str:
    provider = OpenAIProvider(api_key=OPENAI_API_KEY)
    return asyncio.run(provider.complete(user=prompt, model=OPENAI_MODEL, max_tokens=512))


def _call_llm_stub(name: str) -> dict:
    """API キーなし時のスタブ生成。スキップせず続行するためダミー値を返す。"""
    return {
        "summary": "データ不足のため自動生成できませんでした。",
        "top_question": "データ不足のため自動生成できませんでした。",
        "key_achievement": "データ不足のため自動生成できませんでした。",
    }


def call_llm(prompt: str) -> str:
    if ANTHROPIC_API_KEY:
        return _call_llm_anthropic(prompt)
    if OPENAI_API_KEY:
        return _call_llm_openai(prompt)
    # どちらもなければスタブ（呼び出し元で判断）
    return ""


def is_stub_mode() -> bool:
    return not ANTHROPIC_API_KEY and not OPENAI_API_KEY


# ─────────────────────────────────────────────
# DB ヘルパー
# ─────────────────────────────────────────────

def _get_party_name(db: Session, party_id: Optional[int]) -> str:
    if party_id is None:
        return "無所属"
    party = db.get(Party, party_id)
    return party.name_ja if party else "無所属"


def _get_latest_score(db: Session, politician_id: int) -> tuple[float, float, float, float, float, float]:
    """(final, participation, quality, legislative, policy_impact, influence) を返す。"""
    sc = db.scalars(
        select(ScoreComponent)
        .where(ScoreComponent.politician_id == politician_id)
        .order_by(ScoreComponent.computed_at.desc())
        .limit(1)
    ).first()
    if sc is None:
        return (0.0, 0.0, 0.0, 0.0, 0.0, 0.0)
    final = sc.score.final_score if sc.score else 0.0
    return (
        final,
        sc.participation_score,
        sc.quality_score,
        sc.legislative_score,
        sc.policy_impact_score,
        sc.influence_score,
    )


def _get_top_activities(db: Session, politician_id: int, n: int = 5) -> list[str]:
    """content_text が非 NULL かつ quality_score が高い上位 n 件の質問/発言テキストを返す。"""
    stmt = (
        select(Activity, LlmEvaluation)
        .outerjoin(LlmEvaluation, LlmEvaluation.activity_id == Activity.id)
        .where(
            Activity.politician_id == politician_id,
            Activity.activity_type.in_(["question", "speech"]),
            Activity.content_text.isnot(None),
        )
        .order_by(
            LlmEvaluation.quality_score.desc().nulls_last(),
            Activity.session_date.desc(),
        )
        .limit(n)
    )
    rows = db.execute(stmt).all()
    return [act.content_text for act, _ in rows if act.content_text]


def _build_prompt(
    name: str,
    party: str,
    role_profile: str,
    final_score: float,
    participation: float,
    quality: float,
    legislative: float,
    policy_impact: float,
    influence: float,
    activities: list[str],
) -> str:
    role_label_map = {
        "opposition": "野党",
        "ruling": "与党",
        "cabinet": "閣僚",
        "parliamentary": "院内役職",
    }
    role_label = role_label_map.get(role_profile, role_profile)

    if activities:
        activities_text = "\n".join(f"・{text[:200]}" for text in activities)
    else:
        activities_text = "（発言データなし）"

    return f"""議員名: {name}
所属政党: {party}
役割プロファイル: {role_label} ({role_profile})
最新スコア: 総合{final_score:.1f}点 (参加{participation:.1f} / 品質{quality:.1f} / 立法{legislative:.1f} / 政策{policy_impact:.1f} / 影響力{influence:.1f})

直近の主な発言（質問）:
{activities_text}

上記データを基に、JSON形式で以下を日本語120字以内で生成してください:
{{
  "summary": "このスコアが示すもの（スコアの特徴と議員の活動スタイルを端的に説明）",
  "top_question": "最も注目すべき質問・発言の要点（実際の発言内容を元に）",
  "key_achievement": "主な実績・強み（スコアデータと発言から読み取れる特徴）"
}}"""


def _parse_llm_response(text: str) -> dict:
    """LLM 応答から JSON を抽出してパースする。"""
    # JSON ブロックを抽出（```json ... ``` にも対応）
    text = text.strip()
    if "```" in text:
        # コードブロック内を抽出
        start = text.find("{")
        end = text.rfind("}") + 1
        if start != -1 and end > start:
            text = text[start:end]
    else:
        start = text.find("{")
        end = text.rfind("}") + 1
        if start != -1 and end > start:
            text = text[start:end]
    return json.loads(text)


# ─────────────────────────────────────────────
# 議員プロフィール生成
# ─────────────────────────────────────────────

def generate_profile_for_politician(
    db: Session,
    politician: Politician,
    force: bool = False,
    dry_run: bool = False,
) -> bool:
    """
    1 議員のプロフィールを生成して DB に書き込む。
    スキップした場合は False、処理した場合は True を返す。
    """
    # 既に値が入っていてかつ --force でなければスキップ
    if not force and all([politician.summary, politician.top_question, politician.key_achievement]):
        print(f"  SKIP  [{politician.id:>4}] {politician.name_ja} (既存プロフィールあり)")
        return False

    party = _get_party_name(db, politician.party_id)
    final, participation, quality, legislative, policy_impact, influence = _get_latest_score(
        db, politician.id
    )
    activities = _get_top_activities(db, politician.id, n=5)

    if is_stub_mode():
        result = _call_llm_stub(politician.name_ja)
        mode_label = "STUB"
    else:
        prompt = _build_prompt(
            name=politician.name_ja,
            party=party,
            role_profile=politician.role_profile,
            final_score=final,
            participation=participation,
            quality=quality,
            legislative=legislative,
            policy_impact=policy_impact,
            influence=influence,
            activities=activities,
        )
        try:
            raw = call_llm(prompt)
            result = _parse_llm_response(raw)
        except Exception as e:
            print(f"  ERROR [{politician.id:>4}] {politician.name_ja}: LLM 呼び出し失敗 - {e}")
            return False
        mode_label = "ANTHROPIC" if ANTHROPIC_API_KEY else "OPENAI"

    summary = str(result.get("summary", ""))[:1000]
    top_question = str(result.get("top_question", ""))[:500]
    key_achievement = str(result.get("key_achievement", ""))[:500]

    print(
        f"  {mode_label:<9} [{politician.id:>4}] {politician.name_ja}\n"
        f"    summary        : {summary[:60]}{'…' if len(summary) > 60 else ''}\n"
        f"    top_question   : {top_question[:60]}{'…' if len(top_question) > 60 else ''}\n"
        f"    key_achievement: {key_achievement[:60]}{'…' if len(key_achievement) > 60 else ''}"
    )

    if not dry_run:
        politician.summary = summary
        politician.top_question = top_question
        politician.key_achievement = key_achievement
        db.flush()

    return True


# ─────────────────────────────────────────────
# メイン
# ─────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="LLM プロフィール生成スクリプト")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--politician-id", type=int, help="単体議員の ID を指定")
    group.add_argument("--all", action="store_true", help="全議員を対象にする")
    parser.add_argument("--limit", type=int, default=50, help="処理件数上限（--all 時、デフォルト: 50）")
    parser.add_argument("--force", action="store_true", help="既存プロフィールを上書きする")
    parser.add_argument("--dry-run", action="store_true", help="DB に書き込まずプレビュー")
    args = parser.parse_args()

    if ANTHROPIC_API_KEY:
        provider = f"Anthropic ({ANTHROPIC_MODEL})"
    elif OPENAI_API_KEY:
        provider = f"OpenAI ({OPENAI_MODEL})"
    else:
        provider = "スタブ（API キーなし）"

    print("=" * 60)
    print("LLM プロフィール生成スクリプト")
    print(f"  LLM プロバイダ: {provider}")
    print(f"  モード: {'DRY RUN' if args.dry_run else '本番'}")
    print(f"  上書き: {'有効 (--force)' if args.force else '無効（既存スキップ）'}")
    print("=" * 60)

    Base.metadata.create_all(bind=engine, checkfirst=True)

    with SessionLocal() as db:
        if args.politician_id is not None:
            # 単体モード
            politician = db.get(Politician, args.politician_id)
            if politician is None:
                print(f"エラー: politician_id={args.politician_id} が見つかりません")
                sys.exit(1)
            politicians = [politician]
        else:
            # --all モード
            stmt = (
                select(Politician)
                .where(Politician.is_active == True)  # noqa: E712
                .order_by(Politician.id.asc())
                .limit(args.limit)
            )
            politicians = list(db.scalars(stmt).all())

        print(f"\n対象議員数: {len(politicians)} 名\n")

        processed = skipped = errors = 0
        for pol in politicians:
            try:
                did_process = generate_profile_for_politician(
                    db=db,
                    politician=pol,
                    force=args.force,
                    dry_run=args.dry_run,
                )
                if did_process:
                    processed += 1
                else:
                    skipped += 1
            except Exception as e:
                print(f"  ERROR [{pol.id:>4}] {pol.name_ja}: 予期しないエラー - {e}")
                errors += 1
                continue

        if not args.dry_run:
            db.commit()
            print("\nDB コミット完了")
        else:
            print("\n[DRY RUN] DB への書き込みはスキップしました")

        print(
            f"\n完了: 処理={processed} 件 / スキップ={skipped} 件 / エラー={errors} 件\n"
        )


if __name__ == "__main__":
    main()
