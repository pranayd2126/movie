# Real-data milestone — controlling addendum

Owner direction, 5 October 2026. This supersedes the fixture-first normal application plan in earlier documents. Preserve the existing working UI, adapter, privacy logic and preferences architecture; do not restart. Stop generating fictional titles/artwork. Existing fixtures may support isolated tests but must not power the normal product once real integration is operational. Do not substitute fixtures on API failure.

## Selected data source and current blocker

Use the official TMDB API for movie/TV metadata, search/discovery, title details, credits, genres/languages, real posters/backdrops, video references, similar/recommendation candidates, and TMDB-labelled ratings. Retrieve India watch-provider results from `results.IN`. Use `/discover/movie` and `/discover/tv` with `watch_region=IN`, actual selected provider IDs and the appropriate monetization filters.

TMDB credentials are configured in ignored `.env.local`. The server-side Read Access Token returned HTTP 200. Real movie/TV metadata, poster/backdrop URLs, credits, trailer references and India offers have been exercised. The live adapter is now the normal runtime source; source failures never fall back to fixtures.

MongoDB replaces the earlier PostgreSQL plan at the owner's request. The supplied URI is local/server-only. A read-only ping times out before authentication, so login and account synchronization remain disabled; anonymous local persistence is working. No database records have been changed.

Official sources checked:

- [Getting started and registration](https://developer.themoviedb.org/docs/getting-started)
- [Application authentication](https://developer.themoviedb.org/docs/authentication-application)
- [Image configuration and paths](https://developer.themoviedb.org/docs/image-basics)
- [Movie providers](https://developer.themoviedb.org/reference/movie-watch-providers) and [TV providers](https://developer.themoviedb.org/reference/tv-series-watch-providers)
- [Movie discover](https://developer.themoviedb.org/reference/discover-movie) and [TV discover](https://developer.themoviedb.org/reference/discover-tv)
- [TMDB API terms summary and attribution](https://developer.themoviedb.org/docs/faq)

Limits: no full provider deep links from the watch-provider endpoints; use the returned TMDB watch-options destination with JustWatch attribution. Availability may be incomplete/stale and cannot prove every season, dubbing track, plan or channel entitlement. Preserve separate provider/channel identities. Treat unknown entitlement as unknown, never included in the base subscription. TMDB scores are not IMDb ratings. Global trending must not be labelled India trending merely because presentation language or watch region is set. Non-commercial free API access does not automatically authorize the planned commercial product; commercial rights require a separate review. No purchases.

## Shared architecture

Real TMDB candidates → shared recommendation service → Home / For You / Discover / related-title suggestions. Anonymous users supply local preferences/signals; signed-in users eventually supply owner-authorized MongoDB signals. Do not duplicate scoring formulas in UI components.

Canonical references: `tmdb:movie:<id>` and `tmdb:tv:<id>`. Persist identity by source, media type and external ID, never name. Keep library metadata lookup separate from ranking/candidate pagination so saved titles remain visible even when they are no longer candidates. Do not copy the entire TMDB database into MongoDB. Store users, interactions, preferences, privacy, recommendation events and a bounded optional metadata cache.

Initial pipeline: candidate generation → hard user constraints and exclusions → multidimensional features/taste profile → configurable scoring → diversity → evidence-based explanations. Movie and TV provider catalogs are fetched/mapped by real IDs. Build subscription-first and separately labelled other-great-picks/rent-buy groups. Explicit provider filters remain strict; explicit title search is not suppressed by recommendation dislikes or out-of-subscription ranking. User-selected rating/date/alphabetical sorts win.

Signals: favorite/high rating/like are strong positives; watchlist is moderate interest; dislike/low rating are negatives; Not Interested excludes the exact title without automatically penalizing every attribute; watched alone supplies no positive enjoyment weight. Add explicit dislike and favorite state/actions to the existing library. Cast, creator, genre combinations, language, runtime, era and keywords can become features when metadata/evidence supports them. No made-up match percentages, reasons, collaborative or social signals.

## End-to-end replacement

After credential validation, all normal title-bearing surfaces use real identities, metadata and image paths: Home, search/discover, movies/TV details, credits, genres/languages, editorial/trending/popular/high-rated/recent pools, similar titles, recommender candidates, saved/liked/disliked/favorite/rated/watched collections and For You. Remove the hardcoded fictional hero and poster sheet from normal rendering. Preserve existing component layout and private preferences behavior; isolate old demo interactions rather than mapping fictional IDs to real films. No silent mock fallback.

Cache and deduplicate server requests, use bounded fan-out and pagination, handle 401/429/timeouts explicitly, and render missing artwork/metadata as truthful empty states. Do not mislabel original language as provider dubbing. Implement TMDB/JustWatch attribution with approved assets.

## Privacy and scope

Watch history and private taste/events remain private before and after login. No automatic publication. Social implementation comes later. The immediate success criterion is an anonymous visitor using real Indian movie/TV discovery, real provider selection, languages, likes/dislikes/ratings/watchlist/Not Interested and seeing recommendations respond. Account sync uses MongoDB later when configured, without blocking discovery.

GitHub remains deferred. No further image generation or fictional-data work. Required external configuration is an explicit pause point, not a reason to invent live content.

## Verification before declaring the milestone complete

Verify real movie + TV API access, artwork loading, India providers, supported offer types, no-results/missing metadata/error states and long/Indian-script titles. Test mobile and desktop journeys. Compare Telugu + Netflix/Prime thriller-action, Hindi/English + Netflix drama/sci-fi, and Tamil/Malayalam + multiple-service crime-comedy personas. Check recommendation changes after positive/negative signals, exact Not Interested exclusion, moderate watchlist contribution, neutral watched behavior, service/language changes, deterministic explanations and account isolation on logout when auth is added. Report actual tests and remaining limitations.


## Implemented scope and current limitations

Home, Discover, For You, details, cast/trailers, private saved/rated/liked/disliked/favorite/watched collections now use canonical real identities. The shared ranker uses genre, keyword, cast/creator, original language, era and runtime metadata when present, explicit signal strengths, a negative penalty and diversity. Search relevance and explicit sorts override personalized ordering. Ten invariant tests and three live India personas pass. Candidate pools are bounded and paginated, not a complete catalog ordering. Mood is a genre heuristic. Trending/editorial rails, collaborative filtering, quality benchmarking, login and social publishing are later work.
