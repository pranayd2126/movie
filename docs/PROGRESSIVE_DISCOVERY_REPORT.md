# Progressive Discover verification

## 1. Architecture
Discover requests server-generated row batches through the existing recommendation API. The server retrieves candidates, ranks proposals and titles, applies diversity, and returns an opaque continuation. React appends the returned rows. Existing authentication, MongoDB persistence, Taste, and private history remain in place.

## 2. Batch strategy
Up to 8 initial rows, then 4 per batch, 6 titles per row. Bounds: 24 rows, 6 batches, 6 retrieval pages, 360 candidates. These are ceilings, not promised counts: sparse filters or weak evidence produce fewer rows.

## 3. Row families
Expanded evidence-backed anchor, genre, language, language/genre, service and people proposals. Added highly rated unseen movies, under-two-hour movies, recent movies, taste-supported eras, another language, outside-genre gems and session genre proposals. No unsupported awards, critics, service-added dates or India-trending claims.

## 4. Ranking
Existing personalized scoring and row competition are reused for every batch. Long-term, recent, session and explicit preference evidence remain inputs. Ranking performance was improved by incrementally caching maximum similarity during diversity reranking; an exact parity test checks the previous ordering, including missing creator metadata.

## 5. Exploration
Eligible exploration proposals receive a depth bonus of 0.05 per batch, capped at 0.20. Quality thresholds and active filters still apply.

## 6. Semantic diversity
Previously displayed proposal IDs are excluded, affinity concepts deduplicate across batches, and repeated themes receive penalties.

## 7. Title diversity
Previously displayed title IDs seed the next batch exclusion set. Browser verification found 92 unique titles among 92 cards after three batches.

## 8. Filters
All batches receive the same explicit filters. Mood, language, genre, provider, runtime, type, sort and preference context changes reset the feed. Live API verification checked Funny + English + Prime Video + under two hours across two batches: 33 titles matched the constraints. Search and explicit non-personalized sorts retain the existing ordered result grid and pagination.

## 9. Stability
Stored rows append without reshuffling their prefix. Returning from Taste preserved all 16 previously loaded rows; the next batch used the new Like and added “Because you liked Devil May Cry.” Account identity scopes client snapshots; server cursors bind owner, session and context.

## 10. Loading
An IntersectionObserver with a 600px bottom margin requests the next batch automatically. Existing rows remain usable with a small “Finding more for you…” status. A manual fallback is available but is not required for normal scrolling.

## 11. End
The feed stops at its bounds or after meaningful proposals are exhausted. It offers Change filters and Explore your taste. It does not fabricate rows to reach a numeric target.

## 12. Failure
A failed continuation retains the displayed prefix and cursor for retry. Concurrent duplicate requests share work; successful replay returns the cached batch. Expired or changed contexts offer a fresh set. Initial upstream failure was observed in the browser with a usable retry state.

## 13. TMDB
Existing caches, bounded concurrency and deadlines remain. Each batch retrieves at most one candidate page, reusing the accumulated pool; an exhausted upstream source is not fetched again. The primary API hostname was unreachable from this machine during verification. A strictly allowlisted TMDB_API_HOST option allows api.tmdb.org; the local environment uses it and live authenticated metadata requests succeeded. No arbitrary credential-bearing proxy or TLS bypass was introduced.

## 14. Performance
Rows/cards and server sessions are bounded. All 92 inspected poster images used lazy loading. Incremental ranking removed a repeated similarity-computation hotspot. No virtualization was added for this bounded DOM.

## 15. Mobile
Verified at 390px width: horizontal poster-row scrolling and vertical page scrolling. Fixed document horizontal movement with mobile overflow clipping; the page stayed at horizontal offset zero after the fix.

## 16. See All
No new See All action: this phase does not expose a separately expanded dataset for each row. Optional Refresh Picks is deferred.

## 17. Events
Existing title/row impressions, clicks and feedback include feed ID, batch, absolute row position and context alongside surface, session, timestamp, title, row type and anchor where applicable. Exposure is not a Like. Event sanitization bounds the additional fields.

## 18. Debugger
Development-only /debug/discover exposes batch/candidate counts and proposal diagnostics, including scores, evidence, overlap, exploration and rejection information. Production does not expose that debugger page.

## 19. Files
- src/components/progressive-discover.tsx (new feed UI)
- src/components/title-card.tsx (extracted shared card and event context)
- src/components/catalog.tsx (Discover integration)
- src/components/local-provider.tsx (event context)
- src/app/globals.css (loading and mobile containment)
- src/app/debug/discover/page.tsx (development debugger)
- src/app/api/recommendations/route.ts (validated feed requests)
- src/modules/recommendations/feed-context.ts (bounds and context)
- src/modules/recommendations/rows.ts (progressive proposals/diversity)
- src/modules/recommendations/rank.ts (equivalent faster diversity ranking)
- src/modules/library/events.ts (bounded event fields)
- src/server/recommendations.ts (reusable candidate retrieval)
- src/server/discovery-feed.ts (owner-bound continuation store)
- src/adapters/tmdb/client.ts and .env.example (allowlisted API host)
- tests/progressive.test.ts and tests/tmdb.test.ts
- scripts/verify-progressive.mts and docs/verification/progressive-* artifacts
- .env.local: local host setting only; remains excluded from Git.

## 20. Focused verification
Typecheck passed. 27 focused tests passed, zero failed:

```sh
npx tsx --conditions=react-server --test tests/progressive.test.ts tests/discovery.test.ts tests/swipe.test.ts tests/tmdb.test.ts
```

Live API: A received 7 → 11 → 15 rows, with 87 unique titles. B received different initial row themes. B could not use A’s cursor (410), and forged client profile data was ignored. Browser: 8 → 12 → 16 → 20 rows loaded automatically, stable prefixes, distinct title IDs, Taste-return stability, new feedback in a later batch, and filter reset. See progressive-live.json and progressive-browser.json for recorded assertions. The Funny feed subsequently reached 24 rows automatically and displayed its bounded end message. Browser error/warning logs were empty for this final check. No full regression suite or production build was run; both remain deferred. No GitHub push.

## 21. Limitations and running locally
The continuation cache is process-local, bounded to 32 feeds with a 30-minute lifetime. Process restarts/eviction expire cursors; multi-instance production needs shared storage or session routing. Network speed affects batch latency; API recovery does not guarantee poster CDN availability. Fewer than 20 rows is valid for narrow contexts or insufficient evidence. This phase’s account checks concern progressive feeds, not a repeat of the entire authentication regression suite.

The app is left running on http://localhost:5000/discover. To run it locally when no instance is active:

```sh
cd /Users/pranayreddy/Desktop/movie
npm run dev
```
