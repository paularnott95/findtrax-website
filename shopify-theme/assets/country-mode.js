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
  var languages = config.languages || {};
  var storageKey = config.storageKey || 'missingAlertsCountry';
  var currencyStorageKey = config.currencyStorageKey || 'missingAlertsCurrency';
  var languageStorageKey = config.languageStorageKey || 'missingAlertsLanguage';
  var defaultCountry = countries.global ? 'global' : (config.defaultCountry || 'global');
  var defaultCurrency = config.defaultCurrency || 'GBP';
  var defaultLanguage = config.defaultLanguage || 'en';
  var html = document.documentElement;
  var body = document.body;
  var popup = document.getElementById('missing-alerts-country-popup');
  var popupTitle = popup ? popup.querySelector('.missing-alerts-country-popup__title') : null;
  var popupSaveButton = popup ? popup.querySelector('[data-country-save]') : null;
  var popupGlobalButton = popup ? popup.querySelector('[data-country-select-global]') : null;

  var countryAliases = {
    gb: ['gb', 'uk'],
    uk: ['gb', 'uk']
  };

  var dictionary = {
    en: {
      selectYourCountry: 'SELECT YOUR COUNTRY',
      continueLabel: 'Continue',
      stayGlobal: 'Stay Global'
    }
  };

  function translate(key, languageCode) {
    var locale = dictionary[languageCode] || dictionary.en;
    return locale[key] || dictionary.en[key] || '';
  }

  function canonicalizeCountry(value) {
    var normalized = String(value || '').toLowerCase();
    if (normalized === 'uk') return 'gb';
    return normalized;
  }

  function normalizeCountry(value) {
    var normalized = canonicalizeCountry(value);
    if (countries[normalized]) return normalized;
    return defaultCountry;
  }

  function normalizeLanguage(value) {
    var normalized = String(value || '').toLowerCase();
    if (languages[normalized]) return normalized;
    return defaultLanguage;
  }

  function getCountryData(countryCode) {
    return countries[normalizeCountry(countryCode)] || countries[defaultCountry];
  }

  function getLanguageData(languageCode) {
    return languages[normalizeLanguage(languageCode)] || languages[defaultLanguage];
  }

  function getLanguageForCountry(countryCode) {
    return getCountryData(countryCode).language || defaultLanguage;
  }

  function getCurrencyForCountry(countryCode) {
    return getCountryData(countryCode).currency || defaultCurrency;
  }

  function getCurrentCountry() {
    return normalizeCountry(html.getAttribute('data-country') || window.localStorage.getItem(storageKey) || defaultCountry);
  }

  function getCurrentLanguage() {
    return normalizeLanguage(html.getAttribute('data-language') || window.localStorage.getItem(languageStorageKey) || getLanguageForCountry(getCurrentCountry()));
  }

  function getCurrentCurrency() {
    return html.getAttribute('data-currency') || window.localStorage.getItem(currencyStorageKey) || getCurrencyForCountry(getCurrentCountry());
  }

  function setHtmlAttributes(countryCode, currencyCode, languageCode) {
    html.setAttribute('data-country', countryCode);
    html.setAttribute('data-currency', currencyCode);
    html.setAttribute('data-language', languageCode);
  }

  function formatCountryLabel(countryCode) {
    var country = getCountryData(countryCode);
    return (country.flag ? country.flag + ' ' : '') + country.label;
  }

  function formatLanguageLabel(languageCode) {
    return getLanguageData(languageCode).label;
  }

  function updateSelectedCountryLabels() {
    var country = getCountryData(getCurrentCountry());
    var text = 'Viewing: ' + (country && country.label ? country.label : 'Global');
    document.querySelectorAll('[data-selected-country-label]').forEach(function(node) {
      node.textContent = text;
    });
  }

  function getScopeAliases(value) {
    var normalized = canonicalizeCountry(value);
    return countryAliases[normalized] || [normalized];
  }

  function shouldShowScope(scope, selectedCountry) {
    var normalizedScope = String(scope || 'all').toLowerCase();
    if (!normalizedScope || normalizedScope === 'all') return true;
    if (selectedCountry === 'global') return normalizedScope !== 'hidden';
    if (normalizedScope === 'global') return false;

    var validCountries = getScopeAliases(selectedCountry);
    return normalizedScope.split(',').map(function(item) {
      return canonicalizeCountry(item.trim());
    }).some(function(item) {
      return validCountries.indexOf(item) !== -1;
    });
  }

  function applyCountryScope() {
    var selectedCountry = getCurrentCountry();
    document.querySelectorAll('[data-country-scope]').forEach(function(node) {
      var show = shouldShowScope(node.getAttribute('data-country-scope'), selectedCountry);
      node.hidden = !show;
      node.classList.toggle('country-mode-hidden', !show);
    });
  }

  function applyCountryPrices() {
    var currency = String(getCurrentCurrency() || '').toLowerCase();
    var attributeMap = {
      gbp: 'data-currency-price-gbp',
      usd: 'data-currency-price-usd',
      cad: 'data-currency-price-cad',
      aud: 'data-currency-price-aud'
    };

    document.querySelectorAll('[data-country-price]').forEach(function(node) {
      var attributeName = attributeMap[currency] || attributeMap.gbp;
      var priceValue = node.getAttribute(attributeName) || node.getAttribute(attributeMap.gbp);
      if (priceValue) node.textContent = priceValue;
    });
  }

  function clearGeneratedTestCases(container) {
    if (!container) return;
    container.querySelectorAll('[data-generated-test-case]').forEach(function(node) {
      node.remove();
    });
  }

  function ensureEmptyState(container) {
    if (!container) return null;
    var existing = container.querySelector('.country-mode-empty-state');
    if (existing) return existing;
    var node = document.createElement('div');
    node.className = 'country-mode-empty-state';
    node.hidden = true;
    node.textContent = 'No active missing-person cases are currently listed for this country.';
    container.appendChild(node);
    return node;
  }

  function getVisibleScopedItems(container) {
    if (!container) return [];
    return Array.prototype.filter.call(
      container.querySelectorAll('[data-country-scope]'),
      function(node) {
        if (node.closest('.country-mode-empty-state')) return false;
        if (node.hasAttribute('data-generated-test-case')) return false;
        return !node.hidden && !node.classList.contains('country-mode-hidden');
      }
    );
  }

  function applyCountryTestSurfaces() {
    var selectedCountry = getCurrentCountry();

    document.querySelectorAll('[data-country-surface],[data-country-test-surface]').forEach(function(container) {
      var surfaceType = container.getAttribute('data-country-surface') || container.getAttribute('data-country-test-surface') || 'mpa-grid';
      var emptyState = ensureEmptyState(container);
      var spotlightStage = surfaceType === 'spotlight' ? container.closest('.spotlight-system').querySelector('.spotlight-stage') : null;
      var liveContainer = spotlightStage || container;

      clearGeneratedTestCases(container);
      if (emptyState) emptyState.hidden = true;
      if (spotlightStage) spotlightStage.hidden = false;
      if (surfaceType === 'spotlight') container.hidden = true;

      var visibleItems = getVisibleScopedItems(liveContainer);
      if (visibleItems.length > 0 || selectedCountry === 'global') {
        return;
      }

      if (emptyState) emptyState.hidden = false;
      if (spotlightStage) spotlightStage.hidden = true;
      if (surfaceType === 'spotlight') container.hidden = false;
    });
  }

  function closePopup() {
    if (!popup) return;
    popup.hidden = true;
    popup.setAttribute('aria-hidden', 'true');
  }

  function openPopup() {
    if (!popup) return;
    popup.hidden = false;
    popup.setAttribute('aria-hidden', 'false');
    syncContextFromCurrent(popupContext);
  }

  function saveState(countryCode, languageCode) {
    var normalizedCountry = normalizeCountry(countryCode);
    var normalizedLanguage = normalizeLanguage(languageCode || getLanguageForCountry(normalizedCountry));
    var normalizedCurrency = getCurrencyForCountry(normalizedCountry);

    window.localStorage.setItem(storageKey, normalizedCountry);
    window.localStorage.setItem(currencyStorageKey, normalizedCurrency);
    window.localStorage.setItem(languageStorageKey, normalizedLanguage);

    setHtmlAttributes(normalizedCountry, normalizedCurrency, normalizedLanguage);
    refresh();
  }

  function refreshPopupLabels() {
    var languageCode = getCurrentLanguage();
    if (popupTitle) popupTitle.textContent = translate('selectYourCountry', languageCode);
    if (popupSaveButton) popupSaveButton.textContent = translate('continueLabel', languageCode);
    if (popupGlobalButton) popupGlobalButton.textContent = translate('stayGlobal', languageCode);
  }

  function filterItems(items, query) {
    var normalizedQuery = String(query || '').toLowerCase().trim();
    if (!normalizedQuery) return items.slice(0, 30);
    return items.filter(function(item) {
      return item.search.indexOf(normalizedQuery) !== -1;
    }).slice(0, 30);
  }

  function closeAllLists(exceptContext, exceptType) {
    [topbarContext, popupContext].forEach(function(context) {
      ['country', 'language'].forEach(function(type) {
        if (context === exceptContext && type === exceptType) return;
        closeList(context[type]);
      });
    });
  }

  function closeList(control) {
    if (!control || !control.list) return;
    control.list.hidden = true;
    control.activeIndex = -1;
  }

  function openList(control) {
    if (!control || !control.list) return;
    control.list.hidden = false;
  }

  function renderList(context, type) {
    var control = context[type];
    if (!control) return;

    var items = type === 'country' ? countryOptions : languageOptions;
    var filtered = filterItems(items, control.input.value);
    control.filteredItems = filtered;
    control.list.innerHTML = '';

    if (!filtered.length) {
      closeList(control);
      return;
    }

    filtered.forEach(function(item, index) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'missing-alerts-country-combobox__option' + (index === 0 ? ' is-active' : '');
      button.innerHTML = item.html;
      button.addEventListener('click', function() {
        applySelection(context, type, item.value);
      });
      control.list.appendChild(button);
    });

    control.activeIndex = 0;
    openList(control);
  }

  function setDisplayedValues(context) {
    if (context.country && context.country.input) {
      context.country.input.value = formatCountryLabel(context.state.country);
    }
    if (context.language && context.language.input) {
      context.language.input.value = formatLanguageLabel(context.state.language);
    }
  }

  function applySelection(context, type, value) {
    if (type === 'country') {
      context.state.country = normalizeCountry(value);
      if (context.mode === 'topbar') {
        context.state.language = getLanguageForCountry(context.state.country);
        saveState(context.state.country, context.state.language);
      } else {
        context.state.language = getLanguageForCountry(context.state.country);
      }
    } else {
      context.state.language = normalizeLanguage(value);
      if (context.mode === 'topbar') {
        saveState(context.state.country, context.state.language);
      }
    }

    setDisplayedValues(context);
    renderList(context, type);
    closeList(context[type]);
  }

  function handleEnter(context, type) {
    var control = context[type];
    if (!control || !control.filteredItems || !control.filteredItems.length) return;
    applySelection(context, type, control.filteredItems[Math.max(control.activeIndex, 0)].value);
  }

  function bindCombobox(context, type) {
    var control = context[type];
    if (!control || !control.input || !control.list) return;

    control.input.addEventListener('focus', function() {
      closeAllLists(context, type);
      renderList(context, type);
      control.input.select();
    });

    control.input.addEventListener('input', function() {
      closeAllLists(context, type);
      renderList(context, type);
    });

    control.input.addEventListener('keydown', function(event) {
      if (event.key === 'Escape') {
        closeList(control);
        setDisplayedValues(context);
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        handleEnter(context, type);
      }
    });
  }

  function createContext(mode, root) {
    return {
      mode: mode,
      root: root,
      state: {
        country: getCurrentCountry(),
        language: getCurrentLanguage()
      },
      country: {
        wrapper: root ? root.querySelector('[data-country-combobox]') : null,
        input: root ? root.querySelector('[data-country-input]') : null,
        list: root ? root.querySelector('[data-country-list]') : null,
        filteredItems: [],
        activeIndex: -1
      },
      language: {
        wrapper: root ? root.querySelector('[data-language-combobox]') : null,
        input: root ? root.querySelector('[data-language-input]') : null,
        list: root ? root.querySelector('[data-language-list]') : null,
        filteredItems: [],
        activeIndex: -1
      }
    };
  }

  function syncContextFromCurrent(context) {
    if (!context) return;
    context.state.country = getCurrentCountry();
    context.state.language = getCurrentLanguage();
    setDisplayedValues(context);
    closeList(context.country);
    closeList(context.language);
  }

  function refresh() {
    var selectedCountry = getCurrentCountry();
    syncContextFromCurrent(topbarContext);
    refreshPopupLabels();
    updateSelectedCountryLabels();
    applyCountryScope();
    applyCountryPrices();
    applyCountryTestSurfaces();
    if (body) body.setAttribute('data-country-mode-ready', 'true');
    window.dispatchEvent(new CustomEvent('missing-alerts:country-change', {
      detail: {
        country: selectedCountry,
        currency: getCurrentCurrency(),
        language: getCurrentLanguage()
      }
    }));
  }

  var countryOptions = Object.keys(countries).map(function(code) {
    var country = countries[code];
    return {
      value: country.code,
      search: ((country.flag || '') + ' ' + country.label + ' ' + country.code).toLowerCase(),
      html: '<span>' + (country.flag ? country.flag + ' ' : '') + country.label + '</span>'
    };
  });

  var languageOptions = Object.keys(languages).map(function(code) {
    var language = languages[code];
    return {
      value: language.code,
      search: (language.label + ' ' + language.code).toLowerCase(),
      html: '<span>' + language.label + '</span>'
    };
  });

  var topbarContext = createContext('topbar', document.getElementById('missing-alerts-country-top-bar'));
  var popupContext = createContext('popup', popup);

  bindCombobox(topbarContext, 'country');
  bindCombobox(topbarContext, 'language');
  bindCombobox(popupContext, 'country');
  bindCombobox(popupContext, 'language');

  document.querySelectorAll('[data-country-popup-close]').forEach(function(button) {
    button.addEventListener('click', function() {
      closePopup();
      syncContextFromCurrent(popupContext);
    });
  });

  if (popupSaveButton) {
    popupSaveButton.addEventListener('click', function() {
      saveState(popupContext.state.country, popupContext.state.language);
      closePopup();
    });
  }

  if (popupGlobalButton) {
    popupGlobalButton.addEventListener('click', function() {
      saveState('global', getLanguageForCountry('global'));
      closePopup();
    });
  }

  document.addEventListener('click', function(event) {
    var insideCombobox = event.target.closest('.missing-alerts-country-combobox');
    if (!insideCombobox) {
      closeAllLists();
    }
  });

  var rawSavedCountry = window.localStorage.getItem(storageKey);
  var migratedCountry = normalizeCountry(rawSavedCountry);
  var migratedLanguage = normalizeLanguage(window.localStorage.getItem(languageStorageKey) || getLanguageForCountry(migratedCountry));

  if (rawSavedCountry && rawSavedCountry.toLowerCase() === 'uk') {
    window.localStorage.setItem(storageKey, 'gb');
  }

  if (rawSavedCountry) {
    window.localStorage.setItem(currencyStorageKey, getCurrencyForCountry(migratedCountry));
    window.localStorage.setItem(languageStorageKey, migratedLanguage);
    setHtmlAttributes(migratedCountry, getCurrencyForCountry(migratedCountry), migratedLanguage);
  } else {
    setHtmlAttributes(defaultCountry, getCurrencyForCountry(defaultCountry), getLanguageForCountry(defaultCountry));
  }

  refresh();

  if (!rawSavedCountry) {
    openPopup();
  } else {
    closePopup();
  }

  window.MissingAlertsCountryMode = {
    getCountry: getCurrentCountry,
    getCurrency: getCurrentCurrency,
    getLanguage: getCurrentLanguage,
    openSelector: openPopup,
    refresh: refresh,
    setCountry: function(countryCode) {
      saveState(countryCode, getLanguageForCountry(countryCode));
    },
    setLanguage: function(languageCode) {
      saveState(getCurrentCountry(), languageCode);
    },
    config: config
  };
})();
