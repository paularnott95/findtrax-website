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

  function apply() {
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
