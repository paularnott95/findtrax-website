(function() {
  var PROFILE_KEY = 'missingAlertsProfile';

  window.missingAlertsTrack = window.missingAlertsTrack || function(eventName, data) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: eventName,
      missingAlerts: data || {}
    });
    if (window.console && window.console.log) {
      console.log('Klaviyo integration pending:', eventName, data || {});
    }
  };

  window.missingAlertsNotify = window.missingAlertsNotify || function(location) {
    console.log('Klaviyo integration pending:', location);
  };

  function clean(value) {
    return String(value || '').trim();
  }

  function escapeHtml(value) {
    return clean(value).replace(/[&<>"']/g, function(character) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[character];
    });
  }

  function slugLabel(slug) {
    var parts = clean(slug).split('/').filter(Boolean);
    return (parts[parts.length - 1] || 'this area').replace(/-/g, ' ').replace(/\b\w/g, function(letter) {
      return letter.toUpperCase();
    });
  }

  function readProfile() {
    try {
      return JSON.parse(window.localStorage.getItem(PROFILE_KEY) || '{}') || {};
    } catch (error) {
      return {};
    }
  }

  function writeProfile(profile) {
    try {
      window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    } catch (error) {}
  }

  function apiBase() {
    return String(window.MISSING_ALERTS_API_BASE || '').trim().replace(/\/+$/, '');
  }

  function inferLocationParts(slug) {
    var parts = clean(slug).split('/').filter(Boolean);
    return {
      country: parts[0] ? parts[0].replace(/-/g, ' ') : '',
      region: parts[1] ? parts[1].replace(/-/g, ' ') : '',
      city: parts[parts.length - 1] && parts.length > 2 ? parts[parts.length - 1].replace(/-/g, ' ') : ''
    };
  }

  function nearbyLinks(slug) {
    var parts = clean(slug).split('/').filter(Boolean);
    var links = [];
    if (parts.length >= 1) {
      links.push({ label: 'Country alerts', url: '/pages/missing-people-country?country=' + encodeURIComponent(parts[0]) });
    }
    if (parts.length >= 2) {
      links.push({ label: 'Region alerts', url: '/pages/missing-people-region?region=' + encodeURIComponent(parts.slice(0, 2).join('/')) });
    }
    if (parts.length >= 3) {
      links.push({ label: 'Nearby missing cases', url: '/pages/missing-cases-near?loc=' + encodeURIComponent(parts.join('/')) });
      links.push({ label: 'Search guide', url: '/pages/missing-person-search-guide?loc=' + encodeURIComponent(parts.join('/')) });
    }
    links.push({ label: 'Top locations', url: '/pages/top-missing-locations' });
    return links.slice(0, 5);
  }

  function fill(root) {
    var profile = readProfile();
    var slug = clean(root.getAttribute('data-location-slug'));
    var inferred = inferLocationParts(slug);
    var label = clean(root.getAttribute('data-location-label')) || slugLabel(slug);
    var labelNode = root.querySelector('[data-ma-signup-location-label]');
    if (labelNode) labelNode.textContent = label;
    var fields = {
      email: profile.email || clean(root.getAttribute('data-customer-email')),
      country: profile.country || inferred.country,
      region: profile.region || inferred.region,
      city: profile.city || inferred.city
    };
    Object.keys(fields).forEach(function(name) {
      var input = root.querySelector('[name="' + name + '"]');
      if (input && !input.value) input.value = fields[name] || '';
    });
  }

  function renderNearby(root, slug) {
    var panel = root.querySelector('[data-ma-signup-nearby]');
    var list = root.querySelector('[data-ma-signup-nearby-list]');
    if (!panel || !list) return;
    list.innerHTML = '';
    nearbyLinks(slug).forEach(function(link) {
      var anchor = document.createElement('a');
      anchor.href = link.url;
      anchor.textContent = link.label;
      list.appendChild(anchor);
    });
    panel.hidden = false;
  }

  function payloadFrom(root, form) {
    var data = new FormData(form);
    var slug = clean(data.get('current_location_slug')) || clean(root.getAttribute('data-location-slug'));
    var professionalHelpRequested = data.get('professional_help_requested') === 'true';
    return {
      email: clean(data.get('email')),
      country: clean(data.get('country')),
      region: clean(data.get('region')),
      city: clean(data.get('city')),
      current_location_slug: slug,
      page_type: clean(data.get('page_type')) || clean(root.getAttribute('data-page-type')),
      customer_id: clean(data.get('customer_id')) || clean(root.getAttribute('data-customer-id')),
      followed_locations: slug ? [slug] : [],
      preferred_country_alerts: true,
      preferred_region_alerts: Boolean(clean(data.get('region'))),
      preferred_local_alerts: Boolean(slug),
      professional_help_requested: professionalHelpRequested,
      professional_help_type: professionalHelpRequested ? clean(data.get('professional_help_type')) : '',
      professional_help_note: professionalHelpRequested ? clean(data.get('professional_help_note')) : '',
      consent_timestamp: new Date().toISOString()
    };
  }

  function init(root) {
    var form = root.querySelector('[data-ma-signup-form]');
    var toggle = root.querySelector('[data-ma-pro-help-toggle]');
    var proFields = root.querySelector('[data-ma-pro-help-fields]');
    var status = root.querySelector('[data-ma-signup-status]');
    var slug = clean(root.getAttribute('data-location-slug'));
    fill(root);

    if (toggle && proFields) {
      toggle.addEventListener('change', function() {
        proFields.hidden = !toggle.checked;
      });
    }

    if (!form) return;
    form.addEventListener('submit', function(event) {
      event.preventDefault();
      var payload = payloadFrom(root, form);
      if (!payload.email || !payload.country) {
        if (status) status.textContent = 'Email and country are required.';
        return;
      }
      var button = form.querySelector('button[type="submit"]');
      if (button) button.disabled = true;
      if (status) status.textContent = 'Saving alert settings...';
      writeProfile(payload);
      window.missingAlertsTrack('email_signup', payload);
      if (payload.current_location_slug) {
        window.missingAlertsTrack('follow_location', {
          location_slug: payload.current_location_slug,
          user_id: payload.customer_id || ''
        });
        window.missingAlertsNotify({
          slug: payload.current_location_slug,
          userId: payload.customer_id || '',
          email: payload.email
        });
      }
      if (payload.professional_help_requested) {
        window.missingAlertsTrack('professional_help_requested', payload);
      }

      var base = apiBase();
      var save = base
        ? window.fetch(base + '/api/alert-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(payload)
          }).then(function(response) {
            return response.json().catch(function() { return {}; }).then(function(json) {
              if (!response.ok || json.ok === false) throw new Error(json.error || 'Unable to save alert profile.');
              return json;
            });
          })
        : Promise.resolve({ ok: true, localOnly: true });

      save.then(function() {
        var label = clean(root.getAttribute('data-location-label')) || slugLabel(payload.current_location_slug);
        if (status) status.textContent = "You're now getting alerts for " + label + '.';
        renderNearby(root, payload.current_location_slug || slug);
      }).catch(function(error) {
        if (status) status.textContent = error.message || 'Saved on this browser. Server sync is unavailable.';
      }).finally(function() {
        if (button) button.disabled = false;
      });
    });
  }

  function renderMemberProInbox(root) {
    var list = root.querySelector('[data-member-pro-inbox-list]');
    var empty = root.querySelector('[data-member-pro-inbox-empty]');
    var email = clean(root.getAttribute('data-customer-email'));
    var base = apiBase();
    if (!list || !base || !email) return;
    fetch(base + '/api/member/pro-inbox?customerEmail=' + encodeURIComponent(email), {
      credentials: 'omit',
      headers: { Accept: 'application/json' }
    }).then(function(response) {
      return response.json().catch(function() { return {}; }).then(function(json) {
        if (!response.ok || json.ok === false) throw new Error(json.error || 'Unable to load inbox.');
        return json.conversations || [];
      });
    }).then(function(conversations) {
      list.innerHTML = '';
      if (empty) empty.hidden = conversations.length > 0;
      conversations.forEach(function(item) {
        var card = document.createElement('article');
        card.className = 'case-alert-inbox-card';
        card.innerHTML = [
          '<div class="case-alert-inbox-card__content">',
          '<div class="case-alert-inbox-card__top"><span class="case-alert-inbox-card__badge">PROFESSIONAL HELP</span></div>',
          '<h3 class="case-alert-inbox-card__title">' + escapeHtml(item.pro_name || 'Verified professional') + '</h3>',
          '<p class="case-alert-inbox-card__message">' + escapeHtml(item.message || 'A verified professional sent a safe inbox message.') + '</p>',
          '<div class="case-alert-inbox-card__actions">',
          '<button type="button" class="case-alert-inbox-card__button" data-pro-inbox-action="accept" data-conversation-id="' + escapeHtml(item.id) + '">Accept</button>',
          '<button type="button" class="case-alert-inbox-card__button" data-pro-inbox-action="reply" data-conversation-id="' + escapeHtml(item.id) + '">Reply</button>',
          '<button type="button" class="case-alert-inbox-card__button case-alert-inbox-card__button--secondary" data-pro-inbox-action="ignore" data-conversation-id="' + escapeHtml(item.id) + '">Ignore</button>',
          '<button type="button" class="case-alert-inbox-card__button case-alert-inbox-card__button--secondary" data-pro-inbox-action="report" data-conversation-id="' + escapeHtml(item.id) + '">Report</button>',
          '</div>',
          '</div>'
        ].join('');
        list.appendChild(card);
      });
    }).catch(function(error) {
      list.innerHTML = '<p class="case-alert-inbox-empty__copy">' + escapeHtml(error.message || 'Unable to load safe inbox.') + '</p>';
    });
  }

  function bindMemberProInbox(root) {
    root.addEventListener('click', function(event) {
      var button = event.target.closest('[data-pro-inbox-action]');
      if (!button) return;
      var base = apiBase();
      var action = clean(button.getAttribute('data-pro-inbox-action'));
      var conversationId = clean(button.getAttribute('data-conversation-id'));
      var email = clean(root.getAttribute('data-customer-email'));
      if (!base || !conversationId || !action) return;
      button.disabled = true;
      fetch(base + '/api/member/pro-inbox/respond', {
        method: 'POST',
        credentials: 'omit',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          conversation_id: conversationId,
          member_email: email,
          action: action
        })
      }).finally(function() {
        button.disabled = false;
      });
    });
    renderMemberProInbox(root);
  }

  document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('[data-missing-alerts-signup]').forEach(init);
    document.querySelectorAll('[data-member-pro-inbox]').forEach(bindMemberProInbox);
  });
})();
