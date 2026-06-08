# political-analyst 残タスク・改善案バックログ（2026-06-05 作成）

> 次回セッションでの指示出しに使う作業バックログ。各項目は「概要 / 対象ファイル /
> 工数・リスク / 手順 / 保留理由」を備える。運用リファレンス（§5）も参照。

---

## 0. 使い方

- 着手したい項目の見出しを指定すれば、その手順に沿って実装→検証→デプロイまで進められる。
- バックエンドのスコア反映には **スコア再計算（未使用 period 必須）** が要る項目がある（§5参照）。
- デプロイは `git push origin HEAD:main`（フロント=Vercel自動 / API=Render）。

---

## 1. 現在の到達点（完了済み・参考）

本番投入と是正は一通り完了している（2026-06-05 時点）:

- 会議録・法案・役職を本番DB投入済み。スコア（立法・影響力含む）反映済み。
- 現職 **718名**（house 衆470 / 参248、実議席と整合）、influence>0 **626**、legislative>0 **286**。
- 完了済みの主な是正・機能:
  - 法案 sponsor 複合PK重複バグ修正（`124bc20`）
  - データ出典フッター（MIT表記義務、`1497956`）
  - 参院委員会の役職 自動巡回（`0586f71`）
  - house 逆転是正（衆名簿の全ページ巡回、`b1acbc4`）
  - 過去議員の is_active 無効化＋`--roster-only`モード（`b271499`）
  - 役職重み（会長5.0/幹事2.0）＋snapshot指標メモ化（`cb35dbf`）
  - SEO/OGP・議員ページISR・a11y改善（`cbd7e62`）
  - フロントのテスト基盤(vitest+RTL+jest-axe, 37テスト)＋a11y仕上げ＋CIテストstep（2026-06-08・2-3/2-4 完了・未コミット）
- **influence 正規化は「絶対値維持」で方針決定済み**（相対化はしない。理由は §4-A）。

---

## 2. 残タスク（優先度順）

### 2-1. フロント: home/compare の ISR 化〔フロント / 中 / 中リスク〕

- **概要**: `app/page.tsx` と `app/compare/page.tsx` は現在 `export const dynamic = 'force-dynamic'`。
  毎リクエストで Render API を叩くため遅い。ISR（`export const revalidate = N`）にすると高速・SEO有利。
- **対象**: `app/page.tsx`, `app/compare/page.tsx`, `lib/api-client.ts`
- **保留理由**: force-dynamic を外すと **ビルド時に Next がページを prerender → Render（無料枠コールドスタート
  34〜104秒）へアクセス**し、Vercel ビルドが不安定化/失敗するリスク。
- **やるなら**: ビルド時 fetch を回避する設計が前提。案:
  - (a) `generateStaticParams` 不要だが、ビルド時に API が落ちていても固定フォールバックを返すよう
    `fetchRanking` にビルド時専用の空配列フォールバック＋ `revalidate` で初回オンデマンド生成。
  - (b) もしくは Route Segment Config で `dynamic = 'force-static'` を避け、`revalidate` のみ設定し、
    ビルドログで API 到達性を確認してからマージ。
  - 議員詳細ページ（`app/politicians/[id]/page.tsx`）は動的セグメントで既に ISR(revalidate=300) 化済み・安全。

### 2-2. フロント: recharts の dynamic import 〔フロント / 小〜中 / 中リスク〕

- **概要**: `RadarChart` / `ScoreHistoryChart` が全ページで無条件読込（recharts ~45KB gzip）。
  `next/dynamic` で遅延読込し初期 JS バンドルを削減。
- **対象**: `components/RadarChart.tsx`, `components/ScoreHistoryChart.tsx`（呼び出し側 or 自身でラップ）
- **リスク**: SSR との hydration mismatch。`dynamic(() => import(...), { ssr: false, loading: ... })` で回避。
  議員詳細は SSR ページのため component 単位の dynamic import が必要（page 単位は不可）。
- **やるなら**: チャートを別ファイル化して `dynamic({ ssr:false })` で包み、loading スケルトンを出す。

### 2-3. ✅ フロント: テスト基盤の導入（2026-06-08 完了・未コミット）〔フロント / 中 / 低リスク〕

> **完了済み**: vitest + @testing-library/{react,jest-dom,user-event,dom} + jsdom + jest-axe を devDeps 導入。
> 設定: `vitest.config.ts`（`@/`エイリアス再現）/ `tests/setup.ts`（ResizeObserver・next/link モック）/ `tests/vitest.d.ts`（jest-axe型拡張）/ `tests/fixtures.ts`。
> テスト 37件（`tests/lib/api.test.ts` の pure 関数15件 ＋ コンポーネント22件: RankingCard/FilterBar/ScoreHistoryChart/ScoreWeightsCard/ScoreAxisLegend）。
> `package.json` に test/test:run/test:watch、CI(`ci.yml`) frontend に `Test (vitest)` step 追加。
> **Playwright(E2E) は未導入**（CI にブラウザ DL＋dev サーバ起動が必要で重く、キーボード操作は jsdom+user-event で代替）。E2E が要るなら別途。
> 検証: vitest 37緑 / `tsc --noEmit` / `next build` とも通過。adversarial review（7指摘・全 low）も反映済み。

- **概要**: フロントにテストゼロ。vitest（ユニット/コンポーネント）＋ Playwright（E2E/キーボード操作）最小導入。
- **対象**: `package.json`（devDeps: vitest, @testing-library/react, jsdom, @playwright/test）, `vitest.config.ts`,
  `tests/` 新設。CI（`.github/workflows/ci.yml`）に `test:unit` 追加。
- **最小スコープ**: FilterBar（ラベル/絞り込み）、RankingCard、ScoreHistoryChart の描画、a11y は `@axe-core` 連携。

### 2-4. ✅ フロント: 低Tier a11y の仕上げ（2026-06-08 完了・未コミット）〔フロント / 小 / 低リスク〕

> **完了済み**: ScoreWeightsCard のバーに `role="progressbar"`+aria-valuenow/min/max/valuetext/label。
> ScoreAxisLegend の ▼▲ と評価軸の絵文字アイコンに `aria-hidden`。低コントラストの `text-slate-500`
> （小フォント注釈・暗背景で約4.2:1）を `text-slate-400`（約7:1）へ計8箇所。RankingCard の装飾的順位番号
> `#{rank}` に `aria-hidden`（large-text 3:1 未達の既存問題も併せて解消、aria-label に「第N位」既出）。
> jest-axe で構造的 a11y 違反ゼロを検証（jsdom のため color-contrast は手計算で別途確認）。
> 大スコア "0.0"（淡色は意図的デザイン・large-text 3:1 充足）は据え置き。

- **概要**: 主要 a11y は対応済み。残りの細部:
  - `components/ScoreWeightsCard.tsx`: プログレスバーに `role="progressbar"` + `aria-valuenow/min/max`。
  - `components/ScoreAxisLegend.tsx`: `<details>/<summary>` に `aria-expanded` 相当（unicode ▼▲ の意味補足）。
  - 低コントラスト箇所（`text-slate-400` / `text-slate-500` が暗背景で 4.5:1 未満の所）を slate-300 等へ。
- **対象**: 上記2コンポーネント＋必要なら `app/globals.css`。

### 2-5. バックエンド: LLM プロバイダ抽象化 〔バックエンド / 中 / 中リスク〕

- **概要**: スコア評価=OpenAI（`llm_worker.py`）/ プロフィール生成=Anthropic優先（`generate_profiles.py`）に分裂。
  共通 `LLMProvider` 抽象に寄せ、環境変数でプロバイダ切替可能にする。
- **対象（新規）**: `backend/app/llm/provider.py`（抽象＋OpenAI/Anthropic実装）, `backend/app/llm/__init__.py`（factory）。
  **改修**: `backend/app/scoring/llm_worker.py`, `backend/scripts/generate_profiles.py`, `backend/tests/test_scoring.py`（モック対象を provider に）。
- **リスク**: 既存テストのモック範囲変更。`LlmEvaluation.model_name` は既存カラムを流用可（スキーマ変更不要）。
- **保留理由**: 内部リファクタで本番挙動の即効性が低い。

### 2-6. データ衛生: 重複議員レコードの統合 〔データ移行 / 中 / 中リスク〕

- **概要**: 衆 active が 470（実465 +5）。同一人物が氏名表記ドリフト（旧姓・空白差）で2レコード化。
  原因は `_upsert_politician` が exact `name_ja` 照合（`backend/scripts/ingest.py`）。
- **やるなら**: 重複統合マイグレーション（`match_key` 正規化キーで重複検出 → 活動/bill_sponsor/influence_role/
  score を主レコードへ付替 → 重複削除）。**同名異人の誤マージに注意**（要レビュー/ドライラン）。
- **特定方法**: `match_key(name_ja)` が衝突する is_active=True の representatives を抽出。
- **優先度低**（約1%・順位への影響軽微）。

### 2-7. バックエンド: gold set キャリブレーション / 政党別バイアス監視 〔調査+実装 / 大 / 要設計〕

- **概要**: スコアの妥当性検証用 gold set（人手評価の基準セット）作成と、政党別のスコア分布監視。
- **保留理由**: データ作成・設計判断が必要。product 方針が要る。

### 2-8. フェーズ2残り（低価値）

- 参院 vote の会派別賛否、政党役職（自民はJSレンダリングで静的取得不可→ヘッドレス要）、委員会出席イベント。

### 2-9. 残プロフィール生成（LLM）

- `backend/scripts/generate_profiles.py` をユーザーの API キーで実行（未生成議員の AI プロフィール）。
  生成すると議員詳細の summary が「自動説明」から AI 生成文に変わる。

---

## 3. 改善アイデア（バックログ外の提案）

- **OG 画像の動的生成**: `vercel/og` で議員ごとの OGP 画像（氏名・スコア・順位）を生成し SNS 共有体験を強化。
  現状は `summary` テキストの summary カードのみ。`app/api/og/route.tsx` を追加。
- **インジェスト失敗の通知**: ワークフロー failure 時に通知（GitHub Actions の status バッジ / 失敗時 issue 自動起票）。
  過去に法案投入が silent に失敗していた経緯あり。
- **党役職のヘッドレス取得**: 自民等の党役職（幹事長・政調会長等）は ROLE_LEVEL_WEIGHTS に重みはあるが
  データ未取得。Playwright 等のヘッドレスで取得すれば influence の精度向上。
- **孤児 ingestion_runs の後始末**: 過去の同期API失敗で `running` のまま残る行（実害なしだが /health の見栄え）。
- **出席率の代替指標の明示**: 個人別出席率は機械可読データ不在。「委員会出席イベント＋発言量」で代替している旨を
  UI に明記すると透明性が上がる。
- **influence の新人/少数会派の扱い**（※正規化は絶対値維持で決定済み）: もし是正したくなったら、正規化ではなく
  **最終スコアでの influence 重み配分**や軸ラベル（「制度的ポジション」と明示）で対処する。

---

## 4. 設計上の確定事項（蒸し返さないためのメモ）

### 4-A. influence 正規化 = 絶対値維持（決定済み 2026-06-05）

- `compute_influence_score` は `role_weight_sum` を `ROLE_WEIGHT_MAX=20` で割って×100 の**固定正規化**を継続。
- 院別/会派別の相対正規化には**しない**。理由:
  - influence は「制度的ポジション（多数派・当選回数に紐づくゼロサムな権力）」の実測であり、
    相対化すると実際の権力差を覆い隠してメトリクスが不正確になる。
  - 会派別相対は「少数会派の理事が与党委員長を上回る」など院横断ランキングの意味を壊す。
  - 「新人/少数会派が低い」は influence 軸としては正確な反映でありバグではない。

---

## 5. 運用リファレンス（ワークフロー / コマンド早見表）

### ワークフロー（すべて `gh workflow run ... --repo youmyoum62/Political-analyst`）

| 用途 | ワークフロー | 主な入力 |
|---|---|---|
| 会議録インジェスト | `scheduled-ingest.yml` | `days`(既定90) / `limit`(0=全) / `roster_only`(名簿のみ更新・高速) ※cron 03:00 JST 自動 |
| 法案・役職投入 | `ingest-bills-roles.yml` | `dry_run` / `since_kaiji`(213) / `sangiin_roles_urls`(任意)。衆参委員会は自動巡回 |
| スコア再計算 | `recompute-snapshot.yml` | `period_start` / `period_end`（**毎回 未使用 period**） |

### スコア再計算の鉄則

- `recompute_snapshot` は同一 `(period_start, period_end)` の既存スナップショットを**スキップ**する。
  反映させるには **これまで未使用の period** を指定する（例: 終了日を1日ずらす）。
- ランキングは議員ごとの **`max(computed_at)`** で最新スナップショットを選ぶ（`repositories.py:list_ranking`）。
  そのため period に関係なく「最後に計算したもの」が表示される。
- 使用済み period（重複回避の参考）: `2026-03-07〜2026-06-05`、`2024-01-01〜2026-06-05`、
  `2023-12-31〜2026-06-05`、`2023-12-30〜2026-06-06`、`2023-12-29〜2026-06-06`、`2023-12-28〜2026-06-06`。
  → 次は例えば `2023-12-27〜2026-06-06` 等。

### 役職重みを変えた場合（再取込不要）

- `snapshot.py` は計算時に `ROLE_LEVEL_WEIGHTS.get(role.role_name, ...)` で重みを**引き直す**ため、
  `calculator.py` の重みを変えたら **役職の再取込は不要・スコア再計算のみ**で反映される。

### デプロイ / 検証

- 反映: `git push origin HEAD:main`（push先は master、デプロイ対象は origin/main）。
- API 検証: `/health`（議員数・鮮度）、`/v1/ranking`（house別・各スコア>0件数）。Render 無料枠はコールドスタートあり。
- フロント: `https://political-analyst-s7s6.vercel.app`。

### テスト / ビルド（ローカル）

- バックエンド: `PYTHONPATH=backend python -m pytest backend\tests -q`（システム Python に依存一式あり）。
- フロント: `npx tsc --noEmit` ＋ `npm run build`。

---

## 6. 既知の注意点

- **冪等性**: 法案=bill_code＋複合PK＋実行内seen、役職=source_url単位 delete-insert、会議録=source_hash。再実行安全。
- **過去議員の無効化**: `_deactivate_former_members` は名簿600名未満なら取得不全とみなしスキップ（誤無効化防止）。
  `--limit` 指定時は無効化しない。
- **出典表記**: 法案データは「スマートニュース メディア研究所」(MIT) を UI 明記（対応済み・フッター）。
- **本番値の所在**: `ADMIN_TOKEN`・`DATABASE_URL` は Render → political-analyst-api → Environment、
  および GitHub Secrets に設定済み（値はセッションから読めない）。
