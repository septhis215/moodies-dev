export interface QuizAnswer {
  genres: string[];
  mood: string;
  mediaType?: string;
  category?: string;
  pace?: string;
  commitment?: string;
}

export const GENRES: Record<string, { movie: number[]; tv: number[] }> = {
  action: { movie: [28], tv: [10759] },
  adventure: { movie: [12], tv: [10759] },
  animation: { movie: [16], tv: [16] },
  comedy: { movie: [35], tv: [35] },
  crime: { movie: [80], tv: [80] },
  drama: { movie: [18], tv: [18] },
  family: { movie: [10751], tv: [10751] },
  fantasy: { movie: [14], tv: [10765] },
  horror: { movie: [27], tv: [] },
  mystery: { movie: [9648], tv: [9648] },
  romance: { movie: [10749], tv: [] },
  'sci-fi': { movie: [878], tv: [10765] },
  thriller: { movie: [53], tv: [] },
  documentary: { movie: [99], tv: [99] },
  war: { movie: [10752], tv: [10768] },
  western: { movie: [37], tv: [37] },
};

// Editorial genre proxies, not measured emotional tone or a personality diagnosis.
const MOOD_GENRES: Record<string, string[]> = {
  cozy: ['comedy', 'family', 'romance'],
  happy: ['comedy', 'family'],
  thrilling: ['action', 'thriller', 'crime'],
  'mind-bending': ['mystery', 'sci-fi', 'thriller'],
  bittersweet: ['drama', 'romance'],
  inspirational: ['drama', 'adventure'],
  relaxed: ['comedy', 'family', 'romance'],
  relaxing: ['comedy', 'family'],
  energetic: ['action', 'thriller'],
  thoughtful: ['mystery', 'documentary', 'drama'],
};
const PACE_GENRES: Record<string, string[]> = {
  slow: ['drama', 'documentary', 'romance'],
  fast: ['action', 'adventure', 'thriller'],
};

function top(counts: Record<string, number>, limit: number) {
  return Object.keys(counts)
    .sort((a, b) => counts[b] - counts[a] || a.localeCompare(b))
    .slice(0, limit);
}

export function genreIds(genres: string[], type: 'movie' | 'tv') {
  return [...new Set(genres.flatMap((genre) => GENRES[genre]?.[type] ?? []))];
}

export function analyzeAnswers(answers: QuizAnswer[]) {
  const genreWeights: Record<string, number> = {};
  const moodWeights: Record<string, number> = {};
  const formats = { movie: 0, tv: 0 };
  for (const answer of answers) {
    for (const genre of new Set(
      answer.genres.map((g) => g.toLowerCase().trim()),
    )) {
      if (GENRES[genre])
        genreWeights[genre] =
          (genreWeights[genre] ?? 0) + (answer.category === 'genre' ? 3 : 1);
    }
    const mood = answer.mood.toLowerCase().trim();
    if (MOOD_GENRES[mood]) moodWeights[mood] = (moodWeights[mood] ?? 0) + 1;
    if (answer.mediaType === 'movie' || answer.mediaType === 'tv') {
      formats[answer.mediaType] += answer.category === 'format' ? 3 : 1;
    }
  }
  const preferredMediaType =
    formats.movie === formats.tv
      ? null
      : formats.movie > formats.tv
        ? ('movie' as const)
        : ('tv' as const);
  const topGenres = top(genreWeights, 3);
  const topMoods = top(moodWeights, 2);
  const pace = answers.find((a) => a.category === 'pace')?.pace ?? 'balanced';
  const commitment =
    answers.find((a) => a.category === 'commitment')?.commitment ?? 'open';
  const discoveryGenres = [
    ...new Set([
      ...topGenres,
      ...topMoods.flatMap((m) => MOOD_GENRES[m]),
      ...(PACE_GENRES[pace] ?? []),
    ]),
  ];
  return {
    topGenres,
    topMoods,
    preferredMediaType,
    genreWeights,
    moodWeights,
    pace,
    commitment,
    discoveryGenres,
    genreIds: [
      ...new Set(
        discoveryGenres.flatMap((genre) => [
          ...(GENRES[genre]?.movie ?? []),
          ...(GENRES[genre]?.tv ?? []),
        ]),
      ),
    ],
    rankingVersion: 'genre-proxy-v1',
  };
}
export type QuizAnalysis = ReturnType<typeof analyzeAnswers>;

export interface RankingCandidate {
  id: number;
  media_type?: string;
  genre_ids: number[];
  vote_average: number;
  vote_count: number;
}

export function rankCandidates<T extends RankingCandidate>(
  candidates: T[],
  analysis: QuizAnalysis,
) {
  const unique = new Map<string, T>();
  candidates.forEach((item) => {
    if (item.media_type === 'movie' || item.media_type === 'tv')
      unique.set(`${item.media_type}-${item.id}`, item);
  });
  return [...unique.values()]
    .map((item) => {
      const type = item.media_type as 'movie' | 'tv';
      const hasGenre = (genre: string) =>
        (GENRES[genre]?.[type] ?? []).some((id) => item.genre_ids.includes(id));
      const matchedGenres = Object.keys(analysis.genreWeights).filter(hasGenre);
      const totalWeight = Object.values(analysis.genreWeights).reduce(
        (sum, weight) => sum + weight,
        0,
      );
      const genreFit = totalWeight
        ? matchedGenres.reduce(
            (sum, genre) => sum + analysis.genreWeights[genre],
            0,
          ) / totalWeight
        : 0;
      const moodFit = analysis.topMoods.length
        ? analysis.topMoods.reduce((sum, mood) => {
            const genres = MOOD_GENRES[mood];
            return sum + genres.filter(hasGenre).length / genres.length;
          }, 0) / analysis.topMoods.length
        : 0;
      const paceGenres = PACE_GENRES[analysis.pace] ?? [];
      const paceFit = paceGenres.length
        ? paceGenres.filter(hasGenre).length / paceGenres.length
        : 0;
      const formatFit = analysis.preferredMediaType === type ? 1 : 0;
      const reasons: string[] = [];
      if (matchedGenres.length)
        reasons.push(`Shares your ${matchedGenres.join(' / ')} genre choices.`);
      if (moodFit > 0)
        reasons.push(
          `Shares genres used as a guide for your ${analysis.topMoods.join(' / ')} mood.`,
        );
      if (paceFit > 0)
        reasons.push(
          `Shares genres associated with your ${analysis.pace} pace preference.`,
        );
      if (formatFit)
        reasons.push(
          `Fits your ${type === 'movie' ? 'movie' : 'series'} preference.`,
        );
      if (!reasons.length)
        reasons.push('A broader suggestion from the available catalogue.');
      const matchScore = Number(
        (genreFit * 55 + moodFit * 25 + paceFit * 10 + formatFit * 10).toFixed(
          4,
        ),
      );
      return { ...item, matchScore, matchReasons: reasons };
    })
    .sort(
      (a, b) =>
        b.matchScore - a.matchScore ||
        // Ratings only break ties in fit; they are not evidence of personal compatibility.
        b.vote_average * Math.min(b.vote_count / 200, 1) -
          a.vote_average * Math.min(a.vote_count / 200, 1) ||
        a.media_type!.localeCompare(b.media_type!) ||
        a.id - b.id,
    );
}
