"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Pause, Play } from "lucide-react";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import { Skeleton } from "@/components/ui/skeleton";
import { BadgeMascot } from "@/components/ui/BadgeMascot";
import { tmdbImage } from "@/lib/tmdb";
import MoodTrailerBackdrop from "./MoodTrailerBackdrop";
import styles from "./MoodNightPreview.module.css";
import { moodNightChoices, parseNightPreview, selectNightPreview } from "./mood-night-data";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "https://dev.api.moodies.tech/api").replace(/\/$/, "");
type Preview = ReturnType<typeof parseNightPreview>;
const nightMascots = { easy: "comfort-watcher", tense: "horror-survivor", tender: "romance-dreamer", strange: "personality-seeker", electric: "action-chaser" } as const;

export default function MoodNightPreview() {
  const [selection, setSelection] = useState<string>(moodNightChoices[0].id);
  const mood = moodNightChoices.find(item => item.id === selection) ?? moodNightChoices[0];
  const sectionRef = useRef<HTMLElement>(null);
  const cache = useRef(new Map<string, Preview>());
  const [nearby, setNearby] = useState(false);
  const [visible, setVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [motionAllowed, setMotionAllowed] = useState(false);
  const [results, setResults] = useState<{ mood: string; data: Preview } | null>(null);
  const [failedSelection, setFailedSelection] = useState<string | null>(null);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [paused, setPaused] = useState(false);
  const [selectedPick, setSelectedPick] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const onPlaying = useCallback((value: boolean) => setPlaying(value), []);
  const preview = results?.mood === selection ? results.data : null;
  const failed = failedSelection === selection;
  const { item: activeItem, trailer: activeTrailer } = selectNightPreview(preview, selectedPick);
  const backdrop = activeItem?.backdrop ?? activeItem?.poster ?? preview?.items.find(item => item.backdrop)?.backdrop;

  useEffect(() => {
    const element = sectionRef.current;
    if (!element) return;
    const preload = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setNearby(true); }, { rootMargin: "200px" });
    const viewport = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.15 });
    preload.observe(element);
    viewport.observe(element);
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    const updateMotion = () => setMotionAllowed(!preference.matches && !connection?.saveData);
    const updateVisibility = () => setPageVisible(document.visibilityState === "visible");
    updateMotion();
    updateVisibility();
    preference.addEventListener("change", updateMotion);
    document.addEventListener("visibilitychange", updateVisibility);
    return () => { preload.disconnect(); viewport.disconnect(); preference.removeEventListener("change", updateMotion); document.removeEventListener("visibilitychange", updateVisibility); };
  }, []);

  useEffect(() => {
    if (!nearby) return;
    const cached = cache.current.get(selection);
    if (cached) {
      setResults({ mood: selection, data: cached });
      return;
    }
    const controller = new AbortController();
    let cancelled = false;
    const timer = window.setTimeout(() => controller.abort(), 30000);
    const load = async () => {
      try {
        // One database-backed response contains both picks and the selected trailer.
        const response = await fetch(`${API_BASE}/moods/night-preview/${selection}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Preview unavailable");
        const data = parseNightPreview(await response.json());
        if (!data.items.length) throw new Error("Preview unavailable");
        if (cancelled) return;
        cache.current.set(selection, data);
        setResults({ mood: selection, data });
        setFailedSelection(null);
      } catch { if (!cancelled) setFailedSelection(selection); }
      finally { window.clearTimeout(timer); }
    };
    void load();
    return () => { cancelled = true; controller.abort(); window.clearTimeout(timer); };
  }, [nearby, selection, retryAttempt]);

  const focus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-coral-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)]";
  return <section ref={sectionRef} id="your-moods" className={`${styles.section} scroll-mt-24`} aria-labelledby="mood-shelf-heading">
    <div className="ui-shell py-8 sm:py-10 lg:py-8">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <p className="ui-kicker">Choose by mood</p>
          <h2 id="mood-shelf-heading" className="mt-2 text-3xl font-bold leading-none text-[var(--ink)] sm:text-4xl">What kind of night is this?</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ink-muted)]">Pick a feeling. Find a story for tonight.</p>
        </div>
        <Link href="/moods" className={`inline-flex min-h-11 items-center gap-2 rounded-sm text-sm font-semibold text-[var(--brand-coral-strong)] ${focus}`}>Explore the mood wheel <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
      </header>
      <div className={styles.layout}>
        <div className={styles.choices} role="group" aria-label="Choose a mood">
          {moodNightChoices.map(choice => <button key={choice.id} type="button" onClick={() => { if (choice.id !== selection) { setSelection(choice.id); setSelectedPick(null); setPaused(false); setPlaying(false); setFailedSelection(null); } }} aria-controls="landing-mood-preview" aria-pressed={choice.id === selection} className={`${styles.choice} text-sm font-semibold ${focus}`}>
            <span aria-hidden="true" className={styles.moodDot} style={{ backgroundColor: choice.color }} />{choice.label}
          </button>)}
        </div>
        <div className={styles.scene}>
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <div className={`${styles.sceneMedia} absolute inset-0`}>
      {backdrop && <Image key={backdrop} src={tmdbImage(backdrop, "w1280")} alt="" fill sizes="100vw" className={`${styles.backdrop} object-cover`} />}
      {activeTrailer && motionAllowed && visible && pageVisible && !paused && <MoodTrailerBackdrop key={activeTrailer.key} videoKey={activeTrailer.key} onPlaying={onPlaying} />}
      </div>
      <div className={`${styles.sceneShade} absolute inset-0`} />
    </div>
        {activeItem && <div className={styles.nowShowing}>
          <div aria-live="polite" aria-atomic="true">
            <p className="flex items-center gap-2 text-xs font-semibold text-white/80">
              <span className={styles.statusDot} data-playing={playing && !paused} aria-hidden="true" />
              {activeTrailer && motionAllowed ? paused ? "Preview paused" : playing ? "Now playing" : "Trailer preview" : "Artwork preview"}
            </p>
            <p className={`${styles.credit} mt-2 text-xl font-bold leading-tight text-white`}>{activeItem.title}</p>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Link href={`/${activeItem.type === "movie" ? "movies" : "tv"}/${activeItem.id}`} className={`inline-flex min-h-11 items-center gap-2 rounded-sm text-sm font-semibold text-[var(--brand-coral-strong)] ${focus}`}>Explore {activeItem.type === "movie" ? "movie" : "series"}<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
            {activeTrailer && motionAllowed && <button type="button" onClick={() => setPaused(value => !value)} aria-pressed={paused} className={`inline-flex min-h-11 items-center gap-1.5 rounded-sm text-xs text-white ${focus}`}>{paused ? <Play className="h-3.5 w-3.5" aria-hidden="true" /> : <Pause className="h-3.5 w-3.5" aria-hidden="true" />}{paused ? "Play preview" : "Pause preview"}</button>}
          </div>
        </div>}
        {!activeItem && <p className={`${styles.scenePlaceholder} text-sm text-[var(--ink-muted)]`}>{failed ? "Your next story starts with a feeling." : "Finding a story for your night…"}</p>}
      </div>
        <div id="landing-mood-preview" className={styles.recommendations}>
          <div className="mb-4 flex min-h-16 items-center gap-3 lg:mb-3 lg:min-h-12">
            <BadgeMascot name={nightMascots[mood.id]} alt={`${mood.label} night guide`} sizes="(min-width: 1024px) 48px, 64px" className="h-16 w-16 shrink-0 lg:h-12 lg:w-12" />
            <div className={styles.copy} aria-live="polite" aria-atomic="true"><h3 className="text-base font-bold text-[var(--ink)] sm:text-lg">{mood.id === "easy" || mood.id === "electric" ? "An" : "A"} {mood.label.toLowerCase()} night</h3><p className="mt-1 max-w-xl text-sm leading-6 text-[var(--ink-muted)]">{mood.note}</p></div>
          </div>
          <div aria-busy={!preview && !failed} className="min-h-28">
            {!preview && !failed ? <><p role="status" className="sr-only">Loading {mood.label.toLowerCase()} night picks</p><div aria-hidden="true" className={styles.picks}>{[0, 1, 2, 3].map(i => <Skeleton key={i} className={`${styles.pickSkeleton} rounded-lg`} />)}</div></>
              : preview?.items.length ? <>
                <p className="mb-3 text-xs text-[var(--ink-muted)]">Tap a story to preview it</p>
                <div role="group" aria-label="Choose a story preview" className={styles.picks}>{preview.items.map(item => {
                  const key = `${item.type}-${item.id}`;
                  const selected = activeItem?.id === item.id && activeItem.type === item.type;
                  const hasTrailer = preview.trailers.some(trailer => trailer.item.id === item.id && trailer.item.type === item.type);
                  return <div key={key} className={`${styles.pickCard} ${selected ? styles.selected : ""}`}>
                    <button type="button" aria-pressed={selected} aria-label={`Preview ${item.title}${hasTrailer ? " trailer" : " artwork"}`} onClick={() => { if (!selected) { setSelectedPick(key); setPaused(false); setPlaying(false); } }} className={`${styles.pick} flex w-full min-w-0 gap-2 p-3 text-left ${focus}`}>
                      <span className={styles.posterWrap}>
                        <Image src={item.poster ? tmdbImage(item.poster, "w185") : "/placeholder-poster.svg"} alt="" width={44} height={66} className={`${styles.poster} h-16 w-11 rounded object-cover`} />
                        {hasTrailer && <span className={styles.playIcon}><Play className="h-3 w-3" aria-hidden="true" /></span>}
                      </span>
                      <span className={`${styles.pickCopy} min-w-0 self-center`}><span className={`${styles.pickTitle} line-clamp-2 text-sm font-semibold leading-5 text-[var(--ink)]`}>{item.title}</span><span className="mt-1 block text-xs text-[var(--ink-muted)]">{item.type === "movie" ? "Movie" : "Series"}</span><span className={`${styles.previewLabel} mt-2 block text-xs font-semibold`}>{selected ? "Selected" : hasTrailer ? "Preview trailer" : "Preview artwork"}</span></span>
                    </button>
                    <Link href={`/${item.type === "movie" ? "movies" : "tv"}/${item.id}`} aria-label={`View ${item.title} details`} className={`${styles.detailsLink} ${focus}`}>View details<ArrowRight className="h-3 w-3" aria-hidden="true" /></Link>
                  </div>;
                })}</div>
              </>
                : <div><p role="status" className="text-sm leading-6 text-[var(--ink-muted)]">{failed ? "Tonight’s picks couldn’t load. Try again or explore the mood wheel." : "No picks for this mood just yet. Try another feeling or explore the mood wheel."}</p>{failed && <button type="button" onClick={() => { setFailedSelection(null); setRetryAttempt(value => value + 1); }} className={`mt-2 inline-flex min-h-11 items-center rounded-sm text-sm font-semibold text-[var(--brand-coral-strong)] ${focus}`}>Try again</button>}</div>}
          </div>
        </div>
      </div>
    </div>
  </section>;
}
