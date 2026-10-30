# Navigation design review

Updated 30 October 2026. Changes are local; dev.moodies.tech has not been deployed.

## Applied design

- The shared Navbar owns the redesign across existing site routes.
- Desktop Movies and TV shows have prominent, direct homepage cards. The current destination retains its visible active treatment and aria-current state.
- One desktop warm gold feature integrates the existing transparent Moodies popcorn mascot and links directly to the mood wheel. The artwork has reserved dimensions, decorative alt text, responsive image sizes, and only a reduced-motion-aware hover reaction.
- The header has a stronger display title. Group headings use existing Tabler icons, with ordinary links and quiet hover/focus arrows below.
- The desktop Discover, Community & people, Mood tools, and Your library groups remain flat.
- At the user's latest request, mobile restores the original design from HEAD: icon-only menu toggle, Moodies guide / Where to next? introduction, seven mascot destination rows, separate More disclosures with the original quick links, and the original guest/member account card. Main Movies and TV shows links still go directly to their homepages. The new rich cards and flat columns are desktop-only (1024px and above).
- Existing native-modal focus containment, inert background, Escape, scroll lock, focus restoration, account state, search, and sign-out recovery remain owned by their existing implementations.
- The user's request for richer mascot integration supersedes the previous restrained/no-mascot navigation treatment. DESIGN.md records this change. Existing runtime colours and fonts remain authoritative; no dependencies or new artwork were added.

## Verification

- Client typecheck passed.
- Frontend production build completed and generated all 45 static-page build steps. Its lint phase reported the existing eslint-config-next/core-web-vitals import-resolution error; lint configuration was not changed. Next.js-generated tsconfig formatting/JSX changes were restored afterward.
- Navigation Playwright checks passed at 320, 390, 768, 1024, and 1440px, including desktop mascot loading, mobile More expand/collapse, direct destinations, modal geometry, keyboard focus, Escape, route dismissal, and short-height scrolling.
- Actual Movies → TV shows → Movies navigation passed at 390 and 1440px, with active-page semantics checked.
- Mobile and desktop search, authenticated account actions, breakpoint cleanup, and failed sign-out/retry passed. Browser API fixtures isolate navigation/account behaviour; the local backend was unavailable for homepage content, so hub data accuracy was not assessed.
- Desktop and mobile screenshots were visually inspected. The desktop capture includes the local Next.js development indicator; this is development tooling, not navigation UI.
- Independent static review reported no actionable regressions in the navigation structure and preserved behaviour. A further review compared the restored mobile routes, quick links, mascot mapping, header and account card against HEAD, and confirmed desktop/mobile responsive scoping. Current desktop and original-mobile screenshots were inspected after restoration.
- DESIGN.md lint completed with zero errors and six warnings about mirrored colour tokens not referenced by its component metadata. Runtime tokens remain in globals.css.
- Next.js image documentation was retrieved through Context7 for reserved dimensions, responsive sizes, and decorative image text.
- git diff --check passed. No alert/confirm/prompt, placeholder links, raw colour literals, or local font-family overrides were added.

The strict Python design auditor could not run because the repository's required uv launcher is unavailable. No claim of a full accessibility audit is made. Review cost for this follow-up is approximately 18 project files and 12 searches, including the author and checker; skill/reference reads are separate.

## Previews

- [Desktop](./navigation-1440.png)
- [Mobile](./navigation-390.png)
