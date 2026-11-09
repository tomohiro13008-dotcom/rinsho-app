import { expect, test, type Page } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';

const HOUR = 60 * 60 * 1000;
const cardIds = readdirSync('content/cards').map((f) => f.replace(/\.json$/, ''));
const cards = cardIds.map((id) => JSON.parse(readFileSync(`content/cards/${id}.json`, 'utf8')));

async function ready(page: Page) {
  await expect(page.getByTestId('facility')).toBeVisible();
}

test('ホームから全カードに2タップ以内で届く', async ({ page }) => {
  for (const c of cards) {
    await page.goto('./#/');
    await ready(page);
    let taps = 0;
    if (c.common) {
      await page.getByRole('navigation', { name: '共通カード' }).getByRole('link', { name: c.title }).click();
      taps++;
    } else {
      const stateLink = page.locator(`a[data-state="${c.states[0]}"]`);
      const direct = (await stateLink.getAttribute('href')) === `#/card/${c.id}`;
      await stateLink.click();
      taps++;
      if (!direct) {
        await page.getByRole('link', { name: c.title }).first().click();
        taps++;
      }
    }
    await expect(page.locator(`main[data-card="${c.id}"]`)).toBeVisible();
    expect(taps, c.id).toBeLessThanOrEqual(2);
  }
});

test('カードの最初の画面（高さ667px）に「呼ぶ基準」が見える', async ({ page }) => {
  for (const c of cards) {
    await page.goto(`./#/card/${c.id}`);
    await ready(page);
    const box = page.getByTestId('call-for-help');
    await expect(box.getByRole('heading', { name: '呼ぶ基準' })).toBeInViewport({ ratio: 1 });
    await expect(page.getByText('教育・訓練用。最終判断は担当医と施設の手順に従う')).toBeVisible();
  }
});

test('設備スイッチを切ると ifMissing の行に切り替わる', async ({ page }) => {
  const arrest = cards.find((c) => c.id === 'arrest');
  const step = arrest.steps.find((s: { requires?: string[] }) => s.requires?.includes('aed'));
  await page.goto('./#/card/arrest');
  await ready(page);
  await expect(page.getByText(step.text)).toBeVisible();
  await expect(page.getByText(step.ifMissing)).toHaveCount(0);

  await page.goto('./#/settings');
  const aed = page.locator('input[name="eq-aed"]');
  await expect(aed).toBeChecked();
  await aed.uncheck();
  await expect(aed).not.toBeChecked();

  await page.goto('./#/card/arrest');
  await ready(page);
  await expect(page.getByText(step.ifMissing)).toBeVisible();
  await expect(page.getByText(step.text)).toHaveCount(0);
  await expect(page.locator('li[data-replaced="true"]')).toContainText('AED・除細動器がない');
});

test('現場で開いたカードは8時間後の「今日の想起」に並び、8時間未満では並ばない', async ({ page }) => {
  const t0 = new Date(2026, 10, 10, 1, 0, 0);
  await page.clock.install({ time: t0 });
  await page.goto('./#/card/dyspnea');
  await ready(page);
  await expect(page.locator('main[data-card="dyspnea"]')).toBeVisible();
  // 記録の書き込みを待つ
  await page.waitForTimeout(300);

  await page.clock.setSystemTime(new Date(t0.getTime() + 8 * HOUR - 60_000));
  await page.goto('./#/learn');
  await page.reload();
  await expect(page.locator('#today')).toBeVisible();
  await expect(page.locator('#today li[data-card="dyspnea"][data-source="field"]')).toHaveCount(0);

  await page.clock.setSystemTime(new Date(t0.getTime() + 8 * HOUR + 60_000));
  await page.reload();
  await expect(page.locator('#today li[data-card="dyspnea"][data-source="field"]')).toBeVisible();
  // 現場の記録が先頭
  await expect(page.locator('#today li').first()).toHaveAttribute('data-card', 'dyspnea');
});

test('引いた記録がない日でも「今日の想起」が空にならない（順送り）', async ({ page }) => {
  await page.goto('./#/learn');
  await ready(page);
  const items = page.locator('#today li');
  await expect(items).toHaveCount(1);
  await expect(items.first()).toHaveAttribute('data-source', 'new');

  // 練習すると今日の順送りは終わり、翌日に次の1枚が出る
  await items.first().getByRole('link').click();
  await page.getByRole('button', { name: '読んだ' }).click();
  await expect(page.getByTestId('practice-done')).toBeVisible();
});

test('翌日には次の未練習カードと復習が並ぶ', async ({ page }) => {
  const t0 = new Date(2026, 10, 10, 9, 0, 0);
  await page.clock.install({ time: t0 });
  await page.goto('./#/learn');
  await ready(page);
  const first = await page.locator('#today li').first().getAttribute('data-card');
  await page.locator('#today li').first().getByRole('link').click();
  await page.getByRole('button', { name: '読んだ' }).click();
  await expect(page.getByTestId('practice-done')).toBeVisible();

  await page.clock.setSystemTime(new Date(t0.getTime() + 24 * HOUR));
  await page.goto('./#/learn');
  await page.reload();
  await expect(page.locator(`#today li[data-card="${first}"][data-source="review"]`)).toBeVisible();
  await expect(page.locator('#today li[data-source="new"]')).toHaveCount(1);
});

test('オフラインで開ける', async ({ page, context }) => {
  await page.goto('./');
  await ready(page);
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((r) => navigator.serviceWorker.addEventListener('controllerchange', () => r(), { once: true }));
    }
    return reg.active?.state;
  });
  await context.setOffline(true);
  await page.reload();
  await ready(page);
  await page.locator('a[data-state="arrest"]').click();
  await expect(page.getByTestId('call-for-help')).toBeVisible();
  await page.getByRole('navigation', { name: 'モード' }).getByRole('link', { name: '学習' }).click();
  await expect(page.locator('#today')).toBeVisible();
});

test('書き出し・読み込みで記録が戻る', async ({ page }) => {
  await page.goto('./#/settings');
  await ready(page);
  await page.getByLabel('名前').fill('診療所A');
  await page.getByLabel('名前').blur();
  await expect(page.getByTestId('facility')).toHaveText('施設：診療所A');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '書き出す（JSON）' }).click()]);
  const path = await download.path();
  const json = JSON.parse(readFileSync(path!, 'utf8'));
  expect(json.format).toBe('rinsho-app-export');

  await page.getByLabel('名前').fill('別の名前');
  await page.getByLabel('名前').blur();
  await expect(page.getByTestId('facility')).toHaveText('施設：別の名前');

  page.on('dialog', (d) => d.accept());
  await page.locator('input[type="file"]').setInputFiles(path!);
  await expect(page.getByTestId('facility')).toHaveText('施設：診療所A');
});

test('患者の入力欄がない（数値入力・検査値の欄を置かない）', async ({ page }) => {
  for (const h of ['#/', '#/card/arrest', '#/learn', '#/practice/arrest/manual', '#/dash', '#/settings']) {
    await page.goto(`./${h}`);
    await ready(page);
    await expect(page.locator('input[type="number"]')).toHaveCount(0);
  }
});
