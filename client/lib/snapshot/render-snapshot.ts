import { DEFAULT_SNAPSHOT_OPTIONS, type SnapshotPayload } from './snapshot-types';

export const MAX_SNAPSHOT_REVIEW_LENGTH = 240;
export const SNAPSHOT_DIMENSIONS = { width: 1080, height: 1350 } as const;
const artworkCache = new Map<string, Promise<HTMLImageElement | null>>();
type Box = { x: number; y: number; w: number; h: number };

export function truncateReviewText(value: string | undefined, maxLength = MAX_SNAPSHOT_REVIEW_LENGTH) {
  const clean = (value ?? '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLength) return clean;
  const candidate = clean.slice(0, maxLength + 1);
  const space = candidate.lastIndexOf(' ');
  return `${candidate.slice(0, space > maxLength * 0.65 ? space : maxLength).replace(/[.,;:!?-]+$/, '').trim()}…`;
}

export async function renderSnapshotToDataUrl(payload: SnapshotPayload, options = DEFAULT_SNAPSHOT_OPTIONS, allowImages = true): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = SNAPSHOT_DIMENSIONS.width; canvas.height = SNAPSHOT_DIMENSIONS.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Image export is unavailable in this browser.');
  const body = getComputedStyle(document.body).fontFamily;
  const display = getComputedStyle(document.querySelector('h1, h2') ?? document.body).fontFamily;
  let fontTimeout: number | undefined;
  try {
    // A failed or stalled hosted font must not block the preview and export.
    await Promise.race([
      Promise.allSettled([document.fonts.load(`700 72px ${display}`), document.fonts.load(`400 32px ${body}`)]),
      new Promise<void>((resolve) => { fontTimeout = window.setTimeout(resolve, 2000); }),
    ]);
  } catch { /* Canvas uses the font stack's fallback when loading is unavailable. */ }
  finally { window.clearTimeout(fontTimeout); }
  const [poster, backdrop] = allowImages ? await Promise.all([loadImage(payload.content.posterUrl), loadImage(payload.content.backdropUrl)]) : [null, null];
  const photo = backdrop ?? poster;
  const accent = options.accent === 'custom' && /^#[\da-f]{6}$/i.test(options.customAccent) ? options.customAccent : { coral: '#ff765f', gold: '#e7bc72', ivory: '#f0e7dc', custom: '#ff765f' }[options.accent];
  const paper = options.tone === 'paper';
  const bg = paper ? '#f0e7dc' : options.tone === 'warm' ? '#291c17' : '#121110';
  const ink = paper ? '#241b17' : '#f5f1ed';
  const muted = paper ? '#6a574b' : '#b9aca7';
  const rule = paper ? '#cdbcaa' : '#45362f';
  const W = canvas.width, H = canvas.height, M = 64;
  const title = payload.content.title;
  const quote = payload.review ? truncateReviewText(payload.review.content) : '';
  const credit = payload.content.directors?.slice(0, 2).join(', ');
  const creditLine = credit ? `${payload.content.mediaType === 'TV' ? 'Created' : 'Directed'} by ${credit}` : '';
  const metadata = [payload.content.releaseYear, payload.content.runtimeLabel, ...payload.content.genres.slice(0, 2)].filter(Boolean).join(' · ');
  const rating = payload.review ? `${(payload.review.rating / 2).toFixed(1)} / 5` : payload.content.ratingLabel || '';
  const byline = payload.review ? `A review by ${payload.review.username ? `@${payload.review.username}` : payload.review.authorName || 'the Moodies community'}` : 'Find your next watch';
  const font = (size: number, weight = 400, heading = false) => `${weight} ${size}px ${heading ? display : body}`;
  const text = (value: string, x: number, y: number, size: number, color = ink, weight = 400, heading = false) => {
    ctx.font = font(size, weight, heading); ctx.fillStyle = color; ctx.fillText(value, x, y);
  };
  const line = (x: number, y: number, w: number, color = rule) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, 1); };
  const block = (value: string, box: Box, preferred: number, color = ink, heading = false, maxLines = 3) => {
    if (!value || box.h < 22) return 0;
    let size = preferred;
    let lines: string[] = [];
    while (true) {
      ctx.font = font(size, heading ? 700 : 400, heading);
      lines = wrap(ctx, value, box.w);
      if ((lines.length <= maxLines && lines.length * size * 1.12 <= box.h) || size <= 22) break;
      size -= 2;
    }
    lines = ellipsize(ctx, lines, Math.max(1, Math.min(maxLines, Math.floor(box.h / (size * 1.12)))), box.w);
    lines.forEach((value, index) => text(value, box.x, box.y + size * 0.84 + index * size * 1.12, size, color, heading ? 700 : 400, heading));
    return lines.length * size * 1.12;
  };
  const image = (art: HTMLImageElement | null, box: Box, radius = 0) => {
    ctx.save(); ctx.beginPath(); ctx.roundRect(box.x, box.y, box.w, box.h, radius); ctx.clip();
    ctx.fillStyle = paper ? '#d7c8b7' : '#30231d'; ctx.fillRect(box.x, box.y, box.w, box.h);
    if (art) {
      const ratio = Math.max(box.w / art.naturalWidth, box.h / art.naturalHeight);
      const w = art.naturalWidth * ratio, h = art.naturalHeight * ratio;
      ctx.drawImage(art, box.x + (box.w - w) / 2, box.y + (box.h - h) / 2, w, h);
    } else {
      const gradient = ctx.createLinearGradient(box.x, box.y, box.x + box.w, box.y + box.h);
      gradient.addColorStop(0, accent); gradient.addColorStop(1, bg);
      ctx.globalAlpha = 0.35; ctx.fillStyle = gradient; ctx.fillRect(box.x, box.y, box.w, box.h);
    }
    ctx.restore();
  };
  const shade = (box: Box) => {
    const rgb = paper ? '240,231,220' : options.tone === 'warm' ? '41,28,23' : '10,8,7';
    const gradient = ctx.createLinearGradient(0, box.y, 0, box.y + box.h);
    gradient.addColorStop(0, `rgba(${rgb},0.1)`);
    gradient.addColorStop(0.45, `rgba(${rgb},0.43)`);
    gradient.addColorStop(1, `rgba(${rgb},0.98)`);
    ctx.fillStyle = gradient; ctx.fillRect(box.x, box.y, box.w, box.h);
  };
  const masthead = (onImage = false) => {
    const color = onImage ? '#f5f1ed' : ink;
    if (onImage) {
      const scrim = ctx.createLinearGradient(0, 0, 0, 160);
      scrim.addColorStop(0, 'rgba(0,0,0,0.5)'); scrim.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = scrim; ctx.fillRect(0, 0, W, 160);
    }
    text('Moodies', M, 78, 44, color, 700, true);
    ctx.textAlign = 'right'; text(payload.snapshotType === 'review' ? 'AUDIENCE NOTES' : 'A WATCH WORTH SHARING', W - M, 74, 18, color, 500); ctx.textAlign = 'left';
  };
  const footer = (color = ink) => {
    line(M, H - 112, W - 2 * M);
    block(byline, { x: M, y: H - 82, w: 590, h: 48 }, 24, color, false, 1);
    ctx.textAlign = 'right'; text('moodies.tech', W - M, H - 54, 24, color, 600); ctx.textAlign = 'left';
  };

  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  if (options.layout === 'premiere') {
    const artH = H * (quote ? 0.48 : 0.60);
    image(photo, { x: 0, y: 0, w: W, h: artH + 70 });
    shade({ x: 0, y: 0, w: W, h: artH + 70 });
    ctx.fillStyle = bg; ctx.fillRect(0, artH, W, H - artH);
    masthead(true);
    ctx.fillStyle = accent; ctx.fillRect(M, artH - 8, 80, 8);
    text(payload.content.typeLabel.toUpperCase(), M, artH + 46, 22, muted, 500);
    if (rating) { ctx.textAlign = 'right'; text(rating, W - M, artH + 46, 28, paper ? ink : accent, 600); ctx.textAlign = 'left'; }
    const titleY = artH + 68;
    const titleH = block(title, { x: M, y: titleY, w: W - M * 2, h: quote ? 190 : 150 }, 106, ink, true, 2);
    let y = titleY + titleH + 16;
    y += block(metadata, { x: M, y, w: W - M * 2, h: 64 }, 28, muted, false, 2) + 16;
    block(quote, { x: M, y, w: W - M * 2, h: H - 132 - y - (credit ? 38 : 0) }, 30, ink, false, 4);
    if (credit) block(creditLine, { x: M, y: quote ? H - 162 : y, w: W - M * 2, h: 30 }, 24, muted, false, 1);
    footer();
  } else if (options.layout === 'ticket') {
    masthead();
    ctx.fillStyle = paper ? '#e7dac8' : '#201b18'; ctx.beginPath(); ctx.roundRect(40, 124, W - 80, H - 170, 20); ctx.fill();
    const split = 426;
    image(poster ?? photo, { x: 64, y: 148, w: split - 110, h: H - 218 }, 8);
    ctx.strokeStyle = rule; ctx.lineWidth = 2; ctx.setLineDash([6, 10]); ctx.beginPath(); ctx.moveTo(split, 148); ctx.lineTo(split, H - 64); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = bg;
    [124, H - 46].forEach((y) => { ctx.beginPath(); ctx.arc(split, y, 19, 0, Math.PI * 2); ctx.fill(); });
    const x = split + 46, w = W - x - 76;
    text('ADMIT ONE GOOD WATCH', x, 184, 20, muted, 600);
    const titleH = block(title, { x, y: 222, w, h: 330 }, 88, ink, true, 3);
    let y = 242 + titleH;
    y += block(metadata, { x, y, w, h: 76 }, 26, muted, false, 2) + 24;
    block(quote || 'The next story starts here.', { x, y, w, h: H - 265 - y }, 32, ink, false, 6);
    block(creditLine, { x, y: H - 240, w, h: 32 }, 23, muted, false, 1);
    line(x, H - 192, w, accent);
    if (rating) text(rating, x, H - 138, 34, paper ? ink : accent, 600);
    block(byline, { x, y: H - 104, w: w - 140, h: 32 }, 20, muted, false, 1);
    for (let i = 0; i < 35; i++) { ctx.fillStyle = ink; ctx.fillRect(W - 192 + i * 3, H - 142, i % 3 === 0 ? 2 : 1, 50); }
  } else if (options.layout === 'editorial') {
    masthead(); line(M, 110, W - M * 2, accent);
    const artW = 360, artH = 621, artY = 170;
    image(poster ?? photo, { x: M, y: artY, w: artW, h: artH }, 4);
    const x = M + artW + 56, w = W - M - x;
    text(`${payload.content.typeLabel.toUpperCase()} / ${payload.content.releaseYear || 'NOW'}`, x, artY + 22, 21, muted, 500);
    const titleH = block(title, { x, y: artY + 66, w, h: 310 }, 92, ink, true, 3);
    let y = artY + titleH + 90;
    y += block(metadata, { x, y, w, h: 90 }, 27, muted, false, 3) + 28;
    if (credit) block(creditLine, { x, y, w, h: Math.max(32, artY + artH - y - 50) }, 27, muted, false, 2);
    if (rating) text(rating, x, artY + artH - 8, 32, paper ? ink : accent, 600);
    if (quote) {
      const y = artY + artH + 55;
      text('IN THEIR WORDS', M, y, 20, muted, 500);
      block(quote, { x: M, y: y + 30, w: W - M * 2, h: H - 180 - y }, 42, ink, false, 6);
    }
    footer();
  } else {
    image(photo, { x: 0, y: 0, w: W, h: H }); shade({ x: 0, y: 0, w: W, h: H }); masthead(true);
    const bottom = H - 190, titleY = H * (quote ? 0.48 : 0.55);
    const titleH = block(title, { x: M, y: titleY, w: W - M * 2, h: (bottom - titleY) * 0.52 }, 126, ink, true, 3);
    let y = titleY + titleH + 20;
    y += block(metadata, { x: M, y, w: W - M * 2, h: 70 }, 29, muted, false, 2) + 20;
    block(quote, { x: M, y, w: W - M * 2, h: bottom - y }, 32, ink, false, 4);
    if (credit) block(creditLine, { x: M, y: H - 174, w: W - M * 2 - 170, h: 28 }, 23, muted, false, 1);
    if (rating) { ctx.textAlign = 'right'; text(rating, W - M, H - 148, 32, paper ? ink : accent, 600); ctx.textAlign = 'left'; }
    ctx.fillStyle = accent; ctx.fillRect(M, titleY - 28, 80, 6);
    footer();
  }
  try { return canvas.toDataURL('image/png'); }
  catch (error) { if (allowImages) return renderSnapshotToDataUrl(payload, options, false); throw error; }
}

function wrap(ctx: CanvasRenderingContext2D, value: string, width: number) {
  const lines: string[] = []; let line = '';
  for (const word of value.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= width) { line = next; continue; }
    if (line) lines.push(line); line = '';
    for (const char of word) { if (line && ctx.measureText(line + char).width > width) { lines.push(line); line = ''; } line += char; }
  }
  if (line) lines.push(line); return lines;
}

function ellipsize(ctx: CanvasRenderingContext2D, lines: string[], max: number, width: number) {
  if (lines.length <= max) return lines;
  const result = lines.slice(0, max); let last = result[max - 1];
  while (last && ctx.measureText(`${last}…`).width > width) last = last.slice(0, -1);
  result[max - 1] = `${last.trim()}…`; return result;
}

function loadImage(src?: string | null): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  const cached = artworkCache.get(src); if (cached) return cached;
  const promise = new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image(); image.crossOrigin = 'anonymous';
    const timeout = window.setTimeout(() => { artworkCache.delete(src); resolve(null); }, 8000);
    const finish = (value: HTMLImageElement | null) => { window.clearTimeout(timeout); if (!value) artworkCache.delete(src); resolve(value); };
    image.onload = () => finish(image); image.onerror = () => finish(null); image.src = src;
  });
  if (artworkCache.size >= 12) artworkCache.delete(artworkCache.keys().next().value!);
  artworkCache.set(src, promise); return promise;
}
