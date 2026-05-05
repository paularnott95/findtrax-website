(function() {
  var configNode = document.getElementById('missing-alerts-country-mode-config');
  var countryConfig = {};
  try {
    countryConfig = configNode ? JSON.parse(configNode.textContent || '{}') : {};
  } catch (error) {
    countryConfig = {};
  }
  var countries = countryConfig.countries || {};
  var storageKey = countryConfig.storageKey || 'missingAlertsCountry';
  var defaultCountry = countryConfig.defaultCountry || 'global';

  function canonicalizeCountry(value) {
    var normalized = String(value || '').toLowerCase().trim();
    normalized = normalized.replace(/^country:/, '').trim();
    normalized = normalized.replace(/\./g, '');
    if (normalized === 'uk' || normalized === 'united kingdom' || normalized === 'great britain') return 'gb';
    if (normalized === 'usa' || normalized === 'u s a' || normalized === 'united states' || normalized === 'united states of america') return 'us';
    if (normalized === 'canada') return 'ca';
    if (normalized === 'australia') return 'au';
    return normalized;
  }

  function getCountryData(countryCode) {
    var code = canonicalizeCountry(countryCode || defaultCountry);
    return countries[code] || countries[defaultCountry] || { code: code, label: code === 'global' ? 'Global' : code.toUpperCase() };
  }

  function getCurrentCountry() {
    if (window.MissingAlertsCountryMode && typeof window.MissingAlertsCountryMode.getCountry === 'function') {
      return canonicalizeCountry(window.MissingAlertsCountryMode.getCountry());
    }

    var htmlCountry = document.documentElement.getAttribute('data-country');
    var bodyCountry = document.body ? document.body.getAttribute('data-country') : '';
    var storedCountry = '';
    try {
      storedCountry = window.localStorage.getItem(storageKey) || '';
    } catch (error) {
      storedCountry = '';
    }

    return canonicalizeCountry(htmlCountry || bodyCountry || storedCountry || defaultCountry);
  }

  function getCountryAliases(countryCode) {
    var data = getCountryData(countryCode);
    var code = canonicalizeCountry(data.code || countryCode);
    var aliases = [code];

    if (data.label) aliases.push(String(data.label).toLowerCase());
    if (code === 'gb') aliases.push('uk', 'united kingdom', 'great britain');
    if (code === 'us') aliases.push('usa', 'united states', 'united states of america');

    return aliases.filter(function(value, index, list) {
      return value && list.indexOf(value) === index;
    });
  }

  function cardMatchesCountry(card, selectedCountry) {
    if (!card || selectedCountry === 'global') return false;

    var explicitCode = canonicalizeCountry(card.getAttribute('data-country-code'));
    var explicitCountry = canonicalizeCountry(card.getAttribute('data-country'));
    var aliases = getCountryAliases(selectedCountry);

    if (explicitCode && aliases.indexOf(explicitCode) !== -1) return true;
    if (explicitCountry && aliases.indexOf(explicitCountry) !== -1) return true;

    if (explicitCode || explicitCountry) return false;

    var fallbackText = String(card.getAttribute('data-country-fallback-text') || '').toLowerCase();
    if (!fallbackText) return false;

    return aliases.some(function(alias) {
      if (alias.length < 3) return false;
      return fallbackText.indexOf(alias) !== -1;
    });
  }

  function isActiveOrganisedSearch(card) {
    if (!card) return false;
    return card.getAttribute('data-organised-search-active') === 'true';
  }

  function updateOrganisedSearchSections() {
    var selectedCountry = getCurrentCountry();
    var country = getCountryData(selectedCountry);
    var countryLabel = country && country.label ? country.label : 'this country';

    document.querySelectorAll('[data-organised-searches-section]').forEach(function(section) {
      var title = section.querySelector('[data-organised-searches-title]');
      var empty = section.querySelector('[data-organised-searches-empty]');
      var emptyCountry = section.querySelector('[data-organised-searches-empty-country]');
      var visibleCount = 0;

      if (title) {
        title.textContent = 'ORGANISED SEARCHES IN ' + String(countryLabel).toUpperCase();
      }

      if (emptyCountry) {
        emptyCountry.textContent = countryLabel;
      }

      section.querySelectorAll('[data-organised-search-card]').forEach(function(card) {
        var show = cardMatchesCountry(card, selectedCountry) && isActiveOrganisedSearch(card);
        card.hidden = !show;
        card.classList.toggle('country-mode-hidden', !show);
        if (show) visibleCount += 1;
      });

      if (empty) {
        empty.hidden = visibleCount > 0;
      }
    });
  }

  var forms = document.querySelectorAll('[data-organise-search-form]');

  forms.forEach(function(form) {
    var freeLink = form.querySelector('[data-submit-free-search]');
    var featuredLink = form.querySelector('[data-featured-search-payment]');
    var storageKey = 'missingAlertsOrganisedSearch:' + (form.getAttribute('data-case-url') || window.location.pathname);

    function fieldValue(name) {
      var field = form.querySelector('[name="' + name + '"]');
      return field ? field.value.trim() : '';
    }

    function updateLinks() {
      var params = new URLSearchParams();
      params.set('case', form.getAttribute('data-case-url') || window.location.pathname);
      params.set('case_title', form.getAttribute('data-case-title') || document.title);

      var title = fieldValue('search_title');
      var country = fieldValue('country');
      var city = fieldValue('city');
      var date = fieldValue('search_date');

      if (title) params.set('search_title', title);
      if (country) params.set('country', country);
      if (city) params.set('city', city);
      if (date) params.set('date', date);

      if (freeLink) {
        freeLink.href = '/pages/submit-organised-search?' + params.toString();
      }

      if (featuredLink) {
        featuredLink.href = '/products/featured-organised-search?' + params.toString();
      }
    }

    function persistForm() {
      var data = {};
      form.querySelectorAll('input, textarea, select').forEach(function(field) {
        if (field.name) data[field.name] = field.value;
      });

      try {
        window.localStorage.setItem(storageKey, JSON.stringify(data));
      } catch (error) {
        return;
      }
    }

    function restoreForm() {
      try {
        var raw = window.localStorage.getItem(storageKey);
        if (!raw) return;
        var data = JSON.parse(raw);
        Object.keys(data).forEach(function(name) {
          var field = form.querySelector('[name="' + name + '"]');
          if (field && !field.value) field.value = data[name];
        });
      } catch (error) {
        return;
      }
    }

    form.addEventListener('input', function() {
      persistForm();
      updateLinks();
    });

    form.addEventListener('change', function() {
      persistForm();
      updateLinks();
    });

    restoreForm();
    updateLinks();
  });

  updateOrganisedSearchSections();

  window.addEventListener('missing-alerts:country-change', updateOrganisedSearchSections);
  window.addEventListener('storage', function(event) {
    if (!event || event.key === storageKey) updateOrganisedSearchSections();
  });
  document.addEventListener('shopify:section:load', updateOrganisedSearchSections);
})();
