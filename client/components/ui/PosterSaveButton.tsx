import { Bookmark, BookmarkCheck, LoaderCircle } from "lucide-react";

export function PosterSaveButton({
  title,
  saved,
  saving = false,
  onClick,
  label,
}: {
  title: string;
  saved: boolean;
  saving?: boolean;
  onClick: () => void;
  label?: string;
}) {
  const Icon = saving ? LoaderCircle : saved ? BookmarkCheck : Bookmark;

  return (
    <button
      type="button"
      className="ui-poster-save"
      onClick={onClick}
      disabled={saving}
      aria-busy={saving}
      aria-pressed={saved}
      aria-label={label ?? (saved ? `Remove ${title} from My List` : `Add ${title} to My List`)}
    >
      <Icon className={`relative size-[22px] ${saving ? "motion-safe:animate-spin" : ""}`} aria-hidden="true" />
    </button>
  );
}
