#!/usr/bin/env python3
"""
国会議員データ取込スクリプト v3 — 新スキーマ対応

データソース:
  1. 衆議院 / 参議院 公式サイト    — 全議員リスト
  2. 国会会議録検索システム API    — 各議員の発言データ
  3. Wikipedia 日本語版 API       — 年齢・性別の補完

使い方:
  cd backend
  python -m scripts.ingest                   # 全議員（デフォルト）
  python -m scripts.ingest --days 180        # 過去半年
  python -m scripts.ingest --limit 30        # 先頭30名（テスト用）
  python -m scripts.ingest --dry-run         # 保存せずプレビュー
  python -m scripts.ingest --rescore-only    # 取込スキップ、スコア再計算のみ
"""

from __future__ import annotations

import argparse
import hashlib
import os
import re
import sys
import time
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Optional

import requests
from bs4 import BeautifulSoup
from sqlalchemy.orm import Session

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import SessionLocal, engine
from app.ingest.filters import is_procedural_speech
from app.ingest.hashing import speech_hash
from app.models import (
    Activity,
    Base,
    IngestionRun,
    LlmEvaluation,
    Party,
    Politician,
)
from app.scoring.llm_worker import process_pending_evaluations
from app.scoring.prompts import PROMPT_VERSION

# ─────────────────────────────────────────────
# 定数
# ─────────────────────────────────────────────

KOKKAI_API = "https://kokkai.ndl.go.jp/api"
WIKIPEDIA_API = "https://ja.wikipedia.org/api/rest_v1"
SHUGIIN_URL = "https://www.shugiin.go.jp/internet/itdb_annai.nsf/html/statics/syu/1giin.htm"

BOT_HEADERS = {"User-Agent": "PoliticalAnalystBot/1.0 (research-tool; non-commercial)"}
REQUEST_INTERVAL = 0.6

# 与党政党（role_profile='ruling' を付与）
RULING_PARTIES: frozenset[str] = frozenset(["自由民主党", "公明党"])

# 政党名正規化
PARTY_MAP: dict[str, str] = {
    "自民": "自由民主党", "公明": "公明党", "立憲": "立憲民主党",
    "維新": "日本維新の会", "共産": "日本共産党", "国民": "国民民主党",
    "れいわ": "れいわ新選組", "社民": "社会民主党", "参政": "参政党",
    "保守": "日本保守党", "有志": "有志の会",
    "自由民主党・無所属の会": "自由民主党",
    "自由民主党・国民の声": "自由民主党",
    "立憲民主党・社民・無所属": "立憲民主党",
    "立憲民主党・無所属": "立憲民主党",
    "日本維新の会・教育無償化を実現する会": "日本維新の会",
    "国民民主党・無所属クラブ": "国民民主党",
    "社会民主党・無所属": "社会民主党",
}

LLM_MODEL = os.getenv("LLM_MODEL", "gpt-4o-mini")


# ─────────────────────────────────────────────
# ユーティリティ
# ─────────────────────────────────────────────

def normalize_party(raw: str) -> str:
    raw = raw.strip()
    for key, value in PARTY_MAP.items():
        if raw == key or raw.startswith(key):
            return value
    return raw or "無所属"


def assign_role_profile(party_name: str) -> str:
    if party_name in RULING_PARTIES:
        return "ruling"
    return "opposition"


def make_hash(*parts: str) -> str:
    return hashlib.sha256("|".join(parts).encode()).hexdigest()[:64]


# ─────────────────────────────────────────────
# Step A: 公式サイトから全議員リスト取得
# ─────────────────────────────────────────────

def _parse_table_rows(soup: BeautifulSoup, min_cols: int) -> list[list[str]]:
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
    print("  衆議院議員リストを取得中 ...")
    try:
        resp = requests.get(SHUGIIN_URL, headers=BOT_HEADERS, timeout=30)
        resp.raise_for_status()
        resp.encoding = resp.apparent_encoding
        soup = BeautifulSoup(resp.text, "html.parser")
    except Exception as e:
        print(f"  [警告] 衆議院サイト取得失敗: {e}")
        return []

    HEADER_PATTERNS = {"氏名", "姓名", "ふりがな", "会派", "選挙区", "当選回数"}
    members: list[dict] = []
    for cells in _parse_table_rows(soup, min_cols=5):
        name = re.sub(r"[\s　君@]", "", cells[0])
        party_raw = cells[2].strip()
        district = cells[3].strip()
        if not name or name in HEADER_PATTERNS or name.startswith("氏名"):
            continue
        if not party_raw or party_raw in HEADER_PATTERNS:
            continue
        party = normalize_party(party_raw)
        members.append({
            "name": name, "party": party, "house": "representatives",
            "district": district, "gender": None, "age": None,
        })
    print(f"  → 衆議院: {len(members)} 名")
    return members


def _get_sangiin_url() -> str:
    base = "https://www.sangiin.go.jp"
    current = f"{base}/japanese/joho1/kousei/giin/current/giin.htm"
    resp = requests.get(current, headers=BOT_HEADERS, allow_redirects=True, timeout=15)
    if resp.url != current:
        return resp.url
    soup = BeautifulSoup(resp.text, "html.parser")
    link = soup.find("a", href=True)
    if link:
        href = str(link["href"])
        return href if href.startswith("http") else base + href
    return f"{base}/japanese/joho1/kousei/giin/221/giin.htm"


def fetch_sangiin_members() -> list[dict]:
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

    NAV_PATTERNS = {"あ行", "か行", "さ行", "た行", "な行", "は行", "ま行", "や行", "ら行", "わ行"}
    SANGIIN_HEADERS = {"議員氏名", "よみがな", "会派名等", "選挙区", "任期満了日"}
    members: list[dict] = []
    for cells in _parse_table_rows(soup, min_cols=3):
        name = re.sub(r"[\s　]", "", cells[0])
        party_raw = cells[2].strip() if len(cells) > 2 else ""
        district = cells[3].strip() if len(cells) > 3 else ""
        if not name or name in NAV_PATTERNS or name in SANGIIN_HEADERS:
            continue
        if not party_raw or party_raw in NAV_PATTERNS or party_raw in SANGIIN_HEADERS:
            continue
        party = normalize_party(party_raw)
        members.append({
            "name": name, "party": party, "house": "councillors",
            "district": district, "gender": None, "age": None,
        })
    print(f"  → 参議院: {len(members)} 名")
    return members


def fetch_all_members() -> list[dict]:
    shugiin = fetch_shugiin_members()
    time.sleep(REQUEST_INTERVAL)
    sangiin = fetch_sangiin_members()
    seen: set[str] = set()
    merged: list[dict] = []
    for m in shugiin + sangiin:
        if m["name"] not in seen:
            seen.add(m["name"])
            merged.append(m)
    print(f"  合計: {len(merged)} 名（重複除去済み）")
    return merged


# ─────────────────────────────────────────────
# Step B: 発言データ取得
# ─────────────────────────────────────────────

def fetch_member_speeches(
    name: str, from_date: str, until_date: str
) -> list[dict]:
    """
    議員の発言を取得し、[(session_date, speech_text, meeting_name)] のリストで返す。
    """
    speeches: list[dict] = []
    start = 1

    while True:
        params = {
            "speaker": name, "from": from_date, "until": until_date,
            "maximumRecords": 100, "startRecord": start, "recordPacking": "json",
        }
        try:
            resp = requests.get(
                f"{KOKKAI_API}/speech", params=params, headers=BOT_HEADERS, timeout=20
            )
            resp.raise_for_status()
            data = resp.json()
        except Exception:
            break

        for rec in data.get("speechRecord", []):
            text = (rec.get("speech") or "").strip()
            meeting = (rec.get("nameOfMeeting") or "").strip()
            date_str = (rec.get("date") or "").strip()
            if not text:
                continue
            try:
                session_date = datetime.strptime(date_str, "%Y-%m-%d").date()
            except ValueError:
                session_date = date.today()

            speech_id = (rec.get("speechID") or "").strip()
            speech_url = (rec.get("speechURL") or rec.get("meetingURL") or "").strip()

            # 議事進行の定型アナウンスは活動量・品質母数に数えない committee_action へ
            if is_procedural_speech(text):
                activity_type = "committee_action"
            else:
                is_question = bool(
                    re.search(r"(か。|でしょうか|ますか|ですか)", text)
                    and "大臣" not in name and "長官" not in name
                )
                activity_type = "question" if is_question else "speech"

            speeches.append({
                "text": text, "meeting": meeting,
                "session_date": session_date,
                "activity_type": activity_type,
                "speech_id": speech_id,
                "speech_url": speech_url,
            })

        next_pos = data.get("nextRecordPosition")
        if next_pos is None:
            break
        start = next_pos
        time.sleep(REQUEST_INTERVAL)

    return speeches


# ─────────────────────────────────────────────
# Step C: Wikipedia 補完
# ─────────────────────────────────────────────

def fetch_wikipedia(name: str) -> dict:
    try:
        resp = requests.get(
            f"{WIKIPEDIA_API}/page/summary/{requests.utils.quote(name)}",
            headers={**BOT_HEADERS, "Accept": "application/json"}, timeout=10,
        )
        if resp.status_code != 200:
            return {}
        data = resp.json()
        extract: str = data.get("extract", "")
        description: str = data.get("description", "")
        combined = description + " " + extract

        age: Optional[int] = None
        m = re.search(r"\((\d{4})[)年\-]", description)
        if m:
            birth_year = int(m.group(1))
            if 1930 <= birth_year <= 2005:
                age = datetime.now().year - birth_year

        gender = "Female" if re.search(r"女性|彼女", combined[:300]) else "Male"

        summary: Optional[str] = None
        first = extract.split("。")[0]
        if first:
            summary = first[:200] + "。"

        return {"age": age, "gender": gender, "summary": summary}
    except Exception:
        return {}


# ─────────────────────────────────────────────
# Step D: DB 保存（新スキーマ）
# ─────────────────────────────────────────────

def _upsert_party(db: Session, party_name: str) -> Party:
    """Party を名前で upsert し、Party オブジェクトを返す。"""
    party = db.query(Party).filter(Party.name_ja == party_name).first()
    if not party:
        party = Party(name_ja=party_name)
        db.add(party)
        db.flush()
    return party


def _upsert_politician(db: Session, member: dict, party: Party) -> Politician:
    """Politician を name_ja で upsert し、Politician オブジェクトを返す。"""
    pol = db.query(Politician).filter(Politician.name_ja == member["name"]).first()
    role_profile = assign_role_profile(member["party"])

    if pol is None:
        pol = Politician(
            name_ja=member["name"],
            party_id=party.id,
            house=member["house"],
            electoral_district=member.get("district"),
            role_profile=role_profile,
            gender=member.get("gender"),
            age=member.get("age"),
            is_active=True,
            summary=member.get("summary"),
        )
        db.add(pol)
    else:
        pol.party_id = party.id
        pol.house = member["house"]
        pol.electoral_district = member.get("district") or pol.electoral_district
        pol.role_profile = role_profile
        if member.get("gender"):
            pol.gender = member["gender"]
        if member.get("age"):
            pol.age = member["age"]
        if member.get("summary") and not pol.summary:
            pol.summary = member["summary"]
        pol.is_active = True

    db.flush()
    return pol


def _upsert_activities(
    db: Session,
    politician: Politician,
    speeches: list[dict],
    ingest_run: IngestionRun,
) -> tuple[int, int]:
    """
    発言データを Activity として upsert し、
    新規の question/speech には LlmEvaluation(queued) を登録する。
    Returns: (inserted, skipped)
    """
    inserted = skipped = 0

    for s in speeches:
        # source_hash は speechID 基準に統一（pipeline 経路と一致させ二重登録を防ぐ）
        speech_id = s.get("speech_id") or ""
        if speech_id:
            source_hash = speech_hash(speech_id)
        else:
            source_hash = make_hash(
                str(politician.id), str(s["session_date"]), s["text"][:200]
            )

        existing = db.query(Activity).filter(Activity.source_hash == source_hash).first()
        if existing:
            skipped += 1
            continue

        act = Activity(
            politician_id=politician.id,
            ingestion_run_id=ingest_run.id,
            activity_type=s["activity_type"],
            session_date=s["session_date"],
            source_url=s.get("speech_url") or "https://kokkai.ndl.go.jp/",
            source_hash=source_hash,
            content_text=s["text"][:4000],
        )
        db.add(act)
        db.flush()

        # question / speech は LLM 評価キューに登録
        if s["activity_type"] in ("question", "speech") and len(s["text"]) > 30:
            eval_row = LlmEvaluation(
                activity_id=act.id,
                model_name=LLM_MODEL,
                prompt_version=PROMPT_VERSION,
                status="queued",
            )
            db.add(eval_row)

        inserted += 1

    return inserted, skipped


# ─────────────────────────────────────────────
# メイン
# ─────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="国会議員データ取込スクリプト v3")
    parser.add_argument("--days", type=int, default=90, help="過去日数（デフォルト: 90）")
    parser.add_argument("--limit", type=int, default=0, help="取込上限（0=無制限）")
    parser.add_argument("--dry-run", action="store_true", help="DBに保存せずプレビュー")
    parser.add_argument("--rescore-only", action="store_true", help="取込スキップ、スコア再計算のみ")
    parser.add_argument("--skip-llm", action="store_true", help="LLM評価ステップをスキップ")
    parser.add_argument("--skip-snapshot", action="store_true", help="スコア再計算をスキップ")
    args = parser.parse_args()

    use_llm = bool(os.getenv("OPENAI_API_KEY")) and not args.skip_llm

    until_dt = datetime.now()
    since_dt = until_dt - timedelta(days=args.days)
    from_date = since_dt.strftime("%Y-%m-%d")
    until_date = until_dt.strftime("%Y-%m-%d")
    period_start = since_dt.date()
    period_end = until_dt.date()

    print("=" * 60)
    print("国会議員データ取込スクリプト v3")
    print(f"  期間: {from_date} 〜 {until_date}")
    print(f"  LLM評価: {'有効 (' + LLM_MODEL + ')' if use_llm else '無効'}")
    print(f"  実行モード: {'DRY RUN' if args.dry_run else '本番'}")
    print("=" * 60)

    Base.metadata.create_all(bind=engine)

    if args.rescore_only:
        _run_rescore(period_start, period_end)
        return

    # Step 1: 議員リスト取得
    print("\n[1/5] 衆参公式サイトから全議員リストを取得")
    members = fetch_all_members()
    if not members:
        print("エラー: 議員リストが取得できませんでした")
        sys.exit(1)
    if args.limit:
        members = members[:args.limit]
        print(f"  (--limit {args.limit} で絞込)")

    # Step 2: 発言データ取得
    print(f"\n[2/5] 各議員の発言を取得（{len(members)} 名）")
    for i, m in enumerate(members, start=1):
        speeches = fetch_member_speeches(m["name"], from_date, until_date)
        m["speeches"] = speeches
        flag = "[OK]" if speeches else "[--]"
        print(f"  [{i:>3}/{len(members)}] {flag} {m['name']:<10} 発言:{len(speeches):>3}件")
        time.sleep(REQUEST_INTERVAL)

    # Step 3: Wikipedia 補完
    print("\n[3/5] Wikipedia で補完情報を取得")
    for i, m in enumerate(members, start=1):
        wiki = fetch_wikipedia(m["name"])
        if wiki.get("age") and not m.get("age"):
            m["age"] = wiki["age"]
        if wiki.get("gender"):
            m["gender"] = wiki["gender"]
        if wiki.get("summary") and not m.get("summary"):
            m["summary"] = wiki["summary"]

        speeches = m.get("speeches", [])
        questions = [s for s in speeches if s["activity_type"] == "question"]
        best = sorted(questions or speeches, key=lambda s: len(s["text"]), reverse=True)
        m["top_question"] = (best[0]["text"][:100] + "…") if best else None

        print(f"  [{i:>3}/{len(members)}] {m['name']:<10} 年齢:{m.get('age', '不明')}")
        time.sleep(REQUEST_INTERVAL)

    if args.dry_run:
        print("\n[DRY RUN] 保存はスキップ")
        for m in sorted(members, key=lambda x: len(x.get("speeches", [])), reverse=True):
            print(f"  {m['name']:<10} {m['party']:<12} {m['house']:<16} 発言:{len(m.get('speeches', [])):>3}件")
        return

    # Step 4: DB 保存
    print("\n[4/5] DBに保存")
    total_inserted = total_skipped = 0

    with SessionLocal() as db:
        run = IngestionRun(
            source_name="kokkai_ndl",
            started_at=datetime.utcnow(),
            status="running",
        )
        db.add(run)
        db.flush()

        try:
            for m in members:
                party = _upsert_party(db, m["party"])
                pol = _upsert_politician(db, m, party)
                if m.get("top_question"):
                    pol.top_question = m["top_question"]

                inserted, skipped = _upsert_activities(
                    db, pol, m.get("speeches", []), run
                )
                total_inserted += inserted
                total_skipped += skipped
                print(f"  {m['name']:<10} +{inserted} 件（重複スキップ: {skipped}）")

            run.finished_at = datetime.utcnow()
            run.status = "success"
            run.records_seen = sum(len(m.get("speeches", [])) for m in members)
            run.records_inserted = total_inserted
            run.records_updated = 0
            run.records_failed = 0
            db.commit()
            print(f"\n  保存完了: {total_inserted} 件挿入, {total_skipped} 件スキップ")
        except Exception as e:
            db.rollback()
            run.finished_at = datetime.utcnow()
            run.status = "failure"
            run.error_summary = str(e)[:500]
            db.commit()
            print(f"  [エラー] DB保存失敗: {e}")
            raise

    # Step 5: LLM評価
    if use_llm:
        print("\n[5/5] LLM品質評価を実行（queued件数を処理）")
        with SessionLocal() as db:
            processed = process_pending_evaluations(db, batch_size=100)
        print(f"  処理完了: {processed} 件")
    else:
        print("\n[5/5] LLM評価スキップ（OPENAI_API_KEY 未設定 or --skip-llm）")

    # Step 6: スコア再計算
    if not args.skip_snapshot:
        _run_rescore(period_start, period_end)

    print("\n完了。\n")


def _run_rescore(period_start: date, period_end: date) -> None:
    print(f"\n[スコア再計算] period {period_start} 〜 {period_end}")
    from app.scoring.snapshot import recompute_snapshot
    with SessionLocal() as db:
        written = recompute_snapshot(db, period_start=period_start, period_end=period_end)
    print(f"  {written} 件のスコアスナップショットを書き込み")


if __name__ == "__main__":
    main()
