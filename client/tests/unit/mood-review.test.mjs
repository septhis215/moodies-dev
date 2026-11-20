import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../../lib/moodReview.server.ts', import.meta.url), 'utf8');
function load(fetch = () => { throw new Error('Unexpected fetch'); }) {
  const testModule = { exports: {} };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { module: testModule, exports: testModule.exports, URL, fetch });
  return testModule.exports.withMoodReview;
}
const review = (id, mood = 'loved', count = 0, content = 'A memorable watch.') => ({
  id, content, moodEmojis: [mood], user: { username: 'Alex' }, createdAt: '2026-11-19', reactionCounts: [{ count }], replies: [],
});
const response = (reviews = []) => ({ reviews, topMoods: [{ emoji: 'loved', count: 4 }, { emoji: 'other', count: 1 }], pagination: { page: 1, totalPages: 1 } });

test('legacy API response shows its most popular written review matching the displayed mood', async () => {
  const data = response([review('other', 'other', 100), review('empty', 'loved', 90, ' '), review('winner', 'loved', 3), review('quiet')]);
  const result = await load()(data, 'https://api.example/reviews?page=1&limit=10');
  assert.equal(result.moodReview.id, 'winner');
  assert.equal(result.reviews, data.reviews);
});

test('uses reply reactions and deterministic ties to match server popularity', async () => {
  const older = { ...review('older', 'loved', 3), createdAt: '2026-01-01' };
  const winner = { ...review('a'), replies: [{ reactionCounts: [{ count: 2 }] }] };
  assert.equal((await load()(response([older, { ...winner, id: 'b' }, winner]), 'https://api.example/reviews')).moodReview.id, 'a');
});

test('fetches older pages so a quote beyond the first page can win', async () => {
  const calls = [];
  const data = response([review('first')]);
  data.pagination.totalPages = 2;
  const result = await load(async (url, options) => {
    calls.push([String(url), options.cache]);
    return { ok: true, json: async () => response([review('older-winner', 'loved', 8)]) };
  })(data, 'https://api.example/reviews?page=1&limit=10');
  assert.equal(result.moodReview.id, 'older-winner');
  assert.deepEqual(calls, [['https://api.example/reviews?page=2&limit=10', 'no-store']]);
});

test('preserves the new API field, including an intentional null', async () => {
  const winner = review('server-choice');
  assert.equal((await load()({ ...response(), moodReview: winner }, 'unused')).moodReview, winner);
  assert.equal((await load()({ ...response(), moodReview: null }, 'unused')).moodReview, null);
});

test('handles empty or unmatched moods without inventing a review', async () => {
  assert.equal((await load()({ ...response(), topMoods: [] }, 'unused')).moodReview, null);
  assert.equal((await load()(response([review('other', 'other')]), 'unused')).moodReview, null);
});

test('a later page failure preserves the loaded reviews and omits an unverified quote', async () => {
  const data = response([review('first')]);
  data.pagination.totalPages = 2;
  for (const fetch of [async () => ({ ok: false }), async () => { throw new Error('Offline'); }]) {
    const result = await load(fetch)(data, 'https://api.example/reviews?page=1');
    assert.equal(result.reviews, data.reviews);
    assert.equal(result.moodReview, null);
  }
});
