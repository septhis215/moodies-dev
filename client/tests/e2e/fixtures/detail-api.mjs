import { createServer } from 'node:http';

export async function startDetailApi(port = 4000) {
  const member = { id: 'fixture-member', username: 'Alex', name: 'Alex', avatarUrl: null };
  const state = { liked: new Set(), saved: new Set(), likes: 12, saves: 8, reviews: 3, failMutation: false, failStats: false, anonymous: false, mutationCalls: 0, lastReview: null };
  const topMoods = [{ emoji: '/images/review-icons/loved-it.png', count: 8 }, { emoji: '/images/review-icons/amazing.png', count: 5 }, { emoji: '/images/review-icons/enjoyed-it.png', count: 3 }, { emoji: '/images/review-icons/its-okay.png', count: 4 }];
  const reviews = [{ id: 'fixture-review', userId: member.id, user: member, rating: 8, content: 'A beautifully observed story with a sharp sense of humor and a cast that makes every scene count.', createdAt: '2026-10-20T12:00:00Z', moodEmojis: [topMoods[0].emoji] }];
  const details = (tv, id) => ({
    info: { id, title: tv ? 'The Last Light' : 'A Different Kind of Sunday', overview: 'A chance encounter on a quiet Sunday sends two strangers through the city, uncovering forgotten places and a connection neither of them expected.', release_date: '2026-09-18', runtime: 118, poster_path: '/fixture-poster.jpg', backdrop_path: '/fixture-backdrop.jpg', vote_average: 8.2, vote_count: 1250, genres: [{ id: 18, name: 'Drama' }, { id: 35, name: 'Comedy' }], production_companies: ['A24', 'Focus Features', 'Film4', 'StudioCanal', 'Searchlight Pictures', 'Neon', 'Working Title'].map((name, index) => ({ id: index + 1, name })), production_countries: [{ name: 'United States', iso_3166_1: 'US' }], content_type: tv ? 'tv' : 'movie', number_of_seasons: tv ? 2 : undefined, created_by: [{ id: 1, name: 'Avery Park' }], tagline: 'Some days change everything.', director: 'Avery Park', budget: 12000000, revenue: 26000000, status: 'Released', spoken_languages: [{ iso_639_1: 'en', name: 'English' }] },
    credits: { cast: [], crew: [{ id: 1, name: 'Avery Park', job: 'Director', department: 'Directing' }] },
    providers: { results: { US: { flatrate: ['Apple TV', 'Netflix', 'Prime Video', 'Hulu', 'Max', 'Peacock', 'Paramount+', 'MUBI', 'Criterion Channel', 'Disney+', 'Tubi', 'Kanopy'].map((provider_name) => ({ provider_name })) } } },
  });
  const buckets = (set) => ({ movieId: [...set].filter((key) => key.startsWith('movie:')).map((key) => key.split(':')[1]), seriesId: [...set].filter((key) => key.startsWith('series:')).map((key) => key.split(':')[1]) });
  const server = createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Content-Type', 'application/json');
    if (req.method === 'OPTIONS') { res.end(); return; }
    const url = new URL(req.url, 'http://localhost');
    const path = url.pathname.replace(/^\/api/, '');
    const reply = (data, code = 200) => { res.statusCode = code; res.end(JSON.stringify(data)); };
    if (path === '/auth/bootstrap' || path === '/auth/me') return reply({ user: state.anonymous ? null : member, canRefresh: false, watchlist: buckets(state.saved), liked: buckets(state.liked) });
    if (path === '/reviews/me/ban-status') return reply({ banned: false });
    if (/^\/(liked|watchlist)\/toggle$/.test(path)) {
      state.mutationCalls++;
      await new Promise((resolve) => setTimeout(resolve, 180));
      if (state.failMutation) return reply({ message: 'Fixture write failed.' }, 503);
      let body = ''; for await (const chunk of req) body += chunk;
      const { tmdbId, type, active } = JSON.parse(body);
      const set = path.startsWith('/liked') ? state.liked : state.saved;
      const field = path.startsWith('/liked') ? 'likes' : 'saves';
      const key = `${type}:${tmdbId}`;
      if (set.has(key) !== active) state[field] += active ? 1 : -1;
      if (active) set.add(key); else set.delete(key);
      return reply(field === 'likes' ? { liked: active } : { removed: !active });
    }
    if (path === '/liked' || path === '/watchlist') return reply(buckets(path === '/liked' ? state.liked : state.saved));
    if (path === '/media-stats/batch') return state.failStats ? reply({ message: 'Fixture read failed.' }, 503) : reply(Object.fromEntries((url.searchParams.get('items') || '').split(',').map((key) => [key, { likeCount: state.likes, savedCount: state.saves, reviewCount: state.reviews }])));
    if (path === '/reviews' && req.method === 'POST') { let body = ''; for await (const chunk of req) body += chunk; state.lastReview = JSON.parse(body); state.reviews++; return reply(reviews[0], 201); }
    if (path.endsWith('/snapshot')) {
      return reply({ snapshotType: path.startsWith('/reviews') ? 'review' : 'content', format: 'square', width: 1080, height: 1080, content: { tmdbId: 550, mediaType: path.includes('/TV/') ? 'TV' : 'MOVIE', title: 'A Different Kind of Sunday', releaseYear: '2026', typeLabel: 'Movie', posterUrl: 'http://localhost:3000/images/ironmanposter.jpeg', backdropUrl: 'http://localhost:3000/images/ironmanbg.jpg', genres: ['Drama', 'Comedy'], directors: ['Avery Park'], runtimeLabel: '1h 58m', ratingLabel: '8.2 TMDB' }, review: path.startsWith('/reviews') ? { content: reviews[0].content, username: 'Sam', rating: 8, isPrivate: true } : undefined });
    }
    if (/\/(movies|tv)\/details\//.test(path)) return reply(details(path.startsWith('/tv'), Number(path.split('/').pop())));
    if (path.startsWith('/reviews/media/')) return path.endsWith('/stats') ? reply({ totalRatings: state.reviews, averageRating: 8.2 }) : reply({ reviews, topMoods, pagination: { page: 1, limit: 10, total: state.reviews, totalPages: 1 } });
    if (path.includes('/images/')) return reply({ posters: [], backdrops: [] });
    if (path.includes('/videos/')) return reply({ videos: [] });
    if (path.includes('/seasons/')) return reply({ seasons: [] });
    return reply([]);
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, resolve); });
  return { state, close: () => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }) };
}
