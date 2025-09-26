// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import { seedMoods } from './seed/moods.seed';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');
  await seedMoods(prisma);
  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
