"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Pause, Play } from "lucide-react";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import { Skeleton } from "@/components/ui/skeleton";
import { tmdbImage } from "@/lib/tmdb";
import MoodTrailerBackdrop from "./MoodTrailerBackdrop";
import styles from "./MoodNightPreview.module.css";
import { moodNightChoices, parseNightPreview, selectNightPreview } from "./mood-night-data";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "https://dev.api.moodies.tech/api").replace(/\/$/, "");
type Preview = ReturnType<typeof parseNightPreview>;

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
  return <section ref={sectionRef} id="your-moods" className="relative isolate scroll-mt-24 overflow-clip border-b border-[var(--surface-border)] bg-[var(--surface-0)]" aria-labelledby="mood-shelf-heading">
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {backdrop && <Image key={backdrop} src={tmdbImage(backdrop, "w1280")} alt="" fill sizes="100vw" className={`${styles.backdrop} object-cover`} />}
      {activeTrailer && motionAllowed && visible && pageVisible && !paused && <MoodTrailerBackdrop key={activeTrailer.key} videoKey={activeTrailer.key} onPlaying={onPlaying} />}
      <div className={`${styles.sceneShade} absolute inset-0`} />
      <div className="absolute inset-0" style={{ background: `linear-gradient(105deg, transparent 35%, ${mood.color}08 100%)` }} />
      <div className={`${styles.sceneEdges} absolute inset-0`} />
    </div>
    <div className={`${styles.content} ui-shell relative grid items-center gap-6 py-12 sm:py-16 lg:min-h-[34rem] lg:grid-cols-[minmax(15rem,0.72fr)_minmax(0,1.28fr)] lg:gap-12 lg:py-20`}>
      <div className="min-w-0">
        <p className="ui-kicker">Choose by mood</p>
        <h2 id="mood-shelf-heading" className="mt-3 max-w-lg text-3xl font-bold leading-none text-[var(--ink)] sm:text-4xl">What kind of night is this?</h2>
        <p className="mt-3 max-w-md text-sm leading-6 text-[var(--ink-muted)]">Set the mood, then choose a story. Tap a pick to bring its world into the background.</p>
        <Link href="/moods" className={`mt-5 inline-flex min-h-11 items-center gap-2 rounded-sm text-sm font-semibold text-[var(--brand-coral-strong)] ${focus}`}>Explore the mood wheel <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
        {activeItem && <div className={styles.nowShowing}>
          <div aria-live="polite" aria-atomic="true">
            <p className="flex items-center gap-2 text-xs font-semibold text-[var(--ink-muted)]">
              <span className={styles.statusDot} data-playing={playing && !paused} aria-hidden="true" />
              {activeTrailer && motionAllowed ? paused ? "Preview paused" : playing ? "Now playing" : "Trailer preview" : "Artwork preview"}
            </p>
            <p className={`${styles.credit} mt-2 text-xl font-bold leading-tight text-[var(--ink)]`}>{activeItem.title}</p>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Link href={`/${activeItem.type === "movie" ? "movies" : "tv"}/${activeItem.id}`} className={`inline-flex min-h-11 items-center gap-2 rounded-sm text-sm font-semibold text-[var(--brand-coral-strong)] ${focus}`}>Explore {activeItem.type === "movie" ? "movie" : "series"}<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
            {activeTrailer && motionAllowed && <button type="button" onClick={() => setPaused(value => !value)} aria-pressed={paused} className={`inline-flex min-h-11 items-center gap-1.5 rounded-sm text-xs text-[var(--ink)] ${focus}`}>{paused ? <Play className="h-3.5 w-3.5" aria-hidden="true" /> : <Pause className="h-3.5 w-3.5" aria-hidden="true" />}{paused ? "Play background" : "Pause background"}</button>}
          </div>
        </div>}
      </div>
      <div className="min-w-0">
        <div className={styles.choices} role="group" aria-label="Choose a mood">
          {moodNightChoices.map(choice => <button key={choice.id} type="button" onClick={() => { if (choice.id !== selection) { setSelection(choice.id); setSelectedPick(null); setPaused(false); setPlaying(false); setFailedSelection(null); } }} aria-controls="landing-mood-preview" aria-pressed={choice.id === selection} className={`${styles.choice} relative min-h-12 min-w-0 py-3 text-sm font-semibold transition-colors motion-reduce:transition-none sm:text-xl ${focus} ${choice.id === selection ? "text-[var(--ink)]" : "text-[var(--ink-muted)] hover:text-[var(--ink)]"}`}>
            {choice.label}<span aria-hidden="true" className={`absolute inset-x-0 bottom-0 h-0.5 origin-left transition-transform duration-300 motion-reduce:transition-none ${choice.id === selection ? "scale-x-100" : "scale-x-0"}`} style={{ backgroundColor: choice.color }} />
          </button>)}
        </div>
        <div id="landing-mood-preview" className="mt-5">
          <div className="flex min-h-24 items-center gap-4">
            <Image src={`/images/moods/${mood.mascot}.png`} alt={`${mood.mascotName} mood mascot`} width={96} height={96} unoptimized className="h-20 w-20 shrink-0 object-contain sm:h-24 sm:w-24" />
            <div className={styles.copy} aria-live="polite" aria-atomic="true"><h3 className="text-base font-bold text-[var(--ink)] sm:text-lg">{mood.id === "easy" || mood.id === "electric" ? "An" : "A"} {mood.label.toLowerCase()} night</h3><p className="mt-1 max-w-xl text-sm leading-6 text-[var(--ink-muted)]">{mood.note}</p></div>
          </div>
          <div aria-busy={!preview && !failed} className="mt-5 min-h-28">
            {!preview && !failed ? <><p role="status" className="sr-only">Loading {mood.label.toLowerCase()} night picks</p><div aria-hidden="true" className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[0, 1, 2, 3].map(i => <Skeleton key={i} className={`${styles.pickSkeleton} h-28 rounded-lg`} />)}</div></>
              : preview?.items.length ? <>
                <p className="mb-3 text-xs text-[var(--ink-muted)]">Choose a pick to change the scene</p>
                <div role="group" aria-label="Choose a story preview" className="grid grid-cols-2 gap-3 sm:grid-cols-4">{preview.items.map(item => {
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
