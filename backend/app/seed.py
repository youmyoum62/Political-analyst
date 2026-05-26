"""
初期データ投入スクリプト（開発・デモ用）

2スナップショット（前期・当期）を作成してtrendが機能することを確認できる。
スコアは役割プロファイル重みで正しく計算済み（循環依存なし）。
"""

from datetime import date, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    Party,
    Politician,
    Score,
    ScoreComponent,
    WeightSet,
)
from app.scoring.calculator import ROLE_WEIGHTS, compute_final_score


def _insert_weight_set(db: Session) -> WeightSet:
    w = ROLE_WEIGHTS
    ws = WeightSet(
        version="v1.0.0",
        opp_participation=w["opposition"]["participation"],
        opp_quality=w["opposition"]["quality"],
        opp_legislative=w["opposition"]["legislative"],
        opp_policy_impact=w["opposition"]["policy_impact"],
        opp_influence=w["opposition"]["influence"],
        rul_participation=w["ruling"]["participation"],
        rul_quality=w["ruling"]["quality"],
        rul_legislative=w["ruling"]["legislative"],
        rul_policy_impact=w["ruling"]["policy_impact"],
        rul_influence=w["ruling"]["influence"],
        cab_participation=w["cabinet"]["participation"],
        cab_quality=w["cabinet"]["quality"],
        cab_legislative=w["cabinet"]["legislative"],
        cab_policy_impact=w["cabinet"]["policy_impact"],
        cab_influence=w["cabinet"]["influence"],
        par_participation=w["parliamentary"]["participation"],
        par_quality=w["parliamentary"]["quality"],
        par_legislative=w["parliamentary"]["legislative"],
        par_policy_impact=w["parliamentary"]["policy_impact"],
        par_influence=w["parliamentary"]["influence"],
        is_active=True,
    )
    db.add(ws)
    db.flush()
    return ws


def seed_if_empty(db: Session) -> None:
    if db.scalar(select(Politician.id).limit(1)):
        return

    # ── 政党 ─────────────────────────────────
    parties = {
        "改革党":     Party(name_ja="改革党",     abbreviation="改革"),
        "市民前線":   Party(name_ja="市民前線",   abbreviation="市民"),
        "緑の連合":   Party(name_ja="緑の連合",   abbreviation="緑連"),
        "未来自由党": Party(name_ja="未来自由党", abbreviation="未来"),
        "国民統一党": Party(name_ja="国民統一党", abbreviation="国統"),
    }
    for p in parties.values():
        db.add(p)
    db.flush()

    # ── 重みセット ────────────────────────────
    ws = _insert_weight_set(db)

    # ── 議員データ ────────────────────────────
    # (name, party_key, house, district, gender, age, role_profile, term_start,
    #  top_question, key_achievement, summary)
    POLITICIAN_DATA = [
        ("山田 太郎", "改革党",     "representatives", "東京3区",   "Male",   49, "ruling",
         date(2021, 11, 1),
         "政府AIの調達透明性に関する公聴会",
         "超党派デジタル行政改革法案を主導",
         "高い実績水準と強い政策実行力・委員会影響力を誇る。"),
        ("田中 恵子", "市民前線",   "representatives", "大阪2区",   "Female", 42, "opposition",
         date(2021, 11, 1),
         "緊急保育予算の説明責任",
         "超党派による母子保健支援法改正を交渉",
         "高い質問品質と社会的インパクトにより、常にトップクラスを維持。"),
        ("佐藤 博",   "緑の連合",   "councillors",     "神奈川区",  "Male",   55, "opposition",
         date(2022, 7, 1),
         "沿岸防災資金の不足問題への挑戦",
         "地域適応投資パッケージを可決",
         "影響力ある立法と気候委員会での活動による強い勢い。"),
        ("小林 美奈", "未来自由党", "representatives", "愛知1区",   "Female", 37, "opposition",
         date(2021, 11, 1),
         "地方県でのSTEM人材流出問題",
         "専門学校向け奨学金拡充を実現",
         "説得力ある質問実績を持つ急成長するコミュニケーター。"),
        ("中村 大地", "国民統一党", "representatives", "北海道5区", "Male",   61, "ruling",
         date(2021, 11, 1),
         "燃料補助金の効果検証",
         "冬季物流強靭化フレームワークを起草",
         "高い手続き活動量に対して質問品質が低く、ランクを落とした。"),
        ("清水 結衣", "市民前線",   "councillors",     "福岡区",    "Female", 33, "opposition",
         date(2022, 7, 1),
         "住宅費緊急動議",
         "若者向け住宅合意形成改正案を構築",
         "質の高い介入とSNSの注目で大幅な上昇。"),
        ("林 陸",     "改革党",     "representatives", "千葉4区",   "Male",   46, "ruling",
         date(2021, 11, 1),
         "防衛調達コスト超過問題",
         "調達透明性ダッシュボード義務化を導入",
         "影響力スコアは高いが、政策実現速度の向上が課題。"),
        ("藤田 葵",   "緑の連合",   "representatives", "京都2区",   "Female", 29, "opposition",
         date(2021, 11, 1),
         "食品廃棄物削減の実施不足問題",
         "循環型経済パイロット事業への委員会支持を獲得",
         "質問品質で急浮上する新進気鋭の声。"),
        ("伊藤 真",   "国民統一党", "councillors",     "新潟区",    "Male",   58, "ruling",
         date(2022, 7, 1),
         "地方診療所閉鎖の深刻化",
         "緊急診療所存続資金を確保",
         "地域への影響は強いが、今期は全国的な影響力指標が低下。"),
        ("岡田 奈緒", "未来自由党", "representatives", "埼玉6区",   "Female", 40, "opposition",
         date(2021, 11, 1),
         "中小企業倒産早期警告メカニズム",
         "中小企業キャッシュフロー安定化パッケージを導入",
         "安定した立法貢献者だが、影響力スコアはまだ発展途上。"),
    ]

    politicians: list[Politician] = []
    for idx, row in enumerate(POLITICIAN_DATA, start=1):
        name, party_key, house, district, gender, age, role, term_start, tq, ka, summ = row
        pol = Politician(
            id=idx,
            name_ja=name,
            party_id=parties[party_key].id,
            electoral_district=district,
            house=house,
            role_profile=role,
            gender=gender,
            age=age,
            term_start=term_start,
            is_active=True,
            top_question=tq,
            key_achievement=ka,
            summary=summ,
        )
        db.add(pol)
        politicians.append(pol)
    db.flush()

    # ── スコアスナップショット ─────────────────
    # 前期（旧計算式の値。循環依存ありだった頃の参考値として保存）
    PREV_START = date(2025, 11, 27)
    PREV_END   = date(2026, 2, 25)

    # 前期サブスコア（旧 seed.py の値をそのまま流用）
    prev_sub: dict[int, dict[str, float]] = {
        1: dict(p=94.0, q=87.0, l=92.0, pi=90.0, i=89.0),
        2: dict(p=90.0, q=94.0, l=86.0, pi=91.0, i=88.0),
        3: dict(p=83.0, q=85.0, l=92.0, pi=94.0, i=86.0),
        4: dict(p=88.0, q=90.0, l=82.0, pi=87.0, i=80.0),
        5: dict(p=91.0, q=72.0, l=85.0, pi=83.0, i=88.0),
        6: dict(p=79.0, q=91.0, l=78.0, pi=86.0, i=74.0),
        7: dict(p=84.0, q=78.0, l=80.0, pi=77.0, i=83.0),
        8: dict(p=75.0, q=88.0, l=74.0, pi=81.0, i=70.0),
        9: dict(p=81.0, q=73.0, l=76.0, pi=82.0, i=69.0),
        10: dict(p=77.0, q=76.0, l=82.0, pi=74.0, i=68.0),
    }

    # 前期 final_score を役割プロファイル重みで正しく計算
    prev_finals: dict[int, float] = {}
    for pol in politicians:
        s = prev_sub[pol.id]
        prev_finals[pol.id] = compute_final_score(
            s["p"], s["q"], s["l"], s["pi"], s["i"], pol.role_profile
        )

    # 前期の順位を計算
    prev_ranked = sorted(prev_finals.items(), key=lambda x: -x[1])
    prev_rank_map: dict[int, int] = {}
    cur_rank, prev_score = 0, None
    for idx, (pid, fs) in enumerate(prev_ranked, start=1):
        if prev_score is None or fs != prev_score:
            cur_rank = idx
        prev_rank_map[pid] = cur_rank
        prev_score = fs

    prev_at = datetime(2026, 2, 25, 0, 0, 0)
    for pol in politicians:
        s = prev_sub[pol.id]
        sc = ScoreComponent(
            politician_id=pol.id,
            weight_set_id=ws.id,
            period_start=PREV_START,
            period_end=PREV_END,
            participation_score=s["p"],
            quality_score=s["q"],
            legislative_score=s["l"],
            policy_impact_score=s["pi"],
            influence_score=s["i"],
            computed_at=prev_at,
        )
        db.add(sc)
        db.flush()
        db.add(Score(
            politician_id=pol.id,
            component_set_id=sc.id,
            final_score=prev_finals[pol.id],
            rank_snapshot=prev_rank_map[pol.id],
            computed_at=prev_at,
        ))

    # ── 当期スコア ────────────────────────────
    # 前期から微変動させた値で計算（現実感を出す）
    CUR_START = date(2026, 2, 26)
    CUR_END   = date(2026, 5, 26)

    cur_sub: dict[int, dict[str, float]] = {
        1:  dict(p=93.0, q=88.0, l=91.0, pi=90.0, i=90.0),
        2:  dict(p=91.0, q=95.0, l=87.0, pi=92.0, i=89.0),
        3:  dict(p=84.0, q=86.0, l=93.0, pi=95.0, i=87.0),
        4:  dict(p=89.0, q=91.0, l=83.0, pi=88.0, i=81.0),
        5:  dict(p=90.0, q=70.0, l=84.0, pi=82.0, i=87.0),
        6:  dict(p=81.0, q=93.0, l=79.0, pi=87.0, i=76.0),
        7:  dict(p=83.0, q=77.0, l=79.0, pi=76.0, i=82.0),
        8:  dict(p=76.0, q=89.0, l=75.0, pi=82.0, i=71.0),
        9:  dict(p=80.0, q=72.0, l=75.0, pi=81.0, i=68.0),
        10: dict(p=78.0, q=77.0, l=83.0, pi=75.0, i=69.0),
    }

    cur_finals: dict[int, float] = {}
    for pol in politicians:
        s = cur_sub[pol.id]
        cur_finals[pol.id] = compute_final_score(
            s["p"], s["q"], s["l"], s["pi"], s["i"], pol.role_profile
        )

    cur_ranked = sorted(cur_finals.items(), key=lambda x: -x[1])
    cur_rank_map: dict[int, int] = {}
    cur_rank, prev_score = 0, None
    for idx, (pid, fs) in enumerate(cur_ranked, start=1):
        if prev_score is None or fs != prev_score:
            cur_rank = idx
        cur_rank_map[pid] = cur_rank
        prev_score = fs

    cur_at = datetime(2026, 5, 26, 0, 0, 0)
    for pol in politicians:
        s = cur_sub[pol.id]
        sc = ScoreComponent(
            politician_id=pol.id,
            weight_set_id=ws.id,
            period_start=CUR_START,
            period_end=CUR_END,
            participation_score=s["p"],
            quality_score=s["q"],
            legislative_score=s["l"],
            policy_impact_score=s["pi"],
            influence_score=s["i"],
            computed_at=cur_at,
        )
        db.add(sc)
        db.flush()
        db.add(Score(
            politician_id=pol.id,
            component_set_id=sc.id,
            final_score=cur_finals[pol.id],
            rank_snapshot=cur_rank_map[pol.id],
            computed_at=cur_at,
        ))

    db.commit()
