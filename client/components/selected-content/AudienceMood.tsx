import { AudioLines } from 'lucide-react';
import type { CSSProperties } from 'react';
import { TmdbImage } from '@/components/ui/TmdbImage';
import styles from './AudienceMood.module.css';

export type MoodVote = { emoji: string; count: number };

const OTHER_MOOD_COLOR = '#94a3b8';
const MOOD_COLORS: Record<string, string> = {
  '/images/review-icons/loved-it.png': '#f472b6',
  '/images/review-icons/amazing.png': '#a78bfa',
  '/images/review-icons/enjoyed-it.png': '#2dd4bf',
  '/images/review-icons/its-okay.png': '#60a5fa',
  '/images/review-icons/meh.png': '#fbbf24',
  '/images/review-icons/skip-it.png': '#fb7185',
};

export function audienceMoodImage(value: string): string {
  if (/^\/images\/review-icons\/(amazing|loved-it|enjoyed-it|its-okay|meh|skip-it)\.png$/.test(value)) return value;
  const images: Record<string, string> = {
    '😍': 'loved-it', '🤩': 'amazing', '😊': 'enjoyed-it',
    '🙂': 'its-okay', '😐': 'meh', '👎': 'skip-it',
  };
  return images[value] ? `/images/review-icons/${images[value]}.png` : '/images/moodies-mascot.png';
}

export function audienceMoodColor(value: string): string {
  return MOOD_COLORS[audienceMoodImage(value)] ?? OTHER_MOOD_COLOR;
}

export function getAudienceMoodSummary(moods: MoodVote[], totalVotes?: number, limit = 3) {
  const total = totalVotes ?? moods.reduce((sum, mood) => sum + Math.max(0, mood.count), 0);
  const leaders = [...moods].filter((mood) => mood.count > 0).sort((a, b) => b.count - a.count).slice(0, limit);
  if (!total || !leaders.length) return null;
  return {
    total,
    leaders,
    other: Math.max(0, total - leaders.reduce((sum, mood) => sum + mood.count, 0)),
    percent: Math.round(leaders[0].count / total * 100),
  };
}

export function audienceMoodLabel(value: string): string {
  const labels: Record<string, string> = {
    '😍': 'Loved it', '🤩': 'Amazing', '😊': 'Enjoyed', '🙂': "It's okay", '😐': 'Meh', '👎': 'Disliked',
  };
  if (labels[value]) return labels[value];
  if (!value.startsWith('/images/')) return 'Other mood';
  const name = (value.split('/').pop() ?? '').replace(/\.[^.]+$/, '');
  const reviewLabels: Record<string, string> = { 'amazing': 'Amazing', 'loved-it': 'Loved it', 'enjoyed-it': 'Enjoyed', 'its-okay': "It's okay", 'meh': 'Meh', 'skip-it': 'Disliked' };
  return reviewLabels[name] ?? name.replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function AudienceMood({ moods, totalVotes, compact = false, showAll = false }: { moods: MoodVote[]; totalVotes?: number; compact?: boolean; showAll?: boolean }) {
  const summary = getAudienceMoodSummary(moods, totalVotes, showAll ? Infinity : 3);
  if (!summary) {
    if (compact) return null;
    return <div className={styles.empty}>
      <TmdbImage src="/images/moodies-mascot.png" alt="" width={144} height={144} className={styles.moodImage} />
      <div>
        <p className="ui-kicker">Audience mood</p>
        <h3 className="mt-2 text-xl font-bold leading-tight text-[var(--ink)] sm:text-2xl">No mood votes yet</h3>
        <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">Be the first to share how it made you feel.</p>
      </div>
    </div>;
  }
  const { total, leaders, other, percent } = summary;
  const colors = leaders.map((mood) => audienceMoodColor(mood.emoji));
  const spectrum = <div className={styles.spectrum} aria-hidden="true">{leaders.map((mood, index) => <span key={mood.emoji} style={{ width: `${mood.count / total * 100}%`, background: colors[index] }} />)}{other > 0 ? <span style={{ width: `${other / total * 100}%`, background: OTHER_MOOD_COLOR }} /> : null}</div>;

  if (compact) return <div className={styles.compact}>
    <span className={styles.compactIcon}><AudioLines size={18} aria-hidden="true" /></span>
    <div className={styles.compactMain}><span>Audience mood · {total.toLocaleString()} votes</span><strong>{audienceMoodLabel(leaders[0].emoji)}</strong></div>
    <div className={styles.compactEnd}><span>{percent}%</span>{spectrum}</div>
  </div>;

  return (
    <div className={styles.distribution}>
      <div className={styles.distributionHeader}>
        <p className="ui-kicker">Audience mood</p>
        <p className="text-sm text-[var(--ink-muted)]">Based on {total.toLocaleString()} mood {total === 1 ? 'vote' : 'votes'}</p>
      </div>
      {spectrum}
      <ul className={`${styles.moodGrid} ${showAll ? styles.allMoods : ''}`} style={{ '--mood-columns': leaders.length } as CSSProperties} aria-label={showAll ? 'All audience moods' : 'Top audience moods'}>
        {leaders.map((mood, index) => <li key={mood.emoji} className={styles.moodItem}>
          <TmdbImage src={audienceMoodImage(mood.emoji)} alt="" width={144} height={144} sizes="(min-width: 640px) 144px, 112px" className={styles.moodImage} />
          <div className={styles.moodCopy}>
            <h3 className="text-xl font-bold leading-tight text-[var(--ink)] sm:text-2xl">
              <span className={styles.dot} style={{ background: colors[index] }} aria-hidden="true" />
              {audienceMoodLabel(mood.emoji)}
            </h3>
            <p className={styles.percentage}>{Math.round(mood.count / total * 100)}<span>%</span></p>
            <p className="mt-2 text-sm text-[var(--ink-muted)]">{mood.count.toLocaleString()} {mood.count === 1 ? 'vote' : 'votes'}</p>
          </div>
        </li>)}
      </ul>
      {other > 0 ? <p className={styles.otherMoods}>
        <span><span className={styles.dot} style={{ background: OTHER_MOOD_COLOR }} aria-hidden="true" />Other moods</span>
        <span>{other.toLocaleString()} {other === 1 ? 'vote' : 'votes'} · {Math.round(other / total * 100)}%</span>
      </p> : null}
    </div>
  );
}
