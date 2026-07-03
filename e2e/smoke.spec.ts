import { test, expect } from '@playwright/test';

// クリティカルパスのスモーク: トップ → 議員詳細 → 比較 → 政党別 が壊れていないこと。
// 実データ・実APIに対して実行するため、文言や件数の厳密検証はせず「主要要素が出る」ことを見る。

test('トップ: 見出しと議員カードが表示される', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  // 議員詳細へのリンクが1つ以上ある（ランキングカード）
  const politicianLinks = page.locator('a[href^="/politicians/"]');
  await expect(politicianLinks.first()).toBeVisible();
});

test('トップ → 議員詳細へ遷移できる', async ({ page }) => {
  await page.goto('/');
  const first = page.locator('a[href^="/politicians/"]').first();
  await first.click();
  await expect(page).toHaveURL(/\/politicians\/\d+/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  // スコア推移/レーダーなどの見出しか「議員プロフィール」ラベルが出る
  await expect(page.getByText('議員プロフィール')).toBeVisible();
});

test('比較ページが表示される', async ({ page }) => {
  await page.goto('/compare');
  await expect(page.getByRole('heading', { level: 1, name: /比較/ })).toBeVisible();
  // 議員選択のセレクトが2つある
  await expect(page.getByLabel('比較する議員 A を選択')).toBeVisible();
  await expect(page.getByLabel('比較する議員 B を選択')).toBeVisible();
});

test('政党別ページが表示され詳細へ遷移できる', async ({ page }) => {
  await page.goto('/parties');
  await expect(page.getByRole('heading', { level: 1, name: /政党別/ })).toBeVisible();
  const firstParty = page.locator('a[href^="/parties/"]').first();
  await expect(firstParty).toBeVisible();
  await firstParty.click();
  await expect(page).toHaveURL(/\/parties\//);
  await expect(page.getByText('所属議員（スコア順）')).toBeVisible();
});

test('全議員ランキングと都道府県絞り込みが機能する', async ({ page }) => {
  await page.goto('/ranking?pref=%E6%9D%B1%E4%BA%AC');
  await expect(page.getByLabel('都道府県で絞り込む')).toHaveValue('東京');
  await expect(page.locator('a[href^="/politicians/"]').first()).toBeVisible();
});
