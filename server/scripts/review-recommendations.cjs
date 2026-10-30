// Run from server/: node -r ts-node/register/transpile-only -r tsconfig-paths/register scripts/review-recommendations.cjs [--live | --feed] [--baseline COMMIT_SHA]
// Read-only: uses seed definitions and optional TMDB reads; never connects to the application database.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const Module = require('node:module');
const ts = require('typescript');
const { Logger } = require('@nestjs/common');
const { ConfigService } = require('@nestjs/config');
const { HttpService } = require('@nestjs/axios');
const { MoodsService } = require('../src/routes/moods/moods.service');
const { TMDBService } = require('../src/external-apis/services/tmdb.service');
const { TmdbRateLimiterService } = require('../src/external-apis/services/tmdb-rate-limiter.service');
const { profiles } = require('../src/routes/moods/mood-review.fixtures');
const { seedMoods } = require('../prisma/seed/moods.seed');
const { seededValue } = require('../src/utils/recommendation-ranking');

async function main() {
  Logger.overrideLogger(false);
  const baselineIndex = process.argv.indexOf('--baseline');
  const requestedReference = baselineIndex < 0 ? 'HEAD' : process.argv[baselineIndex + 1];
  if (baselineIndex >= 0 && !/^[a-f0-9]{7,40}$/i.test(requestedReference || '')) throw new Error('--baseline requires a commit SHA');
  const reference = execFileSync('git', ['rev-parse', '--verify', `${requestedReference}^{commit}`], { encoding: 'utf8' }).trim();
  const source = execFileSync('git', ['show', `${reference}:server/src/routes/moods/moods.service.ts`], { encoding: 'utf8' });
  const baselineModule = new Module(path.resolve('src/routes/moods/baseline.cjs'), module);
  baselineModule.filename = path.resolve('src/routes/moods/baseline.cjs');
  baselineModule.paths = module.paths;
  baselineModule._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true } }).outputText, baselineModule.filename);
  const baseline = new baselineModule.exports.MoodsService({}, {});
  const values = new Map();
  const cache = { getOrSet: async (key, _ttl, load) => {
    if (!values.has(key)) values.set(key, Promise.resolve().then(load).catch(error => { values.delete(key); throw error; }));
    return values.get(key);
  } };
  const feedOnly = process.argv.includes('--feed');
  const live = process.argv.includes('--live') || feedOnly;
  const env = live ? require('dotenv').parse(fs.readFileSync('.env')) : {};
  if (live && !env.TMDB_API_KEY) throw new Error('TMDB_API_KEY is not configured in server/.env');
  const limiter = live ? new TmdbRateLimiterService() : null;
  const tmdb = live ? new TMDBService(new HttpService(require('axios').create({ timeout: 8000 })), new ConfigService(env), limiter, cache) : {};
  const current = new MoodsService({}, tmdb, cache);
  const moods = [];
  const log = console.log;
  try {
    console.log = () => {};
    await seedMoods({ mood: { upsert: async ({ create }) => moods.push({ ...create, id: create.name.toLowerCase() }) } });
  } finally { console.log = log; }
  const rows = [];
  for (const [name, genres, overview] of profiles) {
    if (feedOnly) break;
    const mood = moods.find(item => item.name === name);
    const match = { id: 1, mediaType: 'movie', title: 'A story', overview, genre_ids: [...genres], original_language: 'en', popularity: 10, vote_average: 7.5, vote_count: 300, poster_path: '/poster', release_date: name === 'Nostalgic' ? '1995-01-01' : '2020-01-01', _source: 'discover' };
    const generic = { ...match, title: 'A case', overview: 'A lawyer investigates a case.', genre_ids: [18] };
    const before = baseline.scoreItem(match, mood), after = current.scoreItem(match, mood);
    const row = { mood: name, fixtureAcceptedBefore: baseline.hasAcceptableMoodGenreFit(before, mood), fixtureAcceptedAfter: current.hasAcceptableMoodGenreFit(after, mood), fixtureScoreBefore: before.score, fixtureScoreAfter: after.score, genericDramaAcceptedBefore: baseline.hasAcceptableMoodGenreFit(baseline.scoreItem(generic, mood), mood), genericDramaAcceptedAfter: current.hasAcceptableMoodGenreFit(current.scoreItem(generic, mood), mood) };
    if (live) {
      const start = performance.now();
      const candidates = current.removeDuplicateContent(await current.fetchCandidates(mood, { moodId: mood.id, mediaType: 'both' }));
      const rank = engine => candidates.filter(item => engine.passesHardFilters(item, { includeAdult: false }))
        .map(item => engine.scoreItem(item, mood)).filter(item => engine.hasAcceptableMoodGenreFit(item, mood)).sort((a, b) => b.score - a.score);
      const oldRanking = rank(baseline), newRanking = rank(current);
      row.live = { candidateCount: candidates.length, fetchMs: Math.round(performance.now() - start), qualifyingBefore: oldRanking.length, qualifyingAfter: newRanking.length,
        topBefore: oldRanking.slice(0, 10).map(item => ({ id: item.raw.id, type: item.raw.mediaType, title: item.raw.title || item.raw.name, score: item.score })),
        topAfter: newRanking.slice(0, 10).map(item => ({ id: item.raw.id, type: item.raw.mediaType, title: item.raw.title || item.raw.name, score: item.score })) };
      process.stderr.write(`${name}: ${candidates.length} candidates, ${newRanking.length} qualifying\n`);
    }
    rows.push(row);
  }
  const pool = Array.from({ length: 30 }, (_, id) => ({ tmdbId: id + 1, mediaType: 'MOVIE', score: 0.72, genreIds: [id % 5] }));
  const originalRandom = Math.random;
  let counter = 0;
  let oldFirst, oldSecond;
  try {
    Math.random = () => seededValue(String(counter++), 42);
    oldFirst = baseline.selectVariedRecommendations(pool, 10, true);
    oldSecond = baseline.selectVariedRecommendations(pool, 20, true).slice(10, 20);
  } finally { Math.random = originalRandom; }
  const ordered = current.selectVariedRecommendations(pool, 30, true, 42);
  const overlap = (a, b) => a.filter(item => b.some(other => other.tmdbId === item.tmdbId)).length;
  const report = { reference, mode: live ? 'same live candidate pool scored by both engines; not a user relevance study' : 'synthetic regression fixtures; not live catalogue quality', generatedAt: new Date().toISOString(), pagination: { duplicateTitlesBefore: overlap(oldFirst, oldSecond), duplicateTitlesAfter: overlap(ordered.slice(0, 10), ordered.slice(10, 20)), reportedFirstPageTotalBefore: oldFirst.length, reportedFirstPageTotalAfter: ordered.length }, moods: rows };
  if (feedOnly) {
    const { VideoFeedService } = require('../src/media/all/feed/video-feed.service');
    const { FeedUtilsService } = require('../src/media/all/feed/feed-utils.service');
    const { TmdbClientService } = require('../src/media/all/client/tmdb-client.service');
    const { VideoScoringService } = require('../src/media/all/videos/video-scoring.service');
    const utils = new FeedUtilsService(new TmdbClientService(tmdb, new ConfigService(env)), cache, new VideoScoringService());
    const feed = new VideoFeedService(cache, utils);
    let sourceCalls = 0;
    const originalFetch = utils.getCachedTmdb.bind(utils);
    utils.getCachedTmdb = async (...args) => { sourceCalls++; return originalFetch(...args); };
    report.feed = {};
    for (const upcoming of [false, true]) {
      const start = performance.now();
      const pool = await feed.getCandidatePool(undefined, upcoming);
      const coldMs = Math.round(performance.now() - start), callsBefore = sourceCalls;
      const warmStart = performance.now();
      await feed.getCandidatePool(undefined, upcoming);
      report.feed[upcoming ? 'upcoming' : 'mixed'] = { eligibleCandidates: pool.length, coldPoolMs: coldMs, warmPoolMs: Math.round(performance.now() - warmStart), warmSourceRequests: sourceCalls - callsBefore, languages: [...new Set(pool.map(item => item.original_language))].sort(), mediaTypes: [...new Set(pool.map(item => item.media_type))], titlesWithGenres: pool.filter(item => item.genres.length).length };
    }
  }
  const output = path.resolve('../artifacts/feed-mood-review', feedOnly ? 'feed-pool-comparison.json' : live ? 'live-comparison.json' : 'fixture-comparison.json');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ output, pagination: report.pagination, fixtureMatchesAccepted: rows.filter(row => row.fixtureAcceptedAfter).length, moods: rows.length, ...(report.feed ? { feed: report.feed } : {}) }));
  if (limiter) await limiter.limiter.stop({ dropWaitingJobs: true });
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
