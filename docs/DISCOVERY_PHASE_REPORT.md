# Discovery and onboarding phase — 8 October 2026

This phase extends the existing NextScene application. Authentication, MongoDB ownership, private library, the shared recommendation engine and Taste remain in place. GitHub and comprehensive regression testing remain deferred.

## Product changes

1. **Onboarding:** new accounts receive an optional three-step modal, followed by an optional link to the existing Taste trainer. Completion is persisted per account.
2. **Languages:** Hindi, Telugu, Tamil, Malayalam, Kannada, Bengali, Marathi and English support multiple selections, stored as canonical codes and displayed with friendly names. These are priors, not catalog restrictions.
3. **Genres:** selections use the catalog’s real genre taxonomy, including shared movie/TV genre mappings.
4. **Services:** the existing India provider picker is reused, initially showing eight recognized services plus selected services. More services can be expanded. No OTT credentials are requested.
5. **Skip:** closes onboarding and saves `skipped`; partial selections remain useful and editable.
6. **Existing users:** profiles without the field are `legacy` and are not forced through onboarding. Older open clients cannot overwrite the new profile format; they receive a reload-required conflict.
7. **Cold start:** language, genre and service priors influence retrieval and ranking immediately. Popularity, audience quality, global TMDB weekly trends and controlled diversity supplement them. Prior weight decreases as behavioral confidence grows.
8. **Mood taxonomy:** centralized deterministic genre/keyword rules cover Funny, Feel Good, Romantic, Suspenseful, Mind-bending, Scary, Action-Packed and A little escape. These are inferred moods, not TMDB fields.
9. **Mood integration:** mood applies to the current discovery context and recorded session event. It does not create permanent likes/dislikes or alter long-term taste.
10. **Runtime:** under 90 minutes, under two hours, 105 minutes or less, and two-plus hours. TV uses reported episode runtime. Unknown runtime fails an explicit runtime constraint.
11. **Discover filters:** mood/language/genre chips accompany existing type, search and sort controls. Runtime, provider, rating, year and service constraints live under More filters. Explicit constraints win over personalization.
12. **Row generation:** evidence-gated proposals share the existing candidate pool and ranker. Rows with fewer than three eligible titles are suppressed.
13. **Row ranking:** relevance, evidence, current intent, engagement and exposure determine utility, with overlap and theme penalties. Stable IDs break ties. Home permits five rows, Discover eight, For You ten; rows contain up to eight titles.
14. **Liked anchors:** explicit likes/favorites provide anchor proposals, combining title similarity with overall personalized ranking.
15. **Rated anchors:** ratings of at least 8/10 qualify. Neutral or weak ratings do not create a high-rating row.
16. **Language/genre rows:** generated from selected priors or sufficient positive behavioral evidence; combinations require both preferences or repeated positive combination evidence.
17. **Creators/actors:** creator rows require two positive titles; actor rows require three. Negative evidence does not count toward those thresholds.
18. **Provider rows:** selected-service picks, popular titles available on selected providers, and recent releases currently available. Included India subscriptions remain distinct from rentals, purchases, free, ads and add-ons. Wording does not claim provider viewing statistics or service-added dates.
19. **Hidden Gems:** lower-popularity titles require vote-supported quality, personal fit and limited prior exposure. Tiny-vote averages cannot qualify alone.
20. **Try Something Different:** quality-controlled candidates outside strongest repeated patterns; not random recommendations.
21. **Recent/session rows:** recent explicit feedback and current-visit exploration use the existing temporal taste layers without replacing long-term preferences.
22. **Mood rows:** an active mood produces a high-priority proposal combining inferred mood, taste and hard filters.
23. **Diversity/stability:** selected rows have no duplicate title IDs across the page; redundant genre themes are suppressed. Changes follow feedback, exposure, filters or catalog updates, not random shuffling.
24. **Taste:** Like and Not Interested remain part of the same engine. Not Interested excludes that title without adding genre-wide negative evidence. Existing gestures, Undo, details and trailer links remain intact.
25. **Isolation/privacy:** authenticated recommendations use the session owner’s database profile and ignore supplied client personalization. Identity changes clear transient mood/filter/deck state. Watch history stays private by default; rows do not publish activity.
26. **Performance:** existing request deduplication, metadata TTL cache, six concurrent TMDB requests, 18 retrieval jobs and 60 hydrated candidates per request remain. Client accumulation is capped at 180 discovery candidates (600 for explicit search); images remain lazy and trailers are not fetched per card.
27. **Failure handling:** successful source results survive partial failures; loaded content remains usable during refresh failures. TMDB slot waiting and full response/body processing now have explicit deadlines. Failed promises are evicted; retries release capacity. Development-only slow-stage timings aid diagnosis without logging secrets or account identifiers.
28. **Diagnostics:** development debugger includes proposed/selected rows, evidence, scores, candidate counts, overlap/theme penalties, exclusion reasons, mood/language/genre/provider/recent/session contributions, existing ranking metrics and provenance. Normal API row responses omit diagnostics; debug payloads and page remain gated to development.

## 29. Files changed in this phase

- Onboarding/account state: `src/components/onboarding.tsx`, `src/components/local-provider.tsx`, `src/components/primitives.tsx`, `src/modules/library/state.ts`, `src/modules/auth/merge.ts`, `src/server/auth.ts`, `src/app/api/auth/route.ts`, `src/app/api/profile/route.ts`, `src/app/layout.tsx`.
- Discovery UI: `src/components/catalog.tsx`, `src/components/header.tsx`, `src/app/settings/page.tsx`, `src/app/globals.css`.
- Catalog/context: `src/modules/discovery/moods.ts`, `src/modules/catalog/preferences.ts`, `src/modules/catalog/types.ts`, `src/adapters/tmdb/catalog.ts`, `src/adapters/tmdb/client.ts`, `src/app/api/catalog/route.ts`.
- Recommendations/events: `src/modules/recommendations/config.ts`, `src/modules/recommendations/rank.ts`, `src/modules/recommendations/candidates.ts`, `src/modules/recommendations/rows.ts`, `src/modules/library/events.ts`, `src/server/recommendations.ts`, `src/app/api/recommendations/route.ts`.
- Verification: `tests/discovery.test.ts`, `tests/tmdb.test.ts`, `scripts/verify-discovery.mts`, `scripts/verify-discovery-final.mts`, this report and `docs/verification/discovery-*` artifacts.

The repository still contains earlier uncommitted/untracked work. This list identifies this phase rather than treating all Git status entries as new changes.

## 30. Focused verification

- `npm run typecheck`: passed.
- `npx tsx --conditions=react-server --test tests/discovery.test.ts tests/swipe.test.ts tests/tmdb.test.ts`: **19 passed, 0 failed**. Includes onboarding persistence/migration, prior confidence, mood neutrality, explicit constraints including TV runtime, strong anchors, positive people counts, persona row differences, stable composition, deduplication, source failure/retry and stalled response/queue deadlines.
- Live TMDB + MongoDB demonstration: `docs/verification/discovery-demo.json`. A selected Telugu/Malayalam, Comedy/Thriller and Prime Video/JioHotstar. Real dynamically selected Like, 9/10 rating, swipe Like and Not Interested changed scores and rows. No expected title names were hardcoded. Mood left long-term evidence unchanged.
- A’s subsequent rows included a liked-title anchor, recent interests and controlled exploration. B’s English/Sci-Fi/Netflix profile produced different themes and ordering, with zero inherited positive evidence. The high-rating anchor was proposed; row composition may exclude it after deduplication.
- Final live check: `docs/verification/discovery-final.json`. Completion/skip persist; B’s private library is separate; forged A state is ignored; ordinary responses omit row diagnostics; Taste returns usable candidates. Funny + English + Prime Video + under two hours returned real matching titles, with runtime/provider assertions on every result.
- Browser: completed A’s three-step signup setup and optional Taste dismissal; exercised Discover mood and combined filters; switched A → B in the same browser, verified B’s own English preference and empty watchlist/Likes; skipped B’s pending setup; signed out and back in and confirmed no repeated prompt. The reserved B account was deliberately returned to pending through the API solely to exercise the Skip UI.
- Browser Taste: B liked Arcane, passed Dune: Part Two, and used Undo to restore Dune. A fresh API login verified B’s Like persisted, neither account inherited the other’s Likes, and no genre dislike was created. Events retain timestamps, surface, row and model context (`docs/verification/discovery-browser.json`). B’s Discover reset A’s Funny mood to All moods and displayed its own “Because you liked Arcane” row, plus Netflix rows.
- Strict Telugu/Funny/Prime/under-two-hour combination yielded no matches in the retrieved pool. The UI retained the constraints and offered recovery controls rather than inserting unrelated titles.
- Browser at the available narrow viewport shows scrollable chips, horizontal posters and six-item mobile navigation. Screenshots: `onboarding-genres.jpg`, `discovery-mood.jpg`, `discovery-filters.jpg`.
- Browser console inspection showed a development Fast Refresh full-reload warning. No hydration/unhandled JavaScript exception appeared in that inspection. Server logs exposed slow upstream responses and poster timeouts; metadata timeout handling was hardened and live Taste recovered (60 candidates in about 3.7 seconds).

## 31. Known limitations and concerns

- Moods are transparent heuristics; TMDB keyword/runtime/provider coverage varies. Missing runtime cannot qualify for a constrained result.
- Rows depend on a bounded retrieved pool. Narrow constraints may return no matches despite possible matches elsewhere in the catalog. Sparse pools can produce the same row count on multiple surfaces; Discover has deeper controls and pagination rather than manufacturing weak rows.
- Trending is global TMDB trending filtered against India options, not an India trending statistic. Audience quality is not professional critic consensus. Provider availability is reported data, not a guarantee or added-to-service timestamp.
- Independent slow requests, cold caches and poster CDN failures can still cause delays/placeholders. Request-level deadlines prevent a stalled TMDB body/queue from waiting indefinitely; they are not an overall page latency guarantee.
- Old already-open pre-upgrade tabs must be refreshed before saving. Their old-format writes are rejected to protect new fields.
- Development-only diagnostics have been checked by code gates and live normal/debug responses; a production build was intentionally not run.
- Existing preview limitations remain: no verified email or password recovery. Credentials previously shared in chat should be rotated before any deployment; `.env.local` remains Git-ignored and no secrets are included in the reports.

## 32. Intentionally deferred

Full regression suite, production build/deployment, GitHub push, Surprise Me UI and unrelated features. The shared filters/context/ranker already provide the foundation for a future single-choice request. No new feature phase was started.

Run locally:

```bash
cd /Users/pranayreddy/Desktop/movie
npm run dev
```

The configured address is http://localhost:5000/.
