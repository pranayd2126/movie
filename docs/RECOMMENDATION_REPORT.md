# NextScene recommendation and verification report

Verified locally on 6 October 2026. This continues the existing application; authentication, private MongoDB profiles, TMDB metadata, event history and recommendation modules were preserved. GitHub and deployment remain deferred.

## 1. Previous architecture

The previous real-data milestone had a replaceable TMDB catalog adapter, anonymous local preferences, a shared content ranker and title/library pages. The interrupted implementation had already added account sessions, MongoDB profiles, temporal taste vectors, multiple retrieval pools, personalized rows and metrics. This verification phase completes and repairs that implementation rather than replacing it.

## 2. Current architecture

Real TMDB metadata → independent candidate pools → one shared scoring/exclusion service → diversity reranking → context-specific rows. Anonymous requests use validated browser state. Authenticated requests derive the user from an opaque session cookie and load that user's MongoDB profile; supplied personalization state is ignored. Home, For You, Discover and related titles share the model. The catalog contract keeps TMDB replaceable.

## 3. Taste representation

The profile has long-term, recent and current-session vectors across genre, original language, keywords, creators, actors, movie/TV type, release decade, runtime band, popularity band and language/genre combinations. Each feature records positive/negative strength and distinct positive/negative evidence counts. Explicit preferences are separate from inferred affinities. Up to 80 evidence titles are hydrated, prioritizing recent signals while retaining older evidence; the selected related-title anchor is reserved first.

## 4. Interaction signals

Favorite 1.0; like 0.8; watchlist 0.25; dislike −1.0. Ratings use ten half-star steps: 0.5–1 star −1; 1.5 stars −0.9; 2 stars −0.65; 2.5 stars −0.15; 3 stars neutral; 3.5 stars 0.4; 4 stars 0.8; 4.5 stars 0.9; 5 stars 1.0. Current explicit state prevents repeated toggling from manufacturing independent votes. Strong negative ratings override conflicting positive state.

Clicks, title opens, trailers and provider clicks are weak recent/session evidence, capped at 0.15 per title and deduplicated by event type/day. Watched is neutral. Impressions and non-clicks do not imply dislike. Selection-change events retain the selected service/language/genre values. Card feedback now includes row and position as well as title, timestamp, surface, model and session.

## 5. Candidate generators

Language/provider discovery; TMDB recommendations and similar-title pools from positive seeds; quality and recent releases; supported creators, actors and keywords; reserved exploration pools. Related requests prepend the selected title's similar/recommendation pools. Retrieval is capped at 18 pools and 60 hydrated candidates (ordinary catalog search: 36). Round-robin collection avoids letting the first pool consume the budget. Provenance is retained across duplicate sources.

## 6. Ranking model

The initial model is a configurable content-based heuristic, not a trained model. Base score combines 0.34 × long-term affinity, 0.18 × recent affinity, 0.08 × session affinity, 0.20 × explicit preferences, 0.16 × closest positive neighbor, 0.22 × Bayesian audience quality, confidence-dependent popularity, 0.04 × freshness, 0.08 × selected subscription availability and 0.45 × optional anchor similarity, minus negative-pattern and repetition penalties. Components are available in the development debugger. Scores are internal ranking utilities, never presented as predicted match percentages.

## 7. Negative feedback

Not Interested suppresses that exact title in discovery without adding genre-wide negative evidence. Disliked and strongly negatively rated titles are excluded and contribute bounded feature penalties. Explicit title search can still locate watched/disliked/dismissed titles so users can revisit their decisions. Search relevance and explicit filters/sorts take precedence over personal ranking.

## 8. Temporal adaptation

Long-term evidence uses a 180-day half-life and a 0.35 floor; recent evidence uses a seven-day half-life. Current-session actions add contextual relevance. A fixed hour bucket stabilizes ranking across immediate refreshes. Unit tests demonstrate that old affinities remain present, recent taste can shift, and the same feedback has additional influence in its originating session. Overall confidence is evidenceCount/(evidenceCount+4), with regularization on individual features.

## 9. Diversity

MMR-style reranking penalizes similarity to already selected titles, repeated franchises and repeated creators. Deterministic title-ID tie breaking keeps unchanged inputs stable. Row composition removes duplicate titles across the page. Tests assert zero cross-row duplicates and deterministic results.

## 10. Exploration

Two retrieval slots are reserved for exploration where both media types apply. Periodic reranking slots can introduce adjacent candidates subject to audience-quality, vote-count and negative-affinity gates. A separate exploration row requires sufficient taste evidence. These are transparent heuristics; they are not yet optimized from user outcomes.

## 11. Availability

India (`IN`) included-with-subscription offers are a hard eligibility condition when Only my services is active. With that filter off, matching subscriptions receive a bounded bonus. Rental, purchase, free/ad-supported and channel/add-on offers remain separate. Failed availability hydration yields unknown/error state and no invented offers. JustWatch-through-TMDB listings do not establish plan, season or dubbed-audio entitlement.

## 12. Row generation

Eligible proposals include top picks, positive-seed rows, repeated genres, languages, supported creators/actors, watchlist similarity, lower-popularity discoveries, recent releases on selected services and exploration. Rows need at least three eligible titles and display up to six. Creator rows require two distinct positive titles; actor rows require three. Negative evidence cannot satisfy those positive thresholds.

## 13. Row ranking

Rows compete using base candidate relevance, bounded supporting evidence, contextual bonuses and observed engagement. Previously shown rows and repeated themes receive bounded penalties; overlapping titles are removed before display. Anchor boosts order titles within a seed row without automatically making that row dominate the entire page.

## 14. Home

Home chooses a real backdrop from eligible ranked candidates and composes personalized rows. It waits for client results instead of presenting a generic server catalog as account personalization. Watched history is not a positive signal; Home may still include familiar titles. The page shell no longer depends on a successful TMDB fetch during server rendering.

## 15. For You

For You uses the same model and excludes watched titles when history-based discovery suppression is enabled. Feedback reranks loaded candidates immediately, then refreshes retrieval. In browser testing, Not Interested removed Love Action Drama immediately while other Malayalam and comedy recommendations remained available.

## 16. Title pages

Related retrieval and scoring explicitly use the selected title as an anchor, combined with the user's profile. The current title is excluded from its own related list. The server no longer blocks the main detail view on a redundant generic related-catalog fetch. Related-fetch failures now have an explicit retry control. Full metadata outages render a usable title retry view instead of throwing a server-render error.

## 17. Anonymous behavior

Anonymous discovery requires no login. Preferences, private library and bounded event history live in versioned localStorage. Account records are never written into anonymous storage. The browser's existing anonymous state is retained across ordinary sign-in/sign-out; importing it into an account requires explicit selection. Shared browser profiles can access anonymous data.

## 18. Authenticated behavior and isolation

Passwords use salted scrypt. Session tokens are random, HttpOnly and SameSite=Lax; only token hashes are stored in MongoDB. HTTPS configuration enables Secure cookies. Profiles are keyed by the session owner's user ID. Writes require matching ownership and a revision; conflicting edits can be rebased. Logout revokes the session and remounts personalized client state.

Live API tests cover A→B→A, persistence of saved/watched/rating/favorite/dislike/dismissal/preferences/events, forged owner rejection, forged recommendation state being ignored, stale revision rejection, revoked session rejection, anonymous write denial and cross-origin rejection. Explicit anonymous import preserves existing account conflicts. A BSON serialization discrepancy was found during these tests: optional event fields could return as null. Profile reads now normalize stored state, event sanitization normalizes absent title IDs, and new MongoDB writes omit undefined fields.

Same-browser verification signed out A, signed in B, and found Premalu in B's Watchlist, Watched and Rated tabs with zero Interstellar links. A's library contained Interstellar. B retained Netflix/JioHotstar selections and its own language preferences. Test sessions were signed out after verification.

## 19. Caching, invalidation and failure handling

Only public metadata is cached globally: request deduplication, six concurrent upstream slots, at most 1,200 cache entries, endpoint TTLs, and genuine retrieval timestamps. Personalized responses are private/no-store and vary by Cookie. State revisions refresh recommendations; account identity changes remount client caches. Derived taste is invalidated on profile writes.

The original unhandled rejection arose when an upstream request failed while the adapter was still awaiting another pool's genre prerequisite. Pool promises now acquire settlement handlers immediately, including prerequisite work. Failed pools do not discard successful pools. Failed hydration retains legitimate list metadata where possible, marks availability unknown/error and supplies a warning. Total failure returns a handled API error.

Real transport checks also observed ECONNRESET. One retry handles transient network resets; both attempts and queue wait share a 12-second request deadline. Failed promises are evicted. Invalid JSON and rate limiting have sanitized typed errors. Refresh errors retain prior candidates with an explicit stale-results notice; a different failed search does not display unrelated prior search results. No fictional fallback or secret-bearing vendor errors are exposed.

## 20. Debugger

`/debug/recommendations` is development-only. Browser verification confirmed model version, profile evidence, candidate provenance, raw/final rank, score components, exclusion reasons, row scores/evidence and exposure diagnostics. A production build renders the not-found view; requesting debug data does not expose debug payloads in production. Live precision/recall/NDCG remain null without relevance labels, rather than showing fabricated accuracy figures.

## 21. Evaluation and evidence

All 21 automated tests pass, including the original privacy/ranking invariants and new outage, temporal, event, anchor and positive-people-evidence checks. Typecheck and production build pass. Real-data integration exercises three India preference combinations, movie/TV lookup, provider IDs, search, no results and invalid references. Separate account tests use real MongoDB sessions and profiles.

Signal sensitivity for an unchanged synthetic candidate: cold score 0.228; watchlist 0.312; like 0.474; five-star rating 0.526; repeated negative-pattern evidence −0.058. Undo restores the prior signal. These are controlled test fixtures, never application catalog data.

Four deterministic personas produce four different top-five ID sequences. At K=10, three fixtures score Precision 0.9 and NDCG 0.927; the fourth scores 1.0/1.0. Duplicate rate is zero for all four; selected-provider availability is 1.0. Intra-list diversity ranges from approximately 0.105 to 0.260. These synthetic relevance labels verify mechanics, not real-world recommendation quality.

Real API example captured during verification:

| Persona | Leading For You results | Distinctive rows |
|---|---|---|
| A: Telugu/English, Prime, science fiction; Interstellar/Inception/RRR feedback | Inception, Project Hail Mary, Kalki 2898-AD, Spider-Man: Into the Spider-Verse, Off Campus | More from Christopher Nolan; Because you liked RRR |
| B: Malayalam/Tamil, Netflix/JioHotstar, comedy; Premalu/Bangalore Days feedback | Love Action Drama, Youth, Vishwanath & Sons, All We Imagine as Light, Love Is in the Air | More to discover in Malayalam; Because you rated 5★ Premalu |

Ordering can vary with actual upstream availability, metadata and new exposure events. Browser screenshots: [A](verification/persona-a.jpg), [B](verification/persona-b.jpg), [controlled outage](verification/tmdb-outage.jpg).

In a separate production-mode test process, a test-only Node preload rejected TMDB network calls. Home displayed a retry state while library/navigation remained usable. Title details displayed a retry view and recovered Interstellar after connectivity returned. No unhandled server rejection appeared in the outage-process logs. Fresh browser checks showed no hydration errors or smooth-scroll warning; development hot-reload notices during source edits were expected.

## 22. Current limitations and concerns

The model is hand-weighted and candidate-limited. It does not learn collaborative preferences yet, and recommendation quality has not been validated with real-user outcomes. Keywords/provider coverage can be sparse; cast/creator evidence is weaker for some TV records. Search and sorting cover loaded candidates, not all TMDB records. Memory caches are per process, not a distributed cache. A cold recommendation can require multiple retrieval stages and take several seconds; bounded request timeouts do not constitute a single overall API latency guarantee.

Email verification, password recovery and social publishing are not implemented. Basic auth throttling is appropriate for this local preview but needs deployment-specific abuse controls. Previously disclosed credentials should be rotated before deployment. Secrets remain server-only in ignored env files. TMDB free access is subject to its non-commercial terms; production/commercial use requires the appropriate licensing decision. No paid API or deployment was added.

## 23. What requires real-user data

Calibrating signal weights, measuring recommendation satisfaction, debiasing exposure, distinguishing curiosity from enjoyment, estimating serendipity, tuning row engagement and evaluating long-term retention require consented real interaction data and labeled outcomes. CTR only attributes clicks to observed impressions; unobserved items are not assumed rejected. Offline coverage/novelty/diversity are diagnostics rather than proof of user value.

## 24. Future path, after user testing

First establish consented event-quality and temporal holdout datasets with leakage checks. Compare this baseline against a popularity/availability baseline using Precision/Recall/NDCG and coverage/diversity by language and service. Add metadata embeddings behind the candidate contract, then collaborative retrieval when interaction density supports it. Train a ranking model on time-split, exposure-aware data; calibrate and explain scores, evaluate cold-start and minority-language slices, and retain hard privacy/availability/exclusion constraints. Introduce versioned online experiments only after offline gains and operational safeguards. No new major product phase has begun.

## Files changed in this verification pass

TMDB: `src/adapters/tmdb/client.ts`, `catalog.ts`. UI: `src/components/catalog.tsx`, `detail.tsx`, `retry-title.tsx`, `local-provider.tsx`, `account.tsx`; Home/Discover/For You and title route pages; credits. Model/state: `src/modules/library/state.ts`, `events.ts`, `src/modules/recommendations/rows.ts`, `metrics.ts`, `src/server/recommendations.ts`. Persistence normalization: `src/server/auth.ts`, `db.ts`. Verification: `tests/dynamic.test.ts`, `tests/tmdb.test.ts`, `scripts/verify-accounts.mts`, `verify-live.mts`, `test-tmdb-outage.mjs`, `package.json`; README and this report. The existing layout smooth-scroll attribute and port-5000 scripts were retained and checked.

## Run

```bash
cd /Users/pranayreddy/Desktop/movie
npm run dev
```

Open http://localhost:5000. For production-mode local testing, stop the dev server, then run `npm run build && npm start`. Both normal scripts bind localhost:5000. Do not disable macOS services that may also use wildcard port 5000.
