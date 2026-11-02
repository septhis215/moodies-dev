import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

/** Retry the whole transaction: a PostgreSQL constraint error aborts its transaction. */
export async function serializableTransaction<T>(
  prisma: PrismaService,
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (
        attempt >= 4 ||
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        !['P2034', 'P2002'].includes(error.code)
      ) throw error;
      await new Promise((resolve) => setTimeout(resolve, 10 * (attempt + 1)));
    }
  }
}
