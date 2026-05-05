(function() {
  var STORAGE_KEY = 'missingAlertsOwnerNotifications';
  var SESSION_FOLLOW_KEY = 'missingAlertsOwnerNotificationFollowedHandles';
  var EVENT_NAME = 'missing-alerts-notifications-updated';
  var MEMBER_LINK_SELECTOR = 'a[href*="/pages/member-area"], a[href*="return_url=/pages/member-area"]';
  var FOLLOWED_CASES_KEY = 'missingAlertsFollowedCases';
  var BACKEND_CACHE_KEY = 'missingAlertsMemberInboxBackendNotifications';
  var apiBase = String(window.MISSING_ALERTS_API_BASE || '').trim().replace(/\/+$/, '');
  var currentFilter = 'all';

  function readJson(storage, key, fallback) {
    try {
      var parsed = JSON.parse(storage.getItem(key) || '');
      return parsed || fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(storage, key, value) {
    try {
      storage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      return false;
    }
  }

  function getAll() {
    var stored = readJson(window.localStorage, STORAGE_KEY, []);
    return Array.isArray(stored) ? stored.filter(function(item) {
      return item && typeof item === 'object' && item.id;
    }) : [];
  }

  function saveAll(notifications) {
    return writeJson(window.localStorage, STORAGE_KEY, notifications);
  }

  function dispatchUpdated() {
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDate(value) {
    var date = value ? new Date(value) : null;
    if (!date || isNaN(date.getTime())) return 'Just now';

    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function normalizeType(value) {
    var type = String(value || '').toLowerCase().trim();
    if (type === 'case_followed') return 'case_update';
    if (type === 'followed_case_update' || type === 'followed_case') return 'followed_case_update';
    if (type === 'country_alert') return 'country_alert';
    if (type === 'near_you_alert') return 'near_you_alert';
    if (type === 'found_safe' || type === 'found_safe_alert') return 'found_safe';
    if (type === 'professional_help' || type === 'professional_help_message') return 'professional_help';
    if (type === 'organised_search' || type === 'organized_search') return 'organised_search';
    if (type === 'social_amplify' || type === 'amplify' || type === 'social') return 'social_amplify';
    if (type === 'boost' || type === 'spotlight' || type === 'fundraiser' || type === 'system' || type === 'case_update') return type;
    return 'system';
  }

  function normalizeNotification(item, source) {
    if (!item || typeof item !== 'object') return null;

    var type = normalizeType(item.type || item.notificationType);
    var id = String(item.id || source + '-' + type + '-' + (item.caseHandle || item.caseUrl || item.caseTitle || item.title || Date.now()));

    return {
      id: id,
      type: type,
      title: item.title || typeLabel(type),
      message: item.message || item.body || item.description || defaultMessageForType(type),
      caseTitle: item.caseTitle || item.targetTitle || '',
      caseUrl: item.caseUrl || item.targetUrl || '',
      caseImageUrl: item.caseImageUrl || item.case_image_url || '',
      countryCode: item.countryCode || item.country_code || '',
      locationDisplay: item.locationDisplay || item.location_display || '',
      distanceKm: item.distanceKm || item.distance_km || '',
      alertReason: item.alertReason || item.alert_reason || '',
      ctaLabel: item.ctaLabel || item.cta_label || '',
      createdAt: item.createdAt || item.created_at || item.updatedAt || new Date().toISOString(),
      read: Boolean(item.read || item.readAt),
      priority: String(item.priority || '').toLowerCase() || (type === 'organised_search' || type === 'case_update' ? 'normal' : 'low'),
      source: source || 'local'
    };
  }

  function typeLabel(type) {
    var labels = {
      case_update: 'Case update',
      followed_case_update: 'Followed case update',
      country_alert: 'New case in your country',
      near_you_alert: 'New case near you',
      found_safe: 'Found safe',
      professional_help: 'Professional help',
      organised_search: 'Organised search',
      social_amplify: 'Social activity',
      boost: 'Boost update',
      spotlight: 'Spotlight update',
      fundraiser: 'Fundraiser update',
      system: 'System message'
    };
    return labels[type] || 'System message';
  }

  function defaultMessageForType(type) {
    var messages = {
      case_update: 'There is an update connected to one of your cases.',
      followed_case_update: 'There is an update connected to a case you follow.',
      country_alert: 'A new approved missing-person case has been published in your country.',
      near_you_alert: 'A new approved missing-person case has been published near your saved alert area.',
      found_safe: 'A case you follow has been marked found safe.',
      professional_help: 'There is a professional help message connected to your account.',
      organised_search: 'A planned search update will appear here once reviewed.',
      social_amplify: 'Your Alert Dispatch status will appear here when available.',
      boost: 'Boost purchase status updates will appear here when available.',
      spotlight: 'Spotlight purchase status updates will appear here when available.',
      fundraiser: 'Family fundraiser updates will appear here when available.',
      system: 'Account and system messages will appear here.'
    };
    return messages[type] || messages.system;
  }

  function getBackendCache() {
    var stored = readJson(window.localStorage, BACKEND_CACHE_KEY, []);
    return Array.isArray(stored) ? stored : [];
  }

  function saveBackendCache(notifications) {
    writeJson(window.localStorage, BACKEND_CACHE_KEY, notifications || []);
  }

  function markBackendCachedRead(id) {
    var changed = false;
    var notifications = getBackendCache().map(function(notification) {
      if (String(notification.id || '') === String(id || '') && !notification.read && !notification.readAt) {
        changed = true;
        return Object.assign({}, notification, {
          read: true,
          readAt: new Date().toISOString()
        });
      }

      return notification;
    });

    if (!changed) return false;

    saveBackendCache(notifications);
    renderMemberInboxes();
    return true;
  }

  function getFollowedCaseNotifications() {
    var followedCases = readJson(window.localStorage, FOLLOWED_CASES_KEY, {});
    var entries = [];

    if (Array.isArray(followedCases)) {
      entries = followedCases;
    } else if (followedCases && typeof followedCases === 'object') {
      entries = Object.keys(followedCases).map(function(key) {
        var value = followedCases[key] || {};
        return Object.assign({ handle: key }, value);
      });
    }

    return entries.map(function(entry) {
      return normalizeNotification({
        id: 'followed-case-' + (entry.handle || entry.url || entry.title),
        type: 'followed_case_update',
        title: 'Following case',
        message: 'You are following this case for future updates.',
        caseTitle: entry.title || 'Missing person case',
        caseUrl: entry.url || '/blogs/missing-persons',
        createdAt: entry.followedAt || entry.createdAt,
        read: true,
        priority: 'low'
      }, 'following');
    }).filter(Boolean);
  }

  function getUnifiedNotifications() {
    var byId = {};
    var combined = []
      .concat(getAll().map(function(item) { return normalizeNotification(item, 'owner'); }))
      .concat(getFollowedCaseNotifications())
      .concat(getBackendCache().map(function(item) { return normalizeNotification(item, 'backend'); }))
      .filter(Boolean);

    combined.forEach(function(item) {
      byId[item.id] = item;
    });

    return Object.keys(byId)
      .map(function(id) { return byId[id]; })
      .sort(function(a, b) {
        if (Boolean(a.read) !== Boolean(b.read)) return a.read ? 1 : -1;
        return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
      });
  }

  function getFilterGroup(notification) {
    if (!notification) return 'system';
    if (notification.type === 'country_alert' || notification.type === 'near_you_alert') return 'following';
    if (notification.type === 'case_update') return 'my-cases';
    if (notification.type === 'found_safe' || notification.type === 'professional_help') return 'my-cases';
    if (notification.type === 'followed_case_update') return 'following';
    if (notification.type === 'organised_search') return 'searches';
    if (notification.type === 'social_amplify') return 'social';
    if (notification.type === 'boost' || notification.type === 'spotlight' || notification.type === 'fundraiser') return 'social';
    return 'system';
  }

  function matchesFilter(notification, filter) {
    if (!filter || filter === 'all') return true;
    if (filter === 'unread') return !notification.read;
    return getFilterGroup(notification) === filter;
  }

  function updateText(nodes, value) {
    Array.prototype.forEach.call(nodes || [], function(node) {
      node.textContent = String(value);
    });
  }

  function renderMemberInboxes() {
    var inboxes = document.querySelectorAll('[data-member-inbox]');
    if (!inboxes.length) return;

    var notifications = getUnifiedNotifications();
    var unread = notifications.filter(function(item) { return !item.read; });
    var caseUpdates = notifications.filter(function(item) {
      return item.type === 'case_update' || item.type === 'followed_case_update';
    });
    var searches = notifications.filter(function(item) { return item.type === 'organised_search'; });
    var social = notifications.filter(function(item) {
      return item.type === 'social_amplify' || item.type === 'boost' || item.type === 'spotlight' || item.type === 'fundraiser';
    });

    updateText(document.querySelectorAll('[data-member-inbox-count]'), notifications.length ? '(' + notifications.length + ')' : '');
    updateText(document.querySelectorAll('[data-member-inbox-unread-count]'), unread.length);
    updateText(document.querySelectorAll('[data-member-inbox-case-count]'), caseUpdates.length);
    updateText(document.querySelectorAll('[data-member-inbox-search-count]'), searches.length);
    updateText(document.querySelectorAll('[data-member-inbox-social-count]'), social.length);

    Array.prototype.forEach.call(inboxes, function(inbox) {
      var list = inbox.querySelector('[data-member-inbox-list]');
      var empty = inbox.querySelector('[data-member-inbox-empty]');
      var filtered = notifications.filter(function(notification) {
        return matchesFilter(notification, currentFilter);
      });

      if (!list) return;

      if (!filtered.length) {
        list.innerHTML = '';
        if (empty) empty.hidden = false;
        return;
      }

      if (empty) empty.hidden = true;
      list.innerHTML = filtered.map(renderMemberInboxCard).join('');
    });
  }

  function renderMemberInboxCard(notification) {
    var unreadClass = notification.read ? '' : ' is-unread';
    var urgentClass = notification.priority === 'urgent' || notification.priority === 'high' ? ' is-urgent' : '';
    var isFundraiser = notification.type === 'fundraiser' || String(notification.title || '').toUpperCase().indexOf('FUNDRAISER') !== -1;
    var badge = notification.alertReason || typeLabel(notification.type);
    var imageMarkup = notification.caseImageUrl
      ? '<div class="ma-member-inbox-card__media"><img src="' + escapeHtml(notification.caseImageUrl) + '" alt="' + escapeHtml(notification.caseTitle || notification.title || 'Case image') + '"></div>'
      : '';
    var locationMarkup = notification.locationDisplay
      ? '<p class="ma-member-inbox-card__case">' + escapeHtml(notification.locationDisplay) + (notification.distanceKm ? ' - approximately ' + escapeHtml(notification.distanceKm) + ' km' : '') + '</p>'
      : '';
    var caseMarkup = notification.caseTitle
      ? '<p class="ma-member-inbox-card__case">Related case: ' + escapeHtml(notification.caseTitle) + '</p>'
      : '';
    var viewCase = notification.caseUrl
      ? '<a class="ma-member-inbox-card__button ma-member-inbox-card__button--secondary" href="' + escapeHtml(notification.caseUrl) + '">' + escapeHtml(notification.ctaLabel || (isFundraiser ? 'VIEW FUNDRAISER' : 'View case')) + '</a>'
      : '';
    var readButton = notification.read
      ? ''
      : '<button type="button" class="ma-member-inbox-card__button" data-member-inbox-mark-read="' + escapeHtml(notification.id) + '">Mark as read</button>';

    return (
      '<article class="ma-member-inbox-card' + unreadClass + urgentClass + '" data-member-inbox-item data-member-inbox-type="' + escapeHtml(notification.type) + '">' +
        imageMarkup +
        '<div class="ma-member-inbox-card__content">' +
          '<div class="ma-member-inbox-card__top">' +
            '<span class="ma-member-inbox-card__badge">' + escapeHtml(isFundraiser ? 'FUNDRAISER' : badge) + '</span>' +
            '<time class="ma-member-inbox-card__time" datetime="' + escapeHtml(notification.createdAt || '') + '">' + escapeHtml(formatDate(notification.createdAt)) + '</time>' +
          '</div>' +
          '<h3 class="ma-member-inbox-card__title">' + escapeHtml(notification.title || typeLabel(notification.type)) + '</h3>' +
          '<p class="ma-member-inbox-card__message">' + escapeHtml(notification.message || defaultMessageForType(notification.type)) + '</p>' +
          locationMarkup +
          caseMarkup +
        '</div>' +
        '<div class="ma-member-inbox-card__actions">' +
          viewCase +
          readButton +
        '</div>' +
      '</article>'
    );
  }

  function fetchMemberInboxFromBackend() {
    if (!apiBase) return;

    var customer = window.MissingAlertsCustomer || {};
    if (!customer.loggedIn || (!customer.email && !customer.id)) return;

    var url = apiBase + '/api/members/inbox?customerEmail=' + encodeURIComponent(customer.email || '') + '&customerId=' + encodeURIComponent(customer.id || '');

    window.fetch(url, { headers: { Accept: 'application/json' } })
      .then(function(response) {
        if (!response.ok) throw new Error('Member inbox fetch failed');
        return response.json();
      })
      .then(function(payload) {
        var notifications = payload && Array.isArray(payload.notifications) ? payload.notifications : [];
        saveBackendCache(notifications);
        renderMemberInboxes();
      })
      .catch(function() {
        renderMemberInboxes();
      });
  }

  function getSessionFollowHandles() {
    var stored = readJson(window.sessionStorage, SESSION_FOLLOW_KEY, []);
    return Array.isArray(stored) ? stored : [];
  }

  function hasSessionFollowNotification(caseHandle) {
    return getSessionFollowHandles().indexOf(String(caseHandle || '')) !== -1;
  }

  function rememberSessionFollowNotification(caseHandle) {
    var handle = String(caseHandle || '');
    if (!handle) return;

    var handles = getSessionFollowHandles();
    if (handles.indexOf(handle) === -1) {
      handles.push(handle);
      writeJson(window.sessionStorage, SESSION_FOLLOW_KEY, handles);
    }
  }

  function add(notification) {
    if (!notification || !notification.id) return false;

    var notifications = getAll();
    notifications.push(notification);

    if (!saveAll(notifications)) return false;

    refreshBadges();
    renderOwnerInboxes();
    renderMemberInboxes();
    dispatchUpdated();
    return true;
  }

  function addFollowNotification(caseData) {
    if (!caseData || !caseData.handle || hasSessionFollowNotification(caseData.handle)) {
      return false;
    }

    var notification = {
      id: 'follow-' + caseData.handle + '-' + Date.now(),
      type: 'case_followed',
      title: 'New case follower',
      message: 'Someone followed this case for alerts.',
      caseTitle: caseData.title || 'Missing person case',
      caseHandle: caseData.handle,
      caseUrl: caseData.url || window.location.pathname || '/',
      read: false,
      createdAt: new Date().toISOString()
    };

    if (add(notification)) {
      rememberSessionFollowNotification(caseData.handle);
      return true;
    }

    return false;
  }

  function markRead(id) {
    var changed = false;
    var notifications = getAll().map(function(notification) {
      if (notification.id === id && !notification.read) {
        changed = true;
        return Object.assign({}, notification, { read: true });
      }

      return notification;
    });

    if (!changed || !saveAll(notifications)) return false;

    refreshBadges();
    renderOwnerInboxes();
    renderMemberInboxes();
    dispatchUpdated();
    return true;
  }

  function getUnreadCount() {
    return getAll().filter(function(notification) {
      return !notification.read;
    }).length;
  }

  function ensureBadge(link) {
    var badge = link.querySelector('.ma-member-tab-notification-badge');
    if (badge) return badge;

    badge = document.createElement('span');
    badge.className = 'ma-member-tab-notification-badge';
    badge.setAttribute('aria-label', 'Unread case owner notifications');
    link.classList.add('ma-member-tab-notification-anchor');
    link.appendChild(badge);
    return badge;
  }

  function refreshBadges() {
    var count = getUnreadCount();
    var label = count > 9 ? '9+' : String(count);
    var links = document.querySelectorAll(MEMBER_LINK_SELECTOR);

    Array.prototype.forEach.call(links, function(link) {
      if (!link || !link.querySelector) return;

      var badge = ensureBadge(link);
      badge.textContent = label;
      badge.hidden = count === 0;
    });
  }

  function renderOwnerInboxes() {
    var lists = document.querySelectorAll('[data-owner-inbox-list]');
    if (!lists.length) return;

    var notifications = getAll().sort(function(a, b) {
      if (Boolean(a.read) !== Boolean(b.read)) return a.read ? 1 : -1;
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });

    Array.prototype.forEach.call(lists, function(list) {
      var shell = list.closest('[data-owner-inbox]');
      var count = shell ? shell.querySelector('[data-owner-inbox-count]') : null;
      var followNotifications = notifications.filter(function(notification) {
        return notification.type === 'case_followed';
      });
      var unreadCount = followNotifications.filter(function(notification) {
        return !notification.read;
      }).length;

      if (count) {
        count.textContent = unreadCount ? unreadCount + ' unread' : '';
        count.hidden = unreadCount === 0;
      }

      if (!followNotifications.length) {
        list.innerHTML = '<p class="ma-owner-inbox__empty">No case notifications yet.</p>';
        return;
      }

      list.innerHTML = followNotifications.map(function(notification) {
        var readClass = notification.read ? ' is-read' : '';
        var readButton = notification.read
          ? '<span class="ma-owner-inbox-card__read-label">Read</span>'
          : '<button type="button" class="ma-owner-inbox-card__read-button" data-owner-notification-read="' + escapeHtml(notification.id) + '">Mark as read</button>';

        return (
          '<article class="ma-owner-inbox-card' + readClass + '">' +
            '<div class="ma-owner-inbox-card__content">' +
              '<div class="ma-owner-inbox-card__type">' + escapeHtml(notification.title || 'New case follower') + '</div>' +
              '<p class="ma-owner-inbox-card__message">' + escapeHtml(notification.message || 'Someone followed this case for alerts.') + '</p>' +
              '<h3 class="ma-owner-inbox-card__title">' + escapeHtml(notification.caseTitle || 'Missing person case') + '</h3>' +
              '<time class="ma-owner-inbox-card__time" datetime="' + escapeHtml(notification.createdAt || '') + '">' + escapeHtml(formatDate(notification.createdAt)) + '</time>' +
            '</div>' +
            '<div class="ma-owner-inbox-card__actions">' +
              '<a class="ma-owner-inbox-card__link" href="' + escapeHtml(notification.caseUrl || '/blogs/missing-persons') + '">View case</a>' +
              readButton +
            '</div>' +
          '</article>'
        );
      }).join('');
    });
  }

  window.MissingAlertsNotifications = {
    getAll: getAll,
    add: add,
    markRead: markRead,
    getUnreadCount: getUnreadCount,
    refreshBadges: refreshBadges,
    addFollowNotification: addFollowNotification,
    normalizeNotification: normalizeNotification,
    getUnifiedNotifications: getUnifiedNotifications,
    renderMemberInboxes: renderMemberInboxes
  };

  document.addEventListener('click', function(event) {
    var button = event.target.closest('[data-owner-notification-read]');
    if (!button) return;

    event.preventDefault();
    markRead(button.getAttribute('data-owner-notification-read'));
  });

  document.addEventListener('click', function(event) {
    var filterButton = event.target.closest('[data-member-inbox-filter]');
    if (!filterButton) return;

    event.preventDefault();
    currentFilter = filterButton.getAttribute('data-member-inbox-filter') || 'all';
    Array.prototype.forEach.call(document.querySelectorAll('[data-member-inbox-filter]'), function(button) {
      button.classList.toggle('is-active', button === filterButton);
    });
    renderMemberInboxes();
  });

  document.addEventListener('click', function(event) {
    var readButton = event.target.closest('[data-member-inbox-mark-read]');
    if (!readButton) return;

    event.preventDefault();
    var notificationId = readButton.getAttribute('data-member-inbox-mark-read');
    var markedLocal = markRead(notificationId);
    var markedBackend = markBackendCachedRead(notificationId);

    if (!markedLocal && markedBackend) {
      dispatchUpdated();
    }

    if (apiBase) {
      var customer = window.MissingAlertsCustomer || {};
      window.fetch(apiBase + '/api/members/inbox/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          notification_id: notificationId,
          customerId: customer.id || '',
          customerEmail: customer.email || ''
        })
      }).catch(function() {});
    }
  });

  document.addEventListener('missingalerts:followed-cases-updated', function() {
    renderMemberInboxes();
  });

  window.addEventListener(EVENT_NAME, function() {
    refreshBadges();
    renderOwnerInboxes();
    renderMemberInboxes();
  });

  window.addEventListener('focus', function() {
    refreshBadges();
    renderOwnerInboxes();
    renderMemberInboxes();
    fetchMemberInboxFromBackend();
  });

  window.addEventListener('storage', function(event) {
    if (event.key === STORAGE_KEY || event.key === FOLLOWED_CASES_KEY || event.key === BACKEND_CACHE_KEY) {
      refreshBadges();
      renderOwnerInboxes();
      renderMemberInboxes();
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      refreshBadges();
      renderOwnerInboxes();
      renderMemberInboxes();
      fetchMemberInboxFromBackend();
    });
  } else {
    refreshBadges();
    renderOwnerInboxes();
    renderMemberInboxes();
    fetchMemberInboxFromBackend();
  }
})();
