import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import ts from "typescript";

// Compile the pure contract so this test also runs on Node 20 (without native TS support).
const source = readFileSync(
  new URL("../app/quiz/quiz-signals.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const {
  QUIZ_CATEGORIES,
  QUIZ_QUESTION_POOL,
  QUIZ_SIGNALS,
  createQuizSessionQuestions,
  getMoodMascotSrc,
  getQuizSessionQuestions,
} = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);

test("every session covers the same five viewing signals", () => {
  assert.deepEqual(
    QUIZ_SIGNALS.map((signal) => signal.category),
    ["feeling", "pace", "genre", "format", "commitment"],
  );
  assert.ok(QUIZ_SIGNALS.every((signal) => signal.options.length >= 3));
});
test("the question pool provides multiple valid prompts for every signal", () => {
  const ids = new Set();
  for (const category of QUIZ_CATEGORIES) {
    const variants = QUIZ_QUESTION_POOL.filter(
      (question) => question.category === category,
    );
    assert.ok(variants.length >= 4, `${category} needs at least four variants`);
    assert.ok(variants.every((question) => question.options.length >= 3));
    for (const question of variants) {
      assert.ok(!ids.has(question.id), `Duplicate question id: ${question.id}`);
      ids.add(question.id);
    }
  }
});
test("session generation chooses one question per signal and can be restored", () => {
  let value = 0;
  const questions = createQuizSessionQuestions(() => {
    value = (value + 0.173) % 1;
    return value;
  });
  assert.equal(questions.length, QUIZ_CATEGORIES.length);
  assert.deepEqual(
    [...questions.map((question) => question.category)].sort(),
    [...QUIZ_CATEGORIES].sort(),
  );
  assert.deepEqual(
    getQuizSessionQuestions(questions.map((question) => question.id)),
    questions,
  );
  assert.equal(getQuizSessionQuestions(["not-real"]), null);
});
test("every option and unknown mood resolves to an existing asset", () => {
  for (const mood of [
    ...QUIZ_QUESTION_POOL.flatMap((signal) =>
      signal.options.map((option) => option.mood),
    ),
    "light",
    "hopeful",
    "engaged",
    "cinematic",
    "patient",
    "balanced",
    "sophisticated",
    "not-a-real-mood",
    null,
  ]) {
    const src = getMoodMascotSrc(mood);
    assert.ok(
      existsSync(new URL(`../public${src}`, import.meta.url)),
      `Missing asset: ${src}`,
    );
  }
});
