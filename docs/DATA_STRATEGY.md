# Data and API strategy

Research date: 5 October 2026, India. This document distinguishes vendor documentation from capabilities tested with our own account. No API credentials were available and no authenticated catalog, pricing entitlement, or provider deep-link smoke test was performed. Public documentation is evidence of an interface, not proof of complete India coverage or a commercial license.

## Decision

Owner budget decision: try free options first. No paid API plan or vendor contract should be purchased without a separate explicit decision. Free fixture development can begin immediately; free developer API eligibility must be checked against the actual use. If direct provider links cannot be obtained on permitted free terms, retain the clearly labelled watch-options fallback and report that product limitation.

Start development with original, clearly labelled fixtures. Plan TMDB as the first metadata adapter, subject to the appropriate license. Evaluate licensed availability vendors against an India-specific sample before choosing one. Do not promise all Indian OTT catalogs or reliable direct provider links until that evaluation passes.

Commercial intent matters even before ads are enabled. Obtain written permission for the intended use rather than assuming that a free, pre-revenue startup is non-commercial. Do not scrape streaming sites, IMDb, or undocumented JustWatch consumer endpoints.

## Options and evidence

| Source | What official documentation establishes | Limits and intended decision |
| --- | --- | --- |
| TMDB metadata API | Movie/TV/person data and images are offered through its own API. Non-commercial API use requires attribution; commercial use requires contacting sales. | First metadata candidate. Request commercial terms for this product, including images, storage, SEO and derived recommendation features. [TMDB FAQ](https://developer.themoviedb.org/docs/faq). |
| TMDB watch-provider endpoint | Country-specific subscription/rental/purchase information supplied through JustWatch. JustWatch attribution is required. Full provider deep links are explicitly not returned; a TMDB destination is supplied. | Lower-cost availability fallback if permitted. Use only `IN` results. Label fallback CTA “See watch options”; do not call it “Watch on Netflix.” [Endpoint documentation](https://developer.themoviedb.org/reference/movie-watch-providers). |
| JustWatch Partner API | A content-partner API exists; a partner token follows a concluded contract. | Strong candidate for a commercial agreement. Confirm India services, offer URL rights, quotas, caching, attribution and price in that agreement. This is distinct from using their public website or an unofficial library. [Partner API](https://apis.justwatch.com/docs/api/). |
| Watchmode | Documents metadata, regional availability, web/app links and plan-dependent episode links. Its regions endpoint reports region and plan availability. | Shortlist; authenticate and verify `IN` plus each desired service. Public global provider lists are not evidence that every service is covered in India. [API documentation](https://api.watchmode.com/docs). |
| Movie of the Night Streaming Availability API | Documents country/service catalogs, offer types, audio/subtitle data, and title/season/episode links where returned. | Shortlist; verify `in` from the current countries endpoint and service list under our plan. Coverage and commercial/cache rights remain unverified. [Countries](https://docs.movieofthenight.com/resource/countries), [show data](https://docs.movieofthenight.com/guide/shows), [authentication](https://docs.movieofthenight.com/guide/authentication). |
| IMDb | Free datasets are for personal/non-commercial use; a separate official API has an AWS Data Exchange access path. | Exclude IMDb rating badges from the commercial MVP unless licensed. An IMDb ID or another vendor returning a rating does not establish redistribution rights. [Dataset terms](https://www.imdb.com/interfaces/), [official API access](https://data.imdb.com/documentation/api-documentation/getting-access/). |
| Individual OTT services | No account-authorized history or universal catalog integration has been established for this project. | Treat OTT history, playback and account linking as unavailable. Add a provider-specific partnership only after documented access and permission. Never collect OTT credentials. |

Watchmode's public pricing page currently lists a non-commercial free tier with 2,500 monthly credits and a commercial Startup tier at US$349/month with 40,000 credits. This is a dated planning observation, not a purchased plan or a quote; check current terms, taxes, exchange rates and India entitlements before buying. Its FAQ distinguishes paid caching while subscribed from the free tier's refresh/delete limits and requires deletion on cancellation. [Watchmode pricing and FAQ](https://api.watchmode.com/).

No reliable commercial price was established here for TMDB, JustWatch or Movie of the Night. Do not budget them as free. Evaluate one vendor first; avoid paying for overlapping catalogs until missing coverage justifies it.

## Field-by-field ownership

| Product field | Planned source | Honest behavior when missing |
| --- | --- | --- |
| Movie/series names, synopses, dates, original language, genres, people/credits | Licensed TMDB metadata adapter; replaceable with another licensed catalog | Display available fields; never generate factual credits or certifications. |
| Posters/backdrops/person images | Vendor-authorized image URLs and approved transformations | Original generic placeholders; no scraped posters. Fixture imagery must have recorded reuse rights or be original. |
| Translated names/descriptions | Vendor translations and verified title aliases | Fall back to original title; distinguish UI language, original language and provider-specific dubbing. |
| Trailers | Metadata reference to a legitimate uploader/video host, checked before display | User-initiated allowed embed or external link; no autoplay, downloads or rehosting. Host terms are reviewed during integration. |
| Ratings | Properly named TMDB score, then our own aggregate of deliberately public ratings | Never relabel TMDB scores as IMDb or critics' scores. Show vote count; omit missing scores. |
| Indian availability | Licensed vendor's `IN` offers; possible TMDB fallback | “Availability not verified in India”; not “Unavailable everywhere.” |
| Direct provider links | Licensed offer URL from the chosen vendor/partner | “See watch options” for a valid aggregator destination; no invented provider URL template. |
| Audio, subtitles, HD/4K, plan/tier | Offer-level vendor fields when licensed and present | “Not supplied”; original title language does not prove dubbed audio availability. |
| Moods and subgenres | Small editorial taxonomy mapped to supported metadata/keywords | Label editorial associations; do not imply vendor-certified classifications. |
| Community/friend activity | This application's explicit publishing actions | Empty state until real activity exists; no fabricated users, ratings or follower counts outside labelled fixtures. |

Discovery endpoints expose original-language, runtime, people, genre and watch-provider filters, with watch-region used alongside provider/monetization filters. Adapt movie and TV differences instead of assuming identical parameters. [TMDB movie discovery reference](https://developer.themoviedb.org/reference/discover-movie).

## India coverage acceptance study

Requested provider shortlist: Netflix, Prime Video, JioHotstar, Apple TV+, SonyLIV, ZEE5, Sun NXT, aha and Lionsgate Play. These are user-requested targets, not a claim of verified coverage. Maintain stable internal provider IDs and dated vendor aliases; branding and channel bundles can change. A Prime channel add-on is not included in the base Prime subscription.

After credentials arrive:

1. Retrieve supported regions, India services and the account's entitlements. Save a sanitized dated coverage report, not credentials or unrestricted raw payloads.
2. Check a curated sample of at least 100 movie/series entries across Hindi, Telugu, Tamil, Malayalam, Kannada, Bengali, Marathi and English. Include recent releases, older titles, episodic series, rentals, base subscriptions and add-ons.
3. Compare vendor claims with ordinary manual checks on legitimate provider pages in India; no automated scraping. Record time, region, offer type, URL outcome and uncertainty.
4. Separately measure offer precision, catalog coverage, direct-link success, season accuracy and freshness per provider/language. Proposed launch target: ≥95% sampled offer accuracy and ≥95% sampled direct-link success on supported services. A sample is evidence, not a guarantee; disclose sample size and gaps.
5. Publish the supported-services list using verified coverage. Missing providers remain selectable only with a clear “Coverage not yet verified” state and must not imply watchable recommendations.
6. Choose the vendor based on coverage, rights, total cost and operational reliability. A purchase or contract decision remains with the product owner.

## Replaceable boundaries

Use internal UUIDs; never make a vendor ID the application's primary key. Separate `MetadataSource`, `AvailabilitySource` and `TrailerSource` interfaces. Map vendor responses into canonical models in adapters. Keep pagination/cursors vendor-specific internally. UI code must not branch on vendor payload shapes.

Each adapter declares capabilities: region support, movies/series, catalog search, full export, direct URLs, seasons/episodes, audio/subtitles, change feed and permitted cache policy. `unsupported`, `unknown`, `temporarily_failed` and a verified empty result are distinct outcomes. Persist field provenance so replacing one source does not silently overwrite another's rights or freshness.

Canonical offer fields: internal title/provider IDs; country; subscription/free/ads/rent/buy/add-on; plan/channel; optional season/episode; official web URL; optional permitted app URL; currency/price; audio/subtitle languages; quality; valid dates; source; observed time; fresh-until; link status. Null price means unknown, not free.

Identity matching uses vendor mappings plus media type. Title spelling alone cannot identify remakes, regional versions or movies with the same name. Ambiguous matches go to a review queue.

## Freshness, caching and cost

Starting engineering targets, subject to each contract: refresh popular offers every 6–24 hours, colder offers every 24–72 hours, core metadata weekly and images only under permitted caching rules. Never cache beyond a license's limit. Vendor expiry times override our target TTL. Source-specific deletion is required on rights withdrawal, cancellation or takedown.

If an offer is expired, suppress the direct-watch claim. If stale, show its last-checked time and a labelled verification path while refreshing. A vendor outage cannot become “no services have this title.” Scheduled retries use backoff, bounded concurrency, quota limits and deduplication. Avoid making one vendor call per poster on every request.

Budget formula: catalog initialization + permitted incremental refresh + cache misses + search calls + link revalidation + retry headroom. Track calls and vendor credits independently, because endpoints may cost different credits. Set configurable daily limits, budget alerts and a degraded cached mode; never silently buy quota.

## Commercial launch blockers

Credentials and contract permissions; India coverage and deep-link tests; permitted image use/caching; source attribution; externally supplied score rights; privacy/security validation; production hosting and backups. Fixtures unblock development, not live catalog claims. Recheck terms and documentation at integration and before launch.
