"""
国会会議録検索システム API クライアント
https://kokkai.ndl.go.jp/api.html
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from datetime import date
from typing import Iterator

import requests

from app.ingest.filters import is_person_name, is_procedural_speech
from app.ingest.hashing import speech_hash

log = logging.getLogger(__name__)

NDL_BASE = "https://kokkai.ndl.go.jp/api"
_PAGE_SIZE = 100

# 議員以外のスピーカーロールを除外
_SKIP_ROLES = {
    "政府参考人", "参考人", "公述人", "証人",
    "内閣総理大臣", "国務大臣",  # 大臣は is_minister フラグで判定
}

# 発言が質問か判断する会議名キーワード
_QUESTION_KEYWORDS = ("質疑", "質問", "一般質問", "代表質問", "緊急質問")


@dataclass
class SpeechRecord:
    speech_id: str
    date_str: str          # YYYY-MM-DD
    speaker: str
    speaker_group: str     # 会派/政党名
    name_of_house: str     # 衆議院 | 参議院
    name_of_meeting: str
    speaker_role: str
    speech_text: str
    url: str
    is_minister: bool
    is_procedural: bool = False  # 議事進行の定型アナウンスか

    @property
    def activity_type(self) -> str:
        # 進行アナウンスは活動量・品質母数に数えない committee_action に分類
        if self.is_procedural:
            return "committee_action"
        if any(kw in self.name_of_meeting for kw in _QUESTION_KEYWORDS):
            return "question"
        return "speech"

    @property
    def source_hash(self) -> str:
        return speech_hash(self.speech_id)

    @property
    def session_date(self) -> date:
        return date.fromisoformat(self.date_str)


def _parse_record(raw: dict) -> SpeechRecord | None:
    speaker = (raw.get("speaker") or "").strip()
    # 非人名（『会議録情報』や委員会名など）を弾き、ゴミ議員レコードを防ぐ
    if not is_person_name(speaker):
        return None
    role = (raw.get("speakerRole") or "").strip()
    # 議員以外を除外（大臣は is_minister フラグがあるので残す）
    if any(skip in role for skip in _SKIP_ROLES) and not raw.get("isMinister"):
        return None
    text = (raw.get("speech") or "")
    # NDL は発言URLを speechURL で返す（旧 'url' フィールドは存在せず常に空だった）
    url = (raw.get("speechURL") or raw.get("meetingURL") or "").strip()
    return SpeechRecord(
        speech_id=raw.get("speechID", ""),
        date_str=raw.get("date", ""),
        speaker=speaker,
        speaker_group=(raw.get("speakerGroup") or "").strip(),
        name_of_house=(raw.get("nameOfHouse") or "").strip(),
        name_of_meeting=(raw.get("nameOfMeeting") or "").strip(),
        speaker_role=role,
        speech_text=text[:3000],
        url=url,
        is_minister=bool(raw.get("isMinister")),
        is_procedural=is_procedural_speech(text),
    )


class NdlClient:
    def __init__(self, rate_sleep: float = 0.6):
        self._sleep = rate_sleep
        self._session = requests.Session()
        self._session.headers["Accept"] = "application/json"
        # 取得が途中で打ち切られた（API障害等）場合に True。呼び出し側が partial 判定に使う。
        self.incomplete = False

    def iter_speeches(
        self,
        from_date: date,
        until_date: date,
        name_of_house: str | None = None,
        limit: int = 1000,
    ) -> Iterator[SpeechRecord]:
        """指定期間・院の発言レコードをページング取得する（nextRecordPosition 駆動）。"""
        start = 1
        fetched = 0
        while fetched < limit:
            params: dict = {
                "from": from_date.isoformat(),
                "until": until_date.isoformat(),
                "recordPacking": "json",
                "maximumRecords": min(_PAGE_SIZE, limit - fetched),
                "startRecord": start,
            }
            if name_of_house:
                params["nameOfHouse"] = name_of_house

            time.sleep(self._sleep)
            try:
                resp = self._session.get(f"{NDL_BASE}/speech", params=params, timeout=30)
                resp.raise_for_status()
                data = resp.json()
            except Exception as exc:
                log.error("NDL API error: %s", exc)
                # 取りこぼしを success と誤記録しないよう不完全フラグを立てて中断
                self.incomplete = True
                break

            records = data.get("speechRecord") or []
            for raw in records:
                rec = _parse_record(raw)
                if rec:
                    fetched += 1
                    yield rec
                    if fetched >= limit:
                        break

            # NDL 公式推奨の nextRecordPosition でページング（無ければ終端）
            next_pos = data.get("nextRecordPosition")
            if not next_pos:
                break
            start = int(next_pos)
