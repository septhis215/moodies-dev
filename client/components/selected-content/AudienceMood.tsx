import { AudioLines } from 'lucide-react';
import styles from './AudienceMood.module.css';

type MoodVote = { emoji: string; count: number };

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

export function AudienceMood({ moods, totalVotes, compact = false }: { moods: MoodVote[]; totalVotes?: number; compact?: boolean }) {
  const total = totalVotes ?? moods.reduce((sum, mood) => sum + Math.max(0, mood.count), 0);
  const leaders = [...moods].filter((mood) => mood.count > 0).sort((a, b) => b.count - a.count).slice(0, 3);
  if (!total || !leaders.length) return null;
  const colors = ['var(--brand-coral-strong)', 'var(--brand-gold)', 'var(--ink-muted)'];
  const other = Math.max(0, total - leaders.reduce((sum, mood) => sum + mood.count, 0));
  const percent = Math.round(leaders[0].count / total * 100);
  const spectrum = <div className={styles.spectrum} aria-hidden="true">{leaders.map((mood, index) => <span key={mood.emoji} style={{ width: `${mood.count / total * 100}%`, background: colors[index] }} />)}{other > 0 ? <span style={{ width: `${other / total * 100}%`, background: 'var(--surface-3)' }} /> : null}</div>;

  if (compact) return <div className={styles.compact}>
    <span className={styles.compactIcon}><AudioLines size={18} aria-hidden="true" /></span>
    <div className={styles.compactMain}><span>Audience mood · {total.toLocaleString()} votes</span><strong>{audienceMoodLabel(leaders[0].emoji)}</strong></div>
    <div className={styles.compactEnd}><span>{percent}%</span>{spectrum}</div>
  </div>;

  return (
    <div className={styles.panel}>
      <div className={styles.header}><div><p className={styles.eyebrow}><AudioLines size={15} aria-hidden="true" />Audience mood</p><h3>{audienceMoodLabel(leaders[0].emoji)}</h3></div><p className={styles.percentage}>{percent}<small>%</small></p></div>
      {spectrum}
      <ul className={styles.legend} aria-label="Top audience moods">{leaders.map((mood, index) => <li key={mood.emoji}><p className={styles.legendLabel}><i style={{ background: colors[index] }} aria-hidden="true" />{audienceMoodLabel(mood.emoji)}</p><span>{mood.count.toLocaleString()} votes · {Math.round(mood.count / total * 100)}%</span></li>)}</ul>
      <div className={styles.source}><span>{total.toLocaleString()} audience mood votes</span>{other ? <span>{other} in other moods</span> : <span>From the Moodies community</span>}</div>
    </div>
  );
}
