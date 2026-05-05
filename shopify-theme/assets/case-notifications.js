(function() {
  var STORAGE_KEY = 'missingAlertsFollowedCases';
  var DEFAULT_CASE_IMAGE = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 720" fill="none">' +
      '<rect width="720" height="720" rx="48" fill="#121214"/>' +
      '<rect x="28" y="28" width="664" height="664" rx="36" fill="url(#g)"/>' +
      '<circle cx="360" cy="255" r="96" fill="rgba(255,255,255,0.15)"/>' +
      '<path d="M186 548c36-92 110-138 174-138s138 46 174 138" fill="rgba(255,255,255,0.15)"/>' +
      '<text x="360" y="635" fill="#ffffff" font-family="Arial, sans-serif" font-size="34" font-weight="700" text-anchor="middle" letter-spacing="4">MISSING ALERTS</text>' +
      '<defs><linearGradient id="g" x1="80" y1="56" x2="640" y2="664" gradientUnits="userSpaceOnUse"><stop stop-color="#251114"/><stop offset="1" stop-color="#09090b"/></linearGradient></defs>' +
    '</svg>'
  );
  var NOTIFY_TRIGGER_SELECTOR = '.js-case-notify-button, [data-case-notify-button]';
  var FOLLOW_TRIGGER_SELECTOR = '.js-case-follow-button, .case-follow-btn, [data-follow-case]';
  var BUTTON_SELECTOR = '.js-case-notify-button, .js-case-follow-button, [data-case-notify-button], [data-follow-case]';
  var modal = document.querySelector('[data-case-notification-modal]');
  var closeControls = modal ? modal.querySelectorAll('[data-case-notification-close]') : [];
  var titleTarget = modal ? modal.querySelector('[data-case-notification-title]') : null;
  var freeButton = modal ? modal.querySelector('[data-case-notification-free]') : null;
  var customerContext = window.MissingAlertsCustomer && typeof window.MissingAlertsCustomer === 'object'
    ? window.MissingAlertsCustomer
    : { loggedIn: modal ? modal.getAttribute('data-customer-logged-in') === 'true' : false };
  var isLoggedIn = Boolean(customerContext && customerContext.loggedIn);
  var loginUrl = modal ? modal.getAttribute('data-login-url') || '/account/login' : '/account/login';
  var apiBase = String(window.MISSING_ALERTS_API_BASE || '').trim().replace(/\/+$/, '');
  var activeCase = null;
  var lastFocusedButton = null;

  function hasBackendSync() {
    return Boolean(apiBase && !/YOUR_VERCEL_DOMAIN_HERE/i.test(apiBase));
  }

  function getCustomerEmail() {
    return customerContext && customerContext.email ? String(customerContext.email).trim().toLowerCase() : '';
  }

  function getCustomerId() {
    return customerContext && customerContext.id ? String(customerContext.id).trim() : '';
  }

  function buildApiUrl(path) {
    if (!hasBackendSync()) return '';
    return apiBase + path;
  }

  function showSyncNote(message) {
    if (!message) return;

    var existing = document.querySelector('[data-case-notification-sync-note]');
    if (existing) {
      existing.textContent = message;
      existing.classList.add('is-visible');
      window.clearTimeout(existing.__hideTimer);
      existing.__hideTimer = window.setTimeout(function() {
        existing.classList.remove('is-visible');
      }, 3600);
      return;
    }

    var note = document.createElement('div');
    note.className = 'case-notification-sync-note is-visible';
    note.setAttribute('data-case-notification-sync-note', '');
    note.textContent = message;
    document.body.appendChild(note);

    note.__hideTimer = window.setTimeout(function() {
      note.classList.remove('is-visible');
    }, 3600);
  }

  function mergeFollowEntries(entries) {
    if (!entries || !entries.length) return readFollowedCases();

    var followedCases = readFollowedCases();

    entries.forEach(function(entry) {
      var normalized = normalizeStoredCaseEntry(entry.handle || entry.caseHandle || '', {
        title: entry.title || entry.caseTitle,
        handle: entry.handle || entry.caseHandle,
        url: entry.url || entry.caseUrl,
        image: entry.image || '',
        location: entry.location || '',
        followedAt: entry.followedAt || entry.createdAt,
        status: entry.status || 'WATCHING FOR UPDATES'
      });

      if (!normalized.key || !normalized.entry) return;

      var existingEntry = followedCases[normalized.key] || {};
      followedCases[normalized.key] = {
        title: normalized.entry.title || existingEntry.title || normalized.key,
        handle: normalized.entry.handle || existingEntry.handle || normalized.key,
        url: normalized.entry.url || existingEntry.url || '/blogs/missing-persons',
        image: existingEntry.image || normalized.entry.image || DEFAULT_CASE_IMAGE,
        location: existingEntry.location || normalized.entry.location || '',
        followedAt: normalized.entry.followedAt || existingEntry.followedAt || new Date().toISOString(),
        status: normalized.entry.status || existingEntry.status || 'WATCHING FOR UPDATES'
      };
    });

    writeFollowedCases(followedCases);
    return followedCases;
  }

  function fetchJson(url, options) {
    return window.fetch(url, options).then(function(response) {
      return response.json().catch(function() {
        return {};
      }).then(function(payload) {
        return {
          ok: response.ok,
          status: response.status,
          payload: payload
        };
      });
    });
  }

  function readFollowedCases() {
    try {
      var parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
      if (Array.isArray(parsed)) {
        return parsed.reduce(function(acc, item) {
          var normalizedEntry = normalizeStoredCaseEntry('', item);
          if (normalizedEntry.key) {
            acc[normalizedEntry.key] = normalizedEntry.entry;
          }
          return acc;
        }, {});
      }

      if (!parsed || typeof parsed !== 'object') {
        return {};
      }

      return Object.keys(parsed).reduce(function(acc, key) {
        var normalizedEntry = normalizeStoredCaseEntry(key, parsed[key]);
        if (normalizedEntry.key) {
          acc[normalizedEntry.key] = normalizedEntry.entry;
        }
        return acc;
      }, {});
    } catch (error) {
      return {};
    }
  }

  function writeFollowedCases(value) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch (error) {
      return false;
    }

    return true;
  }

  function normalizeHandle(handle, url) {
    var source = String(handle || '').trim();

    if (!source && url) {
      source = String(url).trim();
    }

    source = source
      .replace(/^https?:\/\/[^/]+/i, '')
      .replace(/^\/+/, '')
      .replace(/^blogs\/[^/]+\//i, '')
      .replace(/^missing-persons\//i, '')
      .replace(/\?.*$/, '')
      .replace(/#.*$/, '')
      .replace(/\/+$/, '');

    if (source.indexOf('/') !== -1) {
      source = source.split('/').filter(Boolean).pop() || source;
    }

    return source;
  }

  function normalizeTitle(title) {
    return String(title || '')
      .toLowerCase()
      .replace(/&amp;/g, '&')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function normalizeUrl(url) {
    var value = String(url || '').trim();
    if (!value) return '';

    return value
      .replace(/^https?:\/\/[^/]+/i, '')
      .replace(/\?.*$/, '')
      .replace(/#.*$/, '')
      .replace(/\/+$/, '') || '/';
  }

  function normalizeStoredCaseEntry(key, item) {
    var entry = item && typeof item === 'object' ? item : {};
    var safeUrl = normalizeUrl(entry.url || key);
    var normalizedHandle = normalizeHandle(entry.handle || key, safeUrl);
    var normalizedTitle = normalizeTitle(entry.title || key);
    var storageKey = normalizedHandle || normalizedTitle;

    if (!storageKey) {
      return { key: '', entry: null };
    }

    return {
      key: storageKey,
      entry: {
        title: entry.title || key || 'Missing person case',
        handle: normalizedHandle || storageKey,
        url: safeUrl || '/blogs/missing-persons',
        image: entry.image || '',
        location: entry.location || '',
        status: entry.status || 'WATCHING FOR UPDATES',
        followedAt: entry.followedAt || ''
      }
    };
  }

  function getMetaContent(name) {
    var meta = document.querySelector('meta[property="' + name + '"], meta[name="' + name + '"]');
    return meta ? String(meta.getAttribute('content') || '').trim() : '';
  }

  function findNearestImage(button) {
    var roots = [
      button && button.closest('.article-card-wrapper, .bp-card-shell, article, .card, .case-page-main-image-shell'),
      document.querySelector('.case-page-main-image-shell'),
      document
    ];

    for (var i = 0; i < roots.length; i += 1) {
      var root = roots[i];
      if (!root || !root.querySelector) continue;

      var image = root.querySelector('img');
      if (image) {
        return image.currentSrc || image.getAttribute('src') || '';
      }
    }

    return getMetaContent('og:image') || '';
  }

  function findNearestLocation(button) {
    var roots = [
      button && button.closest('.bp-card-shell, .article-card-wrapper, article, .card, .case-page-main-content, .case-page-content'),
      document.querySelector('.case-page-main-content'),
      document
    ];
    var selectors = [
      '.bp-card__meta',
      '.case-page-meta__location',
      '[data-case-location]',
      '.article-card__excerpt',
      '.case-page-summary'
    ];

    for (var i = 0; i < roots.length; i += 1) {
      var root = roots[i];
      if (!root || !root.querySelector) continue;

      for (var j = 0; j < selectors.length; j += 1) {
        var node = root.querySelector(selectors[j]);
        var text = node ? String(node.textContent || '').trim() : '';
        if (text) {
          return text.replace(/^last seen:\s*/i, '');
        }
      }
    }

    return '';
  }

  function resolveCaseStatus(button) {
    var buttonStatus = button && button.getAttribute ? button.getAttribute('data-case-status') : '';
    if (buttonStatus) return buttonStatus;

    var statusRoot = button && button.closest('.case-alert-inbox-card, article, .card');
    if (statusRoot) {
      var statusNode = statusRoot.querySelector('.article-card__found-badge, .bp-card__badge, .case-alert-inbox-card__status');
      if (statusNode) {
        return String(statusNode.textContent || '').trim();
      }
    }

    return 'WATCHING FOR UPDATES';
  }

  function buildReturnUrl(url) {
    var safeUrl = String(url || window.location.pathname || '/').trim();

    if (!safeUrl) {
      return loginUrl;
    }

    return loginUrl + '?return_url=' + encodeURIComponent(safeUrl);
  }

  function escapeAttributeValue(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') {
      return window.CSS.escape(value);
    }

    return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getButtonCaseData(button) {
    if (!button || !button.getAttribute) return null;

    var url = button.getAttribute('data-case-url') || window.location.pathname || '/';
    var handle = normalizeHandle(button.getAttribute('data-case-handle'), url);
    var title = button.getAttribute('data-case-title') || button.getAttribute('data-title') || 'this case';

    if (!handle) return null;

    return {
      title: title,
      handle: handle,
      url: normalizeUrl(url) || url,
      image: button.getAttribute('data-case-image') || findNearestImage(button) || DEFAULT_CASE_IMAGE,
      location: button.getAttribute('data-case-location') || findNearestLocation(button),
      status: resolveCaseStatus(button) || 'WATCHING FOR UPDATES'
    };
  }

  function setActiveCase(caseData) {
    if (!caseData || !caseData.handle) return null;

    activeCase = {
      title: caseData.title || 'this case',
      handle: normalizeHandle(caseData.handle, caseData.url),
      url: normalizeUrl(caseData.url || window.location.pathname || '/') || '/',
      image: caseData.image || DEFAULT_CASE_IMAGE,
      location: caseData.location || '',
      status: caseData.status || 'WATCHING FOR UPDATES'
    };

    if (modal) {
      modal.setAttribute('data-active-case-title', activeCase.title);
      modal.setAttribute('data-active-case-handle', activeCase.handle);
      modal.setAttribute('data-active-case-url', activeCase.url);
    }

    return activeCase;
  }

  function getActiveCase() {
    if (activeCase && activeCase.handle) {
      return activeCase;
    }

    if (!modal) return null;

    var modalHandle = normalizeHandle(modal.getAttribute('data-active-case-handle'), modal.getAttribute('data-active-case-url'));
    if (!modalHandle) return null;

    activeCase = {
      title: modal.getAttribute('data-active-case-title') || 'this case',
      handle: modalHandle,
      url: normalizeUrl(modal.getAttribute('data-active-case-url') || window.location.pathname || '/') || '/',
      image: DEFAULT_CASE_IMAGE,
      location: '',
      status: 'WATCHING FOR UPDATES'
    };

    return activeCase;
  }

  function getFollowedCaseEntries() {
    var followedCases = readFollowedCases();

    return Object.keys(followedCases)
      .map(function(handle) {
        var item = normalizeStoredCaseEntry(handle, followedCases[handle]).entry;

        return {
          handle: item ? item.handle : normalizeHandle(handle),
          title: item ? item.title : handle,
          url: item ? item.url : '/blogs/missing-persons',
          image: item && item.image ? item.image : DEFAULT_CASE_IMAGE,
          location: item ? item.location : '',
          followedAt: item ? item.followedAt : '',
          status: item ? item.status : 'WATCHING FOR UPDATES'
        };
      })
      .filter(function(entry) {
        return entry.handle;
      })
      .sort(function(a, b) {
        return String(b.followedAt || '').localeCompare(String(a.followedAt || ''));
      });
  }

  function getCaseButtons(criteria) {
    var normalizedHandle = typeof criteria === 'string'
      ? normalizeHandle(criteria)
      : normalizeHandle(criteria && criteria.handle, criteria && criteria.url);
    var normalizedUrl = typeof criteria === 'string' ? '' : normalizeUrl(criteria && criteria.url);
    var buttons = Array.prototype.slice.call(document.querySelectorAll(BUTTON_SELECTOR));

    return buttons.filter(function(button) {
      var buttonCase = getButtonCaseData(button);
      return buttonCase && (
        (normalizedHandle && buttonCase.handle === normalizedHandle) ||
        (normalizedUrl && normalizeUrl(buttonCase.url) === normalizedUrl)
      );
    });
  }

  function getCaseCounters(criteria) {
    var normalizedHandle = typeof criteria === 'string'
      ? normalizeHandle(criteria)
      : normalizeHandle(criteria && criteria.handle, criteria && criteria.url);
    var counters = Array.prototype.slice.call(document.querySelectorAll('[data-notify-count][data-case-handle]'));

    return counters.filter(function(counter) {
      var counterHandle = normalizeHandle(counter.getAttribute('data-case-handle'));
      return counterHandle === normalizedHandle;
    });
  }

  function getMatchingCaseKeys(criteria) {
    var followedCases = readFollowedCases();
    var normalizedHandle = typeof criteria === 'string'
      ? normalizeHandle(criteria)
      : normalizeHandle(criteria && criteria.handle, criteria && criteria.url);
    var normalizedUrl = typeof criteria === 'string' ? '' : normalizeUrl(criteria && criteria.url);
    var normalizedTitle = typeof criteria === 'string' ? '' : normalizeTitle(criteria && criteria.title);

    return Object.keys(followedCases).filter(function(key) {
      var entry = normalizeStoredCaseEntry(key, followedCases[key]).entry;
      if (!entry) return false;

      var entryHandle = normalizeHandle(entry.handle || key, entry.url);
      var entryUrl = normalizeUrl(entry.url);
      var entryTitle = normalizeTitle(entry.title || key);

      return (
        (normalizedHandle && entryHandle === normalizedHandle) ||
        (normalizedUrl && entryUrl === normalizedUrl) ||
        (normalizedTitle && entryTitle === normalizedTitle)
      );
    });
  }

  function getFollowCount(criteria) {
    return getMatchingCaseKeys(criteria).length;
  }

  function updateButtonState(button, isFollowing) {
    if (!button) return;

    var textTarget = button.querySelector('.case-notify-button__text');
    var defaultLabel = button.getAttribute('data-default-follow-label');

    if (!defaultLabel) {
      defaultLabel = textTarget ? textTarget.textContent : button.textContent;
      defaultLabel = String(defaultLabel || '').trim() || 'Notify me';
      button.setAttribute('data-default-follow-label', defaultLabel);
    }

    var label = isFollowing ? 'Following' : defaultLabel;

    button.classList.toggle('is-following', isFollowing);
    button.setAttribute('aria-pressed', isFollowing ? 'true' : 'false');

    if (textTarget) {
      textTarget.textContent = label;
    } else if (button.matches(FOLLOW_TRIGGER_SELECTOR)) {
      button.textContent = label;
    }
  }

  function updateCaseUi(criteria) {
    var normalizedHandle = typeof criteria === 'string'
      ? normalizeHandle(criteria)
      : normalizeHandle(criteria && criteria.handle, criteria && criteria.url);
    if (!normalizedHandle) return;

    var isFollowing = getFollowCount(criteria || normalizedHandle) > 0;
    var countLabel = isFollowing ? '1 person following updates' : '0 people following updates';

    getCaseButtons(criteria || normalizedHandle).forEach(function(button) {
      updateButtonState(button, isFollowing);
    });

    getCaseCounters(criteria || normalizedHandle).forEach(function(counter) {
      counter.textContent = countLabel;
    });
  }

  function renderFollowedCasesLists() {
    var lists = document.querySelectorAll('[data-followed-cases-list]');
    var entries = getFollowedCaseEntries();

    Array.prototype.forEach.call(lists, function(list) {
      if (!list) return;

      var parent = list.parentNode || list.closest('[data-case-alert-inbox]');
      var emptyState = parent ? parent.querySelector('[data-followed-cases-empty]') : null;

      if (!entries.length) {
        list.innerHTML = '';
        if (emptyState) emptyState.hidden = false;
        return;
      }

      list.innerHTML = entries.map(function(entry) {
        var followedLabel = entry.followedAt
          ? new Date(entry.followedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
          : 'Saved on this device';
        var locationMarkup = entry.location
          ? '<p class="case-alert-inbox-card__location">' + escapeHtml(entry.location) + '</p>'
          : '';
        return (
          '<article class="case-alert-inbox-card" data-case-handle="' + escapeHtml(entry.handle) + '" data-case-url="' + escapeHtml(entry.url) + '" data-case-title="' + escapeHtml(entry.title) + '">' +
            '<div class="case-alert-inbox-card__media">' +
              '<img class="case-alert-inbox-card__image" src="' + escapeHtml(entry.image || DEFAULT_CASE_IMAGE) + '" alt="' + escapeHtml(entry.title) + '">' +
            '</div>' +
            '<div class="case-alert-inbox-card__content">' +
              '<div class="case-alert-inbox-card__meta-row">' +
                '<div class="case-alert-inbox-card__meta">' + escapeHtml(entry.status) + '</div>' +
                '<div class="case-alert-inbox-card__followed-at">' + escapeHtml(followedLabel) + '</div>' +
              '</div>' +
              '<h3 class="case-alert-inbox-card__title">' + escapeHtml(entry.title) + '</h3>' +
              locationMarkup +
              '<p class="case-alert-inbox-card__status">' + escapeHtml(entry.status) + '</p>' +
            '</div>' +
            '<div class="case-alert-inbox-card__actions">' +
              '<a class="case-alert-inbox-card__link" href="' + escapeHtml(entry.url) + '">VIEW CASE</a>' +
              '<button type="button" class="case-alert-inbox-card__remove case-alert-remove js-case-unfollow-button" data-unfollow-case data-case-handle="' + escapeHtml(entry.handle) + '" data-case-url="' + escapeHtml(entry.url) + '" data-case-title="' + escapeHtml(entry.title) + '">UNFOLLOW</button>' +
            '</div>' +
          '</article>'
        );
      }).join('');

      if (emptyState) emptyState.hidden = true;
    });

    document.dispatchEvent(new CustomEvent('missingalerts:followed-cases-updated', {
      detail: {
        count: entries.length
      }
    }));
  }

  function syncAllCaseUi() {
    var buttons = document.querySelectorAll(BUTTON_SELECTOR);
    var seen = {};

    Array.prototype.forEach.call(buttons, function(button) {
      var buttonCase = getButtonCaseData(button);
      if (!buttonCase || !buttonCase.handle || seen[buttonCase.handle]) return;

      seen[buttonCase.handle] = true;
      updateCaseUi(buttonCase);
    });

    renderFollowedCasesLists();
  }

  function unfollowCase(handle, options) {
    var normalizedHandle = normalizeHandle(handle, options && options.url);
    var normalizedUrl = normalizeUrl(options && options.url);
    var normalizedTitle = normalizeTitle(options && options.title);
    var followedCases = readFollowedCases();
    var matchedKeys = getMatchingCaseKeys({
      handle: normalizedHandle,
      url: normalizedUrl,
      title: normalizedTitle
    });

    if (!matchedKeys.length && normalizedHandle && followedCases[normalizedHandle]) {
      matchedKeys = [normalizedHandle];
    }

    if (!matchedKeys.length) return;

    matchedKeys.forEach(function(key) {
      delete followedCases[key];
    });
    if (!writeFollowedCases(followedCases)) return;

    updateCaseUi({
      handle: normalizedHandle,
      url: normalizedUrl,
      title: options && options.title
    });
    renderFollowedCasesLists();
  }

  function syncFollowToBackend(caseData) {
    var customerEmail = getCustomerEmail();
    if (!isLoggedIn || !customerEmail || !hasBackendSync() || !caseData || !caseData.handle) {
      return Promise.resolve(false);
    }

    return fetchJson(buildApiUrl('/api/notifications/follow-case'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        customerId: getCustomerId(),
        customerEmail: customerEmail,
        caseHandle: caseData.handle,
        caseTitle: caseData.title,
        caseUrl: caseData.url
      })
    }).then(function(result) {
      if (!result.ok || !result.payload || result.payload.ok !== true) {
        throw new Error(result.payload && result.payload.error ? result.payload.error : 'Follow sync failed.');
      }

      if (result.payload.follow) {
        mergeFollowEntries([result.payload.follow]);
        updateCaseUi(caseData);
        renderFollowedCasesLists();
      }

      return true;
    }).catch(function() {
      showSyncNote('Saved on this device. Account sync will retry later.');
      return false;
    });
  }

  function syncUnfollowToBackend(caseData) {
    var customerEmail = getCustomerEmail();
    if (!isLoggedIn || !customerEmail || !hasBackendSync() || !caseData || !caseData.handle) {
      return Promise.resolve(false);
    }

    return fetchJson(buildApiUrl('/api/notifications/unfollow-case'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        customerEmail: customerEmail,
        caseHandle: caseData.handle
      })
    }).then(function(result) {
      if (!result.ok || !result.payload || result.payload.ok !== true) {
        throw new Error(result.payload && result.payload.error ? result.payload.error : 'Unfollow sync failed.');
      }

      return true;
    }).catch(function() {
      showSyncNote('Saved on this device. Account sync will retry later.');
      return false;
    });
  }

  function loadBackendFollows() {
    var customerEmail = getCustomerEmail();
    if (!isLoggedIn || !customerEmail || !hasBackendSync()) {
      return Promise.resolve(false);
    }

    return fetchJson(
      buildApiUrl('/api/notifications/my-follows?customerEmail=' + encodeURIComponent(customerEmail)),
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    ).then(function(result) {
      if (!result.ok || !result.payload || result.payload.ok !== true) {
        throw new Error(result.payload && result.payload.error ? result.payload.error : 'Follow load failed.');
      }

      if (Array.isArray(result.payload.follows) && result.payload.follows.length) {
        mergeFollowEntries(result.payload.follows);
        syncAllCaseUi();
      }

      return true;
    }).catch(function() {
      return false;
    });
  }

  function getInboxCardCaseData(element) {
    var card = element ? element.closest('.case-alert-inbox-card') : null;
    if (!card) return null;

    return {
      handle: normalizeHandle(card.getAttribute('data-case-handle'), card.getAttribute('data-case-url')),
      url: card.getAttribute('data-case-url') || '',
      title: card.getAttribute('data-case-title') || ''
    };
  }

  function findHandleFromFallbacks(element) {
    var cardData = getInboxCardCaseData(element) || {};
    if (cardData.handle) {
      return cardData.handle;
    }

    var followedCases = readFollowedCases();
    var cardUrl = String(cardData.url || '').trim();
    var cardTitle = String(cardData.title || '').trim().toLowerCase();
    var matchedHandle = '';

    Object.keys(followedCases).some(function(key) {
      var entry = followedCases[key] || {};
      var entryHandle = normalizeHandle(key, entry.url);
      var entryUrl = String(entry.url || '').trim();
      var entryTitle = String(entry.title || '').trim().toLowerCase();

      if ((cardUrl && entryUrl === cardUrl) || (cardTitle && entryTitle === cardTitle)) {
        matchedHandle = entryHandle;
        return true;
      }

      return false;
    });

    return matchedHandle;
  }

  function openModal(button) {
    if (!modal) return;

    var caseData = getButtonCaseData(button);
    if (!caseData) return;

    setActiveCase(caseData);
    lastFocusedButton = button;

    if (titleTarget) {
      titleTarget.textContent = activeCase.title;
    }

    if (freeButton) {
      if (isLoggedIn) {
        freeButton.textContent = getFollowCount(activeCase.handle) > 0 ? 'Following' : 'Follow this case';
        freeButton.setAttribute('href', '#follow-this-case');
      } else {
        freeButton.textContent = 'Follow free in member panel';
        freeButton.setAttribute('href', buildReturnUrl(activeCase.url));
      }
    }

    modal.hidden = false;
    document.body.classList.add('case-notification-modal-open');
  }

  function closeModal() {
    if (!modal) return;

    modal.hidden = true;
    document.body.classList.remove('case-notification-modal-open');

    if (lastFocusedButton && typeof lastFocusedButton.focus === 'function') {
      lastFocusedButton.focus();
    }
  }

  function saveFollowedCase(caseData) {
    var normalizedHandle = caseData ? normalizeHandle(caseData.handle, caseData.url) : '';
    if (!normalizedHandle) return false;

    var followedCases = readFollowedCases();
    var wasAlreadyFollowing = getFollowCount({
      handle: normalizedHandle,
      url: caseData.url,
      title: caseData.title
    }) > 0;
    var existingEntry = followedCases[normalizedHandle] || {};
    var nextEntry = {
      title: caseData.title || existingEntry.title || normalizedHandle,
      handle: normalizedHandle,
      url: normalizeUrl(caseData.url || existingEntry.url || window.location.pathname || '/') || '/',
      image: caseData.image || existingEntry.image || DEFAULT_CASE_IMAGE,
      location: caseData.location || existingEntry.location || '',
      followedAt: existingEntry.followedAt || new Date().toISOString(),
      status: caseData.status || existingEntry.status || 'WATCHING FOR UPDATES'
    };

    getMatchingCaseKeys({
      handle: normalizedHandle,
      url: nextEntry.url,
      title: nextEntry.title
    }).forEach(function(key) {
      delete followedCases[key];
    });

    followedCases[normalizedHandle] = nextEntry;

    if (!writeFollowedCases(followedCases)) return false;

    updateCaseUi(nextEntry);
    renderFollowedCasesLists();

    if (!wasAlreadyFollowing && window.MissingAlertsNotifications && typeof window.MissingAlertsNotifications.addFollowNotification === 'function') {
      window.MissingAlertsNotifications.addFollowNotification(nextEntry);
    }

    return true;
  }

  function followCase(caseData, trigger) {
    var resolvedCase = caseData || getActiveCase() || getButtonCaseData(trigger);
    if (!resolvedCase) return false;

    setActiveCase(resolvedCase);
    var didSave = saveFollowedCase(resolvedCase);
    if (didSave) {
      syncFollowToBackend(resolvedCase);
    }
    return didSave;
  }

  function toggleFollowCase(caseData, trigger) {
    var resolvedCase = caseData || getButtonCaseData(trigger) || getActiveCase();
    if (!resolvedCase) return false;

    if (getFollowCount(resolvedCase) > 0) {
      unfollowCase(resolvedCase.handle, {
        url: resolvedCase.url,
        title: resolvedCase.title
      });
      syncUnfollowToBackend(resolvedCase);
      return true;
    }

    return followCase(resolvedCase, trigger);
  }

  function shareCase(trigger) {
    if (!trigger) return;

    var shareUrl = String(trigger.getAttribute('data-share-url') || '').trim();
    var shareTitle = String(trigger.getAttribute('data-share-title') || '').trim();
    if (!shareUrl) return;

    var labelNode = trigger.querySelector('.case-card__share-label');
    var defaultLabel = trigger.getAttribute('data-default-share-label') || (labelNode ? labelNode.textContent : trigger.textContent);
    defaultLabel = String(defaultLabel || '').trim() || 'Share';

    function setShareLabel(nextLabel) {
      if (labelNode) {
        labelNode.textContent = nextLabel;
      } else {
        trigger.textContent = nextLabel;
      }
    }

    function flashCopiedLabel() {
      setShareLabel('Copied');
      window.setTimeout(function() {
        setShareLabel(defaultLabel);
      }, 1600);
    }

    if (navigator.share) {
      navigator.share({
        title: shareTitle,
        url: shareUrl
      }).catch(function() {});
      return;
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareUrl).then(flashCopiedLabel).catch(function() {
        window.prompt('Copy this link:', shareUrl);
      });
      return;
    }

    window.prompt('Copy this link:', shareUrl);
  }

  document.addEventListener('click', function(event) {
    var directFollowTrigger = event.target.closest(FOLLOW_TRIGGER_SELECTOR);
    if (directFollowTrigger) {
      var directCase = getButtonCaseData(directFollowTrigger);
      if (!directCase) return;

      if (!isLoggedIn) {
        if (directFollowTrigger.tagName !== 'A') {
          event.preventDefault();
          window.location.href = buildReturnUrl(directCase.url);
        }
        return;
      }

      event.preventDefault();
      toggleFollowCase(directCase, directFollowTrigger);
      return;
    }

    var shareTrigger = event.target.closest('.js-case-share-button, .case-share-btn');
    if (shareTrigger) {
      event.preventDefault();
      shareCase(shareTrigger);
      return;
    }

    var notifyTrigger = event.target.closest(NOTIFY_TRIGGER_SELECTOR);
    if (notifyTrigger) {
      event.preventDefault();
      openModal(notifyTrigger);
      return;
    }

    var closeTrigger = event.target.closest('[data-case-notification-close]');
    if (closeTrigger && modal && !modal.hidden) {
      event.preventDefault();
      closeModal();
      return;
    }

    var freeFollowTrigger = event.target.closest('[data-case-notification-free]');
    if (freeFollowTrigger && modal && !modal.hidden && isLoggedIn) {
      event.preventDefault();

      if (followCase(getActiveCase(), freeFollowTrigger)) {
        if (freeButton) {
          freeButton.textContent = 'Following';
        }
        closeModal();
      }
      return;
    }

    var unfollowTrigger = event.target.closest('[data-unfollow-case], .case-alert-remove, .js-case-unfollow-button');
    if (unfollowTrigger) {
      event.preventDefault();
      event.stopPropagation();

      var unfollowHandle = normalizeHandle(
        unfollowTrigger.getAttribute('data-case-handle'),
        unfollowTrigger.getAttribute('data-case-url')
      );

      if (!unfollowHandle) {
        unfollowHandle = findHandleFromFallbacks(unfollowTrigger);
      }

      if (!unfollowHandle) {
        console.warn('[Missing Alerts] Could not unfollow case: missing handle');
        return;
      }

      unfollowCase(unfollowHandle, {
        url: unfollowTrigger.getAttribute('data-case-url') || (getInboxCardCaseData(unfollowTrigger) || {}).url,
        title: unfollowTrigger.getAttribute('data-case-title') || (getInboxCardCaseData(unfollowTrigger) || {}).title
      });
    }
  });

  Array.prototype.forEach.call(closeControls, function(control) {
    if (!control || !control.addEventListener) return;

    control.addEventListener('click', function(event) {
      event.preventDefault();
      closeModal();
    });
  });

  document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape' && modal && !modal.hidden) {
      closeModal();
    }
  });

  window.addEventListener('storage', function(event) {
    if (event.key === STORAGE_KEY) {
      syncAllCaseUi();
    }
  });

  loadBackendFollows();

  function applyCasePageFinalPolish() {
    var handle = normalizeHandle('', window.location.pathname);
    var verifiedCaseFixes = {
      'jan-hussain': {
        name: 'Jan Hussain',
        status: 'ACTIVE',
        age: '30',
        country: 'United Kingdom',
        cityRegion: 'Glasgow, Scotland',
        lastSeen: 'Croftfoot Road area, south-east Glasgow, Scotland, United Kingdom',
        lastSeenAt: 'Wednesday, 25 March, 2026',
        description: 'Around 5ft 7in, with shoulder-length brown hair, and of medium build.',
        clothing: 'Brown trousers and a grey t-shirt.',
        travel: 'Believed to have travelled from Birmingham to south-east Glasgow.',
        contact: 'Contact Police Scotland on 101 quoting reference 2424 of 30 March, 2026.',
        sourceName: 'Police Scotland',
        sourceUrl: 'https://www.scotland.police.uk/what-s-happening/news/2026/april/appeal-to-help-trace-jan-hussain-believed-to-have-travelled-to-glasgow/',
        image: 'https://cdn.shopify.com/s/files/1/1036/9502/4288/articles/jan-hussain_3695dc81-c697-49f5-84a2-ae0c12fc3d8d.png?v=1777999497',
        lat: '55.816',
        lng: '-4.229'
      }
    };
    var fix = verifiedCaseFixes[handle];

    if (fix) {
      var heroImage = document.querySelector('.case-page-main-image-shell img.case-page-main-image, .case-page-main-image-shell img');
      if (heroImage) {
        heroImage.src = fix.image;
        heroImage.alt = fix.name + ' official public appeal image';
        heroImage.loading = 'eager';
        heroImage.fetchPriority = 'high';
      }

      var details = document.querySelector('.case-page-main-details');
      if (details) {
        details.className = 'case-page-main-details case-page-overview';
        details.setAttribute('aria-label', 'Case overview');
        details.innerHTML =
          '<div class="case-page-card__eyebrow">Key points</div>' +
          '<h2 class="case-page-card__title">Case Overview</h2>' +
          '<div class="case-page-overview__grid">' +
          caseOverviewItem('Status', fix.status) +
          caseOverviewItem('Last Seen', fix.lastSeen, true) +
          caseOverviewItem('Last Seen Time', fix.lastSeenAt) +
          caseOverviewItem('Age', fix.age) +
          caseOverviewItem('Country', fix.country) +
          caseOverviewItem('Location', fix.cityRegion) +
          caseOverviewItem('Description', fix.description, true) +
          caseOverviewItem('Clothing', fix.clothing, true) +
          caseOverviewItem('Travel Context', fix.travel, true) +
          caseOverviewItem('Official Contact', fix.contact, true) +
          '<div class="case-page-stat case-page-overview__item"><span class="case-page-stat__label">Source</span><span class="case-page-stat__value"><a href="' + fix.sourceUrl + '" target="_blank" rel="noopener noreferrer">' + escapeCaseHtml(fix.sourceName) + '</a></span></div>' +
          '</div>';
      }

      var mapCard = document.querySelector('.case-location-map-card--standalone');
      if (!mapCard && details) {
        mapCard = document.createElement('section');
        mapCard.className = 'case-location-map-card case-location-map-card--standalone sidebar-card sidebar-card--map';
        details.insertAdjacentElement('afterend', mapCard);
      }
      if (mapCard) {
        var lat = Number(fix.lat);
        var lng = Number(fix.lng);
        var mapSrc = 'https://www.openstreetmap.org/export/embed.html?bbox=' +
          encodeURIComponent((lng - 0.02) + ',' + (lat - 0.015) + ',' + (lng + 0.02) + ',' + (lat + 0.015)) +
          '&layer=mapnik&marker=' + encodeURIComponent(fix.lat + ',' + fix.lng);
        mapCard.setAttribute('data-map-lat', fix.lat);
        mapCard.setAttribute('data-map-lng', fix.lng);
        mapCard.setAttribute('data-map-query', fix.lastSeen);
        mapCard.classList.remove('case-location-map-card--fallback-active');
        mapCard.innerHTML =
          '<div class="case-location-map-card__eyebrow">Last Seen Location</div>' +
          '<div class="case-location-map-card__frame">' +
          '<iframe title="Approximate public last seen area map" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="' + mapSrc + '"></iframe>' +
          '<div class="case-location-map-card__pin" aria-hidden="true"></div>' +
          '</div>' +
          '<div class="case-location-map-card__location"><strong>Approximate public last-seen area</strong><span>' + escapeCaseHtml(fix.lastSeen) + '</span></div>' +
          '<div class="case-location-map-card__meta">Coordinates are approximate and based only on public source information.</div>';
      }
    }

    var imageShell = document.querySelector('.case-page-main-image-shell');
    if (imageShell && !imageShell.querySelector('.case-image-alert-bell')) {
      var existingHeroButton = document.querySelector('.case-notify-button--hero, .js-case-notify-button');
      var bell = document.createElement('button');
      bell.type = 'button';
      bell.className = 'case-image-alert-bell case-notify-button js-case-notify-button';
      bell.setAttribute('aria-haspopup', 'dialog');
      bell.setAttribute('aria-controls', 'case-notification-modal');
      bell.setAttribute('aria-label', 'Get alerts on this case');
      if (existingHeroButton) {
        ['data-case-title', 'data-case-handle', 'data-case-url', 'data-case-id', 'data-case-image', 'data-case-location'].forEach(function(name) {
          var value = existingHeroButton.getAttribute(name);
          if (value) bell.setAttribute(name, value);
        });
      }
      bell.innerHTML = '<span class="case-image-alert-bell__icon" aria-hidden="true">🔔</span><span class="case-image-alert-bell__text">Alerts</span>';
      imageShell.insertBefore(bell, imageShell.firstChild);
    }

    Array.prototype.forEach.call(document.querySelectorAll('.case-page-location-links'), function(node) {
      node.parentNode && node.parentNode.removeChild(node);
    });

    if (modal) {
      var eyebrow = modal.querySelector('.case-notification-modal__eyebrow');
      var title = modal.querySelector('.case-notification-modal__title');
      var optionTitles = modal.querySelectorAll('.case-notification-option__title');
      var optionButtons = modal.querySelectorAll('.case-notification-option__button');
      if (eyebrow) eyebrow.textContent = 'Case alerts';
      if (title) title.textContent = 'GET ALERTS ON THIS CASE';
      if (optionTitles[0]) optionTitles[0].textContent = 'FREE ALERTS IN DASHBOARD';
      if (optionTitles[1]) optionTitles[1].textContent = 'WHATSAPP ALERTS ON THIS CASE';
      if (optionButtons[0]) optionButtons[0].textContent = 'Set up free dashboard alerts';
      if (optionButtons[1]) optionButtons[1].textContent = 'WhatsApp alerts coming soon';
    }
  }

  function caseOverviewItem(label, value, wide) {
    if (!value) return '';
    return '<div class="case-page-stat case-page-overview__item' + (wide ? ' case-page-overview__item--wide' : '') + '"><span class="case-page-stat__label">' + escapeCaseHtml(label) + '</span><span class="case-page-stat__value">' + escapeCaseHtml(value) + '</span></div>';
  }

  function escapeCaseHtml(value) {
    return String(value || '').replace(/[&<>"']/g, function(char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
    });
  }

  applyCasePageFinalPolish();
  window.setTimeout(applyCasePageFinalPolish, 300);
  window.setTimeout(applyCasePageFinalPolish, 1200);

  // Backend hook: POST /api/notifications/follow-case
  // Future backend hook: POST /api/notifications/mobile-case-alert
  // Future backend hook: POST /api/notifications/local-area-alerts
  syncAllCaseUi();
})();
