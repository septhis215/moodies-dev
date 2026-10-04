import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

// Run the real service contract independently of the workspace's mismatched Jest runtime.
const require = createRequire(import.meta.url);
const compiled = ts.transpileModule(
  readFileSync(
    new URL('../src/routes/search/search.service.ts', import.meta.url),
    'utf8',
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      experimentalDecorators: true,
      emitDecoratorMetadata: false,
    },
  },
).outputText;
const module = { exports: {} };
new Function('require', 'module', 'exports', compiled)(
  require,
  module,
  module.exports,
);
const { SearchService } = module.exports;

function serviceFor(responder) {
  const calls = [];
  const service = new SearchService(
    {
      request: async (endpoint, options) => {
        calls.push({ endpoint, params: options.params });
        return responder(endpoint);
      },
    },
    { get: () => 'test-token' },
  );
  return { service, calls };
}

for (const type of ['movie', 'tv']) {
  test(`filtered ${type} search keeps its title query`, async () => {
    const { service, calls } = serviceFor(() => ({
      results: [
        {
          id: 1,
          title: 'Bad Film',
          name: 'Bad Series',
          release_date: '1966-01-01',
          vote_average: 8,
        },
      ],
      total_results: 100,
      total_pages: 5,
    }));
    const result = await service.search({
      query: 'bad',
      type,
      year_min: 1960,
      rating_min: 7,
    });
    assert.equal(calls[0].endpoint, `/search/${type}`);
    assert.equal(calls[0].params.query, 'bad');
    assert.equal(result.results.length, 1);
    assert.equal(result.total_results_scope, 'before_filters');
  });
}
test('merged pages do not drop their last forty results', async () => {
  const { service } = serviceFor(() => ({
    results: Array.from({ length: 20 }, (_, id) => ({
      id,
      title: 'Bad Film',
      name: 'Bad Person',
      vote_average: 8,
    })),
    total_results: 20,
    total_pages: 1,
  }));
  assert.equal(
    (await service.search({ query: 'bad', type: 'all' })).results.length,
    60,
  );
});
test('active year filters reject missing dates', async () => {
  const { service } = serviceFor(() => ({
    results: [{ id: 1, title: 'Bad Film', vote_average: 8 }],
    total_results: 1,
    total_pages: 1,
  }));
  assert.equal(
    (await service.search({ query: 'bad', type: 'movie', year_min: 1960 }))
      .results.length,
    0,
  );
});
test('discovery matches any selected genre', async () => {
  const { service, calls } = serviceFor((endpoint) =>
    endpoint.startsWith('/genre/')
      ? {
          genres: [
            { id: 80, name: 'Crime' },
            { id: 18, name: 'Drama' },
          ],
        }
      : { results: [], total_results: 0, total_pages: 0 },
  );
  await service.loadGenres();
  await service.discover({ type: 'movie', genres: 'Crime,Drama' });
  assert.equal(
    calls.find((call) => call.endpoint === '/discover/movie').params
      .with_genres,
    '80|18',
  );
});
