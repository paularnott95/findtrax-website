(function() {
  var VISITOR_KEY = 'missingAlertsVisitorId';
  var apiBase = String(window.MISSING_ALERTS_API_BASE || '').trim().replace(/\/+$/, '');

  function hasBackendSync() {
    return Boolean(apiBase && !/YOUR_VERCEL_DOMAIN_HERE/i.test(apiBase));
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, function(character) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[character];
    });
  }

  function getVisitorId() {
    try {
      var current = window.localStorage.getItem(VISITOR_KEY);
      if (current) return current;

      var generated = 'visitor-' + Date.now() + '-' + Math.random().toString(36).slice(2);
      window.localStorage.setItem(VISITOR_KEY, generated);
      return generated;
    } catch (error) {
      return 'visitor-session-' + Date.now();
    }
  }

  function getViewerType() {
    var customer = window.MissingAlertsCustomer || {};
    var tags = Array.isArray(customer.tags) ? customer.tags.join(',').toLowerCase() : '';

    if (!customer.loggedIn) return 'public';
    if (tags.indexOf('professional') !== -1 || tags.indexOf('verified-professional') !== -1) return 'professional';
    if (tags.indexOf('case_owner') !== -1 || tags.indexOf('case-owner') !== -1 || tags.indexOf('family') !== -1) return 'case owner';
    return 'member';
  }

  function getCountry() {
    try {
      return document.documentElement.getAttribute('data-country') || window.localStorage.getItem('missingAlertsCountry') || '';
    } catch (error) {
      return document.documentElement.getAttribute('data-country') || '';
    }
  }

  function postProfileView(profile) {
    if (!hasBackendSync() || !profile) return;

    var profileId = profile.getAttribute('data-pro-profile-id') || '';
    var profileTitle = profile.getAttribute('data-pro-profile-title') || '';
    var professionalCustomerId = profile.getAttribute('data-pro-customer-id') || '';
    var organisationId = profile.getAttribute('data-organisation-id') || '';

    if (!profileId || !profileTitle || (!professionalCustomerId && !organisationId)) return;

    window.fetch(apiBase + '/api/professionals/profile-view', {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profileId: profileId,
        profileType: profile.getAttribute('data-pro-profile-type') || 'professional',
        profileTitle: profileTitle,
        profileUrl: profile.getAttribute('data-pro-profile-url') || window.location.href,
        professionalCustomerId: professionalCustomerId,
        organisationId: organisationId,
        viewerType: getViewerType(),
        viewerCountry: getCountry(),
        viewerRegion: profile.getAttribute('data-viewer-region') || '',
        viewerCity: profile.getAttribute('data-viewer-city') || '',
        visitorId: getVisitorId()
      })
    }).catch(function() {});
  }

  function timeAgo(value) {
    var date = value ? new Date(value) : null;
    if (!date || isNaN(date.getTime())) return 'Just now';

    var seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
    if (seconds < 60) return 'Just now';
    var minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes + 'm ago';
    var hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + 'h ago';
    var days = Math.floor(hours / 24);
    return days + 'd ago';
  }

  function formatLocation(notification) {
    return [notification.viewerCity, notification.viewerRegion, notification.viewerCountry].filter(Boolean).join(', ');
  }

  function notificationMessage(notification) {
    return notification.notificationType === 'organisation_profile_view'
      ? 'Someone viewed your organisation profile.'
      : 'Someone viewed your professional profile.';
  }

  function renderNotificationList(root, payload) {
    var list = root.querySelector('[data-professional-notifications-list]');
    var count = root.querySelector('[data-professional-notifications-count]');
    if (!list) return;

    var notifications = Array.isArray(payload.notifications) ? payload.notifications : [];
    var unreadCount = Number(payload.unreadCount || 0);

    if (count) {
      count.textContent = unreadCount ? unreadCount + ' unread' : '';
      count.hidden = unreadCount === 0;
    }

    if (!notifications.length) {
      list.innerHTML = '<p class="ma-owner-inbox__empty">No professional notifications yet.</p>';
      return;
    }

    list.innerHTML = notifications.map(function(notification) {
      var location = formatLocation(notification);
      var viewerType = notification.viewerType ? 'Viewer: ' + notification.viewerType : '';
      var meta = [location, viewerType].filter(Boolean).join(' · ');

      return (
        '<article class="ma-owner-inbox-card">' +
          '<div class="ma-owner-inbox-card__content">' +
            '<div class="ma-owner-inbox-card__type">' + escapeHtml(notificationMessage(notification)) + '</div>' +
            '<p class="ma-owner-inbox-card__message">' + escapeHtml(meta || 'Viewer location unavailable') + '</p>' +
            '<h3 class="ma-owner-inbox-card__title">' + escapeHtml(notification.targetTitle || 'Professional profile') + '</h3>' +
            '<time class="ma-owner-inbox-card__time" datetime="' + escapeHtml(notification.createdAt || '') + '">' + escapeHtml(timeAgo(notification.createdAt)) + '</time>' +
          '</div>' +
          '<div class="ma-owner-inbox-card__actions">' +
            '<a class="ma-owner-inbox-card__link" href="' + escapeHtml(notification.targetUrl || '/pages/professionals') + '">View profile</a>' +
          '</div>' +
        '</article>'
      );
    }).join('');
  }

  function loadProfessionalNotifications(root) {
    if (!hasBackendSync() || !root) return;

    var recipientId = root.getAttribute('data-professional-recipient-id') || '';
    var recipientType = root.getAttribute('data-professional-recipient-type') || 'professional';
    var list = root.querySelector('[data-professional-notifications-list]');
    if (!recipientId || !list) return;

    var params = new URLSearchParams({
      recipientId: recipientId,
      recipientType: recipientType,
      limit: '25'
    });

    window.fetch(apiBase + '/api/professionals/notifications?' + params.toString(), {
      method: 'GET',
      credentials: 'omit'
    }).then(function(response) {
      return response.json().catch(function() { return {}; });
    }).then(function(payload) {
      renderNotificationList(root, payload || {});
    }).catch(function() {
      list.innerHTML = '<p class="ma-owner-inbox__empty">Professional notifications are unavailable right now.</p>';
    });
  }

  function initProfileViews() {
    var profiles = Array.prototype.slice.call(document.querySelectorAll('[data-pro-profile]'));
    if (!profiles.length) return;

    profiles.forEach(function(profile) {
      var explicitTrack = profile.getAttribute('data-pro-profile-track') === 'true';
      if (!explicitTrack && profiles.length !== 1) return;
      postProfileView(profile);
    });
  }

  function initProfessionalInboxes() {
    var inboxes = document.querySelectorAll('[data-professional-notifications]');
    Array.prototype.forEach.call(inboxes, loadProfessionalNotifications);
  }

  window.MissingAlertsProfessionalNotifications = {
    load: loadProfessionalNotifications,
    render: renderNotificationList
  };

  function init() {
    initProfileViews();
    initProfessionalInboxes();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
