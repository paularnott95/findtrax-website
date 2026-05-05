(function() {
  window.missingAlertsNotify = window.missingAlertsNotify || function(location) {
    console.log('Klaviyo integration pending:', location);
  };

  function normalize(value) {
    return String(value || '').toLowerCase().trim();
  }

  function slugify(value) {
    if (window.MissingAlertsLocationRegistry && window.MissingAlertsLocationRegistry.slugify) {
      return window.MissingAlertsLocationRegistry.slugify(value);
    }
    return normalize(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function countryAlias(value) {
    var country = normalize(value);
    if (country === 'uk' || country === 'united-kingdom' || country === 'great-britain') return 'gb';
    if (country === 'usa' || country === 'united-states' || country === 'united-states-of-america') return 'us';
    return country;
  }

  function params() {
    var search = new URLSearchParams(window.location.search);
    var pathParts = window.location.pathname.split('/').filter(Boolean);
    var missingPeopleIndex = pathParts.indexOf('missing-people');
    var pageHandle = pathParts[pathParts.indexOf('pages') + 1] || '';
    var locParam = (search.get('loc') || '').replace(/^\/+|\/+$/g, '');
    var regionParam = (search.get('region') || '').replace(/^\/+|\/+$/g, '');
    var countryParam = (search.get('country') || '').replace(/^\/+|\/+$/g, '');
    var locationPath = locParam || regionParam || countryParam || (missingPeopleIndex !== -1 ? pathParts.slice(missingPeopleIndex + 1).join('/') : '');
    var locationPathParts = locationPath ? locationPath.split('/').filter(Boolean) : [];
    return {
      pageHandle: pageHandle,
      pageMode: pageMode(pageHandle),
      country: countryAlias(search.get('country') || document.documentElement.getAttribute('data-country') || 'gb'),
      countrySlug: locationPathParts[0] || '',
      level: normalize(search.get('level')),
      location: slugify(search.get('location') || search.get('slug') || locationPath.split('/').pop() || ''),
      slugPath: locationPath ? '/missing-people/' + locationPath : '',
      hasCountryParam: search.has('country'),
      hasLevelParam: search.has('level'),
      hasLocationParam: search.has('location') || search.has('slug') || search.has('loc') || Boolean(locationPath),
      debug: search.get('ma_debug_location') === '1'
    };
  }

  function pageMode(handle) {
    if (handle === 'missing-alerts-near-me') return 'alert';
    if (handle === 'missing-person-search-guide') return 'guide';
    if (handle === 'missing-people-region') return 'region';
    if (handle === 'missing-people-country') return 'country';
    if (handle === 'missing-cases-near') return 'cluster';
    if (handle === 'no-active-missing-cases') return 'no-case';
    if (handle === 'missing-people-near-me') return 'near-me';
    if (handle === 'recent-missing-cases') return 'recent';
    if (handle === 'help-find-missing') return 'help';
    if (handle === 'missing-people-compare') return 'compare';
    return 'location';
  }

  function debugText(root, selector, value) {
    var node = root.querySelector(selector);
    if (node) node.textContent = value || '';
  }

  function setDebugMessages(root, messages) {
    var list = root.querySelector('[data-location-debug-messages]');
    if (!list) return;
    list.innerHTML = '';
    messages.forEach(function(message) {
      var item = document.createElement('li');
      item.textContent = message;
      list.appendChild(item);
    });
  }

  function showDebug(root, request, registry, location, matchedCount, excludedCount, locationFound) {
    if (!request.debug) return;
    var panel = root.querySelector('[data-location-debug-panel]');
    if (!panel) return;

    var messages = [];
    var registryLoaded = Boolean(registry && registry.entries && registry.entries.length);
    if (!request.hasCountryParam && !request.hasLevelParam && !request.hasLocationParam) {
      messages.push('No location query params were provided; the page used its safe country fallback.');
    }
    if (!registryLoaded) {
      messages.push('Location registry did not load.');
    }
    if (registryLoaded && !locationFound) {
      messages.push('Requested location was not found; a safe fallback location was used.');
    }
    if (location && matchedCount === 0) {
      messages.push('No matching live missing cases are currently visible for this location.');
    }
    if (!messages.length) {
      messages.push('Debug mode is active. No fallback warnings were triggered.');
    }

    panel.hidden = false;
    debugText(root, '[data-location-debug-country]', request.country || 'Not set');
    debugText(root, '[data-location-debug-level]', request.level || 'Not set');
    debugText(root, '[data-location-debug-location]', request.location || 'Not set');
    debugText(root, '[data-location-debug-entry]', location ? [location.id, location.name, location.type].join(' / ') : 'Not matched');
    debugText(root, '[data-location-debug-matched-count]', String(matchedCount || 0));
    debugText(root, '[data-location-debug-excluded-count]', String(excludedCount || 0));
    debugText(root, '[data-location-debug-registry]', registryLoaded ? 'yes (' + registry.entries.length + ' entries)' : 'no');
    debugText(root, '[data-location-debug-section]', 'templates/page.missing-people-location.json + sections/location-case-page.liquid');
    debugText(root, '[data-location-debug-summary]', 'Safe debug mode is active for this request only. Loaded chunks: ' + Object.keys((registry && registry.loadedChunks) || {}).join(', '));
    setDebugMessages(root, messages);
  }

  function textMatches(text, terms) {
    var source = normalize(text);
    return terms.some(function(term) {
      var normalized = normalize(term);
      return normalized && source.indexOf(normalized) !== -1;
    });
  }

  function statusIsMissing(card) {
    var status = normalize(card.getAttribute('data-status'));
    return status && status.indexOf('found') === -1 && status.indexOf('resolved') === -1 && status.indexOf('closed') === -1 && status.indexOf('located') === -1;
  }

  function statusIsResolved(card) {
    return !statusIsMissing(card);
  }

  function sameValue(a, b) {
    return normalize(a) && normalize(a) === normalize(b);
  }

  function hasSameValue(value, candidates) {
    return candidates.some(function(candidate) {
      return sameValue(value, candidate);
    });
  }

  function distanceKm(aLat, aLng, bLat, bLng) {
    var lat1 = Number(aLat);
    var lon1 = Number(aLng);
    var lat2 = Number(bLat);
    var lon2 = Number(bLng);
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
    var rad = Math.PI / 180;
    var dLat = (lat2 - lat1) * rad;
    var dLon = (lon2 - lon1) * rad;
    var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * rad) * Math.cos(lat2 * rad) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  function ancestors(registry, location) {
    var list = [];
    var cursor = location;
    var guard = 0;
    while (cursor && cursor.parentId && registry.byId[cursor.parentId] && guard < 12) {
      cursor = registry.byId[cursor.parentId];
      list.unshift(cursor);
      guard += 1;
    }
    return list;
  }

  function parentOfType(registry, location, types) {
    var list = ancestors(registry, location).reverse();
    return list.find(function(entry) {
      return types.indexOf(entry.type) !== -1 || types.indexOf(entry.level) !== -1;
    }) || null;
  }

  function countryEntry(registry, location) {
    return registry.byId[location.countryCode] || (registry.byCountry[location.countryCode] || []).find(function(entry) {
      return entry.type === 'country';
    }) || null;
  }

  function mapLocation(registry, location) {
    var candidates = [location].concat(ancestors(registry, location).reverse());
    var country = countryEntry(registry, location);
    if (country) candidates.push(country);
    candidates.push({ name: location.countryName || location.name, countryName: location.countryName || '', latitude: 0, longitude: 0 });
    return candidates.find(function(entry) {
      return entry && entry.latitude != null && entry.longitude != null && entry.latitude !== '' && entry.longitude !== '';
    }) || candidates[candidates.length - 1];
  }

  function caseMatchTier(card, location, registry) {
    var cardCountry = countryAlias(card.getAttribute('data-country-code') || card.getAttribute('data-country'));
    if (cardCountry && cardCountry !== 'all' && cardCountry !== location.countryCode) return '';

    var cardSlugPath = card.getAttribute('data-location-slug-path');
    var cardAdmin1 = card.getAttribute('data-admin1') || card.getAttribute('data-region');
    var cardAdmin2 = card.getAttribute('data-admin2');
    var cardRegionId = card.getAttribute('data-region-id');
    var cardCountyId = card.getAttribute('data-county-id');
    var cardCityId = card.getAttribute('data-city-id');
    var cardTownId = card.getAttribute('data-town-id');
    var cardVillageId = card.getAttribute('data-village-id');
    var cardCity = card.getAttribute('data-city');
    var cardTown = card.getAttribute('data-town');
    var cardVillage = card.getAttribute('data-village');
    var cardLocation = card.getAttribute('data-location');
    var cardLastSeen = card.getAttribute('data-last-seen');
    var structuredHaystack = [cardAdmin1, cardAdmin2, cardCity, cardTown, cardVillage, cardLocation, cardLastSeen, cardSlugPath].join(' ');
    var admin1Parent = parentOfType(registry, location, ['state', 'province', 'region']);
    var admin2Parent = parentOfType(registry, location, ['county', 'district', 'local-authority', 'municipality']);
    var selectedIsLocal = ['city', 'town', 'village', 'locality', 'municipality'].indexOf(location.type) !== -1;
    var selectedIsAdmin2 = ['county', 'district', 'local-authority', 'municipality'].indexOf(location.type) !== -1;
    var selectedIsAdmin1 = ['state', 'province', 'region'].indexOf(location.type) !== -1;

    if (location.level === 0 || location.type === 'country' || location.type === 'nation') {
      return 'sameAdmin1';
    }
    if (location.slugPath && (sameValue(cardSlugPath, location.slugPath) || (location.legacySlugPaths || []).some(function(path) { return sameValue(cardSlugPath, path); }))) {
      return 'exactLocation';
    }
    if (hasSameValue(location.id, [cardCityId, cardTownId, cardVillageId, cardRegionId, cardCountyId])) {
      return 'exactLocation';
    }
    if (selectedIsLocal && hasSameValue(location.name, [cardCity, cardTown, cardVillage, cardLocation])) {
      return 'sameCity';
    }
    if (selectedIsAdmin2 && (hasSameValue(location.id, [cardCountyId]) || hasSameValue(location.name, [cardAdmin2, cardLocation]))) {
      return 'sameAdmin2';
    }
    if (admin2Parent && (hasSameValue(admin2Parent.id, [cardCountyId]) || hasSameValue(admin2Parent.name, [cardAdmin2]))) {
      return 'sameAdmin2';
    }
    if (selectedIsAdmin1 && (hasSameValue(location.id, [cardRegionId]) || hasSameValue(location.name, [cardAdmin1, cardLocation]))) {
      return 'sameAdmin1';
    }
    if (admin1Parent && (hasSameValue(admin1Parent.id, [cardRegionId]) || hasSameValue(admin1Parent.name, [cardAdmin1]))) {
      return 'sameAdmin1';
    }
    if (selectedIsLocal && textMatches(structuredHaystack, [location.name].concat(location.aliases || []))) {
      return 'sameCity';
    }
    var distance = distanceKm(location.latitude, location.longitude, card.getAttribute('data-lat'), card.getAttribute('data-lng'));
    if (distance != null && distance <= 80) {
      card.setAttribute('data-location-distance-km', String(Math.round(distance)));
      return 'nearbyByCoordinates';
    }
    return '';
  }

  function caseMatchesLocation(card, location, registry, includeResolved) {
    if (!includeResolved && !statusIsMissing(card)) return false;
    if (includeResolved && !statusIsResolved(card)) return false;
    return Boolean(caseMatchTier(card, location, registry));
  }

  function findLocation(registry, request) {
    var entries = registry.entries || [];
    if (request.slugPath) {
      var byPath = entries.find(function(entry) {
        return entry.slugPath === request.slugPath || (entry.legacySlugPaths || []).indexOf(request.slugPath) !== -1;
      });
      if (byPath) return byPath;
    }
    var countryEntries = entries.filter(function(entry) {
      return entry.countryCode === request.country;
    });
    var exact = countryEntries.find(function(entry) {
      var levelMatches = !request.level || entry.type === request.level || String(entry.level) === request.level || (request.country === 'gb' && request.level === 'nation' && ['england', 'scotland', 'wales', 'northern-ireland'].indexOf(entry.slug) !== -1);
      if (!levelMatches) return false;
      return entry.slug === request.location || entry.id === request.country + '-' + request.location;
    });
    if (exact) return exact;
    if (request.location) {
      exact = countryEntries.find(function(entry) {
        return entry.slug === request.location || (entry.aliases || []).map(slugify).indexOf(request.location) !== -1;
      });
      if (exact) return exact;
    }
    return registry.byId[request.country] || countryEntries[0] || (registry.entries || [])[0];
  }

  function hasExactLocation(registry, request) {
    if (!registry) return false;
    if (request.slugPath && (registry.entries || []).some(function(entry) {
      return entry.slugPath === request.slugPath || (entry.legacySlugPaths || []).indexOf(request.slugPath) !== -1;
    })) return true;
    var countryEntries = (registry.entries || []).filter(function(entry) {
      return entry.countryCode === request.country;
    });
    return countryEntries.some(function(entry) {
      var levelMatches = !request.level || entry.type === request.level || String(entry.level) === request.level || (request.country === 'gb' && request.level === 'nation' && ['england', 'scotland', 'wales', 'northern-ireland'].indexOf(entry.slug) !== -1);
      if (!levelMatches) return false;
      return entry.slug === request.location || entry.id === request.country + '-' + request.location || (entry.aliases || []).map(slugify).indexOf(request.location) !== -1;
    });
  }

  function urlFor(entry) {
    if (entry.slugPath) {
      var loc = entry.slugPath.replace(/^\/missing-people\/?/, '').replace(/^\/+|\/+$/g, '');
      return '/pages/missing-people-location' + (loc ? '?loc=' + loc.split('/').map(encodeURIComponent).join('/') : '');
    }
    return '/pages/missing-people-location?country=' + encodeURIComponent(entry.countryCode) + '&level=' + encodeURIComponent(entry.type) + '&location=' + encodeURIComponent(entry.slug);
  }

  function locParamFor(entry) {
    if (!entry || !entry.slugPath) return '';
    return entry.slugPath.replace(/^\/missing-people\/?/, '').replace(/^\/+|\/+$/g, '');
  }

  function variantUrl(handle, entry) {
    var loc = locParamFor(entry);
    return loc ? '/pages/' + handle + '?loc=' + loc.split('/').map(encodeURIComponent).join('/') : '';
  }

  function regionUrl(entry) {
    var parts = locParamFor(entry).split('/').filter(Boolean);
    return parts.length >= 2 ? '/pages/missing-people-region?region=' + parts.slice(0, 2).map(encodeURIComponent).join('/') : '';
  }

  function countryUrl(entry) {
    var country = locParamFor(entry).split('/').filter(Boolean)[0];
    return country ? '/pages/missing-people-country?country=' + encodeURIComponent(country) : '';
  }

  function modeUrl(mode, entry) {
    if (mode === 'alert') return variantUrl('missing-alerts-near-me', entry);
    if (mode === 'guide') return variantUrl('missing-person-search-guide', entry);
    if (mode === 'cluster') return variantUrl('missing-cases-near', entry);
    if (mode === 'no-case') return variantUrl('no-active-missing-cases', entry);
    if (mode === 'near-me') return variantUrl('missing-people-near-me', entry);
    if (mode === 'recent') return variantUrl('recent-missing-cases', entry);
    if (mode === 'help') return variantUrl('help-find-missing', entry);
    if (mode === 'region') return regionUrl(entry);
    if (mode === 'country') return countryUrl(entry);
    return urlFor(entry);
  }

  function setText(root, selector, value) {
    root.querySelectorAll(selector).forEach(function(node) {
      node.textContent = value || '';
    });
  }

  function renderLinks(container, entries, limit) {
    if (!container) return;
    container.innerHTML = '';
    var max = limit || 30;
    entries.slice(0, max).forEach(function(entry) {
      var link = document.createElement('a');
      link.href = urlFor(entry);
      link.textContent = entry.name;
      link.setAttribute('data-location-link', '');
      link.setAttribute('data-location-search-value', [entry.name, entry.type, entry.parentName, (entry.aliases || []).join(' ')].join(' '));
      container.appendChild(link);
    });
    if (entries.length > max) {
      var more = document.createElement('span');
      more.className = 'ma-location-page__more-link';
      more.textContent = 'View more nearby areas using search';
      container.appendChild(more);
    }
  }

  function renderLinksForMode(container, entries, limit, mode) {
    if (!container) return;
    container.innerHTML = '';
    uniqueEntries(entries).slice(0, limit || 30).forEach(function(entry) {
      var href = modeUrl(mode, entry);
      if (!href) return;
      var link = document.createElement('a');
      link.href = href;
      link.textContent = entry.name;
      link.setAttribute('data-location-link', '');
      link.setAttribute('data-location-search-value', [entry.name, entry.type, entry.parentName, (entry.aliases || []).join(' ')].join(' '));
      container.appendChild(link);
    });
  }

  function renderLinksAll(root, selector, entries, limit) {
    root.querySelectorAll(selector).forEach(function(container) {
      renderLinks(container, entries, limit);
    });
  }

  function uniqueEntries(entries) {
    var seen = {};
    return (entries || []).filter(function(entry) {
      if (!entry || !entry.id || seen[entry.id]) return false;
      seen[entry.id] = true;
      return true;
    });
  }

  function fillToMinimum(primary, fallback, currentId, minimum) {
    return uniqueEntries(primary.concat(fallback || [])).filter(function(entry) {
      return entry.id !== currentId && entry.slugPath;
    }).slice(0, minimum || 5);
  }

  function cardDateLabel(card) {
    var value = card.getAttribute('data-date');
    if (!value) return 'date not listed';
    var date = new Date(value + 'T00:00:00');
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function cardLocationLabel(card) {
    return card.getAttribute('data-last-seen') || card.getAttribute('data-location') || card.getAttribute('data-city') || card.getAttribute('data-region') || '';
  }

  function hoursSinceLatest(cards, fallbackDate) {
    var latest = 0;
    cards.forEach(function(card) {
      var date = new Date((card.getAttribute('data-date') || '') + 'T00:00:00');
      if (!Number.isNaN(date.getTime())) latest = Math.max(latest, date.getTime());
    });
    if (!latest) latest = new Date(fallbackDate || Date.now()).getTime();
    var hours = Math.max(1, Math.round((Date.now() - latest) / 36e5));
    if (hours < 48) return hours + ' hours ago';
    return Math.round(hours / 24) + ' days ago';
  }

  function renderCaseSummary(container, cards, limit) {
    if (!container) return;
    container.innerHTML = '';
    cards.slice(0, limit || 8).forEach(function(card) {
      var link = document.createElement('a');
      link.className = 'ma-location-page__compact-case';
      link.href = card.getAttribute('data-url') || '#';
      var title = card.getAttribute('data-title') || 'Missing Alerts case';
      var location = cardLocationLabel(card);
      link.innerHTML = '<strong>' + escapeHtml(title) + '</strong><span>' + escapeHtml([cardDateLabel(card), location].filter(Boolean).join(' · ')) + '</span>';
      container.appendChild(link);
    });
  }

  function renderActivity(root, location, activeCards, resolvedCards) {
    var list = root.querySelector('[data-location-activity-list]');
    var empty = root.querySelector('[data-location-activity-empty]');
    if (!list) return;
    list.innerHTML = '';
    var combined = activeCards.concat(resolvedCards).sort(function(a, b) {
      return String(b.getAttribute('data-date') || '').localeCompare(String(a.getAttribute('data-date') || ''));
    }).slice(0, 8);
    combined.forEach(function(card, index) {
      var item = document.createElement('p');
      var title = card.getAttribute('data-title') || 'A Missing Alerts case';
      var status = statusIsResolved(card) ? 'resolved case history' : 'active appeal';
      var locationLabel = cardLocationLabel(card) || displayName(location);
      var templates = [
        title + ' is listed as an ' + status + ' connected to ' + locationLabel + '.',
        'On ' + cardDateLabel(card) + ', Missing Alerts records ' + title + ' with location data for ' + locationLabel + '.',
        location.name + ' is connected to ' + title + ' through verified case location fields.'
      ];
      item.textContent = templates[index % templates.length];
      list.appendChild(item);
    });
    if (empty) empty.hidden = combined.length > 0;
  }

  function renderConnectedAreas(root, registry, location, activeCards) {
    var container = root.querySelector('[data-location-connected-areas]');
    var empty = root.querySelector('[data-location-connected-empty]');
    if (!container) return;
    var seen = {};
    var entries = [];
    activeCards.forEach(function(card) {
      [card.getAttribute('data-location-slug-path')].forEach(function(path) {
        if (!path || seen[path]) return;
        var entry = (registry.entries || []).find(function(item) {
          return item.slugPath === path || (item.legacySlugPaths || []).indexOf(path) !== -1;
        });
        if (entry && entry.countryCode === location.countryCode) {
          seen[path] = true;
          entries.push(entry);
          ancestors(registry, entry).forEach(function(parent) {
            if (parent.slugPath && !seen[parent.slugPath] && parent.countryCode === location.countryCode) {
              seen[parent.slugPath] = true;
              entries.push(parent);
            }
          });
        }
      });
    });
    renderLinks(container, entries, 20);
    if (empty) empty.hidden = entries.length > 0;
  }

  function renderGroupedLinks(root, registry, location) {
    var countryEntries = (registry.byCountry[location.countryCode] || []).filter(function(entry) {
      return entry.id !== location.id;
    });
    var parentLinks = ancestors(registry, location);
    var children = countryEntries.filter(function(entry) {
      return entry.parentId === location.id;
    });
    var regions = countryEntries.filter(function(entry) {
      return entry.level === 1 || entry.type === 'state' || entry.type === 'province' || entry.type === 'region' || entry.type === 'nation';
    });
    var counties = countryEntries.filter(function(entry) {
      return entry.type === 'county' || entry.type === 'district' || entry.type === 'local-authority' || entry.type === 'borough' || entry.type === 'municipality' || entry.type === 'parish';
    });
    var cities = countryEntries.filter(function(entry) {
      return entry.type === 'city' || entry.type === 'town';
    });
    var siblings = location.parentId ? countryEntries.filter(function(entry) {
      return entry.parentId === location.parentId && (entry.type === 'city' || entry.type === 'town' || entry.type === location.type);
    }) : [];
    var nearby = countryEntries.filter(function(entry) {
      if (entry.id === location.id || !entry.latitude || !entry.longitude || !location.latitude || !location.longitude) return false;
      if (['city', 'town', 'village', 'locality'].indexOf(entry.type) === -1) return false;
      var distance = distanceKm(location.latitude, location.longitude, entry.latitude, entry.longitude);
      if (distance == null || distance > 80) return false;
      entry._distanceKm = Math.round(distance);
      return true;
    }).sort(function(a, b) {
      return (a._distanceKm || 0) - (b._distanceKm || 0);
    });
    var country = countryEntry(registry, location);
    var fallbackLinks = children.concat(siblings).concat(nearby).concat(regions).concat(cities).concat(counties).concat(countryEntries);
    var parentSet = country ? parentLinks.concat([country]) : parentLinks;
    renderLinksAll(root, '[data-location-parent-links]', fillToMinimum(parentSet, fallbackLinks, location.id, 5), 12);
    renderLinksAll(root, '[data-location-child-links]', fillToMinimum(children, fallbackLinks, location.id, 5), 20);
    renderLinksAll(root, '[data-location-nearby-links]', fillToMinimum(nearby, fallbackLinks, location.id, 5), 20);
    renderLinksAll(root, '[data-location-sibling-links]', fillToMinimum(siblings, fallbackLinks, location.id, 5), 20);
    renderLinksAll(root, '[data-location-country-links]', fillToMinimum(regions.concat(cities).concat(counties), fallbackLinks, location.id, 5), 30);
    renderLinksForMode(root.querySelector('[data-location-region-hub-links]'), fillToMinimum(regions, fallbackLinks, location.id, 5), 10, 'region');
    renderLinksForMode(root.querySelector('[data-location-country-hub-links]'), fillToMinimum((registry.entries || []).filter(function(entry) { return entry.type === 'country'; }), fallbackLinks, location.id, 5), 10, 'country');
  }

  function renderRelatedPageTypes(root, registry, location) {
    var placeName = displayName(location);
    var entries = [
      { label: 'Location case hub', href: urlFor(location) },
      { label: 'Get alerts for missing people in ' + placeName, href: variantUrl('missing-alerts-near-me', location) },
      { label: 'Learn how to help find missing people in ' + placeName, href: variantUrl('missing-person-search-guide', location) },
      { label: 'View nearby missing cases around ' + placeName, href: variantUrl('missing-cases-near', location) },
      { label: 'No-current-cases context', href: variantUrl('no-active-missing-cases', location) },
      { label: 'Missing people near me', href: variantUrl('missing-people-near-me', location) },
      { label: 'Recent missing cases', href: variantUrl('recent-missing-cases', location) },
      { label: 'Help find missing people', href: variantUrl('help-find-missing', location) }
    ];
    var region = parentOfType(registry, location, ['state', 'province', 'region']) || location;
    var country = countryEntry(registry, location) || location;
    entries.push({ label: 'Regional directory', href: regionUrl(region) });
    entries.push({ label: 'Country directory', href: countryUrl(country) });
    root.querySelectorAll('[data-location-related-page-types]').forEach(function(container) {
      container.innerHTML = '';
      entries.forEach(function(entry) {
        if (!entry.href) return;
        var link = document.createElement('a');
        link.href = entry.href;
        link.textContent = entry.label;
        container.appendChild(link);
      });
    });
  }

  function renderPriorityLocations(root, registry, location) {
    var manager = window.MissingAlertsPriorityLocations;
    var containers = root.querySelectorAll('[data-location-priority-links], [data-location-trending-priority]');
    if (!manager || !containers.length) return;

    manager.load(registry).then(function(entries) {
      var selected = uniqueEntries(entries || []).filter(function(entry) {
        return entry.id !== location.id && entry.slugPath;
      }).slice(0, 12);
      containers.forEach(function(container) {
        container.innerHTML = '';
        selected.forEach(function(entry, index) {
          var link = document.createElement('a');
          link.href = urlFor(entry);
          link.textContent = entry.name + (entry.countryName ? ', ' + entry.countryName : '');
          link.setAttribute('data-location-link', '');
          link.setAttribute('data-location-priority-rank', String(index + 1));
          link.setAttribute('data-location-search-value', [entry.name, entry.countryName, entry.parentName, entry.type].filter(Boolean).join(' '));
          container.appendChild(link);
        });
      });
    }).catch(function() {});
  }

  function updateMap(root, registry, location, activeCards) {
    var mappedLocation = mapLocation(registry, location);
    var query = encodeURIComponent(mappedLocation.mapQuery || (mappedLocation.name + ', ' + (mappedLocation.countryName || location.countryName)));
    var iframe = root.querySelector('[data-location-map]');
    var link = root.querySelector('[data-location-map-link]');
    var status = root.querySelector('[data-location-map-status]');
    var lat = Number(mappedLocation.latitude);
    var lng = Number(mappedLocation.longitude);
    var span = (location.type === 'country' || mappedLocation.type === 'country') ? 4 : 0.08;
    if (iframe) {
      iframe.src = 'https://www.openstreetmap.org/export/embed.html?bbox=' + encodeURIComponent((lng - span) + ',' + (lat - span) + ',' + (lng + span) + ',' + (lat + span)) + '&layer=mapnik&marker=' + encodeURIComponent(lat + ',' + lng);
      iframe.title = 'Missing people map in ' + displayName(location);
      iframe.setAttribute('aria-label', 'Missing people map in ' + displayName(location));
    }
    if (link) link.href = 'https://www.openstreetmap.org/search?query=' + query;
    if (status) {
      status.textContent = activeCards && activeCards.length ? 'Active case markers are listed below where verified case coordinates or location fields are available.' : 'No active cases currently, but this area is monitored.';
    }
  }

  function renderMapPins(root, location, activeCards, resolvedCards) {
    var container = root.querySelector('[data-location-map-pins]');
    if (!container) return;
    container.innerHTML = '';
    var selected = document.createElement('div');
    selected.className = 'ma-location-page__map-pin is-selected';
    selected.textContent = 'Selected location: ' + location.name;
    container.appendChild(selected);

    activeCards.slice(0, 12).forEach(function(card) {
      var item = document.createElement('a');
      item.className = 'ma-location-page__map-pin is-active';
      item.href = card.getAttribute('data-url') || '#';
      item.innerHTML = mapPinMarkup(card, 'Active missing case');
      container.appendChild(item);
    });

    resolvedCards.slice(0, 6).forEach(function(card) {
      var item = document.createElement('a');
      item.className = 'ma-location-page__map-pin is-resolved';
      item.href = card.getAttribute('data-url') || '#';
      item.innerHTML = mapPinMarkup(card, 'Resolved case');
      container.appendChild(item);
    });
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, function(match) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[match];
    });
  }

  function mapPinMarkup(card, fallbackTitle) {
    var image = card.getAttribute('data-image');
    var title = card.getAttribute('data-title') || fallbackTitle;
    var location = card.getAttribute('data-last-seen') || card.getAttribute('data-location') || '';
    var status = card.getAttribute('data-case-status') || card.getAttribute('data-status') || '';
    return (image ? '<img src="' + escapeHtml(image) + '" alt="' + escapeHtml(title + ' case image near ' + location) + '" loading="lazy">' : '') +
      '<span><strong>' + escapeHtml(title) + '</strong><small>' + escapeHtml([status, location].filter(Boolean).join(' · ')) + '</small></span>';
  }

  function faqEntries(location) {
    return [
      {
        question: 'Are there missing people in ' + displayName(location) + '?',
        answer: 'This page shows active Missing Alerts cases matched to ' + displayName(location) + ', plus monitored nearby areas when there are no exact local cases.'
      },
      {
        question: 'How do I report a missing person?',
        answer: 'If someone is missing or may be in danger, contact police or emergency services first. Missing Alerts can help with awareness after an official report is made.'
      },
      {
        question: 'How many missing people are reported in ' + displayName(location) + '?',
        answer: 'Missing Alerts only shows verified public appeals and local monitoring information. Official totals should be confirmed with police or the relevant public authority.'
      },
      {
        question: 'Where are missing people usually found in ' + displayName(location) + '?',
        answer: 'Search activity can involve transport routes, parks, shops, schools, workplaces, hospitals and nearby communities, depending on official appeal details.'
      },
      {
        question: 'What should I do if I see someone?',
        answer: 'Do not approach if there is risk. Note the time, place and direction of travel, then contact police or the official appeal contact route.'
      }
    ];
  }

  function updateJsonLd(root, location, visibleCards, mode) {
    var node = root.querySelector('[data-location-jsonld]');
    if (!node) return;
    var metaCopy = modeMeta(mode || 'location', location);
    var canonicalUrl = window.location.origin + modeUrl(mode || 'location', location);
    var items = visibleCards.slice(0, 20).map(function(card, index) {
      return {
        '@type': 'ListItem',
        position: index + 1,
        url: card.getAttribute('data-url') ? window.location.origin + card.getAttribute('data-url') : canonicalUrl,
        name: card.getAttribute('data-title') || 'Missing Alerts case'
      };
    });
    var nearbyEntries = [];
    root.querySelectorAll('[data-location-nearby-links] a').forEach(function(link, index) {
      if (index >= 12) return;
      nearbyEntries.push({
        '@type': 'ListItem',
        position: index + 1,
        url: link.href,
        name: link.textContent
      });
    });
    var crumbEntries = ancestors(window.MissingAlertsLocationRegistry || {}, location).concat([location]);
    var crumbItems = [{ '@type': 'ListItem', position: 1, name: 'Home', item: window.location.origin + '/' }];
    crumbEntries.forEach(function(entry) {
      crumbItems.push({ '@type': 'ListItem', position: crumbItems.length + 1, name: entry.name, item: window.location.origin + urlFor(entry) });
    });
    node.textContent = JSON.stringify([
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: metaCopy.heading,
        headline: metaCopy.heading,
        description: metaCopy.description,
        url: canonicalUrl
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: crumbItems
      },
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqEntries(location).map(function(entry) {
          return {
            '@type': 'Question',
            name: entry.question,
            acceptedAnswer: {
              '@type': 'Answer',
              text: entry.answer
            }
          };
        })
      },
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        itemListElement: items
      },
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'Nearby Missing Alerts locations',
        itemListElement: nearbyEntries
      }
    ]);
  }

  function displayName(location) {
    return [location.name, location.parentName && location.parentName !== location.countryName ? location.parentName : '', location.countryName].filter(Boolean).join(', ');
  }

  function currentLanguage() {
    var lang = normalize(new URLSearchParams(window.location.search).get('lang') || 'en');
    return ['fr', 'de', 'es', 'it', 'ar'].indexOf(lang) !== -1 ? lang : 'en';
  }

  function translationCache() {
    try {
      return JSON.parse(window.localStorage.getItem('MissingAlertsLocationTranslations') || '{}');
    } catch (error) {
      return {};
    }
  }

  function saveTranslationCache(cache) {
    try {
      window.localStorage.setItem('MissingAlertsLocationTranslations', JSON.stringify(cache || {}));
    } catch (error) {}
  }

  function translateTemplate(text, lang) {
    if (lang === 'fr') {
      return text
        .replace('Missing Alerts monitors', 'Missing Alerts surveille')
        .replace('for active missing person appeals, nearby updates and resolved case history.', 'pour les appels actifs de personnes disparues, les mises a jour proches et les dossiers resolus.')
        .replace('The page links verified parent areas, neighbouring towns and country-level hubs so search engines and residents can move through real location paths.', 'La page relie les zones parentes verifiees, les villes voisines et les hubs nationaux afin que les moteurs de recherche et les habitants puissent suivre de vrais parcours geographiques.')
        .replace('When no active cases are listed, the area remains monitored and ready for future verified appeals.', 'Lorsqu aucun cas actif nest liste, la zone reste surveillee et prete pour de futurs appels verifies.');
    }
    if (lang === 'de') {
      return text
        .replace('Missing Alerts monitors', 'Missing Alerts ueberwacht')
        .replace('for active missing person appeals, nearby updates and resolved case history.', 'auf aktive Vermisstenaufrufe, nahegelegene Aktualisierungen und geloeste Fallhistorie.')
        .replace('The page links verified parent areas, neighbouring towns and country-level hubs so search engines and residents can move through real location paths.', 'Die Seite verlinkt gepruefte uebergeordnete Gebiete, Nachbarorte und Laender-Hubs, damit Suchmaschinen und Einwohner echte Standortpfade nutzen koennen.')
        .replace('When no active cases are listed, the area remains monitored and ready for future verified appeals.', 'Wenn keine aktiven Faelle gelistet sind, bleibt das Gebiet ueberwacht und fuer kuenftige gepruefte Aufrufe bereit.');
    }
    if (lang === 'es') {
      return text
        .replace('Missing Alerts monitors', 'Missing Alerts monitorea')
        .replace('for active missing person appeals, nearby updates and resolved case history.', 'para avisos activos de personas desaparecidas, novedades cercanas e historial de casos resueltos.')
        .replace('The page links verified parent areas, neighbouring towns and country-level hubs so search engines and residents can move through real location paths.', 'La pagina enlaza areas superiores verificadas, localidades cercanas y centros de pais para que residentes y buscadores sigan rutas reales.')
        .replace('When no active cases are listed, the area remains monitored and ready for future verified appeals.', 'Cuando no hay casos activos listados, el area sigue monitorizada para futuros avisos verificados.');
    }
    if (lang === 'it') {
      return text
        .replace('Missing Alerts monitors', 'Missing Alerts monitora')
        .replace('for active missing person appeals, nearby updates and resolved case history.', 'per appelli attivi di persone scomparse, aggiornamenti vicini e casi risolti.')
        .replace('The page links verified parent areas, neighbouring towns and country-level hubs so search engines and residents can move through real location paths.', 'La pagina collega aree superiori verificate, localita vicine e hub nazionali per seguire percorsi geografici reali.')
        .replace('When no active cases are listed, the area remains monitored and ready for future verified appeals.', 'Quando non sono elencati casi attivi, l area resta monitorata per futuri appelli verificati.');
    }
    if (lang === 'ar') {
      return text
        .replace('Missing Alerts monitors', 'Missing Alerts monitors')
        .replace('for active missing person appeals, nearby updates and resolved case history.', 'for active missing person appeals, nearby updates and resolved case history.')
        .replace('The page links verified parent areas, neighbouring towns and country-level hubs so search engines and residents can move through real location paths.', 'This page connects verified parent areas, nearby places and country hubs for real location navigation.')
        .replace('When no active cases are listed, the area remains monitored and ready for future verified appeals.', 'When no active cases are listed, this area remains monitored for future verified appeals.');
    }
    return text;
  }

  function locationSignals(location, activeCards) {
    var population = Number(location.approximatePopulation || 0);
    var bucket = population >= 1000000 ? 'major metro' : (population >= 100000 ? 'large population centre' : (population >= 10000 ? 'mid-sized area' : 'local community'));
    var type = normalize(location.type);
    var regionType = ['city', 'town', 'village', 'locality'].indexOf(type) !== -1 ? 'local place' : (type === 'country' ? 'country' : 'regional area');
    var coastal = /coast|bay|beach|harbour|harbor|port|island|sea|ocean/i.test([location.name, location.parentName, location.countryName].join(' '));
    var caseDensity = activeCards.length >= 5 ? 'higher current case activity' : (activeCards.length ? 'some current case activity' : 'no current listed cases');
    var transport = population >= 100000 ? 'public transport, commuter roads, schools, hospitals, retail areas and parks' : 'main roads, local shops, schools, farms, paths and community meeting points';
    var complexity = population >= 100000 ? 'dense movement patterns and multiple possible travel routes' : 'smaller search areas where local memory and neighbour awareness can matter';
    var environment = coastal ? 'coastal or waterside' : (population >= 100000 ? 'urban and suburban' : (population >= 10000 ? 'mixed urban and rural' : 'rural or local'));
    var localInsights = population >= 100000 ? 'residential districts, retail areas, hospitals, schools, stations, workplaces and parks' : 'homes, local shops, schools, open areas, paths, farms, community centres and road links';
    return { bucket: bucket, regionType: regionType, terrain: coastal ? 'coastal or waterside movement routes' : 'road, transit and community movement routes', caseDensity: caseDensity, transport: transport, complexity: complexity, environment: environment, localInsights: localInsights, population: population };
  }

  function stableIndex(location, modulo) {
    var source = String(location.slugPath || location.id || location.name || '');
    var total = 0;
    for (var index = 0; index < source.length; index += 1) total = (total + source.charCodeAt(index) * (index + 1)) % 9973;
    return modulo ? total % modulo : total;
  }

  function rotateList(items, offset) {
    if (!items || !items.length) return [];
    var start = offset % items.length;
    return items.slice(start).concat(items.slice(0, start));
  }

  function locationContentLinks(location, registry) {
    var region = parentOfType(registry, location, ['state', 'province', 'region']) || location;
    var country = countryEntry(registry, location) || location;
    return [
      { label: 'missing people in ' + displayName(location), href: urlFor(location) },
      { label: 'alerts in ' + displayName(location), href: variantUrl('missing-alerts-near-me', location) },
      { label: 'safe search guide for ' + displayName(location), href: variantUrl('missing-person-search-guide', location) },
      { label: 'nearby missing cases', href: variantUrl('missing-cases-near', location) },
      { label: 'region missing people directory', href: regionUrl(region) },
      { label: 'country missing people directory', href: countryUrl(country) }
    ];
  }

  function generateLocationContent(location, registry, activeCards, resolvedCards) {
    var admin1 = parentOfType(registry, location, ['state', 'province', 'region']);
    var admin2 = parentOfType(registry, location, ['county', 'district', 'local-authority', 'municipality']);
    var place = displayName(location);
    var hierarchy = [admin2 && admin2.name, admin1 && admin1.name, location.countryName].filter(Boolean).join(', ');
    var signals = locationSignals(location, activeCards);
    var placeOffset = stableIndex(location, 4);
    var faq = rotateList([
      {
        question: 'Are there missing people in ' + place + '?',
        answer: 'This page lists active Missing Alerts appeals connected to ' + place + ' when verified case fields match the area. If no active case is listed, the area remains monitored and nearby areas may still have active alerts.'
      },
      {
        question: 'What should I do first if someone is missing in ' + place + '?',
        answer: 'Contact police or local emergency services first, especially if there is immediate risk. Missing Alerts is for public awareness and does not replace official reporting.'
      },
      {
        question: 'Can I share an appeal for ' + place + '?',
        answer: 'Share only verified appeal links or official information, avoid speculation, and do not publish private details that are not already part of an approved public appeal.'
      },
      {
        question: 'Why does this page include nearby areas?',
        answer: 'People may move through transport routes, residential areas, open spaces and neighbouring communities, so nearby verified location pages can help residents navigate safely.'
      },
      {
        question: 'How often is this area updated?',
        answer: 'The page updates when the Missing Alerts registry or approved case information changes. The last updated label uses real registry or case freshness only.'
      },
      {
        question: 'What if I think I have seen someone from an alert?',
        answer: 'Do not approach if there is any risk. Record the time, location and direction of travel, then contact police or the official appeal contact route.'
      },
      {
        question: 'Why might there be no active cases here?',
        answer: 'Some areas have no current verified public appeals. This monitored page still links to parent areas, nearby locations and alert signup for future approved updates.'
      }
    ], placeOffset).slice(0, 6);
    return {
      overview: 'Looking for missing people in ' + place + '? This page shows alerts, nearby areas, and guidance on how to help. This ' + signals.bucket + ' sits within ' + (hierarchy || location.countryName) + ', with ' + signals.caseDensity + ' based only on approved Missing Alerts case data.',
      whyItMatters: 'Search complexity can change across ' + place + ' because movement may involve residential areas, transport links, workplaces, schools, open spaces and neighbouring communities.',
      environment: 'The local environment is treated as ' + signals.environment + ', so this page avoids assumptions and uses broad public context rather than invented incident data.',
      movement: 'General movement patterns may include ' + signals.transport + '. These are general awareness prompts, not claims about any specific missing person.',
      nearbyContext: 'Nearby areas and parent directories help people move through real registry-backed locations without creating unverified or orphan pages.',
      localInsights: 'Local awareness may involve ' + signals.localInsights + ', depending on the official appeal and what police or family representatives have made public.',
      searchComplexity: 'Search challenges in this area may include ' + signals.complexity + ' and ' + signals.terrain + '. Public help should stay practical, calm and evidence-led.',
      howToHelp: 'Share verified appeals responsibly, check relevant local context only where safe, preserve possible CCTV or doorbell footage, and send urgent information to police first.',
      safety: 'Do not approach individuals if there is risk. Do not share unverified information, private addresses or accusations. Missing Alerts supports awareness after official reporting; it does not replace police or emergency services.',
      faq: faq,
      links: locationContentLinks(location, registry),
      lastUpdated: registry.generatedAt || ''
    };
  }

  function renderLocationContent(root, registry, location, activeCards, resolvedCards) {
    var container = root.querySelector('[data-location-content]');
    if (!container) return;
    var lang = currentLanguage();
    var content = generateLocationContent(location, registry, activeCards, resolvedCards);
    var sections = [
      ['Overview', content.overview],
      ['Why it matters', content.whyItMatters],
      ['Environment', content.environment],
      ['Movement', content.movement],
      ['Nearby context', content.nearbyContext],
      ['Local insights', content.localInsights],
      ['Search complexity', content.searchComplexity],
      ['How to help', content.howToHelp],
      ['Safety', content.safety]
    ];
    container.innerHTML = '';
    sections.forEach(function(section) {
      var wrapper = document.createElement('section');
      var heading = document.createElement('h3');
      var p = document.createElement('p');
      heading.textContent = section[0];
      p.textContent = translateTemplate(section[1], lang);
      wrapper.appendChild(heading);
      wrapper.appendChild(p);
      container.appendChild(wrapper);
    });
    var faqHeading = document.createElement('h3');
    faqHeading.textContent = 'Local FAQ';
    container.appendChild(faqHeading);
    content.faq.forEach(function(entry) {
      var details = document.createElement('details');
      var summary = document.createElement('summary');
      var p = document.createElement('p');
      summary.textContent = translateTemplate(entry.question, lang);
      p.textContent = translateTemplate(entry.answer, lang);
      details.appendChild(summary);
      details.appendChild(p);
      container.appendChild(details);
    });
    var links = document.createElement('div');
    links.className = 'ma-location-page__links';
    content.links.forEach(function(entry) {
      var link = document.createElement('a');
      link.href = entry.href;
      link.textContent = entry.label;
      links.appendChild(link);
    });
    container.appendChild(links);
    if (content.lastUpdated) {
      var updated = document.createElement('p');
      updated.className = 'ma-location-page__content-updated';
      updated.textContent = 'Last updated from registry data: ' + new Date(content.lastUpdated).toLocaleDateString();
      container.appendChild(updated);
    }
  }

  window.generateLocationContent = window.generateLocationContent || generateLocationContent;

  function modeMeta(mode, location) {
    var placeName = displayName(location);
    if (mode === 'alert') {
      return {
        title: 'Get missing person alerts in ' + placeName + ' | Missing Alerts',
        description: 'Sign up for local missing person alerts, nearby case updates and safe community awareness in ' + placeName + '.',
        heading: 'Get missing person alerts in ' + location.name,
        intro: 'Local alert signup, current cases, nearby areas and police-first guidance for ' + placeName + '.'
      };
    }
    if (mode === 'guide') {
      return {
        title: 'Missing person search guide for ' + placeName + ' | Missing Alerts',
        description: 'Read safe public guidance for missing person searches, transport patterns and local awareness in ' + placeName + '.',
        heading: 'Missing person search guide for ' + location.name,
        intro: 'Geography, transport movement, sharing guidance and safe ways the public can help in ' + placeName + '.'
      };
    }
    if (mode === 'region') {
      return {
        title: 'Missing people region directory for ' + placeName + ' | Missing Alerts',
        description: 'Browse regional missing person alerts, cities, towns, active cases and local alert links for ' + placeName + '.',
        heading: 'Missing people region directory: ' + location.name,
        intro: 'Regional overview, city and town links, current cases and alert options for ' + placeName + '.'
      };
    }
    if (mode === 'country') {
      return {
        title: 'Missing people country directory for ' + placeName + ' | Missing Alerts',
        description: 'Browse country-level missing person alerts, major regions, cities and active case links for ' + placeName + '.',
        heading: 'Missing people country directory: ' + location.name,
        intro: 'Country overview, major regions, cities, current cases and local alert options for ' + placeName + '.'
      };
    }
    if (mode === 'cluster') {
      return {
        title: 'Missing cases near ' + placeName + ' | Missing Alerts',
        description: 'Find nearby active missing person cases, local towns and radius-based alert links around ' + placeName + '.',
        heading: 'Missing cases near ' + location.name,
        intro: 'Nearby active cases, map context, radius-based area links and local alert options for ' + placeName + '.'
      };
    }
    if (mode === 'no-case') {
      return {
        title: 'No active missing cases currently listed in ' + placeName + ' | Missing Alerts',
        description: 'This monitored Missing Alerts area page shows local context, nearby active areas and alert signup for ' + placeName + '.',
        heading: 'No active missing cases currently listed in ' + location.name,
        intro: 'Monitoring status, nearby active areas, local context and alert signup for ' + placeName + '.'
      };
    }
    if (mode === 'near-me') {
      return {
        title: 'Missing people near me: ' + placeName + ' | Missing Alerts',
        description: 'Browse missing people near ' + placeName + ' with local map context, nearby places and alert links.',
        heading: 'Missing people near me: ' + location.name,
        intro: 'Local missing person cases, nearby towns, map context and alert options around ' + placeName + '.'
      };
    }
    if (mode === 'recent') {
      return {
        title: 'Recent missing cases in ' + placeName + ' | Missing Alerts',
        description: 'View recent missing person case activity, nearby updates and local alert options for ' + placeName + '.',
        heading: 'Recent missing cases in ' + location.name,
        intro: 'Recent activity, nearby active appeals, resolved updates and alert options for ' + placeName + '.'
      };
    }
    if (mode === 'help') {
      return {
        title: 'Help find missing people in ' + placeName + ' | Missing Alerts',
        description: 'Learn safe ways to help with missing person appeals, public sharing and local awareness in ' + placeName + '.',
        heading: 'Help find missing people in ' + location.name,
        intro: 'Safe public help, sharing guidance, current appeals and local alert options for ' + placeName + '.'
      };
    }
    return {
      title: 'Missing People in ' + placeName + ' | Live Alerts & Cases',
      description: 'View live missing person alerts, recent cases, and updates in ' + placeName + '. Stay informed and help share information.',
      heading: 'Missing People in ' + location.name,
      intro: 'Latest missing person appeals, nearby cases, resolved updates and local area information for ' + placeName + '.'
    };
  }

  function updateSeo(location, mode) {
    var seo = window.MissingAlertsLocationSeo || {};
    var eligibility = seo.indexableByPath && location.slugPath ? seo.indexableByPath[location.slugPath] : null;
    var metaCopy = modeMeta(mode || 'location', location);
    document.title = metaCopy.title;
    var meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', metaCopy.description);
    var canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', window.location.origin + modeUrl(mode || 'location', location));
    ['en', 'fr', 'de', 'es', 'it', 'ar'].forEach(function(lang) {
      var selector = 'link[rel="alternate"][hreflang="' + lang + '"][data-location-hreflang]';
      var alternate = document.querySelector(selector);
      if (!alternate) {
        alternate = document.createElement('link');
        alternate.setAttribute('rel', 'alternate');
        alternate.setAttribute('hreflang', lang);
        alternate.setAttribute('data-location-hreflang', '');
        document.head.appendChild(alternate);
      }
      var href = new URL(window.location.origin + modeUrl(mode || 'location', location));
      if (lang !== 'en') href.searchParams.set('lang', lang);
      alternate.setAttribute('href', href.toString());
    });
    var robots = document.querySelector('meta[name="robots"]');
    var isCleanLocationPath = window.location.pathname.indexOf('/missing-people/') === 0 || window.location.pathname === '/missing-people';
    var shouldNoIndex = seo.indexableByPath ? !eligibility : ['village', 'locality'].indexOf(location.type) !== -1 && (!location.approximatePopulation || Number(location.approximatePopulation) < 10000);
    if (isCleanLocationPath) shouldNoIndex = true;
    if (shouldNoIndex) {
      if (!robots) {
        robots = document.createElement('meta');
        robots.setAttribute('name', 'robots');
        document.head.appendChild(robots);
      }
      robots.setAttribute('content', 'noindex,follow');
    } else if (robots && robots.getAttribute('content') === 'noindex,follow') {
      robots.remove();
    }
  }

  function bindSearch(root) {
    var input = root.querySelector('[data-location-search-input]');
    if (!input) return;
    input.addEventListener('input', function() {
      var query = normalize(input.value);
      root.querySelectorAll('[data-location-link]').forEach(function(link) {
        var haystack = normalize(link.getAttribute('data-location-search-value') || link.textContent);
        link.hidden = query && haystack.indexOf(query) === -1;
      });
    });
  }

  function bindLanguage(root) {
    var lang = currentLanguage();
    root.querySelectorAll('[data-location-language]').forEach(function(link) {
      var target = link.getAttribute('data-location-language') || 'en';
      var next = new URL(window.location.href);
      if (target === 'en') next.searchParams.delete('lang');
      else next.searchParams.set('lang', target);
      link.href = next.pathname + next.search;
      link.classList.toggle('is-active', target === lang);
      link.setAttribute('aria-current', target === lang ? 'true' : 'false');
    });
  }

  function normalizeLegacyLocationMarkup(root) {
    var heroActions = root.querySelector('.ma-location-page__hero-actions');
    if (heroActions && !heroActions.querySelector('[data-location-follow-button]')) {
      heroActions.innerHTML = '';
      var followButton = document.createElement('button');
      followButton.className = 'ma-location-page__cta ma-location-page__cta--button';
      followButton.type = 'button';
      followButton.setAttribute('data-location-follow-button', '');
      followButton.textContent = 'Follow this area for updates';
      heroActions.appendChild(followButton);

      var shareButton = document.createElement('button');
      shareButton.className = 'ma-location-page__cta ma-location-page__cta--button';
      shareButton.type = 'button';
      shareButton.setAttribute('data-location-share-button', '');
      shareButton.textContent = 'Share This Page';
      heroActions.appendChild(shareButton);
    }

    root.querySelectorAll('[data-location-follow-cta]').forEach(function(link) {
      link.textContent = 'Follow this area for updates';
      link.setAttribute('data-location-follow-button', '');
      link.setAttribute('role', 'button');
    });

    [
      {
        id: 'LocationAlertSignupForm',
        message: 'Sign in to follow this area and receive updates.'
      },
      {
        id: 'LocationUniversalAlertSignupForm',
        message: 'Follow intent is saved for members now. Klaviyo notifications will be connected later.'
      }
    ].forEach(function(config) {
      var form = root.querySelector('#' + config.id);
      if (!form) return;
      var hasLegacyEmail = form.querySelector('[id^="' + config.id.replace('Form', 'Email') + '"], input[name="contact[email]"]');
      if (!hasLegacyEmail && form.getAttribute('data-location-follow-placeholder') === 'true') return;

      var replacement = document.createElement('div');
      replacement.id = config.id;
      replacement.className = 'ma-location-page__signup-form ma-location-page__follow-placeholder';
      replacement.setAttribute('data-location-follow-placeholder', 'true');
      replacement.innerHTML =
        '<button class="ma-location-page__cta ma-location-page__cta--button" type="button" data-location-follow-button>Follow this area for updates</button>' +
        '<p class="ma-location-page__form-message" data-location-follow-status>' + escapeHtml(config.message) + '</p>';
      form.replaceWith(replacement);
    });
  }

  function bindLocationShare(root, location, mode) {
    var pageUrl = window.location.origin + modeUrl(mode || 'location', location);
    var shareTitle = 'Missing People in ' + displayName(location);
    var shareText = shareTitle + ' - live alerts, nearby areas, and how to help.';
    var customerId = root.getAttribute('data-customer-id') || '';
    var locationSlug = location.slugPath || location.slug || '';
    var whatsapp = root.querySelector('[data-location-whatsapp-share]');
    var facebook = root.querySelector('[data-location-facebook-share]');
    var xShare = root.querySelector('[data-location-x-share]');
    var status = root.querySelector('[data-location-share-status]');
    var shareCount = root.querySelector('[data-location-share-count]');
    var shareKey = 'MissingAlertsLocationShares:' + pageUrl;
    var trendKey = 'MissingAlertsLocationEngagement';
    var localShares = 0;
    var currentLocationSummary = {
      id: location.id || '',
      name: displayName(location),
      slug: locationSlug,
      url: pageUrl
    };
    function track(eventName, details) {
      var payload = Object.assign({
        event: eventName,
        location_id: location.id || '',
        location_name: displayName(location),
        location_slug: locationSlug,
        user_id: customerId,
        location_url: pageUrl
      }, details || {});
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(payload);
      if (typeof window.gtag === 'function') {
        window.gtag('event', eventName, payload);
      }
    }
    try {
      localShares = Number(window.localStorage.getItem(shareKey) || 0);
    } catch (error) {}
    function readTrendEntries() {
      try {
        var parsed = JSON.parse(window.localStorage.getItem(trendKey) || '[]');
        return Array.isArray(parsed) ? parsed : [];
      } catch (error) {
        return [];
      }
    }
    function writeTrendEntries(entries) {
      try {
        window.localStorage.setItem(trendKey, JSON.stringify(entries.slice(0, 100)));
      } catch (error) {}
    }
    function renderTrendList(selector, emptySelector, metric) {
      var entries = readTrendEntries()
        .filter(function(entry) { return entry && entry.url && entry.name && Number(entry[metric] || 0) > 0; })
        .sort(function(a, b) { return Number(b[metric] || 0) - Number(a[metric] || 0); })
        .slice(0, 8);
      root.querySelectorAll(selector).forEach(function(container) {
        container.innerHTML = '';
        entries.forEach(function(entry) {
          var link = document.createElement('a');
          link.href = entry.url;
          link.textContent = entry.name;
          container.appendChild(link);
        });
      });
      root.querySelectorAll(emptySelector).forEach(function(node) {
        node.hidden = entries.length > 0;
      });
    }
    function renderTrendLists() {
      renderTrendList('[data-location-trending-views]', '[data-location-trending-views-empty]', 'views');
      renderTrendList('[data-location-trending-shares]', '[data-location-trending-shares-empty]', 'shares');
    }
    function bumpTrend(metric) {
      var entries = readTrendEntries();
      var existing = entries.find(function(entry) {
        return entry && entry.url === pageUrl;
      });
      if (!existing) {
        existing = Object.assign({ views: 0, shares: 0, follows: 0, updatedAt: '' }, currentLocationSummary);
        entries.unshift(existing);
      }
      existing[metric] = Number(existing[metric] || 0) + 1;
      existing.updatedAt = new Date().toISOString();
      writeTrendEntries(entries.sort(function(a, b) {
        return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
      }));
      renderTrendLists();
    }
    function updateLocalShareCount() {
      if (!shareCount) return;
      shareCount.textContent = localShares > 0 ? 'Shares on this browser: ' + localShares : 'Shares tracked on this browser after sharing.';
    }
    function recordShare() {
      localShares += 1;
      try {
        window.localStorage.setItem(shareKey, String(localShares));
      } catch (error) {}
      updateLocalShareCount();
      track('missing_alerts_location_share');
      bumpTrend('shares');
    }
    updateLocalShareCount();
    if (whatsapp) {
      whatsapp.href = 'https://wa.me/?text=' + encodeURIComponent(shareText + ' ' + pageUrl);
      whatsapp.addEventListener('click', recordShare);
    }
    if (facebook) {
      facebook.href = 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(pageUrl);
      facebook.addEventListener('click', recordShare);
    }
    if (xShare) {
      xShare.href = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(shareText) + '&url=' + encodeURIComponent(pageUrl);
      xShare.addEventListener('click', recordShare);
    }

    root.querySelectorAll('[data-location-share-button]').forEach(function(button) {
      button.addEventListener('click', function() {
        if (navigator.share) {
          navigator.share({ title: shareTitle, text: shareText, url: pageUrl }).then(recordShare).catch(function() {});
          return;
        }
        if (navigator.clipboard) {
          navigator.clipboard.writeText(pageUrl).then(function() {
            recordShare();
            if (status) status.textContent = 'Link copied.';
          }).catch(function() {});
        }
      });
    });

    root.querySelectorAll('[data-location-copy-link]').forEach(function(button) {
      button.addEventListener('click', function() {
        if (!navigator.clipboard) return;
        navigator.clipboard.writeText(pageUrl).then(function() {
          recordShare();
          if (status) status.textContent = 'Link copied.';
        }).catch(function() {});
      });
    });

    var followKey = customerId ? 'MissingAlertsFollowedLocations:' + customerId : 'MissingAlertsFollowedLocations:guest';
    var recentKey = 'MissingAlertsRecentlyViewedLocations';
    function readFollowedLocations() {
      try {
        var parsed = JSON.parse(window.localStorage.getItem(followKey) || '[]');
        return Array.isArray(parsed) ? parsed : [];
      } catch (error) {
        return [];
      }
    }
    function readRecentLocations() {
      try {
        var parsed = JSON.parse(window.localStorage.getItem(recentKey) || '[]');
        return Array.isArray(parsed) ? parsed : [];
      } catch (error) {
        return [];
      }
    }
    function writeFollowedLocations(locations) {
      try {
        window.localStorage.setItem(followKey, JSON.stringify(locations.slice(0, 100)));
        return true;
      } catch (error) {
        return false;
      }
    }
    function writeRecentLocations(locations) {
      try {
        window.localStorage.setItem(recentKey, JSON.stringify(locations.slice(0, 12)));
        return true;
      } catch (error) {
        return false;
      }
    }
    function isFollowingLocation(locations) {
      return locations.some(function(entry) {
        return entry && entry.url === pageUrl;
      });
    }
    function renderStoredLinks(selector, emptySelector, entries) {
      var containers = root.querySelectorAll(selector);
      var emptyNodes = root.querySelectorAll(emptySelector);
      containers.forEach(function(container) {
        container.innerHTML = '';
        entries.slice(0, 8).forEach(function(entry) {
          if (!entry || !entry.url || !entry.name) return;
          var link = document.createElement('a');
          link.href = entry.url;
          link.textContent = entry.name;
          container.appendChild(link);
        });
      });
      emptyNodes.forEach(function(node) {
        node.hidden = entries.length > 0;
      });
    }
    function renderRetentionLists() {
      renderStoredLinks('[data-location-followed-list]', '[data-location-followed-empty]', readFollowedLocations());
      renderStoredLinks('[data-location-recent-list]', '[data-location-recent-empty]', readRecentLocations());
    }
    function rememberRecentLocation() {
      var current = {
        id: location.id || '',
        name: displayName(location),
        url: pageUrl,
        viewedAt: new Date().toISOString()
      };
      var next = [current].concat(readRecentLocations().filter(function(entry) {
        return entry && entry.url !== pageUrl;
      }));
      writeRecentLocations(next);
    }
    function updateFollowState() {
      var locations = readFollowedLocations();
      var following = customerId && isFollowingLocation(locations);
      root.querySelectorAll('[data-location-follow-button]').forEach(function(button) {
        button.textContent = following ? 'Following this area' : 'Follow this area for updates';
        button.setAttribute('aria-pressed', following ? 'true' : 'false');
        button.classList.toggle('is-following', following);
      });
      root.querySelectorAll('[data-location-follow-status]').forEach(function(node) {
        if (!customerId) {
          node.textContent = 'Sign in to follow this area and receive updates.';
          return;
        }
        node.textContent = following
          ? "You're now following updates for " + displayName(location) + '.'
          : 'Follow intent will be saved to this member session. Klaviyo integration is pending.';
      });
      root.querySelectorAll('[data-location-follow-suggestions]').forEach(function(node) {
        node.hidden = !following;
      });
      renderRetentionLists();
    }
    root.querySelectorAll('[data-location-follow-button]').forEach(function(button) {
      button.addEventListener('click', function() {
        var notifyPayload = {
          id: location.id || '',
          name: displayName(location),
          slug: locationSlug,
          url: pageUrl,
          userId: customerId
        };
        window.missingAlertsNotify(notifyPayload);
        track('missing_alerts_location_follow_click', { logged_in: Boolean(customerId) });
        if (!customerId) {
          updateFollowState();
          return;
        }
        var locations = readFollowedLocations();
        var following = isFollowingLocation(locations);
        var next = following ? locations.filter(function(entry) {
          return entry && entry.url !== pageUrl;
        }) : [{
          id: location.id || '',
          name: displayName(location),
          slug: locationSlug,
          url: pageUrl,
          userId: customerId,
          followedAt: new Date().toISOString()
        }].concat(locations);
        if (writeFollowedLocations(next)) {
          track(following ? 'missing_alerts_location_unfollow' : 'missing_alerts_location_follow');
          if (!following) bumpTrend('follows');
          updateFollowState();
        }
      });
    });
    rememberRecentLocation();
    bumpTrend('views');
    updateFollowState();
  }

  function loadRequestedRegistry(registry, request) {
    if (registry && typeof registry.loadChunk === 'function') {
      return registry.loadChunk('core').then(function() {
        if (request.countrySlug) {
          var country = (registry.entries || []).find(function(entry) {
            return entry.type === 'country' && entry.slug === request.countrySlug;
          });
          if (country) request.country = country.countryCode;
        }
        if (typeof registry.loadCountry === 'function') return registry.loadCountry(request.country);
        return registry;
      }).then(function() {
        return registry;
      }).catch(function() {
        return registry;
      });
    }
    return Promise.resolve(registry);
  }

  async function init(root) {
    var registry = window.MissingAlertsLocationRegistry;
    var request = params();
    if (!registry) {
      showDebug(root, request, null, null, 0, 0, false);
      return;
    }
    registry = await loadRequestedRegistry(registry, request);
    var location = findLocation(registry, request);
    var locationFound = hasExactLocation(registry, request);
    if (!location) {
      showDebug(root, request, registry, null, 0, 0, false);
      return;
    }

    root.setAttribute('data-location-country', location.countryCode);
    root.setAttribute('data-location-id', location.id);
    setText(root, '[data-location-name]', location.name);
    setText(root, '[data-location-country-name]', location.countryName);
    setText(root, '[data-location-type]', location.type.replace('-', ' '));
    var metaCopy = modeMeta(request.pageMode, location);
    root.setAttribute('data-location-page-mode', request.pageMode);
    setText(root, '[data-location-heading]', metaCopy.heading);
    setText(root, '[data-location-intro]', 'Live alerts, nearby areas, and how to help');
    setText(root, '[data-location-search-intent]', 'Looking for missing people in ' + displayName(location) + '? This page shows alerts, nearby areas, and guidance on how to help.');
    setText(root, '[data-location-answer-current]', 'This page shows current alerts, nearby areas, and guidance on how to help in ' + displayName(location) + '.');
    setText(root, '[data-location-answer-alerts]', 'Latest missing person alerts appear here when verified public appeals match ' + displayName(location) + ' or surrounding areas.');
    setText(root, '[data-location-answer-report]', 'Always contact local police or emergency services first. Missing Alerts helps with responsible public awareness after official reporting.');
    setText(root, '[data-location-description]', location.description);
    setText(root, '[data-location-reporting]', location.emergencyReportingText);
    setText(root, '[data-location-population]', location.approximatePopulation ? Number(location.approximatePopulation).toLocaleString() : 'Not listed');
    setText(root, '[data-location-coordinates]', location.latitude && location.longitude ? Number(location.latitude).toFixed(4) + ', ' + Number(location.longitude).toFixed(4) : 'Not listed');
    setText(root, '[data-location-last-updated]', new Date(registry.generatedAt || Date.now()).toLocaleDateString());
    setText(root, '[data-location-parent]', location.parentName || location.countryName);
    setText(root, '[data-location-registry-count]', String((registry.byCountry[location.countryCode] || []).length));
    var admin1 = parentOfType(registry, location, ['state', 'province', 'region']);
    var admin2 = parentOfType(registry, location, ['county', 'district', 'local-authority', 'municipality']);
    setText(root, '[data-location-admin1]', admin1 ? admin1.name : (['state', 'province', 'region'].indexOf(location.type) !== -1 ? location.name : 'Not listed'));
    setText(root, '[data-location-admin2]', admin2 ? admin2.name : (['county', 'district', 'local-authority', 'municipality'].indexOf(location.type) !== -1 ? location.name : 'Not listed'));
    setText(root, '[data-location-seo-copy]', 'This location hub uses verified Missing Alerts case fields and the location registry to organise active appeals, resolved updates, parent areas, child areas and nearby locations for ' + displayName(location) + '.');

    renderBreadcrumb(root, registry, location);

    updateSeo(location, request.pageMode);
    renderGroupedLinks(root, registry, location);
    renderLinksAll(root, '[data-location-follow-parent-links]', fillToMinimum(ancestors(registry, location), [countryEntry(registry, location)].filter(Boolean), location.id, 2), 6);
    renderLinksAll(root, '[data-location-follow-country-links]', fillToMinimum((registry.byCountry[location.countryCode] || []).filter(function(entry) {
      return entry.type === 'city' || entry.type === 'town' || entry.type === 'region' || entry.type === 'state' || entry.type === 'province';
    }), [countryEntry(registry, location)].filter(Boolean), location.id, 5), 8);
    renderRelatedPageTypes(root, registry, location);
    renderPriorityLocations(root, registry, location);

    var activeCards = [];
    var groups = {
      exactLocation: [],
      sameCity: [],
      sameAdmin2: [],
      sameAdmin1: [],
      nearbyByCoordinates: []
    };
    var excludedCount = 0;
    root.querySelectorAll('[data-location-case-results] [data-case-card]').forEach(function(card) {
      if (!statusIsMissing(card)) excludedCount += 1;
      var tier = statusIsMissing(card) ? caseMatchTier(card, location, registry) : '';
      var visible = Boolean(tier);
      card.hidden = !visible;
      if (visible) {
        activeCards.push(card);
        groups[tier || 'nearbyByCoordinates'].push(card);
      }
    });

    var groupRoot = root.querySelector('[data-location-case-groups]');
    if (groupRoot) {
      var anyGrouped = activeCards.length > 0;
      groupRoot.hidden = !anyGrouped;
      ['exactLocation', 'sameCity', 'sameAdmin2', 'sameAdmin1', 'nearbyByCoordinates'].forEach(function(key) {
        var target = groupRoot.querySelector('[data-location-group="' + key + '"]');
        if (!target) return;
        target.innerHTML = '';
        groups[key].forEach(function(card) {
          target.appendChild(card);
        });
        if (target.parentElement) target.parentElement.hidden = groups[key].length === 0;
      });
    }

    var resolvedCards = [];
    root.querySelectorAll('[data-location-resolved-results] [data-case-card]').forEach(function(card) {
      var visible = caseMatchesLocation(card, location, registry, true);
      card.hidden = !visible;
      if (visible) resolvedCards.push(card);
    });
    var resolvedSection = root.querySelector('[data-location-resolved-section]');
    if (resolvedSection) resolvedSection.hidden = resolvedCards.length === 0;

    setText(root, '[data-location-case-count]', String(activeCards.length));
    setText(root, '[data-location-exact-count]', String(groups.exactLocation.length));
    setText(root, '[data-location-nearby-active-count]', String(groups.sameCity.length + groups.sameAdmin2.length + groups.sameAdmin1.length + groups.nearbyByCoordinates.length));
    setText(root, '[data-location-resolved-count]', String(resolvedCards.length));
    setText(root, '[data-location-last-updated]', hoursSinceLatest(activeCards.concat(resolvedCards), registry.generatedAt));
    setText(root, '[data-location-activity-indicator]', activeCards.length ? 'Recent activity: ' + activeCards.length + ' active verified appeal' + (activeCards.length === 1 ? '' : 's') + ' visible for this area.' : 'Monitoring active; nearby areas may have current alerts.');
    setText(root, '[data-location-follow-count]', 'Follow this area for updates about missing people in ' + displayName(location) + '.');
    var freshness = root.querySelector('[data-location-freshness]');
    if (freshness) {
      freshness.textContent = 'Updated: ' + new Date().toISOString();
    }
    var empty = root.querySelector('[data-location-empty]');
    if (empty) {
      empty.textContent = 'This area is monitored. Nearby areas may have active alerts.';
      empty.hidden = activeCards.length > 0;
    }
    updateMap(root, registry, location, activeCards);
    renderActivity(root, location, activeCards, resolvedCards);
    renderCaseSummary(root.querySelector('[data-location-nearby-case-list]'), activeCards.filter(function(card) {
      return groups.nearbyByCoordinates.indexOf(card) !== -1 || groups.sameCity.indexOf(card) !== -1 || groups.sameAdmin2.indexOf(card) !== -1 || groups.sameAdmin1.indexOf(card) !== -1;
    }), 8);
    var nearbyCaseEmpty = root.querySelector('[data-location-nearby-case-empty]');
    if (nearbyCaseEmpty) nearbyCaseEmpty.hidden = activeCards.length > groups.exactLocation.length;
    renderConnectedAreas(root, registry, location, activeCards);
    renderMapPins(root, location, activeCards, resolvedCards);
    renderLocationContent(root, registry, location, activeCards, resolvedCards);
    updateJsonLd(root, location, activeCards, request.pageMode);
    showDebug(root, request, registry, location, activeCards.length, excludedCount, locationFound);
    normalizeLegacyLocationMarkup(root);
    bindSearch(root);
    bindLanguage(root);
    bindLocationShare(root, location, request.pageMode);
  }

  function renderBreadcrumb(root, registry, location) {
    var nav = root.querySelector('[data-location-breadcrumb]');
    if (!nav) return;
    nav.innerHTML = '';
    var home = document.createElement('a');
    home.href = '/';
    home.textContent = 'Home';
    nav.appendChild(home);
    ancestors(registry, location).concat([location]).forEach(function(entry) {
      var separator = document.createElement('span');
      separator.textContent = '/';
      nav.appendChild(separator);
      if (entry.id === location.id) {
        var current = document.createElement('a');
        current.href = urlFor(entry);
        current.setAttribute('aria-current', 'page');
        current.textContent = entry.name;
        nav.appendChild(current);
      } else {
        var link = document.createElement('a');
        link.href = urlFor(entry);
        link.textContent = entry.name;
        nav.appendChild(link);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('[data-missing-alerts-location-page]').forEach(init);
    document.querySelectorAll('[data-location-country-browse]').forEach(function(root) {
      var registry = window.MissingAlertsLocationRegistry;
      if (!registry) return;

      function currentCountry() {
        if (window.MissingAlertsCountryMode && window.MissingAlertsCountryMode.getCountry) {
          return countryAlias(window.MissingAlertsCountryMode.getCountry());
        }
        return countryAlias(document.documentElement.getAttribute('data-country') || 'gb');
      }

      async function render() {
        var country = currentCountry();
        if (!country || country === 'global') country = 'gb';
        if (typeof registry.loadCountry === 'function') {
          try {
            await registry.loadCountry(country);
          } catch (error) {}
        }
        var entries = (registry.byCountry[country] || []).filter(function(entry) {
          return entry.type !== 'country' && entry.type !== 'nation';
        });
        var countryEntry = registry.byId[country];
        setText(root, '[data-location-browse-country]', countryEntry ? countryEntry.name : country.toUpperCase());
        renderLinks(root.querySelector('[data-location-browse-regions]'), entries.filter(function(entry) {
          return entry.level === 1 || entry.type === 'state' || entry.type === 'province' || entry.type === 'region' || entry.type === 'nation';
        }));
        renderLinks(root.querySelector('[data-location-browse-counties]'), entries.filter(function(entry) {
          return entry.type === 'county' || entry.type === 'district' || entry.type === 'local-authority' || entry.type === 'borough' || entry.type === 'municipality' || entry.type === 'parish';
        }));
        renderLinks(root.querySelector('[data-location-browse-cities]'), entries.filter(function(entry) {
          return entry.type === 'city' || entry.type === 'town';
        }));
      }

      render();
      bindSearch(root);
      document.addEventListener('country-mode:change', render);
      if (window.MutationObserver) {
        new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ['data-country'] });
      }
    });
  });
})();
