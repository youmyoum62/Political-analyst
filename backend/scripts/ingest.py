#!/usr/bin/env python3
"""
国会議員データ取込スクリプト v2 - 全議員対応版

データソース:
  1. 衆議院 / 参議院 公式サイト    - 全議員リスト（発言ゼロ議員も含む）
  2. 国会会議録検索システムAPI      - 各議員の発言データ
  3. Wikipedia日本語版API          - 年齢・性別の補完
  4. Claude API (オプション)       - 質問品質スコアリング

使い方:
  cd backend
  python -m scripts.ingest                        # 全議員取込（デフォルト）
  python -m scripts.ingest --days 180             # 過去半年で判定
  python -m scripts.ingest --limit 50             # 先頭50名のみ（テスト用）
  python -m scripts.ingest --mode top --limit 30  # 発言上位30名のみ（高速）
  python -m scripts.ingest --dry-run              # 保存せずプレビュー
"""

from __future__ import annotations

import argparse
import os
import re
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path

import requests
from bs4 import BeautifulSoup
from sqlalchemy.orm import Session

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import SessionLocal, engine
from app.models import Analysis, Base, Politician

# ---------------------------------------------------------------------------
# 定数
# ---------------------------------------------------------------------------

KOKKAI_API = "https://kokkai.ndl.go.jp/api"
WIKIPEDIA_API = "https://ja.wikipedia.org/api/rest_v1"
SHUGIIN_URL = "https://www.shugiin.go.jp/internet/itdb_annai.nsf/html/statics/syu/1giin.htm"

BOT_HEADERS = {
    "User-Agent": "PoliticalAnalystBot/1.0 (research-tool; non-commercial)",
}
REQUEST_INTERVAL = 0.6  # API間隔(秒)

# 政党名の正規化（公式サイトの略称・会派名 → 表示名）
PARTY_MAP: dict[str, str] = {
    # 衆議院サイト略称
    "自民": "自由民主党",
    "公明": "公明党",
    "立憲": "立憲民主党",
    "維新": "日本維新の会",
    "共産": "日本共産党",
    "国民": "国民民主党",
    "れいわ": "れいわ新選組",
    "社民": "社会民主党",
    "参政": "参政党",
    "保守": "日本保守党",
    "有志": "有志の会",
    # 会議録APIの会派名（長いもの）
    "自由民主党・無所属の会": "自由民主党",
    "自由民主党・国民の声": "自由民主党",
    "立憲民主党・社民・無所属": "立憲民主党",
    "立憲民主党・無所属": "立憲民主党",
    "日本維新の会・教育無償化を実現する会": "日本維新の会",
    "国民民主党・無所属クラブ": "国民民主党",
    "社会民主党・無所属": "社会民主党",
}

# 影響力スコア計算で重みを置く重要会議
HIGH_INFLUENCE_MEETINGS: frozenset[str] = frozenset([
    "本会議", "予算委員会", "決算行政監視委員会",
    "内閣委員会", "外務委員会", "財務金融委員会", "憲法審査会",
])


def normalize_party(raw: str) -> str:
    raw = raw.strip()
    for key, value in PARTY_MAP.items():
        if raw == key or raw.startswith(key):
            return value
    return raw or "無所属"


# ---------------------------------------------------------------------------
# Step A: 公式サイトから全議員リストを取得
# ---------------------------------------------------------------------------

def _parse_table_rows(soup: BeautifulSoup, min_cols: int) -> list[list[str]]:
    """min_cols 列以上を持つ全テーブルからデータ行を収集する"""
    all_rows: list[list[str]] = []
    seen: set[str] = set()
    for table in soup.find_all("table"):
        for tr in table.find_all("tr"):
            cells = [td.get_text(" ", strip=True) for td in tr.find_all("td")]
            if len(cells) >= min_cols:
                key = cells[0]
                if key and key not in seen:
                    seen.add(key)
                    all_rows.append(cells)
    return all_rows


def fetch_shugiin_members() -> list[dict]:
    """衆議院公式サイトから全議員リストを取得する"""
    print("  衆議院議員リストを取得中 ...")
    try:
        resp = requests.get(SHUGIIN_URL, headers=BOT_HEADERS, timeout=30)
        resp.raise_for_status()
        # エンコーディングを自動検出
        resp.encoding = resp.apparent_encoding
        soup = BeautifulSoup(resp.text, "html.parser")
    except Exception as e:
        print(f"  [警告] 衆議院サイト取得失敗: {e}")
        return []

    members: list[dict] = []
    # 実際の列順: 氏名, ふりがな, 会派, 選挙区, 当選回数
    HEADER_PATTERNS = {"氏名", "姓名", "ふりがな", "会派", "選挙区", "当選回数"}
    for cells in _parse_table_rows(soup, min_cols=5):
        # 氏名: 全角スペース・半角スペース・「君」を除去
        name = re.sub(r"[\s　君@]", "", cells[0])
        party_raw = cells[2].strip()   # 会派
        district = cells[3].strip()    # 選挙区

        # ヘッダー行・ナビ行をスキップ
        if not name or name in HEADER_PATTERNS or name.startswith("氏名"):
            continue
        if not party_raw or party_raw in HEADER_PATTERNS:
            continue

        members.append({
            "name": name,
            "party": normalize_party(party_raw),
            "house": "representatives",
            "district": district,
            "gender": None,
            "age": None,
        })

    print(f"  → 衆議院: {len(members)} 名")
    return members


def _get_sangiin_url() -> str:
    """参議院の現在の議員一覧URLを取得する。
    JavaScriptリダイレクトのためHTTPリダイレクトでは取得できない場合は
    ページ内のリンクタグを解析してURLを取得する。
    """
    base = "https://www.sangiin.go.jp"
    current = f"{base}/japanese/joho1/kousei/giin/current/giin.htm"
    resp = requests.get(current, headers=BOT_HEADERS, allow_redirects=True, timeout=15)

    # HTTPリダイレクトで別URLに移動した場合
    if resp.url != current:
        return resp.url

    # JavaScriptリダイレクト: ページ内の <a href="..."> を解析
    soup = BeautifulSoup(resp.text, "html.parser")
    link = soup.find("a", href=True)
    if link:
        href = str(link["href"])
        return href if href.startswith("http") else base + href

    # フォールバック: 既知の最新URLを使用
    return f"{base}/japanese/joho1/kousei/giin/221/giin.htm"


def fetch_sangiin_members() -> list[dict]:
    """参議院公式サイトから全議員リストを取得する"""
    print("  参議院議員リストを取得中 ...")
    try:
        url = _get_sangiin_url()
        resp = requests.get(url, headers=BOT_HEADERS, timeout=30)
        resp.raise_for_status()
        resp.encoding = resp.apparent_encoding
        soup = BeautifulSoup(resp.text, "html.parser")
    except Exception as e:
        print(f"  [警告] 参議院サイト取得失敗: {e}")
        return []

    members: list[dict] = []
    # 実際の列順: 議員氏名, 読み方, 会派, 選挙区, 任期満了日
    NAV_PATTERNS = {"あ行", "か行", "さ行", "た行", "な行", "は行", "ま行", "や行", "ら行", "わ行"}
    SANGIIN_HEADERS = {"議員氏名", "よみがな", "会派名等", "選挙区", "任期満了日"}
    for cells in _parse_table_rows(soup, min_cols=3):
        name = re.sub(r"[\s　]", "", cells[0])  # 空白・全角スペースを除去
        party_raw = cells[2].strip() if len(cells) > 2 else ""
        district = cells[3].strip() if len(cells) > 3 else ""

        # ナビゲーション行・ヘッダー行をスキップ
        if not name or name in NAV_PATTERNS or name in SANGIIN_HEADERS:
            continue
        if not party_raw or party_raw in NAV_PATTERNS or party_raw in SANGIIN_HEADERS:
            continue

        members.append({
            "name": name,
            "party": normalize_party(party_raw),
            "house": "councillors",
            "district": district,
            "gender": None,
            "age": None,
        })

    print(f"  → 参議院: {len(members)} 名")
    return members


def fetch_all_members() -> list[dict]:
    """衆参両院の全議員リストを結合して返す"""
    shugiin = fetch_shugiin_members()
    time.sleep(REQUEST_INTERVAL)
    sangiin = fetch_sangiin_members()

    # 重複除去（同一名は1件に）
    seen: set[str] = set()
    merged: list[dict] = []
    for m in shugiin + sangiin:
        if m["name"] not in seen:
            seen.add(m["name"])
            merged.append(m)

    print(f"  合計: {len(merged)} 名（重複除去済み）")
    return merged


# ---------------------------------------------------------------------------
# Step B: 各議員の発言を個別検索
# ---------------------------------------------------------------------------

def fetch_member_speeches(
    name: str, from_date: str, until_date: str
) -> tuple[int, list[str], set[str]]:
    """
    指定議員の発言を国会会議録APIで検索する。
    Returns: (発言件数, 発言テキストリスト, 出席委員会セット)
    """
    speeches: list[str] = []
    committees: set[str] = set()
    start = 1

    while True:
        params = {
            "speaker": name,
            "from": from_date,
            "until": until_date,
            "maximumRecords": 100,
            "startRecord": start,
            "recordPacking": "json",
        }
        try:
            resp = requests.get(
                f"{KOKKAI_API}/speech", params=params, headers=BOT_HEADERS, timeout=20
            )
            resp.raise_for_status()
            data = resp.json()
        except Exception:
            break

        records = data.get("speechRecord", [])
        for rec in records:
            text = (rec.get("speech") or "").strip()
            meeting = (rec.get("nameOfMeeting") or "").strip()
            if text:
                speeches.append(text)
            if meeting:
                committees.add(meeting)

        next_pos = data.get("nextRecordPosition")
        if next_pos is None:
            break
        start = next_pos
        time.sleep(REQUEST_INTERVAL)

    return len(speeches), speeches, committees


# ---------------------------------------------------------------------------
# Step C: スコア計算
# ---------------------------------------------------------------------------

def heuristic_quality_score(speeches: list[str]) -> float:
    if not speeches:
        return 0.0

    scores: list[float] = []
    for text in speeches[:30]:
        if not text:
            continue
        length_score = min(100.0, len(text) / 2.0)
        data_hits = len(re.findall(
            r"\d+(?:\.\d+)?(?:億|兆|万|千|百|%|パーセント|年度|年|か月|件|人|名|回)", text
        ))
        data_score = min(100.0, data_hits * 8.0)
        q_hits = (
            text.count("か。")
            + text.count("でしょうか")
            + text.count("ますか")
            + text.count("ですか")
        )
        question_score = min(100.0, q_hits * 12.0)
        scores.append(length_score * 0.4 + data_score * 0.35 + question_score * 0.25)

    return round(sum(scores) / len(scores), 1) if scores else 0.0


def claude_quality_score(speeches: list[str], name: str) -> float:
    try:
        import anthropic

        client = anthropic.Anthropic()
        sample = [s for s in speeches if len(s) > 80][:4]
        if not sample:
            return 0.0

        combined = "\n\n---\n\n".join(sample)[:3000]
        msg = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=8,
            messages=[{
                "role": "user",
                "content": (
                    f"国会議員「{name}」の発言を0〜100点で評価。\n"
                    "評価基準：具体性・データ引用・政策の深さ・論理性・建設的提案\n"
                    "整数スコアのみ答えてください（例: 75）\n\n"
                    f"発言:\n{combined}"
                ),
            }],
        )
        raw = msg.content[0].text.strip()
        match = re.search(r"\d+", raw)
        if match:
            return max(0.0, min(100.0, float(match.group())))
    except Exception as e:
        print(f"    [Claude] {name}: {e}")
    return 0.0


def calculate_scores(
    member: dict,
    all_members: list[dict],
    use_claude: bool,
) -> dict[str, float]:
    """各スコアを算出する。発言ゼロ議員は全スコア 0。"""
    speeches = member.get("speeches", [])
    committees = member.get("committees", set())
    speech_count = member.get("speech_count", 0)

    # 発言ゼロ → 全項目 0（「サボり」の可視化）
    if speech_count == 0:
        return {
            "activity_score": 0.0,
            "question_quality_score": 0.0,
            "legislative_score": 0.0,
            "influence_score": 0.0,
            "policy_impact_score": 0.0,
            "final_score": 0.0,
        }

    # 活動度スコア: 全体最大値で正規化
    max_speeches = max((m.get("speech_count", 0) for m in all_members), default=1)
    activity_score = round(min(100.0, (speech_count / max(max_speeches, 1)) * 100), 1)

    # 質問品質スコア
    if use_claude:
        quality_score = round(claude_quality_score(speeches, member["name"]), 1)
        time.sleep(REQUEST_INTERVAL)
    else:
        quality_score = round(heuristic_quality_score(speeches), 1)

    # 立法スコア: 委員会参加の多様性
    max_committees = max(
        (len(m.get("committees", set())) for m in all_members), default=1
    )
    legislative_score = round(
        min(100.0, (len(committees) / max(max_committees, 1)) * 100), 1
    )

    # 影響力スコア: 重要会議への参加
    high_count = len(committees & HIGH_INFLUENCE_MEETINGS)
    influence_score = round(min(100.0, high_count * 20.0 + activity_score * 0.2), 1)

    # 政策実現スコア
    policy_impact_score = round(
        quality_score * 0.35 + legislative_score * 0.40 + influence_score * 0.25, 1
    )

    # 最終スコア
    final_score = round(
        activity_score * 0.20
        + quality_score * 0.25
        + legislative_score * 0.20
        + influence_score * 0.15
        + policy_impact_score * 0.20,
        1,
    )

    return {
        "activity_score": activity_score,
        "question_quality_score": quality_score,
        "legislative_score": legislative_score,
        "influence_score": influence_score,
        "policy_impact_score": policy_impact_score,
        "final_score": final_score,
    }


# ---------------------------------------------------------------------------
# Step D: Wikipedia で年齢・性別を補完
# ---------------------------------------------------------------------------

def fetch_wikipedia(name: str) -> dict:
    try:
        resp = requests.get(
            f"{WIKIPEDIA_API}/page/summary/{requests.utils.quote(name)}",
            headers={**BOT_HEADERS, "Accept": "application/json"},
            timeout=10,
        )
        if resp.status_code != 200:
            return {}

        data = resp.json()
        description: str = data.get("description", "")
        extract: str = data.get("extract", "")
        combined = description + " " + extract

        age: int | None = None
        m = re.search(r"\((\d{4})[)年\-]", description)
        if m:
            birth_year = int(m.group(1))
            if 1930 <= birth_year <= 2000:
                age = datetime.now().year - birth_year

        gender = "Female" if re.search(r"女性|彼女", combined[:300]) else "Male"

        summary: str | None = None
        first = extract.split("。")[0]
        if first:
            summary = first[:200] + "。"

        return {"age": age, "gender": gender, "summary": summary}

    except Exception:
        return {}


# ---------------------------------------------------------------------------
# Step E: DB保存
# ---------------------------------------------------------------------------

def get_existing_ranks(db: Session) -> dict[str, int]:
    from sqlalchemy import select
    stmt = (
        select(Politician, Analysis)
        .join(Analysis, Analysis.politician_id == Politician.id)
        .order_by(Analysis.final_score.desc())
    )
    return {
        pol.name: idx
        for idx, (pol, _) in enumerate(db.execute(stmt).all(), start=1)
    }


def save_to_db(members: list[dict], db: Session) -> None:
    db.query(Analysis).delete()
    db.query(Politician).delete()
    db.commit()

    for idx, m in enumerate(members, start=1):
        scores = m["scores"]
        db.add(Politician(
            id=idx,
            name=m["name"],
            party=m["party"],
            house=m["house"],
            district=m.get("district") or "不明",
            age=m.get("age"),
            gender=m.get("gender") or "Male",
            previous_rank=m.get("previous_rank", idx),
            top_question=m.get("top_question"),
            key_achievement=None,
            summary=m.get("summary"),
            term_start=None,
        ))
        db.add(Analysis(
            politician_id=idx,
            activity_score=scores["activity_score"],
            question_quality_score=scores["question_quality_score"],
            legislative_score=scores["legislative_score"],
            influence_score=scores["influence_score"],
            policy_impact_score=scores["policy_impact_score"],
            final_score=scores["final_score"],
        ))

    db.commit()


# ---------------------------------------------------------------------------
# メイン
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="国会議員データ取込スクリプト v2")
    parser.add_argument("--mode", choices=["all", "top"], default="all",
                        help="all=全議員(デフォルト)  top=発言上位のみ(高速)")
    parser.add_argument("--days", type=int, default=90,
                        help="判定する過去日数 (デフォルト: 90)")
    parser.add_argument("--limit", type=int, default=0,
                        help="取込上限（0=無制限, テスト用に例: 30）")
    parser.add_argument("--max-records", type=int, default=2000,
                        help="topモード: APIから取得する最大発言件数")
    parser.add_argument("--dry-run", action="store_true",
                        help="DBに保存せず結果のみ表示")
    args = parser.parse_args()

    use_claude = bool(os.getenv("ANTHROPIC_API_KEY"))
    limit_str = f"先頭 {args.limit} 名" if args.limit else "無制限"
    print("=" * 60)
    print("国会議員データ取込スクリプト v2")
    print(f"  モード     : {'全議員' if args.mode == 'all' else '発言上位'}")
    print(f"  期間       : 過去 {args.days} 日")
    print(f"  上限       : {limit_str}")
    print(f"  品質スコア : {'Claude API' if use_claude else 'ヒューリスティック'}")
    print(f"  実行モード : {'DRY RUN' if args.dry_run else '本番実行'}")
    print("=" * 60)

    until = datetime.now()
    since = until - timedelta(days=args.days)
    from_date = since.strftime("%Y-%m-%d")
    until_date = until.strftime("%Y-%m-%d")

    # ------------------------------------------------------------------
    if args.mode == "all":
        # ★ 全議員モード: 公式サイト → 個別API検索
        print(f"\n[Step 1/5] 衆参公式サイトから全議員リストを取得")
        members = fetch_all_members()
        if not members:
            print("エラー: 議員リストが取得できませんでした。")
            sys.exit(1)

        if args.limit:
            members = members[:args.limit]
            print(f"  (--limit {args.limit} により先頭 {len(members)} 名に絞込)")

        print(f"\n[Step 2/5] 各議員の発言を個別検索（{len(members)} 名 × API）")
        print(f"  ※ 約 {len(members) * REQUEST_INTERVAL / 60:.1f} 分かかります")

        active = inactive = 0
        for i, m in enumerate(members, start=1):
            count, speeches, committees = fetch_member_speeches(
                m["name"], from_date, until_date
            )
            m["speech_count"] = count
            m["speeches"] = speeches
            m["committees"] = committees

            flag = "[OK]" if count > 0 else "[--]"
            print(f"  [{i:>3}/{len(members)}] {flag} {m['name']:<10} 発言:{count:>3}件")

            if count > 0:
                active += 1
            else:
                inactive += 1
            time.sleep(REQUEST_INTERVAL)

        print(f"\n  発言あり: {active} 名  ／  発言ゼロ（要注意）: {inactive} 名")

    else:
        # topモード: 全発言取得 → 上位抽出（旧ロジック）
        print(f"\n[Step 1/5] 国会会議録APIから発言データを一括取得")
        from scripts.ingest_top import fetch_speeches, aggregate_by_politician
        speeches_all = fetch_speeches(from_date, until_date, args.max_records)
        aggregated = aggregate_by_politician(speeches_all)
        ranked = sorted(aggregated.values(), key=lambda p: p["speech_count"], reverse=True)
        limit = args.limit or 30
        members = ranked[:limit]
        print(f"  上位 {len(members)} 名を選択")

    # ------------------------------------------------------------------
    print(f"\n[Step 3/5] スコアを計算")
    for i, m in enumerate(members, start=1):
        scores = calculate_scores(m, members, use_claude)
        m["scores"] = scores
        label = f"最終:{scores['final_score']:>5}"
        active_flag = "" if m.get("speech_count", 0) > 0 else " ← 発言ゼロ"
        print(f"  [{i:>3}/{len(members)}] {m['name']:<10} {label}{active_flag}")

    # ------------------------------------------------------------------
    print(f"\n[Step 4/5] WikipediaAPIで補完情報を取得")
    for i, m in enumerate(members, start=1):
        wiki = fetch_wikipedia(m["name"])
        # 公式サイトで取れなかった項目だけ上書き
        if wiki.get("age") and not m.get("age"):
            m["age"] = wiki["age"]
        if wiki.get("gender"):
            m["gender"] = wiki["gender"]
        if wiki.get("summary") and not m.get("summary"):
            m["summary"] = wiki["summary"]

        # 代表質問
        speeches = m.get("speeches", [])
        questions = [s for s in speeches if "か。" in s or "でしょうか" in s]
        best = sorted(questions or speeches, key=len, reverse=True)
        m["top_question"] = (best[0][:100] + "…") if best else None

        print(f"  [{i:>3}/{len(members)}] {m['name']:<10} 年齢:{m.get('age','不明')}")
        time.sleep(REQUEST_INTERVAL)

    # ------------------------------------------------------------------
    print(f"\n[Step 5/5] DBに保存")
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()
    try:
        existing_ranks = get_existing_ranks(db)
        for idx, m in enumerate(members, start=1):
            m["previous_rank"] = existing_ranks.get(m["name"], idx)

        if args.dry_run:
            # ランキング順（final_score降順）で表示
            sorted_members = sorted(members, key=lambda m: m["scores"]["final_score"], reverse=True)
            print("\n[DRY RUN] 保存予定データ（スコア順）:\n")
            print(f"  {'順位':<4} {'氏名':<10} {'政党':<12} {'発言':>4}  {'最終スコア':>8}  備考")
            print("  " + "-" * 60)
            for rank, m in enumerate(sorted_members, start=1):
                s = m["scores"]
                note = "★発言ゼロ" if m.get("speech_count", 0) == 0 else ""
                print(
                    f"  #{rank:<3} {m['name']:<10} {m['party']:<12} "
                    f"{m.get('speech_count',0):>4}件  "
                    f"{s['final_score']:>8.1f}  {note}"
                )
        else:
            save_to_db(members, db)
            zero_count = sum(1 for m in members if m.get("speech_count", 0) == 0)
            print(f"  ✓ {len(members)} 名を保存（うち発言ゼロ: {zero_count} 名）")
    finally:
        db.close()

    print("\n完了。\n")


if __name__ == "__main__":
    main()
