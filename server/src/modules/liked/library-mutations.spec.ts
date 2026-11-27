import { Prisma } from '@prisma/client';
import { LikedService } from './liked.service';
import { WatchlistService } from '../watchlist/watchlist.service';

describe.each(['likes', 'saves'] as const)('%s are database transitions', (kind) => {
  function setup() {
    let exists = false;
    let count = 0;
    const rows = {
      findUnique: jest.fn(() => Promise.resolve(exists ? { id: 'item' } : null)),
      create: jest.fn(() => { exists = true; return Promise.resolve(); }),
      deleteMany: jest.fn(() => {
        const deleted = Number(exists);
        exists = false;
        return Promise.resolve({ count: deleted });
      }),
    };
    const field = kind === 'likes' ? 'likeCount' : 'savedCount';
    const tx = {
      likedItem: rows,
      watchlistItem: rows,
      mediaStat: {
        upsert: jest.fn(({ update }: { update: Record<string, { increment: number }> }) => {
          count += update[field].increment;
          return Promise.resolve({ [field]: count });
        }),
      },
    };
    const transaction = jest.fn((work: (client: typeof tx) => Promise<unknown>) => work(tx));
    const prisma = { $transaction: transaction } as unknown as ConstructorParameters<typeof LikedService>[0];
    const service = kind === 'likes' ? new LikedService(prisma) : new WatchlistService(prisma);
    return { service, rows, transaction, tx, count: () => count };
  }

  it('ten repeated add requests create one row and increment once; repeated removal decrements once', async () => {
    const { service, rows, count } = setup();
    for (let i = 0; i < 10; i++) await service.toggle('user', '42', 'movie', true);
    expect(rows.create).toHaveBeenCalledTimes(1);
    expect(count()).toBe(1);
    for (let i = 0; i < 10; i++) await service.toggle('user', '42', 'movie', false);
    expect(rows.deleteMany).toHaveBeenCalledTimes(1);
    expect(count()).toBe(0);
  });

  it('preserves legacy toggling for both movies and TV', async () => {
    const { service, rows, count } = setup();
    await service.toggle('user', '42', 'series');
    await service.toggle('user', '42', 'series');
    expect(rows.create).toHaveBeenCalledWith({ data: { userId: 'user', tmdbId: 42, mediaType: 'TV' } });
    expect(count()).toBe(0);
  });

  it.each(['P2034', 'P2002'])('retries the whole transaction on %s instead of continuing an aborted transaction', async (code) => {
    const { service, transaction, rows, count } = setup();
    transaction.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('Conflict', { code, clientVersion: '6.15.0' }));
    await service.toggle('user', '42', 'movie', true);
    expect(transaction).toHaveBeenCalledTimes(2);
    expect(transaction).toHaveBeenLastCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
    expect(rows.create).toHaveBeenCalledTimes(1);
    expect(count()).toBe(1);
  });

  it('rejects invalid title IDs before starting a transaction', async () => {
    const { service, transaction } = setup();
    await expect(service.toggle('user', '2147483648', 'movie', true)).rejects.toThrow('Invalid title ID');
    expect(transaction).not.toHaveBeenCalled();
  });
});
