import { expect, test } from '@playwright/test';

test('参照：分野から項目を開くと、冒頭に要約とポイントが出る', async ({ page }) => {
  await page.goto('./#/');
  await page.getByRole('navigation', { name: 'モード' }).getByRole('link', { name: '参照' }).click();
  await page.locator('a[data-field="emergency"]').click();
  await page.getByRole('link', { name: /成人の心停止/ }).click();
  const summary = page.getByTestId('topic-summary');
  await expect(summary).toBeInViewport();
  await expect(page.getByRole('heading', { name: 'ポイント' })).toBeVisible();
  await expect(page.locator('table.ref-table').first()).toContainText('アドレナリン');
});

test('参照：商品名で検索して薬のページに届き、商品名・用法用量・体重別の表が出る', async ({ page }) => {
  await page.goto('./#/ref');
  await page.getByPlaceholder(/病名・薬/).fill('アンカロン');
  await page.locator('#search-results').getByRole('link', { name: /アミオダロン/ }).click();
  await expect(page.locator('main[data-drug="amiodarone"]')).toBeVisible();
  await expect(page.getByText('アンカロン注150').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: '用法用量' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '体重別の早見表' })).toBeVisible();
});

test('参照：確認問題を通して解くと記録され、学習画面の数が増える', async ({ page }) => {
  await page.goto('./#/topic/rrs-criteria/quiz');
  for (let i = 0; i < 1; i++) {
    await page.getByRole('button', { name: '答えを見る' }).click();
    await page.locator('[data-rating="good"]').click();
  }
  await expect(page.getByTestId('topic-quiz-done')).toBeVisible();
  await page.goto('./#/learn');
  await expect(page.getByRole('link', { name: /院内で人を呼ぶ基準/ })).toContainText('1/1問');
});

test('現場カードから参照の項目へつながる', async ({ page }) => {
  await page.goto('./#/card/arrest');
  await page.getByRole('link', { name: '成人の心停止（ALS）' }).click();
  await expect(page.locator('main[data-topic="als-adult"]')).toBeVisible();
});
