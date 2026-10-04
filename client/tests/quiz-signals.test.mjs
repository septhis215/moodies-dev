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
const { QUIZ_SIGNALS, getMoodMascotSrc } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);

test("every session covers the same five viewing signals", () => {
  assert.deepEqual(
    QUIZ_SIGNALS.map((signal) => signal.category),
    ["feeling", "pace", "genre", "format", "commitment"],
  );
  assert.ok(QUIZ_SIGNALS.every((signal) => signal.options.length >= 3));
});
test("every option and unknown mood resolves to an existing asset", () => {
  for (const mood of [
    ...QUIZ_SIGNALS.flatMap((signal) =>
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
