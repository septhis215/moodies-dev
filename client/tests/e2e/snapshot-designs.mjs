import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium, expect } from 'playwright/test';
import { startDetailApi } from './fixtures/detail-api.mjs';
import { installMockTurnstile } from './fixtures/turnstile.mjs';

const api = await startDetailApi();
const browser = await chromium.launch({ headless: true });
const output = '../artifacts/selected-content-refresh/designs';
await mkdir(output, { recursive: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, reducedMotion: 'reduce', permissions: ['clipboard-read', 'clipboard-write'] });
  await installMockTurnstile(context);
  await context.route('https://image.tmdb.org/**', async (route) => route.fulfill({ contentType: 'image/jpeg', body: await readFile(route.request().url().includes('backdrop') ? 'public/images/ironmanbg.jpg' : 'public/images/ironmanposter.jpeg') }));
  const page = await context.newPage();
  await page.goto('http://localhost:3000/movies/550');
  await page.getByRole('button', { name: 'Share content snapshot' }).click();
  const dialog = page.getByRole('dialog', { name: 'Snapshot studio' });
  const preview = dialog.locator('img[alt^="Snapshot of"]');
  const download = dialog.getByRole('button', { name: 'Download', exact: true });
  const ready = () => expect(download).toBeEnabled({ timeout: 20_000 });
  const source = () => preview.getAttribute('src');
  const portraits = [];
  for (const [layout, label] of [['premiere', 'Premiere'], ['ticket', 'The ticket'], ['editorial', 'Editorial'], ['cinematic', 'Full bleed']]) {
    await dialog.getByRole('tab', { name: 'Design', exact: true }).click();
    await dialog.getByRole('radio', { name: label, exact: true }).check();
    for (const [format, width, height] of [['square', 1080, 1080], ['portrait', 1080, 1350], ['story', 1080, 1920], ['landscape', 1600, 900]]) {
      await dialog.getByLabel('Format', { exact: true }).selectOption(format);
      await ready();
      await expect(preview).toHaveJSProperty('naturalHeight', height);
      await expect(preview).toHaveJSProperty('naturalWidth', width);
      const url = await source();
      if (format === 'portrait') portraits.push(url);
      if (format === 'portrait' || format === 'landscape') await writeFile(`${output}/${layout}-${format}.png`, Buffer.from(url.split(',')[1], 'base64'));
    }
  }
  assert.equal(new Set(portraits).size, 4, 'Four layouts produce different compositions');

  await dialog.getByRole('radio', { name: 'Premiere', exact: true }).check();
  await dialog.getByLabel('Format', { exact: true }).selectOption('portrait');
  await dialog.getByRole('tab', { name: 'Content', exact: true }).click();
  await dialog.getByLabel('Display title', { exact: true }).fill('Echoes of Tomorrow');
  await dialog.getByLabel('Your note', { exact: true }).fill('A story worth returning to.');
  await ready();
  for (const label of ['Title details', 'Rating', 'Creator credit', 'Personal note']) {
    const before = await source();
    await dialog.getByRole('checkbox', { name: label, exact: true }).uncheck();
    await ready();
    assert.equal(before !== await source(), true, `${label} changes the export`);
    await dialog.getByRole('checkbox', { name: label, exact: true }).check();
    await ready();
  }
  await dialog.getByRole('tab', { name: 'Image', exact: true }).click();
  const artworkBefore = await source();
  await dialog.getByLabel('Artwork', { exact: true }).selectOption('none');
  await ready();
  assert.equal(artworkBefore !== await source(), true, 'Typography-only export removes artwork');
  await dialog.getByLabel('Artwork', { exact: true }).selectOption('poster');
  await ready();
  for (const label of ['Image zoom', 'Vertical position', 'Image contrast']) {
    const before = await source();
    await dialog.getByRole('slider', { name: label, exact: true }).focus();
    await dialog.getByRole('slider', { name: label, exact: true }).press('End');
    await ready();
    assert.equal(before !== await source(), true, `${label} changes the artwork`);
  }
  await dialog.getByRole('tab', { name: 'Finish', exact: true }).click();
  for (const name of ['gold accent', 'paper surface', 'center alignment']) {
    const before = await source();
    await dialog.getByRole('radio', { name, exact: true }).check();
    await ready();
    assert.equal(before !== await source(), true, `${name} changes the export`);
  }
  await dialog.getByRole('slider', { name: 'Title size', exact: true }).focus();
  await dialog.getByRole('slider', { name: 'Title size', exact: true }).press('Home');
  await expect(dialog.getByRole('slider', { name: 'Title size', exact: true })).toHaveValue('80');
  for (const name of ['Film grain', 'Fine border']) {
    const before = await source();
    await dialog.getByRole('checkbox', { name, exact: true }).check();
    await ready();
    assert.equal(before !== await source(), true, `${name} changes the export`);
  }
  await dialog.getByLabel('Export file type', { exact: true }).selectOption('jpeg');
  await ready();
  assert.equal((await source()).startsWith('data:image/jpeg'), true, 'JPG is encoded as JPEG');
  const exported = page.waitForEvent('download');
  await download.click();
  const file = await exported;
  assert.equal(file.suggestedFilename().endsWith('.jpg'), true);
  await file.saveAs(`${output}/customized.jpg`);
  const bytes = await readFile(`${output}/customized.jpg`);
  assert.equal(bytes.subarray(0, 2).toString('hex'), 'ffd8');
  await dialog.getByRole('button', { name: 'Copy', exact: true }).click();
  await expect(page.getByText('Snapshot copied.', { exact: true })).toBeVisible();
  assert.equal(await page.evaluate(async () => (await navigator.clipboard.read()).some((item) => item.types.includes('image/png'))), true, 'JPG selection still copies a supported PNG image');
  await page.screenshot({ path: `${output}/studio-finish.png` });
  console.log('Snapshot checks passed: 16 compositions, image/content/finish controls, JPEG download and PNG clipboard.');
} finally {
  await browser.close();
  await api.close();
}
