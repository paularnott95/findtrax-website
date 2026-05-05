# Scanner investigation

Date: 2026-05-05

## Scanner files found before changes

- `lib/missing-alerts-scanner.mjs`
- `scripts/scan-missing-cases.mjs`
- `api/scanner/run.js`
- `api/scanner/status.js`
- `data/scanner-source-fixtures.json`
- `data/scanner-status.json`
- `data/missing-alerts-public-cases.json`

## Scanner commands found

- `npm run scan`

Before this fix, there were no separate healthcheck, dry-run, publish, run-and-publish, or direct official URL import commands.

## Scanner APIs found

- `api/scanner/status.js` returned the local static `data/scanner-status.json`.
- `api/scanner/run.js` only accepted a protected request and returned a message telling operators to run `npm run scan`; it did not run a scanner or publish to Shopify.

## Data files found

- `data/scanner-source-fixtures.json` contained fixture cases only.
- `data/scanner-status.json` reported zero imported/skipped/errors and a note saying no live trusted scanner source was enabled.
- `data/missing-alerts-public-cases.json` contained source-attributed seed/static cases for the Vercel/static build, not live Shopify blog articles.

## Source adapters found

The previous scanner had no live source registry and no live source adapters. It only had `scanFixtureCases`.

## Current source list before changes

There was no `data/scanner-sources.json` source registry before this fix.

## Current scanner output format before changes

`scripts/scan-missing-cases.mjs` wrote only:

- `lastScanAt`
- `importedCount`
- `skippedCount`
- `errorCount`
- `skipped`
- `errors`
- `notes`
- `publishedPreview`

It did not create review, skipped, publish, or Shopify reports.

## Current scanner publish destination before changes

There was no Shopify publisher. The scanner did not publish anywhere.

## Static/Vercel output vs Shopify

The repo static build reads `data/missing-alerts-public-cases.json`. The live production domain `missingalerts.com` is Shopify, and the live theme reads Shopify blog articles from `blogs['missing-persons']` and `blogs['found-safe']`. Shopify does not read the repo JSON.

## Live Shopify case storage method

The live theme stores/displays cases as Shopify blog articles:

- Active/missing cases: `blogs['missing-persons']`
- Found-safe updates: `blogs['found-safe']`

Case cards and case pages read article tags, article images, and `article.metafields.custom.*` keys including location, country, case status, boost, and map/location fields.

## Homepage case source

The homepage restored snippet and index sections query `blogs['missing-persons'].articles` and `blogs['found-safe'].articles`.

## Country/location page source

Country and location pages use Shopify Liquid templates/snippets and article tags/metafields for country/location context. They do not read `data/missing-alerts-public-cases.json`.

## Case detail page source

Case details are Shopify blog article pages using article templates/snippets and `article.metafields.custom.*`.

## Automation/scheduling before changes

No scanner GitHub Actions workflow existed for production Shopify publishing.

## Missing env vars/secrets

Local environment inspection found no `.env` files in this repo and no Shopify token variables in the current shell environment. Nearby dashboard/boost workspaces contain Shopify variable names including `SHOPIFY_ADMIN_TOKEN`, `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET`, `SHOPIFY_STORE`, `SHOPIFY_STORE_DOMAIN`, and `SHOPIFY_API_VERSION`, but after sourcing the adjacent dashboard env only `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_STORE`, `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET`, and `SHOPIFY_API_VERSION` were present. `SHOPIFY_ADMIN_TOKEN`, `SHOPIFY_ADMIN_ACCESS_TOKEN`, `SHOPIFY_ACCESS_TOKEN`, `SHOPIFY_REFRESH_TOKEN`, and `SHOPIFY_OFFLINE_REFRESH_TOKEN` were not present. Secret values were not printed.

The Shopify theme workspace did not contain `.env` or `shopify.theme.toml` files with scanner publishing credentials.

The GitHub Actions workflow references Shopify secrets, but the workflow is currently on the `fix-worldwide-scanner-publishing` branch only. It is not on `main`, so scheduled automation is not live until the branch is merged to the default branch.

Required secrets are documented in `docs/scanner-setup.md` and `docs/shopify-token-setup.md`.

## Token model found

The project currently has a usable client-credentials model in the adjacent dashboard env:

- `SHOPIFY_CLIENT_ID` and `SHOPIFY_CLIENT_SECRET` are present in the adjacent dashboard env.
- `SHOPIFY_STORE_DOMAIN` is present in the adjacent dashboard env.
- The scanner can request a short-lived Shopify token before publishing when those values are exported.
- No repo code or env files contained `SHOPIFY_REFRESH_TOKEN`, `SHOPIFY_OFFLINE_REFRESH_TOKEN`, `SHOPIFY_ACCESS_TOKEN_EXPIRES_AT`, or refresh-token persistence configuration.
- No OAuth callback, token exchange, or refresh persistence code existed before this fix.

The scanner now supports static Admin API token, OAuth refresh-token, and client-credentials detection. For this project today, client credentials are the confirmed working token path when the adjacent env values are exported or configured as GitHub Actions secrets. A static Admin API token would also work if provided.

## Why import count was 0

`scripts/scan-missing-cases.mjs` was hardcoded to return zero unless `SCANNER_FIXTURE_MODE=1` was set. There was no enabled live source registry.

## Why cases were not appearing on missingalerts.com

The scanner wrote local JSON/status only and had no Shopify publisher. The live Shopify theme reads blog articles, so local Vercel/static JSON cannot affect live Shopify case sections.

## Broken or missing paths

- No worldwide source registry.
- No live fetch/parse adapters.
- No status classifier beyond fixture status.
- No country/location assignment beyond country code.
- No direct official URL importer.
- No Shopify blog publisher.
- No Shopify token manager.
- No scheduled scanner workflow.
- No publish/report split.
- No healthcheck exposing missing credentials.

## Work needed for full automatic operation

1. Approve and enable trusted source feeds in `data/scanner-sources.json`.
2. Configure Shopify Admin credentials and case blog target.
3. Run `npm run scanner:run-and-publish`.
4. Enable GitHub Actions secrets for the scheduled workflow.
5. Add country-specific parser refinements for each enabled official source.

## Live publish verification

Using the adjacent dashboard env values without printing secrets, the direct official URL importer published the Police Scotland Jan Hussain record to the live Shopify `missing-persons` blog as article ID `565980201120` with handle `jan-hussain`. The live URL returned HTTP 200:

- `https://missingalerts.com/blogs/missing-persons/jan-hussain`

This proves Shopify publishing is possible today when token credentials are supplied to the scanner runtime. It does not make scheduled automation live until the workflow is present on the default branch and the required GitHub secrets are configured.

## 2026-05-05 live Shopify route cache finding

The scanner publisher can create and update verified Shopify blog articles, including Jan Hussain. During this pass the original stale Jan Hussain article was moved to `jan-hussain-legacy-20260505164449`, a fresh scanner-published article was created at `jan-hussain`, and a second verified article route was tested at `jan-hussain-live`.

Findings:
- `/blogs/missing-persons/jan-hussain-live` renders the updated live theme and enriched article data: official image, alert bell, no old `LOCATION CONTEXT` box, and the case map/last-seen panel.
- `/blogs/missing-persons/jan-hussain` continues to return an older cached HTML document that references an old `case-notifications.js` asset version and still contains the old `LOCATION CONTEXT` block, even after the article object behind that handle was moved, recreated, republished, and assigned `template_suffix=default`.
- Cloudflare API purge was attempted through the available Cloudflare connector, but the connector returned `Auth required`, so the stale edge/page cache could not be purged from this environment.

Required remaining production action:
- Purge Cloudflare/edge cache for `https://missingalerts.com/blogs/missing-persons/jan-hussain`, `https://missingalerts.com/`, and the stale `case-notifications.js?v=59227700369652924891777541746` asset URL, or provide Cloudflare credentials/API access so the purge can be executed.
