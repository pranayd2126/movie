# NextScene Studio — frontend redesign

## 1. Direction
A personal cinema journal: editorial typography, ink-colored surfaces, violet accents, intentional whitespace, and real poster art. Desktop navigation becomes a persistent left rail. The visual hierarchy distinguishes a featured evening pick, deeper discovery, and a private personal edit.

## 2. Areas redesigned
Home spotlight and exploration links; Discover controls, poster rows and progressive states; For You with actual private Like/rating/favorite counts; Taste workspace; title details and availability; account form; onboarding; library; privacy/settings; Movie Club preview; credits; shared dialogs, loading and empty states.

## 3. Navigation and UX
Desktop rail provides all existing destinations, preferences and a Taste entry. Mobile keeps thumb-accessible bottom navigation. Home introduces three direct paths: Explore, Refine and Your Edit. The search shortcut focuses the field both when entering Discover and when already on that page. Horizontal rails have desktop arrow controls and focusable regions for keyboard scrolling. All existing filters and feedback actions remain.

## 4. Motion and depth
Real poster artwork in the Home spotlight uses a modest CSS perspective treatment, with a small hover response. Cards use restrained scaling; navigation and controls have short transitions. Taste retains its existing pointer-driven motion and decision code. No WebGL scene, animation framework, parallax listener or new dependency was added.

## 5. Mobile
Separate mobile navigation; horizontally scrollable journey cards, filter chips and poster rows; stacked title/account layouts; two-column advanced filters and service choices. Taste card dimensions account for viewport height so its primary actions remain reachable. Verified layouts at 390px and 820px; desktop review at 1280px. Document width matched the viewport in sampled Discover, title, Club, credits and tablet layouts.

## 6. Accessibility
Semantic buttons/links, descriptive carousel controls, current-page navigation states, focus outlines, existing feedback pressed states and native dialog trapping are retained. Fixed dialog close returning focus to its opener; unique dialog heading IDs prevent collisions. Reduced-motion CSS disables decorative transforms/transitions; carousel controls honor reduced motion. Main mobile feedback controls use at least 44px targets. Reduced motion was inspected in code, not tested by changing the operating system setting. This is not a formal assistive-technology audit.

## 7. Performance
No new runtime dependencies. Feed posters remain lazy and feed bounds remain unchanged. Featured/detail posters use eager loading after Next.js reported them as largest-contentful-paint images. The depth treatment uses CSS transforms; only the single featured poster and detail backdrop add visual emphasis. A presentation stylesheet is loaded after the established base rules, preserving existing functional styling. No continuous scroll listener was introduced.

## 8. Frontend architecture
New PosterRail is presentation-only: it scrolls rendered children and does not choose candidates or emit replacement feedback. Studio styles hold the new design tokens and responsive component treatments. Existing components continue to own the same data requests, state updates and event calls. Existing base CSS remains for untouched behavior and fallbacks.

## 9. Verification
- TypeScript passed.
- Production build passed, including static page generation; subsequent presentation refinements added long-heading wrapping and eager featured/detail poster loading.
- Discover automatically appended 8 → 12 rows with identical existing row IDs/order.
- Carousel arrow advanced the first row; keyboard ArrowRight scrolled a mobile-width row while the document remained horizontally contained.
- Search found real Interstellar results. A watchlist save appeared on the detail page and in the private library; the test save was removed afterward.
- Detail Like, Watched, Not Interested and rating controls changed state correctly. Reopening the rating dialog showed the selected 4.5-star value; test changes were reversed.
- Cast/crew, provider offer types, trailer and share controls remained exposed. No external trailer or provider purchase was performed.
- Taste Like advanced the deck, Undo restored the card, keyboard-left advanced with Not Interested, and Undo restored it again.
- Mobile Funny + under-two-hours filters reset the feed and returned 4 initial rows; controls fit the viewport.
- Fresh dedicated test-account signup completed all three onboarding steps. English and the selected service were reflected in Settings after navigation.
- Signed-out and signed-in account views were inspected. A full repeat of auth/account-isolation regression was not run.
- Dialog keyboard focus stayed inside the open dialog; Escape closed it and returned focus to Fine-tune.
- Empty search results showed recovery controls; clear filters restored discovery. Skeleton states were observed during loading.
- Home, Discover, For You, Taste, title details, library, account, Settings, Club and credits were reviewed in the browser.

## 10. Limitations
Actual device touch hardware, screen readers and reduced-motion OS emulation were not tested. Horizontal keyboard/arrow scrolling and mobile viewport layouts were checked; no claim of a real-device gesture audit. Upstream failure injection was not repeated in this frontend phase; existing error/retry logic was retained. Existing server-memory Discover continuation can expire across Vercel instances; this backend deployment limitation was not changed. Home and For You retain their existing pagination semantics. Login recovery/email verification and social publishing remain unavailable as before. Comprehensive backend regression remains deferred.

## 11. Backend boundary
No intentional changes to backend, recommendation algorithms, scoring, candidate generation, MongoDB, authentication, API contracts, provider logic, event persistence, data models or server caches. Git diff confirms no changes under src/server, src/modules, src/adapters or src/app/api. No environment, package or deployment configuration was changed. No GitHub push or deployment.

## 12. Files changed
- src/app/layout.tsx — loads the presentation stylesheet.
- src/app/studio.css — new visual system and responsive treatments.
- src/components/header.tsx — navigation rail, top controls and search focus.
- src/components/catalog.tsx — page identities, spotlight, entry cards, private taste summary, carousel integration.
- src/components/poster-rail.tsx — reusable presentation-only carousel.
- src/components/progressive-discover.tsx — wraps existing row content in the carousel.
- src/components/detail.tsx — real backdrop and accurate title-link sharing copy.
- src/components/taste-trainer.tsx — focused workspace presentation and guidance.
- src/components/account.tsx — split account presentation.
- src/components/onboarding.tsx — visible three-step progress.
- src/components/primitives.tsx — dialog IDs and return-focus behavior.
- docs/verification/redesign/ — browser screenshots.
- docs/FRONTEND_REDESIGN_REPORT.md — this report.

App remains on http://localhost:5000. Run `npm run dev` from the project directory when an instance is not already running. Test-account credentials are outside the repository and are not included in this report.
