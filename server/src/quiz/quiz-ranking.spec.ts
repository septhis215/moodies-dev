import {
  analyzeAnswers,
  genreIds,
  rankCandidates,
  type QuizAnswer,
} from './quiz-ranking';

const answers: QuizAnswer[] = [
  { category: 'feeling', genres: [], mood: 'cozy' },
  { category: 'pace', genres: [], mood: '', pace: 'slow' },
  { category: 'genre', genres: ['comedy', 'family'], mood: '' },
  { category: 'format', genres: [], mood: '', mediaType: 'movie' },
  { category: 'commitment', genres: [], mood: '', commitment: 'short' },
];
const item = (id: number, genres: number[], rating = 7, type = 'movie') => ({
  id,
  genre_ids: genres,
  vote_average: rating,
  vote_count: 300,
  media_type: type,
});

describe('quiz ranking', () => {
  it('returns the same ordered scores for the same pool regardless of input order', () => {
    const candidates = [item(3, [28], 10), item(2, [35]), item(1, [35, 10751])];
    const analysis = analyzeAnswers(answers);
    expect(rankCandidates(candidates, analysis)).toEqual(
      rankCandidates([...candidates].reverse(), analysis),
    );
    expect(rankCandidates(candidates, analysis)[0].id).toBe(1);
  });
  it('changes ranking with the mood signal and labels its evidence as a genre guide', () => {
    const pool = [item(1, [35]), item(2, [53])];
    const cozy = analyzeAnswers([{ genres: [], mood: 'cozy' }]);
    const thrilling = analyzeAnswers([{ genres: [], mood: 'thrilling' }]);
    expect(rankCandidates(pool, cozy)[0].id).toBe(1);
    expect(rankCandidates(pool, thrilling)[0].id).toBe(2);
    expect(rankCandidates(pool, cozy)[0].matchReasons[0]).toContain(
      'genres used as a guide',
    );
  });
  it('changes ranking with the pace proxy', () => {
    const pool = [item(1, [18]), item(2, [28])];
    expect(
      rankCandidates(
        pool,
        analyzeAnswers([
          { category: 'pace', genres: [], mood: '', pace: 'slow' },
        ]),
      )[0].id,
    ).toBe(1);
    expect(
      rankCandidates(
        pool,
        analyzeAnswers([
          { category: 'pace', genres: [], mood: '', pace: 'fast' },
        ]),
      )[0].id,
    ).toBe(2);
  });
  it('uses weighted format votes, is independent of answer order and leaves ties open', () => {
    const votes: QuizAnswer[] = [
      { category: 'format', genres: [], mood: '', mediaType: 'movie' },
      { genres: [], mood: '', mediaType: 'tv' },
    ];
    expect(analyzeAnswers(votes).preferredMediaType).toBe('movie');
    expect(analyzeAnswers([...votes].reverse()).preferredMediaType).toBe(
      'movie',
    );
    expect(
      analyzeAnswers([
        { genres: [], mood: '', mediaType: 'movie' },
        { genres: [], mood: '', mediaType: 'tv' },
      ]).preferredMediaType,
    ).toBeNull();
  });
  it('uses the correct IDs for each format and keeps same-ID movie/TV distinct', () => {
    expect(genreIds(['action', 'sci-fi'], 'movie')).toEqual([28, 878]);
    expect(genreIds(['action', 'sci-fi'], 'tv')).toEqual([10759, 10765]);
    expect(
      rankCandidates(
        [item(1, [35]), item(1, [35]), item(1, [35], 7, 'tv')],
        analyzeAnswers(answers),
      ),
    ).toHaveLength(2);
  });
  it('does not present catalogue fillers or rating as proof of a personal match', () => {
    const result = rankCandidates(
      [item(1, [28], 10)],
      analyzeAnswers([{ genres: ['comedy'], mood: 'cozy' }]),
    );
    expect(result[0].matchScore).toBe(0);
    expect(result[0].matchReasons).toEqual([
      'A broader suggestion from the available catalogue.',
    ]);
  });
});
