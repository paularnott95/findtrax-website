(function() {
  var DISMISS_KEY = 'missingAlertsProfessionalHelpPromptDismissedAt';
  var DISMISS_DAYS = 7;
  var SECTION_HASH = '#professional-help-section';
  var SCROLL_OFFSET = 96;
  var apiBase = String(window.MISSING_ALERTS_API_BASE || '').trim().replace(/\/+$/, '');
  var customer = window.MissingAlertsCustomer || {};
  var state = {
    cases: [],
    eligibleCases: [],
    enabledCases: [],
    activeCases: [],
    selectedCase: null,
    busy: false,
    message: '',
    error: ''
  };

  function readDismissedAt() {
    try {
      return Number(window.localStorage.getItem(DISMISS_KEY) || '0');
    } catch (error) {
      return 0;
    }
  }

  function writeDismissedAt() {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch (error) {}
  }

  function dismissedRecently() {
    var dismissedAt = readDismissedAt();
    if (!dismissedAt) return false;
    return Date.now() - dismissedAt < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getCaseLabel(caseItem) {
    return caseItem && caseItem.caseTitle ? caseItem.caseTitle : 'your active case';
  }

  function normalizeCase(caseItem) {
    if (!caseItem || typeof caseItem !== 'object') return null;

    var caseStatus = String(caseItem.caseStatus || caseItem.case_status || 'active').toLowerCase();
    var ownerStatus = String(caseItem.caseOwnerStatus || caseItem.case_owner_status || '').toLowerCase();
    var resolvedValues = ['found', 'found safe', 'resolved', 'withdrawn', 'closed', 'cancelled', 'canceled'];
    var isResolved = resolvedValues.indexOf(caseStatus) !== -1 || resolvedValues.indexOf(ownerStatus) !== -1;
    var enabled = Boolean(caseItem.professionalHelpEnabled || caseItem.professional_help_enabled);

    return {
      caseId: String(caseItem.caseId || caseItem.case_id || ''),
      caseHandle: String(caseItem.caseHandle || caseItem.case_handle || ''),
      caseTitle: String(caseItem.caseTitle || caseItem.case_title || 'Missing person case'),
      caseUrl: String(caseItem.caseUrl || caseItem.case_url || ''),
      caseStatus: caseStatus,
      caseOwnerStatus: ownerStatus,
      professionalHelpEnabled: enabled,
      eligible: Boolean(caseItem.eligible) && !enabled && !isResolved,
      active: !isResolved
    };
  }

  function caseKey(caseItem) {
    if (!caseItem) return '';
    return caseItem.caseId || caseItem.caseHandle || caseItem.caseTitle || '';
  }

  function uniqueCases(cases) {
    var seen = {};
    return cases.map(normalizeCase).filter(Boolean).filter(function(caseItem) {
      var key = caseKey(caseItem);
      if (!key || seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  function syncCollections(cases) {
    state.cases = uniqueCases(cases || []);
    state.activeCases = state.cases.filter(function(item) { return item.active; });
    state.enabledCases = state.cases.filter(function(item) { return item.professionalHelpEnabled; });
    state.eligibleCases = state.cases.filter(function(item) { return item.eligible; });
    state.selectedCase = chooseCase();
  }

  function getVisibleCases() {
    return state.activeCases.length ? state.activeCases : state.cases.filter(function(item) { return item.active; });
  }

  function chooseCase() {
    var selectedKey = caseKey(state.selectedCase);
    if (selectedKey) {
      var existing = state.cases.find(function(item) { return caseKey(item) === selectedKey; });
      if (existing) return existing;
    }

    return state.eligibleCases[0] || state.enabledCases[0] || getVisibleCases()[0] || state.cases[0] || null;
  }

  function getEndpoint() {
    if (!apiBase || !customer.loggedIn || (!customer.id && !customer.email)) return '';
    return apiBase + '/api/member/professional-help?customerId=' + encodeURIComponent(customer.id || '') + '&customerEmail=' + encodeURIComponent(customer.email || '');
  }

  function postToggle(caseItem, enabled) {
    if (!apiBase || !caseItem || state.busy) {
      if (!caseItem) {
        state.error = 'Select an active case before changing professional help.';
        state.message = '';
        render();
        showStatus(state.error, true);
      }
      return Promise.resolve(null);
    }
    state.busy = true;
    updateBusy(true);

    return window.fetch(apiBase + '/api/member/professional-help', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        customerId: customer.id || '',
        customerEmail: customer.email || '',
        case_id: caseItem.caseId || '',
        case_handle: caseItem.caseHandle || '',
        professional_help_enabled: Boolean(enabled)
      })
    })
      .then(function(response) {
        return response.json().then(function(payload) {
          if (!response.ok || !payload.ok) throw new Error(payload.error || 'Unable to update professional help.');
          return payload;
        });
      })
      .then(function(payload) {
        var updatedCase = normalizeCase(payload.case || payload);
        if (!updatedCase) throw new Error('Professional help update returned an invalid case.');

        state.cases = state.cases.map(function(item) {
          if (caseKey(item) === caseKey(updatedCase) || item.caseId === updatedCase.caseId || item.caseHandle === updatedCase.caseHandle) {
            return updatedCase;
          }
          return item;
        });
        if (!state.cases.some(function(item) { return caseKey(item) === caseKey(updatedCase); })) {
          state.cases.unshift(updatedCase);
        }
        state.message = payload.status_message || (updatedCase.professionalHelpEnabled ? 'Professional help is now enabled for this case.' : 'Professional help is now off for this case.');
        state.error = '';
        syncCollections(state.cases);
        state.selectedCase = updatedCase;
        render();
        closeModal();
        showStatus(state.message, false);
        scrollToProfessionalHelp(true);
        if (window.MissingAlertsNotifications && typeof window.MissingAlertsNotifications.renderMemberInboxes === 'function') {
          window.MissingAlertsNotifications.renderMemberInboxes();
        }
        return payload;
      })
      .catch(function(error) {
        state.error = error && error.message ? error.message : 'Professional help is unavailable right now.';
        state.message = '';
        render();
        showStatus(state.error, true);
      })
      .finally(function() {
        state.busy = false;
        updateBusy(false);
      });
  }

  function updateBusy(isBusy) {
    Array.prototype.forEach.call(document.querySelectorAll('[data-professional-help-toggle], [data-professional-help-enable], [data-professional-help-later]'), function(button) {
      button.disabled = Boolean(isBusy);
      button.classList.toggle('is-loading', Boolean(isBusy));
    });
  }

  function showStatus(message, isError) {
    Array.prototype.forEach.call(document.querySelectorAll('[data-professional-help-message]'), function(node) {
      node.textContent = message || '';
      node.hidden = !message;
      node.classList.toggle('is-error', Boolean(isError));
    });
  }

  function renderSwitch(caseItem) {
    var enabled = Boolean(caseItem && caseItem.professionalHelpEnabled);
    return (
      '<button type="button" class="ma-professional-help-switch' + (enabled ? ' is-on' : '') + '" role="switch" aria-checked="' + (enabled ? 'true' : 'false') + '" data-professional-help-toggle data-case-id="' + escapeHtml(caseItem.caseId || '') + '" data-case-handle="' + escapeHtml(caseItem.caseHandle || '') + '">' +
        '<span class="ma-professional-help-switch__track"><span class="ma-professional-help-switch__knob"></span></span>' +
        '<span class="ma-professional-help-switch__text">Professional help ' + (enabled ? 'ON' : 'OFF') + '</span>' +
      '</button>'
    );
  }

  function renderCaseSelector(caseItem) {
    var cases = state.eligibleCases.length > 1 ? state.eligibleCases : getVisibleCases();
    if (cases.length < 2) return '';
    var selectedKey = caseKey(caseItem);

    return (
      '<label class="ma-professional-help-card__case" for="ma-professional-help-selector">Case</label>' +
      '<select id="ma-professional-help-selector" class="ma-professional-help-card__selector" data-professional-help-selector>' +
        cases.map(function(item) {
          var value = caseKey(item);
          return '<option value="' + escapeHtml(value) + '"' + (value === selectedKey ? ' selected' : '') + '>' + escapeHtml(getCaseLabel(item)) + '</option>';
        }).join('') +
      '</select>'
    );
  }

  function renderCard() {
    var roots = document.querySelectorAll('[data-professional-help-recommendation]');
    if (!roots.length) return;

    var caseItem = chooseCase();
    var visibleCases = getVisibleCases();
    Array.prototype.forEach.call(roots, function(root) {
      if (!caseItem || !visibleCases.length) {
        root.hidden = true;
        root.innerHTML = '';
        return;
      }

      var enabled = Boolean(caseItem.professionalHelpEnabled);
      var status = enabled ? 'ACTIVE' : 'OFF';
      var currentMessage = state.error || state.message || '';
      var messageClass = 'ma-professional-help-card__status' + (state.error ? ' is-error' : '');
      root.hidden = false;
      root.innerHTML = (
        '<article class="ma-professional-help-card" data-professional-help-card>' +
          '<div class="ma-professional-help-card__content">' +
            '<div class="ma-professional-help-card__eyebrow">Professional help is strongly recommended for active cases.</div>' +
            '<h3 class="ma-professional-help-card__title">GET PROFESSIONAL HELP</h3>' +
            '<p class="ma-professional-help-card__message">You have an active case. Professional help is strongly recommended so verified professionals can offer support, advice or services connected to this case.</p>' +
            '<p class="ma-professional-help-card__support">Verified professionals may be able to offer practical support, search advice, investigation help or legal guidance.</p>' +
            '<p class="ma-professional-help-card__case">Case: ' + escapeHtml(getCaseLabel(caseItem)) + '</p>' +
            '<p class="ma-professional-help-card__note">You stay in control and can turn this off anytime.</p>' +
            '<p class="' + messageClass + '" data-professional-help-message' + (currentMessage ? '' : ' hidden') + '>' + escapeHtml(currentMessage) + '</p>' +
          '</div>' +
          '<div class="ma-professional-help-card__actions">' +
            '<span class="ma-professional-help-card__status-text">' + status + '</span>' +
            renderSwitch(caseItem) +
            renderCaseSelector(caseItem) +
            '<button type="button" class="ma-professional-help-card__button" data-professional-help-enable data-case-id="' + escapeHtml(caseItem.caseId || '') + '" data-case-handle="' + escapeHtml(caseItem.caseHandle || '') + '">' + (enabled ? 'MANAGE PROFESSIONAL HELP' : 'GET PROFESSIONAL HELP') + '</button>' +
          '</div>' +
        '</article>'
      );
    });
  }

  function renderModal() {
    if (!state.eligibleCases.length || dismissedRecently()) return;
    var caseItem = state.eligibleCases[0];
    if (document.querySelector('[data-professional-help-modal]')) return;

    var modal = document.createElement('div');
    modal.className = 'ma-professional-help-modal';
    modal.setAttribute('data-professional-help-modal', '');
    modal.innerHTML = (
      '<div class="ma-professional-help-modal__backdrop" data-professional-help-later></div>' +
      '<section class="ma-professional-help-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="ma-professional-help-modal-title">' +
        '<div class="ma-professional-help-modal__eyebrow">Active case support</div>' +
        '<h2 id="ma-professional-help-modal-title" class="ma-professional-help-modal__title">PROFESSIONAL HELP IS STRONGLY RECOMMENDED</h2>' +
        '<p class="ma-professional-help-modal__message">Because you have an active case, you can allow verified professionals to contact you with support, search advice, investigation help, legal guidance or practical services.</p>' +
        '<p class="ma-professional-help-modal__case">' + escapeHtml(getCaseLabel(caseItem)) + '</p>' +
        '<p class="ma-professional-help-modal__status" data-professional-help-message hidden></p>' +
        '<div class="ma-professional-help-modal__actions">' +
          '<button type="button" class="ma-professional-help-modal__button" data-professional-help-enable data-case-id="' + escapeHtml(caseItem.caseId || '') + '" data-case-handle="' + escapeHtml(caseItem.caseHandle || '') + '">GET PROFESSIONAL HELP</button>' +
          '<button type="button" class="ma-professional-help-modal__button ma-professional-help-modal__button--secondary" data-professional-help-later>MAYBE LATER</button>' +
        '</div>' +
      '</section>'
    );
    document.body.appendChild(modal);
  }

  function closeModal() {
    var modal = document.querySelector('[data-professional-help-modal]');
    if (modal && modal.parentNode) modal.parentNode.removeChild(modal);
  }

  function findCase(handle, idOrKey) {
    return state.cases.find(function(item) {
      return (handle && String(item.caseHandle || '') === String(handle)) ||
        (idOrKey && String(item.caseId || '') === String(idOrKey)) ||
        (idOrKey && caseKey(item) === String(idOrKey));
    }) || state.selectedCase || state.eligibleCases[0] || null;
  }

  function openOverviewTab() {
    var trigger = document.querySelector('[data-member-tab-trigger="overview"]');
    if (trigger && typeof trigger.click === 'function') trigger.click();
  }

  function highlightProfessionalHelpCard() {
    var card = document.querySelector('[data-professional-help-card]');
    if (!card) return;
    card.classList.add('is-highlighted');
    window.setTimeout(function() {
      card.classList.remove('is-highlighted');
    }, 2000);
  }

  function scrollToProfessionalHelp(highlight) {
    var section = document.querySelector('[data-professional-help-section]') || document.getElementById('professional-help-section');
    if (!section) return false;

    openOverviewTab();
    window.setTimeout(function() {
      var top = section.getBoundingClientRect().top + window.pageYOffset - SCROLL_OFFSET;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
      if (highlight) highlightProfessionalHelpCard();
    }, 80);
    return true;
  }

  function isProfessionalHelpLink(anchor) {
    if (!anchor) return false;
    var href = anchor.getAttribute('href') || '';
    return href.indexOf(SECTION_HASH) !== -1;
  }

  function render() {
    renderCard();
    renderModal();
  }

  function load() {
    var endpoint = getEndpoint();
    if (!endpoint) return;

    window.fetch(endpoint, { headers: { Accept: 'application/json' } })
      .then(function(response) {
        if (!response.ok) throw new Error('Professional help status unavailable.');
        return response.json();
      })
      .then(function(payload) {
        var cases = []
          .concat(Array.isArray(payload.cases) ? payload.cases : [])
          .concat(Array.isArray(payload.eligibleCases) ? payload.eligibleCases : [])
          .concat(Array.isArray(payload.eligible_cases) ? payload.eligible_cases : [])
          .concat(Array.isArray(payload.enabled_cases) ? payload.enabled_cases : [])
          .concat(Array.isArray(payload.active_cases) ? payload.active_cases : []);
        syncCollections(cases);
        render();
        if (window.location.hash === SECTION_HASH) {
          scrollToProfessionalHelp(true);
        }
      })
      .catch(function() {});
  }

  document.addEventListener('click', function(event) {
    var anchor = event.target.closest('a[href]');
    if (anchor && isProfessionalHelpLink(anchor)) {
      var section = document.querySelector('[data-professional-help-section]');
      if (section) {
        event.preventDefault();
        scrollToProfessionalHelp(true);
      }
      return;
    }

    var later = event.target.closest('[data-professional-help-later]');
    if (later) {
      event.preventDefault();
      writeDismissedAt();
      closeModal();
      return;
    }

    var enable = event.target.closest('[data-professional-help-enable]');
    if (enable) {
      event.preventDefault();
      var enableCase = findCase(enable.getAttribute('data-case-handle'), enable.getAttribute('data-case-id'));
      if (enableCase && enableCase.professionalHelpEnabled) {
        scrollToProfessionalHelp(true);
        return;
      }
      postToggle(enableCase || state.eligibleCases[0], true);
      return;
    }

    var toggle = event.target.closest('[data-professional-help-toggle]');
    if (toggle) {
      event.preventDefault();
      var toggleCase = findCase(toggle.getAttribute('data-case-handle'), toggle.getAttribute('data-case-id'));
      postToggle(toggleCase, !(toggleCase && toggleCase.professionalHelpEnabled));
    }
  });

  document.addEventListener('change', function(event) {
    var selector = event.target.closest('[data-professional-help-selector]');
    if (!selector) return;
    state.selectedCase = findCase('', selector.value);
    render();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }

  window.MissingAlertsProfessionalHelp = {
    reload: load,
    render: render,
    scrollToSection: scrollToProfessionalHelp
  };
})();
