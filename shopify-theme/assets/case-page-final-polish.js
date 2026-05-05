(function() {
  function ready(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
      return;
    }
    callback();
  }

  function copyCaseAttributes(target, source) {
    if (!source || !target) return;
    [
      'data-case-title',
      'data-case-handle',
      'data-case-url',
      'data-case-id',
      'data-case-image',
      'data-case-location',
      'data-case-status'
    ].forEach(function(name) {
      var value = source.getAttribute(name);
      if (value) target.setAttribute(name, value);
    });
  }

  function ensureAlertBell() {
    var imageShell = document.querySelector('.case-page-main-image-shell');
    if (!imageShell || imageShell.querySelector('.case-image-alert-bell')) return;

    var existingButton = document.querySelector('.case-notify-button--hero, .js-case-notify-button, [data-case-notify-button]');
    var bell = document.createElement('button');
    bell.type = 'button';
    bell.className = 'case-image-alert-bell case-notify-button js-case-notify-button';
    bell.setAttribute('aria-haspopup', 'dialog');
    bell.setAttribute('aria-controls', 'case-notification-modal');
    bell.setAttribute('aria-label', 'Get alerts on this case');
    bell.setAttribute('data-case-notify-button', '');
    copyCaseAttributes(bell, existingButton);
    if (!bell.getAttribute('data-case-url')) bell.setAttribute('data-case-url', window.location.pathname);
    if (!bell.getAttribute('data-case-handle')) {
      bell.setAttribute('data-case-handle', window.location.pathname.split('/').filter(Boolean).pop() || '');
    }
    if (!bell.getAttribute('data-case-title')) {
      var title = document.querySelector('h1, .case-page-title, [data-case-title]');
      bell.setAttribute('data-case-title', title ? title.textContent.trim() : 'this case');
    }
    bell.innerHTML = '<span class="case-image-alert-bell__icon" aria-hidden="true">!</span><span class="case-image-alert-bell__text">Alerts</span>';
    imageShell.insertBefore(bell, imageShell.firstChild);
  }

  function removeOldLocationContext() {
    document.querySelectorAll('.case-page-location-links').forEach(function(node) {
      node.remove();
    });
  }

  function updateAlertModalCopy() {
    var modal = document.querySelector('[data-case-notification-modal]');
    if (!modal) return;
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

  function currentCaseFix() {
    var handle = window.location.pathname.split('/').filter(Boolean).pop();
    return verifiedCaseFixes[handle] || null;
  }

  function ensureVerifiedCaseImage(fix) {
    if (!fix || !fix.image) return;
    var shell = document.querySelector('.case-page-main-image-shell');
    if (!shell) return;
    var image = shell.querySelector('img.case-page-main-image, img');
    if (!image) {
      image = document.createElement('img');
      image.className = 'case-page-main-image';
      image.width = 1200;
      image.height = 1200;
      shell.appendChild(image);
    }
    if (image.src !== fix.image) image.src = fix.image;
    image.alt = fix.name + ' official public appeal image';
    image.loading = 'eager';
    image.fetchPriority = 'high';
    shell.classList.add('case-page-main-image-shell--verified');
  }

  function overviewItem(label, value, wide) {
    if (!value) return '';
    var className = 'case-page-stat case-page-overview__item' + (wide ? ' case-page-overview__item--wide' : '');
    return '<div class="' + className + '"><span class="case-page-stat__label">' + escapeHtml(label) + '</span><span class="case-page-stat__value">' + escapeHtml(value) + '</span></div>';
  }

  function ensureCompactCaseOverview(fix) {
    if (!fix) return;
    var details = document.querySelector('.case-page-main-details');
    if (!details) return;
    details.className = 'case-page-main-details case-page-overview';
    details.setAttribute('aria-label', 'Case overview');
    details.innerHTML =
      '<div class="case-page-card__eyebrow">Key points</div>' +
      '<h2 class="case-page-card__title">Case Overview</h2>' +
      '<div class="case-page-overview__grid">' +
      overviewItem('Status', fix.status, false) +
      overviewItem('Last Seen', fix.lastSeen, true) +
      overviewItem('Last Seen Time', fix.lastSeenAt, false) +
      overviewItem('Age', fix.age, false) +
      overviewItem('Country', fix.country, false) +
      overviewItem('Location', fix.cityRegion, false) +
      overviewItem('Description', fix.description, true) +
      overviewItem('Clothing', fix.clothing, true) +
      overviewItem('Travel Context', fix.travel, true) +
      overviewItem('Official Contact', fix.contact, true) +
      '<div class="case-page-stat case-page-overview__item"><span class="case-page-stat__label">Source</span><span class="case-page-stat__value"><a href="' + fix.sourceUrl + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(fix.sourceName) + '</a></span></div>' +
      '</div>';
  }

  function ensureVerifiedMap(fix) {
    if (!fix) return;
    var mapCard = document.querySelector('.case-location-map-card--standalone');
    var details = document.querySelector('.case-page-main-details');
    if (!mapCard && details) {
      mapCard = document.createElement('section');
      mapCard.className = 'case-location-map-card case-location-map-card--standalone sidebar-card sidebar-card--map';
      details.insertAdjacentElement('afterend', mapCard);
    }
    if (!mapCard) return;
    mapCard.setAttribute('data-map-lat', fix.lat || '');
    mapCard.setAttribute('data-map-lng', fix.lng || '');
    mapCard.setAttribute('data-map-query', fix.lastSeen || fix.cityRegion || '');
    mapCard.classList.remove('case-location-map-card--fallback-active');
    var mapSrc = 'https://www.openstreetmap.org/export/embed.html?bbox=' +
      encodeURIComponent((Number(fix.lng) - 0.02) + ',' + (Number(fix.lat) - 0.015) + ',' + (Number(fix.lng) + 0.02) + ',' + (Number(fix.lat) + 0.015)) +
      '&layer=mapnik&marker=' + encodeURIComponent(fix.lat + ',' + fix.lng);
    mapCard.innerHTML =
      '<div class="case-location-map-card__eyebrow">Last Seen Location</div>' +
      '<div class="case-location-map-card__frame">' +
      '<iframe title="Approximate public last seen area map" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="' + mapSrc + '"></iframe>' +
      '<div class="case-location-map-card__pin" aria-hidden="true"></div>' +
      '</div>' +
      '<div class="case-location-map-card__location"><strong>Approximate public last-seen area</strong><span>' + escapeHtml(fix.lastSeen) + '</span></div>' +
      '<div class="case-location-map-card__meta">Coordinates are approximate and based only on public source information.</div>';
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, function(char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
    });
  }

  function applyVerifiedCaseFixes() {
    var fix = currentCaseFix();
    if (!fix) return;
    ensureVerifiedCaseImage(fix);
    ensureCompactCaseOverview(fix);
    ensureVerifiedMap(fix);
  }

  function apply() {
    applyVerifiedCaseFixes();
    ensureAlertBell();
    removeOldLocationContext();
    updateAlertModalCopy();
  }

  ready(function() {
    apply();
    window.setTimeout(apply, 300);
    window.setTimeout(apply, 1200);
  });
})();
