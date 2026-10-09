# Taste interaction polish — 7 October 2026

The existing Taste feature, recommendation engine, authentication, MongoDB persistence, privacy semantics, and real TMDB catalog are preserved. GitHub remains deferred. This pass ran focused checks only, not the postponed application regression suite or a production build.

## Interaction changes

- The active card uses the existing canonical `/movie/:id` or `/series/:id` route. Opening records the existing click event; it does not Like, dislike, or pass the title.
- Tap detection measures maximum pointer travel, including a drag that returns to its starting point. Up to 8px is a tap; larger movement or pointer cancellation suppresses the release click. Enter remains available after swiping.
- Pointer movement updates refs and transform/opacity through requestAnimationFrame, without React state updates per move. Drag follows horizontal movement directly, with restrained rotation and progressive Like/Not Interested indicators.
- A damped spring returns an uncommitted card to rest. A successful swipe continues from its released position into an accelerating exit. Buttons and arrow keys use this same pipeline. Feedback updates and ranking happen after exit; incoming candidate results are deferred while manipulating a card.
- Central thresholds: distance is max(72px, 24% of card width); a flick requires at least 36px and 0.65px/ms in the drag direction, using recent samples from the last 90ms. Tiny movements and vertical-dominant gestures cannot decide a title.
- Two already-mounted cards sit underneath. Their scale, vertical offset and opacity advance continuously with drag progress. The prepared next title is pinned across the decision, and keyed image nodes remain mounted when it becomes active.
- Undo keeps existing field-specific restoration and persistence, with a spring entrance from the decision direction. The existing choice counter continues to count decisions, including subsequently undone decisions.
- Only current + two upcoming posters are eagerly loaded. Failed artwork displays an explicit fallback. Trailers remain optional external YouTube links, with no players embedded in the stack.
- `touch-action: pan-y` preserves native vertical touch scrolling; pointer cancellation springs back without navigation. Text selection and native image dragging are disabled. Reduced-motion users receive immediate transitions.
- A small in-memory deck snapshot preserves active card, candidates, seen cards, Undo and count across SPA navigation. It is replaced on account/session adoption; old unmount cleanup writes only to the old account's map. It is not persisted to disk or shared across identities. Reloading may start a fresh deck.

## Focused evidence

- `npm run typecheck`: passed.
- `npx tsx --conditions=react-server --test tests/swipe.test.ts`: **9 passed, 0 failed**. Covers tap tolerance, distance/velocity/vertical rejection, spring convergence, shared feedback semantics, Undo, exact-title suppression, recommendation adaptation and trailer selection.
- Actual browser on localhost:5000: card click opened **Voicemails for Isabelle**, movie 614945. The first real TMDB request failed transiently; retry loaded matching synopsis, ratings, cast and Netflix India subscription availability. Like/dislike were unchecked. MongoDB before/after confirmed opening added click/title-open events without changing likes or passes.
- A **5px** pointer drag opened the same details; a **24px** drag stayed on Taste with unchanged count and returned to a zero transform. A **165px** right drag liked the movie and promoted the previously mounted, loaded **The Office** card. A 165px left drag passed The Office without navigating.
- Right/left buttons and both arrow keys produced the appropriate choices. Undo restored the correct cards. MongoDB recorded gesture/button/keyboard sources, plus restore/unlike and swipe_undo events. After undoing the keyboard pass, **That '90s Show** was absent from dismissed titles.
- Enter on the restored series card opened the existing `/series/135959` detail page with matching real synopsis, cast, Netflix India listing and unchecked Like/dislike controls.
- Back restored the original movie card and zero-choice count during navigation tests. Later navigation retained the continuing deck state.
- Current and both next poster images were loaded before the tested right-swipe transition. No video/iframe players run inside the deck. Trailer selection/fallback tests pass; the earlier focused feature pass verified the real Inception YouTube link.
- Recent browser error/warning query returned no entries. Server logs showed successful profile writes and recommendation responses, along with intermittent upstream TMDB image timeouts. No unhandled rejection or hydration failure was observed in these focused interactions.

## Verification limits

The mobile viewport capability timed out twice; its reset also timed out. The page remained at desktop dimensions during this pass. Earlier mobile layout testing does not establish physical touch quality for this new motion implementation. Real phone testing and subjective motion feel remain for manual review. Velocity behavior and spring response are covered by deterministic tests; no hardware frame-rate measurement is claimed.

TMDB metadata and image requests remain intermittently slow/unavailable. Loaded cards continue working, detail retry recovered in the observed failure, and failed poster loads now show a fallback. A slow/unavailable upcoming image can still require a placeholder. Public sharing, account-isolation regression, and broad recommendation evaluation were not rerun in this focused polish pass.

## Files changed in this polish

- `src/components/swipe-stack.tsx`
- `src/components/taste-trainer.tsx`
- `src/components/local-provider.tsx`
- `src/components/primitives.tsx`
- `src/modules/recommendations/swipe.ts`
- `src/app/globals.css`
- `tests/swipe.test.ts`
- `README.md`, this report, and `docs/verification/taste-desktop.jpg`

## Run locally

```bash
cd /Users/pranayreddy/Desktop/movie
npm run dev
```

Open http://localhost:5000/taste. The existing dev server was left running for manual testing.
