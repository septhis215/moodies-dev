# Moodies Typography Spec — Landing Page as Canonical Source

**Status:** active · **Scope:** all `client/` app router pages and components
**Canonical implementation:** the landing page (`client/app/page.tsx`) and its sections —
`components/hero/heroCarousel.tsx`, `components/sections/CardCarousel.tsx`,
`MoodDiscoverySection.tsx`, `TrendingSection.tsx`, `CommunityPicks.tsx`,
`PremiereHighlights.tsx`, `UpcomingTrailers.tsx`.
**Reference these rules whenever you build or review a page.**

---

## 1. Font families

Defined once in [`client/app/layout.tsx`](../client/app/layout.tsx) and wired in
[`client/app/globals.css`](../client/app/globals.css).

| Token | Face | Loaded weights | Applied to |
|---|---|---|---|
| `--font-body` | Source Sans 3 (variable) | all (200–900) | `body`, therefore every element except `h1`/`h2` |
| `--font-display` | Barlow Condensed | **600 and 700 only** | `h1`, `h2`, and anything carrying `data-display` |

```css
/* globals.css @layer base — the only place families are assigned */
body { font-family: var(--font-body); }
:where(h1, h2, [data-display]) { font-family: var(--font-display); }
```

**Rules**

1. **Never set `font-family` in a component.** Let the element choice assign it. If a
   non-heading element must look like a display heading, add `data-display` — do not add a
   `font-*` family class.
2. **`h3` and below are body font (Source Sans 3).** This is deliberate: card titles are
   `h3` and need the full weight range.
3. `--font-mono` is aliased to `--font-body` — there is no real mono face. Do not use
   `font-mono` for stats or numbers.
4. **Weight ceiling for display text:** because Barlow Condensed only loads 600/700, any
   `font-extrabold` / `font-black` on `h1`/`h2` is *synthesized* (faux-bold) and renders
   inconsistently across browsers. Use `font-bold` (700) on `h1`/`h2` unless the weight is
   first added to the `Barlow_Condensed({ weight: [...] })` config. See §8.

---

## 2. Type scale (role → size)

All sizes are Tailwind utilities; the px column assumes a 16px root.

This is the **target** scale. It is taken from the dominant landing-page pattern; where the
landing page itself still differs, [§8](#8-known-deviations-on-the-landing-page) lists the exact
file and line to fix — do not copy those rows.

| Role | Element | Base (<640) | ≥640 (`sm`) | ≥1024/1280 | px (mobile → desktop) | Weight | Leading | Tracking |
|---|---|---|---|---|---|---|---|---|
| Hero title | `h1` | `text-[2.1rem]`, `min-[390px]:text-[2.45rem]` | `sm:text-[clamp(2.45rem,4.6vw,4rem)]` | `xl:text-[clamp(2.45rem,4.2vw,4.8rem)]` | 33.6 → 76.8 | `font-bold` (display) | `leading-[0.98]` / `leading-[0.96]` | `tracking-normal` |
| Section title | `h2` | `text-3xl` | `sm:text-4xl` | — | 30 → 36 | `font-bold` | `leading-none` | `tracking-normal` |
| Panel / dialog title | `h2`, `h3` | `text-xl` | `sm:text-2xl` | — | 20 → 24 | `font-bold` | `leading-tight` | `tracking-normal` |
| Eyebrow / kicker | `p`, `.ui-kicker` | `text-[11px]` | — | — | 11 | `font-extrabold` (800) | `leading-none` | `tracking-[0.16em]`, `uppercase` |
| Section lead | `p` | `text-sm leading-6` | — | — | 14 / 24 | `font-normal` | 1.71 | `normal` |
| Body | `p` | `text-sm leading-6` | — | — | 14 / 24 | `font-normal` | 1.71 | `normal` |
| Body (long-form) | `p` | `text-base leading-7` | — | — | 16 / 28 | `font-normal` | 1.75 | `normal` |
| Card title (poster) | `h3` | `text-sm leading-5` | — | — | 14 / 20 | `font-semibold` | 1.43 | `normal` |
| Card title (overlay) | `p`, `h3` | `text-base leading-tight` | `sm:text-lg` | — | 16 / 20 | `font-bold` | 1.25 | `normal` |
| Card meta | `span`, `p` | `text-[10px] leading-4` | `sm:text-[11px]` | — | 10 → 11 | `font-semibold` | 1.4 | `normal` |
| Badge / pill | `span` | `text-[9px]` | `sm:text-[10px]` | `lg:text-[11px]` | 9 → 11 | `font-black` | `leading-none` | `tracking-[0.14em]`, `uppercase` |
| Button / CTA | `.ui-primary-action` | `text-sm` | — | — | 14 | `font-extrabold` (800) | `leading-none` | `normal` |
| Text link / action | `Link`, `button` | `text-sm font-semibold` | — | — | 14 / 20 | `font-semibold` | 1.43 | `normal` |
| Micro utility | `span` | `text-xs` | — | — | 12 | `font-normal` | `leading-4` | `normal` |

**Floor:** nothing below **10px** may ship in new UI, and nothing below **12px** may be the
*only* carrier of meaning (pair it with an icon, `aria-label`, or visible label).

---

## 3. Copy-paste recipes

These are the canonical class strings. Paste them verbatim; do not re-derive.

**Section header block** (source: [`CardCarousel.tsx` L185-208](../client/components/sections/CardCarousel.tsx))

```tsx
<section className="ui-shell scroll-mt-24 border-b border-[var(--surface-border)] py-8 sm:py-10"
         aria-labelledby={`${sectionId}-heading`}>
  <div className="mb-5 flex items-end justify-between gap-5">
    <div>
      <h2 id={`${sectionId}-heading`}
          className="text-3xl font-bold leading-none text-[var(--ink)] sm:text-4xl">
        {title}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ink-muted)]">{subtitle}</p>
    </div>
  </div>
</section>
```

Linked titles add `transition-colors group-hover:text-[var(--brand-coral-strong)]` on the `h2`
inside a `group` `Link`.

**Eyebrow** — always the shared utility, never a hand-rolled string:

```tsx
<p className="ui-kicker">Community signal</p>
```

**Hero title**

```tsx
<h1 className="max-w-3xl text-balance text-[2.1rem] font-bold leading-[0.98] tracking-normal
              text-white drop-shadow-[0_8px_28px_rgba(0,0,0,0.56)] min-[390px]:text-[2.45rem]
              sm:text-[clamp(2.45rem,4.6vw,4rem)] sm:leading-[0.96]
              xl:text-[clamp(2.45rem,4.2vw,4.8rem)]">
```

**Card title + meta**

```tsx
<h3 className="mt-2.5 line-clamp-2 text-sm font-semibold leading-5 text-[var(--ink)]
               transition-colors group-hover:text-[var(--brand-coral-strong)]">{title}</h3>
<p className="mt-0.5 text-xs text-[var(--ink-muted)]">{year || "Date TBA"}</p>
```

**CTA** — prefer the classes; use the same values inline only inside the hero:

```tsx
<button className="ui-primary-action">…</button>   {/* or .ui-secondary-action */}
```

---

## 4. Weight ladder

Only these four steps are in play. Anything else signals an accidental one-off.

| Intent | Utility | Notes |
|---|---|---|
| Reading text | `font-normal` (400) | body, leads, descriptions |
| Secondary emphasis | `font-medium` (500) | nav items, filter labels |
| Titles | `font-semibold` (600) → `font-bold` (700) | 600 for card titles, 700 for every heading |
| Attention text | `font-black` (900) | badges, kickers, CTA labels — **body font only** |

CTA labels: `.ui-primary-action` / `.ui-secondary-action` already set `font-weight: 800`.
Inline hero buttons that cannot use the class must match with `font-extrabold`, not
`font-black`. See §8.

---

## 5. Color pairing (fixed pairs)

Type treatment includes its color. Use these pairings; they are the landing-page defaults.

| Text role | Token | Value |
|---|---|---|
| Heading on dark surface | `text-[var(--ink)]` | `#f5f1ed` |
| Lead / body / meta | `text-[var(--ink-muted)]` | `#b9aca7` |
| Eyebrow, hover accent, CTA text | `text-[var(--brand-coral-strong)]` | `#ff765f` |
| Text over photography | `text-white/80` … `text-white/88` | opacity ladder below |

Over-media opacity ladder: `78` (meta) → `80` (body) → `88` (badges) → `100` (title, CTA).
Round to these four; do not introduce `text-white/62`, `/56`, `/58`, `/42` style one-offs.

**Forbidden in new work:** `text-gray-*`, `text-zinc-*`, `text-neutral-*` and raw hex
(`#ff8b78`, `#e94f37`, `#ffb2a5`) for text. Those exist only as legacy debt (§8).

---

## 6. Responsive rules

1. Breakpoints are the Tailwind defaults — `sm` 640, `md` 768, `lg` 1024, `xl` 1280.
   The only approved arbitrary breakpoint is `min-[390px]`, reserved for the hero title.
2. **Maximum two size steps per element.** If a heading needs `base → sm → lg → xl`, it is
   over-tuned; collapse it to `base → sm`.
3. `clamp()` is allowed **only** on the hero `h1`. Every other element uses scale utilities.
4. Arbitrary font sizes (`text-[1.35rem]`, `text-[1.65rem]`, `text-[28px]`) are banned outside
   the hero clamp. Pick the nearest scale step.
5. Tracking and weight do **not** change across breakpoints; size and leading may.

---

## 7. Layout rhythm that the type depends on

Typography only looks consistent when the surrounding rhythm is consistent too.

| Context | Class |
|---|---|
| Page/section horizontal shell | `.ui-shell` (max-width 80rem, padding 1rem → 1.5rem `sm` → 2rem `lg`) |
| Section vertical padding | `py-8 sm:py-10` |
| Section header → grid gap | `mb-5` (`sm:mb-8` for wide editorial grids) |
| Heading → lead | `mt-2` (`h2 text-3xl/4xl`) or `mt-3` (`h2 text-2xl` teaser blocks) |
| Kicker → heading | `mt-2` (or `mb-1` when kicker sits above a small title) |
| Copy measure | headings `max-w-3xl`; leads `max-w-2xl`; hero overview `max-w-xl`→`max-w-2xl` |
| Truncation | `line-clamp-2` for card titles, `line-clamp-3` for overviews, `line-clamp-1` for meta rows |
| Heading alignment | `leading-none` for `h2` section titles, `text-balance` for the hero `h1` |

---

## 8. Known deviations on the landing page

These are the current departures from §2–§6. New pages must not copy them; treat each line as
a cleanup item.

| Where | Today | Required |
|---|---|---|
| `heroCarousel.tsx` L245 | `font-black` on `h1` (Barlow has no 900); xl clamp floor `2.35rem` | `font-bold`; floor at `2.45rem` so the title never shrinks at `sm` |
| `heroCarousel.tsx` L271, L281 | `text-sm font-black` on CTAs | `font-extrabold` to match `.ui-primary-action` |
| `KoreanSection.tsx` L76 | `text-2xl font-black tracking-tight text-white sm:text-3xl` | §3 section header recipe |
| `FavoriteSection.tsx` L285 | `text-xl font-black … text-[#e94f37] sm:text-2xl lg:text-3xl` (3 steps) | section header recipe, `text-[var(--ink)]` |
| `FootballStoriesSection.tsx` L177 | `text-xl font-black sm:text-3xl lg:text-4xl` | section header recipe |
| `PremiereHighlights.tsx` L143/L166, `UpcomingTrailers.tsx` L181/L204 | loading/error states use `text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight`, `py-16 … max-w-[1600px]`, `text-gray-400` | reuse the same shell + heading classes as their loaded state |
| `UpcomingTrailers.tsx` L312 vs `PremiereHighlights.tsx` L277 | `text-sm font-black` vs `text-sm font-bold` for the same card slot | `font-bold` (overlay title recipe) |
| `CommunityPicks.tsx` L287 | hand-rolled kicker `text-[11px] font-bold uppercase tracking-[0.18em] text-[#ff8b78]` | `.ui-kicker` |
| `MoodDiscoverySection.tsx` L178 | `font-extrabold` on `h2` | `font-bold` |
| `CelebsSection.tsx` L214 | `text-[1.35rem] font-bold … sm:text-2xl lg:text-3xl` + gradient text | `text-2xl sm:text-3xl font-bold`, gradient only where it is the brand device |
| `Navbar.tsx` L289 | `text-2xl font-semibold tracking-tight` drawer title | panel title recipe (`font-bold`, no tight tracking on display face) |

Open question to resolve with design (blocks the `font-black` rows above):
extend `Barlow_Condensed({ weight: ["600","700","800","900"] })` so heavy display text
renders a true weight, **or** keep display at 700 and convert every `h1`/`h2` to `font-bold`.
This spec assumes the latter until design decides.

---

## 9. Adoption checklist for other pages

Before opening a PR for a page:

- [ ] Headings are real `h1`/`h2`/`h3` elements (family comes from the tag, not a class).
- [ ] Every size is a scale step from §2 — no new `text-[…]` except the hero clamp.
- [ ] ≤2 size steps per element; ≤4 weights total (§4).
- [ ] Section headers copy the §3 recipe verbatim, including `ui-shell` and `py-8 sm:py-10`.
- [ ] Text colors are tokens from §5; no `gray-*`/`zinc-*`/raw hex for text.
- [ ] Kickers use `.ui-kicker`; CTAs use `.ui-primary-action` / `.ui-secondary-action`.
- [ ] Every `h2` has an `id` and its `<section>` carries `aria-labelledby` (see `TrendingSection`,
      `CardCarousel`); loading and empty states keep the same heading classes.
- [ ] No font-size is below 10px, and no sub-12px text is the sole carrier of meaning.
- [ ] Grep your diff for `text-\[`, `font-black`, `tracking-tight`, `gray-`, `zinc-` and justify
      each remaining hit.

---

## 10. Enforcement (proposed, not yet implemented)

1. Promote the recipes to classes in `globals.css` next to `.ui-kicker`:
   `.ui-section-title`, `.ui-section-lead`, `.ui-panel-title`, `.ui-card-title`.
2. Add a Tailwind-v4 `@theme` type scale so `text-section-title`-style tokens exist and
   arbitrary `text-[…]` becomes visible in diffs.
3. Optional lint rule (ESLint `no-restricted-syntax` or a `grep` CI step) flagging
   `text-\[[0-9.]+rem\]` and `font-black` on `h1|h2` outside the hero.

Nothing here changes runtime behavior today — it documents the pattern the landing page already
follows, so other pages converge instead of inventing their own scale.
