# Privacy contract

The product owner's privacy instruction overrides any earlier assumption about displaying recently watched titles on public profiles. This is a required product and authorization contract, not just a UI preference. It is designed here; implementation and tests are still required.

## Defaults

| Data/action | Default audience | Public/social behavior |
| --- | --- | --- |
| Profile handle, display name, optional bio/avatar | Public profile, disclosed at signup | Only supplied profile fields are shown; never email, private preferences or history-derived statistics. |
| Watched title, watch date, rewatches | Only me | No post, notification, public count, taste badge or profile history entry. |
| Watchlist | Only me | Owner may deliberately publish a list; adding a title alone does not post to a feed. |
| Rating, favorite, like/dislike, not interested | Only me | Rating/favorite can be published with explicit audience choice. Negative signals stay private. |
| Explicit recommendation | Draft, Only me until audience chosen | Publishing requires a visible Public or Followers audience and a deliberate Publish action. |
| Subscription choices, languages, recommendation reasons | Only me / local for visitors | No inferred public taste profile or “friends watched” signal. |
| Anonymous browsing selections | This browser | No account, third-party OTT connection or public activity. Clear-local-data control is available. |

Public profiles remain useful through deliberately published recommendations, ratings, favorites and lists. Saving something to improve recommendations does not mean consenting to publication. Public profile visibility and search-engine indexing are separate settings; profile indexing is off by default.

## Watched UX

The primary action is “Mark watched · Only me.” After saving: “Saved to your private history.” A separate “Share this title” opens a composer with audience and preview. It must not automatically preselect a public audience just because the profile is public.

History settings provide “Only me / Followers / Public” for **future history entries**, starting at Only me. Changing to a broader audience opens a clear scope preview; it never republishes older private records. Existing records may be shared one by one, or through a separate bulk action that lists the affected titles and count. Changing a future default does not itself emit feed posts.

History collection visibility and feed publication are separate. A user can intentionally make new history entries visible on their profile without broadcasting every entry. Automatic watched feed posting is absent from V1. The per-title composer is the explicit feed-sharing path.

A prominent “Make all watch history private” action narrows all watched-entry audiences and withdraws posts whose explicit source is a watched share. Independently authored recommendations remain separate; the UI explains that and links to manage them. The user can withdraw each shared item. Deleting a watched entry withdraws its linked watched posts by default. It does not delete an independently created rating or recommendation.

## Enforcement model

Private activity and social publications live in separate tables. `watch_entries` has an owner, default-private audience and optional explicit-sharing receipt. The ordinary mark-watched endpoint never creates social content. Clients cannot set arbitrary owner IDs or expand audience through mass assignment.

For a non-owner to read a shared object, all these conditions must hold:

1. Its audience was explicitly chosen and it is currently published, not withdrawn.
2. The owner's current profile/access setting allows the viewer.
3. Public audience allows that viewer, or Followers audience has a current accepted follow edge.
4. Neither side has blocked the other.
5. Any source object required by the publication still exists and remains shareable.

Owners can read their own private objects. Internal jobs have narrowly scoped privileges and are not user-facing read APIs. Email/account fields stay in a separate private schema. Authenticated request paths use user-scoped database clients; service keys cannot substitute for authorization.

Apply explicit grants and Postgres row-level policies to every operation, including inserts and ownership-changing updates. Keep private schemas unexposed. Use invoker-security views where exposed and audit functions that elevate privileges. Supabase documents that grants and RLS both matter, and that privileged keys/views can bypass protection. [Supabase RLS documentation](https://supabase.com/docs/guides/database/postgres/row-level-security).

Public read models select permitted fields explicitly. They must not join private history for counts, badges, recent activity, social proof or recommendation explanations. Publishing a rating must not include a private watch date. “Three people you follow recommended this” requires three currently visible, deliberate recommendations; “three friends watched” must never be inferred from private history.

Privacy narrowing, blocking, unfollowing or deletion takes effect at read time even while background cleanup is pending. Avoid shared caching of personal and social responses in V1; return `private, no-store`. Invalidate any later cached public projection on audience changes and recheck authorization before returning it. Queued notifications recheck visibility at send time. Do not send watched-history push/email notifications in V1. Public content copied by another person cannot be retroactively erased; make that clear in the share preview.

## Personalization versus publication

Explain during onboarding that private in-app actions can improve the owner's recommendations. Provide an independent switch to stop using private history for personalization and a reset/delete-history action. Disabling history personalization retains the private diary but removes its model features and invalidates cached rankings. Clearing history removes entries and their derived features.

No user-level private history is exported to advertising, public social proof, third-party analytics or other people's recommendation explanations. Initial cross-user training is off; later opt-in aggregate model training requires a separate purpose notice, access controls, minimum cohort thresholds and deletion/retraining policy. Private feature vectors remain private even if they are not raw title lists.

## Retention and rights

Proposed product retention: saved history until the owner deletes it or the account; diagnostic events 30 days; identifiable recommendation impressions 30 days; minimum necessary security logs 90 days; backups 30 days with documented expiry and restore-time deletion replay. Validate the actual hosting configuration before promising these timings. Never log tokens, raw auth headers, private recommendation reasons or full viewing histories.

Provide export, per-title delete, clear-history, withdraw-sharing, deactivate and account-delete flows. Account deletion immediately denies access, removes public projections, and queues scoped deletion of owned rows, analytics identifiers and model features. Jobs are idempotent with completion tracking. Backups have restricted access, expire on schedule, and cannot resurrect deleted records during restoration.

Before public launch, review notices, consent, withdrawal, processors, breach response and age/minor handling against applicable Indian requirements. MeitY publishes the DPDP Rules 2025 and an enforcement timeline; applicability and commencement need a launch-specific review. This document does not certify legal compliance. [Official rules and timeline](https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa?pageTitle=Digit).

## Required acceptance tests

- An anonymous visitor, unrelated user, follower and blocked user cannot retrieve another user's default-private watched entries by API, SQL-accessible endpoint, guessed ID, profile, feed, search, count, HTML or OpenGraph metadata.
- Mark watched creates no social publication, notification or public-statistic change; a provider click never marks watched.
- A deliberately public rating reveals its rating only, without implying a watch date or reading a private history entry.
- Sharing one watched entry changes only that entry and the deliberately created publication. Public profile status cannot authorize the rest.
- Changing future visibility leaves past records private. “Make all private” removes watched shares from all later reads.
- Ownership spoofing, bulk field updates and elevated-function calls cannot broaden unauthorized access.
- Followers-only posts disappear on unfollow/block. Visibility narrowing during feed generation or notification delivery wins over stale cached state.
- Account deletion removes social projections and derived recommendation features; restoring a backup replays deletion records.
- Staging fixtures remain isolated from real users; no production request exposes fixture people or activity as real.
