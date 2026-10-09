# Recommendation audit — before R1 (5 October 2026)

## What exists

The real TMDB adapter provides bounded India/language/provider discover pools and up to three TMDB recommendation seed pools. Canonical IDs deduplicate titles. Separate metadata retrieval preserves saved items outside candidate pages. Home, Discover, For You and related-title pages call one ranker. Local v2 state stores subscriptions, languages, genres, likes/dislikes, favorites, ratings, watchlist, watched and Not Interested. Watched entries are forcibly private.

## Static versus dynamic

Scores respond immediately to current arrays/preferences. Explicit search and sorts override personalization. Like/favorite/rating/watchlist similarities, a negative penalty, Bayesian audience quality, popularity/recency and greedy MMR exist. However the strongest matching neighbor dominates; repeated evidence does not build confidence. Fixed candidate pools ignore learned people/themes. There are no event timestamps, recency/session distinction, exposure data, provenance, row generation or row ranking. Home/For You are substantially the same grid. There is no recommendation debugger.

## Authentication/database

No authentication or account persistence exists to preserve/rebuild. The MongoDB driver and owner-supplied server-only URI are configured. A read-only ping now succeeds. Anonymous storage is currently the only persistence mechanism. Account ownership, sessions, password hashing, anonymous import and logout isolation must be implemented before claiming individualized account recommendations.

## Refactor scope

Preserve TMDB integration, existing visual design, title/library controls, privacy and exact-search behavior. Introduce timestamped private events and per-signal update times; centralized model configuration; regularized multidimensional long-term/recent/session profiles; provenance-bearing retrieval plans; a shared observable scorer; diversity/exploration; evidence-supported rows and page composition. Integrate optional email/password sessions and server-owned MongoDB profiles with revision checks. Metadata caches remain shared; personalized state/responses do not. Test changes after each stage and prove two-account isolation. Use localhost:5000. GitHub remains deferred.
