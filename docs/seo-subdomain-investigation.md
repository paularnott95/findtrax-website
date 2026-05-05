# seo.missingalerts.com Investigation

Generated: 2026-05-05T21:46:00.000Z

## Ownership

- Platform: Vercel
- Team: `team_wsY7KR8XaRJjJB3AQvcMGSRs`
- Project: `dashboard-ui`
- Project ID: `prj_UJ7LfgEqrDpZsziHOu6Ff5C1WXMQ`
- Production alias: `seo.missingalerts.com`
- Deployment applied: `dpl_ABAGuKfW13d5DX6Givyv5CPPx6Pd`

## Before Fix

`https://seo.missingalerts.com/` returned a public, indexable page titled `Missing Alerts SEO Hub | Police-first public awareness`. That exposed internal SEO language and created a separate content authority from `missingalerts.com`.

Sample generated routes also returned public pages:

- `/seo/location?loc=united-kingdom/england/london`: `200`, indexable, self-canonical.
- `/seo/location?loc=united-kingdom/scotland/glasgow`: `200`, indexable, self-canonical.
- `/seo/advice?topic=cctv`: `200`, indexable, self-canonical.
- `/seo/help?topic=missing-child&loc=united-kingdom/england/london`: `200`, noindex.
- `/sitemaps/page-sitemap-index.xml`: `200`, public XML.

These routes duplicated or competed with Shopify Country Intelligence, location, and advice systems and were not the right public-facing brand surface.

## Decision

The SEO subdomain is not the public content authority. Public users should see Missing Alerts Country Intelligence and Global Location Checker on the main domain.

## Implemented Result

- `https://seo.missingalerts.com/` now redirects to `https://missingalerts.com/pages/country-intelligence`.
- Generated `/seo/location`, `/seo/advice`, `/seo/help`, and sitemap routes redirect to Country Intelligence.
- `https://seo.missingalerts.com/robots.txt` returns `User-Agent: *` and `Disallow: /`.
- Public `SEO Hub` wording is no longer served from the SEO subdomain.

## Remaining Watch Item

The Vercel project is a dashboard/control-panel project and is not stored as a git repository under the main Shopify repo. The live Vercel fix was deployed from `/Users/paularnott/Desktop/missing-alerts-workspace/dashboard-ui/boost-stacker/dashboard-ui`; the main repo records this investigation and the corresponding Shopify Country Intelligence changes.
