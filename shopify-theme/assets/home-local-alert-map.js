(function() {
  var LOG_ENABLED = window.MISSING_ALERTS_DIAGNOSTICS === true;
  var apiBase = String(window.MISSING_ALERTS_API_BASE || '').trim().replace(/\/+$/, '');

  var countryAliases = {
    gb: ['gb', 'uk', 'united kingdom', 'great britain', 'britain', 'england', 'scotland', 'wales', 'northern ireland'],
    us: ['us', 'usa', 'u.s.', 'u.s.a.', 'united states', 'united states of america', 'america'],
    ca: ['ca', 'canada'],
    au: ['au', 'australia']
  };

  var countryCenters = {
    global: { label: 'Global', lat: 20, lng: 0, zoom: 2 },
    gb: { label: 'United Kingdom', lat: 54.5, lng: -3.2, zoom: 5 },
    us: { label: 'United States', lat: 39.8, lng: -98.6, zoom: 4 },
    ca: { label: 'Canada', lat: 56.1, lng: -106.3, zoom: 4 },
    au: { label: 'Australia', lat: -25.3, lng: 133.8, zoom: 4 },
    ie: { label: 'Ireland', lat: 53.4, lng: -8.2, zoom: 6 },
    nz: { label: 'New Zealand', lat: -41.3, lng: 174.8, zoom: 5 },
    de: { label: 'Germany', lat: 51.2, lng: 10.4, zoom: 5 },
    fr: { label: 'France', lat: 46.2, lng: 2.2, zoom: 5 },
    es: { label: 'Spain', lat: 40.4, lng: -3.7, zoom: 5 },
    it: { label: 'Italy', lat: 42.8, lng: 12.5, zoom: 5 },
    nl: { label: 'Netherlands', lat: 52.1, lng: 5.3, zoom: 7 },
    be: { label: 'Belgium', lat: 50.5, lng: 4.5, zoom: 7 },
    se: { label: 'Sweden', lat: 60.1, lng: 18.6, zoom: 4 },
    no: { label: 'Norway', lat: 60.5, lng: 8.5, zoom: 4 },
    dk: { label: 'Denmark', lat: 56.2, lng: 10.0, zoom: 6 },
    fi: { label: 'Finland', lat: 61.9, lng: 25.7, zoom: 5 },
    pt: { label: 'Portugal', lat: 39.4, lng: -8.2, zoom: 6 },
    jp: { label: 'Japan', lat: 36.2, lng: 138.3, zoom: 5 },
    kr: { label: 'South Korea', lat: 36.5, lng: 127.8, zoom: 6 },
    in: { label: 'India', lat: 20.6, lng: 78.9, zoom: 4 },
    br: { label: 'Brazil', lat: -14.2, lng: -51.9, zoom: 4 },
    mx: { label: 'Mexico', lat: 23.6, lng: -102.5, zoom: 5 },
    za: { label: 'South Africa', lat: -30.6, lng: 22.9, zoom: 5 },
    sg: { label: 'Singapore', lat: 1.35, lng: 103.82, zoom: 11 },
    ae: { label: 'UAE', lat: 24.4, lng: 54.4, zoom: 7 }
  };

  function log() {
    if (LOG_ENABLED && window.console) console.log.apply(console, arguments);
  }

  function slug(value) {
    return String(value || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function readJson(root, selector, fallback) {
    var node = root.querySelector(selector);
    if (!node) return fallback;
    try {
      return JSON.parse(node.textContent || '');
    } catch (error) {
      log('[local-alert-map] JSON parse failed', error);
      return fallback;
    }
  }

  function readCountryConfig() {
    var node = document.getElementById('missing-alerts-country-mode-config');
    if (!node) return {};
    try {
      return JSON.parse(node.textContent || '{}').countries || {};
    } catch (error) {
      return {};
    }
  }

  function normalizeCountry(value) {
    var raw = String(value || '').trim();
    if (!raw) return '';
    var low = raw.toLowerCase();
    var clean = slug(raw);
    Object.keys(countryAliases).forEach(function(code) {
      if (countryAliases[code].indexOf(low) !== -1 || countryAliases[code].indexOf(clean) !== -1) raw = code;
    });
    if (countryCenters[raw.toLowerCase()]) return raw.toLowerCase();
    var countries = readCountryConfig();
    var found = '';
    Object.keys(countries).forEach(function(code) {
      var country = countries[code] || {};
      if (found || code === 'global') return;
      if (low === code || clean === slug(country.label || '') || low === String(country.label || '').toLowerCase()) found = code;
    });
    return found || clean;
  }

  function isResolvedCase(item) {
    var haystack = [
      item.title,
      item.excerpt,
      item.case_status,
      item.status,
      Array.isArray(item.tags) ? item.tags.join(' ') : ''
    ].join(' ').toLowerCase();
    return /found[\s-]?safe|resolved|located|returned|closed/.test(haystack);
  }

  function caseCountry(item) {
    var direct = normalizeCountry(item.countryCode || item.country);
    if (direct) return direct;
    var text = [item.title, item.excerpt, item.location, Array.isArray(item.tags) ? item.tags.join(' ') : ''].join(' ');
    var match = text.match(/country\s*:\s*([a-zA-Z -]+)/i);
    return match ? normalizeCountry(match[1]) : '';
  }

  function numberOrNull(value) {
    var n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function distanceKm(aLat, aLng, bLat, bLng) {
    var radius = 6371;
    var dLat = (bLat - aLat) * Math.PI / 180;
    var dLng = (bLng - aLng) * Math.PI / 180;
    var lat1 = aLat * Math.PI / 180;
    var lat2 = bLat * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function markerHtml(color, label) {
    return '<span class="ma-map-pin ma-map-pin--' + color + '" aria-label="' + label + '"></span>';
  }

  function makeIcon(color, label) {
    return L.divIcon({
      className: 'ma-local-alert-map__marker',
      html: markerHtml(color, label),
      iconSize: [26, 34],
      iconAnchor: [13, 30],
      popupAnchor: [0, -28]
    });
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, function(char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
    });
  }

  function fallbackPoint(countryCode, index) {
    var center = countryCenters[countryCode] || { lat: 20, lng: 0 };
    var ring = 0.8 + (index % 6) * 0.22;
    var angle = (index * 137.5) * Math.PI / 180;
    return {
      lat: center.lat + Math.sin(angle) * ring,
      lng: center.lng + Math.cos(angle) * ring
    };
  }

  function locationLabel(member) {
    return [
      member.location_city || member.city,
      member.location_county,
      member.location_region || member.region,
      member.location_country_name || member.country
    ].filter(Boolean).join(', ');
  }

  function scopeLabel(scope) {
    if (scope === 'nearby') return 'Nearby active cases';
    if (scope === 'same-country') return 'Same-country active cases';
    if (scope === 'global') return 'Global active cases';
    return 'Active cases';
  }

  function panelHtml(message, actions, cases, savedLocation, scope) {
    var html = '';
    if (savedLocation) {
      html += '<div class="ma-local-alert-map__saved"><span>Saved alert area</span><strong>' + escapeHtml(savedLocation) + '</strong></div>';
    }
    if (scope) {
      html += '<div class="ma-local-alert-map__scope">' + escapeHtml(scopeLabel(scope)) + '</div>';
    }
    html += '<div class="ma-local-alert-map__state">' + message + '</div>';
    if (actions) html += actions;
    if (cases && cases.length) {
      html += '<div class="ma-local-alert-map__case-list">';
      cases.slice(0, 8).forEach(function(item) {
        html += '<article class="ma-local-alert-map__case">';
        if (item.image) {
          html += '<img src="' + escapeHtml(item.image) + '" alt="">';
        } else {
          html += '<span class="ma-local-alert-map__case-image"></span>';
        }
        html += '<div><h3>' + escapeHtml(item.title || 'Missing person case') + '</h3>';
        html += '<p>' + escapeHtml(item.location || item.city || item.region || item.country || 'Location details in case') + '</p>';
        html += '<a href="' + escapeHtml(item.url || '/blogs/missing-persons') + '">VIEW CASE</a></div></article>';
      });
      html += '</div>';
    }
    return html;
  }

  function popupHtml(item, center) {
    var location = item.location || item.city || item.region || (center && center.label) || 'Location details in case';
    var image = item.image
      ? '<img class="ma-local-alert-map__popup-image" src="' + escapeHtml(item.image) + '" alt="">'
      : '<span class="ma-local-alert-map__popup-image ma-local-alert-map__popup-image--empty"></span>';
    return '<div class="ma-local-alert-map__popup">' +
      image +
      '<h3>' + escapeHtml(item.title || 'Missing person case') + '</h3>' +
      '<p>' + escapeHtml(location) + '</p>' +
      '<a href="' + escapeHtml(item.url || '/blogs/missing-persons') + '">VIEW CASE</a>' +
      '</div>';
  }

  function setupActions(type) {
    if (type === 'logged-out') {
      return '<div class="ma-local-alert-map__actions"><a class="ma-local-alert-map__button" href="/account/register">JOIN FREE</a><a class="ma-local-alert-map__button ma-local-alert-map__button--secondary" href="/account/login">LOG IN</a></div>';
    }
    return '<div class="ma-local-alert-map__actions"><a class="ma-local-alert-map__button" href="/pages/member-area">MEMBER AREA</a><a class="ma-local-alert-map__button ma-local-alert-map__button--secondary" href="/pages/professional-area">PROFESSIONAL AREA</a></div>';
  }

  function normalizeLiveCase(item) {
    var image = '';
    if (typeof item.image === 'string') image = item.image;
    else if (item.image && item.image.url) image = item.image.url;
    return {
      title: item.title || item.person_name || 'Missing person case',
      url: item.onlineStoreUrl || item.url || (item.handle ? '/blogs/missing-persons/' + item.handle : '/blogs/missing-persons'),
      image: image,
      country: item.country || item.location_country_name || '',
      countryCode: item.countryCode || item.country_code || item.location_country_code || '',
      region: item.region || item.state_region || item.location_region || '',
      city: item.city || item.city_town || item.location_city || '',
      location: item.location || item.last_seen_area || item.city_town || item.state_region || item.country || '',
      lat: item.lat || item.location_lat || item.last_seen_lat || '',
      lng: item.lng || item.location_lng || item.last_seen_lng || '',
      tags: item.tags || [],
      excerpt: item.excerpt || item.body || '',
      status: item.status || item.case_status || '',
      case_status: item.case_status || item.status || ''
    };
  }

  async function loadLiveCases(inlineCases) {
    if (!apiBase) return (inlineCases || []).map(normalizeLiveCase);
    try {
      var response = await fetch(apiBase + '/api/live-cases', { credentials: 'omit', headers: { Accept: 'application/json' } });
      var data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Live cases unavailable');
      var inlineByUrl = {};
      (inlineCases || []).forEach(function(item) {
        if (item.url) inlineByUrl[item.url] = item;
      });
      return (data.liveCases || []).map(function(item) {
        var normalized = normalizeLiveCase(item);
        var inline = inlineByUrl[normalized.url] || inlineByUrl['/blogs/missing-persons/' + (item.handle || '')] || {};
        return Object.assign({}, normalized, {
          lat: normalized.lat || inline.lat || '',
          lng: normalized.lng || inline.lng || '',
          countryCode: normalized.countryCode || inline.countryCode || '',
          country: normalized.country || inline.country || '',
          region: normalized.region || inline.region || '',
          city: normalized.city || inline.city || '',
          location: normalized.location || inline.location || '',
          image: normalized.image || inline.image || ''
        });
      });
    } catch (error) {
      log('[local-alert-map] live cases load failed', error);
      return (inlineCases || []).map(normalizeLiveCase);
    }
  }

  async function loadFreshMember(root, member) {
    var id = root.getAttribute('data-customer-id') || '';
    var email = root.getAttribute('data-customer-email') || '';
    if (!apiBase || !id || !email) return member;
    try {
      var response = await fetch(apiBase + '/api/member-location/me?customer_id=' + encodeURIComponent(id) + '&customer_email=' + encodeURIComponent(email), { credentials: 'omit' });
      if (response.status === 401 || response.status === 404) return member;
      var data = await response.json();
      if (response.ok && data.ok && data.location) return Object.assign({}, member, data.location);
    } catch (error) {
      log('[local-alert-map] member load failed', error);
    }
    return member;
  }

  async function init(root) {
    var canvas = root.querySelector('[data-local-alert-map-canvas]');
    var panel = root.querySelector('[data-local-alert-map-panel]');
    var member = readJson(root, '[data-local-alert-member]', {});
    var cases = await loadLiveCases(readJson(root, '[data-local-alert-cases]', []));
    var loggedIn = root.getAttribute('data-logged-in') === 'true' || member.loggedIn === true;
    var isMemberMap = root.getAttribute('data-local-alert-map-context') === 'member';

    if (!canvas || !panel) return;
    if (root.__missingAlertsMap && typeof root.__missingAlertsMap.remove === 'function') {
      root.__missingAlertsMap.remove();
      root.__missingAlertsMap = null;
    }

    member = loggedIn ? await loadFreshMember(root, member) : member;
    var userLat = numberOrNull(member.location_lat || member.lat);
    var userLng = numberOrNull(member.location_lng || member.lng);
    var hasSavedCoordinates = userLat !== null && userLng !== null;
    var memberCountry = normalizeCountry(member.location_country_code || member.country);
    var storedCountry = (function() {
        try {
          return window.localStorage.getItem('missingAlertsCountry') || '';
        } catch (error) {
          return '';
        }
      })();
    var pageCountry = document.documentElement.getAttribute('data-country') || '';
    var selectedCountry = normalizeCountry(pageCountry && pageCountry !== 'global' ? pageCountry : storedCountry);
    var mapCountry = isMemberMap ? memberCountry || selectedCountry || 'global' : selectedCountry || 'global';

    if (!window.L) {
      canvas.hidden = true;
      panel.innerHTML = panelHtml('Map assets could not be loaded. Active cases are still listed below.', '', [], locationLabel(member), '');
      return;
    }

    var center = countryCenters[mapCountry] || countryCenters.global;
    var activeCases = cases.filter(function(item) {
      if (isResolvedCase(item)) return false;
      return true;
    });
    var sameCountryCases = activeCases.filter(function(item) {
      if (mapCountry === 'global') return true;
      return caseCountry(item) === mapCountry;
    });
    var nearbyCases = [];
    if (hasSavedCoordinates) {
      nearbyCases = sameCountryCases.filter(function(item) {
        var lat = numberOrNull(item.lat);
        var lng = numberOrNull(item.lng);
        return lat !== null && lng !== null && distanceKm(userLat, userLng, lat, lng) <= 100;
      });
    }
    var displayCases = nearbyCases.length ? nearbyCases : sameCountryCases.length ? sameCountryCases : activeCases;
    var displayScope = nearbyCases.length ? 'nearby' : sameCountryCases.length ? 'same-country' : activeCases.length ? 'global' : '';
    var displayCountry = sameCountryCases.length ? mapCountry : 'global';

    var mapCenter = hasSavedCoordinates ? { lat: userLat, lng: userLng } : { lat: center.lat, lng: center.lng };
    var map = L.map(canvas, { scrollWheelZoom: false }).setView([mapCenter.lat, mapCenter.lng], center.zoom || 5);
    root.__missingAlertsMap = map;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    var bounds = L.latLngBounds();
    if (hasSavedCoordinates) {
      L.marker([userLat, userLng], { icon: makeIcon('green', 'YOUR ALERT AREA') })
        .addTo(map)
        .bindPopup('<strong>Your alert area</strong><br>' + escapeHtml(locationLabel(member) || center.label));
      bounds.extend([userLat, userLng]);
    }

    var caseLayer = window.L.markerClusterGroup && sameCountryCases.length > 8
      ? L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 42 })
      : L.layerGroup();
    caseLayer.addTo(map);

    displayCases.forEach(function(item, index) {
      var lat = numberOrNull(item.lat);
      var lng = numberOrNull(item.lng);
      var point = lat !== null && lng !== null ? { lat: lat, lng: lng } : fallbackPoint(displayCountry, index);
      var marker = L.marker([point.lat, point.lng], { icon: makeIcon('red', 'ACTIVE CASE') })
        .bindPopup(popupHtml(item, center));
      caseLayer.addLayer(marker);
      bounds.extend([point.lat, point.lng]);
    });

    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.18), { maxZoom: hasSavedCoordinates ? 9 : center.zoom || 5 });
    }
    setTimeout(function() { map.invalidateSize(); }, 120);

    if (!displayCases.length) {
      panel.innerHTML = panelHtml(isMemberMap ? 'No active missing-person cases are available for this view right now.' : 'Active missing-person cases are loading. Please refresh if this does not update.', '', [], locationLabel(member), displayScope);
    } else {
      var prefix = '';
      if (isMemberMap && !memberCountry && !hasSavedCoordinates) {
        prefix = 'Save an alert location above to see nearby cases. Showing global active cases for now.';
      } else if (hasSavedCoordinates && nearbyCases.length) {
        prefix = 'Showing active cases near your saved alert area.';
      } else if (hasSavedCoordinates && sameCountryCases.length) {
        prefix = 'No nearby active cases found. Showing active cases in your selected country.';
      } else if (!sameCountryCases.length && activeCases.length) {
        prefix = 'No active cases found for your saved country. Showing global active cases.';
      } else {
        prefix = 'Showing active cases for ' + escapeHtml(center.label || mapCountry.toUpperCase()) + '.';
      }
      panel.innerHTML = panelHtml(prefix, '', displayCases, locationLabel(member), displayScope);
    }
  }

  document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('[data-local-alert-map]').forEach(function(root) {
      if (!('IntersectionObserver' in window)) {
        init(root);
        return;
      }
      var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (!entry.isIntersecting) return;
          observer.disconnect();
          init(root);
        });
      }, { rootMargin: '180px 0px' });
      observer.observe(root);
    });
  });

  window.addEventListener('missing-alerts:member-location-saved', function(event) {
    document.querySelectorAll('[data-local-alert-map-context="member"]').forEach(function(root) {
      var dataNode = root.querySelector('[data-local-alert-member]');
      if (dataNode) {
        dataNode.textContent = JSON.stringify(Object.assign({ loggedIn: true }, event.detail || {}));
      }
      var panel = root.querySelector('[data-local-alert-map-panel]');
      if (panel) panel.innerHTML = '<div class="ma-local-alert-map__state">Refreshing local alert map...</div>';
      init(root);
    });
  });
})();
