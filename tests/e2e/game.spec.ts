import { expect, type Page, test } from '@playwright/test';
import { plan } from '../../src/core/generate';
import { LEVELS } from '../../src/core/levels';

const cell = (page: Page, i: number) => page.locator(`.cell[data-i="${i}"]`);

/** The same seed the page will use, so tests know where the mines are. */
function sharedBoard(seed: string) {
  const { cols, rows, mines } = LEVELS.easy;
  const p = plan({ cols, rows, mines, noGuess: true, seed });
  return { ...p, mineSet: new Set(p.mines), size: cols * rows };
}

test.beforeEach(async ({ page }) => {
  // Start every test on Easy with sound off. Set once, so reloads keep what a test changes.
  await page.goto('/');
  await page.evaluate(() =>
    localStorage.setItem('ms2.settings', JSON.stringify({ level: 'easy', noGuess: true, muted: true })),
  );
});

test('first dig opens an area and starts the clock', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.cell')).toHaveCount(81);
  await expect(page.locator('#status')).toContainText('Dig anywhere');
  await cell(page, 40).click();
  await expect(page.locator('.cell.open').first()).toBeVisible();
  expect(await page.locator('.cell.open').count()).toBeGreaterThan(1);
  await expect(page.locator('#time')).not.toHaveText('0:00', { timeout: 3000 });
});

test('a shared board can be won by opening every safe tile', async ({ page }) => {
  const seed = 'e2e-win';
  const board = sharedBoard(seed);
  await page.goto(`/?level=easy&seed=${seed}`);
  await expect(page.getByRole('button', { name: 'Shared board' })).toHaveAttribute('aria-pressed', 'true');
  await expect(cell(page, board.start)).toHaveClass(/open/);
  for (let i = 0; i < board.size; i++) {
    if (board.mineSet.has(i)) continue;
    const c = cell(page, i);
    if (!(await c.getAttribute('class'))?.includes('open')) await c.click();
  }
  await expect(page.locator('#status')).toContainText('Cleared in');
  await expect(page.locator('#mines')).toHaveText('0');
});

test('hitting a mine ends the game and shows the mines', async ({ page }) => {
  const board = sharedBoard('e2e-lose');
  await page.goto('/?level=easy&seed=e2e-lose');
  await cell(page, board.mines[0] ?? -1).click();
  await expect(page.locator('#status')).toContainText('Boom');
  await expect(page.locator('.cell.boom')).toHaveCount(1);
  await expect(page.locator('.cell.mine')).toHaveCount(board.mines.length - 1);
});

test('flags by right-click and by keyboard update the counter', async ({ page }) => {
  const board = sharedBoard('e2e-flag');
  await page.goto('/?level=easy&seed=e2e-flag');
  const [a = -1, b = -1] = board.mines;
  await cell(page, a).click({ button: 'right' });
  await expect(cell(page, a)).toHaveClass(/flag/);
  await expect(page.locator('#mines')).toHaveText('9');
  await cell(page, b).focus();
  await page.keyboard.press('f');
  await expect(page.locator('#mines')).toHaveText('8');
  await page.keyboard.press('f');
  await expect(page.locator('#mines')).toHaveText('9');
});

test('arrow keys move focus and Space digs', async ({ page }) => {
  await page.goto('/');
  await cell(page, 40).focus();
  await page.keyboard.press('ArrowRight');
  await expect(cell(page, 41)).toBeFocused();
  await page.keyboard.press('Space');
  await expect(cell(page, 41)).toHaveClass(/open/);
});

test('the chosen mode survives a reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Medium' }).click();
  await expect(page.locator('.cell')).toHaveCount(256);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Medium' })).toHaveAttribute('aria-pressed', 'true');
});

test('daily mode gives a pre-opened board', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Daily #\d+/ }).click();
  await expect(page.locator('#status')).toContainText('Everyone plays this board today');
  expect(await page.locator('.cell.open').count()).toBeGreaterThan(0);
  await expect(page.locator('#noGuess')).toBeDisabled();
});

test('expert stands upright on a portrait phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?level=expert');
  await expect(page.locator('.cell')).toHaveCount(480);
  const cols = await page.locator('#board').evaluate((el) => getComputedStyle(el).getPropertyValue('--cols'));
  expect(cols.trim()).toBe('16');
  const overflow = await page.locator('#scroll').evaluate((el) => el.scrollWidth > el.clientWidth);
  expect(overflow).toBe(false);
});

test('ships an installable manifest', async ({ page, request }) => {
  await page.goto('/');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();
  const res = await request.get(href ?? '');
  expect((await res.json()).name).toBe('Minesweeper');
});
