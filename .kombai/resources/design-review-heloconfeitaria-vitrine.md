# Design Review Results: Vitrine Pública — Helô Confeitaria

**Review Date**: 2026-05-02 → **Mobile Deep-Dive Update: 2026-05-04**
**Route**: `/` (index.html — single-page app)
**Focus Areas**: Visual Design, UX/Usability, **Responsive/Mobile (Safari & Chrome)**, Micro-interactions/Motion, Performance, Consistency

---

## Summary

The public storefront has a polished brand identity with strong use of gold/navy color pairing and good micro-interaction work on product cards. The mobile experience, however, has several **critical-path failures**: the hero section consumes 44.5% of the mobile viewport on iPhone 14 Pro and pushes the search bar entirely below the fold; touch targets on category pills and the icon-only Details button are too small for reliable finger tapping (34–38px vs the required 44px); iOS Safari will auto-zoom on cart form inputs because they are styled at 14px; and the floating cart button is not safe-area-aware and will be covered by the iOS home indicator on all modern iPhones (iPhone X+). There are also 6 accessibility violations (4 critical/serious), heavy inline styles harming performance, and a `theme-color` meta tag that is the wrong colour.

---

## Part 1 — General Issues (all viewports)

| # | Issue | Criticality | Category | Location |
|---|-------|-------------|----------|----------|
| 1 | **Image carousel prev/next buttons have no `aria-label`** — icon-only buttons are invisible to screen readers (WCAG 4.1.2) | 🔴 Critical | Accessibility | `public/js/components/product-card.component.js` (carousel nav buttons) |
| 2 | **Carousel dot/indicator buttons have no `aria-label`** — "Go to image X" intent is completely absent for AT users | 🔴 Critical | Accessibility | `public/js/components/product-card.component.js` (dot buttons) |
| 3 | **Active category pill has 1.8:1 contrast** — `#875f00` on computed `#344153` fails WCAG AA (requires 4.5:1 for 12px bold text) | 🔴 Critical | Accessibility | `public/css/style.css:903-909` (`.category-pill.active`) |
| 4 | **Social links in footer have no accessible text** — Instagram, TikTok, WhatsApp `<a>` tags are empty for screen readers | 🟠 High | Accessibility | `public/js/components/rodape-site.component.js` (footer `<a>` elements) |
| 5 | **Hero section is 600px tall on desktop with a small centered logo** — all commercial content (products, trust signals, search) is pushed below the fold; first-time users see an almost entirely empty blue rectangle | 🟠 High | UX/Usability | `public/css/style.css:630-640` (`.helo-logo { height: 600px }`) |
| 6 | **No `<h1>` on the page** — screen readers and search engines find no primary heading; the highest-level headings are `<h2>` inside policy banner | 🟠 High | Accessibility | `public/index.html` + all React components |
| 7 | **No `<main>` landmark** — all page content lives in un-landmarked `<div>`s, breaking skip-navigation and screen reader region navigation (WCAG 1.3.6) | 🟠 High | Accessibility | `public/index.html:51` (`<div id="root">`) |
| 8 | **Search input has no `<label>`** — `placeholder` is not a label substitute; screen readers won't identify the field purpose | 🟠 High | Accessibility | `public/js/components/vitrine-produtos.component.js:304-307` |
| 9 | **6 render-blocking CDN `<script>` tags without `defer` or `async`** — React, Phosphor Icons, Firebase (×3), QZ Tray all block HTML parsing, increasing TTFB impact | 🟠 High | Performance | `public/index.html:37-46` |
| 10 | **"Feito por Couto" footer text has 1.71:1 contrast** — `rgba(255,255,255,0.18)` on `#2a3d5d` is essentially invisible (WCAG AA requires 4.5:1) | 🟠 High | Accessibility | `public/js/components/rodape-site.component.js` (footer `<p>`) |
| 11 | **"Acesso Reservado" footer button has 2.5:1 contrast** — `rgba(243,212,148,0.4)` at 9px is far below WCAG AA | 🟡 Medium | Accessibility | `public/js/components/rodape-site.component.js` (admin button) |
| 12 | **Inline styles throughout every component** — `vitrine-produtos`, `cart-ui`, `ui-shell`, `main-app` all use exclusively inline `style={{}}` objects. This prevents browser CSS caching, makes style overrides difficult, increases JS bundle parse time, and blocks CSS-only optimizations | 🟡 Medium | Performance / Consistency | `public/js/components/vitrine-produtos.component.js`, `public/js/cart-ui.js`, `public/js/ui-shell.js` |
| 13 | **Page size is ~2.5 MB on first load** — Phosphor Icons (`@phosphor-icons/web` from unpkg) loads the entire ~1.2MB icon library when only ~20 icons are used | 🟡 Medium | Performance | `public/index.html:39` |
| 14 | **`text-shadow` is ineffective on `.hero-tagline`** — when `-webkit-text-fill-color: transparent` is used with `background-clip: text`, `text-shadow` is not rendered by browsers | 🟡 Medium | Visual Design | `public/css/style.css:654-676` (`.hero-tagline`) |
| 15 | **Hardcoded hex/rgba colors in inline styles** — values like `rgba(243,212,148,0.9)`, `#fff7dc`, `#2a3d5d`, `#875f00` repeated across multiple component files instead of using established CSS variables | 🟡 Medium | Consistency | `public/js/components/vitrine-produtos.component.js:200-345`, `public/js/cart-ui.js` |
| 16 | **`"Fatias de Ouro Branco"` displays brand logo as product image** — no real product photo, and the fallback shows the full brand logo | 🟡 Medium | Visual Design | Firestore product data + `product-card.component.js` |
| 17 | **Desktop hero layout wastes ≈50% of the viewport** — `.helo-logo` is `600px` and `.hero-premium` has `padding-bottom: 3.7rem`. On a 1080px monitor the entire viewport is consumed by the empty hero | 🟡 Medium | Responsive/Mobile | `public/css/style.css:619-650` |
| 18 | **No `defer` / `async` on React UMD scripts** — UMD React and ReactDOM from unpkg are loaded synchronously | 🟡 Medium | Performance | `public/index.html:37-38` |
| 19 | **Border-radius values have no consistent scale** — uses `9999px`, `2rem`, `1.6rem`, `1.5rem`, `1.35rem`, `1.25rem`, `1.2rem`, `1.1rem`, `1rem`, `.75rem` | ⚪ Low | Consistency | `public/css/style.css` throughout |
| 20 | **`animate-neon-pulse` on "Couto" credit text has a contrast failure** — animated text at min-state is 3.57:1 and draws attention to a decorative attribution | ⚪ Low | Accessibility | `public/css/style.css:215-227` |
| 21 | **No `skip-to-content` link** — keyboard and screen reader users must tab through the entire header/hero before reaching product content | ⚪ Low | Accessibility | `public/index.html` — missing entirely |
| 22 | **Font families applied inconsistently** — body sets `Nunito/Plus Jakarta Sans` but many inline styles override with `fontFamily: 'inherit'` | ⚪ Low | Consistency | `public/css/style.css:56`, `public/js/cart-ui.js` |

---

## Part 2 — Mobile-Specific Findings (Safari · Chrome · 393px–430px viewports)

> Measured at 393×852px (iPhone 14 Pro). Audit run at mobile viewport. Additional findings from iOS/Android Safari compatibility analysis.

| # | Issue | Criticality | Category | Location / Fix |
|---|-------|-------------|----------|----------------|
| 23 | **`<meta name="theme-color" content="#8B4513">` is Saddle Brown — clashes with the navy brand palette** — Android Chrome paints the address bar in this warm brown while the page renders dark navy, creating a jarring mismatch on every Android visit | 🟠 High | Visual Design / Mobile | `public/index.html:10` → change to `#2A3D5D` |
| 24 | **Hero section is 379px tall (44.5% of first screen) on iPhone 14 Pro** — the entire hero with logo and padding occupies nearly half the viewport on load, pushing ALL commercial content (policy, search, products) below the fold | 🟠 High | UX / Mobile | `public/css/style.css` — reduce `padding-bottom` on `.hero-premium` mobile, trim `.logo-wrapper` padding |
| 25 | **Search bar is 15px below the fold at scroll-top on iPhone 14 Pro (852px viewport)** — measured `searchShell.top = 867px`. On iPhone SE (667px) or iPhone 13 mini (780px), the search bar is 85–200px off-screen. A first-time visitor has no cue that products or search even exist. | 🟠 High | UX / Mobile | `public/css/style.css` — add `@media (max-width: 768px)` rule to reduce hero `padding-bottom` from `2.8rem` to `0.5rem`; consider sticky search bar |
| 26 | **Category pill touch targets are 34px tall (WCAG 2.5.5 minimum is 44px)** — `.category-pill { padding: 8px 14px }` renders at ~34px height at 12px font. WCAG 2.5.5 requires 44×44px for touch targets. On stubby fingers or when tapping quickly, the wrong pill fires | 🔴 Critical | Accessibility / Mobile | `public/css/style.css:888-909` → change mobile padding to `padding: 11px 16px` |
| 27 | **Cart form inputs use `font-size: 14px` — iOS Safari auto-zooms the viewport on focus** — Safari automatically zooms in when the focused input's `font-size` is < 16px, causing a jarring full-page zoom that the user must manually undo. Affects all cart inputs: Name, Phone, Street, Neighborhood, Reference, Observations, Change Amount | 🔴 Critical | UX / iOS Safari | `public/js/cart-ui.js` — set `inp.fontSize: '16px'` (or add `@media` rule in CSS) |
| 28 | **Floating cart button is NOT iOS home-bar-aware — covered on iPhone X and newer** — `bottom: 0.8rem` (≈13px) places the button within the 34px home-indicator gesture area. The button is partially or fully hidden under the iOS home bar. `viewport-fit=cover` is also missing from the `<meta name="viewport">` tag, so `env(safe-area-inset-bottom)` cannot be used. | 🔴 Critical | UX / iOS Safari | `public/index.html:6` → add `viewport-fit=cover` to viewport meta; `public/css/style.css:569-588` → add `padding-bottom: env(safe-area-inset-bottom, 0px)` or `bottom: calc(0.8rem + env(safe-area-inset-bottom, 0px))` |
| 29 | **Cart scroll container missing `overscroll-behavior: contain`** — When a user scrolls inside the cart drawer and reaches the top/bottom, iOS Safari's rubber-band scroll "bleeds through" to the page behind, scrolling the product catalog unexpectedly. This is one of the most reported UX bugs on iOS cart drawers | 🟠 High | UX / iOS Safari | `public/js/cart-ui.js:160` — add `overscrollBehavior: 'contain'` to the `.hide-scrollbar` div's inline style |
| 30 | **Product card "Detalhes" button shrinks to 38×38px icon-only on mobile (below 44px minimum)** — `.product-card-details-btn { width: 38px; height: 38px }` on `max-width: 768px` with the label hidden. Six pixels short of WCAG 2.5.5 | 🟡 Medium | Accessibility / Mobile | `public/css/style.css:1223-1229` → increase to `width: 44px; height: 44px; flex: 0 0 44px` |
| 31 | **Floating cart button overlaps product "Comprar" button** — The fixed button at `right: 0.7rem; bottom: 0.8rem` visually overlaps the buy button on product cards that appear near the bottom of the viewport. Confirmed in scrolled mobile screenshots. | 🟡 Medium | UX / Mobile | `public/css/style.css:569` — increase `right` from `0.7rem` to `1.5rem` OR adjust product card `padding-right` to add clearance; consider adding `margin-right: 4rem` only to the last visible row of cards |
| 32 | **`html` element has no `background-color`** — On iOS pull-to-refresh and Android overscroll, the rubber-band area renders the `html` element's background (unset = white/transparent). The user momentarily sees a white flash at the top of the page instead of the brand navy `#2A3D5D` | 🟡 Medium | Visual Design / Mobile | `public/css/style.css:11-17` — add `background-color: #2A3D5D` to the `html {}` block |
| 33 | **Cart close button is 40px — below the 44px minimum touch target** — `button { padding: 8px }` around a 24px icon = ~40px. Difficult to hit reliably on small screens. | 🟡 Medium | Accessibility / Mobile | `public/js/cart-ui.js:155` — change `padding: '8px'` to `padding: '10px'` on close button |

---

## Criticality Legend

- 🔴 **Critical**: Breaks functionality or violates accessibility standards (WCAG A/AA)
- 🟠 **High**: Significantly impacts user experience or design quality
- 🟡 **Medium**: Noticeable issue that should be addressed
- ⚪ **Low**: Nice-to-have improvement

---

## Mobile Metrics Summary (iPhone 14 Pro, 393×852px)

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Hero height at scroll-top | 379px (44.5% of viewport) | < 200px | ❌ |
| Search bar position (scroll-top) | 867px top (15px below fold) | < 852px | ❌ |
| Category pill touch height | 34px | ≥ 44px | ❌ |
| Details button touch size | 38×38px | ≥ 44×44px | ❌ |
| Cart close button touch size | ~40px | ≥ 44px | ❌ |
| Cart input font-size | 14px | ≥ 16px (Safari) | ❌ |
| `overscroll-behavior: contain` on cart | Missing | Required | ❌ |
| `env(safe-area-inset-bottom)` on cart FAB | Missing | Required on iOS | ❌ |
| `viewport-fit=cover` in meta viewport | Missing | Required for safe-area | ❌ |
| `theme-color` matches brand | ❌ (`#8B4513`) | `#2A3D5D` | ❌ |
| FCP | 1220ms | < 1800ms | ✅ |
| INP | 112ms | < 200ms | ✅ |
| CLS | 0.001 | < 0.1 | ✅ |

---

## Next Steps — Suggested Prioritization

### Sprint 1 — Mobile Critical Fixes (1–2 hours)
1. **`viewport-fit=cover` + safe-area insets** — add `viewport-fit=cover` to meta viewport; add `bottom: calc(0.8rem + env(safe-area-inset-bottom, 0px))` to `.floating-cart-btn` (Issue #28)
2. **iOS Safari input zoom** — change cart `inp` object `fontSize` from `'14px'` to `'16px'`; or add `font-size: 16px` to all cart inputs in CSS (Issue #27)
3. **`overscroll-behavior: contain`** on cart scroll container (Issue #29)
4. **Fix `theme-color`** from `#8B4513` to `#2A3D5D` (Issue #23)
5. **Fix `html` background-color** to `#2A3D5D` (Issue #32)

### Sprint 2 — Mobile Touch Targets
6. **Category pills**: `padding: 11px 16px` on mobile → 44px height (Issue #26)
7. **Details button**: `width/height: 44px` on mobile (Issue #30)
8. **Cart close button**: `padding: 10px` (Issue #33)

### Sprint 3 — Mobile Layout
9. **Reduce hero height on mobile** — cut `.hero-premium` `padding-bottom` from `2.8rem` to `0.5rem`; consider cutting `.logo-wrapper` `padding` from `20px 12px` to `12px 12px` — saves ~40px (Issues #24, #25)
10. **Float cart button offset** — increase `right` or add card clearance to fix overlap with buy buttons (Issue #31)

### Sprint 4 — Accessibility (all viewports)
11. Add `aria-label` to carousel prev/next + dot buttons (Issues #1, #2)
12. Add `aria-label` to footer social links (Issue #4)
13. Fix active category pill contrast → `color: #fff; background: var(--primary)` (Issue #3)
14. Add `aria-label="Procurar produto por sabor"` to search input (Issue #8)
15. Add `<h1>` + `<main>` landmark (Issues #6, #7)
16. Increase "Feito por Couto" and "Acesso Reservado" contrast (Issues #10, #11)

### Sprint 5 — Performance
17. Add `defer` to all CDN `<script>` tags (Issues #9, #18)
18. Replace full Phosphor Icons CDN with individual SVGs (Issue #13)

### Sprint 6 — Maintainability
19. Move inline styles to CSS classes using existing CSS variables (Issues #12, #15)
20. Remove dead `text-shadow` from `.hero-tagline` (Issue #14)
21. Define a `--radius-*` token scale and apply consistently (Issue #19)
