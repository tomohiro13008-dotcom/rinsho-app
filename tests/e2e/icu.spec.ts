import { expect, test } from '@playwright/test';

test('ICU管理：章が順に並び、表が読め、空欄の型を写せる（書き込む欄はない）', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('./#/ref/field/icu');
  const items = page.locator('a[href^="#/topic/icu-"]');
  await expect(items).toHaveCount(19);
  await expect(items.first()).toContainText('ICU患者の見方');
  await expect(items.last()).toContainText('カルテの型');
  // 足した章は、もとの臓器の章のすぐ後ろに並ぶ
  await expect(items.nth(3)).toContainText('心原性ショック');
  await expect(items.nth(4)).toContainText('補助循環');
  await expect(items.nth(6)).toContainText('気管挿管');
  await expect(items.nth(7)).toContainText('人工呼吸器のモードと波形');
  await expect(items.nth(8)).toContainText('PEEP');
  await expect(items.nth(15)).toContainText('治療期間');

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

test('ICU管理：神経の章から鎮痛・鎮静の薬に届き、出どころ別の行と体重別の表が出る（計算する欄はない）', async ({ page }) => {
  await page.goto('./#/topic/icu-neuro');
  const main = page.locator('main[data-topic="icu-neuro"]');
  await expect(main.locator('a[href="#/drug/fentanyl"]')).toBeVisible();
  await main.locator('a[href="#/drug/propofol"]').click();
  const drug = page.locator('main[data-drug="propofol"]');
  await expect(drug).toBeVisible();
  // 添付文書の行と、書籍の指示の例の行は、出どころを分けて出す
  await expect(drug.locator('.dose')).toHaveCount(4);
  await expect(drug.locator('.dose').first()).toContainText('出どころ：添付文書');
  await expect(drug.locator('.dose').last()).toContainText('出どころ：書籍（指示の例）');
  await expect(drug.getByRole('heading', { name: '体重別の早見表' })).toBeVisible();
  await expect(drug).toContainText('書き手が体重から計算');
  await expect(drug.locator('input, textarea, select, [contenteditable]')).toHaveCount(0);
});

test('打ち消す薬：章の表から薬のページに届き、PT-INR ごとの固定の表が出る（計算する欄はない）', async ({ page }) => {
  await page.goto('./#/topic/anticoagulant-reversal');
  const main = page.locator('main[data-topic="anticoagulant-reversal"]');
  await expect(main).toContainText('飲んでいる薬ごとの打ち消す薬');
  await expect(main.getByTestId('note-template')).toHaveCount(1);
  await expect(main.locator('input, textarea, select, [contenteditable]')).toHaveCount(0);
  await main.locator('a[href="#/drug/pcc-4f"]').click();
  const drug = page.locator('main[data-drug="pcc-4f"]');
  await expect(drug.getByRole('heading', { name: '体重別の早見表' })).toBeVisible();
  await expect(drug).toContainText('1,500IU');
  await expect(drug.locator('input, textarea, select, [contenteditable]')).toHaveCount(0);
});
