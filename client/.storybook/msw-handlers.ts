import { http, HttpResponse } from 'msw';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const mswHandlers = {
  auth: [
    http.get(`${API_BASE}/auth/me`, () => HttpResponse.json(null, { status: 401 })),
    http.post(`${API_BASE}/auth/refresh`, () => HttpResponse.json({ ok: false }, { status: 401 })),
    http.post(`${API_BASE}/auth/logout`, () => HttpResponse.json({ ok: true })),
  ],
  search: [
    http.get(`${API_BASE}/all/search/trending-terms`, () =>
      HttpResponse.json([
        { id: 1, title: 'Dune', media_type: 'movie' },
        { id: 2, title: 'Severance', media_type: 'tv' },
        { id: 3, title: 'Zendaya', media_type: 'person' },
      ]),
    ),
    http.get(`${API_BASE}/search/suggestions/:type`, ({ params }) =>
      HttpResponse.json([
        {
          id: 101,
          title: params.type === 'person' ? 'Denis Villeneuve' : 'Dune: Part Two',
          name: params.type === 'person' ? 'Denis Villeneuve' : undefined,
          type: params.type === 'person' ? 'person' : 'movie',
          year: 2024,
          poster_path: null,
          profile_path: null,
          known_for_department: params.type === 'person' ? 'Directing' : undefined,
        },
      ]),
    ),
  ],
};
