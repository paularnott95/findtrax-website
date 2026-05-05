# Missing Alerts Website

Missing Alerts is a public missing-person alert website with country case browsing, Found Safe Updates, boost visibility, scanner reporting and product pages for FindTrax, IntelPro and MediaReach.

## Commands

```bash
npm test
npm run build
npm run scan
npm run route-check
```

## Public Routes

- `/`
- `/missing`
- `/found-safe`
- `/cases`
- `/cases/united-kingdom`
- `/cases/ireland`
- `/cases/australia`
- `/cases/new-zealand`
- `/cases/united-states`
- `/cases/canada`
- `/cases/[country]/[slug]`
- `/tools`
- `/tools/findtrax`
- `/tools/intelpro`
- `/tools/mediareach`
- `/private-control-access`
- `/dashboard`
- `/scanner`

## Data Safety

Production case data lives in `data/missing-alerts-public-cases.json`. Public HTML is generated from `toPublicCase`, which allowlists public-safe fields and excludes private notes, private leads, evidence, private contact details, exact private addresses, private documents and speculation.

Found-safe, located and closed cases are shown only in privacy-safe update contexts and use protected visuals by default.

## Scanner

`scripts/scan-missing-cases.mjs` reads configured source fixtures and writes scanner status. It normalises source records, assigns country slugs, skips duplicates, skips found/located/closed cases for active publishing, and records skipped reasons.

Mutation APIs are represented by:

- `api/scanner/run.js`
- `api/scanner/status.js`

`api/scanner/run.js` requires `SCANNER_ADMIN_SECRET`.

## Product Alert Signups

`api/tool-alert-signups.js` validates email and product interest for FindTrax, IntelPro and MediaReach.

Configure:

```bash
TOOL_ALERT_SIGNUP_WEBHOOK_URL=https://your-provider-webhook.example
```

If no webhook is configured, local development signups are written to a temp JSONL file. Connect a real mailing-list provider before using product launch campaigns in production.

## Required Environment Variables

- `TOOL_ALERT_SIGNUP_WEBHOOK_URL`
- `SCANNER_ADMIN_SECRET`
- `CASE_IMPORT_WEBHOOK_URL` if an external import provider is added
