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
    if (topbar) topbar.hidden = isHomepage();
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
    updateCompactCountrySelector(country);
  }

  function compactCountrySelectorHtml() {
    return [
      '<details class="ma-compact-country-selector" data-country-compact-selector>',
        '<summary aria-label="Change country">',
          '<span class="ma-compact-country-selector__flag" data-country-compact-flag aria-hidden="true">🇬🇧</span>',
          '<span class="visually-hidden" data-country-compact-label>United Kingdom</span>',
        '</summary>',
        '<div class="ma-compact-country-selector__menu">',
          '<button type="button" data-country-compact-option="gb"><span aria-hidden="true">🇬🇧</span> United Kingdom</button>',
          '<button type="button" data-country-compact-option="us"><span aria-hidden="true">🇺🇸</span> United States</button>',
          '<button type="button" data-country-compact-option="ca"><span aria-hidden="true">🇨🇦</span> Canada</button>',
          '<button type="button" data-country-compact-option="au"><span aria-hidden="true">🇦🇺</span> Australia</button>',
          '<button type="button" data-country-compact-option="nz"><span aria-hidden="true">🇳🇿</span> New Zealand</button>',
          '<button type="button" data-country-compact-option="ie"><span aria-hidden="true">🇮🇪</span> Ireland</button>',
          '<button type="button" data-country-compact-option="sg"><span aria-hidden="true">🇸🇬</span> Singapore</button>',
          '<a class="ma-compact-country-selector__intelligence" href="/pages/country-intelligence" data-country-intelligence-link>Country intelligence</a>',
        '</div>',
      '</details>'
    ].join('');
  }

  function updateCompactCountrySelector(country) {
    var selected = country || getCountryData(selectedCountryCode) || getSelectorCountry('gb');
    document.querySelectorAll('[data-country-compact-selector]').forEach(function(selector) {
      var flag = selector.querySelector('[data-country-compact-flag]');
      var label = selector.querySelector('[data-country-compact-label]');
      var summary = selector.querySelector('summary');
      if (flag) flag.textContent = selected.flag || '🌍';
      if (label) label.textContent = selected.name;
      if (summary) summary.setAttribute('aria-label', 'Change country. Current country: ' + selected.name);
      selector.querySelectorAll('[data-country-compact-option]').forEach(function(option) {
        var isSelected = canonicalizeCountry(option.getAttribute('data-country-compact-option')) === selected.code;
        option.classList.toggle('is-selected', isSelected);
        option.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
      });
    });
  }

  function bindCompactCountrySelector() {
    if (document.documentElement.getAttribute('data-ma-compact-country-bound') === 'true') return;
    document.documentElement.setAttribute('data-ma-compact-country-bound', 'true');
    document.addEventListener('click', function(event) {
      var option = event.target.closest('[data-country-compact-option]');
      if (option) {
        var country = getCountryData(option.getAttribute('data-country-compact-option'));
        if (country) setCountry(country);
        var selector = option.closest('[data-country-compact-selector]');
        if (selector) selector.removeAttribute('open');
        return;
      }
      document.querySelectorAll('[data-country-compact-selector][open]').forEach(function(selector) {
        if (!selector.contains(event.target)) selector.removeAttribute('open');
      });
    });
    document.addEventListener('keydown', function(event) {
      if (event.key !== 'Escape') return;
      document.querySelectorAll('[data-country-compact-selector][open]').forEach(function(selector) {
        selector.removeAttribute('open');
      });
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
      '.mpa-main-header-inner{grid-template-columns:auto minmax(190px,auto) 1fr!important;gap:14px!important;}',
      '.ma-header-controls-stack,.ma-selected-country-label,#missing-alerts-country-top-bar{display:none!important;visibility:hidden!important;}',
      '.mpa-brand-block{gap:0!important;}',
      '.mpa-menu{display:flex!important;align-items:center!important;justify-content:flex-end!important;gap:7px!important;flex-wrap:nowrap!important;min-width:0!important;}',
      '.mpa-menu>a,.mpa-tools-menu>summary{padding:8px 12px!important;font-size:12px!important;white-space:nowrap!important;}',
      '.mpa-menu .mpa-buy-coffee-link{padding:8px 13px!important;background:linear-gradient(180deg,#f5c76b 0%,#b97712 100%)!important;color:#1b1006!important;border-color:rgba(255,255,255,.14)!important;font-weight:850!important;}',
      '.mpa-menu .mpa-buy-coffee-link:hover{color:#120b04!important;}',
      '.ma-compact-country-selector{position:relative!important;flex:0 0 auto!important;}',
      '.ma-compact-country-selector summary{width:38px!important;height:36px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;padding:0!important;border-radius:999px!important;border:1px solid rgba(255,255,255,.14)!important;background:linear-gradient(180deg,rgba(255,255,255,.10),rgba(255,255,255,.02)),#121418!important;color:#fff!important;cursor:pointer!important;list-style:none!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 8px 18px rgba(0,0,0,.22)!important;}',
      '.ma-compact-country-selector summary::-webkit-details-marker{display:none!important;}',
      '.ma-compact-country-selector[open] summary,.ma-compact-country-selector summary:hover{transform:translateY(-1px)!important;border-color:rgba(255,72,72,.45)!important;background:linear-gradient(180deg,rgba(255,255,255,.12),rgba(255,255,255,.03)),#181b21!important;}',
      '.ma-compact-country-selector__flag{font-size:18px!important;line-height:1!important;}',
      '.ma-compact-country-selector__menu{position:absolute!important;top:calc(100% + 10px)!important;right:0!important;z-index:10020!important;width:236px!important;padding:8px!important;border-radius:16px!important;border:1px solid rgba(255,255,255,.12)!important;background:radial-gradient(circle at top left,rgba(217,31,38,.22),transparent 40%),linear-gradient(180deg,rgba(20,22,28,.98),rgba(7,8,11,.98))!important;box-shadow:0 22px 52px rgba(0,0,0,.42)!important;}',
      '.ma-compact-country-selector__menu button,.ma-compact-country-selector__intelligence{width:100%!important;min-height:36px!important;display:flex!important;align-items:center!important;gap:9px!important;padding:8px 10px!important;border:0!important;border-radius:10px!important;background:transparent!important;color:rgba(255,255,255,.9)!important;font:inherit!important;font-size:12px!important;font-weight:800!important;text-align:left!important;text-decoration:none!important;cursor:pointer!important;}',
      '.ma-compact-country-selector__menu button:hover,.ma-compact-country-selector__menu button:focus-visible,.ma-compact-country-selector__menu button.is-selected,.ma-compact-country-selector__intelligence:hover,.ma-compact-country-selector__intelligence:focus-visible{background:rgba(255,255,255,.10)!important;color:#fff!important;outline:none!important;}',
      '.ma-compact-country-selector__intelligence{margin-top:6px!important;border-top:1px solid rgba(255,255,255,.08)!important;color:rgba(255,210,210,.92)!important;}',
      '@media(max-width:980px){.mpa-main-header-inner{grid-template-columns:auto 1fr!important}.mpa-menu{grid-column:1/-1!important;justify-content:flex-start!important;flex-wrap:wrap!important;}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function simplifyHeaderNavigation() {
    if (!isHomepage()) return;
    ensureSimplifiedHeaderStyles();
    var nav = document.querySelector('nav.mpa-menu');
    if (nav && nav.getAttribute('data-ma-simplified-nav') !== '20260507-flag') {
      nav.setAttribute('data-ma-simplified-nav', '20260507-flag');
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
        '<a href="https://buymeacoffee.com/missingalerts" class="mpa-buy-coffee-link" target="_blank" rel="noopener noreferrer">Buy Me a Coffee</a>',
        compactCountrySelectorHtml()
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
      languageControl.hidden = true;
      languageControl.style.setProperty('display', 'none', 'important');
      languageControl.style.visibility = 'hidden';
      updateLanguageControl(getStoredLanguage());
    }
    if (topbar) {
      topbar.hidden = true;
      topbar.style.setProperty('display', 'none', 'important');
    }
    document.querySelectorAll('[data-selected-country-label]').forEach(function(label) {
      label.hidden = true;
      label.style.setProperty('display', 'none', 'important');
    });
    bindCompactCountrySelector();
    updateCompactCountrySelector(getHomepageRuntimeCountry() || getCountryData(selectedCountryCode) || getSelectorCountry('gb'));
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
    window.MA_SIMPLIFIED_HOME_NAV_RUNTIME_VERSION = '20260507-compact-flag';
    simplifyHeaderNavigation();
    cleanHomepageHeroOverlay();
  }

  function ensurePremiumPlacementStyles() {
    if (document.getElementById('ma-premium-placement-runtime-style')) return;
    var style = document.createElement('style');
    style.id = 'ma-premium-placement-runtime-style';
    style.textContent = [
      '.ma-spotlight-bar.ma-premium-spotlight-runtime,.boosted-bar.ma-boosted-runtime{max-width:1280px!important;margin:18px auto!important;padding:18px!important;border-radius:22px!important;background:radial-gradient(circle at 15% 15%,rgba(255,44,44,.20),transparent 34%),linear-gradient(180deg,#13090b 0%,#090a0d 100%)!important;border:1px solid rgba(255,82,82,.24)!important;box-shadow:0 22px 58px rgba(0,0,0,.42),inset 0 1px 0 rgba(255,255,255,.06)!important;overflow:hidden!important;}',
      '.ma-premium-placement-head{display:flex!important;align-items:end!important;justify-content:space-between!important;gap:16px!important;margin:0 0 14px!important;}',
      '.ma-premium-placement-kicker{color:#ffb4a8!important;font-size:11px!important;font-weight:950!important;letter-spacing:.16em!important;text-transform:uppercase!important;}',
      '.ma-premium-placement-head h2{margin:4px 0 0!important;color:#fff!important;font-size:28px!important;line-height:1!important;font-weight:950!important;letter-spacing:.02em!important;text-transform:uppercase!important;}',
      '.ma-premium-placement-head p{margin:0!important;max-width:430px!important;color:rgba(255,232,220,.72)!important;font-size:13px!important;line-height:1.45!important;font-weight:750!important;text-align:right!important;}',
      '.ma-premium-placement-cta{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-height:34px!important;padding:8px 12px!important;border-radius:999px!important;background:linear-gradient(180deg,#ff4f4f,#b11119)!important;color:#fff!important;text-decoration:none!important;font-size:11px!important;font-weight:950!important;letter-spacing:.08em!important;text-transform:uppercase!important;border:1px solid rgba(255,255,255,.12)!important;white-space:nowrap!important;}',
      '.ma-spotlight-bar.ma-premium-spotlight-runtime .ma-spotlight-bar__head{display:none!important;}',
      '.ma-spotlight-bar.ma-premium-spotlight-runtime .ma-spotlight-bar__grid{display:grid!important;grid-template-columns:1.2fr .9fr .9fr!important;gap:14px!important;align-items:stretch!important;}',
      '.ma-premium-placement-card{position:relative!important;display:flex!important;min-height:220px!important;aspect-ratio:16/10!important;border-radius:18px!important;overflow:hidden!important;text-decoration:none!important;color:#fff!important;background:#15171d!important;border:1px solid rgba(255,255,255,.10)!important;box-shadow:0 14px 36px rgba(0,0,0,.32)!important;}',
      '.ma-premium-placement-card:first-child{min-height:292px!important;grid-row:span 2!important;}',
      '.ma-premium-placement-card:before{content:""!important;position:absolute!important;inset:0!important;background:linear-gradient(180deg,rgba(0,0,0,.05),rgba(0,0,0,.88))!important;z-index:1!important;}',
      '.ma-premium-placement-card img{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;object-fit:cover!important;object-position:center!important;filter:saturate(.94) contrast(1.02)!important;}',
      '.ma-premium-placement-card__body{position:relative!important;z-index:2!important;align-self:flex-end!important;padding:14px!important;min-width:0!important;}',
      '.ma-premium-placement-card__tag{display:inline-flex!important;margin:0 0 8px!important;padding:5px 8px!important;border-radius:999px!important;background:rgba(220,38,38,.86)!important;color:#fff!important;font-size:10px!important;font-weight:950!important;letter-spacing:.08em!important;text-transform:uppercase!important;}',
      '.ma-premium-placement-card__title{display:-webkit-box!important;-webkit-line-clamp:2!important;-webkit-box-orient:vertical!important;overflow:hidden!important;margin:0!important;color:#fff!important;font-size:17px!important;line-height:1.12!important;font-weight:950!important;}',
      '.ma-premium-placement-card:first-child .ma-premium-placement-card__title{font-size:24px!important;}',
      '.ma-premium-placement-card__meta{margin:7px 0 0!important;color:rgba(255,236,226,.76)!important;font-size:12px!important;font-weight:800!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;}',
      '.ma-boosted-runtime .boosted-bar-inner{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(280px,320px)!important;gap:14px!important;position:relative!important;}',
      '.ma-boosted-runtime .boosted-header,.ma-boosted-runtime .boosted-viewport{display:none!important;}',
      '.ma-boosted-runtime-grid{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:12px!important;}',
      '.ma-boosted-runtime-sidebar{display:grid!important;gap:9px!important;padding:12px!important;border-radius:16px!important;background:rgba(255,255,255,.045)!important;border:1px solid rgba(255,255,255,.10)!important;}',
      '.ma-boosted-runtime-sidebar .ma-premium-placement-card{min-height:86px!important;aspect-ratio:auto!important;}',
      '.ma-boosted-runtime-sidebar .ma-premium-placement-card__body{padding:10px!important;}',
      '.ma-boosted-runtime-sidebar .ma-premium-placement-card__title{font-size:12px!important;}',
      '.ma-boosted-runtime-sidebar img{width:76px!important;height:100%!important;right:auto!important;}',
      '.boosted-sidebar-section.ma-runtime-hidden-old-boost,.boosted-bar.ma-runtime-hidden-old-boost{display:none!important;}',
      '.ma-premium-placement-empty{padding:14px 16px!important;border-radius:14px!important;background:rgba(255,255,255,.05)!important;border:1px solid rgba(255,255,255,.10)!important;color:rgba(255,255,255,.78)!important;font-weight:800!important;}',
      '@media(max-width:980px){.ma-spotlight-bar.ma-premium-spotlight-runtime .ma-spotlight-bar__grid,.ma-boosted-runtime .boosted-bar-inner{grid-template-columns:1fr!important}.ma-boosted-runtime-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}.ma-premium-placement-head{align-items:flex-start!important;flex-direction:column!important}.ma-premium-placement-head p{text-align:left!important}.ma-premium-placement-card:first-child{grid-row:auto!important;min-height:230px!important}}',
      '@media(max-width:640px){.ma-boosted-runtime-grid{grid-template-columns:1fr!important}.ma-premium-placement-card,.ma-premium-placement-card:first-child{min-height:205px!important}.ma-premium-placement-head h2{font-size:23px!important}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function stablePlacementScore(seed, value) {
    var text = String(seed || '') + '|' + String(value || '');
    var hash = 2166136261;
    for (var i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return hash >>> 0;
  }

  function placementSeed(country) {
    var day = new Date().toISOString().slice(0, 10);
    return day + '-' + (country && country.code ? country.code : 'gb');
  }

  function placementImage(node) {
    var img = node && node.querySelector ? node.querySelector('img') : null;
    return img && (img.currentSrc || img.src || img.getAttribute('src')) || '/cdn/shop/t/2/assets/missing-person-silhouette.svg';
  }

  function placementTitle(node) {
    var title = node && node.querySelector ? node.querySelector('.ma-spotlight-card__title,.mpa-case-title,.bp-card__title,h3,h2,strong') : null;
    return title && title.textContent ? title.textContent.trim() : 'Missing person appeal';
  }

  function placementMeta(node, country) {
    var meta = node && node.querySelector ? node.querySelector('.ma-spotlight-card__meta,.mpa-case-location,.bp-card__meta,.mpa-case-meta') : null;
    return meta && meta.textContent ? meta.textContent.trim() : (country && country.name ? country.name : 'Active appeal');
  }

  function placementHref(node) {
    if (!node) return '/blogs/missing-persons';
    if (node.matches && node.matches('a[href]')) return node.href || node.getAttribute('href');
    var link = node.querySelector && node.querySelector('a[href]');
    return link ? (link.href || link.getAttribute('href')) : '/blogs/missing-persons';
  }

  function placementHandle(node) {
    var href = placementHref(node);
    return (node && (node.getAttribute('data-case-handle') || node.getAttribute('data-handle'))) ||
      String(href || '').split('/blogs/missing-persons/').pop().split(/[?#]/)[0] ||
      placementTitle(node);
  }

  function collectHomepagePlacementCases(country) {
    var seen = {};
    var nodes = Array.prototype.slice.call(document.querySelectorAll('.ma-spotlight-card,.boosted-card,.bp-card-shell,.mpa-case-link,.mpa-case-card,.ma-home-case-card'));
    return nodes.map(function(node) {
      var card = getHomepageCard(node) || node;
      var detectedCountry = homepageCardCountry(node, card) || countryFromNode(card);
      var handle = placementHandle(node);
      var href = placementHref(node);
      var key = href || handle;
      if (!key || seen[key]) return null;
      seen[key] = true;
      return {
        node: node,
        card: card,
        handle: handle,
        href: href,
        title: placementTitle(node),
        meta: placementMeta(node, country),
        image: placementImage(node),
        country: detectedCountry,
        active: homepageCardIsActive(node, card),
        paidSpotlight: normalize((node.getAttribute('data-card-type') || card.getAttribute('data-card-type') || '')).indexOf('paid') !== -1,
        paidBoost: normalize((node.getAttribute('data-paid-boost') || card.getAttribute('data-paid-boost') || node.getAttribute('data-boost-active') || card.getAttribute('data-boost-active') || '')).indexOf('true') !== -1,
        boostPoints: parseInt(node.getAttribute('data-boost-points') || card.getAttribute('data-boost-points') || node.getAttribute('data-boost-score') || card.getAttribute('data-boost-score') || '0', 10) || 0,
        sourceVerified: normalize(node.getAttribute('data-source-verified') || card.getAttribute('data-source-verified') || '').indexOf('true') !== -1
      };
    }).filter(function(item) {
      return item && item.active && item.country === country.code;
    });
  }

  function choosePlacementCases(cases, country, limit, paidKey, excludeHandles) {
    var excluded = excludeHandles || {};
    var eligible = cases.filter(function(item) {
      return !excluded[item.handle];
    });
    var paid = eligible.filter(function(item) {
      return paidKey === 'paidSpotlight' ? item.paidSpotlight : item.paidBoost || item.boostPoints > 0;
    });
    if (paid.length) {
      paid.sort(function(a, b) {
        return (b.boostPoints || 0) - (a.boostPoints || 0) || stablePlacementScore(placementSeed(country), a.handle) - stablePlacementScore(placementSeed(country), b.handle);
      });
      return paid.slice(0, limit);
    }
    eligible.sort(function(a, b) {
      var sourceDelta = (b.sourceVerified ? 1 : 0) - (a.sourceVerified ? 1 : 0);
      if (sourceDelta) return sourceDelta;
      return stablePlacementScore(placementSeed(country), a.handle) - stablePlacementScore(placementSeed(country), b.handle);
    });
    return eligible.slice(0, limit);
  }

  function placementCardHtml(item, label) {
    return [
      '<a class="ma-premium-placement-card ma-home-case-card" href="', item.href, '" data-country-code="', item.country, '" data-status="active" data-case-handle="', item.handle.replace(/"/g, '&quot;'), '">',
        '<img src="', item.image, '" alt="', item.title.replace(/"/g, '&quot;'), '" loading="lazy">',
        '<span class="ma-premium-placement-card__body">',
          '<span class="ma-premium-placement-card__tag">', label, '</span>',
          '<strong class="ma-premium-placement-card__title">', item.title, '</strong>',
          '<span class="ma-premium-placement-card__meta">', item.meta, '</span>',
        '</span>',
      '</a>'
    ].join('');
  }

  function renderPremiumSpotlightRuntime(country, cases) {
    var section = document.querySelector('.ma-spotlight-bar');
    if (!section || !country) return {};
    section.classList.add('ma-premium-spotlight-runtime', 'ma-premium-spotlight');
    section.setAttribute('data-ma-premium-runtime', '20260507');
    var oldEyebrow = section.querySelector('.ma-spotlight-bar__eyebrow');
    if (oldEyebrow) oldEyebrow.textContent = 'Premium visibility placement';
    var grid = section.querySelector('.ma-spotlight-bar__grid') || section.querySelector('.ma-spotlight-grid');
    if (!grid) return {};
    var selected = choosePlacementCases(cases, country, 3, 'paidSpotlight');
    var paidLive = selected.some(function(item) { return item.paidSpotlight; });
    var selectedHandles = {};
    selected.forEach(function(item) { selectedHandles[item.handle] = true; });
    var head = section.querySelector('.ma-premium-placement-head');
    if (!head) {
      head = document.createElement('div');
      head.className = 'ma-premium-placement-head';
      section.insertBefore(head, grid);
    }
    head.innerHTML = [
      '<div><div class="ma-premium-placement-kicker">Premium visibility placement</div><h2>SPOTLIGHT CASES</h2></div>',
      '<p>', paidLive ? 'Paid spotlight cases are being shown first for ' + country.name + '.' : 'Fallback spotlight - no paid spotlight is live in ' + country.name + '.', '</p>',
      '<a class="ma-premium-placement-cta" href="/products/primary-spotlight-24-hours">Get Spotlight Placement</a>'
    ].join('');
    grid.innerHTML = selected.length ? selected.map(function(item) {
      return placementCardHtml(item, item.paidSpotlight ? 'Paid spotlight' : 'Fallback spotlight');
    }).join('') : '<div class="ma-premium-placement-empty">No active spotlight-eligible appeals are currently available for ' + country.name + '.</div>';
    return selectedHandles;
  }

  function renderBoostedRuntime(country, cases, spotlightHandles) {
    var section = document.querySelector('.boosted-bar');
    if (!section || !country) return;
    section.classList.add('ma-boosted-runtime', 'ma-boosted-appeals');
    section.setAttribute('data-ma-boosted-runtime', '20260507');
    var selected = choosePlacementCases(cases, country, 4, 'paidBoost', spotlightHandles);
    if (!selected.length) selected = choosePlacementCases(cases, country, 4, 'paidBoost');
    var paidLive = selected.some(function(item) { return item.paidBoost || item.boostPoints > 0; });
    var inner = section.querySelector('.boosted-bar-inner') || section;
    inner.innerHTML = [
      '<div>',
        '<div class="ma-premium-placement-head">',
          '<div><div class="ma-premium-placement-kicker">Priority visibility</div><h2>BOOSTED APPEALS</h2></div>',
          '<p>', paidLive ? 'Paid boosted appeals are ranked first for ' + country.name + '.' : 'No paid boosts live - showing priority appeals from ' + country.name + '.', '</p>',
          '<a class="ma-premium-placement-cta" href="/products/boost-appeal-24-hours">Boost a Case</a>',
        '</div>',
        '<div class="ma-boosted-runtime-grid">',
          selected.length ? selected.map(function(item) { return placementCardHtml(item, item.paidBoost || item.boostPoints > 0 ? 'Boosted' : 'Priority appeal'); }).join('') : '<div class="ma-premium-placement-empty">No active boost-eligible appeals are currently available for ' + country.name + '.</div>',
        '</div>',
      '</div>',
      '<aside class="ma-boosted-runtime-sidebar" aria-label="Boosted appeals sidebar">',
        selected.length ? selected.map(function(item) { return placementCardHtml(item, item.paidBoost || item.boostPoints > 0 ? 'Boosted' : 'Priority appeal'); }).join('') : '<div class="ma-premium-placement-empty">No active appeals for this country.</div>',
      '</aside>'
    ].join('');
  }

  function applyPremiumPlacementRuntime() {
    if (!isHomepage()) return;
    window.MA_PREMIUM_PLACEMENT_RUNTIME_VERSION = '20260507-spotlight-boosted';
    ensurePremiumPlacementStyles();
    var country = getHomepageRuntimeCountry() || getCountryData(selectedCountryCode) || getSelectorCountry('gb');
    if (!country) return;
    document.querySelectorAll('.boosted-sidebar-section').forEach(function(section) {
      section.classList.add('ma-runtime-hidden-old-boost');
      section.hidden = true;
    });
    var cases = collectHomepagePlacementCases(country);
    var spotlightHandles = renderPremiumSpotlightRuntime(country, cases);
    renderBoostedRuntime(country, cases, spotlightHandles);
  }

  function applyStaleHomepageCountryRuntime() {
    window.MA_COUNTRY_FILTER_RUNTIME_VERSION = '20260506-final-runtime';
    applyHomepageNavRuntime();
    applyPremiumPlacementRuntime();
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
    applyPremiumPlacementRuntime();
    applyStaleHomepageCountryRuntime();
    var selected = getHomepageRuntimeCountry() || getCountryData(selectedCountryCode);
    if (selected) applySurfaceFiltering(selected);
    [50, 150, 500, 1300, 3500, 6500].forEach(function(delay) {
      window.setTimeout(function() {
        applyHomepageNavRuntime();
        applyPremiumPlacementRuntime();
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
    bindCompactCountrySelector();
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
      closePopup();
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
