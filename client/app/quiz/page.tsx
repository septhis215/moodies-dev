"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Check, ArrowLeft, ArrowRight, X } from "lucide-react";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import { RatingBadge } from "@/components/ui/rating-badge";
import { tmdbImage } from "@/lib/tmdb";
import { apiRequest } from "@/lib/errors/api-client";
import { handleAppError } from "@/lib/errors/handle-app-error";
import { QUIZ_SIGNALS, getMoodMascotSrc } from "./quiz-signals";

type Stage = "welcome" | "quiz" | "loading" | "results" | "error";
type MovieItem = {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string;
  backdrop_path?: string;
  vote_average: number;
  overview?: string;
  release_date?: string;
  first_air_date?: string;
  media_type?: string;
  matchScore?: number;
  matchReasons?: string[];
};
type ResponseData = {
  results: MovieItem[];
  partialResults?: boolean;
  analysis?: { rankingVersion?: string };
};
const STORAGE_KEY = "moodies:quiz:signal-reel:v1";
const emptyAnswers = () => QUIZ_SIGNALS.map(() => null as number | null);
const titleOf = (item: MovieItem) => item.title || item.name || "Untitled";
const detailUrl = (item: MovieItem) =>
  `/${item.media_type === "tv" ? "tv" : "movies"}/${item.id}`;
const posterOf = (item: MovieItem) =>
  item.poster_path
    ? tmdbImage(item.poster_path, "w500")
    : "/placeholder-poster.svg";
const reasonOf = (item: MovieItem) =>
  item.matchReasons?.[0] ||
  "A genre-led suggestion from the available catalogue.";
const focusClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--brand-coral)]";

export default function MovieQuizPage() {
  const [stage, setStage] = useState<Stage>("welcome");
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(emptyAnswers);
  const [ready, setReady] = useState(false);
  const [resumed, setResumed] = useState(false);
  const [result, setResult] = useState<ResponseData | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedMovie, setSelectedMovie] = useState<MovieItem | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(
        sessionStorage.getItem(STORAGE_KEY) || "null",
      ) as { answers?: unknown; current?: unknown } | null;
      if (
        saved &&
        Array.isArray(saved.answers) &&
        saved.answers.length === QUIZ_SIGNALS.length &&
        saved.answers.every(
          (value, i) =>
            value === null ||
            (Number.isInteger(value) &&
              Number(value) >= 0 &&
              Number(value) < QUIZ_SIGNALS[i].options.length),
        ) &&
        Number.isInteger(saved.current) &&
        Number(saved.current) >= 0 &&
        Number(saved.current) < QUIZ_SIGNALS.length
      ) {
        setAnswers(saved.answers as (number | null)[]);
        setCurrent(Number(saved.current));
        setResumed(true);
        setStage("quiz");
      }
    } catch {
      /* Storage is optional; private browsing must still work. */
    }
    setReady(true);
    return () => {
      requestRef.current?.abort();
      requestRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready || stage === "welcome") return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ answers, current }));
    } catch {
      /* Optional persistence. */
    }
  }, [answers, current, ready, stage]);

  useEffect(() => {
    if (stage !== "welcome") headingRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [stage, current]);

  useEffect(() => {
    if (!selectedMovie || !dialogRef.current) return;
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    closeRef.current?.focus();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus({ preventScroll: true });
    };
  }, [selectedMovie]);

  const allAnswered = answers.every((answer) => answer !== null);
  const choice = (index: number) =>
    answers[index] === null
      ? null
      : QUIZ_SIGNALS[index].options[answers[index]!];
  const start = () => {
    requestRef.current?.abort();
    requestRef.current = null;
    setAnswers(emptyAnswers());
    setCurrent(0);
    setResult(null);
    setResumed(false);
    setStage("quiz");
  };
  const exit = () => {
    requestRef.current?.abort();
    requestRef.current = null;
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* Optional persistence. */
    }
    setStage("welcome");
    setAnswers(emptyAnswers());
    setCurrent(0);
    setResumed(false);
  };
  const submit = async () => {
    if (!allAnswered) return;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 30000);
    setStage("loading");
    try {
      const base =
        process.env.NEXT_PUBLIC_API_URL || "https://dev.api.moodies.tech/api";
      const data = await apiRequest<ResponseData>(
        `${base}/quiz/recommendations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            answers: QUIZ_SIGNALS.map((signal, i) => ({
              ...choice(i),
              category: signal.category,
            })),
          }),
        },
      );
      if (
        !Array.isArray(data.results) ||
        data.results.some((item) => !item || typeof item.id !== "number")
      )
        throw new Error("Invalid recommendations");
      if (requestRef.current !== controller) return;
      const unique = new Map(
        data.results
          .filter(
            (item) => item.media_type === "movie" || item.media_type === "tv",
          )
          .map((item) => [`${item.media_type}-${item.id}`, item]),
      );
      setResult({ ...data, results: [...unique.values()].slice(0, 12) });
      setStage("results");
    } catch (error) {
      if (requestRef.current === controller) {
        const normalized = handleAppError(error, {
          showToast: false,
          log: false,
        });
        setErrorMessage(
          controller.signal.aborted
            ? "The request took too long. Please retry."
            : normalized.userMessage,
        );
        setStage("error");
      }
    } finally {
      clearTimeout(timeout);
    }
  };
  const question = QUIZ_SIGNALS[current];
  const topPick = result?.results[0];
  const remainingPicks = result?.results.slice(1) ?? [];
  const ranked = result?.analysis?.rankingVersion === "genre-proxy-v1";

  return (
    <div className="min-h-screen bg-[var(--surface-0)] text-[var(--ink)]">
      <div className="ui-shell py-6 sm:py-10 lg:pt-24">
        {stage === "welcome" && (
          <section
            aria-labelledby="quiz-welcome"
            className="mx-auto grid max-w-4xl items-center gap-6 py-6 sm:grid-cols-[minmax(0,1fr)_240px] sm:py-12"
          >
            <div>
              <p className="ui-kicker">
                Personality Quiz · five viewing signals
              </p>
              <h1
                id="quiz-welcome"
                className="mt-3 text-balance text-[2.1rem] font-bold leading-[0.98] min-[390px]:text-[2.45rem] sm:text-[clamp(2.45rem,4.6vw,4rem)]"
              >
                A little about you.
                <br />A better next watch.
              </h1>
              <p className="mt-4 max-w-xl text-base leading-7 text-[var(--ink-muted)]">
                Choose a feeling, pace, story, format and time window. We’ll
                turn those choices into a shortlist.
              </p>
              <button
                onClick={start}
                disabled={!ready}
                className={`ui-primary-action mt-6 min-h-11 ${focusClass}`}
              >
                Start quiz <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
              <p className="mt-4 text-xs text-[var(--ink-muted)]">
                Playful guide, not a diagnosis.
              </p>
              <Link
                href="/moods"
                className={`mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)] ${focusClass}`}
              >
                Browse mood tools instead
              </Link>
            </div>
            <Image
              src="/images/moodies-mascot.png"
              alt="Moodies guide"
              width={240}
              height={280}
              priority
              className="mx-auto w-36 object-contain sm:w-60"
            />
          </section>
        )}

        {stage === "quiz" && (
          <section
            aria-labelledby="quiz-question"
            className="mx-auto max-w-2xl"
          >
            <div className="mb-5 flex items-center justify-between gap-4">
              <p className="ui-kicker">Your signal reel</p>
              <button
                onClick={exit}
                className={`min-h-11 px-2 text-sm text-[var(--ink-muted)] hover:text-[var(--ink)] ${focusClass}`}
              >
                Exit quiz
              </button>
            </div>
            <ol
              className="grid grid-cols-5 gap-1.5 sm:gap-3"
              aria-label={`${answers.filter((a) => a !== null).length} of 5 signals answered`}
            >
              {QUIZ_SIGNALS.map((signal, i) => (
                <li key={signal.category}>
                  <button
                    onClick={() => setCurrent(i)}
                    disabled={answers[i] === null && i !== current}
                    aria-current={i === current ? "step" : undefined}
                    aria-label={`${signal.label}: ${choice(i)?.text ?? "not answered"}`}
                    className={`flex min-h-20 w-full min-w-0 flex-col justify-between rounded-md border px-1.5 py-2 text-left sm:px-3 ${focusClass} ${i === current ? "border-[var(--brand-coral)] bg-[var(--surface-2)]" : "border-[var(--surface-border)] bg-[var(--surface-1)]"}`}
                  >
                    <span className="flex items-center justify-between gap-1 text-xs text-[var(--ink-muted)]">
                      {i + 1}
                      {answers[i] !== null && (
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                    </span>
                    <span className="truncate text-xs font-semibold">
                      {signal.label}
                    </span>
                    <span className="w-full truncate text-xs text-[var(--ink-muted)]">
                      {choice(i)?.label ?? (i === current ? "Now" : "—")}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
            {resumed && (
              <p className="mt-3 text-xs text-[var(--ink-muted)]">
                Your saved answers are here. Continue or change any completed
                signal.
              </p>
            )}
            <p className="mt-6 text-sm text-[var(--ink-muted)]">
              Question {current + 1} of 5 · Choose one
            </p>
            <h1
              ref={headingRef}
              tabIndex={-1}
              id="quiz-question"
              className="mt-2 text-3xl font-bold leading-tight outline-none sm:text-4xl"
            >
              {question.question}
            </h1>
            <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
              {question.hint}
            </p>
            <div
              className="mt-5 grid gap-3"
              role="group"
              aria-label="Answer choices"
            >
              {question.options.map((option, i) => (
                <button
                  key={`${question.category}-${i}`}
                  aria-pressed={answers[current] === i}
                  onClick={() =>
                    setAnswers((old) =>
                      old.map((answer, index) =>
                        index === current ? i : answer,
                      ),
                    )
                  }
                  className={`flex min-h-16 items-center gap-3 rounded-md border px-4 py-3 text-left text-base transition-colors motion-reduce:transition-none ${focusClass} ${answers[current] === i ? "border-[var(--brand-coral)] bg-[var(--surface-2)]" : "border-[var(--surface-border)] bg-[var(--surface-1)] hover:border-[var(--ink-muted)]"}`}
                >
                  {option.mood && (
                    <Image
                      src={getMoodMascotSrc(option.mood)}
                      alt=""
                      width={40}
                      height={40}
                      className="shrink-0 object-contain"
                    />
                  )}
                  <span className="flex-1">{option.text}</span>
                  {answers[current] === i && (
                    <Check
                      className="h-5 w-5 shrink-0 text-[var(--brand-coral-strong)]"
                      aria-hidden="true"
                    />
                  )}
                </button>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <button
                disabled={current === 0}
                onClick={() => setCurrent((step) => step - 1)}
                className={`ui-secondary-action min-h-11 disabled:cursor-default disabled:opacity-40 ${focusClass}`}
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
              </button>
              <button
                disabled={answers[current] === null}
                onClick={() =>
                  current === 4 ? void submit() : setCurrent((step) => step + 1)
                }
                className={`ui-primary-action min-h-11 disabled:cursor-default disabled:opacity-40 ${focusClass}`}
              >
                {current === 4 ? "Find my matches" : "Continue"}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
              {allAnswered && current !== 4 && (
                <button
                  onClick={() => void submit()}
                  className={`min-h-11 text-sm font-semibold text-[var(--brand-coral-strong)] ${focusClass}`}
                >
                  Update matches
                </button>
              )}
            </div>
          </section>
        )}

        {(stage === "loading" || stage === "error") && (
          <section
            className="mx-auto max-w-xl py-8"
            aria-labelledby="quiz-status"
            aria-busy={stage === "loading"}
          >
            <Image
              src={getMoodMascotSrc(
                stage === "error" ? "sad" : choice(0)?.mood,
              )}
              alt=""
              width={96}
              height={96}
            />
            <h1
              id="quiz-status"
              ref={headingRef}
              tabIndex={-1}
              className="mt-4 text-3xl font-bold outline-none sm:text-4xl"
            >
              {stage === "loading"
                ? "Finding your next watch"
                : "We couldn’t load your matches"}
            </h1>
            <p
              className="mt-3 text-sm leading-6 text-[var(--ink-muted)]"
              role={stage === "error" ? "alert" : "status"}
            >
              {stage === "loading"
                ? "Comparing your viewing signals with the available catalogue."
                : `Your answers are safe. ${errorMessage || "Please retry in a moment."}`}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              {stage === "error" && (
                <button
                  onClick={() => void submit()}
                  className={`ui-primary-action min-h-11 ${focusClass}`}
                >
                  Retry matches
                </button>
              )}
              <button
                onClick={() => {
                  requestRef.current?.abort();
                  requestRef.current = null;
                  setStage("quiz");
                }}
                className={`ui-secondary-action min-h-11 ${focusClass}`}
              >
                Back to answers
              </button>
            </div>
          </section>
        )}

        {stage === "results" && (
          <section aria-labelledby="quiz-results">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="ui-kicker">Your viewing shortlist</p>
                <h1
                  id="quiz-results"
                  ref={headingRef}
                  tabIndex={-1}
                  className="mt-2 text-3xl font-bold outline-none sm:text-4xl"
                >
                  {choice(0)?.label} · {choice(2)?.label} · {choice(3)?.label}
                </h1>
              </div>
              <button
                onClick={start}
                className={`min-h-11 text-sm font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)] ${focusClass}`}
              >
                Start again
              </button>
            </div>
            {result?.partialResults && (
              <p role="status" className="mb-4 text-sm text-[var(--ink-muted)]">
                Some catalogue requests were unavailable. These are the matches
                we could load.
              </p>
            )}
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div className="min-w-0">
                {topPick ? (
                  <>
                    <button
                      onClick={() => setSelectedMovie(topPick)}
                      className={`group flex w-full items-start gap-4 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-1)] p-4 text-left transition-colors hover:border-[var(--brand-coral)] motion-reduce:transition-none sm:gap-6 sm:p-6 ${focusClass}`}
                    >
                      <Image
                        src={posterOf(topPick)}
                        alt=""
                        width={240}
                        height={360}
                        className="aspect-[2/3] w-24 shrink-0 rounded-md object-cover sm:w-36"
                      />
                      <div className="min-w-0">
                        <p className="ui-kicker">
                          {ranked && typeof topPick.matchScore === "number"
                            ? "Top match"
                            : "Start here"}
                        </p>
                        <h2 className="mt-2 text-xl font-bold leading-tight sm:text-3xl">
                          {titleOf(topPick)}
                        </h2>
                        <Metadata item={topPick} />
                        <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
                          {reasonOf(topPick)}
                        </p>
                        <span className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-[var(--brand-coral-strong)]">
                          View details{" "}
                          <ArrowRight
                            className="ml-2 h-4 w-4"
                            aria-hidden="true"
                          />
                        </span>
                      </div>
                    </button>
                    {remainingPicks.length > 0 && (
                      <div className="mt-6">
                        <h2 className="mb-4 text-2xl font-bold">
                          More to watch
                        </h2>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-5 xl:grid-cols-4">
                          {remainingPicks.map((item) => (
                            <button
                              key={`${item.media_type}-${item.id}`}
                              onClick={() => setSelectedMovie(item)}
                              className={`group min-w-0 text-left ${focusClass}`}
                            >
                              <div className="relative overflow-hidden rounded-md border border-[var(--surface-border)] transition-colors group-hover:border-[var(--brand-coral)] motion-reduce:transition-none">
                                <Image
                                  src={posterOf(item)}
                                  alt=""
                                  width={360}
                                  height={540}
                                  className="aspect-[2/3] w-full object-cover"
                                />
                                <div className="absolute left-2 top-2">
                                  <RatingBadge
                                    rating={item.vote_average}
                                    size="sm"
                                  />
                                </div>
                              </div>
                              <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-5">
                                {titleOf(item)}
                              </h3>
                              <p className="mt-1 text-xs text-[var(--ink-muted)]">
                                {item.media_type === "tv" ? "Series" : "Movie"}{" "}
                                ·{" "}
                                {(
                                  item.release_date ||
                                  item.first_air_date ||
                                  ""
                                ).slice(0, 4) || "Date TBA"}
                              </p>
                              <p className="mt-2 text-xs leading-5 text-[var(--ink-muted)]">
                                {reasonOf(item)}
                              </p>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="py-8">
                    <h2 className="text-2xl font-bold">
                      No titles in this shortlist yet
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
                      The available catalogue didn’t return titles for this
                      combination. You can retry or widen the time window.
                    </p>
                    <button
                      onClick={() => void submit()}
                      className={`ui-secondary-action mt-4 min-h-11 ${focusClass}`}
                    >
                      Try again
                    </button>
                  </div>
                )}
              </div>
              <aside className="border-t border-[var(--surface-border)] pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                <details>
                  <summary
                    className={`cursor-pointer py-3 text-sm font-semibold ${focusClass}`}
                  >
                    How we matched this · edit answers
                  </summary>
                  <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
                    {ranked
                      ? "Genre choices drive the score. Mood and pace use editorial genre associations as rough guides. Format filters the pool, and time limits apply to movie or episode runtime. Ratings only break ties in fit; they do not prove a personal match."
                      : "These are genre-led suggestions. Detailed scoring needs the updated quiz service."}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
                    We compare a limited TMDB candidate pool, not every title. A
                    score is not a percentage chance you’ll like a title.
                    Episode length does not indicate season commitment.
                  </p>
                  <ul className="mt-4 divide-y divide-[var(--surface-border)]">
                    {QUIZ_SIGNALS.map((signal, i) => (
                      <li key={signal.category}>
                        <button
                          onClick={() => {
                            setCurrent(i);
                            setStage("quiz");
                          }}
                          className={`flex min-h-14 w-full items-center justify-between gap-3 py-3 text-left text-sm ${focusClass}`}
                        >
                          <span>
                            <span className="block text-xs text-[var(--ink-muted)]">
                              {signal.label}
                            </span>
                            {choice(i)?.text}
                          </span>
                          <span className="shrink-0 text-[var(--brand-coral-strong)]">
                            Edit
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 text-xs text-[var(--ink-muted)]">
                    Playful guide, not a diagnosis.
                  </p>
                </details>
              </aside>
            </div>
          </section>
        )}
      </div>

      {selectedMovie && (
        <dialog
          ref={dialogRef}
          aria-labelledby="quiz-movie-title"
          aria-describedby="quiz-movie-overview"
          onCancel={() => setSelectedMovie(null)}
          onClick={(event) => {
            if (event.target === event.currentTarget) setSelectedMovie(null);
          }}
          className="fixed inset-0 m-auto h-[100dvh] max-h-[100dvh] w-full max-w-none overflow-hidden border-0 bg-[var(--surface-1)] p-0 text-[var(--ink)] backdrop:bg-black/80 sm:h-auto sm:max-h-[90dvh] sm:max-w-2xl sm:rounded-lg sm:border sm:border-[var(--surface-border)]"
        >
          <div className="flex h-full max-h-[100dvh] flex-col sm:max-h-[90dvh]">
            <div className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--surface-border)] bg-[var(--surface-1)] p-4 pt-[max(1rem,env(safe-area-inset-top))]">
              <span className="text-sm font-semibold">
                Your shortlist · details
              </span>
              <button
                ref={closeRef}
                onClick={() => setSelectedMovie(null)}
                aria-label="Close details"
                className={`flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md border border-[var(--surface-border)] px-3 ${focusClass}`}
              >
                <X className="h-4 w-4" aria-hidden="true" /> Close
              </button>
            </div>
            <div className="min-h-0 overflow-y-auto overscroll-contain p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6">
              <div className="flex items-start gap-4">
                <Image
                  src={posterOf(selectedMovie)}
                  alt=""
                  width={240}
                  height={360}
                  className="aspect-[2/3] w-24 shrink-0 rounded-md object-cover sm:w-32"
                />
                <div className="min-w-0">
                  <h2
                    id="quiz-movie-title"
                    className="text-2xl font-bold leading-tight sm:text-3xl"
                  >
                    {titleOf(selectedMovie)}
                  </h2>
                  <Metadata item={selectedMovie} />
                </div>
              </div>
              <h3 className="mt-6 text-base font-semibold">Why it’s here</h3>
              <ul className="mt-2 list-inside list-disc space-y-2 text-sm leading-6 text-[var(--ink-muted)]">
                {(selectedMovie.matchReasons?.length
                  ? selectedMovie.matchReasons
                  : [reasonOf(selectedMovie)]
                ).map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
              <p
                id="quiz-movie-overview"
                className="mt-5 text-base leading-7 text-[var(--ink-muted)]"
              >
                {selectedMovie.overview ||
                  "A synopsis is not available for this title."}
              </p>
              <Link
                href={detailUrl(selectedMovie)}
                className={`ui-primary-action mt-6 min-h-11 ${focusClass}`}
              >
                Open full details{" "}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </dialog>
      )}
    </div>
  );
}

function Metadata({ item }: { item: MovieItem }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--ink-muted)]">
      <RatingBadge rating={item.vote_average} size="sm" />
      <span>
        {item.media_type === "tv" ? "Series" : "Movie"} ·{" "}
        {(item.release_date || item.first_air_date || "").slice(0, 4) ||
          "Date TBA"}
      </span>
    </div>
  );
}
