# Shopify Cache Escalation Proof

Timestamp: 2026-05-07T10:23:33Z

## Purpose

Shopify Support asked whether the stale homepage content persists with a cache-busting query string and `curl` no-cache headers. This report confirms the stale content is returned server-side by Shopify for the storefront homepage route, not from a browser cache.

Live theme expected by Shopify routing:

```text
196375314592
```

Stale homepage body still embeds:

```text
Shopify.theme = {"name":"Missing Alerts Country Filter Live 2026-05-06","id":196361224352,...}
```

Old asset still emitted:

```text
country-mode.js?v=145899350803046321911778133989
```

## Commands Run

Normal homepage:

```sh
curl -sSL -D /tmp/ma-home-headers-normal.txt https://missingalerts.com/ -o /tmp/ma-home-normal.html
```

Homepage with cache-busting query:

```sh
curl -sSL -D /tmp/ma-home-headers-nocache-query.txt "https://missingalerts.com/?nocache=1&ts=$(date +%s)" -o /tmp/ma-home-nocache-query.html
```

Homepage with no-cache headers:

```sh
curl -sSL -D /tmp/ma-home-headers-no-cache.txt \
  -H "Cache-Control: no-cache" \
  -H "Pragma: no-cache" \
  "https://missingalerts.com/" \
  -o /tmp/ma-home-no-cache.html
```

Homepage with no-cache headers and fresh user agent:

```sh
curl -sSL -D /tmp/ma-home-headers-fresh.txt \
  -H "Cache-Control: no-cache" \
  -H "Pragma: no-cache" \
  -H "User-Agent: MissingAlertsCacheTest/20260507" \
  "https://missingalerts.com/?fresh-test=$(date +%s)" \
  -o /tmp/ma-home-fresh.html
```

Section endpoint control checks:

```sh
curl -sSL -D /tmp/ma-section-spotlight-headers.txt "https://missingalerts.com/?section_id=spotlight-system&support-proof=$(date +%s)" -o /tmp/ma-section-spotlight-proof.html
curl -sSL -D /tmp/ma-section-boosted-headers.txt "https://missingalerts.com/?section_id=boosted-appeals-final&support-proof=$(date +%s)" -o /tmp/ma-section-boosted-proof.html
```

## Result Matrix

| Request | Bytes | Old asset present | Country Spotlight present | Example product title present | New asset present | New Spotlight marker | New Boosted marker | Body Shopify theme |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Normal `/` | 798887 | 1 | 1 | 4 | 0 | 0 | 4 | `196361224352` |
| `?nocache=1&ts=...` | 798887 | 1 | 1 | 4 | 0 | 0 | 4 | `196361224352` |
| `Cache-Control: no-cache` | 798887 | 1 | 1 | 4 | 0 | 0 | 4 | `196361224352` |
| Fresh UA + query | 798887 | 1 | 1 | 4 | 0 | 0 | 4 | `196361224352` |

The response body is byte-identical in size for all four homepage requests and continues to emit the old country-mode asset and old homepage content.

## Header Evidence

### Normal Homepage

```text
HTTP/2 103
HTTP/2 200
etag: W/"page_cache:103695024288:IndexController:76dbc0523362a1bbe7831735ca5ce79e"
powered-by: Shopify
server-timing: processing;dur=38, db;dur=16, asn;desc="18403", edge;desc="HKG", country;desc="VN", theme;desc="196375314592", pageType;desc="index", servedBy;desc="szzb", requestID;desc="421ee856-48ab-4372-9f76-be5d39f62323-1778149413", _y;desc="377f80f3-0027-42c4-9ff0-84c3bda6fc6b", _s;desc="00709e44-e9e9-4133-8e76-4412351015b6", _cmp;desc="3.AMPS_VNHN_f_f_9QG*dzp5SROwAf-dqCUAwg", compressionLevel;desc="5"
x-request-id: 421ee856-48ab-4372-9f76-be5d39f62323-1778149413
cf-cache-status: DYNAMIC
server: cloudflare
server-timing: cfRequestDuration;dur=126.000166, earlyhints
```

### Cache-Busting Query

```text
HTTP/2 103
HTTP/2 200
etag: W/"page_cache:103695024288:IndexController:76dbc0523362a1bbe7831735ca5ce79e"
powered-by: Shopify
server-timing: processing;dur=31;desc="gc:1", db;dur=10, asn;desc="18403", edge;desc="HKG", country;desc="VN", theme;desc="196375314592", pageType;desc="index", servedBy;desc="c5mk", requestID;desc="e16e037b-4116-40d0-9708-bd41ccd2b45e-1778149413", _y;desc="68a9ed62-eda4-4406-b815-eafa6623c9d5", _s;desc="9dfa62dc-ea2d-4456-b41a-06ed47848546", _cmp;desc="3.AMPS_VNHN_f_f_DdAVISE8R06EJH62WkHkqQ", compressionLevel;desc="5"
x-request-id: e16e037b-4116-40d0-9708-bd41ccd2b45e-1778149413
cf-cache-status: DYNAMIC
server: cloudflare
server-timing: cfRequestDuration;dur=124.000072, earlyhints
```

### No-Cache Headers

```text
HTTP/2 103
HTTP/2 200
etag: W/"page_cache:103695024288:IndexController:76dbc0523362a1bbe7831735ca5ce79e"
powered-by: Shopify
server-timing: processing;dur=31;desc="gc:1", db;dur=9, asn;desc="18403", edge;desc="HKG", country;desc="VN", theme;desc="196375314592", pageType;desc="index", servedBy;desc="blf4", requestID;desc="8b2200eb-f4f7-4fdf-b521-b9deb9cc1bb0-1778149413", _y;desc="dbfe761a-e8b7-44dc-9f73-85036f868153", _s;desc="890ba2b0-d8ed-4c29-885a-dc82d7d48686", _cmp;desc="3.AMPS_VNHN_f_f_pW*S7VK5QdyjSZqp23IgMg", compressionLevel;desc="5"
x-request-id: 8b2200eb-f4f7-4fdf-b521-b9deb9cc1bb0-1778149413
cf-cache-status: DYNAMIC
server: cloudflare
server-timing: cfRequestDuration;dur=108.999968, earlyhints
```

### Fresh User Agent / No Cookies / Query

```text
HTTP/2 200
etag: W/"page_cache:103695024288:IndexController:76dbc0523362a1bbe7831735ca5ce79e"
powered-by: Shopify
server-timing: processing;dur=28;desc="gc:1", db;dur=10, asn;desc="18403", edge;desc="HKG", country;desc="VN", theme;desc="196375314592", pageType;desc="index", servedBy;desc="b59s", requestID;desc="1f436167-6aee-4db8-a002-0a1fbf70d2cf-1778149413", _y;desc="77d0adfb-58cb-4583-bf29-54b1e2cdb4d5", _s;desc="7d73068b-927f-4b76-8d97-9a4dfa606366", _cmp;desc="3.AMPS_VNHN_f_f_EBKDRG*9TAewfp3GRz1hWA", compressionLevel;desc="5"
server-timing: cfRequestDuration;dur=101.000071
x-request-id: 1f436167-6aee-4db8-a002-0a1fbf70d2cf-1778149413
cf-cache-status: DYNAMIC
server: cloudflare
```

## Section Endpoint Control Evidence

The corrected section source is available through Shopify section rendering.

Spotlight section endpoint:

```text
URL: https://missingalerts.com/?section_id=spotlight-system&support-proof=...
Bytes: 101825
ma-premium-spotlight / SPOTLIGHT CASES matches: 412
server-timing theme: 196375314592
```

Boosted section endpoint:

```text
URL: https://missingalerts.com/?section_id=boosted-appeals-final&support-proof=...
Bytes: 91378
ma-boosted-appeals / BOOSTED APPEALS matches: 26
server-timing theme: 196375314592
```

This confirms the updated theme source exists and renders, while the normal homepage route returns an old cached assembled homepage body.

## Conclusion

Stale content persists in all tested cases:

- Normal homepage request.
- Cache-busting query string.
- `Cache-Control: no-cache` and `Pragma: no-cache`.
- Fresh user-agent request with query string and no supplied cookies.

The old asset persists in all four homepage responses:

```text
country-mode.js?v=145899350803046321911778133989
```

All four homepage responses report Shopify routing/server timing for the current live theme:

```text
theme;desc="196375314592", pageType;desc="index"
```

But the body still embeds the old theme object:

```text
Shopify.theme = {"name":"Missing Alerts Country Filter Live 2026-05-06","id":196361224352,...}
```

Therefore this is server-side Shopify storefront `page_cache` stale content for the homepage/index route. It is not browser cache, not local cache, and not fixed by normal no-cache request headers.

## Shopify Support Message

Please paste this to Shopify Support:

```text
We confirmed the stale homepage is server-side, not browser cache.

Live theme routing is now theme 196375314592. Four curl tests all returned the same stale homepage body: normal https://missingalerts.com/, https://missingalerts.com/?nocache=1&ts=..., a request with Cache-Control: no-cache and Pragma: no-cache, and a fresh User-Agent request with no-cache headers plus a query string.

In all four responses:
- status was HTTP 200
- powered-by: Shopify
- cf-cache-status: DYNAMIC
- server-timing included theme;desc="196375314592", pageType;desc="index"
- etag was W/"page_cache:103695024288:IndexController:76dbc0523362a1bbe7831735ca5ce79e"
- the body still embedded Shopify.theme id 196361224352
- the body still referenced /cdn/shop/t/19/assets/country-mode.js?v=145899350803046321911778133989
- the body still contained the old Country Spotlight / placeholder homepage content
- the body did not contain the new country-mode-v20260506-final.js asset or the new ma-premium-spotlight homepage markup

Control check: section endpoints render the updated source under the same live theme. https://missingalerts.com/?section_id=spotlight-system returns ma-premium-spotlight / SPOTLIGHT CASES, and https://missingalerts.com/?section_id=boosted-appeals-final returns ma-boosted-appeals / BOOSTED APPEALS, both with server-timing theme;desc="196375314592".

Please invalidate/rebuild the Shopify storefront page_cache for the homepage/index route for missingalerts.com. The section source is updated, but the assembled homepage route is serving an old cached body server-side.
```
