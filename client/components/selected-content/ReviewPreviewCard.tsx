"use client";

import { useId, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Share2, Star } from 'lucide-react';
import { TmdbImage } from '@/components/ui/TmdbImage';
import { audienceMoodImage, audienceMoodLabel } from './AudienceMood';
import styles from './ReviewPreviewCard.module.css';

const REVIEW_PREVIEW_LIMIT = 220;

export function ReviewPreviewCard({ author, authorHref, date, avatar, rating, content, mood, href, onShare }: {
  author: string; authorHref?: string; date: string; avatar: ReactNode; rating: number | null;
  content: string; mood?: string; href: string; onShare?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const characters = Array.from(content);
  const long = characters.length > REVIEW_PREVIEW_LIMIT;
  const preview = long ? `${characters.slice(0, REVIEW_PREVIEW_LIMIT - 1).join('').trimEnd()}…` : content;
  return <article className={styles.card}>
    <header className={styles.header}><div className={styles.person}>{avatar}<div>{authorHref ? <Link href={authorHref}>{author}</Link> : <p>{author}</p>}<time dateTime={date}>{new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</time></div></div>
      {rating !== null ? <p className={styles.rating} aria-label={`${rating.toFixed(1)} out of 5 stars`}><Star size={15} fill="currentColor" aria-hidden="true" />{rating.toFixed(1)}<span>/5</span></p> : null}
    </header>
    <p id={id} className={styles.content}>{expanded ? content : preview}</p>
    {long ? <button type="button" className={styles.readMore} onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} aria-controls={id}>{expanded ? 'Show less' : 'Keep reading'}</button> : null}
    <footer className={styles.footer}><span className={styles.mood}>{mood ? <>
      <TmdbImage src={audienceMoodImage(mood)} alt="" width={96} height={96} className={styles.moodIcon} />
      <span className={styles.moodText}><span className={styles.moodCaption}>Review mood</span><strong>{audienceMoodLabel(mood)}</strong></span>
    </> : 'A community perspective'}</span><div>
      {onShare ? <button type="button" onClick={onShare} aria-label={`Share review by ${author}`}><Share2 size={16} aria-hidden="true" /></button> : null}
      <Link href={href} aria-label={`Read full review by ${author}`}><ArrowUpRight size={18} aria-hidden="true" /></Link>
    </div></footer>
  </article>;
}
