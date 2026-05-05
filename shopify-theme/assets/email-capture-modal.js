(function () {
  var sessionKey = 'maEmailCaptureDismissed';
  var modalDelay = 8000;

  var modal = document.querySelector('[data-ma-email-modal]');
  var closeButtons = document.querySelectorAll('[data-ma-email-close]');
  var form = document.getElementById('MissingAlertsSignupForm');
  var lastFocusedElement = null;
  var popupTimer = null;
  var scrollTriggered = false;

  function storageGet(storage, key) {
    try {
      return storage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function storageSet(storage, key, value) {
    try {
      storage.setItem(key, value);
    } catch (error) {
      return;
    }
  }

  function showModal() {
    if (!modal || storageGet(sessionStorage, sessionKey)) return;

    lastFocusedElement = document.activeElement;
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');

    var emailInput = modal.querySelector('input[type="email"]');
    if (emailInput) {
      window.setTimeout(function () {
        emailInput.focus();
      }, 50);
    }
  }

  function hideModal(remember) {
    if (!modal) return;

    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');

    if (remember) {
      storageSet(sessionStorage, sessionKey, 'true');
    }

    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
      lastFocusedElement.focus();
    }
  }

  function maybeShowOnScroll() {
    if (scrollTriggered || storageGet(sessionStorage, sessionKey)) return;

    var scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (scrollableHeight <= 0) return;

    var scrollDepth = window.scrollY / scrollableHeight;
    if (scrollDepth >= 0.4) {
      scrollTriggered = true;
      if (popupTimer) {
        window.clearTimeout(popupTimer);
      }
      showModal();
    }
  }

  closeButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      hideModal(true);
    });
  });

  if (form) {
    form.addEventListener('submit', function () {
      storageSet(sessionStorage, sessionKey, 'true');
    });
  }

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && modal && !modal.hidden) {
      hideModal(true);
    }
  });

  window.addEventListener('scroll', maybeShowOnScroll, { passive: true });

  if (!storageGet(sessionStorage, sessionKey)) {
    popupTimer = window.setTimeout(showModal, modalDelay);
  }
})();
