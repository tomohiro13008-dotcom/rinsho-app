import { expect, test } from '@playwright/test';

test('ICU管理：章が順に並び、表が読め、空欄の型を写せる（書き込む欄はない）', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('./#/ref/field/icu');
  const items = page.locator('a[href^="#/topic/icu-"]');
  await expect(items).toHaveCount(15);
  await expect(items.first()).toContainText('ICU患者の見方');
  await expect(items.last()).toContainText('カルテの型');
  // 足した章は、もとの臓器の章のすぐ後ろに並ぶ
  await expect(items.nth(3)).toContainText('心原性ショック');
  await expect(items.nth(5)).toContainText('人工呼吸器のモードと波形');

  // 臓器の章：「何を評価しているか」「次の一手」が項目ごとに読める
  await page.goto('./#/topic/icu-circulation');
  const main = page.locator('main[data-topic="icu-circulation"]');
  await expect(main).toBeVisible();
  await expect(main.locator('td[data-label="何を評価しているか"]').first()).toBeVisible();
  await expect(main.locator('td[data-label="次の一手"]').first()).toBeVisible();

  // 空欄の型：写すとクリップボードに入る。アプリに書き込む欄はない
  const tpl = main.getByTestId('note-template');
  await expect(tpl).toHaveCount(1);
  await tpl.getByRole('button', { name: '空欄の型を写す（コピー）' }).click();
  await expect(tpl.getByRole('button')).toContainText('型を写しました');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('【循環】');
  await expect(main.locator('input, textarea, [contenteditable]')).toHaveCount(0);

  // カルテの型の章：by system と by problem の両方がある
  await page.goto('./#/topic/icu-note-templates');
  const t2 = page.locator('main[data-topic="icu-note-templates"]');
  await expect(t2.getByTestId('note-template')).toHaveCount(5);
  await expect(t2).toContainText('臓器ごとの問題・評価・方針');
  await expect(t2).toContainText('いちばん大事な問題');
  await expect(t2.locator('input, textarea, [contenteditable]')).toHaveCount(0);
});
