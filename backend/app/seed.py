from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Analysis, Politician


def seed_if_empty(db: Session) -> None:
    has_rows = db.scalar(select(Politician.id).limit(1))
    if has_rows:
        return

    politicians = [
        Politician(
            id=1, name='山田 太郎', party='改革党', house='representatives', district='東京3区',
            age=49, gender='Male', previous_rank=3,
            top_question='政府AIの調達透明性に関する公聴会',
            key_achievement='超党派デジタル行政改革法案を主導',
            summary='高い実績水準と強い政策実行力・委員会影響力を誇る。',
            term_start=date(2021, 11, 1),
        ),
        Politician(
            id=2, name='田中 恵子', party='市民前線', house='representatives', district='大阪2区',
            age=42, gender='Female', previous_rank=1,
            top_question='緊急保育予算の説明責任',
            key_achievement='超党派による母子保健支援法改正を交渉',
            summary='高い質問品質と社会的インパクトにより、常にトップクラスを維持。',
            term_start=date(2021, 11, 1),
        ),
        Politician(
            id=3, name='佐藤 博', party='緑の連合', house='councillors', district='神奈川区',
            age=55, gender='Male', previous_rank=5,
            top_question='沿岸防災資金の不足問題への挑戦',
            key_achievement='地域適応投資パッケージを可決',
            summary='影響力ある立法と気候委員会での活動による強い勢い。',
            term_start=date(2022, 7, 1),
        ),
        Politician(
            id=4, name='小林 美奈', party='未来自由党', house='representatives', district='愛知1区',
            age=37, gender='Female', previous_rank=4,
            top_question='地方県でのSTEM人材流出問題',
            key_achievement='専門学校向け奨学金拡充を実現',
            summary='説得力ある質問実績を持つ急成長するコミュニケーター。',
            term_start=date(2021, 11, 1),
        ),
        Politician(
            id=5, name='中村 大地', party='国民統一党', house='representatives', district='北海道5区',
            age=61, gender='Male', previous_rank=2,
            top_question='燃料補助金の効果検証',
            key_achievement='冬季物流強靭化フレームワークを起草',
            summary='高い手続き活動量に対して質問品質が低く、ランクを落とした。',
            term_start=date(2021, 11, 1),
        ),
        Politician(
            id=6, name='清水 結衣', party='市民前線', house='councillors', district='福岡区',
            age=33, gender='Female', previous_rank=9,
            top_question='住宅費緊急動議',
            key_achievement='若者向け住宅合意形成改正案を構築',
            summary='質の高い介入とSNSの注目で大幅な上昇。',
            term_start=date(2022, 7, 1),
        ),
        Politician(
            id=7, name='林 陸', party='改革党', house='representatives', district='千葉4区',
            age=46, gender='Male', previous_rank=6,
            top_question='防衛調達コスト超過問題',
            key_achievement='調達透明性ダッシュボード義務化を導入',
            summary='影響力スコアは高いが、政策実現速度の向上が課題。',
            term_start=date(2021, 11, 1),
        ),
        Politician(
            id=8, name='藤田 葵', party='緑の連合', house='representatives', district='京都2区',
            age=29, gender='Female', previous_rank=10,
            top_question='食品廃棄物削減の実施不足問題',
            key_achievement='循環型経済パイロット事業への委員会支持を獲得',
            summary='質問品質で急浮上する新進気鋭の声。',
            term_start=date(2021, 11, 1),
        ),
        Politician(
            id=9, name='伊藤 真', party='国民統一党', house='councillors', district='新潟区',
            age=58, gender='Male', previous_rank=7,
            top_question='地方診療所閉鎖の深刻化',
            key_achievement='緊急診療所存続資金を確保',
            summary='地域への影響は強いが、今期は全国的な影響力指標が低下。',
            term_start=date(2022, 7, 1),
        ),
        Politician(
            id=10, name='岡田 奈緒', party='未来自由党', house='representatives', district='埼玉6区',
            age=40, gender='Female', previous_rank=8,
            top_question='中小企業倒産早期警告メカニズム',
            key_achievement='中小企業キャッシュフロー安定化パッケージを導入',
            summary='安定した立法貢献者だが、影響力スコアはまだ発展途上。',
            term_start=date(2021, 11, 1),
        ),
    ]
    db.add_all(politicians)

    analyses = [
        Analysis(politician_id=1, activity_score=94, question_quality_score=87, legislative_score=92, influence_score=89, policy_impact_score=90, final_score=91.6),
        Analysis(politician_id=2, activity_score=90, question_quality_score=94, legislative_score=86, influence_score=88, policy_impact_score=91, final_score=89.9),
        Analysis(politician_id=3, activity_score=83, question_quality_score=85, legislative_score=92, influence_score=86, policy_impact_score=94, final_score=88.4),
        Analysis(politician_id=4, activity_score=88, question_quality_score=90, legislative_score=82, influence_score=80, policy_impact_score=87, final_score=86.5),
        Analysis(politician_id=5, activity_score=91, question_quality_score=72, legislative_score=85, influence_score=88, policy_impact_score=83, final_score=84.1),
        Analysis(politician_id=6, activity_score=79, question_quality_score=91, legislative_score=78, influence_score=74, policy_impact_score=86, final_score=82.9),
        Analysis(politician_id=7, activity_score=84, question_quality_score=78, legislative_score=80, influence_score=83, policy_impact_score=77, final_score=80.4),
        Analysis(politician_id=8, activity_score=75, question_quality_score=88, legislative_score=74, influence_score=70, policy_impact_score=81, final_score=78.8),
        Analysis(politician_id=9, activity_score=81, question_quality_score=73, legislative_score=76, influence_score=69, policy_impact_score=82, final_score=76.2),
        Analysis(politician_id=10, activity_score=77, question_quality_score=76, legislative_score=82, influence_score=68, policy_impact_score=74, final_score=75.4),
    ]
    db.add_all(analyses)
    db.commit()
