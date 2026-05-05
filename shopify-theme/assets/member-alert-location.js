(function() {
  var LOG_ENABLED = window.MISSING_ALERTS_DIAGNOSTICS === true;
  var apiBase = String(window.MISSING_ALERTS_API_BASE || '').trim().replace(/\/+$/, '');

  function log() {
    if (LOG_ENABLED && window.console) console.log.apply(console, arguments);
  }

  function setMessage(root, message, saved) {
    var status = root.querySelector('[data-location-save-status]');
    var output = root.querySelector('[data-location-save-message]');
    if (status) {
      status.textContent = saved ? 'SAVED' : 'NOT SAVED';
      status.classList.toggle('is-saved', Boolean(saved));
    }
    if (output) output.textContent = message || '';
  }

  function displayLocation(location) {
    return String(
      location.location_full_path ||
      [location.location_city || location.city, location.location_county, location.location_region || location.region, location.location_country_name || location.country]
        .filter(Boolean)
        .join(', ')
    ).trim();
  }

  function setSavedSummary(root, location) {
    var summary = root.querySelector('[data-location-saved-summary]');
    var display = root.querySelector('[data-location-saved-display]');
    var label = displayLocation(location || {});
    if (display) display.textContent = label;
    if (summary) summary.hidden = !label;
  }

  function customerFromRoot(root) {
    return {
      id: root.getAttribute('data-customer-id') || '',
      email: root.getAttribute('data-customer-email') || ''
    };
  }

  function formPayload(root, form) {
    var customer = customerFromRoot(root);
    var location = {};
    form.querySelectorAll('[data-location-output]').forEach(function(input) {
      location[input.getAttribute('data-location-output')] = input.value || '';
    });
    return {
      customer_id: customer.id,
      customer_email: customer.email,
      country: form.elements.country ? form.elements.country.value : '',
      region: form.elements.region ? form.elements.region.value : '',
      city: form.elements.city ? form.elements.city.value : '',
      postcode: form.elements.postcode ? form.elements.postcode.value : '',
      lat: form.elements.lat ? form.elements.lat.value : '',
      lng: form.elements.lng ? form.elements.lng.value : '',
      location_country_code: location.countryCode || '',
      location_country_name: location.countryName || '',
      location_region: location.region || '',
      location_region_id: location.regionId || '',
      location_region_slug: location.regionSlug || '',
      location_county: location.county || '',
      location_county_id: location.countyId || '',
      location_county_slug: location.countySlug || '',
      location_city: location.city || '',
      location_city_id: location.cityId || '',
      location_city_slug: location.citySlug || '',
      location_town: location.town || '',
      location_town_id: location.townId || '',
      location_village: location.village || '',
      location_village_id: location.villageId || '',
      location_slug_path: location.slugPath || '',
      location_full_path: location.fullPath || '',
      location_lat: location.lat || '',
      location_lng: location.lng || '',
      location_scope: location.scope || ''
    };
  }

  function writeStructuredStorage(payload) {
    try {
      localStorage.setItem('missingAlertsLocationCountryCode', payload.location_country_code || '');
      localStorage.setItem('missingAlertsLocationCountryName', payload.location_country_name || payload.country || '');
      localStorage.setItem('missingAlertsLocationRegion', payload.location_region || payload.region || '');
      localStorage.setItem('missingAlertsLocationCounty', payload.location_county || '');
      localStorage.setItem('missingAlertsLocationCity', payload.location_city || payload.city || '');
      localStorage.setItem('missingAlertsLocationTown', payload.location_town || '');
      localStorage.setItem('missingAlertsLocationVillage', payload.location_village || '');
      localStorage.setItem('missingAlertsLocationSlugPath', payload.location_slug_path || '');
      localStorage.setItem('missingAlertsLocationFullPath', payload.location_full_path || '');
      localStorage.setItem('missingAlertsLocationLat', payload.location_lat || payload.lat || '');
      localStorage.setItem('missingAlertsLocationLng', payload.location_lng || payload.lng || '');
      localStorage.setItem('missingAlertsLocationScope', payload.location_scope || '');
    } catch (error) {
      log('[member-alert-location] localStorage failed', error);
    }
  }

  async function loadSaved(root, form) {
    var customer = customerFromRoot(root);
    if (!apiBase || !customer.id || !customer.email) return;
    var url = apiBase + '/api/member-location/me?customer_id=' + encodeURIComponent(customer.id) + '&customer_email=' + encodeURIComponent(customer.email);
    try {
      var response = await fetch(url, { credentials: 'omit' });
      var data = await response.json();
      if (!response.ok || !data.ok || !data.location) return;
      Object.keys(data.location).forEach(function(key) {
        if (form.elements[key] && data.location[key]) form.elements[key].value = data.location[key];
      });
      if (data.location.country || data.location.city || data.location.location_full_path) {
        setSavedSummary(root, data.location);
        setMessage(root, 'Alert location loaded.', true);
      }
    } catch (error) {
      log('[member-alert-location] load failed', error);
    }
  }

  function init(root) {
    var form = root.querySelector('[data-member-alert-location-form]');
    if (!form || form.dataset.bound === 'true') return;
    form.dataset.bound = 'true';
    loadSaved(root, form);

    form.addEventListener('submit', async function(event) {
      event.preventDefault();
      if (!apiBase) {
        setMessage(root, 'Location service is not available yet.', false);
        return;
      }
      var button = form.querySelector('button[type="submit"]');
      if (button) button.disabled = true;
      setMessage(root, 'Saving alert location...', false);
      try {
        var payload = formPayload(root, form);
        if (
          !payload.location_city &&
          !payload.location_town &&
          !payload.location_county &&
          !payload.location_region &&
          !(payload.location_scope === 'whole_country' && payload.location_country_code)
        ) {
          setMessage(root, 'Select an approved location before saving.', false);
          return;
        }
        writeStructuredStorage(payload);
        var response = await fetch(apiBase + '/api/member-location/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          credentials: 'omit'
        });
        var data = await response.json();
        if (!response.ok || !data.ok) throw new Error(data.error || 'Save failed.');
        setSavedSummary(root, data.location || payload);
        setMessage(root, 'Alert location saved.', true);
        window.dispatchEvent(new CustomEvent('missing-alerts:member-location-saved', { detail: data.location || {} }));
      } catch (error) {
        var message = error && error.message ? error.message : 'Could not save alert location.';
        if (/failed to fetch|networkerror|load failed/i.test(message)) message = 'Connection failed. Please refresh and try again.';
        if (/access denied|metafieldsset|shopify rejected/i.test(message)) message = 'We couldn’t save this yet. Please try again.';
        setMessage(root, message, false);
      } finally {
        if (button) button.disabled = false;
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('[data-member-alert-location]').forEach(init);
  });
})();
