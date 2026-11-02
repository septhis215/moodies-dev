"use client";

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, Loader2, X } from 'lucide-react';
import { motion, useAnimationControls, useDragControls, useReducedMotion } from 'framer-motion';
import { useAuth } from '@/app/context/AuthProvider';
import { useReviewBanStatus } from '@/hooks/useReviewBanStatus';
import { sessionFetch } from '@/lib/auth/session';
import { normalizeResponseError } from '@/lib/errors';
import { appToast } from '@/lib/toast';
import { notifyMediaStatsChanged } from '@/utils/mediaStatsClient';
import { TmdbImage } from '@/components/ui/TmdbImage';
import { tmdbImage } from '@/lib/tmdb';
import { StarRating } from './StarRating';
import styles from './ReviewComposer.module.css';

const MOODS = [
  { image: 'amazing', label: 'Amazing' },
  { image: 'loved-it', label: 'Loved it' },
  { image: 'enjoyed-it', label: 'Enjoyed' },
  { image: 'its-okay', label: "It's okay" },
  { image: 'meh', label: 'Meh' },
  { image: 'skip-it', label: 'Disliked' },
];
const API = process.env.NEXT_PUBLIC_API_URL || 'https://dev.api.moodies.tech/api';

export function ReviewComposer({ open, onClose, contentId, contentType = 'movie', title, posterPath }: {
  open: boolean; onClose: () => void; contentId?: string; contentType?: 'movie' | 'tv'; title?: string; posterPath?: string;
}) {
  const { isAuthenticated, user } = useAuth();
  const { banStatus } = useReviewBanStatus();
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const submitLock = useRef(false);
  const closing = useRef(false);
  const drag = useDragControls();
  const animation = useAnimationControls();
  const reducedMotion = useReducedMotion();
  const [mobile, setMobile] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [mood, setMood] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const titleId = useId();
  const textId = useId();
  const errorId = useId();

  useEffect(() => {
    setContent(''); setRating(null); setMood(''); setError('');
  }, [user?.id, contentId, contentType]);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 639px)');
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!open) { dialog.current?.close(); return; }
    const node = dialog.current;
    if (!node) return;
    closing.current = false;
    const previousFocus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    node.showModal();
    closeButton.current?.focus();
    const updateViewport = () => {
      const viewport = window.visualViewport;
      node.style.setProperty('--composer-viewport', `${viewport?.height ?? window.innerHeight}px`);
      node.style.setProperty('--composer-bottom-offset', `${Math.max(0, window.innerHeight - (viewport?.height ?? window.innerHeight) - (viewport?.offsetTop ?? 0))}px`);
    };
    updateViewport();
    window.visualViewport?.addEventListener('resize', updateViewport);
    window.visualViewport?.addEventListener('scroll', updateViewport);
    const isMobile = window.matchMedia('(max-width: 639px)').matches;
    animation.set({ opacity: reducedMotion ? 1 : 0, y: isMobile && !reducedMotion ? 80 : 0, scale: 1 });
    void animation.start({ opacity: 1, y: 0, scale: 1, transition: { duration: reducedMotion ? 0 : 0.22 } });
    return () => {
      node.close();
      document.body.style.overflow = overflow;
      window.visualViewport?.removeEventListener('resize', updateViewport);
      window.visualViewport?.removeEventListener('scroll', updateViewport);
      previousFocus?.focus();
    };
  }, [open, animation, reducedMotion]);

  const dismiss = useCallback(async () => {
    if (submitLock.current || closing.current) return;
    closing.current = true;
    await animation.start({ opacity: 0, y: mobile && !reducedMotion ? 120 : 0, transition: { duration: reducedMotion ? 0 : 0.18 } });
    onClose();
  }, [animation, mobile, onClose, reducedMotion]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitLock.current) return;
    if (!contentId || !rating || !mood || content.trim().length < 10) {
      setError('Add a rating, choose a mood, and write at least 10 characters.');
      return;
    }
    submitLock.current = true;
    setSubmitting(true);
    setError('');
    try {
      const response = await sessionFetch(`${API}/reviews`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tmdbId: Number(contentId), mediaType: contentType === 'tv' ? 'TV' : 'MOVIE', rating, content: content.trim(), moodEmojis: [`/images/review-icons/${mood}.png`] }),
      });
      if (!response.ok) throw await normalizeResponseError(response, 'Could not publish your review.');
      setContent(''); setRating(null); setMood('');
      notifyMediaStatsChanged();
      router.refresh();
      appToast.success('Your review has been submitted.', { title: 'Review shared' });
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not publish your review. Please try again.');
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  }

  return (
    <dialog ref={dialog} className={styles.dialog} aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); void dismiss(); }}
      onClick={(event) => { if (event.target === event.currentTarget) void dismiss(); }}>
      <motion.div className={styles.sheet} animate={animation} drag={mobile ? 'y' : false} dragControls={drag} dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.6 }} dragSnapToOrigin
        onDragEnd={(_, info) => { if (info.offset.y > 70 || (info.offset.y > 15 && info.velocity.y > 600)) void dismiss(); }}>
        <header className={styles.header}
          onPointerDown={(event) => { if (mobile && !(event.target as HTMLElement).closest('button')) drag.start(event); }}
          style={{ touchAction: mobile ? 'none' : 'auto' }}>
          <div className={styles.handle} aria-hidden="true" />
          <div className="flex items-center justify-between gap-3">
            <div><p className="ui-kicker">Your perspective</p><h2 id={titleId} className="mt-2 text-3xl font-bold leading-none sm:text-4xl">Write a review</h2></div>
            <button ref={closeButton} type="button" onClick={() => void dismiss()} disabled={submitting} aria-label="Close review"
              className={styles.close}><X size={20} aria-hidden="true" /></button>
          </div>
        </header>
        {!isAuthenticated ? <div className="px-6 pb-6"><p className="mb-4 text-sm text-[var(--ink-muted)]">Sign in to share your review.</p><Link href="/auth/login" className="ui-primary-action">Sign in</Link></div>
          : banStatus.banned ? <div className="px-6 pb-6" role="status"><p className="font-semibold">Reviews temporarily paused</p><p className="mt-2 text-sm text-[var(--ink-muted)]">You can write again in {banStatus.timeRemaining || 'a little while'}.</p></div>
          : <form className={styles.form} onSubmit={submit}>
            <div className={styles.compose}>
            <aside className={styles.context} aria-label="Title being reviewed">
              {posterPath ? <TmdbImage src={tmdbImage(posterPath, 'w500')} alt="" width={240} height={360} className={styles.poster} /> : null}
              <div><span className={styles.type}>{contentType === 'tv' ? 'Series' : 'Film'}</span><h3>{title || 'Your viewing notes'}</h3><p className={styles.contextNote}>A little perspective goes a long way.</p></div>
              <span className={styles.contextFooter}>A Moodies audience review</span>
            </aside>
            <div className={styles.fields}>
              <StarRating value={rating} onChange={setRating} disabled={submitting} />
              <fieldset disabled={submitting}>
                <legend className={styles.label}>The feeling it left</legend>
                <div className={styles.moods}>
                  {MOODS.map((option) => <label key={option.image} className={styles.mood}>
                    <input className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0" type="radio" name={`${titleId}-mood`} checked={mood === option.image} onChange={() => setMood(option.image)} />
                    <TmdbImage src={`/images/review-icons/${option.image}.png`} alt="" width={28} height={28} className={styles.moodIcon} />
                    {option.label}
                  </label>)}
                </div>
              </fieldset>
              <div>
                <div className="mb-2 flex items-center justify-between gap-2"><label htmlFor={textId} className={styles.label}>Your review</label><span className="text-xs tabular-nums text-[var(--ink-muted)]">{content.length}/1,000</span></div>
                <textarea id={textId} value={content} onChange={(event) => setContent(event.target.value)} maxLength={1000} minLength={10} required disabled={submitting}
                  aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} placeholder="The scene that stayed with you. The detail that made it work. Your honest take."
                  className={styles.textarea} />
              </div>
              {error ? <p id={errorId} role="alert" className="text-sm text-brand-coral-strong">{error}</p> : null}
            </div>
            </div>
            <footer className={`${styles.footer} flex shrink-0 items-center justify-between gap-3`}>
              <p className={styles.author}><span className={styles.avatar} aria-hidden="true">{(user?.username || user?.name || 'Y').slice(0, 1).toUpperCase()}</span><span><small>Sharing as</small><strong>{user?.username || user?.name || 'you'}</strong></span></p>
              <button type="submit" disabled={submitting || !rating || !mood || content.trim().length < 10} className="ui-primary-action shrink-0">
                {submitting ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}{submitting ? 'Publishing…' : 'Publish review'}{!submitting ? <ArrowUpRight size={16} aria-hidden="true" /> : null}
              </button>
            </footer>
          </form>}
      </motion.div>
    </dialog>
  );
}
