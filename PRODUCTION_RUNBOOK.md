# 本番投入・設定 ランブック（フェーズ1〜3）

> 認証情報（DB接続文字列・トークン）を含むため、**すべてご自身のターミナル/ブラウザで実行**してください。
> 作成: 2026-06-04 / 対象コミット: `b13dd64`（main にデプロイ済み）

---

## A. Render ダッシュボード設定（ブラウザ・1回のみ）

`render.yaml` の環境変数追加は Render が自動取り込みしないため、手動で設定します。

1. Render → サービス **`political-analyst-api`** → **Settings → Environment**
2. 次を追加/更新して保存（保存で自動再デプロイ）:
   - `APP_ENV` = `production` … 本番で `/docs` `/openapi.json` を無効化（攻撃面の事前開示を停止）
   - `ALLOWED_ORIGINS` = `https://political-analyst-s7s6.vercel.app` … 実フロントに更新
3. 確認: 再デプロイ後、`https://political-analyst-api.onrender.com/docs` が **404** になればOK。

---

## B. GitHub Secrets 設定（ブラウザ・1回のみ）

定期実行ワークフロー（`.github/workflows/scheduled-ingest.yml`）を動かすために必要。

1. GitHub リポジトリ → **Settings → Secrets and variables → Actions → New repository secret**
2. 追加:
   - `ADMIN_TOKEN` = Render の同名環境変数の値（Render ダッシュボードで確認）
   - `API_BASE_URL` = `https://political-analyst-api.onrender.com`（任意・未設定でも既定値で動く）
3. 確認: Actions タブ → 「Scheduled Ingest & Snapshot」→ **Run workflow**（手動実行）で成功すればOK。

---

## C. 法案・役職データの本番投入（自分のターミナル）

スコアが実データで動くための最重要ステップ。**接続文字列は自分の環境変数にのみ置く。**

```powershell
cd C:\Users\Yu\Desktop\development\political-analyst\backend

# 本番 DB（Supabase）の接続文字列を環境変数にセット（Render の DATABASE_URL と同じ値）
$env:DATABASE_URL="postgresql://...（Render/Supabase からコピー）"

# ── 衆院法案 ──（まず DRY RUN で件数確認 → 問題なければ本実行）
python scripts/ingest_shugiin_bills.py --since-kaiji 213 --dry-run
python scripts/ingest_shugiin_bills.py --since-kaiji 213

# ── 参院法案（参法のみ）──
python scripts/ingest_sangiin_bills.py --since-kaiji 213 --dry-run
python scripts/ingest_sangiin_bills.py --since-kaiji 213

# ── 役職（衆委員会を自動巡回。参委員会はURL個別指定）──
python scripts/ingest_roles.py --dry-run
python scripts/ingest_roles.py
#   参委員会も入れる場合（例）:
#   python scripts/ingest_roles.py --sangiin-url "https://www.sangiin.go.jp/japanese/joho1/kousei/konkokkai/current/list/l0063.htm"
```

**本実行の出力で確認すること**:
- `bills_inserted` / `sponsor_links` が想定どおり増える
- `unmatched_sponsors`（氏名が156名と突合できなかった数）が極端に多くないか
  → 多い場合は氏名表記の揺れ。`--dry-run` の例と本番 `politicians.name_ja` を見比べて報告ください。

---

## D. スコア再計算（実データを最終スコアへ反映）

> **重要**: `recompute_snapshot` は同一 `(period_start, period_end)` の既存スナップショットを
> スキップ（冪等）します。新データを反映するには **これまで使っていない新しい期間** を指定してください。
> 法案/役職は年単位のデータなので、期間は広め（例: 2024-01-01〜当日）にします。

ADMIN_TOKEN を使って管理APIを叩く（自分のターミナル）:

```powershell
$token = "（ADMIN_TOKEN の値）"
$body  = '{"period_start":"2024-01-01","period_end":"2026-06-04"}'
curl.exe -s -X POST "https://political-analyst-api.onrender.com/admin/snapshot/trigger" `
  -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d $body
```

> Render 無料枠はコールドスタートがあるため、初回は時間がかかることがあります。

---

## E. 反映確認

```powershell
# 立法・影響力が 0 でない議員が出てきたか（実データが効いた証拠）
curl.exe -s "https://political-analyst-api.onrender.com/v1/ranking" | python -c "import sys,json; d=json.load(sys.stdin); print('legislative>0:', sum(1 for p in d if p.get('legislative_score',0)>0)); print('influence>0:', sum(1 for p in d if p.get('influence_score',0)>0)); print('crossparty反映はpolicy_impactで確認')"
```

- ブラウザ: https://political-analyst-s7s6.vercel.app の議員詳細で、立法実績・影響力のバーが
  0 でなくなり、暫定バナーの「未収集」軸が減っていれば成功。

---

## メモ
- 出席率（個人別出欠）は機械可読データが存在しないため未実装（"委員会出席イベント＋発言活動量"で代替する方針）。
- 出典表記「スマートニュース メディア研究所」（MIT）を UI のどこかに明記すること（法案データの利用条件）。
- 残コード作業: フェーズ3続き（役職重みの出典明記・influence新人補正・LLMプロバイダ抽象化・gold set）、フェーズ4（SEO/OGP/ISR・a11y・フロントテスト）。
