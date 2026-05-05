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

Local environment inspection found store domain/API version values in older app env files, but no usable `SHOPIFY_ADMIN_ACCESS_TOKEN` value in this repo. `shopify store execute` also failed with missing stored app authentication. Required secrets are documented in `docs/scanner-setup.md`.

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
- No scheduled scanner workflow.
- No publish/report split.
- No healthcheck exposing missing credentials.

## Work needed for full automatic operation

1. Approve and enable trusted source feeds in `data/scanner-sources.json`.
2. Configure Shopify Admin credentials and case blog target.
3. Run `npm run scanner:run-and-publish`.
4. Enable GitHub Actions secrets for the scheduled workflow.
5. Add country-specific parser refinements for each enabled official source.
