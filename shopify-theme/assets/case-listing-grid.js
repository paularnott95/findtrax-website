(function() {
  function normalize(value) {
    return String(value || '').toLowerCase().trim();
  }

  function normalizeCountry(value) {
    var country = normalize(value);
    if (country === 'uk') return 'gb';
    return country;
  }

  function getConfig() {
    var node = document.getElementById('missing-alerts-country-mode-config');
    if (!node) return {};
    try {
      return JSON.parse(node.textContent || '{}');
    } catch (error) {
      return {};
    }
  }

  function getSelectedCountry(config) {
    var key = config.storageKey || 'missingAlertsCountry';
    return normalizeCountry(
      document.documentElement.getAttribute('data-country') ||
      window.localStorage.getItem(key) ||
      config.defaultCountry ||
      'global'
    );
  }

  function countryMatches(cardCountry, selectedCountry) {
    var country = normalizeCountry(cardCountry);
    if (!selectedCountry || selectedCountry === 'global') return true;
    return country === selectedCountry || country === 'all';
  }

  function textMatches(value, query) {
    return !query || normalize(value).indexOf(query) !== -1;
  }

  function isFoundStatus(value) {
    var status = normalize(value);
    return (
      status.indexOf('found') !== -1 ||
      status.indexOf('resolved') !== -1 ||
      status.indexOf('located') !== -1 ||
      status.indexOf('returned') !== -1
    );
  }

  function passesListingGuard(card, listingType) {
    var found = isFoundStatus(card.getAttribute('data-status'));
    if (listingType === 'found') return found;
    if (listingType === 'missing') return !found;
    return true;
  }

  function readFilters(root) {
    return {
      query: normalize(root.querySelector('[data-case-search-input]') && root.querySelector('[data-case-search-input]').value),
      country: normalize(root.querySelector('[data-filter-country]') && root.querySelector('[data-filter-country]').value),
      region: normalize(root.querySelector('[data-filter-region]') && root.querySelector('[data-filter-region]').value),
      city: normalize(root.querySelector('[data-filter-city]') && root.querySelector('[data-filter-city]').value),
      status: normalize(root.querySelector('[data-filter-status]') && root.querySelector('[data-filter-status]').value),
      ageMin: parseInt(root.querySelector('[data-filter-age-min]') && root.querySelector('[data-filter-age-min]').value, 10),
      ageMax: parseInt(root.querySelector('[data-filter-age-max]') && root.querySelector('[data-filter-age-max]').value, 10),
      gender: normalize(root.querySelector('[data-filter-gender]') && root.querySelector('[data-filter-gender]').value),
      dateKeyword: normalize(root.querySelector('[data-filter-date-keyword]') && root.querySelector('[data-filter-date-keyword]').value),
      lastSeen: normalize(root.querySelector('[data-filter-last-seen]') && root.querySelector('[data-filter-last-seen]').value),
      article: normalize(root.querySelector('[data-filter-article]') && root.querySelector('[data-filter-article]').value),
      sort: normalize(root.querySelector('[data-filter-sort]') && root.querySelector('[data-filter-sort]').value) || 'newest',
      wantsHelp: normalize(root.querySelector('[data-filter-wants-help]') && root.querySelector('[data-filter-wants-help]').value),
      helpType: normalize(root.querySelector('[data-filter-help-type]') && root.querySelector('[data-filter-help-type]').value),
      contactAllowed: normalize(root.querySelector('[data-filter-contact-allowed]') && root.querySelector('[data-filter-contact-allowed]').value),
      verificationStatus: normalize(root.querySelector('[data-filter-verification-status]') && root.querySelector('[data-filter-verification-status]').value),
      helpKeyword: normalize(root.querySelector('[data-filter-help-keyword]') && root.querySelector('[data-filter-help-keyword]').value),
      photo: Boolean(root.querySelector('[data-filter-photo]') && root.querySelector('[data-filter-photo]').checked)
    };
  }

  function passesSearch(card, filters) {
    var searchText = card.getAttribute('data-search-text') || '';
    var location = card.getAttribute('data-location') || '';
    var status = normalize(card.getAttribute('data-status'));
    var age = parseInt(card.getAttribute('data-age'), 10);
    var region = card.getAttribute('data-region') || '';
    var city = card.getAttribute('data-city') || '';
    var gender = card.getAttribute('data-gender') || '';
    var content = card.getAttribute('data-content') || '';
    var excerpt = card.getAttribute('data-excerpt') || '';
    var dateKeywords = card.getAttribute('data-date-keywords') || card.getAttribute('data-date') || '';
    var wantsHelp = normalize(card.getAttribute('data-wants-help'));
    var helpType = card.getAttribute('data-help-type') || '';
    var contactAllowed = normalize(card.getAttribute('data-contact-allowed'));
    var verificationStatus = normalize(card.getAttribute('data-verification-status')) || 'unknown';
    var helpKeywords = card.getAttribute('data-help-keywords') || '';

    if (!textMatches(searchText, filters.query)) return false;
    if (filters.country && !textMatches((card.getAttribute('data-country') || '') + ' ' + searchText, filters.country)) return false;
    if (filters.region && !textMatches(region + ' ' + location + ' ' + searchText, filters.region)) return false;
    if (filters.city && !textMatches(city + ' ' + location, filters.city)) return false;
    if (filters.status && status.indexOf(filters.status) === -1) return false;
    if (!isNaN(filters.ageMin) && (isNaN(age) || age < filters.ageMin)) return false;
    if (!isNaN(filters.ageMax) && (isNaN(age) || age > filters.ageMax)) return false;
    if (filters.gender && !textMatches(gender, filters.gender)) return false;
    if (filters.dateKeyword && !textMatches(dateKeywords, filters.dateKeyword)) return false;
    if (filters.lastSeen && !textMatches(card.getAttribute('data-last-seen') || location, filters.lastSeen)) return false;
    if (filters.article && !textMatches(content + ' ' + excerpt, filters.article)) return false;
    if (filters.photo && card.getAttribute('data-has-photo') !== 'true') return false;
    if (filters.wantsHelp && wantsHelp !== filters.wantsHelp) return false;
    if (filters.helpType && !textMatches(helpType, filters.helpType)) return false;
    if (filters.contactAllowed && contactAllowed !== filters.contactAllowed) return false;
    if (filters.verificationStatus && verificationStatus !== filters.verificationStatus) return false;
    if (filters.helpKeyword && !textMatches(helpKeywords + ' ' + helpType + ' ' + content + ' ' + excerpt, filters.helpKeyword)) return false;

    return true;
  }

  function sortCards(cards, sortValue) {
    return cards.slice().sort(function(a, b) {
      var aTitle = normalize(a.getAttribute('data-name') || a.getAttribute('data-title'));
      var bTitle = normalize(b.getAttribute('data-name') || b.getAttribute('data-title'));
      var aDate = normalize(a.getAttribute('data-date'));
      var bDate = normalize(b.getAttribute('data-date'));

      if (sortValue === 'oldest') return aDate.localeCompare(bDate);
      if (sortValue === 'name-az') return aTitle.localeCompare(bTitle);
      if (sortValue === 'name-za') return bTitle.localeCompare(aTitle);
      return bDate.localeCompare(aDate);
    });
  }

  function apply(root) {
    var config = getConfig();
    var selectedCountry = getSelectedCountry(config);
    var listingType = normalize(root.getAttribute('data-listing-type'));
    var allCards = Array.prototype.slice.call(root.querySelectorAll('[data-case-card]'));
    var cards = allCards.filter(function(card) {
      var allowed = passesListingGuard(card, listingType);
      card.hidden = !allowed;
      card.classList.toggle('is-status-guarded-out', !allowed);
      return allowed;
    });
    var filters = readFilters(root);
    var fallbackMessage = root.querySelector('[data-country-fallback-message]');
    var resultCount = root.querySelector('[data-case-result-count]');
    var emptyMessage = root.querySelector('[data-case-empty-message]');
    var useCountryFallback = false;
    var visibleCount = 0;
    var grid = root.querySelector('[data-case-card-grid]');

    sortCards(cards, filters.sort).forEach(function(card) {
      if (grid) {
        var pagination = grid.querySelector('.ma-case-listing-grid__pagination');
        grid.insertBefore(card, pagination || null);
      }
      var inCountry = countryMatches(card.getAttribute('data-country-code') || card.getAttribute('data-country'), selectedCountry);
      var visible = inCountry && passesSearch(card, filters);
      card.hidden = !visible;
      card.classList.toggle('is-filtered-out', !visible);
      if (visible) visibleCount += 1;
    });

    if (fallbackMessage) fallbackMessage.hidden = !useCountryFallback;
    if (resultCount) resultCount.textContent = visibleCount + (visibleCount === 1 ? ' case shown' : ' cases shown');
    if (emptyMessage) emptyMessage.hidden = visibleCount > 0;
    if (window.console && typeof window.console.log === 'function') {
      window.console.log('[MissingAlerts case grid]', {
        listingType: listingType,
        totalCards: allCards.length,
        visibleCards: visibleCount
      });
    }
  }

  function reset(root) {
    root.querySelectorAll('input, select').forEach(function(field) {
      if (field.type === 'checkbox') {
        field.checked = false;
      } else if (field.type !== 'hidden') {
        field.value = '';
      }
    });
    apply(root);
  }

  function bind(root) {
    root.querySelectorAll('input, select').forEach(function(field) {
      field.addEventListener('input', function() { apply(root); });
      field.addEventListener('change', function() { apply(root); });
    });

    var resetButton = root.querySelector('[data-case-reset-filters]');
    if (resetButton) {
      resetButton.addEventListener('click', function() {
        reset(root);
      });
    }

    window.addEventListener('storage', function(event) {
      if (event.key === 'missingAlertsCountry') apply(root);
    });
    document.addEventListener('country-mode:change', function() {
      apply(root);
    });
    if (window.MutationObserver) {
      new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
          if (mutation.attributeName === 'data-country') apply(root);
        });
      }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-country'] });
    }
    window.setTimeout(function() { apply(root); }, 80);
    apply(root);
  }

  document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('[data-case-listing-grid]').forEach(bind);
  });
})();
