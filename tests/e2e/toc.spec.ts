import { expect, test } from '@playwright/test';

test('目次：全体が並び、印を付けると絞れて、開いた項目は「読んだ」になる', async ({ page }) => {
  await page.goto('./#/index');
  await expect(page.getByTestId('toc')).toBeVisible();
  // 全体像：カード・参照・薬・科が並ぶ
  await expect(page.locator('[data-item="card:arrest"]')).toBeVisible();
  await expect(page.locator('[data-item="topic:sah"]')).toBeVisible();
  await expect(page.locator('[data-item="drug:adrenaline"]')).toBeVisible();
  await expect(page.locator('[data-item="spec:cardiology"]')).toBeVisible();

  // 目次で「重要」を付けると、絞り込みに出る
  await page.locator('[data-item="topic:sah"] [data-mark="important"]').click();
  await expect(page.locator('[data-item="topic:sah"] [data-mark="important"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-filter="important"]').click();
  await expect(page.getByTestId('toc-count')).toHaveText('1件');
  await expect(page.locator('[data-item="topic:sah"]')).toBeVisible();
  await expect(page.locator('[data-item="card:arrest"]')).toHaveCount(0);

  // 項目のページでも同じ印が見え、そこで「要復習」を付けられる
  await page.locator('[data-item="topic:sah"] > a').click();
  await expect(page.locator('main[data-topic="sah"] [data-mark="important"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('main[data-topic="sah"] [data-mark="review"]').click();
  await expect(page.locator('main[data-topic="sah"] [data-mark="review"]')).toHaveAttribute('aria-pressed', 'true');

  // 目次に戻ると「読んだ」になり、要復習で絞れる。読み込み直しても残る
  await page.goto('./#/index');
  await page.reload();
  await expect(page.locator('[data-item="topic:sah"]')).toContainText('読んだ');
  await page.locator('[data-filter="review"]').click();
  await expect(page.locator('[data-item="topic:sah"]')).toBeVisible();
  await page.locator('[data-filter="unseen"]').click();
  await expect(page.locator('[data-item="topic:sah"]')).toHaveCount(0);
});

test('目次：カードに付けた「要復習」は今日の想起に並ぶ', async ({ page }) => {
  await page.goto('./#/index');
  await page.locator('[data-item="card:sepsis"] [data-mark="review"]').click();
  await expect(page.locator('[data-item="card:sepsis"] [data-mark="review"]')).toHaveAttribute('aria-pressed', 'true');
  await page.goto('./#/learn');
  await expect(page.locator('#today li[data-card="sepsis"]')).toHaveAttribute('data-source', 'review');
});
