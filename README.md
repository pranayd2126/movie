# India-first movie and series discovery

Status: researched product/technical foundation, 5 October 2026. No application, live API integration, database migration, or public deployment has been implemented yet.

The product helps people choose what to watch across their Indian streaming subscriptions, using explainable recommendations and deliberate social sharing. Browsing does not require an account. Watched history is private by default, even when the user's profile is public.

## Start here

1. [Product and technical blueprint](docs/PRODUCT_BLUEPRINT.md): scope, journeys, stack, recommendation model, design system and delivery plan.
2. [Data and API strategy](docs/DATA_STRATEGY.md): researched options, evidence, restrictions and live-data acceptance gates.
3. [Database design](docs/DATABASE_DESIGN.md): logical schema, constraints, indexes and access boundaries; this is not an executed migration.
4. [Privacy contract](docs/PRIVACY.md): exact visibility behavior and required security tests.

## Local configuration

An ignored `.env` is prepared with empty credential fields and fixture mode selected. `.env.example` documents the same configuration without secrets. Leave credentials blank until their implementation phase; never enter Netflix, Prime, or other OTT passwords. The backend will call data vendors using server-side credentials.

Later implementation must validate configuration at startup: fixture mode works without credentials, live mode fails clearly if required credentials are absent, and production rejects fixture mode. An environment variable must never disable privacy enforcement.

## Version control and GitHub

The owner requested a public GitHub repository under `pranayd2126`. Proposed repository name: `movie-discovery`. Publish only reviewed source and documentation. Ignore `.env`, database exports, private data and raw vendor responses. Git history protects source changes; it is not a database backup or a secret store. Production secrets belong in the deployment secret manager. Database backups require a separate retention and restore process.

The GitHub destination and authorized connection must be established before a remote can be created or pushed. Do not interpret a local Git commit as a successful GitHub backup.

## First implementation slice

Implement anonymous discovery → filter/search → title detail using labelled development fixtures and replaceable adapters. Prove provider preference persistence and meaningful recommendation explanations. Then add authenticated private history and database authorization tests before social publishing. See the blueprint for gates and later slices.
