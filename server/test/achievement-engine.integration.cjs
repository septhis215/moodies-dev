// Destructive setup is restricted to the named disposable localhost test database.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const { PrismaClient } = require('@prisma/client');
const root = path.resolve(__dirname, '..');
require('tsconfig-paths').register({
  baseUrl: path.join(root, 'dist'),
  paths: { 'src/*': ['*'] },
});
const { ConfigService } = require('@nestjs/config');
const {
  AchievementCatalogService,
} = require('../dist/achievements/achievement-catalog.service');
const {
  AchievementEvidenceService,
} = require('../dist/achievements/achievement-evidence.service');
const {
  AchievementProcessorService,
} = require('../dist/achievements/achievement-processor.service');
const {
  AchievementWorkerService,
} = require('../dist/achievements/achievement-worker.service');
const { WatchlistService } = require('../dist/watchlist/watchlist.service');
const {
  AchievementsService,
} = require('../dist/achievements/achievements.service');
const {
  AchievementOperationsService,
} = require('../dist/achievements/achievement-operations.service');
const { randomUUID } = require('node:crypto');
const url =
  process.env.ACHIEVEMENT_TEST_DATABASE_URL ||
  'postgresql://postgres:achievement-test-only@127.0.0.1:55438/moodies_achievement_test';
const target = new URL(url);
assert.equal(target.hostname, '127.0.0.1');
assert.equal(target.port, '55438');
assert.equal(target.pathname, '/moodies_achievement_test');
const db = new Client({ connectionString: url });
const prisma = new PrismaClient({ datasources: { db: { url } } });
let providerFails = false;
const redis = { getOrSet: async (_key, _ttl, load) => load() };
const tmdb = {
  request: async (endpoint) => {
    if (providerFails) throw new Error('Fixture provider unavailable');
    const id = Number(endpoint.split('/')[1]);
    return {
      id,
      title: `Film ${id}`,
      genres: [{ id: 27 }, { id: 18 }],
      production_countries: [{ iso_3166_1: 'KR' }],
      vote_average: 8,
      vote_count: 300,
      popularity: 10,
      adult: false,
    };
  },
};
const catalogue = new AchievementCatalogService(prisma, redis);
const evidence = new AchievementEvidenceService(prisma, tmdb);
const processor = new AchievementProcessorService(prisma, catalogue, evidence);
const worker = new AchievementWorkerService(
  prisma,
  processor,
  evidence,
  new ConfigService(),
);
const secondWorker = new AchievementWorkerService(
  prisma,
  processor,
  evidence,
  new ConfigService(),
);
const watchlist = new WatchlistService(prisma);
const service = new AchievementsService(
  prisma,
  catalogue,
  evidence,
  new ConfigService({
    ACHIEVEMENTS_ENABLED: 'true',
    JWT_SECRET: 'isolated-achievement-test-secret',
  }),
);
const ops = new AchievementOperationsService(prisma, catalogue);
async function drain() {
  for (let i = 0; i < 300; i++) if (!(await worker.runBatch())) return;
  throw new Error('Worker did not drain');
}
async function createUser(id) {
  return prisma.user.create({
    data: { id, username: id, name: 'Test user', email: `${id}@example.test` },
  });
}
async function progress(userId, key) {
  return prisma.userAchievement.findFirst({
    where: { userId, achievement: { key } },
  });
}
async function check(name, run) {
  await run();
  console.log(`PASS ${name}`);
}

(async () => {
  await db.connect();
  assert.equal(
    (await db.query('SELECT current_database() AS name')).rows[0].name,
    'moodies_achievement_test',
  );
  await db.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  // Model Supabase's legacy defaults: browser roles receive grants on new tables/functions.
  await db.query(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  END $$;
  GRANT USAGE ON SCHEMA public TO anon,authenticated;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon,authenticated;`);
  await db.query(
    fs.readFileSync(
      path.join(__dirname, 'fixtures/achievement-baseline.sql'),
      'utf8',
    ),
  );
  await db.query(
    fs.readFileSync(
      path.join(
        root,
        'prisma/migrations/20261101090000_production_achievements/migration.sql',
      ),
      'utf8',
    ),
  );
  const seed = fs.readFileSync(
    path.join(
      root,
      'prisma/migrations/20261101090100_achievement_catalog/migration.sql',
    ),
    'utf8',
  );
  await db.query(seed);
  await db.query(seed);
  const security = fs.readFileSync(
    path.join(
      root,
      'prisma/migrations/20261101090200_achievement_data_api_security/migration.sql',
    ),
    'utf8',
  );
  const recovery = fs.readFileSync(
    path.join(root, 'prisma/manual/achievement_catalog_recovery.sql'),
    'utf8',
  );
  await check(
    'an editor-appended ALTER TABLE a reproduces 42P01 without requiring data deletion',
    async () => {
      await assert.rejects(
        db.query(seed + '\nALTER TABLE public.a ENABLE ROW LEVEL SECURITY;'),
        (error) =>
          error.code === '42P01' &&
          /relation "public.a" does not exist/.test(error.message),
      );
      assert.equal(await prisma.achievement.count(), 40);
    },
  );
  await db.query(security);
  await db.query(security);
  await check(
    'Supabase browser roles cannot access private achievement tables or RPCs',
    async () => {
      const privileges = (
        await db.query(`SELECT has_table_privilege('anon','public.achievement_events','SELECT') AS readable,
      has_function_privilege('authenticated','public.achievement_metrics(text,text)','EXECUTE') AS callable`)
      ).rows[0];
      assert.equal(privileges.readable, false);
      assert.equal(privileges.callable, false);
      const tables = [
        'achievement_rule_versions',
        'achievement_accounts',
        'achievement_events',
        'achievement_facts',
        'achievement_metrics',
        'achievement_award_log',
        'achievement_notifications',
        'watched_titles',
        'quiz_completions',
        'achievement_title_snapshots',
        'achievement_trend_snapshots',
        'achievements',
        'badge_definitions',
        'user_achievements',
        'Quiz',
        'mood_logs',
      ];
      for (const table of tables) {
        const target = `public."${table}"`;
        assert.equal(
          (
            await db.query(
              'SELECT relrowsecurity FROM pg_class WHERE oid=$1::regclass',
              [target],
            )
          ).rows[0].relrowsecurity,
          true,
          table,
        );
        for (const role of ['anon', 'authenticated']) {
          assert.equal(
            (
              await db.query(
                "SELECT has_table_privilege($1,$2,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS allowed",
                [role, target],
              )
            ).rows[0].allowed,
            false,
            `${role}:${table}`,
          );
        }
      }
      for (const role of ['anon', 'authenticated']) {
        await db.query(`SET ROLE ${role}`);
        try {
          await assert.rejects(
            db.query('SELECT * FROM public.achievement_events'),
            (error) => error.code === '42501',
          );
          await assert.rejects(
            db.query("SELECT public.achievement_metrics('private-user','all')"),
            (error) => error.code === '42501',
          );
        } finally {
          await db.query('RESET ROLE');
        }
      }
    },
  );
  await check(
    'secured recovery is rerunnable and preserves existing awards',
    async () => {
      await createUser('rls-user');
      const achievement = await prisma.achievement.findUnique({
        where: { key: 'first-mood' },
      });
      const original = await prisma.userAchievement.create({
        data: {
          userId: 'rls-user',
          achievementId: achievement.id,
          unlocked: true,
          unlockedAt: new Date(),
          currentProgress: 1,
          completionPercentage: 100,
        },
      });
      await db.query(recovery);
      await db.query(recovery);
      assert.equal(
        (
          await prisma.userAchievement.findUnique({
            where: { id: original.id },
          })
        ).unlocked,
        true,
      );
      assert.equal(
        await prisma.achievementAwardLog.count({
          where: { idempotencyKey: `legacy:${original.id}` },
        }),
        1,
      );
      assert.equal(
        (await db.query("SELECT to_regclass('public.a') AS unwanted")).rows[0]
          .unwanted,
        null,
      );
      // RLS still hides real account data even if an accidental future SELECT grant is added.
      await db.query(
        'GRANT SELECT ON public.achievement_events TO anon,authenticated',
      );
      for (const role of ['anon', 'authenticated']) {
        await db.query(`SET ROLE ${role}`);
        try {
          assert.deepEqual(
            (await db.query('SELECT * FROM public.achievement_events')).rows,
            [],
          );
        } finally {
          await db.query('RESET ROLE');
        }
      }
      await db.query(security);
      await prisma.user.delete({ where: { id: 'rls-user' } });
    },
  );
  await check(
    'both SQL migrations and idempotent catalogue publishing',
    async () => assert.equal(await prisma.achievement.count(), 40),
  );
  await check('rule snapshots are immutable', async () => {
    await assert.rejects(
      db.query(`UPDATE achievement_rule_versions SET target='invented'`),
      /immutable/,
    );
  });
  await check(
    'the Prisma seed and SQL catalogue publish identical frozen definitions',
    async () => {
      require('ts-node').register({
        skipProject: true,
        transpileOnly: true,
        compilerOptions: { module: 'CommonJS', moduleResolution: 'node' },
      });
      const {
        seedAchievements,
      } = require('../prisma/seed/achievements.seed.ts');
      await seedAchievements(prisma);
      assert.equal((await catalogue.published()).length, 40);
      assert.equal(await prisma.achievementRuleVersion.count(), 40);
    },
  );
  await check(
    'every published quiz option satisfies the server completion contract',
    async () => {
      const {
        QUIZ_QUESTION_POOL,
        QUIZ_CATEGORIES,
      } = require('../../client/app/quiz/quiz-signals.ts');
      const defaults = QUIZ_CATEGORIES.map((category) => {
        const question = QUIZ_QUESTION_POOL.find(
          (item) => item.category === category,
        );
        return { ...question.options[0], category };
      });
      for (const question of QUIZ_QUESTION_POOL)
        for (const option of question.options) {
          const answers = defaults.map((answer) =>
            answer.category === question.category
              ? { ...option, category: question.category }
              : answer,
          );
          assert.ok(
            service.createQuizReceipt(answers, randomUUID(), 'signal-reel-v2'),
          );
        }
    },
  );
  await createUser('engine-user');
  await drain();
  await check(
    'source commit creates an audited award and notification',
    async () => {
      assert.equal(
        (await progress('engine-user', 'profile-basic')).unlocked,
        true,
      );
      assert.equal(
        await prisma.achievementAwardLog.count({
          where: { userId: 'engine-user' },
        }),
        1,
      );
      assert.equal(
        await prisma.achievementNotification.count({
          where: { userId: 'engine-user' },
        }),
        1,
      );
    },
  );
  await check(
    'rolled back source actions cannot produce awards or events',
    async () => {
      const before = await prisma.achievementEvent.count();
      await assert.rejects(
        prisma.$transaction(async (tx) => {
          await tx.likedItem.create({
            data: { userId: 'engine-user', tmdbId: 99, mediaType: 'MOVIE' },
          });
          throw new Error('rollback');
        }),
        /rollback/,
      );
      assert.equal(await prisma.achievementEvent.count(), before);
    },
  );
  await check(
    'concurrent save requests and duplicate retries count distinct titles',
    async () => {
      await Promise.all(
        [1, 2, 3, 4].map((id) =>
          watchlist.toggle('engine-user', String(id), 'movie', true),
        ),
      );
      for (let id = 5; id <= 20; id++)
        await watchlist.toggle('engine-user', String(id), 'movie', true);
      await watchlist.toggle('engine-user', '20', 'movie', true);
      await Promise.all([worker.runBatch(), secondWorker.runBatch()]);
      await drain();
      assert.equal(
        (await progress('engine-user', 'twenty-saves')).unlocked,
        true,
      );
      assert.equal(
        await prisma.achievementFact.count({
          where: { userId: 'engine-user', metric: 'horror_titles' },
        }),
        20,
      );
    },
  );
  await check(
    'bulk clear emits one snapshot and does not revoke earned milestones',
    async () => {
      const before = await prisma.achievementEvent.count();
      await watchlist.clear('engine-user');
      assert.equal(await prisma.achievementEvent.count(), before + 1);
      await drain();
      assert.equal(
        (await progress('engine-user', 'twenty-saves')).unlocked,
        true,
      );
      assert.equal(
        (await progress('engine-user', 'hundred-saves')).currentProgress,
        0,
      );
    },
  );
  await check(
    'replayed deliveries never duplicate grants or notifications',
    async () => {
      const before = await prisma.achievementAwardLog.count();
      const notes = await prisma.achievementNotification.count();
      const event = await prisma.achievementEvent.findFirst({
        where: { userId: 'engine-user', kind: 'metrics' },
        orderBy: { sequence: 'asc' },
      });
      await prisma.achievementEvent.update({
        where: { id: event.id },
        data: { status: 'pending', availableAt: new Date() },
      });
      await drain();
      assert.equal(await prisma.achievementAwardLog.count(), before);
      assert.equal(await prisma.achievementNotification.count(), notes);
    },
  );
  await check(
    'provider outages defer classification while ordinary progress continues',
    async () => {
      providerFails = true;
      await watchlist.toggle('engine-user', '777', 'movie', true);
      await drain();
      await prisma.likedItem.create({
        data: { userId: 'engine-user', tmdbId: 778, mediaType: 'MOVIE' },
      });
      await drain();
      assert.equal(
        (await progress('engine-user', 'first-like')).unlocked,
        true,
      );
      assert.ok(
        await prisma.achievementEvent.count({
          where: { userId: 'engine-user', kind: 'classify', status: 'pending' },
        }),
      );
      providerFails = false;
      await prisma.achievementEvent.updateMany({
        where: { kind: 'classify', status: 'pending' },
        data: { availableAt: new Date() },
      });
      await drain();
    },
  );
  await check(
    'expired worker claims recover and stale owners cannot commit',
    async () => {
      await createUser('recovery-user');
      const event = await prisma.achievementEvent.findFirst({
        where: { userId: 'recovery-user' },
      });
      await prisma.achievementEvent.update({
        where: { id: event.id },
        data: {
          status: 'processing',
          leaseToken: 'old-owner',
          leaseUntil: new Date(0),
        },
      });
      await drain();
      await processor.process(event, 'old-owner');
      assert.equal(
        (await progress('recovery-user', 'profile-basic')).unlocked,
        true,
      );
      assert.equal(
        await prisma.achievementAwardLog.count({
          where: { userId: 'recovery-user' },
        }),
        1,
      );
    },
  );
  await check(
    'current catalogue reads resolve forty genuine goals without placeholders',
    async () => {
      const state = await catalogue.getMe('engine-user');
      assert.equal(state.totalCount, 39); // No moods seeded in this isolated fixture.
      assert.equal(
        state.achievements.find((row) => row.achievement.key === 'twenty-saves')
          .progress.completionPercentage,
        100,
      );
    },
  );
  await createUser('activity-user');
  await drain();
  await check(
    'queueing activity invalidates cached progress before the worker runs',
    async () => {
      const cache = new Map();
      const cachedCatalogue = new AchievementCatalogService(prisma, {
        getOrSet: async (key, _ttl, load) => {
          if (!cache.has(key)) cache.set(key, await load());
          return cache.get(key);
        },
      });
      assert.equal(
        (await cachedCatalogue.getMe('activity-user')).pending,
        false,
      );
      await db.query(
        "SELECT achievement_emit($1,'reconcile','cache-invalidation-fixture','{}'::jsonb)",
        ['activity-user'],
      );
      assert.equal(
        (await cachedCatalogue.getMe('activity-user')).pending,
        true,
      );
      await drain();
      assert.equal(
        (await cachedCatalogue.getMe('activity-user')).pending,
        false,
      );
    },
  );
  await check(
    'foreground visits deduplicate and retain their original timezone',
    async () => {
      await service.activity('activity-user', {
        kind: 'visit',
        timezone: 'Asia/Kuala_Lumpur',
      });
      await service.activity('activity-user', {
        kind: 'visit',
        timezone: 'America/New_York',
      });
      assert.equal(
        (
          await prisma.achievementAccount.findUnique({
            where: { userId: 'activity-user' },
          })
        ).timezone,
        'Asia/Kuala_Lumpur',
      );
      assert.equal(
        await prisma.achievementEvent.count({
          where: { userId: 'activity-user', kind: 'visit' },
        }),
        1,
      );
      const visit = await prisma.achievementEvent.findFirst({
        where: { userId: 'activity-user', kind: 'visit' },
      });
      assert.equal(visit.payload.timezone, 'Asia/Kuala_Lumpur');
      await ops.timezone(
        'activity-user',
        'UTC',
        'integration',
        'Test future-only timezone correction',
      );
      await drain();
      const {
        calendarKeys,
      } = require('../dist/achievements/achievement-rules');
      assert.ok(
        await prisma.achievementFact.findUnique({
          where: {
            userId_metric_key: {
              userId: 'activity-user',
              metric: 'visit_days',
              key: calendarKeys(visit.occurredAt, 'Asia/Kuala_Lumpur').date,
            },
          },
        }),
      );
    },
  );
  await check(
    'watched records are explicit, idempotent and preserve earned awards when removed',
    async () => {
      assert.equal(
        (await service.watched('activity-user', 'movie', 800)).watched,
        false,
      );
      await service.setWatched('activity-user', 'movie', 800, true);
      await service.setWatched('activity-user', 'movie', 800, true);
      await drain();
      assert.equal(
        await prisma.watchedTitle.count({ where: { userId: 'activity-user' } }),
        1,
      );
      assert.equal(
        (await progress('activity-user', 'first-movie')).unlocked,
        true,
      );
      await service.setWatched('activity-user', 'movie', 800, false);
      await drain();
      assert.equal(
        (await progress('activity-user', 'ten-movies')).currentProgress,
        0,
      );
      assert.equal(
        (await progress('activity-user', 'first-movie')).unlocked,
        true,
      );
    },
  );
  await check(
    'only explicit active mood choices count once per local day and mood',
    async () => {
      await prisma.mood.create({
        data: {
          id: 'fixture-mood',
          name: 'Fixture mood',
          color: '#fff',
          icon: 'test',
          description: 'Fixture',
          keywords: [],
          tmdbGenres: [],
        },
      });
      await service.activity('activity-user', {
        kind: 'mood',
        moodId: 'fixture-mood',
      });
      await service.activity('activity-user', {
        kind: 'mood',
        moodId: 'fixture-mood',
      });
      await drain();
      assert.equal(
        await prisma.moodLog.count({ where: { userId: 'activity-user' } }),
        1,
      );
      assert.equal(
        (await progress('activity-user', 'first-mood')).unlocked,
        true,
      );
      await assert.rejects(
        service.activity('activity-user', { kind: 'mood', moodId: 'missing' }),
        /not available/,
      );
    },
  );
  await check(
    'quiz receipts reject tampering and incomplete attempts, and count at most once daily',
    async () => {
      const answers = [
        { category: 'feeling', mood: 'cozy', genres: [] },
        { category: 'pace', mood: '', genres: [], pace: 'balanced' },
        { category: 'genre', mood: '', genres: ['drama'] },
        { category: 'format', mood: '', genres: [], mediaType: 'movie' },
        {
          category: 'commitment',
          mood: '',
          genres: [],
          commitment: 'standard',
        },
      ];
      const attempt = randomUUID(),
        version = 'signal-reel-v2';
      assert.throws(
        () => service.createQuizReceipt(answers.slice(1), attempt, version),
        /Complete the current quiz/,
      );
      const receipt = service.createQuizReceipt(answers, attempt, version);
      await assert.rejects(
        service.recordQuiz(
          'activity-user',
          answers,
          randomUUID(),
          version,
          receipt,
        ),
        /fresh quiz results/,
      );
      await assert.rejects(
        service.recordQuiz(
          'activity-user',
          answers,
          attempt,
          version,
          receipt + '0',
        ),
        /fresh quiz results/,
      );
      assert.equal(
        (
          await service.recordQuiz(
            'activity-user',
            answers,
            attempt,
            version,
            receipt,
          )
        ).counted,
        true,
      );
      assert.equal(
        (
          await service.recordQuiz(
            'activity-user',
            answers,
            attempt,
            version,
            receipt,
          )
        ).counted,
        false,
      );
      const second = randomUUID();
      assert.equal(
        (
          await service.recordQuiz(
            'activity-user',
            answers,
            second,
            version,
            service.createQuizReceipt(answers, second, version),
          )
        ).counted,
        false,
      );
      await drain();
      assert.equal(
        (await progress('activity-user', 'first-quiz')).unlocked,
        true,
      );
      assert.equal(
        await prisma.quizCompletion.count({
          where: { userId: 'activity-user' },
        }),
        1,
      );
      assert.equal(
        await prisma.quiz.count({ where: { userId: 'activity-user' } }),
        1,
      );
    },
  );
  await check(
    'detail activity deduplicates titles and enforces a server-side recording interval',
    async () => {
      await service.activity('activity-user', {
        kind: 'detail',
        type: 'movie',
        tmdbId: 850,
      });
      await service.activity('activity-user', {
        kind: 'detail',
        type: 'movie',
        tmdbId: 850,
      });
      await assert.rejects(
        service.activity('activity-user', {
          kind: 'detail',
          type: 'movie',
          tmdbId: 851,
        }),
        /wait before recording/,
      );
      await drain();
      assert.equal(
        (await progress('activity-user', 'deep-diver')).currentProgress,
        1,
      );
    },
  );
  await check(
    'notification claims are exclusive and acknowledgements remain owner-scoped',
    async () => {
      const claims = await Promise.all([
        service.claimNotifications('activity-user'),
        service.claimNotifications('activity-user'),
      ]);
      const all = claims.flatMap((claim) =>
        claim.notifications.map((note) => note.id),
      );
      assert.equal(new Set(all).size, all.length);
      const claimed = claims.find((claim) => claim.notifications.length),
        note = claimed.notifications[0];
      assert.equal(
        (await service.acknowledge('recovery-user', note.id, claimed.token))
          .acknowledged,
        false,
      );
      assert.equal(
        (await service.acknowledge('activity-user', note.id, randomUUID()))
          .acknowledged,
        false,
      );
      assert.equal(
        (await service.acknowledge('activity-user', note.id, claimed.token))
          .acknowledged,
        true,
      );
      assert.equal(
        (await service.acknowledge('activity-user', note.id, claimed.token))
          .acknowledged,
        false,
      );
    },
  );
  await check(
    'moderation excludes unpublished reviews and self-reactions from live counts',
    async () => {
      const review = await prisma.review.create({
        data: {
          userId: 'activity-user',
          tmdbId: 900,
          mediaType: 'MOVIE',
          rating: 8,
          content: 'Fixture review',
          moodEmojis: [],
          status: 'FLAGGED',
        },
      });
      await drain();
      assert.equal(
        (await progress('activity-user', 'first-review')).unlocked,
        false,
      );
      await prisma.review.update({
        where: { id: review.id },
        data: { status: 'PUBLISHED' },
      });
      await prisma.reviewReaction.create({
        data: { userId: 'activity-user', reviewId: review.id, type: 'LIKE' },
      });
      await prisma.reviewReaction.create({
        data: { userId: 'recovery-user', reviewId: review.id, type: 'LIKE' },
      });
      await drain();
      assert.equal(
        (await progress('activity-user', 'first-review')).unlocked,
        true,
      );
      const metrics = (
        await db.query("SELECT achievement_metrics($1,'all') AS m", [
          'activity-user',
        ])
      ).rows[0].m;
      assert.equal(metrics.community_likes_received, 1);
      await prisma.review.update({
        where: { id: review.id },
        data: { status: 'REJECTED' },
      });
      await drain();
      assert.equal(
        (await progress('activity-user', 'first-review')).unlocked,
        true,
      );
      assert.equal(
        (
          await db.query("SELECT achievement_metrics($1,'all') AS m", [
            'activity-user',
          ])
        ).rows[0].m.community_likes_received,
        0,
      );
    },
  );
  await check(
    'revocation blocks automatic re-earning and explicit regrant has an audit trail',
    async () => {
      await ops.award(
        'revoke',
        'activity-user',
        'first-mood',
        'integration',
        'Fixture review',
        'revoke-fixture',
      );
      await drain();
      assert.equal(
        (await progress('activity-user', 'first-mood')).unlocked,
        false,
      );
      await ops.award(
        'grant',
        'activity-user',
        'first-mood',
        'integration',
        'Fixture review complete',
        'grant-fixture',
      );
      await ops.award(
        'grant',
        'activity-user',
        'first-mood',
        'integration',
        'Fixture review complete',
        'grant-fixture',
      );
      await drain();
      assert.equal(
        (await progress('activity-user', 'first-mood')).unlocked,
        true,
      );
      assert.equal(
        await prisma.achievementAwardLog.count({
          where: { idempotencyKey: 'operator:grant-fixture' },
        }),
        1,
      );
    },
  );
  await check(
    'progress reads do not create evidence or award writes',
    async () => {
      const before = await prisma.achievementEvent.count(),
        awards = await prisma.achievementAwardLog.count();
      await service.getMe('activity-user');
      await service.getMe('activity-user');
      assert.equal(await prisma.achievementEvent.count(), before);
      assert.equal(await prisma.achievementAwardLog.count(), awards);
    },
  );
  await check(
    'public profiles respect badge disclosure and omit private evidence',
    async () => {
      const { ReviewService } = require('../dist/routes/review/review.service');
      const reviews = new ReviewService(
        prisma,
        null,
        null,
        null,
        null,
        null,
        redis,
      );
      const shared = await reviews.getPublicUserProfile('activity-user');
      assert.ok(shared.achievements.length > 0);
      assert.equal('events' in shared, false);
      assert.equal('facts' in shared, false);
      await prisma.user.update({
        where: { id: 'activity-user' },
        data: { discloseBadges: false },
      });
      const hidden = await reviews.getPublicUserProfile('activity-user');
      assert.deepEqual(hidden.achievements, []);
      assert.deepEqual(hidden.badges, []);
    },
  );
  await check(
    'HTTP endpoints enforce cookie authentication, origins and DTO ownership',
    async () => {
      const { Test } = require('@nestjs/testing');
      const { ValidationPipe } = require('@nestjs/common');
      const { sign } = require('jsonwebtoken');
      const request = require('supertest');
      const {
        AchievementsController,
      } = require('../dist/achievements/achievements.controller');
      const { JwtStrategy } = require('../dist/auth/strategy/jwt.strategy');
      const { CookieOriginGuard } = require('../dist/auth/cookie-origin.guard');
      const config = new ConfigService({
        JWT_SECRET: 'isolated-achievement-test-secret',
        CORS_ORIGINS: 'https://app.example.test',
      });
      let active = true;
      const strategy = new JwtStrategy(config, prisma, {
        isActive: async () => active,
      });
      const module = await Test.createTestingModule({
        controllers: [AchievementsController],
        providers: [
          { provide: AchievementsService, useValue: service },
          { provide: ConfigService, useValue: config },
          CookieOriginGuard,
        ],
      }).compile();
      const app = module.createNestApplication();
      app.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          transform: true,
        }),
      );
      await app.init();
      try {
        const cookie = `mood_at=${sign({ sub: 'activity-user' }, 'isolated-achievement-test-secret', { expiresIn: '5m' })}`;
        await request(app.getHttpServer()).get('/achievements/me').expect(401);
        await request(app.getHttpServer())
          .get('/achievements/me')
          .set('Cookie', 'mood_at=forged')
          .expect(401);
        await request(app.getHttpServer())
          .get('/achievements/me')
          .set('Cookie', cookie)
          .expect(200)
          .expect('Cache-Control', 'no-store');
        await request(app.getHttpServer())
          .post('/achievements/activity')
          .set('Cookie', cookie)
          .set('Origin', 'https://attacker.example')
          .send({ kind: 'visit' })
          .expect(403);
        await request(app.getHttpServer())
          .post('/achievements/activity')
          .set('Cookie', cookie)
          .set('Origin', 'https://app.example.test')
          .send({ kind: 'visit', userId: 'recovery-user' })
          .expect(201);
        assert.equal(
          await prisma.achievementEvent.count({
            where: { userId: 'recovery-user', kind: 'visit' },
          }),
          0,
        );
        await request(app.getHttpServer())
          .put('/achievements/watched/movie/0')
          .set('Cookie', cookie)
          .send({ active: true })
          .expect(400);
        active = false;
        await request(app.getHttpServer())
          .get('/achievements/me')
          .set('Cookie', cookie)
          .expect(401);
        assert.ok(strategy);
      } finally {
        await app.close();
      }
    },
  );
  await check(
    'invalid contracts go to the failed queue and operator retries are audited',
    async () => {
      await db.query(
        "SELECT achievement_emit($1,'invented','invalid-contract-fixture','{}'::jsonb)",
        ['activity-user'],
      );
      await drain();
      const event = await prisma.achievementEvent.findUnique({
        where: {
          userId_key: {
            userId: 'activity-user',
            key: 'invalid-contract-fixture',
          },
        },
      });
      assert.equal(event.status, 'dead');
      assert.equal(event.errorCode, 'invalid_contract');
      await assert.rejects(ops.retry(event.id, '', ''), /operator identity/);
      await ops.retry(event.id, 'integration', 'Verify audited retry');
      assert.equal(
        (await prisma.achievementEvent.findUnique({ where: { id: event.id } }))
          .status,
        'pending',
      );
      assert.equal(
        await prisma.achievementFact.count({
          where: {
            userId: 'activity-user',
            metric: 'operator_action',
            details: { path: ['action'], equals: 'retry' },
          },
        }),
        1,
      );
      await drain();
    },
  );
  await check(
    'historical classification never invents past trending membership',
    async () => {
      await createUser('history-user');
      await drain();
      const at = new Date();
      await prisma.achievementTrendSnapshot.create({
        data: {
          keys: ['movie:9100', 'movie:9101'],
          capturedAt: new Date(at.getTime() - 1000),
          validUntil: new Date(at.getTime() + 3600000),
        },
      });
      await db.query(
        "SELECT achievement_emit($1,'classify','historical-fixture',$2::jsonb,$3)",
        [
          'history-user',
          JSON.stringify({
            title: { type: 'movie', id: 9100 },
            historical: true,
            silent: true,
          }),
          new Date(at.getTime() - 86400000),
        ],
      );
      await db.query(
        "SELECT achievement_emit($1,'classify','current-fixture',$2::jsonb,$3)",
        [
          'history-user',
          JSON.stringify({ title: { type: 'movie', id: 9101 } }),
          at,
        ],
      );
      await drain();
      assert.equal(
        await prisma.achievementFact.count({
          where: { userId: 'history-user', metric: 'horror_titles' },
        }),
        2,
      );
      assert.equal(
        await prisma.achievementFact.count({
          where: { userId: 'history-user', metric: 'trending_titles' },
        }),
        1,
      );
    },
  );
  await check(
    'the twenty-five-badge dependency awards once after ordinary grants',
    async () => {
      await createUser('legend-user');
      await drain();
      const definitions = (await catalogue.published())
        .filter((row) => !['profile-basic', 'moodies-legend'].includes(row.key))
        .slice(0, 24);
      for (const definition of definitions)
        await ops.award(
          'grant',
          'legend-user',
          definition.key,
          'integration',
          'Verify milestone dependency',
          `legend-${definition.key}`,
        );
      await drain();
      assert.equal(
        (await progress('legend-user', 'moodies-legend')).unlocked,
        true,
      );
      assert.equal(
        await prisma.achievementAwardLog.count({
          where: {
            userId: 'legend-user',
            achievement: { key: 'moodies-legend' },
          },
        }),
        1,
      );
    },
  );
  await check(
    'deleting an active account removes quiz, watched and mood evidence too',
    async () => {
      await prisma.user.delete({ where: { id: 'activity-user' } });
      for (const table of [
        'quiz',
        'quizCompletion',
        'watchedTitle',
        'moodLog',
        'achievementMetric',
        'achievementNotification',
      ])
        assert.equal(
          await prisma[table].count({ where: { userId: 'activity-user' } }),
          0,
          table,
        );
    },
  );
  await check(
    'account deletion removes private event, fact and award data',
    async () => {
      await prisma.user.delete({ where: { id: 'engine-user' } });
      for (const table of [
        'achievementEvent',
        'achievementFact',
        'achievementAwardLog',
        'achievementNotification',
      ])
        assert.equal(
          await prisma[table].count({ where: { userId: 'engine-user' } }),
          0,
        );
    },
  );
  console.log('Achievement PostgreSQL integration checks passed.');
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await db.end();
  });
