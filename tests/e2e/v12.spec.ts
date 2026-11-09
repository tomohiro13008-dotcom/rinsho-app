import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const HOUR = 60 * 60 * 1000;
const dyspnea = JSON.parse(readFileSync('content/cards/dyspnea.json', 'utf8'));

async function ready(page: Page) {
  await expect(page.getByTestId('facility')).toBeVisible();
}

async function checkAllAndSave(page: Page) {
  const boxes = page.getByTestId('checklist').locator('input[type="checkbox"]');
  const n = await boxes.count();
  for (let i = 0; i < n; i++) await boxes.nth(i).check();
  await page.getByTestId('save-checks').click();
  await expect(page.getByTestId('practice-done')).toBeVisible();
}

test('①② 段階2からは題名でなく看護師の第一声で問い、項目ごとに照合して記録する', async ({ page }) => {
  await page.goto('./#/practice/dyspnea/manual');
  await ready(page);
  // 段階0：全文を読む
  await page.getByRole('button', { name: '読んだ' }).click();
  await expect(page.getByTestId('practice-done')).toBeVisible();
  // 段階1：全文を見ながら項目に印を付ける → 段階2へ
  await page.goto('./#/practice/dyspnea/manual');
  await page.reload();
  await expect(page.locator('main[data-card="dyspnea"]')).toHaveAttribute('data-asked', 'title');
  await checkAllAndSave(page);
  await expect(page.getByTestId('practice-done')).toContainText('ヒントで言える');

  // 段階2：第一声で問う。題名は答えを見るまで出ない
  await page.goto('./#/practice/dyspnea/manual');
  await page.reload();
  const main = page.locator('main[data-card="dyspnea"]');
  await expect(main).toHaveAttribute('data-asked', 'first-call');
  const call = (await page.getByTestId('first-call').textContent())!.replace(/[「」]/g, '');
  expect(dyspnea.firstCalls).toContain(call);
  await expect(page.getByRole('heading', { level: 1, name: dyspnea.title })).toHaveCount(0);

  await page.getByRole('button', { name: '言ったので答えを見る' }).click();
  await expect(page.getByRole('heading', { level: 1, name: dyspnea.title })).toBeVisible();
  const items = page.getByTestId('checklist').locator('label.check-item');
  const total = 1 + dyspnea.firstActions.length + dyspnea.callForHelp.criteria.length;
  await expect(items).toHaveCount(total);
  await expect(items.first()).toHaveAttribute('data-key', 'which');
  // 半分未満しか言えなかった → もう一度（段階が1つ下がる）
  await items.first().locator('input').check();
  await expect(page.getByTestId('save-checks')).toHaveText(`記録する（1/${total}）`);
  await page.getByTestId('save-checks').click();
  await expect(page.getByTestId('practice-done')).toContainText(`言えた項目：1/${total}`);
  await expect(page.getByTestId('practice-done')).toContainText('見て分かる');
});

test('③ 本番の後に迷った行へ印を付けると、記録に残り、8時間後の想起に先頭で並ぶ', async ({ page }) => {
  const t0 = new Date(2026, 10, 10, 1, 0, 0);
  await page.clock.install({ time: t0 });
  await page.goto('./#/card/arrest');
  await ready(page);
  const href = await page.getByTestId('to-mark').getAttribute('href');
  expect(href).toBe('#/card/arrest/mark');
  await page.getByTestId('to-mark').click();
  const line = page.locator('button.mark-line[data-line="call:0"]');
  await line.click();
  await expect(line).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '印を残す（1行）' }).click();
  await expect(page.getByTestId('mark-done')).toBeVisible();

  await page.goto('./#/dash');
  await page.reload();
  await expect(page.getByTestId('marked-list').locator('li[data-card="arrest"][data-line="call:0"]')).toBeVisible();

  await page.clock.setSystemTime(new Date(t0.getTime() + 8 * HOUR + 60_000));
  await page.goto('./#/learn');
  await page.reload();
  await expect(page.locator('#today li').first()).toHaveAttribute('data-source', 'marked');
  await expect(page.locator('#today li').first()).toHaveAttribute('data-card', 'arrest');
});

test('④ 科のページに夜に要る2項目が出て、困った科を1タップで記録・取り消しできる', async ({ page }) => {
  await page.goto('./#/specialty/cardiology');
  await ready(page);
  for (const h of ['朝まで待てない条件', '朝まで待てる条件', '専門医が来るまでにやってはいけないこと']) {
    await expect(page.getByRole('heading', { name: h })).toBeVisible();
  }

  await page.goto('./#/dash');
  const btn = page.locator('#troubles button[data-field="obgyn"]');
  await btn.click();
  await expect(page.getByTestId('trouble-counts').locator('li[data-field="obgyn"]')).toContainText('1回');
  await btn.click();
  await expect(page.getByTestId('trouble-counts').locator('li[data-field="obgyn"]')).toContainText('2回');
  await page.getByRole('button', { name: '取り消す' }).click();
  await expect(page.getByTestId('trouble-counts').locator('li[data-field="obgyn"]')).toContainText('1回');
});
