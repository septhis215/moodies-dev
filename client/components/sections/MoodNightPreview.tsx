"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Pause, Play } from "lucide-react";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import { Skeleton } from "@/components/ui/skeleton";
import { tmdbImage } from "@/lib/tmdb";
import MoodTrailerBackdrop from "./MoodTrailerBackdrop";
import styles from "./MoodNightPreview.module.css";
import { findNightMoodId, findNightTrailer, moodNightChoices, normalizeNightItems, type MoodNightItem } from "./mood-night-data";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "https://dev.api.moodies.tech/api").replace(/\/$/, "");
type Preview = { items: MoodNightItem[]; trailer: ReturnType<typeof findNightTrailer>; trailersLoaded: boolean };

export default function MoodNightPreview() {
  const [selection, setSelection] = useState<string>(moodNightChoices[0].id);
  const mood = moodNightChoices.find(item => item.id === selection) ?? moodNightChoices[0];
  const sectionRef = useRef<HTMLElement>(null);
  const cache = useRef(new Map<string, Preview>());
  const [nearby, setNearby] = useState(false);
  const [visible, setVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [motionAllowed, setMotionAllowed] = useState(false);
  const [moods, setMoods] = useState<unknown>(null);
  const [moodsFailed, setMoodsFailed] = useState(false);
  const [results, setResults] = useState<{ mood: string; data: Preview } | null>(null);
  const [failedSelection, setFailedSelection] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [playing, setPlaying] = useState(false);
  const onPlaying = useCallback((value: boolean) => setPlaying(value), []);
  const preview = results?.mood === selection ? results.data : null;
  const failed = moodsFailed || failedSelection === selection;
  const backdrop = preview?.trailer?.item.backdrop ?? preview?.items.find(item => item.backdrop)?.backdrop;

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
    const controller = new AbortController();
    let cancelled = false;
    const timer = window.setTimeout(() => controller.abort(), 12000);
    fetch(`${API_BASE}/moods`, { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error("Moods unavailable"); return response.json(); })
      .then(data => { if (!cancelled) setMoods(data); })
      .catch(() => { if (!cancelled) setMoodsFailed(true); })
      .finally(() => window.clearTimeout(timer));
    return () => { cancelled = true; controller.abort(); window.clearTimeout(timer); };
  }, [nearby]);

  useEffect(() => {
    if (!moods) return;
    const cached = cache.current.get(selection);
    if (cached) {
      setResults({ mood: selection, data: cached });
      if (cached.trailersLoaded || !motionAllowed) return;
    }
    const moodId = findNightMoodId(moods, mood.mascotName);
    if (!moodId) { setFailedSelection(selection); return; }
    const controller = new AbortController();
    let cancelled = false;
    const timer = window.setTimeout(() => controller.abort(), 15000);
    const load = async () => {
      try {
        const query = new URLSearchParams({ moodId, mediaType: "both", limit: "4", page: "1", shuffle: "false" });
        let items = cached?.items;
        if (!items) {
          const response = await fetch(`${API_BASE}/moods/recommendations?${query}`, { signal: controller.signal });
          if (!response.ok) throw new Error("Recommendations unavailable");
          items = normalizeNightItems(await response.json());
        }
        if (cancelled) return;
        const data: Preview = { items, trailer: null, trailersLoaded: items.length === 0 };
        cache.current.set(selection, data);
        setResults({ mood: selection, data });
        // One batch through the Moodies API; trailers never call TMDB directly.
        if (items.length && motionAllowed) {
          let trailer: Preview["trailer"] = null;
          try {
            const videos = await fetch(`${API_BASE}/all/batch/trailers`, {
              method: "POST", signal: controller.signal,
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(items.map(({ id, type }) => ({ id, type }))),
            });
            if (videos.ok) trailer = findNightTrailer(await videos.json(), items);
          } catch { /* Recommendations and still artwork remain available. */ }
          if (cancelled) return;
          const complete = { ...data, trailer, trailersLoaded: true };
          cache.current.set(selection, complete);
          setResults({ mood: selection, data: complete });
        }
      } catch { if (!cancelled) setFailedSelection(selection); }
      finally { window.clearTimeout(timer); }
    };
    void load();
    return () => { cancelled = true; controller.abort(); window.clearTimeout(timer); };
  }, [moods, selection, mood.mascotName, motionAllowed]);

  const focus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-coral-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)]";
  return <section ref={sectionRef} id="your-moods" className="relative isolate scroll-mt-24 overflow-hidden border-b border-[var(--surface-border)] bg-[var(--surface-0)]" aria-labelledby="mood-shelf-heading">
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {backdrop && <Image key={backdrop} src={tmdbImage(backdrop, "w1280")} alt="" fill sizes="100vw" className="object-cover opacity-60" />}
      {preview?.trailer && motionAllowed && visible && pageVisible && !paused && <MoodTrailerBackdrop key={preview.trailer.key} videoKey={preview.trailer.key} onPlaying={onPlaying} />}
      <div className="absolute inset-0 bg-[var(--surface-0)]/55" />
      <div className="absolute inset-0" style={{ background: `linear-gradient(105deg, var(--surface-0) 5%, ${mood.color}20 100%)` }} />
      <div className="absolute inset-0 bg-gradient-to-t from-[var(--surface-0)] via-transparent to-[var(--surface-0)]/40" />
    </div>
    <div className="ui-shell relative grid items-center gap-6 py-8 sm:py-10 lg:grid-cols-[minmax(15rem,0.72fr)_minmax(0,1.28fr)] lg:gap-12">
      <div className="min-w-0">
        <p className="ui-kicker">Choose by mood</p>
        <h2 id="mood-shelf-heading" className="mt-3 max-w-lg text-3xl font-bold leading-none text-[var(--ink)] sm:text-4xl">What kind of night is this?</h2>
        <p className="mt-3 max-w-md text-sm leading-6 text-[var(--ink-muted)]">Pick a feeling. Find movies and series for tonight, with a glimpse of the stories waiting for you.</p>
        <Link href="/moods" className={`mt-5 inline-flex min-h-11 items-center gap-2 rounded-sm text-sm font-semibold text-[var(--brand-coral-strong)] ${focus}`}>Explore the mood wheel <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
        {preview?.trailer && <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link href={`/${preview.trailer.item.type === "movie" ? "movies" : "tv"}/${preview.trailer.item.id}`} className={`${styles.credit} inline-flex min-h-11 items-center rounded-sm text-sm text-[var(--ink-muted)] hover:text-[var(--ink)] ${focus}`}>Trailer preview: {preview.trailer.item.title}</Link>
          {motionAllowed && (playing || paused) && <button type="button" onClick={() => setPaused(value => !value)} aria-pressed={paused} className={`inline-flex min-h-11 items-center gap-1.5 rounded-sm text-xs text-[var(--ink)] ${focus}`}>{paused ? <Play className="h-3.5 w-3.5" aria-hidden="true" /> : <Pause className="h-3.5 w-3.5" aria-hidden="true" />}{paused ? "Play background" : "Pause background"}</button>}
        </div>}
      </div>
      <div className="min-w-0">
        <div className={styles.choices} role="group" aria-label="Choose a mood">
          {moodNightChoices.map(choice => <button key={choice.id} type="button" onClick={() => { if (choice.id !== selection) { setSelection(choice.id); setFailedSelection(null); } }} aria-controls="landing-mood-preview" aria-pressed={choice.id === selection} className={`${styles.choice} relative min-h-12 min-w-0 py-3 text-sm font-semibold transition-colors motion-reduce:transition-none sm:text-xl ${focus} ${choice.id === selection ? "text-[var(--ink)]" : "text-[var(--ink-muted)] hover:text-[var(--ink)]"}`}>
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
              : preview?.items.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{preview.items.map(item => <Link key={`${item.type}-${item.id}`} href={`/${item.type === "movie" ? "movies" : "tv"}/${item.id}`} aria-label={`${item.title} (${item.type === "movie" ? "Movie" : "Series"})`} className={`${styles.pick} group flex min-w-0 gap-2 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-0)]/70 p-2 transition-colors hover:border-[var(--brand-coral-strong)] motion-reduce:transition-none ${focus}`}>
                <Image src={item.poster ? tmdbImage(item.poster, "w185") : "/placeholder-poster.svg"} alt="" width={44} height={66} className={`${styles.poster} h-16 w-11 shrink-0 rounded object-cover`} />
                <div className={`${styles.pickCopy} min-w-0 self-center`}><p className={`${styles.pickTitle} line-clamp-2 text-sm font-semibold leading-5 text-[var(--ink)]`}>{item.title}</p><p className="mt-1 text-xs text-[var(--ink-muted)]">{item.type === "movie" ? "Movie" : "Series"}</p></div>
              </Link>)}</div>
                : <p role="status" className="text-sm leading-6 text-[var(--ink-muted)]">{failed ? "Tonight’s picks couldn’t load. Try the mood wheel for more ways to explore." : "No picks for this mood just yet. Try another feeling or explore the mood wheel."}</p>}
          </div>
        </div>
      </div>
    </div>
  </section>;
}
