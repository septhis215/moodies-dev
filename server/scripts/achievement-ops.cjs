// Host-operator tool; no administration endpoints are exposed to app users.
const path = require('node:path');
require('reflect-metadata');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('tsconfig-paths').register({
  baseUrl: path.resolve(__dirname, '../dist'),
  paths: { 'src/*': ['*'] },
});
const { PrismaClient } = require('@prisma/client');
const {
  AchievementCatalogService,
} = require('../dist/achievements/achievement-catalog.service');
const {
  AchievementOperationsService,
} = require('../dist/achievements/achievement-operations.service');
const command = process.argv[2];
const args = {};
for (let i = 3; i < process.argv.length; i += 2) {
  if (!process.argv[i].startsWith('--') || !process.argv[i + 1])
    throw new Error('Use --name value arguments.');
  args[process.argv[i].slice(2)] = process.argv[i + 1];
}
const prisma = new PrismaClient();
const catalogue = new AchievementCatalogService(prisma, {
  getOrSet: async (_key, _ttl, load) => load(),
});
const ops = new AchievementOperationsService(prisma, catalogue);
(async () => {
  let result;
  switch (command) {
    case 'status':
      result = await ops.status();
      break;
    case 'inspect':
      if (!args.user) throw Error('--user is required');
      result = await ops.inspect(args.user, args.key);
      break;
    case 'retry':
      if (!args.event) throw Error('--event is required');
      result = await ops.retry(args.event, args.actor, args.reason);
      break;
    case 'reconcile':
      result = await ops.reconcile(
        args.after,
        Number(args.limit || 100),
        args.actor,
        args.reason,
      );
      break;
    case 'backfill-titles':
      if (!args.user) throw Error('--user is required');
      result = await ops.backfillTitles(
        args.user,
        args.after,
        Number(args.limit || 50),
        args.actor,
        args.reason,
      );
      break;
    case 'grant':
    case 'revoke':
      if (!args.user || !args.key) throw Error('--user and --key are required');
      result = await ops.award(
        command,
        args.user,
        args.key,
        args.actor,
        args.reason,
        args.request,
      );
      break;
    case 'timezone':
      if (!args.user || !args.zone)
        throw Error('--user and --zone are required');
      result = await ops.timezone(
        args.user,
        args.zone,
        args.actor,
        args.reason,
      );
      break;
    default:
      throw Error(
        'Commands: status, inspect, retry, reconcile, backfill-titles, grant, revoke, timezone. Build the server first.',
      );
  }
  console.log(
    JSON.stringify(
      result,
      (_key, value) => (typeof value === 'bigint' ? value.toString() : value),
      2,
    ),
  );
})()
  .catch((error) => {
    console.error(
      error instanceof Error ? error.message : 'Achievement operation failed',
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
