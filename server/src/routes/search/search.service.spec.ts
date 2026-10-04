import { ConfigService } from '@nestjs/config';
import { TMDBService } from 'src/external-apis/services/tmdb.service';
import { SearchService } from './search.service';

describe('search filter contract', () => {
  const request = jest.fn();
  let service: SearchService;
  beforeEach(() => {
    request.mockReset();
    service = new SearchService(
      { request } as unknown as TMDBService,
      {
        get: () => 'test-token',
      } as unknown as ConfigService,
    );
  });

  it.each(['movie', 'tv'] as const)(
    'keeps the query when filtering %s',
    async (type) => {
      request.mockResolvedValue({
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
      });
      const response = await service.search({
        query: 'bad',
        type,
        year_min: 1960,
        rating_min: 7,
      });
      expect(request).toHaveBeenCalledWith(
        `/search/${type}`,
        expect.objectContaining({
          params: expect.objectContaining({ query: 'bad' }),
        }),
      );
      expect(response.results).toHaveLength(1);
      expect(response.total_results).toBe(100);
      expect(response).toMatchObject({
        filter_scope: 'page',
        total_results_scope: 'before_filters',
      });
    },
  );

  it('returns every item from the merged source pages instead of dropping the last forty', async () => {
    request.mockImplementation(() =>
      Promise.resolve({
        results: Array.from({ length: 20 }, (_, id) => ({
          id,
          title: 'Bad Film',
          name: 'Bad Person',
          vote_average: 8,
        })),
        total_results: 20,
        total_pages: 1,
      }),
    );
    const response = await service.search({ query: 'bad', type: 'all' });
    expect(response.results).toHaveLength(60);
  });

  it('does not pass missing release dates through an active year constraint', async () => {
    request.mockResolvedValue({
      results: [{ id: 1, title: 'Bad Film', vote_average: 8 }],
      total_results: 1,
      total_pages: 1,
    });
    const response = await service.search({
      query: 'bad',
      type: 'movie',
      year_min: 1960,
    });
    expect(response.results).toHaveLength(0);
  });

  it('uses OR genre semantics in queryless discovery', async () => {
    request.mockImplementation((endpoint: string) =>
      Promise.resolve(
        endpoint.startsWith('/genre/')
          ? {
              genres: [
                { id: 80, name: 'Crime' },
                { id: 18, name: 'Drama' },
              ],
            }
          : { results: [], total_results: 0, total_pages: 0 },
      ),
    );
    await service.loadGenres();
    await service.discover({ type: 'movie', genres: 'Crime,Drama' });
    expect(request).toHaveBeenCalledWith(
      '/discover/movie',
      expect.objectContaining({
        params: expect.objectContaining({ with_genres: '80|18' }),
      }),
    );
  });
});
