# Spotlight and Boosted Appeals Investigation

Date: 2026-05-07

## Current Theme Source

Live theme inspected: `196361224352`.

Homepage section order in `templates/index.json` currently renders:

1. Hero custom liquid
2. Trust banner custom liquid
3. `ma_country_spotlight_bar`
4. `spotlight-system`
5. `boosted-appeals-final`
6. Other case and support sections

The separate `ma_country_spotlight_bar` custom-liquid section renders `{% render 'ma-spotlight-bar' %}` and is the “Country Spotlight” box that should be removed.

## Existing Spotlight Logic

Main Spotlight source:

```text
sections/spotlight-system.liquid
snippets/spotlight-trigger-button.liquid
```

The section already reads these article metafields:

```text
custom.spotlight_live
custom.spotlight_level
custom.spotlight_slot
custom.spotlight_ends
```

The Spotlight purchase modal already references these product handles:

```text
primary-spotlight-24-hours
primary-spotlight-3-days
primary-spotlight-7-days
supporting-spotlight-24-hours
supporting-spotlight-3-days
supporting-spotlight-7-days
```

The modal submits `/cart/add` with line item properties including:

```text
PlacementType=spotlight
ArticleGID
spotlight_level
spotlight_duration
```

## Existing Boost Logic

Boosted Appeals sources:

```text
sections/boosted-appeals-final.liquid
snippets/boosted-priority-card.liquid
snippets/boosted-sidebar.liquid
sections/BOOSTED-SIDEBAR.liquid
snippets/case-page-right-rail.liquid
```

The theme already reads these boost metafields:

```text
custom.boost_live
custom.boost_active
custom.boost_points
custom.total_boosts
custom.support_count
custom.boost_started
custom.boost_start_date
custom.boost_ends
custom.boost_end_date
custom.priority_score
```

Case pages already reference these boost product handles:

```text
boost-appeal-24-hours
boost-appeal-3-day-visibility
boost-appeal-7-day-visibility
boost-appeal-14-day-visibility
boost-appeal-30-day-visibility
```

The case page boost form submits `/cart/add` with article/case properties. That flow was not edited.

## What Is Broken

- The separate Country Spotlight section appears above the premium Spotlight and should not render.
- Main Spotlight picks fixed fallback cases at Liquid render time, so the selected-country view can show mixed countries.
- Fallback selection is not country-specific enough and is biased toward first/newest cases.
- Boosted Appeals renders a fixed paid/fallback list before country filtering, so selected-country states can appear empty or weak.
- Boosted sidebar can show large empty states or unrelated fallback items.
- The homepage needs a selected-country runtime that chooses paid placements first, then random country-specific fallback cards.

## Rebuild Plan

- Remove `ma_country_spotlight_bar` from `templates/index.json` order.
- Keep product handles and metafield compatibility.
- Rebuild `sections/spotlight-system.liquid` as a premium country-aware pool:
  - paid spotlight first
  - otherwise exactly three selected-country fallback cases when available
  - random stable per page load/day
  - no found/resolved/closed/private/review cases
- Rebuild `sections/boosted-appeals-final.liquid`:
  - max four visible bar cards
  - max four sidebar cards
  - paid boosts first
  - otherwise random selected-country fallback
  - no unrelated country leakage
- Preserve `snippets/boosted-priority-card.liquid` compatibility for existing case/sidebar rendering.

## 2026-05-07 Live Cache Result

Theme changes were pushed and published to live theme `196361224352`, but raw `https://missingalerts.com/?country=GB` still serves a cached homepage body containing:

```text
<div class="ma-spotlight-bar__eyebrow">Country spotlight</div>
country-mode.js?v=145899350803046321911778133989
```

The pushed Liquid source no longer renders the Country Spotlight section in the current homepage source path, and the new premium Spotlight/Boosted sections exist in the theme source. Browser verification still showed the stale body:

```json
{
  "premiumSpotlight": false,
  "boostedRuntime": false,
  "oldBoostedSidebarsVisible": 2,
  "visibleCountrySpotlightText": true
}
```

Admin Theme Asset API cache touch is not available from this shell because no Shopify Admin token or refresh credentials are present, and the existing cache blocker report records prior missing `read_themes` approval. The remaining blocker is Shopify storefront page cache/CDN serving stale homepage HTML/assets after CLI push/publish.
