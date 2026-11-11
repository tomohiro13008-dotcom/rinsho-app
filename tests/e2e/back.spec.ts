import { expect, test } from '@playwright/test';

test('戻る：アプリ内でたどった画面には履歴で戻り、直接開いた画面では上の階層へ行く', async ({ page }) => {
  // 直接開いた項目 → 分野の一覧へ
  await page.goto('./#/topic/sah');
  await expect(page.getByTestId('facility')).toBeVisible();
  await page.getByTestId('back').click();
  await expect(page).toHaveURL(/#\/ref\/field\/neuro$/);
  await page.getByTestId('back').click();
  await expect(page).toHaveURL(/#\/ref$/);
  // タブの入口には戻るを出さない
  await expect(page.getByTestId('back')).toHaveCount(0);

  // ホーム → 状態の一覧 → カード とたどったら、来た道を戻る
  await page.goto('./#/');
  await page.evaluate(() => (location.hash = '#/state/shock'));
  await expect(page).toHaveURL(/#\/state\/shock$/);
  await page.evaluate(() => (location.hash = '#/card/sepsis'));
  await expect(page).toHaveURL(/#\/card\/sepsis$/);
  await page.getByTestId('back').click();
  await expect(page).toHaveURL(/#\/state\/shock$/);
  await page.getByTestId('back').click();
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.getByTestId('back')).toHaveCount(0);
});
