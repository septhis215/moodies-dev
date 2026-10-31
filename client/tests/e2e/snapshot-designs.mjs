import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium, expect } from 'playwright/test';
import { startDetailApi } from './fixtures/detail-api.mjs';
import { installMockTurnstile } from './fixtures/turnstile.mjs';

const api = await startDetailApi();
const browser = await chromium.launch({ headless: true });
const output = '../artifacts/snapshot-preview';
await mkdir(output, { recursive: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', permissions: ['clipboard-read', 'clipboard-write'] });
  await installMockTurnstile(context);
  await context.route('https://image.tmdb.org/**', async (route) => route.fulfill({ contentType: 'image/jpeg', body: await readFile(route.request().url().includes('backdrop') ? 'public/images/ironmanbg.jpg' : 'public/images/ironmanposter.jpeg') }));
  const page = await context.newPage();
  await page.goto('http://localhost:3000/movies/550');
  await page.getByRole('button', { name: 'Share content snapshot' }).click();
  const dialog = page.getByRole('dialog', { name: 'Snapshot studio' });
  const preview = dialog.locator('img[alt^="Snapshot of"]');
  const download = dialog.getByRole('button', { name: 'Download', exact: true });
  const ready = () => expect(download).toBeEnabled({ timeout: 20_000 });
  await ready();
  await expect(dialog.locator('input[type="text"], textarea')).toHaveCount(0);
  await expect(dialog.getByRole('slider')).toHaveCount(0);
  await expect(dialog.getByRole('tab')).toHaveCount(0);
  const designs = [];
  for (const [layout, label] of [['premiere', 'Premiere'], ['ticket', 'The ticket'], ['editorial', 'Editorial'], ['cinematic', 'Full bleed']]) {
    await dialog.getByRole('radio', { name: label, exact: true }).check();
    await ready();
    await expect(preview).toHaveJSProperty('naturalHeight', 1350);
    await expect(preview).toHaveJSProperty('naturalWidth', 1080);
    const url = await preview.getAttribute('src');
    designs.push(url);
    await writeFile(`${output}/${layout}.png`, Buffer.from(url.split(',')[1], 'base64'));
  }
  assert.equal(new Set(designs).size, 4, 'Each template has its own composition');
  await dialog.getByRole('radio', { name: 'Premiere', exact: true }).check();
  await ready();
  for (const name of ['gold accent', 'paper surface']) {
    const before = await preview.getAttribute('src');
    await dialog.getByRole('radio', { name, exact: true }).check();
    await ready();
    assert.notEqual(before, await preview.getAttribute('src'), `${name} changes the image`);
  }
  const beforeCustom = await preview.getAttribute('src');
  await dialog.getByLabel('Custom accent color').fill('#718cca');
  await ready();
  assert.notEqual(beforeCustom, await preview.getAttribute('src'));
  const exported = page.waitForEvent('download');
  await download.click();
  const file = await exported;
  assert.ok(file.suggestedFilename().endsWith('.png'));
  await file.saveAs(`${output}/download.png`);
  assert.equal((await readFile(`${output}/download.png`)).subarray(1, 4).toString(), 'PNG');
  await dialog.getByRole('button', { name: 'Copy', exact: true }).click();
  await expect(page.getByText('Snapshot copied.', { exact: true })).toBeVisible();
  assert.ok(await page.evaluate(async () => (await navigator.clipboard.read()).some((item) => item.types.includes('image/png'))));
  await page.screenshot({ path: `${output}/desktop.png` });
  await dialog.getByRole('button', { name: 'Close snapshot' }).click();

  await page.evaluate(() => { window.__turnstileTestMode = 'hang'; });
  await page.getByRole('button', { name: 'Share content snapshot' }).click();
  await page.getByRole('dialog', { name: 'Quick security check' }).getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Security check cancelled');
  await expect(download).toBeDisabled();
  await page.evaluate(() => { window.__turnstileTestMode = 'success'; });
  await dialog.getByRole('button', { name: 'Try again' }).click();
  await ready();
  await dialog.getByRole('button', { name: 'Close snapshot' }).click();

  // Hosted font failures must not prevent a usable preview or download.
  for (const mode of ['reject', 'hang']) {
    await page.reload();
    await page.evaluate((mode) => {
      document.fonts.load = () => mode === 'reject' ? Promise.reject(new Error('Font unavailable')) : new Promise(() => {});
    }, mode);
    await page.getByRole('button', { name: 'Share content snapshot' }).click();
    await ready();
    await expect(preview).toHaveJSProperty('naturalWidth', 1080);
    await dialog.getByRole('button', { name: 'Close snapshot' }).click();
  }
  await page.reload();
  await page.getByRole('button', { name: 'Share review by Alex', exact: true }).click();
  await ready();
  for (const [layout, label] of [['premiere', 'Premiere'], ['ticket', 'The ticket'], ['editorial', 'Editorial'], ['cinematic', 'Full bleed']]) {
    await dialog.getByRole('radio', { name: label, exact: true }).check();
    await ready();
    await writeFile(`${output}/review-${layout}.png`, Buffer.from((await preview.getAttribute('src')).split(',')[1], 'base64'));
  }
  for (const [width, height] of [[320, 568], [844, 390]]) {
    await page.setViewportSize({ width, height });
    const previewBounds = await preview.boundingBox();
    assert.ok(previewBounds.height > 100 && previewBounds.width > 100);
    await expect(download).toBeInViewport();
    await expect(dialog.getByRole('radio', { name: 'paper surface', exact: true })).toBeInViewport();
    assert.ok(await dialog.evaluate((el) => el.scrollHeight <= el.clientHeight + 1));
    await page.screenshot({ path: `${output}/review-studio-${width}.png` });
  }
  console.log('Snapshot checks passed: four locked templates, colors, PNG download/clipboard, security cancellation/retry, failed and stalled fonts.');
} finally {
  await browser.close();
  await api.close();
}
