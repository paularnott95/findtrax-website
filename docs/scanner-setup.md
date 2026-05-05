# Missing Alerts scanner setup

The scanner pipeline is source-driven and publishes to the live Shopify case blog when credentials are configured.

## Commands

- `npm run scanner:health` checks source configuration, credential presence, Shopify target readiness, and schedule wiring.
- `npm run scanner:dry-run` runs configured sources and writes local reports without Shopify publishing.
- `npm run scanner:run` runs configured sources and writes import/review/skipped reports.
- `npm run scanner:publish` publishes `data/scanned-cases-published.json` to Shopify if credentials exist.
- `npm run scanner:run-and-publish` runs the full scheduled pipeline.
- `npm run scanner:import-url -- --url "https://official-source.example/case" --country GB --publish` imports one verified official URL.

## Required secrets

Do not commit secret values. Configure these in GitHub Actions or the production runtime:

- `SHOPIFY_STORE_DOMAIN`
- `SHOPIFY_ADMIN_ACCESS_TOKEN`
- `SHOPIFY_API_VERSION`
- `SHOPIFY_CASE_BLOG_HANDLE` or `SHOPIFY_CASE_BLOG_ID`
- `SCANNER_ADMIN_SECRET` for protected API-triggered runs
- `GEOCODING_API_KEY` only when geocoding is enabled

## Live publishing model

The live Shopify site reads case data from Shopify blog articles. Active missing-person listings use the `missing-persons` blog. Found-safe updates use the `found-safe` blog. The scanner publisher creates safe public article payloads for the configured missing-person blog.

## Source configuration

Sources live in `data/scanner-sources.json`. A source must remain disabled until the URL/feed/API is confirmed as official or trusted, legally accessible, and parseable without private/social-only data.

Disable a source by setting `"enabled": false`. The healthcheck and scanner report will explain disabled sources.

## Review and safety

The scanner publishes only `active`, `urgent`, and `long-term` records. Anything found, located, safe, closed, ambiguous, missing required source attribution, or lacking required public fields goes to review/skipped reports and is not published active.

All public records are mapped through `toPublicScannerCase`, which strips private fields and keeps source attribution.
