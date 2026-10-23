import assert from "node:assert/strict";
import { chromium } from "playwright";
import { QUIZ_CATEGORIES, QUIZ_QUESTION_POOL } from "../../app/quiz/quiz-signals.ts";

const base = process.env.BASE_URL || "http://127.0.0.1:3000";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.route("**/api/**", route => route.fulfill({ json: [] }));
  await page.goto(`${base}/quiz`, { waitUntil: "domcontentloaded" });
  for (const [width, height] of [[320, 568], [375, 667], [390, 844]]) {
    await page.setViewportSize({ width, height });
    for (const question of QUIZ_QUESTION_POOL) {
      const questions = QUIZ_CATEGORIES.map(category => category === question.category
        ? question : QUIZ_QUESTION_POOL.find(item => item.category === category));
      const current = questions.findIndex(item => item.id === question.id);
      await page.evaluate(saved => sessionStorage.setItem("moodies:quiz:signal-reel:v2", JSON.stringify(saved)), {
        questionIds: questions.map(item => item.id), current, answers: questions.map(() => null),
      });
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.getByRole("heading", { name: question.question, exact: true }).waitFor();
      const options = page.getByRole("group", { name: "Answer choices" }).getByRole("button");
      assert.equal(await options.count(), question.options.length);
      const next = page.getByRole("button", { name: current === 4 ? "Find my matches" : "Continue", exact: true });
      const assertFits = async locator => {
        const box = await locator.boundingBox();
        assert.ok(box && box.y >= 61 && box.y + box.height <= height + 1,
          `${question.id} at ${width}×${height}: content outside viewport ${JSON.stringify(box)}`);
      };
      await assertFits(page.getByRole("heading", { name: question.question, exact: true }));
      for (const option of await options.all()) {
        await assertFits(option);
        const box = await option.boundingBox();
        assert.ok(box.height >= 44, "Answers retain touch targets");
      }
      await assertFits(next);
      assert.ok(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1),
        `${question.id} at ${width}×${height}: page requires scrolling`);
      await options.first().click();
      await assertFits(next);
      assert.ok(await next.isEnabled());
      assert.ok(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1),
        "Selecting an answer must not add overflow");
    }
    console.log(`All ${QUIZ_QUESTION_POOL.length} questions fit at ${width}×${height}`);
  }
} finally {
  await browser.close();
}
