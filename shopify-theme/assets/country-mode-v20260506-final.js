/* MA_COUNTRY_MODE_VERIFIED_20260506_FINAL */
(function() {
  window.MA_COUNTRY_MODE_ASSET_VERSION = 'v20260506-final';
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
  var homepageGridLimit = 6;
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
  var languageToggle = document.querySelector('[data-language-toggle]');
  var languageMenu = document.querySelector('[data-language-menu]');
  var languageCurrent = document.querySelector('[data-language-current]');
  var cookieMaxAge = 60 * 60 * 24 * 180;
  var selectedCountryCode = null;
  var lastFocused = null;
  var visibilityBridgeCases = [
    ['kelowna-rcmp-seeks-public-assistance-in-locating-42-year-old-amanda-batchelar', 'Amanda Batchelar', 'ca', 'canada', 'Canada', 'Kelowna'],
    ['rcmp-seek-public-assistance-in-locating-cody-fieldhouse', 'Cody Fieldhouse', 'ca', 'canada', 'Canada', 'Canada'],
    ['have-you-seen-this-child-martha-wes-dunn', 'Martha Wes Dunn', 'us', 'united-states', 'United States', 'United States'],
    ['joel-anderson', 'Joel Anderson', 'au', 'australia', 'Australia', 'Australia'],
    ['trisha-anne-graf', 'Trisha Anne Graf', 'au', 'australia', 'Australia', 'Australia'],
    ['jack-smith', 'Jack Smith', 'gb', 'united-kingdom', 'United Kingdom', 'United Kingdom'],
    ['vitoria-barreto', 'Vitoria Barreto', 'gb', 'united-kingdom', 'United Kingdom', 'United Kingdom'],
    ['jan-hussain', 'Jan Hussain', 'gb', 'united-kingdom', 'United Kingdom', 'United Kingdom'],
    ['jan-hussain-live', 'Jan Hussain', 'gb', 'united-kingdom', 'United Kingdom', 'United Kingdom'],
    ['cake-bernstein-10-hartford-connecticut-united-states', 'Cake Bernstein', 'us', 'united-states', 'United States', 'Hartford'],
    ['kordell-flintshire', 'Kordell', 'gb', 'united-kingdom', 'United Kingdom', 'Flintshire'],
    ['cassidy-14-south-yorkshire', 'Cassidy, 14', 'gb', 'united-kingdom', 'United Kingdom', 'South Yorkshire'],
    ['lorraine-48-dorset', 'Lorraine, 48', 'gb', 'united-kingdom', 'United Kingdom', 'Dorset'],
    ['daniel-hackett-39-stockton', 'Daniel Hackett, 39', 'gb', 'united-kingdom', 'United Kingdom', 'Stockton'],
    ['shannon-kerr-25-glasgow', 'Shannon Kerr, 25', 'gb', 'united-kingdom', 'United Kingdom', 'Glasgow'],
    ['shaun-mccormack-31-glasgow', 'Shaun McCormack, 31', 'gb', 'united-kingdom', 'United Kingdom', 'Glasgow'],
    ['rebecca-roberts-18-newry', 'Rebecca Roberts, 18', 'gb', 'united-kingdom', 'United Kingdom', 'Newry'],
    ['jakub-bedfordshire', 'Jakub', 'gb', 'united-kingdom', 'United Kingdom', 'Bedfordshire'],
    ['jennifer-nottingham', 'Jennifer', 'gb', 'united-kingdom', 'United Kingdom', 'Nottingham'],
    ['alvin-diaz-72-devon', 'Alvin Diaz, 72', 'gb', 'united-kingdom', 'United Kingdom', 'Devon'],
    ['amelia-radford', 'Amelia', 'gb', 'united-kingdom', 'United Kingdom', 'Radford'],
    ['ethan-macleod-15-aberdeen', 'Ethan Macleod, 15', 'gb', 'united-kingdom', 'United Kingdom', 'Aberdeen'],
    ['codie-21-bournemouth-weymouth', 'Codie, 21', 'gb', 'united-kingdom', 'United Kingdom', 'Bournemouth'],
    ['rachel-reilly-age-unknown-fleetwood', 'Rachel Reilly', 'gb', 'united-kingdom', 'United Kingdom', 'Fleetwood']
  ];

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

  function languageLabel(languageCode) {
    var labels = {
      en: 'English',
      fr: 'Français',
      de: 'Deutsch',
      es: 'Español',
      it: 'Italiano',
      nl: 'Nederlands'
    };
    return labels[normalize(languageCode)] || 'English';
  }

  function getStoredLanguage() {
    var value = '';
    try {
      value = window.localStorage.getItem(languageStorageKey) || '';
    } catch (error) {}
    return normalize(value || defaultLanguage || 'en') || 'en';
  }

  function updateLanguageControl(languageCode) {
    var nextLanguage = normalize(languageCode || getStoredLanguage()) || 'en';
    if (languageCurrent) languageCurrent.textContent = languageLabel(nextLanguage);
    if (languageMenu) {
      languageMenu.querySelectorAll('[data-language-option]').forEach(function(option) {
        var selected = normalize(option.getAttribute('data-language-option')) === nextLanguage;
        option.classList.toggle('is-selected', selected);
        option.setAttribute('aria-pressed', selected ? 'true' : 'false');
      });
    }
    html.setAttribute('data-language', nextLanguage);
  }

  function setLanguage(languageCode) {
    var nextLanguage = normalize(languageCode || defaultLanguage || 'en') || 'en';
    try {
      window.localStorage.setItem(languageStorageKey, nextLanguage);
    } catch (error) {}
    updateLanguageControl(nextLanguage);
    window.dispatchEvent(new CustomEvent('missingAlertsLanguageChanged', {
      detail: { language: nextLanguage }
    }));
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

  function countryFromFreeText(text) {
    text = String(text || '').toLowerCase();
    if (!text) return '';
    if (/(united-states|united states|\busa\b|\bus\b|texas|california|connecticut|hartford)/.test(text)) return 'us';
    if (/(canada|\bca\b|british columbia|kelowna|rcmp)/.test(text)) return 'ca';
    if (/(australia|\bau\b|victoria|queensland|new south wales|woolworths george town|joel-anderson|trisha-anne-graf)/.test(text)) return 'au';
    if (/(new-zealand|new zealand|\bnz\b|otago)/.test(text)) return 'nz';
    if (/(ireland|\bie\b|dublin|cork|galway)/.test(text)) return 'ie';
    if (/(singapore|\bsg\b)/.test(text)) return 'sg';
    if (/(south-africa|south africa|\bza\b)/.test(text)) return 'za';
    if (/(united-kingdom|united kingdom|\buk\b|\bgb\b|england|scotland|wales|northern ireland|glasgow|dorset|bedfordshire|nottingham|devon|bournemouth|fleetwood|flintshire|south yorkshire|newry|aberdeen|stockton)/.test(text)) return 'gb';
    return '';
  }

  function isKnownCountry(value) {
    return ['gb', 'us', 'ca', 'au', 'nz', 'ie', 'sg', 'za'].indexOf(canonicalizeCountry(value)) !== -1;
  }

  function countryFromNode(node) {
    if (!node) return '';
    var attrs = [
      node.getAttribute('data-country-code'),
      node.getAttribute('data-country-slug'),
      node.getAttribute('data-country-name'),
      node.getAttribute('data-country'),
      node.getAttribute('data-country-scope')
    ];
    for (var i = 0; i < attrs.length; i += 1) {
      var country = canonicalizeCountry(attrs[i]);
      if (isKnownCountry(country)) return country;
    }
    var values = [
      node.getAttribute('href'),
      node.getAttribute('data-region'),
      node.getAttribute('data-admin1'),
      node.getAttribute('data-location'),
      node.getAttribute('data-search-text'),
      node.getAttribute('data-title'),
      node.textContent
    ].filter(Boolean).join(' ');
    return countryFromFreeText(values);
  }

  function caseIsActive(node) {
    var status = normalize((node && (node.getAttribute('data-status') || node.getAttribute('data-case-status'))) || '');
    return status.indexOf('found') === -1 &&
      status.indexOf('safe') === -1 &&
      status.indexOf('resolved') === -1 &&
      status.indexOf('located') === -1 &&
      status.indexOf('returned') === -1 &&
      status.indexOf('closed') === -1 &&
      status.indexOf('private') === -1 &&
      status.indexOf('review') === -1;
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

  function readCountryCookie() {
    return (document.cookie || '').split(';').reduce(function(value, part) {
      var trimmed = part.trim();
      return value || (trimmed.indexOf('missing_alerts_country=') === 0 ? decodeURIComponent(trimmed.slice('missing_alerts_country='.length)) : '');
    }, '');
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
      window.localStorage.setItem('selectedCountryCode', country.code.toUpperCase());
      window.localStorage.setItem('missingAlertsSelectedCountryCode', country.code.toUpperCase());
      window.localStorage.setItem('selectedCountry', country.name);
      window.localStorage.setItem('missingAlertsSelectedCountry', country.name);
      window.localStorage.setItem(currencyStorageKey, getCurrencyForCountry(country.code));
      window.localStorage.setItem(languageStorageKey, getLanguageForCountry(country.code));
    } catch (error) {
      // Storage can fail in private browsing; cookie still gives the server/client a lightweight country hint.
    }
    writeCookie(country);
  }

  function countryMatches(selected, node) {
    if (!selected) return true;
    var country = countryFromNode(node);
    if (!country) return false;
    return country === selected.code;
  }

  function isCaseLike(node) {
    if (!node) return false;
    if (node.hasAttribute('data-country-card') || node.closest('.missing-alerts-country-popup')) return false;
    if (node.hasAttribute('data-country-section')) return false;
    if (node.hasAttribute('data-country-surface')) return false;
    return node.matches('[data-case-card], .ma-case-grid-card, .boosted-card, .bp-card-shell, .spotlight-card, .ma-spotlight-card, .mpa-case-card, .article-card, [data-country-code], [data-country-slug]');
  }

  function getVisibilityBridgeCase(handle) {
    for (var i = 0; i < visibilityBridgeCases.length; i += 1) {
      if (visibilityBridgeCases[i][0] === handle) return visibilityBridgeCases[i];
    }
    return null;
  }

  function annotateCaseCard(card, record) {
    if (!card || !record) return;
    card.setAttribute('data-country-scope', record[2]);
    card.setAttribute('data-country-code', record[2]);
    card.setAttribute('data-country-slug', record[3]);
    card.setAttribute('data-country-name', record[4]);
    card.setAttribute('data-region', record[5] || '');
    card.setAttribute('data-status', 'active');
    card.setAttribute('data-boost-active', card.getAttribute('data-boost-active') || 'false');
    card.setAttribute('data-boost-score', card.getAttribute('data-boost-score') || '0');
    card.setAttribute('data-source-verified', 'true');
  }

  function normalizeCachedHomepageCards() {
    document.querySelectorAll('a[href*="/blogs/missing-persons/"]').forEach(function(link) {
      var handle = (link.getAttribute('href') || '').split('/blogs/missing-persons/').pop().split(/[?#]/)[0];
      var record = getVisibilityBridgeCase(handle);
      var card = link.querySelector('.mpa-case-card, .ma-case-grid-card, .bp-card-shell') || link.closest('.mpa-case-card, .ma-case-grid-card, .bp-card-shell');
      if (record && card) annotateCaseCard(card, record);
    });
  }

  function appendVisibilityBridgeCases() {
    var homeGrid = document.querySelector('.mpa-cases-grid');
    if (!homeGrid || homeGrid.getAttribute('data-visibility-bridge-ready') === 'true') return;
    homeGrid.setAttribute('data-visibility-bridge-ready', 'true');
    var existing = {};
    document.querySelectorAll('a[href*="/blogs/missing-persons/"]').forEach(function(link) {
      var handle = (link.getAttribute('href') || '').split('/blogs/missing-persons/').pop().split(/[?#]/)[0];
      if (handle) existing[handle] = true;
    });
    var existingCards = homeGrid.querySelectorAll('.mpa-case-link, .ma-case-grid-card').length;
    if (existingCards >= homepageGridLimit) return;
    visibilityBridgeCases.forEach(function(record) {
      if (homeGrid.querySelectorAll('.mpa-case-link, .ma-case-grid-card').length >= homepageGridLimit) return;
      if (existing[record[0]]) return;
      var link = document.createElement('a');
      link.href = '/blogs/missing-persons/' + record[0];
      link.className = 'mpa-case-link';
      link.innerHTML = '<div class="mpa-case-card" data-country-scope="' + record[2] + '" data-country-code="' + record[2] + '" data-country-slug="' + record[3] + '" data-country-name="' + record[4] + '" data-region="' + record[5] + '" data-status="active" data-case-handle="' + record[0] + '" data-boost-active="false" data-boost-score="0" data-source-verified="true"><div class="mpa-case-image-wrap"><img src="/cdn/shop/t/2/assets/missing-person-silhouette.svg" alt="' + record[1].replace(/"/g, '&quot;') + '" class="mpa-case-image" loading="lazy" width="700" height="700"><div class="mpa-case-badge">VERIFIED</div><span class="mpa-case-share-top">SHARE</span></div><div class="mpa-case-text"><div class="mpa-case-topline"><div class="mpa-case-meta">ACTIVE CASE</div><div class="mpa-case-location">' + record[5] + '</div></div><h3 class="mpa-case-title">' + record[1] + '</h3><p class="mpa-case-excerpt">Verified public Missing Alerts case record.</p></div></div>';
      homeGrid.appendChild(link);
    });
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

  function surfaceLimit(container) {
    if (!container) return homepageGridLimit;
    var declared = parseInt(container.getAttribute('data-ma-limit') || '', 10);
    if (declared > 0) return declared;
    if (container.classList.contains('ma-spotlight-grid') || container.classList.contains('ma-spotlight-bar__grid') || container.classList.contains('spotlight-stage')) return 3;
    if (container.classList.contains('ma-boost-grid') || container.classList.contains('boosted-track')) return 4;
    return homepageGridLimit;
  }

  function cardSelectorForSurface(container) {
    if (container.classList.contains('boosted-track')) return '.boosted-card';
    if (container.classList.contains('ma-spotlight-bar__grid')) return '.ma-spotlight-card';
    if (container.classList.contains('spotlight-stage')) return '.spotlight-card';
    return '.ma-case-grid-card, .mpa-case-link, .mpa-case-card, [data-case-card]';
  }

  function surfaceCards(container) {
    var selector = cardSelectorForSurface(container);
    var direct = Array.prototype.slice.call(container.children).filter(function(child) {
      return child.matches && child.matches(selector);
    });
    if (direct.length) return direct;
    return Array.prototype.slice.call(container.querySelectorAll(selector));
  }

  function chooseSpotlightCards(cards, selected, limit) {
    var matching = cards.filter(function(card) {
      return caseIsActive(card) && countryMatches(selected, card);
    });
    var paid = matching.filter(function(card) {
      return (card.getAttribute('data-card-type') || '').toLowerCase() === 'paid';
    });
    if (paid.length) return paid.slice(0, limit);
    return matching.sort(function(a, b) {
      var aPriority = parseInt(a.getAttribute('data-priority') || '3', 10);
      var bPriority = parseInt(b.getAttribute('data-priority') || '3', 10);
      return aPriority - bPriority;
    }).slice(0, limit);
  }

  function chooseSurfaceCards(container, cards, selected) {
    var limit = surfaceLimit(container);
    if (container.classList.contains('ma-spotlight-bar__grid')) {
      return chooseSpotlightCards(cards, selected, limit);
    }
    var matching = cards.filter(function(card) {
      return caseIsActive(card) && countryMatches(selected, card);
    });
    if (container.classList.contains('boosted-track')) {
      var paid = matching.filter(function(card) {
        return (card.getAttribute('data-card-type') || '').toLowerCase() === 'paid';
      });
      if (paid.length) return paid.slice(0, limit);
    }
    return matching.slice(0, limit);
  }

  function applySurfaceFiltering(selected) {
    document.querySelectorAll('[data-country-surface], .mpa-cases-grid, .boosted-track, .spotlight-stage, .ma-spotlight-bar__grid, .home-verified-case-grid__cards').forEach(function(container) {
      var cards = surfaceCards(container);
      if (!cards.length) return;
      var chosen = chooseSurfaceCards(container, cards, selected);
      cards.forEach(function(card) {
        var show = chosen.indexOf(card) !== -1;
        card.hidden = !show;
        card.classList.toggle('country-mode-hidden', !show);
        card.setAttribute('data-ma-runtime-hidden', show ? 'false' : 'true');
        if (show) {
          card.style.setProperty('display', 'block', 'important');
        } else {
          card.style.setProperty('display', 'none', 'important');
        }
        var country = countryFromNode(card);
        if (country && !card.getAttribute('data-country-code')) card.setAttribute('data-country-code', country);
        if (!card.getAttribute('data-active-case')) card.setAttribute('data-active-case', caseIsActive(card) ? 'true' : 'false');
      });
      updateEmptyState(container, selected);
      var localEmpty = container.parentElement && container.parentElement.querySelector('[data-country-empty]');
      if (localEmpty) localEmpty.style.display = chosen.length ? 'none' : 'block';
    });
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
    applySurfaceFiltering(selected);

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

  function getHomepageRuntimeCountry() {
    var queryCountry = getQueryCountry();
    if (queryCountry) return queryCountry;
    var storedCountry = parseStoredCountry();
    if (storedCountry) return storedCountry;
    var cookieCountry = getCountryData(readCountryCookie());
    if (cookieCountry) return cookieCountry;
    var documentCountry = getCountryData(
      html.getAttribute('data-country-code') ||
      html.getAttribute('data-country') ||
      (body && (body.getAttribute('data-selected-country') || body.getAttribute('data-country-code'))) ||
      ''
    );
    return documentCountry || null;
  }

  function getHomepageGrid() {
    return document.querySelector('.mpa-latest-layout .mpa-cases-grid') ||
      document.querySelector('.mpa-cases-wrap .mpa-cases-grid') ||
      document.querySelector('.mpa-cases-grid');
  }

  function getHomepageCard(item) {
    if (!item) return null;
    if (item.matches && item.matches('.mpa-case-card, .ma-case-grid-card, [data-case-card]')) return item;
    return item.querySelector('.mpa-case-card, .ma-case-grid-card, [data-case-card]');
  }

  function getCardTextCountry(item, card) {
    var text = [
      item && item.getAttribute('href'),
      item && item.getAttribute('data-country-code'),
      item && item.getAttribute('data-country-slug'),
      item && item.getAttribute('data-country-name'),
      card && card.getAttribute('data-country-code'),
      card && card.getAttribute('data-country-slug'),
      card && card.getAttribute('data-country-name'),
      card && card.getAttribute('data-region'),
      card && card.textContent
    ].filter(Boolean).join(' ').toLowerCase();
    if (!text) return '';
    if (/(united-states|united states|\busa\b|\bus\b|texas|california|connecticut|hartford)/.test(text)) return 'us';
    if (/(canada|\bca\b|british columbia|kelowna|rcmp)/.test(text)) return 'ca';
    if (/(australia|\bau\b|victoria|queensland|new south wales|joel-anderson|trisha-anne-graf)/.test(text)) return 'au';
    if (/(new-zealand|new zealand|\bnz\b|otago)/.test(text)) return 'nz';
    if (/(ireland|\bie\b|dublin|cork|galway)/.test(text)) return 'ie';
    if (/(singapore|\bsg\b)/.test(text)) return 'sg';
    if (/(south-africa|south africa|\bza\b)/.test(text)) return 'za';
    if (/(united-kingdom|united kingdom|\buk\b|\bgb\b|england|scotland|wales|northern ireland|glasgow|dorset|bedfordshire|nottingham|devon|bournemouth|fleetwood|flintshire|south yorkshire|newry|aberdeen|stockton)/.test(text)) return 'gb';
    return '';
  }

  function homepageCardCountry(item, card) {
    return canonicalizeCountry(
      (item && (item.getAttribute('data-country-code') || item.getAttribute('data-country-slug') || item.getAttribute('data-country-name') || item.getAttribute('data-country-scope'))) ||
      (card && (card.getAttribute('data-country-code') || card.getAttribute('data-country-slug') || card.getAttribute('data-country-name') || card.getAttribute('data-country-scope'))) ||
      getCardTextCountry(item, card)
    );
  }

  function homepageCardIsActive(item, card) {
    var status = normalize(
      (item && (item.getAttribute('data-status') || item.getAttribute('data-case-status'))) ||
      (card && (card.getAttribute('data-status') || card.getAttribute('data-case-status'))) ||
      ''
    );
    return status.indexOf('found') === -1 &&
      status.indexOf('safe') === -1 &&
      status.indexOf('resolved') === -1 &&
      status.indexOf('located') === -1 &&
      status.indexOf('returned') === -1 &&
      status.indexOf('closed') === -1 &&
      status.indexOf('private') === -1 &&
      status.indexOf('review') === -1;
  }

  function setHomepageCardVisible(item, visible) {
    item.hidden = !visible;
    item.classList.toggle('country-mode-hidden', !visible);
    item.setAttribute('data-ma-runtime-hidden', visible ? 'false' : 'true');
    if (visible) {
      item.style.setProperty('display', 'block', 'important');
    } else {
      item.style.setProperty('display', 'none', 'important');
    }
  }

  function ensureHomepageEmptyState(grid, country) {
    var wrap = grid.closest('.mpa-cases-wrap') || grid.parentElement;
    if (!wrap) return null;
    var empty = wrap.querySelector('.ma-country-runtime-empty');
    if (!empty) {
      empty = document.createElement('div');
      empty.className = 'ma-country-runtime-empty';
      empty.style.cssText = 'display:none;margin:8px 0;padding:14px 16px;border:1px solid rgba(255,255,255,.12);border-radius:10px;background:rgba(15,23,42,.72);color:#fff;font-weight:700;';
      wrap.appendChild(empty);
    }
    empty.textContent = country ? 'No active missing person appeals are currently available for ' + country.name + '.' : '';
    return empty;
  }

  function isHomepage() {
    var path = normalize(window.location.pathname).replace(/\/+$/, '');
    return path === '' || path === '/' || path === 'index';
  }

  function ensureSimplifiedHeaderStyles() {
    if (document.getElementById('ma-simplified-home-nav-runtime-style')) return;
    var style = document.createElement('style');
    style.id = 'ma-simplified-home-nav-runtime-style';
    style.textContent = [
      '.mpa-main-header-inner{grid-template-columns:auto minmax(220px,auto) 1fr!important;gap:16px!important;}',
      '.mpa-menu{display:flex!important;align-items:center!important;justify-content:flex-end!important;gap:8px!important;flex-wrap:nowrap!important;min-width:0!important;}',
      '.mpa-menu>a,.mpa-tools-menu>summary{padding:8px 12px!important;font-size:12px!important;white-space:nowrap!important;}',
      '.mpa-menu .mpa-buy-coffee-link{padding:8px 13px!important;background:linear-gradient(180deg,#f5c76b 0%,#b97712 100%)!important;color:#1b1006!important;border-color:rgba(255,255,255,.14)!important;font-weight:850!important;}',
      '.mpa-menu .mpa-buy-coffee-link:hover{color:#120b04!important;}',
      '.missing-alerts-language-control{display:inline-flex!important;visibility:visible!important;}',
      '@media(max-width:980px){.mpa-main-header-inner{grid-template-columns:auto 1fr!important}.mpa-menu{grid-column:1/-1!important;justify-content:flex-start!important;flex-wrap:wrap!important;}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function simplifyHeaderNavigation() {
    if (!isHomepage()) return;
    ensureSimplifiedHeaderStyles();
    var nav = document.querySelector('nav.mpa-menu');
    if (nav && nav.getAttribute('data-ma-simplified-nav') !== '20260507') {
      nav.setAttribute('data-ma-simplified-nav', '20260507');
      nav.innerHTML = [
        '<a href="/">Home</a>',
        '<a href="/blogs/missing-persons">Missing</a>',
        '<a href="/pages/missing-person-advice">Advice Hub</a>',
        '<details class="mpa-tools-menu">',
          '<summary>Tools</summary>',
          '<div class="mpa-tools-menu__panel">',
            '<a href="/pages/tools">Tools overview</a>',
            '<a href="/pages/country-intelligence">Country Intelligence</a>',
            '<a href="/blogs/found-safe">Found Safe</a>',
            '<a href="/pages/findtrax">FindTrax</a>',
            '<a href="/pages/intelpro">IntelPro</a>',
            '<a href="/pages/mediareach">MediaReach</a>',
            '<a href="/pages/professional-membership">Become a Professional</a>',
          '</div>',
        '</details>',
        '<a href="https://buymeacoffee.com/missingalerts" class="mpa-buy-coffee-link" target="_blank" rel="noopener noreferrer">Buy Me a Coffee</a>'
      ].join('');
    }

    var sideLinks = document.querySelector('#mpaSideMenu .mpa-side-links');
    if (sideLinks && sideLinks.getAttribute('data-ma-simplified-side-nav') !== '20260507') {
      sideLinks.setAttribute('data-ma-simplified-side-nav', '20260507');
      sideLinks.innerHTML = [
        '<a href="/blogs/missing-persons">View Missing Cases</a>',
        '<div class="mpa-side-tools">',
          '<p class="mpa-side-tools__title">Tools</p>',
          '<a href="/pages/tools">Tools overview</a>',
          '<a href="/pages/country-intelligence">Country Intelligence</a>',
          '<a href="/blogs/found-safe">Found Safe Updates</a>',
          '<a href="/pages/findtrax">FindTrax</a>',
          '<a href="/pages/intelpro">IntelPro</a>',
          '<a href="/pages/mediareach">MediaReach</a>',
          '<a href="/pages/professional-membership">Become a Professional</a>',
        '</div>',
        '<a href="/account/login?return_url=/pages/member-area" rel="nofollow">Member Login</a>',
        '<a href="https://buymeacoffee.com/missingalerts" target="_blank" rel="noopener noreferrer">Buy Me a Coffee</a>',
        '<a href="/pages/missing-person-advice">Advice Hub</a>',
        '<a href="/collections/affiliate-products">Recommended Products</a>',
        '<a href="/pages/contact">Contact</a>'
      ].join('');
    }

    var languageControl = document.querySelector('[data-language-control]');
    if (languageControl) {
      languageControl.hidden = false;
      languageControl.style.removeProperty('display');
      languageControl.style.visibility = 'visible';
      updateLanguageControl(getStoredLanguage());
    }
  }

  function cleanHomepageHeroOverlay() {
    if (!isHomepage()) return;
    document.querySelectorAll('.mpa-wrap, .mpa-inline-btn').forEach(function(node) {
      node.remove();
    });
    document.querySelectorAll('.mp-banner-deck__top').forEach(function(node) {
      if (/trusted global missing person platform/i.test(node.textContent || '')) node.remove();
    });
  }

  function applyHomepageNavRuntime() {
    window.MA_SIMPLIFIED_HOME_NAV_RUNTIME_VERSION = '20260507-buy-me-a-coffee';
    simplifyHeaderNavigation();
    cleanHomepageHeroOverlay();
  }

  function applyStaleHomepageCountryRuntime() {
    window.MA_COUNTRY_FILTER_RUNTIME_VERSION = '20260506-final-runtime';
    applyHomepageNavRuntime();
    var grid = getHomepageGrid();
    var selected = getHomepageRuntimeCountry();
    if (!grid || !selected) return;
    grid.setAttribute('data-ma-country-filter-runtime-version', '20260506-final-runtime');
    var visibleCount = 0;
    Array.prototype.slice.call(grid.children).forEach(function(item) {
      var card = getHomepageCard(item);
      if (!card) return;
      var country = homepageCardCountry(item, card);
      if (country && !item.getAttribute('data-country-code')) item.setAttribute('data-country-code', country);
      if (country && !card.getAttribute('data-country-code')) card.setAttribute('data-country-code', country);
      item.setAttribute('data-active-case', 'true');
      card.setAttribute('data-active-case', 'true');
      var show = homepageCardIsActive(item, card) && country === selected.code && visibleCount < homepageGridLimit;
      if (show) visibleCount += 1;
      setHomepageCardVisible(item, show);
    });
    var empty = ensureHomepageEmptyState(grid, selected);
    if (empty) empty.style.display = visibleCount === 0 ? 'block' : 'none';
    var heading = (grid.closest('.mpa-cases-wrap') || document).querySelector('.mpa-cases-head h2, [data-country-heading]');
    if (heading) heading.textContent = 'LATEST MISSING CASES - ' + selected.name.toUpperCase();
  }

  function scheduleStaleHomepageCountryRuntime() {
    applyHomepageNavRuntime();
    applyStaleHomepageCountryRuntime();
    var selected = getHomepageRuntimeCountry() || getCountryData(selectedCountryCode);
    if (selected) applySurfaceFiltering(selected);
    [50, 150, 500, 1300, 3500, 6500].forEach(function(delay) {
      window.setTimeout(function() {
        applyHomepageNavRuntime();
        applyStaleHomepageCountryRuntime();
        var current = getHomepageRuntimeCountry() || getCountryData(selectedCountryCode);
        if (current) applySurfaceFiltering(current);
      }, delay);
    });
  }

  function updateDocumentCountry(country) {
    html.setAttribute('data-country', country.code);
    html.setAttribute('data-country-code', country.code.toUpperCase());
    html.setAttribute('data-country-slug', country.slug);
    html.setAttribute('data-currency', getCurrencyForCountry(country.code));
    updateLanguageControl(getStoredLanguage() || getLanguageForCountry(country.code));
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
    window.setTimeout(applyStaleHomepageCountryRuntime, 0);
    window.setTimeout(applyStaleHomepageCountryRuntime, 500);
    var detail = {
      country: country.code,
      countryCode: country.code.toUpperCase(),
      countrySlug: country.slug,
      countryName: country.name,
      currency: getCurrencyForCountry(country.code),
      language: getLanguageForCountry(country.code)
    };
    window.dispatchEvent(new CustomEvent('missing-alerts:country-change', { detail: detail }));
    window.dispatchEvent(new CustomEvent('missingAlertsCountryChanged', { detail: detail }));
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
    window.addEventListener('pageshow', scheduleStaleHomepageCountryRuntime);
    window.addEventListener('storage', scheduleStaleHomepageCountryRuntime);
    window.addEventListener('missingAlertsCountryChanged', scheduleStaleHomepageCountryRuntime);
    window.addEventListener('missing-alerts:country-change', scheduleStaleHomepageCountryRuntime);
    document.addEventListener('country-mode:change', scheduleStaleHomepageCountryRuntime);
    document.addEventListener('DOMContentLoaded', scheduleStaleHomepageCountryRuntime);
  }

  function init() {
    buildWheel();
    bindEvents();
    normalizeCachedHomepageCards();
    appendVisibilityBridgeCases();
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
      filterHomepage(starterCountry);
      openPopup();
    }
    scheduleStaleHomepageCountryRuntime();
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
        setLanguage(languageCode || defaultLanguage);
      } catch (error) {}
    },
    config: config
  };

  init();
  updateLanguageControl(getStoredLanguage());
  if (languageToggle && languageMenu) {
    languageToggle.addEventListener('click', function() {
      var isOpen = !languageMenu.hidden;
      languageMenu.hidden = isOpen;
      languageToggle.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
    });
    document.addEventListener('click', function(event) {
      if (!event.target.closest('[data-language-control]')) {
        languageMenu.hidden = true;
        languageToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }
  document.querySelectorAll('[data-language-option]').forEach(function(option) {
    option.addEventListener('click', function() {
      setLanguage(option.getAttribute('data-language-option') || 'en');
      if (languageMenu) languageMenu.hidden = true;
      if (languageToggle) languageToggle.setAttribute('aria-expanded', 'false');
    });
  });
})();
