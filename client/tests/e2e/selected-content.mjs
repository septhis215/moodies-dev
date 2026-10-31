import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium, expect } from 'playwright/test';
import { startDetailApi } from './fixtures/detail-api.mjs';
import { installMockTurnstile } from './fixtures/turnstile.mjs';

// Run against dev:local with its LOCAL_API_URL set to http://localhost:4000/api.
const api = await startDetailApi();
const browser = await chromium.launch({ headless: true });
const output = '../artifacts/selected-content-refresh';
await mkdir(output, { recursive: true });
let page;
try {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  await installMockTurnstile(context);
  await context.route('https://image.tmdb.org/**', async (route) => route.fulfill({ contentType: 'image/jpeg', body: await readFile(route.request().url().includes('backdrop') ? 'public/images/ironmanbg.jpg' : 'public/images/ironmanposter.jpeg') }));
  page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const [width, height] of [[320, 568], [390, 844], [768, 1024], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    await page.goto('http://localhost:3000/movies/550');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('A Different Kind of Sunday');
    await expect(page.getByRole('button', { name: 'Like', exact: true })).toBeEnabled();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `No page overflow at ${width}`);
    await expect(page.getByRole('button', { name: 'Show all 12 providers' })).toBeVisible();
    await page.getByRole('button', { name: 'Show all 12 providers' }).click();
    await expect(page.getByText('MUBI', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Show fewer providers' }).click();
    await expect(page.getByText('MUBI', { exact: true })).not.toBeVisible();
    await page.getByRole('button', { name: 'Show all 7 studios' }).click();
    await expect(page.getByText('Working Title', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Show fewer studios' }).click();
    await page.getByRole('button', { name: 'Write a review' }).first().click();
    const composer = page.getByRole('dialog', { name: 'Write a review' });
    await expect(composer).toBeVisible();
    assert.equal(await composer.evaluate((node) => [...node.querySelectorAll('form, form > div')].every((el) => el.scrollHeight <= el.clientHeight + 1)), true, `Composer fits without scrolling at ${width}`);
    await composer.getByRole('radio', { name: '0.5 out of 5 stars', exact: true }).check();
    await composer.getByRole('radio', { name: '0.5 out of 5 stars', exact: true }).press('ArrowRight');
    await expect(composer.getByRole('radio', { name: '1 out of 5 stars', exact: true })).toBeChecked();
    await composer.getByRole('radio', { name: '4.5 out of 5 stars', exact: true }).check();
    await composer.getByRole('radio', { name: 'Loved it', exact: true }).check();
    await expect(composer.locator('img[src*="review-icons"]')).toHaveCount(6);
    await composer.getByLabel('Your review', { exact: true }).fill('A thoughtful story with a great cast.');
    await page.screenshot({ path: `${output}/review-${width}.png` });
    if (width === 320) {
      await page.evaluate(() => {
        Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: 280 });
        window.visualViewport.dispatchEvent(new Event('resize'));
      });
      const submitBounds = await composer.getByRole('button', { name: 'Publish review' }).boundingBox();
      assert.ok(submitBounds.y + submitBounds.height <= 281, 'Review footer stays above a simulated mobile keyboard');
      await page.evaluate(() => {
        delete window.visualViewport.height;
        window.visualViewport.dispatchEvent(new Event('resize'));
      });
    }
    await page.keyboard.press('Escape');
    await expect(composer).not.toBeVisible();
    await page.getByRole('button', { name: 'Share content snapshot' }).click();
    const snapshot = page.getByRole('dialog', { name: 'Snapshot studio' });
    await expect(snapshot.getByRole('button', { name: 'Download' })).toBeEnabled({ timeout: 20_000 });
    assert.equal(await snapshot.evaluate((node) => node.scrollHeight <= node.clientHeight + 1 && [...node.querySelectorAll('aside')].every((el) => el.scrollHeight <= el.clientHeight + 1)), true, `Snapshot fits without scrolling at ${width}`);
    await expect(snapshot.getByRole('radio', { name: 'Editorial', exact: true })).toBeVisible();
    await snapshot.getByRole('radio', { name: 'Editorial', exact: true }).check();
    await expect(snapshot.getByRole('button', { name: 'Download' })).toBeEnabled();
    const size = await snapshot.locator('img[alt^="Snapshot of"]').evaluate((img) => ({ width: img.naturalWidth, height: img.naturalHeight }));
    assert.deepEqual(size, { width: 1080, height: 1350 });
    const previewBounds = await snapshot.locator('img[alt^="Snapshot of"]').boundingBox();
    assert.ok(previewBounds.height >= 100 && previewBounds.width >= 100, `Preview remains visible beside controls at ${width}`);
    await page.screenshot({ path: `${output}/snapshot-${width}.png` });
    await snapshot.getByRole('button', { name: 'Close snapshot' }).click();
    if (width === 1440) {
      await page.getByRole('button', { name: 'Share content snapshot' }).click();
      await snapshot.getByRole('radio', { name: 'Full bleed', exact: true }).check();
      await snapshot.getByRole('radio', { name: 'gold accent' }).check();
      await expect(snapshot.getByRole('button', { name: 'Download' })).toBeEnabled();
      await expect(snapshot.locator('img[alt^="Snapshot of"]')).toHaveJSProperty('naturalHeight', 1350);
      const exported = page.waitForEvent('download');
      await snapshot.getByRole('button', { name: 'Download' }).click();
      await (await exported).saveAs(`${output}/cinematic-export.png`);
      await snapshot.getByRole('button', { name: 'Close snapshot' }).click();
      await page.getByRole('heading', { name: 'Does this fit your mood?' }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${output}/audience-moods-desktop.png` });
      const reviewCard = page.locator('article').filter({ hasText: 'A beautifully observed story' }).first();
      const moodIcon = reviewCard.locator('img[src*="review-icons"]');
      await moodIcon.scrollIntoViewIfNeeded();
      await expect(moodIcon).toBeVisible();
      await expect.poll(() => moodIcon.evaluate((img) => img.naturalWidth)).toBeGreaterThan(0);
      await reviewCard.screenshot({ path: '../artifacts/snapshot-preview/review-card.png' });
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:3000/tv/1399');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('The Last Light');
  const status = page.locator('section[aria-labelledby="content-title"] [role="status"]');
  await expect(status).toContainText('12 likes');
  const startCalls = api.state.mutationCalls;
  await page.getByRole('button', { name: 'Like', exact: true }).evaluate((button) => { for (let i = 0; i < 10; i++) button.click(); });
  await expect(status).toContainText('13 likes');
  assert.equal(api.state.mutationCalls - startCalls, 1);
  await page.getByRole('button', { name: 'Liked', exact: true }).click();
  await expect(status).toContainText('12 likes');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(status).toContainText('9 saves');
  await page.getByRole('button', { name: 'Saved', exact: true }).click();
  await expect(status).toContainText('8 saves');
  api.state.failMutation = true;
  await page.getByRole('button', { name: 'Like', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Like', exact: true })).toBeEnabled();
  await expect(status).toContainText('12 likes');
  api.state.failMutation = false;
  await page.getByRole('button', { name: 'Write a review' }).first().click();
  const composer = page.getByRole('dialog', { name: 'Write a review' });
  await composer.getByRole('radio', { name: '4.5 out of 5 stars', exact: true }).check();
  await composer.getByRole('radio', { name: 'Enjoyed', exact: true }).check();
  await composer.getByLabel('Your review', { exact: true }).fill('A compelling series with excellent performances.');
  await composer.getByRole('button', { name: 'Publish review' }).click();
  await expect(composer).not.toBeVisible();
  await expect(status).toContainText('4 reviews');
  assert.equal(api.state.lastReview.rating, 9, 'Half-star rating is submitted using the database 1–10 scale');

  await page.getByRole('button', { name: 'Share review by Alex', exact: true }).click();
  const reviewSnapshot = page.getByRole('dialog', { name: 'Snapshot studio' });
  await expect(reviewSnapshot.getByRole('button', { name: 'Download', exact: true })).toBeEnabled();
  await expect(reviewSnapshot.getByText('This image includes your private review.', { exact: false })).toBeVisible();
  await expect(reviewSnapshot.locator('input[type="text"], textarea')).toHaveCount(0);
  await expect(reviewSnapshot.getByRole('checkbox')).toHaveCount(0);
  await reviewSnapshot.getByRole('radio', { name: 'The ticket', exact: true }).check();
  await expect(reviewSnapshot.getByRole('button', { name: 'Download', exact: true })).toBeEnabled();
  await reviewSnapshot.getByRole('button', { name: 'Close snapshot', exact: true }).click();

  // Native dialog focus containment, short drags, and mobile-only swipe dismissal.
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.getByRole('button', { name: 'Write a review' }).first().click();
  await expect(composer).toBeVisible();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    // Native dialogs may cycle through browser chrome (body), never the underlying page.
    assert.equal(await page.evaluate(() => document.activeElement === document.body || Boolean(document.activeElement?.closest('dialog[open]'))), true);
  }
  const header = await composer.locator('header').boundingBox();
  await page.mouse.move(header.x + 60, header.y + 20);
  await page.mouse.down();
  await page.mouse.move(header.x + 60, header.y + 42, { steps: 8 });
  await page.mouse.up();
  await expect(composer).toBeVisible();
  await page.waitForTimeout(250);
  await page.mouse.move(header.x + 60, header.y + 20);
  await page.mouse.down();
  await page.mouse.move(header.x + 60, header.y + 170, { steps: 10 });
  await page.mouse.up();
  await expect(composer).not.toBeVisible();

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: 'Write a review' }).first().click();
  const desktopHeader = await composer.locator('header').boundingBox();
  await page.mouse.move(desktopHeader.x + 60, desktopHeader.y + 20);
  await page.mouse.down();
  await page.mouse.move(desktopHeader.x + 60, desktopHeader.y + 180, { steps: 10 });
  await page.mouse.up();
  await expect(composer).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(composer).not.toBeVisible();

  api.state.failStats = true;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('button', { name: 'Counts unavailable · Retry' })).toBeVisible();
  api.state.failStats = false;
  await page.getByRole('button', { name: 'Counts unavailable · Retry' }).click();
  await expect(status).toContainText('12 likes');
  await page.goto('http://localhost:3000/movies/550/reviews');
  await page.getByRole('button', { name: 'Write a review' }).first().click();
  await expect(page.getByRole('dialog', { name: 'Write a review' })).toBeVisible();
  await page.keyboard.press('Escape');
  api.state.anonymous = true;
  await page.goto('http://localhost:3000/movies/550');
  await page.getByRole('button', { name: 'Like', exact: true }).click();
  await expect(page).toHaveURL(/\/auth\/login/);
  assert.equal(api.state.likes, 12);
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log('Selected-content browser checks passed at 320, 390, 768 and 1440px.');
} catch (error) {
  if (page && !page.isClosed()) await page.screenshot({ path: `${output}/failure.png`, fullPage: true });
  throw error;
} finally {
  await browser.close();
  await api.close();
}
