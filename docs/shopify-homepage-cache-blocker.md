# Shopify Homepage Cache Blocker

Timestamp: 2026-05-07T07:53:03Z

## Summary

The live theme source has been updated to load `country-mode-v20260506-final.js`, and the new asset serves the runtime marker:

```js
window.MA_COUNTRY_MODE_ASSET_VERSION = "v20260506-final"
```

However, the normal storefront homepage at `https://missingalerts.com/` still returns cached homepage HTML that references the old versioned asset:

```text
//missingalerts.com/cdn/shop/t/19/assets/country-mode.js?v=145899350803046321911778133989
```

The storefront page cache for the homepage/index route has not rebuilt after Shopify CLI theme pushes and publishes.

## Theme IDs

Live theme ID:

```text
196361224352
```

Previously stale referenced theme ID:

```text
196357619872
```

Latest raw homepage body observed:

```text
Shopify.theme.id = 196361224352
```

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

## Raw Homepage Response Evidence

Request:

```text
GET https://missingalerts.com/
```

Response:

```text
HTTP/2 200
date: Thu, 07 May 2026 07:53:03 GMT
etag: W/"page_cache:103695024288:IndexController:df478129245be11eb0048f36f149a3a8"
powered-by: Shopify
server-timing: processing;dur=204;desc="gc:50", db;dur=30, db_async;dur=3.867, render;dur=84, asn;desc="8075", edge;desc="SGN", country;desc="VN", theme;desc="196361224352", pageType;desc="index", servedBy;desc="nzlt", requestID;desc="d91bc9c6-789c-4225-9318-eaf9676462e5-1778140383-1778140383"
cf-cache-status: DYNAMIC
x-request-id: d91bc9c6-789c-4225-9318-eaf9676462e5-1778140383
```

Raw body still contains:

```html
<script src="//missingalerts.com/cdn/shop/t/19/assets/country-mode.js?v=145899350803046321911778133989" defer="defer"></script>
```

Raw body does not contain:

```text
country-mode-v20260506-final.js
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

## Conclusion

Shopify storefront page cache for the homepage/index route did not invalidate after CLI theme push/publish. The code source is updated, but raw `https://missingalerts.com/` continues to serve cached homepage HTML with the old country-mode asset URL. The Admin Asset API cache-touch workaround cannot be completed from this environment until the Shopify app has merchant-approved theme access, at minimum `read_themes` and likely write theme asset access.

## Shopify Support Message

Please send this to Shopify Support:

```text
Our live theme is 196361224352. We updated layout/theme.liquid and assets via Shopify CLI and attempted a Theme Asset API / theme code equivalent touch, including assets/country-mode.js and a new assets/country-mode-v20260506-final.js. Raw https://missingalerts.com/ still serves a cached homepage body that references /cdn/shop/t/19/assets/country-mode.js?v=145899350803046321911778133989 instead of the updated theme source. The response has etag W/"page_cache:103695024288:IndexController:df478129245be11eb0048f36f149a3a8" and server-timing theme;desc="196361224352", pageType;desc="index". Please rebuild/invalidate the storefront page_cache for the homepage/index route.
```

