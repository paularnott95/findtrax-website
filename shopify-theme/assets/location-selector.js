(function() {
  var apiBase = String(window.MISSING_ALERTS_API_BASE || '').trim().replace(/\/+$/, '');
  var fallbackCountries = null;
  var fallbackEntries = null;

  function toArray(value) {
    return Array.prototype.slice.call(value || []);
  }

  function normalizeCode(value) {
    return String(value || '').trim().toUpperCase();
  }

  function normalizeSearch(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function message(root, text) {
    var node = root.querySelector('[data-location-selector-message]');
    if (node) node.textContent = text || '';
  }

  function registry() {
    return window.MissingAlertsLocationRegistry || {};
  }

  function rowId(row) {
    return row ? String(row.id || row.sourceId || row.countryCode || '') : '';
  }

  function normalizeRegistryRow(row) {
    if (!row) return row;
    return {
      countryCode: normalizeCode(row.countryCode),
      id: rowId(row),
      sourceId: row.sourceId || row.id || '',
      countryName: row.countryName || row.name,
      name: row.name || row.countryName,
      slug: row.slug || row.countryCode,
      parentId: row.parentId || '',
      parentSlug: row.parentSlug || '',
      level: String(row.type || row.level || 'locality').replace('-', '_'),
      fullPath: row.fullPath || [row.name, row.parentName, row.countryName].filter(Boolean).join(', '),
      slugPath: row.slugPath || '',
      lat: row.lat || row.latitude || null,
      lng: row.lng || row.longitude || null,
      wholeCountry: row.wholeCountry === true
    };
  }

  function fallbackCountryRows() {
    if (fallbackCountries) return fallbackCountries;
    var entries = registry().entries || [];
    fallbackCountries = entries.filter(function(entry) {
      return entry.level === 0 || entry.type === 'country' || entry.type === 'nation';
    }).map(function(entry) {
      return {
        countryCode: normalizeCode(entry.countryCode),
        id: entry.sourceId || entry.id || entry.countryCode,
        countryName: entry.countryName || entry.name,
        name: entry.countryName || entry.name,
        slug: entry.slug,
        fullPath: entry.name,
        lat: entry.latitude || null,
        lng: entry.longitude || null
      };
    });
    return fallbackCountries;
  }

  function fallbackLocationRows() {
    if (fallbackEntries) return fallbackEntries;
    fallbackEntries = (registry().entries || []).filter(function(entry) {
      return !(entry.level === 0 || entry.type === 'country' || entry.type === 'nation');
    }).map(function(entry) {
      return {
        countryCode: normalizeCode(entry.countryCode),
        id: entry.sourceId || entry.id || '',
        level: String(entry.type || 'locality').replace('-', '_'),
        name: entry.name,
        slug: entry.slug,
        parentSlug: entry.parentSlug || null,
        fullPath: [entry.name, entry.parentName, entry.countryName].filter(Boolean).join(', '),
        slugPath: entry.slugPath || '',
        lat: entry.latitude || null,
        lng: entry.longitude || null
      };
    });
    return fallbackEntries;
  }

  async function getJson(url) {
    if (!apiBase) throw new Error('No API base configured');
    var response = await fetch(apiBase + url, { credentials: 'omit' });
    var data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || 'Location API failed');
    return data;
  }

  async function loadCountries() {
    if (typeof registry().getCountries === 'function') {
      try {
        var registryCountries = await registry().getCountries();
        return (registryCountries || []).map(normalizeRegistryRow);
      } catch (error) {
        // Fall through to API/inline fallback.
      }
    }
    try {
      var data = await getJson('/api/locations/countries');
      return data.countries || [];
    } catch (error) {
      return fallbackCountryRows();
    }
  }

  async function loadChildren(countryCode, parentSlug) {
    if (typeof registry().getChildren === 'function') {
      try {
        var parentKey = parentSlug || countryCode || '';
        var registryChildren = await registry().getChildren(parentKey);
        return (registryChildren || []).map(normalizeRegistryRow).filter(function(entry) {
          return !countryCode || entry.countryCode === normalizeCode(countryCode);
        });
      } catch (error) {
        // Fall through to API/inline fallback.
      }
    }
    try {
      var url = '/api/locations/children?countryCode=' + encodeURIComponent(countryCode || '');
      if (parentSlug) url += '&parentSlug=' + encodeURIComponent(parentSlug);
      var data = await getJson(url);
      return data.locations || [];
    } catch (error) {
      return fallbackLocationRows().filter(function(entry) {
        return (!countryCode || entry.countryCode === normalizeCode(countryCode)) && (parentSlug ? entry.parentSlug === parentSlug : !entry.parentSlug);
      });
    }
  }

  function fill(select, rows, placeholder) {
    select.dataset.rows = JSON.stringify(rows || []);
    select.innerHTML = '';
    var blank = document.createElement('option');
    blank.value = '';
    blank.textContent = placeholder;
    select.appendChild(blank);
    (rows || []).forEach(function(row) {
      var option = document.createElement('option');
      option.value = row.id || row.slug || row.countryCode;
      option.textContent = row.fullPath || row.name;
      option.dataset.location = JSON.stringify(row);
      select.appendChild(option);
    });
    select.disabled = rows.length === 0;
  }

  function filterSelect(select, query, emptyText) {
    var rows = [];
    try {
      rows = JSON.parse(select.dataset.rows || '[]');
    } catch (error) {
      rows = [];
    }
    var normalized = normalizeSearch(query);
    var filtered = normalized
      ? rows.filter(function(row) {
          return normalizeSearch([row.name, row.countryName, row.fullPath, row.slug, row.id].filter(Boolean).join(' ')).indexOf(normalized) !== -1;
        })
      : rows;
    fill(select, filtered, filtered.length ? select.options[0]?.textContent || 'Select location' : emptyText);
  }

  function setFilterState(root, key, enabled) {
    var input = root.querySelector('[data-location-filter-for="' + key + '"]');
    if (!input) return;
    input.disabled = !enabled;
    if (!enabled) input.value = '';
  }

  function selected(select) {
    var option = select.options[select.selectedIndex];
    if (!option || !option.dataset.location) return null;
    try {
      return JSON.parse(option.dataset.location);
    } catch (error) {
      return null;
    }
  }

  function setOutput(root, key, value) {
    toArray(root.querySelectorAll('[data-location-output="' + key + '"]')).forEach(function(input) {
      input.value = value == null ? '' : String(value);
    });
  }

  function setLegacy(root, key, value) {
    toArray(root.querySelectorAll('[data-location-legacy="' + key + '"]')).forEach(function(input) {
      input.value = value || '';
    });
  }

  function sync(root) {
    var country = selected(root.querySelector('[data-location-country-select]'));
    var region = selected(root.querySelector('[data-location-region-select]'));
    var county = selected(root.querySelector('[data-location-county-select]'));
    var city = selected(root.querySelector('[data-location-city-select]'));
    var chosen = city || county || region || country || {};
    var fullPath = chosen.fullPath || [city && city.name, county && county.name, region && region.name, country && (country.countryName || country.name)].filter(Boolean).join(', ');

    setOutput(root, 'countryCode', country ? country.countryCode : '');
    setOutput(root, 'countryName', country ? (country.countryName || country.name) : '');
    setOutput(root, 'region', region ? region.name : '');
    setOutput(root, 'regionId', region ? rowId(region) : '');
    setOutput(root, 'regionSlug', region ? region.slug : '');
    setOutput(root, 'county', county ? county.name : '');
    setOutput(root, 'countyId', county ? rowId(county) : '');
    setOutput(root, 'countySlug', county ? county.slug : '');
    setOutput(root, 'city', city ? city.name : '');
    setOutput(root, 'cityId', city ? rowId(city) : '');
    setOutput(root, 'citySlug', city ? city.slug : '');
    setOutput(root, 'town', city && city.level === 'town' ? city.name : '');
    setOutput(root, 'townId', city && city.level === 'town' ? rowId(city) : '');
    setOutput(root, 'village', city && (city.level === 'village' || city.level === 'locality') ? city.name : '');
    setOutput(root, 'villageId', city && (city.level === 'village' || city.level === 'locality') ? rowId(city) : '');
    setOutput(root, 'slugPath', chosen.slugPath || '');
    setOutput(root, 'fullPath', fullPath);
    setOutput(root, 'lat', chosen.lat || '');
    setOutput(root, 'lng', chosen.lng || '');
    setLegacy(root, 'country', country ? (country.countryName || country.name) : '');
    setLegacy(root, 'region', (county && county.name) || (region && region.name) || '');
    setLegacy(root, 'city', city ? city.name : '');

    root.dispatchEvent(new CustomEvent('missing-alerts:location-selected', {
      bubbles: true,
      detail: { country: country, region: region, county: county, city: city, fullPath: fullPath, slugPath: chosen.slugPath || '' }
    }));
  }

  function selectByText(select, value) {
    var wanted = String(value || '').trim().toLowerCase();
    if (!wanted) return;
    toArray(select.options).some(function(option) {
      var row = option.dataset.location ? JSON.parse(option.dataset.location) : null;
      if (!row) return false;
      if (String(row.name || row.countryName || '').toLowerCase() === wanted || String(row.countryCode || '').toLowerCase() === wanted) {
        select.value = option.value;
        return true;
      }
      return false;
    });
  }

  var SMART_COUNTRY_CODES = ['GB', 'US', 'CA', 'AU', 'IE'];
  var smartCountryChunksLoaded = false;

  function cleanText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function titleCaseSlug(value) {
    return String(value || '')
      .split('-')
      .filter(Boolean)
      .map(function(part) {
        var lower = part.toLowerCase();
        if (lower === 'uk') return 'UK';
        if (lower === 'usa') return 'USA';
        return lower.charAt(0).toUpperCase() + lower.slice(1);
      })
      .join(' ');
  }

  function dedupeParts(parts) {
    var seen = {};
    return (parts || []).map(cleanText).filter(function(part) {
      if (!part) return false;
      var key = normalizeSearch(part);
      if (!key || seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  function smartLevel(row) {
    return String((row && (row.level || row.type)) || '').replace('-', '_').toLowerCase();
  }

  function isPlaceLevel(row) {
    var level = smartLevel(row);
    return level === 'city' || level === 'town' || level === 'village' || level === 'locality';
  }

  function isCountyLevel(row) {
    var level = smartLevel(row);
    return level === 'county' || level === 'district' || level === 'admin2';
  }

  function smartCountryName(row) {
    if (!row) return '';
    return cleanText(row.countryName || (smartLevel(row) === 'country' ? row.name : ''));
  }

  function slugTrail(row) {
    var path = String((row && row.slugPath) || '').split('/').filter(Boolean);
    var missingIndex = path.indexOf('missing-people');
    if (missingIndex !== -1) path = path.slice(missingIndex + 1);
    return path;
  }

  function formatSmartLocation(row) {
    row = normalizeRegistryRow(row);
    if (!row) return '';
    var level = smartLevel(row);
    var countryName = smartCountryName(row);
    if (level === 'country') return cleanText(countryName || row.name);

    var parts = [row.name];
    var trail = slugTrail(row);
    if (trail.length > 1) {
      trail.slice(1, -1).forEach(function(slug) {
        parts.push(titleCaseSlug(slug));
      });
    } else if (row.parentName) {
      parts.push(row.parentName);
    } else if (row.parentSlug) {
      parts.push(titleCaseSlug(row.parentSlug));
    }
    if (countryName) parts.push(countryName);
    return dedupeParts(parts).join(', ');
  }

  function smartTypeLabel(row) {
    var level = smartLevel(row);
    if (level === 'country') return 'Country';
    if (level === 'region' || level === 'admin1' || level === 'nation') return 'Region';
    if (level === 'county' || level === 'district' || level === 'admin2') return 'County';
    if (level === 'city') return 'City';
    if (level === 'town') return 'Town';
    if (level === 'village') return 'Village';
    return 'Location';
  }

  function countryCodeForName(countries, value) {
    var wanted = normalizeSearch(value);
    var match = (countries || []).find(function(country) {
      return normalizeSearch(country.countryName || country.name) === wanted || normalizeCode(country.countryCode) === normalizeCode(value);
    });
    return match ? normalizeCode(match.countryCode) : '';
  }

  function clearSmartOutputs(root) {
    [
      'countryCode', 'countryName', 'region', 'regionId', 'regionSlug', 'county', 'countyId', 'countySlug',
      'city', 'cityId', 'citySlug', 'town', 'townId', 'village', 'villageId', 'slugPath', 'fullPath', 'lat', 'lng', 'scope'
    ].forEach(function(key) {
      setOutput(root, key, '');
    });
    setLegacy(root, 'country', '');
    setLegacy(root, 'region', '');
    setLegacy(root, 'city', '');
  }

  function applySmartSelection(root, row) {
    row = normalizeRegistryRow(row);
    if (!row) return;
    var level = smartLevel(row);
    var label = formatSmartLocation(row);
    var countryName = smartCountryName(row) || row.name;
    var countryCode = normalizeCode(row.countryCode);
    var trail = slugTrail(row);
    var adminParts = trail.length > 1 ? trail.slice(1, -1).map(titleCaseSlug) : [];
    var regionName = adminParts[0] || '';
    var countyName = adminParts.length > 1 ? adminParts[adminParts.length - 1] : '';

    clearSmartOutputs(root);
    setOutput(root, 'countryCode', countryCode);
    setOutput(root, 'countryName', countryName);
    setOutput(root, 'fullPath', label);
    setOutput(root, 'slugPath', row.slugPath || '');
    setOutput(root, 'lat', row.lat || '');
    setOutput(root, 'lng', row.lng || '');
    setOutput(root, 'scope', level === 'country' && row.wholeCountry === true ? 'whole_country' : '');

    if (level === 'region' || level === 'nation' || level === 'admin1') {
      setOutput(root, 'region', row.name || regionName);
      setOutput(root, 'regionId', rowId(row));
      setOutput(root, 'regionSlug', row.slug || '');
      regionName = row.name || regionName;
    } else if (level === 'county' || level === 'district' || level === 'admin2') {
      setOutput(root, 'region', regionName);
      setOutput(root, 'county', row.name || countyName);
      setOutput(root, 'countyId', rowId(row));
      setOutput(root, 'countySlug', row.slug || '');
      countyName = row.name || countyName;
    } else if (level !== 'country') {
      setOutput(root, 'region', regionName);
      setOutput(root, 'county', countyName);
      setOutput(root, 'city', row.name || '');
      setOutput(root, 'cityId', rowId(row));
      setOutput(root, 'citySlug', row.slug || '');
      if (level === 'town') {
        setOutput(root, 'town', row.name || '');
        setOutput(root, 'townId', rowId(row));
      }
      if (level === 'village' || level === 'locality') {
        setOutput(root, 'village', row.name || '');
        setOutput(root, 'villageId', rowId(row));
      }
    }

    setLegacy(root, 'country', countryName);
    setLegacy(root, 'region', countyName || regionName);
    setLegacy(root, 'city', level === 'country' || level === 'region' || level === 'nation' ? '' : row.name);

    root.dataset.smartCountryCode = countryCode;
    root.dataset.smartCountryName = countryName;
    showSmartSelection(root, label);
    root.dispatchEvent(new CustomEvent('missing-alerts:location-selected', {
      bubbles: true,
      detail: { location: row, countryCode: countryCode, fullPath: label, slugPath: row.slugPath || '' }
    }));
  }

  function showSmartSelection(root, label) {
    var card = root.querySelector('[data-location-selected-card]');
    var labelNode = root.querySelector('[data-location-selected-label]');
    if (card && labelNode && label) {
      labelNode.textContent = label;
      card.hidden = false;
    }
  }

  function clearSmartSelection(root) {
    var card = root.querySelector('[data-location-selected-card]');
    var labelNode = root.querySelector('[data-location-selected-label]');
    if (labelNode) labelNode.textContent = '';
    if (card) card.hidden = true;
    clearSmartOutputs(root);
  }

  function countryContextLabel(root) {
    return cleanText(root.dataset.smartCountryName || 'this country');
  }

  async function setSmartCountryContext(root, countryCode, countryName) {
    var input = root.querySelector('[data-location-smart-input]');
    var context = root.querySelector('[data-location-smart-context]');
    var actions = root.querySelector('[data-location-smart-actions]');
    var useCountry = root.querySelector('[data-location-use-country]');
    root.dataset.smartCountryCode = normalizeCode(countryCode);
    root.dataset.smartCountryName = cleanText(countryName);
    clearSmartSelection(root);
    hideSmartResults(root);
    if (context) context.textContent = 'Searching in ' + countryContextLabel(root) + '. Search town, city or county, or use the whole country.';
    if (useCountry) useCountry.textContent = 'Use whole ' + countryContextLabel(root);
    if (actions) actions.hidden = false;
    if (input) {
      input.value = '';
      input.focus();
    }
    message(root, 'Loading ' + countryContextLabel(root) + ' locations...');
    try {
      await ensureSmartSearchScope(root.dataset.smartCountryCode);
      message(root, '');
    } catch (error) {
      message(root, 'Location data could not load. Try again or choose the nearest country/region.');
    }
  }

  function clearSmartCountryContext(root) {
    var input = root.querySelector('[data-location-smart-input]');
    var context = root.querySelector('[data-location-smart-context]');
    var actions = root.querySelector('[data-location-smart-actions]');
    delete root.dataset.smartCountryCode;
    delete root.dataset.smartCountryName;
    clearSmartSelection(root);
    hideSmartResults(root);
    if (actions) actions.hidden = true;
    if (context) context.textContent = 'Search globally.';
    if (input) {
      input.value = '';
      input.focus();
    }
    message(root, 'Choose the closest listed area so alerts reach the right people.');
  }

  function hideSmartResults(root) {
    var results = root.querySelector('[data-location-smart-results]');
    var input = root.querySelector('[data-location-smart-input]');
    if (results) {
      results.hidden = true;
      results.innerHTML = '';
    }
    if (input) {
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
    }
    root.dataset.smartActiveIndex = '-1';
  }

  async function ensureSmartSearchScope(countryCode) {
    if (countryCode && typeof registry().loadCountry === 'function') {
      await registry().loadCountry(countryCode);
      return;
    }
    if (smartCountryChunksLoaded) return;
    if (typeof registry().loadCountry === 'function') {
      await Promise.all(SMART_COUNTRY_CODES.map(function(code) {
        return registry().loadCountry(code).catch(function() {});
      }));
    }
    smartCountryChunksLoaded = true;
  }

  function smartRank(row, query, selectedCountryCode) {
    row = normalizeRegistryRow(row);
    var normalizedQuery = normalizeSearch(query);
    var name = normalizeSearch(row.name || row.countryName);
    var label = normalizeSearch(formatSmartLocation(row));
    var level = smartLevel(row);
    var score = 0;
    if (selectedCountryCode && normalizeCode(row.countryCode) === selectedCountryCode) score += 300;
    if (name === normalizedQuery) score += 260;
    else if (name.indexOf(normalizedQuery) === 0) score += 150;
    else if (label.indexOf(normalizedQuery) !== -1) score += 60;
    if (level === 'country') score += 80;
    if (level === 'region' || level === 'nation' || level === 'admin1') score += 65;
    if (level === 'county' || level === 'district' || level === 'admin2') score += 45;
    if (level === 'city' || level === 'town') score += 55;
    if (row.lat && row.lng) score += 8;
    if (normalizeCode(row.countryCode) === 'GB') score += 6;
    return score;
  }

  function renderSmartResults(root, rows, query) {
    var results = root.querySelector('[data-location-smart-results]');
    var input = root.querySelector('[data-location-smart-input]');
    if (!results || !input) return;
    results.innerHTML = '';
    if (!rows.length) {
      var empty = document.createElement('div');
      empty.className = 'ma-location-selector__smart-empty';
      empty.textContent = query.length < 2
        ? 'Start typing a country, city, town or region.'
        : root.dataset.smartCountryCode
          ? 'Searching inside ' + countryContextLabel(root) + '. Change country to search somewhere else.'
          : 'No listed area found. Try a nearby city, county or country.';
      results.appendChild(empty);
      results.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      return;
    }
    rows.slice(0, 10).forEach(function(row, index) {
      var option = document.createElement('button');
      option.type = 'button';
      option.className = 'ma-location-selector__smart-result';
      option.id = input.getAttribute('aria-controls') + '-option-' + index;
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', 'false');
      option.dataset.index = String(index);
      option.dataset.location = JSON.stringify(row);
      option.innerHTML = '<span>' + escapeHtml(formatSmartLocation(row)) + '</span><small>' + escapeHtml(smartTypeLabel(row)) + '</small>';
      option.addEventListener('click', function() {
        if (smartLevel(row) === 'country') {
          setSmartCountryContext(root, normalizeCode(row.countryCode), smartCountryName(row) || row.name);
          return;
        }
        applySmartSelection(root, row);
        var smartInput = root.querySelector('[data-location-smart-input]');
        if (smartInput) smartInput.value = '';
        hideSmartResults(root);
        message(root, '');
      });
      results.appendChild(option);
    });
    results.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    root.dataset.smartActiveIndex = '-1';
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, function(character) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character];
    });
  }

  async function smartSearch(root, query, countries) {
    var normalized = normalizeSearch(query);
    var selectedCountryCode = normalizeCode(root.dataset.smartCountryCode);
    if (!normalized || normalized.length < 2) {
      renderSmartResults(root, [], query);
      return;
    }
    message(root, 'Searching approved locations...');
    try {
      var directCountry = countryCodeForName(countries, query);
      await ensureSmartSearchScope(selectedCountryCode || directCountry);
      var countryMatches = (countries || []).filter(function(country) {
        return normalizeSearch(country.countryName || country.name).indexOf(normalized) !== -1 || normalizeCode(country.countryCode).indexOf(normalizeCode(query)) === 0;
      });
      var registryRows = [];
      if (typeof registry().search === 'function') {
        registryRows = await registry().search(query, {
          countryCode: selectedCountryCode || directCountry || undefined,
          limit: 40
        });
      } else {
        registryRows = fallbackLocationRows().filter(function(row) {
          return normalizeSearch([row.name, row.fullPath, row.countryName].join(' ')).indexOf(normalized) !== -1;
        });
      }
      var byLabel = {};
      var rows = countryMatches.concat(registryRows || []).map(normalizeRegistryRow).filter(function(row) {
        var label = formatSmartLocation(row);
        if (!label) return false;
        var key = normalizeSearch(label);
        if (byLabel[key]) return false;
        byLabel[key] = true;
        return true;
      });
      rows.sort(function(a, b) {
        return smartRank(b, query, selectedCountryCode) - smartRank(a, query, selectedCountryCode);
      });
      renderSmartResults(root, rows.slice(0, 10), query);
      message(root, rows.length ? '' : 'Choose the closest listed area so alerts reach the right people.');
    } catch (error) {
      hideSmartResults(root);
      message(root, 'Location data could not load. Try again or choose the nearest country/region.');
    }
  }

  function moveSmartActive(root, delta) {
    var input = root.querySelector('[data-location-smart-input]');
    var options = toArray(root.querySelectorAll('.ma-location-selector__smart-result'));
    if (!input || !options.length) return;
    var index = Number(root.dataset.smartActiveIndex || '-1');
    index = Math.max(0, Math.min(options.length - 1, index + delta));
    root.dataset.smartActiveIndex = String(index);
    options.forEach(function(option, optionIndex) {
      option.setAttribute('aria-selected', optionIndex === index ? 'true' : 'false');
    });
    input.setAttribute('aria-activedescendant', options[index].id);
    options[index].scrollIntoView({ block: 'nearest' });
  }

  async function initSmart(root) {
    var input = root.querySelector('[data-location-smart-input]');
    var change = root.querySelector('[data-location-change]');
    var useCountry = root.querySelector('[data-location-use-country]');
    var changeCountry = root.querySelector('[data-location-change-country]');
    if (!input) return;
    message(root, 'Loading approved locations...');
    var countries = await loadCountries();
    var initialCountry = root.getAttribute('data-initial-country');
    var initialRegion = root.getAttribute('data-initial-region');
    var initialCounty = root.getAttribute('data-initial-county');
    var initialCity = root.getAttribute('data-initial-city');
    var initialLabel = dedupeParts([initialCity, initialCounty || initialRegion, initialCountry]).join(', ');
    if (initialLabel) {
      showSmartSelection(root, initialLabel);
      var initialCountryCode = countryCodeForName(countries, initialCountry);
      setOutput(root, 'countryCode', initialCountryCode);
      setOutput(root, 'countryName', initialCountry);
      setOutput(root, 'region', initialRegion);
      setOutput(root, 'county', initialCounty);
      setOutput(root, 'city', initialCity);
      setOutput(root, 'fullPath', initialLabel);
      setLegacy(root, 'country', initialCountry);
      setLegacy(root, 'region', initialCounty || initialRegion);
      setLegacy(root, 'city', initialCity);
      if (initialCountryCode) {
        root.dataset.smartCountryCode = initialCountryCode;
        root.dataset.smartCountryName = initialCountry;
      }
    }
    message(root, 'Choose the closest listed area so alerts reach the right people.');

    toArray(root.querySelectorAll('[data-smart-country]')).forEach(function(button) {
      button.addEventListener('click', async function() {
        var countryCode = normalizeCode(button.getAttribute('data-smart-country'));
        var countryName = cleanText(button.getAttribute('data-smart-country-name'));
        await setSmartCountryContext(root, countryCode, countryName);
      });
    });

    if (useCountry) {
      useCountry.addEventListener('click', function() {
        var countryCode = normalizeCode(root.dataset.smartCountryCode);
        var countryName = countryContextLabel(root);
        if (!countryCode || !countryName) return;
        applySmartSelection(root, {
          countryCode: countryCode,
          countryName: countryName,
          name: countryName,
          level: 'country',
          type: 'country',
          fullPath: countryName,
          wholeCountry: true
        });
        message(root, '');
      });
    }

    if (changeCountry) {
      changeCountry.addEventListener('click', function() {
        clearSmartCountryContext(root);
      });
    }

    var debounceTimer = null;
    input.addEventListener('input', function() {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(function() {
        smartSearch(root, input.value, countries);
      }, 180);
    });
    input.addEventListener('keydown', function(event) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        moveSmartActive(root, 1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        moveSmartActive(root, -1);
      } else if (event.key === 'Enter') {
        var activeIndex = Number(root.dataset.smartActiveIndex || '-1');
        var options = toArray(root.querySelectorAll('.ma-location-selector__smart-result'));
        if (activeIndex >= 0 && options[activeIndex]) {
          event.preventDefault();
          options[activeIndex].click();
        }
      } else if (event.key === 'Escape') {
        hideSmartResults(root);
      }
    });
    input.addEventListener('focus', function() {
      if (input.value.trim().length >= 2) smartSearch(root, input.value, countries);
    });
    document.addEventListener('click', function(event) {
      if (!root.contains(event.target)) hideSmartResults(root);
    });
    if (change) {
      change.addEventListener('click', function() {
        clearSmartSelection(root);
        if (input) {
          input.value = '';
          input.focus();
        }
        message(root, 'Choose the closest listed area so alerts reach the right people.');
      });
    }
  }

  async function init(root) {
    if (root.dataset.bound === 'true') return;
    root.dataset.bound = 'true';
    if (root.getAttribute('data-location-mode') === 'smart-search') {
      await initSmart(root);
      return;
    }
    var countrySelect = root.querySelector('[data-location-country-select]');
    var regionSelect = root.querySelector('[data-location-region-select]');
    var countySelect = root.querySelector('[data-location-county-select]');
    var citySelect = root.querySelector('[data-location-city-select]');
    message(root, 'Loading approved countries...');
    var countries = await loadCountries();
    fill(countrySelect, countries, 'Select country');
    setFilterState(root, 'country', true);
    message(root, countries.length ? 'Choose the closest listed area so alerts reach the right people.' : 'Location data could not load. Try again or choose the nearest country/region.');
    ['country', 'region', 'county', 'city'].forEach(function(key) {
      var input = root.querySelector('[data-location-filter-for="' + key + '"]');
      var select = root.querySelector('[data-location-' + key + '-select]');
      if (!input || !select) return;
      input.addEventListener('input', function() {
        filterSelect(select, input.value, 'No location found — choose nearest area');
      });
    });
    selectByText(countrySelect, root.getAttribute('data-initial-country'));
    sync(root);

    countrySelect.addEventListener('change', async function() {
      var country = selected(countrySelect);
      fill(regionSelect, [], 'Loading approved areas...');
      fill(countySelect, [], 'Select region first');
      fill(citySelect, [], 'Select nearest approved place');
      setFilterState(root, 'region', false);
      setFilterState(root, 'county', false);
      setFilterState(root, 'city', false);
      message(root, country ? 'Loading approved areas...' : 'Choose the closest listed area so alerts reach the right people.');
      if (!country) return sync(root);
      try {
        var children = await loadChildren(country.countryCode);
        var directPlaces = children.filter(isPlaceLevel);
        var regionRows = children.filter(function(row) { return !isPlaceLevel(row); });
        fill(regionSelect, regionRows, regionRows.length ? 'Select approved region' : 'No region step needed');
        fill(citySelect, directPlaces, directPlaces.length ? 'Select city / town' : 'Select nearest approved place');
        setFilterState(root, 'region', regionRows.length > 0);
        setFilterState(root, 'city', directPlaces.length > 0);
        selectByText(regionSelect, root.getAttribute('data-initial-region'));
        selectByText(citySelect, root.getAttribute('data-initial-city'));
        message(root, children.length ? '' : 'Choose the closest listed area so alerts reach the right people.');
        sync(root);
        if (regionSelect.value) regionSelect.dispatchEvent(new Event('change'));
      } catch (error) {
        fill(regionSelect, [], 'Location data unavailable');
        message(root, 'Location data could not load. Try again or choose the nearest country/region.');
        sync(root);
      }
    });

    regionSelect.addEventListener('change', async function() {
      var country = selected(countrySelect);
      var region = selected(regionSelect);
      fill(countySelect, [], 'Loading approved areas...');
      fill(citySelect, [], 'Select nearest approved place');
      setFilterState(root, 'county', false);
      setFilterState(root, 'city', false);
      message(root, region ? 'Loading approved areas...' : 'Choose the closest listed area so alerts reach the right people.');
      if (!country || !region) return sync(root);
      try {
        var children = await loadChildren(country.countryCode, rowId(region));
        var cityRows = children.filter(isPlaceLevel);
        var countyRows = children.filter(function(row) { return !isPlaceLevel(row); });
        fill(countySelect, countyRows, countyRows.length ? 'Select county / local authority' : 'No county step needed');
        fill(citySelect, cityRows, cityRows.length ? 'Select city / town' : 'Select nearest approved place');
        setFilterState(root, 'county', countyRows.length > 0);
        setFilterState(root, 'city', cityRows.length > 0);
        selectByText(countySelect, root.getAttribute('data-initial-county'));
        selectByText(citySelect, root.getAttribute('data-initial-city'));
        message(root, children.length ? '' : 'Choose the closest listed area so alerts reach the right people.');
        sync(root);
        if (countySelect.value) countySelect.dispatchEvent(new Event('change'));
      } catch (error) {
        fill(countySelect, [], 'Location data unavailable');
        message(root, 'Location data could not load. Try again or choose the nearest country/region.');
        sync(root);
      }
    });

    countySelect.addEventListener('change', async function() {
      var country = selected(countrySelect);
      var county = selected(countySelect);
      fill(citySelect, [], 'Loading approved towns...');
      setFilterState(root, 'city', false);
      message(root, county ? 'Loading approved towns...' : 'Choose the closest listed area so alerts reach the right people.');
      if (!country || !county) return sync(root);
      try {
        var children = await loadChildren(country.countryCode, rowId(county));
        var places = children.filter(function(row) { return isPlaceLevel(row) || !isCountyLevel(row); });
        fill(citySelect, places, 'Select city / town');
        setFilterState(root, 'city', places.length > 0);
        selectByText(citySelect, root.getAttribute('data-initial-city'));
        message(root, places.length ? '' : 'Choose the closest listed area so alerts reach the right people.');
        sync(root);
      } catch (error) {
        fill(citySelect, [], 'Location data unavailable');
        message(root, 'Location data could not load. Try again or choose the nearest country/region.');
        sync(root);
      }
    });

    citySelect.addEventListener('change', function() {
      sync(root);
    });

    if (countrySelect.value) countrySelect.dispatchEvent(new Event('change'));
  }

  document.addEventListener('DOMContentLoaded', function() {
    toArray(document.querySelectorAll('[data-location-selector]')).forEach(init);
  });
})();
