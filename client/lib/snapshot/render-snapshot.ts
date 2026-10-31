import { DEFAULT_SNAPSHOT_OPTIONS, type SnapshotOptions, type SnapshotPayload } from './snapshot-types';

export const MAX_SNAPSHOT_REVIEW_LENGTH = 240;
const artworkCache = new Map<string, Promise<HTMLImageElement | null>>();
type Box = { x: number; y: number; w: number; h: number };

export function truncateReviewText(value: string | undefined, maxLength = MAX_SNAPSHOT_REVIEW_LENGTH) {
  const clean = (value ?? '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLength) return clean;
  const candidate = clean.slice(0, maxLength + 1);
  const space = candidate.lastIndexOf(' ');
  return `${candidate.slice(0, space > maxLength * 0.65 ? space : maxLength).replace(/[.,;:!?-]+$/, '').trim()}…`;
}

export function snapshotDimensions(format: SnapshotOptions['format']) {
  if (format === 'landscape') return { width: 1600, height: 900 };
  return { width: 1080, height: format === 'story' ? 1920 : format === 'portrait' ? 1350 : 1080 };
}

export async function renderSnapshotToDataUrl(payload: SnapshotPayload, options = DEFAULT_SNAPSHOT_OPTIONS, allowImages = true): Promise<string> {
  const dimensions = snapshotDimensions(options.format);
  const canvas = document.createElement('canvas');
  canvas.width = dimensions.width; canvas.height = dimensions.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Image export is unavailable in this browser.');
  await document.fonts.ready;
  const body = getComputedStyle(document.body).fontFamily;
  const display = getComputedStyle(document.querySelector('h1, h2') ?? document.body).fontFamily;
  await Promise.all([document.fonts.load(`700 72px ${display}`), document.fonts.load(`400 32px ${body}`)]);
  const [poster, backdrop] = allowImages ? await Promise.all([loadImage(payload.content.posterUrl), loadImage(payload.content.backdropUrl)]) : [null, null];
  const photo = options.artwork === 'none' ? null : options.artwork === 'poster' ? poster : options.artwork === 'backdrop' ? backdrop : backdrop ?? poster;
  const accent = options.accent === 'custom' && /^#[\da-f]{6}$/i.test(options.customAccent) ? options.customAccent : { coral: '#ff765f', gold: '#e7bc72', ivory: '#f0e7dc', custom: '#ff765f' }[options.accent];
  const paper = options.tone === 'paper';
  const bg = paper ? '#f0e7dc' : options.tone === 'warm' ? '#291c17' : '#121110';
  const ink = paper ? '#241b17' : '#f5f1ed';
  const muted = paper ? '#6a574b' : '#b9aca7';
  const rule = paper ? '#cdbcaa' : '#45362f';
  const scale = dimensions.width / 1080;
  ctx.scale(scale, scale);
  const W = 1080, H = dimensions.height / scale, wide = H < 800;
  const M = 64;
  const title = options.displayTitle.trim() || payload.content.title;
  const quote = options.showQuote ? (payload.review ? truncateReviewText(payload.review.content) : options.caption.trim()) : '';
  const credit = options.showCredit ? payload.content.directors?.slice(0, 2).join(', ') : '';
  const creditLine = credit ? `${payload.content.mediaType === 'TV' ? 'Created' : 'Directed'} by ${credit}` : '';
  const metadata = options.showDetails ? [payload.content.releaseYear, payload.content.runtimeLabel, ...payload.content.genres.slice(0, 2)].filter(Boolean).join(' · ') : '';
  const rating = options.showRating ? payload.review ? `${(payload.review.rating / 2).toFixed(1)} / 5` : payload.content.ratingLabel || '' : '';
  const byline = payload.review ? `A review by ${payload.review.username ? `@${payload.review.username}` : payload.review.authorName || 'the Moodies community'}` : 'Find your next watch';
  const font = (size: number, weight = 400, heading = false) => `${weight} ${size}px ${heading ? display : body}`;
  const text = (value: string, x: number, y: number, size: number, color = ink, weight = 400, heading = false) => {
    ctx.font = font(size, weight, heading); ctx.fillStyle = color; ctx.fillText(value, x, y);
  };
  const line = (x: number, y: number, w: number, color = rule) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, 1); };
  const block = (value: string, box: Box, preferred: number, color = ink, heading = false, maxLines = 3, align = options.align) => {
    if (!value || box.h < 22) return 0;
    let size = preferred * (heading ? options.titleScale / 100 : 1);
    let lines: string[] = [];
    while (true) {
      ctx.font = font(size, heading ? 700 : 400, heading);
      lines = wrap(ctx, value, box.w);
      if ((lines.length <= maxLines && lines.length * size * 1.12 <= box.h) || size <= 22) break;
      size -= 2;
    }
    lines = ellipsize(ctx, lines, Math.max(1, Math.min(maxLines, Math.floor(box.h / (size * 1.12)))), box.w);
    ctx.textAlign = align;
    const x = align === 'center' ? box.x + box.w / 2 : box.x;
    lines.forEach((value, index) => text(value, x, box.y + size * 0.84 + index * size * 1.12, size, color, heading ? 700 : 400, heading));
    ctx.textAlign = 'left';
    return lines.length * size * 1.12;
  };
  const image = (art: HTMLImageElement | null, box: Box, radius = 0) => {
    ctx.save(); ctx.beginPath(); ctx.roundRect(box.x, box.y, box.w, box.h, radius); ctx.clip();
    ctx.fillStyle = paper ? '#d7c8b7' : '#30231d'; ctx.fillRect(box.x, box.y, box.w, box.h);
    if (art) cover(ctx, art, box, options.imageZoom / 100, options.imagePosition / 100);
    else {
      const gradient = ctx.createLinearGradient(box.x, box.y, box.x + box.w, box.y + box.h);
      gradient.addColorStop(0, accent); gradient.addColorStop(1, bg);
      ctx.globalAlpha = 0.35; ctx.fillStyle = gradient; ctx.fillRect(box.x, box.y, box.w, box.h);
    }
    if (options.layout === 'ticket' || options.layout === 'editorial') {
      ctx.fillStyle = `rgba(0,0,0,${Math.max(0, options.overlay - 45) / 150})`;
      ctx.fillRect(box.x, box.y, box.w, box.h);
    }
    ctx.restore();
  };
  const shade = (box: Box) => {
    const rgb = paper ? '240,231,220' : options.tone === 'warm' ? '41,28,23' : '10,8,7';
    const gradient = ctx.createLinearGradient(0, box.y, 0, box.y + box.h);
    gradient.addColorStop(0, `rgba(${rgb},0.1)`);
    gradient.addColorStop(0.45, `rgba(${rgb},${options.overlay / 140})`);
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
    line(M, H - 112, W - 2 * M, color === '#f5f1ed' ? '#655047' : rule);
    block(byline, { x: M, y: H - 82, w: 590, h: 48 }, 24, color, false, 1, 'left');
    ctx.textAlign = 'right'; text('moodies.tech', W - M, H - 54, 24, color, 600); ctx.textAlign = 'left';
  };

  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  if (options.layout === 'premiere') {
    if (wide) {
      image(photo, { x: 0, y: 0, w: 570, h: H });
      shade({ x: 0, y: 0, w: 570, h: H });
      text('Moodies', 44, 68, 44, '#f5f1ed', 700, true);
      const x = 620, w = 400;
      text(payload.content.typeLabel.toUpperCase(), x, 76, 20, muted, 500);
      const titleH = block(title, { x, y: 124, w, h: 216 }, 78, ink, true, 3);
      const metaY = 140 + titleH;
      block(metadata, { x, y: metaY, w, h: 58 }, 24, muted, false, 2);
      block([quote, creditLine].filter(Boolean).join(' · '), { x, y: metaY + 78, w, h: Math.max(30, H - 114 - metaY - 78) }, 25, ink, false, 2);
      if (rating) text(rating, x, H - 68, 30, paper ? ink : accent, 600);
      text('moodies.tech', 44, H - 44, 24, '#f5f1ed', 500);
    } else {
      const artH = H * 0.60;
      image(photo, { x: 0, y: 0, w: W, h: artH + 70 });
      shade({ x: 0, y: 0, w: W, h: artH + 70 });
      ctx.fillStyle = bg; ctx.fillRect(0, artH, W, H - artH);
      masthead(true);
      ctx.fillStyle = accent; ctx.fillRect(M, artH - 8, 80, 8);
      text(payload.content.typeLabel.toUpperCase(), M, artH + 46, 22, muted, 500);
      if (rating) { ctx.textAlign = 'right'; text(rating, W - M, artH + 46, 28, paper ? ink : accent, 600); ctx.textAlign = 'left'; }
      const titleY = artH + 68;
      const available = H - 132 - titleY;
      const titleH = block(title, { x: M, y: titleY, w: W - M * 2, h: Math.min(available * 0.54, 225) }, 106, ink, true, 2);
      let y = titleY + titleH + 16;
      if (metadata) { y += block(metadata, { x: M, y, w: W - M * 2, h: 64 }, 28, muted, false, 2) + 16; }
      block(quote, { x: M, y, w: W - M * 2, h: H - 132 - y - (credit ? 38 : 0) }, 30, ink, false, 3);
      if (credit) block(creditLine, { x: M, y: quote ? H - 162 : y, w: W - M * 2, h: 30 }, 24, muted, false, 1);
      footer();
    }
  } else if (options.layout === 'ticket') {
    masthead();
    const ticket = { x: 40, y: 124, w: W - 80, h: H - 170 };
    ctx.fillStyle = paper ? '#e7dac8' : '#201b18'; ctx.beginPath(); ctx.roundRect(ticket.x, ticket.y, ticket.w, ticket.h, 20); ctx.fill();
    const split = wide ? 340 : 426;
    image(options.artwork === 'auto' ? poster ?? photo : photo, { x: 64, y: 148, w: split - 110, h: ticket.h - 48 }, 8);
    ctx.strokeStyle = rule; ctx.lineWidth = 2; ctx.setLineDash([6, 10]); ctx.beginPath(); ctx.moveTo(split, ticket.y + 24); ctx.lineTo(split, H - 64); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = bg;
    [ticket.y, H - 46].forEach((y) => { ctx.beginPath(); ctx.arc(split, y, 19, 0, Math.PI * 2); ctx.fill(); });
    const x = split + 46, w = W - x - 76;
    text('ADMIT ONE GOOD WATCH', x, 184, 20, muted, 600);
    if (wide) {
      block(title, { x, y: 212, w, h: 108 }, 72, ink, true, 2);
      block(metadata, { x, y: 338, w, h: 32 }, 25, muted, false, 1);
      block(creditLine, { x, y: 380, w, h: 28 }, 22, muted, false, 1);
      block(quote, { x, y: 420, w, h: 45 }, 24, ink, false, 1);
      line(x, H - 128, w);
      if (rating) { ctx.textAlign = 'right'; text(rating, W - 76, 184, 25, paper ? ink : accent, 600); ctx.textAlign = 'left'; }
      block(byline, { x, y: H - 100, w, h: 30 }, 22, muted, false, 1, 'left');
    } else {
    const titleH = block(title, { x, y: 222, w, h: Math.min(H * 0.28, 330) }, wide ? 70 : 88, ink, true, 3);
    let y = 242 + titleH;
    if (metadata) y += block(metadata, { x, y, w, h: 76 }, 26, muted, false, 2) + 24;
    block(quote || 'The next story starts here.', { x, y, w, h: H - 265 - y }, 32, ink, false, 5);
    block(creditLine, { x, y: H - 240, w, h: 32 }, 23, muted, false, 1);
    line(x, H - 192, w);
    if (rating) text(rating, x, H - 138, 34, paper ? ink : accent, 600);
    block(byline, { x, y: H - 104, w: w - 140, h: 32 }, 20, muted, false, 1, 'left');
    for (let i = 0; i < 35; i++) { ctx.fillStyle = ink; ctx.fillRect(W - 192 + i * 3, H - 142, i % 3 === 0 ? 2 : 1, 50); }
    }
  } else if (options.layout === 'editorial') {
    masthead(); line(M, 110, W - M * 2, accent);
    const artW = wide ? 230 : 360;
    const artH = wide ? 330 : Math.min(H * 0.46, 760);
    const artY = wide ? 150 : 170;
    image(options.artwork === 'auto' ? poster ?? photo : photo, { x: M, y: artY, w: artW, h: artH }, 4);
    const x = M + artW + 56, w = W - M - x;
    text(`${payload.content.typeLabel.toUpperCase()} / ${payload.content.releaseYear || 'NOW'}`, x, artY + 22, 21, muted, 500);
    if (wide) {
      block(title, { x, y: 204, w, h: 126 }, 74, ink, true, 2);
      block(metadata, { x, y: 348, w, h: 32 }, 25, muted, false, 1);
      block([quote, creditLine].filter(Boolean).join(' · '), { x, y: 405, w, h: 65 }, 26, ink, false, 2);
      if (rating) { ctx.textAlign = 'right'; text(rating, W - M, artY + 22, 27, paper ? ink : accent, 600); ctx.textAlign = 'left'; }
    } else {
    const titleH = block(title, { x, y: artY + 66, w, h: Math.min(artH * 0.5, 320) }, 92, ink, true, 3);
    let y = artY + titleH + 90;
    if (metadata) y += block(metadata, { x, y, w, h: 90 }, 27, muted, false, 3) + 28;
    if (credit) block(`${payload.content.mediaType === 'TV' ? 'Created' : 'Directed'} by ${credit}`, { x, y, w, h: Math.max(32, artY + artH - y - 50) }, 27, muted, false, 2);
    if (rating) text(rating, x, artY + artH - 8, 32, paper ? ink : accent, 600);
    if (!wide && quote) {
      const y = artY + artH + 55;
      text(payload.review ? 'IN THEIR WORDS' : 'A PERSONAL NOTE', M, y, 20, muted, 500);
      block(quote, { x: M, y: y + 30, w: W - M * 2, h: H - 150 - y - 30 }, H > 1500 ? 58 : 42, ink, false, 5);
    }
    }
    footer();
  } else {
    image(photo, { x: 0, y: 0, w: W, h: H });
    shade({ x: 0, y: 0, w: W, h: H });
    masthead(true);
    const bottom = H - 150;
    const titleY = Math.max(160, H * (wide ? 0.35 : 0.55));
    const photoInk = paper ? ink : '#f5f1ed';
    const photoMuted = paper ? muted : '#dfd3ca';
    const titleH = block(title, { x: M, y: titleY, w: W - M * 2, h: (bottom - titleY) * 0.52 }, wide ? 88 : 126, photoInk, true, 3);
    let y = titleY + titleH + 20;
    if (metadata) y += block(metadata, { x: M, y, w: W - M * 2, h: 70 }, 29, photoMuted, false, 2) + 20;
    block(quote, { x: M, y, w: W - M * 2 - (rating ? 170 : 0), h: bottom - y - (credit ? 38 : 0) }, 32, photoInk, false, 4);
    if (credit) block(creditLine, { x: M, y: H - 174, w: W - M * 2 - (rating ? 170 : 0), h: 28 }, 23, photoMuted, false, 1);
    if (rating) { ctx.textAlign = 'right'; text(rating, W - M, H - 148, 32, accent, 600); ctx.textAlign = 'left'; }
    footer(photoInk);
  }

  if (options.texture) {
    ctx.save(); ctx.globalAlpha = paper ? 0.035 : 0.045;
    for (let i = 0; i < 2400; i++) { ctx.fillStyle = i % 2 ? '#ffffff' : '#000000'; ctx.fillRect((i * 139.7) % W, (i * 97.3) % H, 1.5, 1.5); }
    ctx.restore();
  }
  if (options.border) { ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.strokeRect(24, 24, W - 48, H - 48); }
  try { return canvas.toDataURL(options.fileType === 'jpeg' ? 'image/jpeg' : 'image/png', 0.94); }
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

function cover(ctx: CanvasRenderingContext2D, image: HTMLImageElement, box: Box, zoom: number, position: number) {
  const ratio = Math.max(box.w / image.naturalWidth, box.h / image.naturalHeight) * zoom;
  const w = image.naturalWidth * ratio, h = image.naturalHeight * ratio;
  ctx.drawImage(image, box.x + (box.w - w) / 2, box.y + (box.h - h) * position, w, h);
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
