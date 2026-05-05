(function() {
  var apiBase = String(window.MISSING_ALERTS_API_BASE || '').trim().replace(/\/+$/, '');

  function setMessage(root, message) {
    var node = root.querySelector('[data-alert-preferences-message]');
    if (node) node.textContent = message || '';
  }

  function customer(root) {
    return {
      id: root.getAttribute('data-customer-id') || '',
      email: root.getAttribute('data-customer-email') || ''
    };
  }

  function setValues(root, preferences) {
    Object.keys(preferences || {}).forEach(function(key) {
      var input = root.querySelector('[name="' + key + '"]');
      if (input) input.checked = Boolean(preferences[key]);
    });
  }

  function getValues(root) {
    var preferences = {};
    Array.prototype.forEach.call(root.querySelectorAll('input[type="checkbox"][name]'), function(input) {
      preferences[input.name] = Boolean(input.checked);
    });
    return preferences;
  }

  function load(root) {
    if (!apiBase) return;
    var c = customer(root);
    if (!c.id || !c.email) return;
    var url = apiBase + '/api/member-alert-preferences/me?customer_id=' + encodeURIComponent(c.id) + '&customer_email=' + encodeURIComponent(c.email);

    fetch(url, { headers: { Accept: 'application/json' } })
      .then(function(response) {
        if (!response.ok) throw new Error('Unable to load alert settings.');
        return response.json();
      })
      .then(function(payload) {
        if (payload && payload.preferences) setValues(root, payload.preferences);
      })
      .catch(function(error) {
        setMessage(root, error && error.message ? error.message : 'Alert settings are unavailable.');
      });
  }

  function save(root) {
    if (!apiBase) return;
    var c = customer(root);
    if (!c.id || !c.email) return;
    var button = root.querySelector('button[type="submit"]');
    if (button) button.disabled = true;
    setMessage(root, 'Saving alert settings...');

    fetch(apiBase + '/api/member-alert-preferences/save', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        customer_id: c.id,
        customer_email: c.email,
        preferences: getValues(root)
      })
    })
      .then(function(response) {
        return response.json().then(function(payload) {
          if (!response.ok || !payload.ok) throw new Error(payload.error || 'Unable to save alert settings.');
          return payload;
        });
      })
      .then(function(payload) {
        if (payload && payload.preferences) setValues(root, payload.preferences);
        setMessage(root, 'Alert settings saved.');
      })
      .catch(function(error) {
        var message = error && error.message ? error.message : 'Unable to save alert settings.';
        if (/failed to fetch|networkerror|load failed/i.test(message)) message = 'Connection failed. Please refresh and try again.';
        if (/access denied|metafieldsset|shopify rejected/i.test(message)) message = 'We couldn’t save this yet. Please try again.';
        setMessage(root, message);
      })
      .finally(function() {
        if (button) button.disabled = false;
      });
  }

  function init(root) {
    if (!root || root.getAttribute('data-alert-preferences-ready') === 'true') return;
    root.setAttribute('data-alert-preferences-ready', 'true');
    var form = root.querySelector('[data-alert-preferences-form]');
    if (form) {
      form.addEventListener('submit', function(event) {
        event.preventDefault();
        save(root);
      });
    }
    load(root);
  }

  document.addEventListener('DOMContentLoaded', function() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-member-alert-preferences]'), init);
  });
})();
