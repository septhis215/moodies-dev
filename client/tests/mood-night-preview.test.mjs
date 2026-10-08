import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNightPreview, selectNightPreview } from '../components/sections/mood-night-data.ts';

const item = { id: 7, type: 'tv', title: 'A series', poster: '/poster.jpg', backdrop: '/backdrop.jpg' };
test('database preview preserves artwork and resolves trailer to a displayed pick', () => {
  assert.deepEqual(parseNightPreview({ items: [item], trailer: { item, key: 'abcdefghijk' } }), {
    items: [item], trailer: { item, key: 'abcdefghijk' }, trailers: [{ item, key: 'abcdefghijk' }],
  });
});

test('switching picks resolves their cached trailers by both media type and ID', () => {
  const movie = { ...item, type: 'movie', title: 'A film' };
  const artwork = { ...item, id: 8, title: 'No trailer' };
  const trailers = [{ item, key: 'abcdefghijk' }, { item: movie, key: 'lmnopqrstuv' }];
  const preview = parseNightPreview({ items: [item, movie, artwork], trailers });
  assert.equal(selectNightPreview(preview, 'tv-7').trailer.key, 'abcdefghijk');
  assert.equal(selectNightPreview(preview, 'movie-7').trailer.key, 'lmnopqrstuv');
  assert.equal(selectNightPreview(preview, 'tv-8').item.title, 'No trailer');
  assert.equal(selectNightPreview(preview, 'tv-8').trailer, null);
  assert.equal(selectNightPreview(preview, null).item.id, 7);
  assert.equal(selectNightPreview(null, 'tv-7').item, null);
});
test('unexpected trailer keys or titles outside the preview are ignored', () => {
  for (const trailer of [{ item, key: 'invalid' }, { item: { ...item, id: 8 }, key: 'abcdefghijk' }]) {
    assert.equal(parseNightPreview({ items: [item], trailer }).trailer, null);
  }
});
