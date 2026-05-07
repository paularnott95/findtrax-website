# Shopify Homepage Cache Blocker

Timestamp: 2026-05-07T10:11:31Z

## Summary

The live theme source has been updated to load `country-mode-v20260506-final.js`, and the new asset serves the runtime marker:

```js
window.MA_COUNTRY_MODE_ASSET_VERSION = "v20260506-final"
```

However, the normal storefront homepage at `https://missingalerts.com/` still returns cached homepage HTML that references the old versioned asset:

```text
//missingalerts.com/cdn/shop/t/19/assets/country-mode.js?v=145899350803046321911778133989
```

The storefront page cache for the homepage/index route has not rebuilt after Shopify CLI theme pushes, publishes, a fresh unpublished theme upload, publishing that fresh theme, and a final targeted layout/index CLI touch.

## Theme IDs

Current live theme ID:

```text
196375314592
```

Previous live theme ID:

```text
196361224352
```

Previously stale referenced theme ID:

```text
196357619872
```

Latest raw homepage body observed after publishing `196375314592`:

```text
Shopify.theme.id = 196361224352
```

Latest raw homepage server timing observed:

```text
theme;desc="196375314592", pageType;desc="index"
```

This proves Shopify is using the new live theme for routing, but the rendered homepage body is still an older cached index render.

## Asset Evidence

Old asset still emitted by raw homepage:

```text
/cdn/shop/t/19/assets/country-mode.js?v=145899350803046321911778133989
```

New asset present in live theme source:

```text
assets/country-mode-v20260506-final.js
```

New intended storefront asset:

```text
/cdn/shop/t/19/assets/country-mode-v20260506-final.js
```

Live theme source intentionally renders:

```liquid
{{ 'country-mode-v20260506-final.js' | asset_url | script_tag }}
```

The rebuilt sections can render directly through Shopify's section endpoint:

```text
GET https://missingalerts.com/?section_id=spotlight-system
```

That endpoint returns `ma-premium-spotlight` and `SPOTLIGHT CASES`, while the normal homepage still returns the old `Country spotlight` block.

## Raw Homepage Response Evidence

Request:

```text
GET https://missingalerts.com/?country=GB&ma_verify=20260507touch2
```

Response:

```text
HTTP/2 200
date: Thu, 07 May 2026 10:11:31 GMT
etag: W/"page_cache:103695024288:IndexController:76dbc0523362a1bbe7831735ca5ce79e"
powered-by: Shopify
server-timing: processing;dur=68;desc="gc:2", db;dur=33, asn;desc="18403", edge;desc="HKG", country;desc="VN", theme;desc="196375314592", pageType;desc="index", servedBy;desc="64j4", requestID;desc="15099288-8e22-4a98-a510-89caed58c798-1778148691"
cf-cache-status: DYNAMIC
x-request-id: 15099288-8e22-4a98-a510-89caed58c798-1778148691
```

Raw body still contains:

```html
<script src="//missingalerts.com/cdn/shop/t/19/assets/country-mode.js?v=145899350803046321911778133989" defer="defer"></script>
```

Raw body does not contain:

```text
country-mode-v20260506-final.js
ma-premium-spotlight
```

Raw body still contains:

```text
Country spotlight
Shopify.theme = {"name":"Missing Alerts Country Filter Live 2026-05-06","id":196361224352,...}
```

## Admin Asset API Attempt

The Shopify OAuth client credentials flow succeeds and returns an Admin API token.

Theme Asset API reads/updates are blocked by Shopify merchant approval/scope. Every attempted asset request for both theme IDs returned:

```text
HTTP 403
[API] This action requires merchant approval for read_themes scope.
```

Because the app does not have approved `read_themes` access, the Theme Asset API cannot be used from this environment to perform the requested code-editor-equivalent asset touch. Asset writes would also require the appropriate theme write scope.

## Files Attempted For API Touch

Themes attempted:

```text
196361224352
196357619872
```

Assets attempted:

```text
layout/theme.liquid
templates/index.json
snippets/restored-homepage.liquid
snippets/restored-homepage-grid-compact.liquid
snippets/homepage-grid-compact-runtime.liquid
snippets/homepage-inline-country-filter-final.liquid
sections/header.liquid
sections/featured-collection.liquid
assets/country-mode.js
assets/country-mode-v20260506-final.js
```

Intended Liquid touch comment:

```liquid
{%- comment -%} Shopify Admin API cache touch 2026-05-07 final {%- endcomment -%}
```

Intended JavaScript touch comment:

```js
/* Shopify Admin API cache touch 2026-05-07 final */
```

No Admin Asset API changes were applied because Shopify rejected the asset requests before reading or writing.

## Fresh Theme Attempt

A fresh unpublished theme was created from the corrected local theme source and then published:

```text
Missing Alerts Spotlight Boosted Live 2026-05-07
Theme ID: 196375314592
```

The new theme source contains:

```text
templates/index.json -> spotlight-system, boosted-appeals-final
snippets/restored-homepage-grid-compact.liquid -> no ma-spotlight-bar render
layout/theme.liquid -> country-mode-v20260506-final.js
sections/spotlight-system.liquid -> ma-premium-spotlight
sections/boosted-appeals-final.liquid -> ma-boosted-appeals
```

After publishing the fresh theme, raw `https://missingalerts.com/` still rendered the old cached body and old asset URL. A final CLI touch pushed `layout/theme.liquid` and `templates/index.json` to `196375314592`, then republished it. The raw homepage still remained stale.

## Conclusion

Shopify storefront page cache for the homepage/index route did not invalidate after CLI theme push/publish, fresh theme upload/publish, or targeted CLI touches. The code source is updated, and section rendering proves the rebuilt Spotlight section is available, but raw `https://missingalerts.com/` continues to serve cached homepage HTML with the old country-mode asset URL and old Country Spotlight body. The Admin Asset API cache-touch workaround cannot be completed from this environment until the Shopify app has merchant-approved theme access, at minimum `read_themes` and likely write theme asset access.

## Shopify Support Message

Please send this to Shopify Support:

```text
Our live theme is 196375314592. We updated layout/theme.liquid, templates/index.json, Spotlight/Boosted sections, snippets, and assets via Shopify CLI. We also created and published a fresh theme from the corrected source, then performed a targeted CLI touch of layout/theme.liquid and templates/index.json. Raw https://missingalerts.com/ still serves a cached homepage body embedding Shopify.theme.id=196361224352, the old Country Spotlight block, and /cdn/shop/t/19/assets/country-mode.js?v=145899350803046321911778133989. The response has etag W/"page_cache:103695024288:IndexController:76dbc0523362a1bbe7831735ca5ce79e" and server-timing theme;desc="196375314592", pageType;desc="index". Shopify's section endpoint for ?section_id=spotlight-system returns the corrected ma-premium-spotlight section, proving the new theme source is present. Please rebuild/invalidate the storefront page_cache for the homepage/index route.
```
