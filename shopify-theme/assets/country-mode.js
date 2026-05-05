(function() {
  var configNode = document.getElementById('missing-alerts-country-mode-config');
  if (!configNode) return;

  var config = {};
  try {
    config = JSON.parse(configNode.textContent || '{}');
  } catch (error) {
    config = {};
  }

  var countries = config.countries || {};
  var storageKey = config.storageKey || 'missingAlertsCountry';
  var currencyStorageKey = config.currencyStorageKey || 'missingAlertsCurrency';
  var languageStorageKey = config.languageStorageKey || 'missingAlertsLanguage';
  var defaultCurrency = config.defaultCurrency || 'GBP';
  var defaultLanguage = config.defaultLanguage || 'en';
  var html = document.documentElement;
  var body = document.body;
  var popup = document.getElementById('missing-alerts-country-popup');
  var topbar = document.getElementById('missing-alerts-country-top-bar');
  var saveButton = popup ? popup.querySelector('[data-country-save]') : null;
  var selectedText = popup ? popup.querySelector('[data-country-wheel-selected]') : null;
  var wheelViewport = popup ? popup.querySelector('[data-country-wheel-viewport]') : null;
  var wheelTrack = popup ? popup.querySelector('[data-country-wheel-track]') : null;
  var prevButton = popup ? popup.querySelector('[data-country-wheel-prev]') : null;
  var nextButton = popup ? popup.querySelector('[data-country-wheel-next]') : null;
  var changeButtons = document.querySelectorAll('[data-country-change]');
  var topbarText = document.querySelector('[data-country-topbar-text]');
  var topbarIntelligence = document.querySelector('[data-country-topbar-intelligence]');
  var countryIntelligenceLinks = document.querySelectorAll('[data-country-intelligence-link]');
  var cookieMaxAge = 60 * 60 * 24 * 180;
  var selectedCountryCode = null;
  var lastFocused = null;

  var selectorCountries = [
    { code: 'gb', slug: 'united-kingdom', flag: '🇬🇧', name: 'United Kingdom', status: 'Live appeals', aliases: ['gb', 'uk', 'united kingdom', 'united-kingdom', 'england', 'scotland', 'wales', 'northern ireland'] },
    { code: 'us', slug: 'united-states', flag: '🇺🇸', name: 'United States', status: 'Live appeals', aliases: ['us', 'usa', 'united states', 'united-states', 'united states of america'] },
    { code: 'ca', slug: 'canada', flag: '🇨🇦', name: 'Canada', status: 'Live appeals', aliases: ['ca', 'canada'] },
    { code: 'au', slug: 'australia', flag: '🇦🇺', name: 'Australia', status: 'Live appeals', aliases: ['au', 'australia'] },
    { code: 'nz', slug: 'new-zealand', flag: '🇳🇿', name: 'New Zealand', status: 'Live appeals', aliases: ['nz', 'new zealand', 'new-zealand'] },
    { code: 'ie', slug: 'ireland', flag: '🇮🇪', name: 'Ireland', status: 'Country intelligence ready', aliases: ['ie', 'ireland'] },
    { code: 'sg', slug: 'singapore', flag: '🇸🇬', name: 'Singapore', status: 'Source coverage building', aliases: ['sg', 'singapore'] },
    { code: 'za', slug: 'south-africa', flag: '🇿🇦', name: 'South Africa', status: 'Being enriched', aliases: ['za', 'south africa', 'south-africa'], enabledInSelector: false }
  ];

  function normalize(value) {
    return String(value || '').toLowerCase().trim().replace(/_/g, '-');
  }

  function canonicalizeCountry(value) {
    var normalized = normalize(value);
    if (!normalized) return '';
    if (normalized === 'uk' || normalized === 'england' || normalized === 'scotland' || normalized === 'wales' || normalized === 'northern-ireland' || normalized === 'northern ireland') return 'gb';
    if (normalized === 'usa' || normalized === 'united-states-of-america' || normalized === 'united states of america') return 'us';
    var match = selectorCountries.find(function(country) {
      return country.aliases.some(function(alias) {
        return normalize(alias) === normalized;
      }) || country.code === normalized || country.slug === normalized;
    });
    if (match) return match.code;
    if (countries[normalized]) return normalized;
    return normalized;
  }

  function getSelectorCountry(code) {
    var canonical = canonicalizeCountry(code);
    return selectorCountries.find(function(country) {
      return country.code === canonical;
    }) || null;
  }

  function getCountryData(code) {
    var selectorCountry = getSelectorCountry(code);
    if (selectorCountry) return selectorCountry;
    var canonical = canonicalizeCountry(code);
    var themeCountry = countries[canonical];
    if (!themeCountry) return null;
    return {
      code: canonical,
      slug: themeCountry.slug || canonical,
      flag: themeCountry.flag || '',
      name: themeCountry.label || canonical.toUpperCase(),
      status: 'Country intelligence ready',
      aliases: [canonical, themeCountry.label || '']
    };
  }

  function parseStoredCountry() {
    var raw = '';
    try {
      raw = window.localStorage.getItem(storageKey) || '';
    } catch (error) {
      raw = '';
    }
    if (!raw) return null;
    try {
      var parsed = JSON.parse(raw);
      if (parsed && (parsed.code || parsed.slug || parsed.name)) return getCountryData(parsed.code || parsed.slug || parsed.name);
    } catch (error) {
      return getCountryData(raw);
    }
    return getCountryData(raw);
  }

  function getQueryCountry() {
    var params = new URLSearchParams(window.location.search || '');
    var value = params.get('country');
    if (!value) return null;
    var country = getCountryData(value);
    if (!country || country.code === 'global') return null;
    return country;
  }

  function writeCookie(country) {
    document.cookie = 'missing_alerts_country=' + encodeURIComponent(country.code.toUpperCase()) + '; Max-Age=' + cookieMaxAge + '; Path=/; SameSite=Lax';
  }

  function getCurrencyForCountry(code) {
    var canonical = canonicalizeCountry(code);
    return (countries[canonical] && countries[canonical].currency) || defaultCurrency;
  }

  function getLanguageForCountry(code) {
    var canonical = canonicalizeCountry(code);
    return (countries[canonical] && countries[canonical].language) || defaultLanguage;
  }

  function countryStoragePayload(country) {
    return {
      code: country.code.toUpperCase(),
      slug: country.slug,
      name: country.name
    };
  }

  function persistCountry(country) {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(countryStoragePayload(country)));
      window.localStorage.setItem(currencyStorageKey, getCurrencyForCountry(country.code));
      window.localStorage.setItem(languageStorageKey, getLanguageForCountry(country.code));
    } catch (error) {
      // Storage can fail in private browsing; cookie still gives the server/client a lightweight country hint.
    }
    writeCookie(country);
  }

  function countryMatches(selected, node) {
    if (!selected) return true;
    var values = [
      node.getAttribute('data-country-code'),
      node.getAttribute('data-country-slug'),
      node.getAttribute('data-country-name'),
      node.getAttribute('data-country'),
      node.getAttribute('data-country-scope'),
      node.getAttribute('data-region'),
      node.getAttribute('data-admin1'),
      node.getAttribute('data-location'),
      node.getAttribute('data-search-text')
    ].filter(Boolean).join(' ').toLowerCase();

    if (!values) return false;
    return selected.aliases.some(function(alias) {
      return values.indexOf(normalize(alias).replace(/-/g, ' ')) !== -1 || values.indexOf(normalize(alias)) !== -1;
    });
  }

  function isCaseLike(node) {
    if (!node) return false;
    if (node.hasAttribute('data-country-card') || node.closest('.missing-alerts-country-popup')) return false;
    if (node.hasAttribute('data-country-section')) return false;
    if (node.hasAttribute('data-country-surface')) return false;
    return node.matches('[data-case-card], .ma-case-grid-card, .boosted-card, .bp-card-shell, .spotlight-card, .ma-spotlight-card, .mpa-case-card, .article-card, [data-country-code], [data-country-slug]');
  }

  function shouldShowCountryScope(node, selected) {
    if (!node || !selected) return true;
    if (!isCaseLike(node)) return true;
    if (node.getAttribute('data-card-type') === 'empty') return false;
    return countryMatches(selected, node);
  }

  function ensureEmptyState(container, selected) {
    var existing = container.querySelector(':scope > .country-mode-empty-state');
    if (existing) return existing;
    var node = document.createElement('div');
    node.className = 'country-mode-empty-state';
    node.hidden = true;
    container.appendChild(node);
    return node;
  }

  function updateEmptyState(container, selected) {
    if (!container || !selected) return;
    var cards = Array.prototype.slice.call(container.querySelectorAll('.ma-case-grid-card, .boosted-card, .bp-card-shell, .spotlight-card, .ma-spotlight-card, .mpa-case-card, [data-case-card]')).filter(function(card) {
      return !card.classList.contains('country-mode-empty-state') && card.getAttribute('data-card-type') !== 'empty';
    });
    if (!cards.length) return;
    var visible = cards.filter(function(card) {
      return !card.hidden && !card.classList.contains('country-mode-hidden');
    });
    var empty = ensureEmptyState(container, selected);
    empty.innerHTML = 'No active public appeals are currently listed for ' + selected.name + '. <a href="/pages/country-intelligence#' + selected.slug + '">View ' + selected.name + ' intelligence</a>.';
    empty.hidden = visible.length !== 0;
  }

  function filterHomepage(selected) {
    document.querySelectorAll('[data-country-scope], [data-country-code], [data-country-slug], [data-case-card], .ma-case-grid-card, .boosted-card, .bp-card-shell, .spotlight-card, .ma-spotlight-card, .mpa-case-card').forEach(function(node) {
      if (!isCaseLike(node)) return;
      var show = shouldShowCountryScope(node, selected);
      node.hidden = !show;
      node.classList.toggle('country-mode-hidden', !show);
    });

    document.querySelectorAll('[data-country-surface], .mpa-cases-grid, .boosted-track, .spotlight-stage, .ma-spotlight-bar__grid, .blog-articles').forEach(function(container) {
      updateEmptyState(container, selected);
    });

    document.querySelectorAll('[data-country-heading]').forEach(function(heading) {
      var template = heading.getAttribute('data-country-heading') || 'Latest Missing Alerts in {country}';
      heading.textContent = template.replace('{country}', selected.name);
    });
  }

  function updateTopbar(country) {
    if (topbar) topbar.hidden = false;
    if (topbarText) topbarText.textContent = 'Showing Missing Alerts for ' + country.name;
    if (topbarIntelligence) {
      topbarIntelligence.textContent = 'View ' + country.name + ' intelligence';
      topbarIntelligence.href = '/pages/country-intelligence#' + country.slug;
    }
    document.querySelectorAll('[data-selected-country-label]').forEach(function(label) {
      label.textContent = 'Viewing: ' + country.name;
    });
    countryIntelligenceLinks.forEach(function(link) {
      link.href = '/pages/country-intelligence#' + country.slug;
    });
  }

  function updateDocumentCountry(country) {
    html.setAttribute('data-country', country.code);
    html.setAttribute('data-country-code', country.code.toUpperCase());
    html.setAttribute('data-country-slug', country.slug);
    html.setAttribute('data-currency', getCurrencyForCountry(country.code));
    html.setAttribute('data-language', getLanguageForCountry(country.code));
    if (body) {
      body.setAttribute('data-country-mode-ready', 'true');
      body.setAttribute('data-selected-country', country.code);
      body.setAttribute('data-selected-country-slug', country.slug);
    }
  }

  function updateWheelSelection(country, center) {
    if (!wheelTrack) return;
    wheelTrack.querySelectorAll('[data-country-card]').forEach(function(card) {
      var selected = card.getAttribute('data-country-code') === country.code;
      card.classList.toggle('is-selected', selected);
      card.setAttribute('aria-pressed', selected ? 'true' : 'false');
      var selectedNode = card.querySelector('.missing-alerts-country-card__selected');
      if (selectedNode) selectedNode.textContent = selected ? 'Selected' : '';
      if (selected && center !== false) {
        window.requestAnimationFrame(function() {
          card.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        });
      }
    });
    if (selectedText) selectedText.textContent = country.name + ' selected. Homepage sections will show only ' + country.name + ' appeals.';
  }

  function setCountry(country, options) {
    if (!country) return;
    selectedCountryCode = country.code;
    persistCountry(country);
    updateDocumentCountry(country);
    updateTopbar(country);
    updateWheelSelection(country, !(options && options.noCenter));
    filterHomepage(country);
    var detail = {
        country: country.code,
        countryCode: country.code.toUpperCase(),
        countrySlug: country.slug,
        countryName: country.name,
        currency: getCurrencyForCountry(country.code),
        language: getLanguageForCountry(country.code)
      };
    window.dispatchEvent(new CustomEvent('missing-alerts:country-change', { detail: detail }));
    document.dispatchEvent(new CustomEvent('country-mode:change', { detail: detail }));
  }

  function closePopup() {
    if (!popup) return;
    popup.hidden = true;
    popup.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('missing-alerts-country-popup-open');
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }

  function openPopup() {
    if (!popup) return;
    lastFocused = document.activeElement;
    popup.hidden = false;
    popup.setAttribute('aria-hidden', 'false');
    document.body.classList.add('missing-alerts-country-popup-open');
    var country = getCountryData(selectedCountryCode) || getSelectorCountry('gb');
    updateWheelSelection(country);
    var selectedButton = popup.querySelector('.missing-alerts-country-card.is-selected');
    window.setTimeout(function() {
      (selectedButton || wheelViewport || popup).focus();
    }, 40);
  }

  function buildWheel() {
    if (!wheelTrack) return;
    wheelTrack.innerHTML = '';
    selectorCountries.filter(function(country) {
      return country.enabledInSelector !== false;
    }).forEach(function(country) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'missing-alerts-country-card';
      button.setAttribute('data-country-card', '');
      button.setAttribute('data-country-code', country.code);
      button.setAttribute('data-country-slug', country.slug);
      button.setAttribute('aria-label', country.name + '. ' + country.status);
      button.setAttribute('aria-pressed', 'false');
      button.innerHTML = '<span class="missing-alerts-country-card__flag" aria-hidden="true">' + country.flag + '</span><span class="missing-alerts-country-card__name">' + country.name + '</span><span class="missing-alerts-country-card__status">' + country.status + '</span><span class="missing-alerts-country-card__selected" aria-hidden="true"></span>';
      button.addEventListener('click', function() {
        setCountry(country);
      });
      button.addEventListener('keydown', function(event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          setCountry(country);
        }
      });
      wheelTrack.appendChild(button);
    });
  }

  function moveWheel(direction) {
    if (!wheelViewport) return;
    wheelViewport.scrollBy({ left: direction * Math.max(150, wheelViewport.clientWidth * 0.42), behavior: 'smooth' });
  }

  function bindEvents() {
    document.querySelectorAll('[data-country-popup-close]').forEach(function(button) {
      button.addEventListener('click', closePopup);
    });
    changeButtons.forEach(function(button) {
      button.addEventListener('click', openPopup);
    });
    if (saveButton) {
      saveButton.addEventListener('click', function() {
        var country = getCountryData(selectedCountryCode) || getSelectorCountry('gb');
        setCountry(country);
        closePopup();
      });
    }
    if (prevButton) prevButton.addEventListener('click', function() { moveWheel(-1); });
    if (nextButton) nextButton.addEventListener('click', function() { moveWheel(1); });
    if (wheelViewport) {
      wheelViewport.addEventListener('keydown', function(event) {
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          moveWheel(-1);
        } else if (event.key === 'ArrowRight') {
          event.preventDefault();
          moveWheel(1);
        }
      });
      wheelViewport.addEventListener('wheel', function(event) {
        if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
          wheelViewport.scrollLeft += event.deltaY;
          event.preventDefault();
        }
      }, { passive: false });
    }
    document.addEventListener('keydown', function(event) {
      if (event.key === 'Escape' && popup && !popup.hidden) closePopup();
    });
  }

  function init() {
    buildWheel();
    bindEvents();
    var queryCountry = getQueryCountry();
    var storedCountry = parseStoredCountry();
    var initialCountry = queryCountry || storedCountry || null;

    if (initialCountry) {
      setCountry(initialCountry, { noCenter: true });
      closePopup();
    } else {
      var starterCountry = getSelectorCountry('gb');
      selectedCountryCode = starterCountry.code;
      updateDocumentCountry(starterCountry);
      updateTopbar(starterCountry);
      updateWheelSelection(starterCountry, false);
      openPopup();
    }
  }

  window.MissingAlertsCountryMode = {
    getCountry: function() {
      var stored = parseStoredCountry();
      return selectedCountryCode || (stored && stored.code) || '';
    },
    getCurrency: function() {
      return getCurrencyForCountry(selectedCountryCode || 'gb');
    },
    getLanguage: function() {
      return getLanguageForCountry(selectedCountryCode || 'gb');
    },
    openSelector: openPopup,
    refresh: function() {
      var country = getCountryData(selectedCountryCode) || parseStoredCountry() || getSelectorCountry('gb');
      setCountry(country, { noCenter: true });
    },
    setCountry: function(countryCode) {
      var country = getCountryData(countryCode);
      if (country) setCountry(country);
    },
    setLanguage: function(languageCode) {
      try {
        window.localStorage.setItem(languageStorageKey, languageCode || defaultLanguage);
      } catch (error) {}
    },
    config: config
  };

  init();
})();
