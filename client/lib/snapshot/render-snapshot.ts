import type { SnapshotPayload } from "./snapshot-types";

export const MAX_SNAPSHOT_REVIEW_LENGTH = 180;

const BRAND = "Moodies";
const WIDTH = 1080;
const HEIGHT = 1080;

type SnapshotTheme = {
  accent: string;
  deep: string;
  glow: string;
  text: string;
  muted: string;
};

type LoadedArtwork = {
  backdrop: HTMLImageElement | null;
  poster: HTMLImageElement | null;
};

export function truncateReviewText(
  value: string | undefined,
  maxLength = MAX_SNAPSHOT_REVIEW_LENGTH,
) {
  const clean = (value ?? "").replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) return clean;

  const candidate = clean.slice(0, maxLength + 1);
  const lastSpace = candidate.lastIndexOf(" ");
  const truncated = candidate
    .slice(0, lastSpace > maxLength * 0.65 ? lastSpace : maxLength)
    .replace(/[.,;:!?-]+$/, "")
    .trim();

  return `${truncated}...`;
}

export async function renderSnapshotToDataUrl(payload: SnapshotPayload) {
  return renderSnapshot(payload, true);
}

async function renderSnapshot(
  payload: SnapshotPayload,
  allowImages: boolean,
): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = payload.width || WIDTH;
  canvas.height = payload.height || HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser.");

  const artwork: LoadedArtwork = allowImages
    ? {
        backdrop: await loadCanvasImage(payload.content.backdropUrl),
        poster: await loadCanvasImage(payload.content.posterUrl),
      }
    : { backdrop: null, poster: null };

  const theme = getSnapshotTheme(payload);

  drawSnapshotBackground(ctx, payload, artwork, theme);
  drawArtworkLedPoster(ctx, payload, artwork, theme);

  try {
    return canvas.toDataURL("image/png");
  } catch (error) {
    if (allowImages) return renderSnapshot(payload, false);
    throw error;
  }
}

function drawArtworkLedPoster(
  ctx: CanvasRenderingContext2D,
  payload: SnapshotPayload,
  artwork: LoadedArtwork,
  theme: SnapshotTheme,
) {
  const posterBox = { x: 78, y: 112, width: 356, height: 534 };
  drawSnapshotPosterArt(ctx, artwork.poster, posterBox, theme);

  drawSnapshotInfoComposition(ctx, payload, {
    x: 480,
    y: 112,
    width: 480,
    height: 534,
    variant: "side",
  }, theme);

  const quote = getSnapshotQuote(payload);
  drawSnapshotQuote(ctx, quote, {
    x: 84,
    y: 684,
    width: 884,
    height: 206,
    maxLines: 3,
    preferredSize: quote.length <= 72 ? 62 : 48,
    minSize: 36,
  });

  drawSnapshotRating(ctx, payload, 84, 950, theme);
  drawSnapshotBrandFooter(ctx, payload, theme);
}

function drawSnapshotBackground(
  ctx: CanvasRenderingContext2D,
  payload: SnapshotPayload,
  artwork: LoadedArtwork,
  theme: SnapshotTheme,
) {
  const image = artwork.backdrop ?? artwork.poster;

  if (image) {
    ctx.save();
    ctx.filter = "blur(30px) brightness(0.55) saturate(1.05)";
    drawCoverImage(ctx, image, -54, -54, WIDTH + 108, HEIGHT + 108);
    ctx.restore();
  } else {
    drawFallbackBackground(ctx, payload, theme);
  }

  const vertical = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  vertical.addColorStop(0, "rgba(0,0,0,0.20)");
  vertical.addColorStop(0.48, "rgba(0,0,0,0.48)");
  vertical.addColorStop(1, "rgba(0,0,0,0.88)");
  ctx.fillStyle = vertical;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const side = ctx.createLinearGradient(0, 0, WIDTH, 0);
  side.addColorStop(0, "rgba(0,0,0,0.72)");
  side.addColorStop(0.55, "rgba(0,0,0,0.28)");
  side.addColorStop(1, "rgba(0,0,0,0.58)");
  ctx.fillStyle = side;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const glow = ctx.createRadialGradient(220, 360, 40, 220, 360, 520);
  glow.addColorStop(0, theme.glow);
  glow.addColorStop(0.62, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = "rgba(255,255,255,0.035)";
  ctx.fillRect(58, 58, 964, 1);
  ctx.fillRect(58, 1021, 964, 1);
}

function drawFallbackBackground(
  ctx: CanvasRenderingContext2D,
  payload: SnapshotPayload,
  theme: SnapshotTheme,
) {
  const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bg.addColorStop(0, theme.deep);
  bg.addColorStop(0.48, "#101114");
  bg.addColorStop(1, "#020305");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const genreHint = (payload.content.genres[0] ?? "").toLowerCase();
  const accent =
    genreHint.includes("romance") || genreHint.includes("comedy")
      ? "rgba(251, 113, 133, 0.22)"
      : genreHint.includes("documentary")
        ? "rgba(45, 212, 191, 0.18)"
        : theme.glow;

  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.ellipse(820, 190, 340, 260, -0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.055)";
  ctx.beginPath();
  ctx.ellipse(180, 890, 420, 190, 0.18, 0, Math.PI * 2);
  ctx.fill();
}

function drawSnapshotPosterArt(
  ctx: CanvasRenderingContext2D,
  poster: HTMLImageElement | null,
  box: { x: number; y: number; width: number; height: number },
  theme: SnapshotTheme,
) {
  ctx.save();
  ctx.shadowColor = theme.glow;
  ctx.shadowBlur = 44;
  ctx.shadowOffsetY = 20;
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  roundedRect(ctx, box.x, box.y, box.width, box.height, 26);
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundedRect(ctx, box.x, box.y, box.width, box.height, 26);
  ctx.clip();

  if (poster) {
    drawCoverImage(ctx, poster, box.x, box.y, box.width, box.height);
  } else {
    const fill = ctx.createLinearGradient(
      box.x,
      box.y,
      box.x + box.width,
      box.y + box.height,
    );
    fill.addColorStop(0, theme.accent);
    fill.addColorStop(0.56, "#242733");
    fill.addColorStop(1, "#050507");
    ctx.fillStyle = fill;
    ctx.fillRect(box.x, box.y, box.width, box.height);
    ctx.fillStyle = "rgba(255,255,255,0.84)";
    ctx.font = font(34, 850);
    ctx.textAlign = "center";
    ctx.fillText("Artwork", box.x + box.width / 2, box.y + box.height / 2 - 8);
    ctx.font = font(20, 750);
    ctx.fillStyle = "rgba(255,255,255,0.58)";
    ctx.fillText("unavailable", box.x + box.width / 2, box.y + box.height / 2 + 28);
    ctx.textAlign = "left";
  }

  ctx.restore();

  ctx.strokeStyle = "rgba(255,255,255,0.13)";
  ctx.lineWidth = 1.5;
  roundedRect(ctx, box.x, box.y, box.width, box.height, 26);
  ctx.stroke();
}

function drawSnapshotInfoComposition(
  ctx: CanvasRenderingContext2D,
  payload: SnapshotPayload,
  opts: {
    x: number;
    y: number;
    width: number;
    height: number;
    variant: "side" | "wide";
  },
  theme: SnapshotTheme,
) {
  if (opts.variant === "wide") {
    drawWideInfoComposition(ctx, payload, opts, theme);
    return;
  }

  const { content } = payload;
  const year = content.releaseYear ?? "NOW";
  const director = formatDirectorParts(content.directors);
  const genres = content.genres.slice(0, 2);
  const runtime = content.runtimeLabel ?? (content.mediaType === "TV" ? "Series" : "Feature");
  const left = opts.x;
  const top = opts.y;
  const width = opts.width;

  const field = ctx.createLinearGradient(opts.x, opts.y, opts.x + opts.width, opts.y + opts.height);
  field.addColorStop(0, "rgba(0,0,0,0.32)");
  field.addColorStop(0.55, "rgba(0,0,0,0.11)");
  field.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = field;
  roundedRect(ctx, left - 24, top - 10, width + 40, opts.height + 20, 34);
  ctx.fill();

  ctx.fillStyle = theme.accent;
  ctx.beginPath();
  ctx.arc(left + 8, top + 14, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = theme.muted;
  ctx.font = font(18, 850);
  ctx.fillText("SNAPSHOT DETAILS", left + 28, top + 21);

  ctx.fillStyle = "#ffffff";
  ctx.font = font(year.length > 4 ? 58 : 86, 950);
  ctx.fillText(year, left, top + 112);

  const pillY = top + 132;
  const typeWidth = drawInfoPill(ctx, content.typeLabel, left + 2, pillY, theme, "solid");
  drawInfoPill(ctx, runtime, left + typeWidth + 18, pillY, theme, "soft");

  const genreTop = top + 236;
  drawSoftPanel(ctx, left, genreTop - 42, width - 32, 154, 28);
  ctx.fillStyle = "rgba(255,255,255,0.32)";
  ctx.font = font(16, 850);
  ctx.fillText("MOOD", left + 26, genreTop - 10);

  const primaryGenre = genres[0] ?? "Watchlist";
  const secondaryGenre = genres[1];
  ctx.fillStyle = "#ffffff";
  ctx.font = font(primaryGenre.length > 10 ? 44 : 56, 930);
  ctx.fillText(primaryGenre, left + 26, genreTop + 48);

  if (secondaryGenre) {
    ctx.fillStyle = theme.accent;
    ctx.font = font(32, 900);
    ctx.fillText(`/ ${secondaryGenre}`, left + 28, genreTop + 94);
  }

  drawDirectorCredit(ctx, director, left, top + 420, width - 32, theme);
  drawDecorativePulse(ctx, left + width - 58, top + 334, theme);
}

function drawSnapshotQuote(
  ctx: CanvasRenderingContext2D,
  quote: string,
  opts: {
    x: number;
    y: number;
    width: number;
    height: number;
    maxLines: number;
    preferredSize: number;
    minSize: number;
  },
) {
  const text = `"${quote}"`;
  const size = fitTextSize(
    ctx,
    text,
    opts.width,
    opts.maxLines,
    opts.preferredSize,
    opts.minSize,
    1.08,
  );
  const lineHeight = size * 1.08;
  ctx.font = font(size, 850);
  const lines = wrapTextLines(ctx, text, opts.width, opts.maxLines);
  const textHeight = size + (lines.length - 1) * lineHeight;
  const baselineY = opts.y + (opts.height - textHeight) / 2 + size * 0.82;

  drawQuoteScrim(ctx, opts.x - 26, opts.y, opts.width + 52, opts.height);

  ctx.fillStyle = "#ffffff";
  drawLines(ctx, lines, opts.x, baselineY, lineHeight);
}

function drawQuoteScrim(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const fill = ctx.createLinearGradient(x, y, x + width, y + height);
  fill.addColorStop(0, "rgba(0,0,0,0.58)");
  fill.addColorStop(0.72, "rgba(0,0,0,0.18)");
  fill.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = fill;
  roundedRect(ctx, x, y, width, height, 28);
  ctx.fill();
}

function drawSnapshotRating(
  ctx: CanvasRenderingContext2D,
  payload: SnapshotPayload,
  x: number,
  y: number,
  theme: SnapshotTheme,
) {
  const rating = payload.review?.rating;
  const label =
    rating != null
      ? `${ratingStars(rating / 2)} ${(rating / 2).toFixed(1)}`
      : payload.content.ratingLabel || formatPopularity(payload.content.popularity);

  if (!label) return;

  ctx.fillStyle = theme.accent;
  ctx.font = font(34, 850);
  ctx.fillText(label, x, y);

  const byline = payload.review?.username
    ? `Reviewed by @${payload.review.username}`
    : payload.review?.authorName
      ? `Reviewed by ${payload.review.authorName}`
      : payload.snapshotType === "review"
        ? "Reviewed on Moodies"
        : "On Moodies";

  ctx.fillStyle = theme.muted;
  ctx.font = font(24, 700);
  ctx.fillText(byline, x, y + 42);
}

function drawSnapshotBrandFooter(
  ctx: CanvasRenderingContext2D,
  payload: SnapshotPayload,
  theme: SnapshotTheme,
) {
  const cta =
    payload.snapshotType === "review"
      ? "Share the mood on Moodies"
      : "Find your next watch on Moodies";

  ctx.fillStyle = "rgba(255,255,255,0.08)";
  roundedRect(ctx, 686, 946, 326, 64, 32);
  ctx.fill();

  ctx.fillStyle = theme.accent;
  ctx.beginPath();
  ctx.arc(724, 978, 11, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = font(24, 900);
  ctx.fillText(BRAND, 748, 970);

  ctx.fillStyle = theme.muted;
  ctx.font = font(19, 700);
  ctx.fillText(cta.replace(`${BRAND}`, "").replace(" on ", " "), 748, 998);
}

function getSnapshotQuote(payload: SnapshotPayload) {
  if (payload.review?.content) {
    return truncateReviewText(payload.review.content);
  }

  const genres = payload.content.genres.map((genre) => genre.toLowerCase());
  if (genres.some((genre) => genre.includes("horror"))) {
    return "One for the lights-off crowd.";
  }
  if (genres.some((genre) => genre.includes("romance"))) {
    return "A soft watch for the weekend.";
  }
  if (genres.some((genre) => genre.includes("comedy"))) {
    return "For when you need an easy laugh.";
  }
  if (genres.some((genre) => genre.includes("thriller"))) {
    return "Tension for your watchlist.";
  }
  if (genres.some((genre) => genre.includes("documentary"))) {
    return "A story worth sitting with.";
  }

  return "Now on my radar.";
}

function drawWideInfoComposition(
  ctx: CanvasRenderingContext2D,
  payload: SnapshotPayload,
  opts: {
    x: number;
    y: number;
    width: number;
    height: number;
    variant: "side" | "wide";
  },
  theme: SnapshotTheme,
) {
  const { content } = payload;
  const year = content.releaseYear ?? "Now";
  const runtime = content.runtimeLabel ?? content.typeLabel;
  const genres = content.genres.slice(0, 2);
  const director = formatDirectorParts(content.directors);

  const fill = ctx.createLinearGradient(opts.x, opts.y, opts.x + opts.width, opts.y + opts.height);
  fill.addColorStop(0, "rgba(0,0,0,0.42)");
  fill.addColorStop(0.48, "rgba(255,255,255,0.075)");
  fill.addColorStop(1, "rgba(0,0,0,0.18)");
  ctx.fillStyle = fill;
  roundedRect(ctx, opts.x - 8, opts.y - 24, opts.width + 16, opts.height, 30);
  ctx.fill();

  ctx.fillStyle = theme.accent;
  roundedRect(ctx, opts.x, opts.y - 12, 74, 6, 3);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = font(54, 950);
  ctx.fillText(year, opts.x, opts.y + 54);

  drawInfoPill(ctx, content.typeLabel, opts.x + 160, opts.y + 14, theme, "solid");
  drawInfoPill(ctx, runtime, opts.x + 322, opts.y + 14, theme, "soft");

  ctx.fillStyle = "#ffffff";
  ctx.font = font(34, 900);
  ctx.fillText(genres.length ? genres.join(" / ") : "On your radar", opts.x, opts.y + 116);

  if (director.name) {
    ctx.fillStyle = theme.muted;
    ctx.font = font(20, 760);
    ctx.fillText("Directed by", opts.x, opts.y + 158);

    ctx.fillStyle = theme.accent;
    ctx.font = font(27, 900);
    ctx.fillText(`${director.name}${director.extra ? ` +${director.extra}` : ""}`, opts.x + 128, opts.y + 158);
  }

  drawDecorativePulse(ctx, opts.x + opts.width - 118, opts.y + 136, theme);
}

function formatDirectorParts(directors?: string[]) {
  if (!directors?.length) return { name: "", extra: 0 };
  const [first, ...rest] = directors;
  return { name: first, extra: rest.length };
}

function drawInfoPill(
  ctx: CanvasRenderingContext2D,
  label: string,
  x: number,
  y: number,
  theme: SnapshotTheme,
  variant: "solid" | "soft",
) {
  ctx.font = font(22, 850);
  const width = Math.min(150, ctx.measureText(label).width + 34);
  ctx.fillStyle = variant === "solid" ? theme.accent : "rgba(255,255,255,0.105)";
  roundedRect(ctx, x, y, width, 42, 21);
  ctx.fill();
  ctx.fillStyle = variant === "solid" ? "#0b0b0c" : "#ffffff";
  ctx.fillText(label, x + 17, y + 28);
  return width;
}

function drawSoftPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const fill = ctx.createLinearGradient(x, y, x + width, y + height);
  fill.addColorStop(0, "rgba(255,255,255,0.095)");
  fill.addColorStop(1, "rgba(255,255,255,0.028)");
  ctx.fillStyle = fill;
  roundedRect(ctx, x, y, width, height, radius);
  ctx.fill();
}

function drawDirectorCredit(
  ctx: CanvasRenderingContext2D,
  director: { name: string; extra: number },
  x: number,
  y: number,
  width: number,
  theme: SnapshotTheme,
) {
  const fill = ctx.createLinearGradient(x, y, x + width, y + 128);
  fill.addColorStop(0, "rgba(255,255,255,0.105)");
  fill.addColorStop(1, "rgba(255,255,255,0.035)");
  ctx.fillStyle = fill;
  roundedRect(ctx, x, y, width, 128, 30);
  ctx.fill();

  ctx.fillStyle = theme.accent;
  ctx.beginPath();
  ctx.arc(x + 30, y + 36, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = theme.muted;
  ctx.font = font(18, 800);
  ctx.fillText("DIRECTED BY", x + 52, y + 43);

  ctx.fillStyle = "#ffffff";
  ctx.font = font(31, 930);
  const name = director.name || "Moodies pick";
  const credit = `${name}${director.extra ? ` +${director.extra}` : ""}`;
  drawLines(ctx, wrapTextLines(ctx, credit, width - 60, 2), x + 30, y + 88, 34);
}

function drawDecorativePulse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  theme: SnapshotTheme,
) {
  ctx.save();
  ctx.strokeStyle = theme.accent;
  ctx.globalAlpha = 0.9;
  ctx.lineWidth = 3;
  for (let i = 0; i < 3; i += 1) {
    ctx.beginPath();
    ctx.arc(x, y, 18 + i * 22, 0, Math.PI * 1.55);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < 5; i += 1) {
    ctx.beginPath();
    ctx.arc(x - 80 + i * 28, y + 74, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function getSnapshotTheme(payload: SnapshotPayload): SnapshotTheme {
  const genres = payload.content.genres.map((genre) => genre.toLowerCase());

  if (genres.some((genre) => genre.includes("horror") || genre.includes("thriller"))) {
    return {
      accent: "#f43f5e",
      deep: "#12070d",
      glow: "rgba(244,63,94,0.32)",
      text: "#ffffff",
      muted: "rgba(255,255,255,0.70)",
    };
  }

  if (genres.some((genre) => genre.includes("romance") || genre.includes("comedy"))) {
    return {
      accent: "#fb923c",
      deep: "#170b12",
      glow: "rgba(251,146,60,0.28)",
      text: "#ffffff",
      muted: "rgba(255,255,255,0.72)",
    };
  }

  if (payload.content.mediaType === "TV") {
    return {
      accent: "#38bdf8",
      deep: "#07111f",
      glow: "rgba(56,189,248,0.28)",
      text: "#ffffff",
      muted: "rgba(255,255,255,0.70)",
    };
  }

  return {
    accent: "#facc15",
    deep: "#101014",
    glow: "rgba(250,204,21,0.24)",
    text: "#ffffff",
    muted: "rgba(255,255,255,0.70)",
  };
}

function ratingStars(value: number) {
  const rounded = Math.max(0, Math.min(5, Math.round(value)));
  return "★".repeat(rounded) + "☆".repeat(5 - rounded);
}

function formatPopularity(value?: number | null) {
  if (!value || value <= 0) return null;
  return `${Math.round(value)} popularity`;
}

function fitTextSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
  preferredSize: number,
  minSize: number,
  lineHeightRatio: number,
) {
  for (let size = preferredSize; size >= minSize; size -= 2) {
    ctx.font = font(size, 850);
    const lines = wrapTextLines(ctx, text, maxWidth, maxLines + 1);
    if (lines.length <= maxLines) return size;
    const height = lines.length * size * lineHeightRatio;
    if (height <= maxLines * size * lineHeightRatio) return size;
  }
  return minSize;
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    } else {
      line = testLine;
    }
  }

  if (line && lines.length < maxLines) lines.push(line);

  if (words.length && lines.length === maxLines) {
    const consumed = lines.join(" ").replace(/\.\.\.$/, "");
    if (consumed.length < text.length) {
      lines[lines.length - 1] = ellipsizeLine(ctx, lines[lines.length - 1], maxWidth);
    }
  }

  return lines;
}

function ellipsizeLine(
  ctx: CanvasRenderingContext2D,
  line: string,
  maxWidth: number,
) {
  let output = line.replace(/[.,;:!?-]+$/, "").trim();
  while (output.length > 0 && ctx.measureText(`${output}...`).width > maxWidth) {
    output = output.slice(0, output.lastIndexOf(" "));
    if (!output) break;
  }
  return output ? `${output}...` : "...";
}

function drawLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  y: number,
  lineHeight: number,
) {
  lines.forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight);
  });
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const scale = Math.max(width / image.width, height / image.height);
  const scaledWidth = image.width * scale;
  const scaledHeight = image.height * scale;
  const offsetX = x + (width - scaledWidth) / 2;
  const offsetY = y + (height - scaledHeight) / 2;
  ctx.drawImage(image, offsetX, offsetY, scaledWidth, scaledHeight);
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function loadCanvasImage(src?: string | null) {
  if (!src) return Promise.resolve<HTMLImageElement | null>(null);

  return new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image();
    if (/^https?:\/\//i.test(src)) image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function font(size: number, weight: number) {
  return `${weight} ${size}px Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
}
