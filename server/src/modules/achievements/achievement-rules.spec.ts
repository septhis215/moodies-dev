import {
  calendarKeys,
  evaluateProgress,
  longestStreak,
  classifyTitle,
  RULE_TARGETS,
} from './achievement-rules';
import { achievementSeeds } from './achievement-catalog';

describe('achievement earning contracts', () => {
  it('uses exact thresholds and preserves completed awards after collection edits', () => {
    expect(evaluateProgress(199, 200, false)).toEqual({
      currentProgress: 199,
      completionPercentage: 99.5,
      unlocked: false,
    });
    expect(evaluateProgress(200, 200, false).unlocked).toBe(true);
    expect(evaluateProgress(0, 20, true)).toEqual({
      currentProgress: 20,
      completionPercentage: 100,
      unlocked: true,
    });
    expect(() => evaluateProgress(1, 0, false)).toThrow();
    expect(() => evaluateProgress(NaN, 1, false)).toThrow();
  });
  it('counts consecutive distinct calendar dates with delayed and out-of-order delivery', () => {
    expect(
      longestStreak([
        '2024-03-01',
        '2024-02-28',
        '2024-02-29',
        '2024-02-29',
        '2024-03-04',
      ]),
    ).toBe(3);
    expect(longestStreak([])).toBe(0);
    expect(() => longestStreak(['2024-02-31'])).toThrow();
  });
  it('assigns one night across midnight using server time and an IANA timezone', () => {
    const evening = calendarKeys(
      new Date('2026-10-31T15:00:00Z'),
      'Asia/Kuala_Lumpur',
    );
    const morning = calendarKeys(
      new Date('2026-10-31T18:00:00Z'),
      'Asia/Kuala_Lumpur',
    );
    expect(evening).toEqual({ date: '2026-10-31', night: '2026-10-31' });
    expect(morning).toEqual({ date: '2026-11-01', night: '2026-10-31' });
    expect(
      calendarKeys(new Date('2026-03-08T07:30:00Z'), 'America/New_York').date,
    ).toBe('2026-03-08');
    expect(() => calendarKeys(new Date(), 'invented/zone')).toThrow();
  });
  it('credits only verified title genres and sufficiently reviewed hidden gems', () => {
    const title = {
      genreIds: [27, 18],
      countries: ['KR'],
      rating: 8,
      votes: 300,
      popularity: 10,
      adult: false,
    };
    expect(classifyTitle(title, false)).toEqual(
      expect.arrayContaining([
        'horror_titles',
        'k_drama_romance',
        'hidden_gems',
      ]),
    );
    expect(classifyTitle({ ...title, votes: 1 }, false)).not.toContain(
      'hidden_gems',
    );
    expect(
      classifyTitle({ ...title, genreIds: [10765], countries: [] }, false),
    ).not.toContain('horror_titles');
    expect(classifyTitle({ ...title, adult: true }, true)).toEqual([]);
    expect(classifyTitle(title, true)).toContain('trending_titles');
    expect(classifyTitle(title, false)).not.toContain('trending_titles');
  });
  it('covers all seeded achievement targets without an executable free-text rule', () => {
    expect(achievementSeeds).toHaveLength(40);
    for (const seed of achievementSeeds)
      expect(RULE_TARGETS).toContain(seed.requirementTarget);
  });
});
