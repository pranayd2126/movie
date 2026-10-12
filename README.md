# NextScene

An India-first movie and TV discovery application built with Next.js and TypeScript. The normal application uses real TMDB metadata and artwork, plus India (`IN`) watch-provider listings powered by JustWatch through TMDB. No fictional catalog fallback is enabled.

## Run locally

Requires Node 20.19+.

```bash
npm install
# Copy .env.example to .env.local only if .env.local does not already exist.
# Add TMDB_READ_ACCESS_TOKEN locally; never paste secrets into chat or source files.
npm run dev
```

Open http://localhost:5000. `.env`, `.env.local` and other filled env files are ignored; `.env.example` contains placeholders only. All provider credentials stay on the server. `TMDB_ACCESS_TOKEN` is also accepted as an alias; `TMDB_API_KEY` is an optional alternative.

TMDB registration: https://www.themoviedb.org/settings/api. Free access is for non-commercial use with attribution; commercial licensing is separate. India availability may be incomplete/stale and does not establish season, plan or dubbing entitlement. Watch-option links use TMDB's supplied destination, not invented provider playback links.

## Working features

- Anonymous Home, Discover, For You and movie/TV detail pages backed by the replaceable catalog adapter.
- Live search, paginated candidate retrieval, India service selection, original-language/genre/mood/runtime/rating/year filters, and explicit rating/newest/A–Z sorting within retrieved results.
- Real posters/backdrops, cast and crew, trailer references, and separately labelled subscription/rent/buy/channel/free offers.
- Shared content-based ranking with configurable weights, negative signals, diversity and evidence-based explanations. TMDB recommendations supply candidates; our service ranks them.
- Persistent anonymous watchlist, likes, dislikes, favorites, ratings, Not Interested and private watched history. Saved metadata is fetched independently of discovery pagination.
- Privacy controls, local export/reset, neutral watched behavior, and explicit title-link sharing containing no private activity.

## Architecture

- `src/modules/catalog/types.ts`: provider-independent catalog contract and canonical `tmdb:movie:<id>` / `tmdb:tv:<id>` identities.
- `src/adapters/tmdb/`: server-only API implementation; caching, request deduplication, bounded concurrency and sanitized errors.
- `src/server/catalog.ts`: adapter selection. Routes depend on the catalog contract.
- `src/modules/recommendations/rank.ts`: shared scoring, exclusions, diversity, surface strategy and explanations.
- `src/modules/library/state.ts`: validated private local state. Legacy fictional IDs cannot become real interactions.
- `src/components/use-title-metadata.ts`: independent metadata retrieval for saved/evidence records.

Original-language preferences do not imply a streaming provider has that audio track. Mood tags are genre-based heuristics. Recommendations are a content-based first version, not a trained collaborative model or a demonstrated quality benchmark. Personalized candidate retrieval is bounded to 60 records per page (36 for ordinary catalog search); user sorts apply to loaded results rather than the whole TMDB database.

## Database and accounts

MongoDB was selected by the owner in place of the earlier PostgreSQL proposal. `MONGODB_URI` is server-only and configured locally. A read-only connection check is available:

```bash
node scripts/check-connections.mjs
```

Email/password signup and login, opaque HttpOnly sessions, and private MongoDB profiles are working. Passwords use salted scrypt; sessions store hashed tokens. Account state never goes into anonymous local storage. Writes use session ownership and revision checks; anonymous import is opt-in. MongoDB and TMDB connection checks pass. Watch history stays private and does not teach enjoyment. Email verification, password recovery and social publishing are not enabled.

The shared recommendation engine builds long-term, recent and session profiles, retrieves multiple real TMDB candidate pools, reranks with diversity, and composes personalized rows. See [the recommendation report](docs/RECOMMENDATION_REPORT.md) for the model, limits and test evidence. Development-only diagnostics are at `/debug/recommendations`.


## Verification

```bash
npm test
npm run typecheck
npm run build
# With a dev server running and working TMDB credentials:
npx tsx scripts/verify-live.mts
# Creates disposable reserved-domain test accounts in the configured database:
npx tsx scripts/verify-accounts.mts
```

Unit tests cover private watched history, legacy/untrusted state, offer eligibility, negative/positive signal strength, explicit search/sort behavior, and shared deterministic ranking. Live verification covers three India preference personas, movie/TV metadata, provider IDs, search, missing results and invalid IDs.

For production-mode local testing: `npm run build && npm start` (also localhost:5000; stop the dev process first).

GitHub and deployment remain deferred. The app is a local preview; do not deploy until account authorization, abuse controls and commercial/data terms are reviewed for the actual launch scope.

Taste supports right-swipe Like, left-swipe Not Interested, animated button/keyboard choices, Undo, and card-to-detail navigation. See [the focused Taste polish report](docs/TASTE_FEATURE_REPORT.md) for implementation details, evidence and verification limits. Run only its focused checks with `npx tsx --conditions=react-server --test tests/swipe.test.ts`.

### Vercel request origins

Set `APP_ORIGIN` to your canonical site origin (for example, `https://movie-qx5f.vercel.app`). Do not use localhost in the deployed environment. Keep Vercel's automatically exposed system environment variables enabled: the server accepts the exact `VERCEL_URL`, `VERCEL_BRANCH_URL`, and `VERCEL_PROJECT_PRODUCTION_URL` when running on Vercel. It does not trust arbitrary Host headers or all vercel.app domains. Redeploy after changing environment variables or the origin-check code.

If a page reports “This request must come from the application,” the request was rejected before the movie API was called. Verify the deployment includes the updated origin guard and the matching environment configuration.
