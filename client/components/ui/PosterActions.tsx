"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, BookmarkCheck, Check, CircleCheck, Heart, LoaderCircle, MoreHorizontal, Star, X } from "lucide-react";
import { useAuth } from "@/app/context/AuthProvider";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useLiked } from "@/hooks/useLiked";
import { useWatched } from "@/hooks/useWatched";
import { handleAppError } from "@/lib/errors";
import { appToast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import styles from "./PosterActions.module.css";

export type PosterActionsProps = {
  id: number | string;
  type: "movie" | "tv";
  title: string;
  posterUrl?: string | null;
  rating?: number | null;
  saved?: boolean;
  saving?: boolean;
  onToggleSave?: () => void | Promise<void>;
  saveLabel?: string;
  liked?: boolean;
  liking?: boolean;
  onToggleLike?: () => void | Promise<void>;
  className?: string;
};

export function PosterActions({ id, type, title, posterUrl, rating, saved, saving, onToggleSave, saveLabel, liked, liking, onToggleLike, className }: PosterActionsProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const watchlist = useWatchlist();
  const favorites = useLiked();
  const watched = useWatched(Number(id), type);
  const locks = useRef(new Set<string>());
  const dialog = useRef<HTMLDialogElement>(null);
  const moreButton = useRef<HTMLButtonElement>(null);
  const dialogId = useId();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const modal = dialog.current;
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    modal?.showModal();
    return () => {
      modal?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const libraryType = type === "tv" ? "series" : "movie";
  const isSaved = saved ?? watchlist.isInWatchlist(id, libraryType);
  const isLiked = liked ?? favorites.isLiked(id, libraryType);
  const meta = { title, posterUrl };

  async function run(action: "save" | "watched" | "like") {
    if (locks.current.has(action)) return;
    if (!isAuthenticated) {
      dialog.current?.close();
      setOpen(false);
      appToast.warning(`Sign in to ${action === "save" ? "save this title" : action === "like" ? "like this title" : "mark this title as watched"}.`, {
        id: `poster-${action}-auth-required`,
        action: { label: "Sign in", onClick: () => router.push("/auth/login") },
      });
      return;
    }
    locks.current.add(action);
    setPending(current => ({ ...current, [action]: true }));
    if (action !== "save") {
      dialog.current?.close();
      setOpen(false);
    }
    try {
      if (action === "save") {
        if (onToggleSave) await onToggleSave();
        else await (isSaved ? watchlist.remove : watchlist.add)(id, libraryType, meta);
      } else if (action === "like") {
        if (onToggleLike) await onToggleLike();
        else await (isLiked ? favorites.unlike : favorites.like)(id, libraryType, meta);
      } else {
        if (!watched.ready) {
          await watched.refresh();
          return;
        }
        if (await watched.toggle()) {
          appToast[watched.watched ? "info" : "success"](watched.watched ? "Removed from watched." : "Marked as watched.", meta);
        }
      }
    } catch (error) {
      // The shared watchlist hook already reports its own failures.
      if (action !== "save" || onToggleSave) {
        handleAppError(error, { fallbackMessage: "Could not update this title. Please try again.", toastTitle: action === "watched" ? "Watched" : action === "like" ? "Likes" : "Watchlist" });
      }
    } finally {
      locks.current.delete(action);
      setPending(current => ({ ...current, [action]: false }));
    }
  }

  const actions = [
    { key: "save" as const, active: isSaved, busy: !!saving || !!pending.save, disabled: isAuthenticated && !onToggleSave && !watchlist.ready,
      label: saveLabel ?? (isSaved ? `Remove ${title} from My List` : `Save ${title} to My List`), tooltip: isSaved ? "Saved" : "Save", Icon: isSaved ? BookmarkCheck : Bookmark },
    { key: "watched" as const, active: watched.watched, busy: watched.busy || !!pending.watched, disabled: !watched.enabled || (isAuthenticated && !watched.ready && !watched.error),
      label: !watched.enabled ? `Watched tracking unavailable for ${title}` : !watched.ready && watched.error ? `Retry watched status for ${title}` : watched.watched ? `Mark ${title} as unwatched` : `Mark ${title} as watched`, tooltip: !watched.enabled ? "Watched unavailable" : !watched.ready && watched.error ? "Retry watched status" : watched.watched ? "Watched" : "Mark as watched", Icon: CircleCheck },
    { key: "like" as const, active: isLiked, busy: !!liking || !!pending.like, disabled: isAuthenticated && !onToggleLike && !favorites.ready,
      label: isLiked ? `Unlike ${title}` : `Like ${title}`, tooltip: isLiked ? "Liked" : "Like", Icon: Heart },
  ];

  const save = actions[0];
  const SaveIcon = save.Icon;
  const displayRating = typeof rating === "number" && Number.isFinite(rating) && rating > 0 && rating <= 10 ? rating.toFixed(1) : null;

  return (
    <div className={cn(styles.actions, className)} role="group" aria-label={`Actions for ${title}`}>
      <div className={styles.row}>
        {displayRating && <span className={styles.rating} aria-label={`Rating: ${displayRating} out of 10`}><Star aria-hidden="true" fill="currentColor" />{displayRating}</span>}
        <div className={styles.controls}>
        <button type="button" className={cn(styles.action, styles.save)} data-action="save" data-active={save.active} aria-label={save.label} aria-pressed={save.active} aria-busy={save.busy} disabled={save.busy || save.disabled} onClick={() => void run("save")}>
          {save.busy ? <LoaderCircle className={styles.spinner} aria-hidden="true" /> : <SaveIcon aria-hidden="true" fill={save.active ? "currentColor" : "none"} />}
        </button>
        <button ref={moreButton} type="button" className={cn(styles.action, styles.more)} aria-label={`More actions for ${title}`} aria-haspopup="dialog" aria-expanded={open} aria-controls={dialogId} onClick={() => setOpen(true)}><MoreHorizontal aria-hidden="true" /></button>
        </div>
      </div>
      <dialog ref={dialog} id={dialogId} aria-labelledby={`${dialogId}-title`} className={styles.dialog} onCancel={() => setOpen(false)} onClose={() => { setOpen(false); if (moreButton.current?.isConnected) moreButton.current.focus(); }} onClick={event => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) setOpen(false);
      }}>
        <div className={styles.dialogHeader}>
          <h3 id={`${dialogId}-title`}>{title}</h3>
          <button type="button" className={cn(styles.action, styles.close)} aria-label="Close actions" onClick={() => setOpen(false)}><X aria-hidden="true" /></button>
        </div>
        <div className={styles.dialogRows}>
          {actions.slice(1).map(({ key, active, busy, disabled, label, tooltip, Icon }) => (
            <button key={key} type="button" className={cn(styles.action, styles.dialogAction)} data-action={key} data-active={active} aria-label={label} aria-pressed={active} aria-busy={busy} disabled={busy || disabled} onClick={() => void run(key)}>
              {busy ? <LoaderCircle className={styles.spinner} aria-hidden="true" /> : <Icon aria-hidden="true" fill={active ? "currentColor" : "none"} />}
              <span>{key === "watched" && watched.enabled && (watched.ready || !watched.error) ? active ? "Watched" : "Mark watched" : tooltip}</span>
              {active && <Check className={styles.activeCheck} aria-hidden="true" />}
            </button>
          ))}
        </div>
      </dialog>
    </div>
  );
}

export default PosterActions;
