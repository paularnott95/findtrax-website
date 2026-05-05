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

(function () {
  var products = {
    tools: {
      key: 'tools',
      label: 'Missing Alerts Tools',
      intro: 'FindTrax, IntelPro, and MediaReach are Missing Alerts tools designed to support search coordination, case organisation, and controlled public outreach.',
      positioning: 'The product suite keeps field activity, case intelligence, and public visibility workflows connected to source-backed Missing Alerts cases.',
      features: ['Search coordination', 'Case intelligence', 'Controlled outreach', 'Source-backed updates', 'Public/private field separation', 'Release alerts'],
      audience: 'Built for families, volunteers, advocates, professionals, and partner organisations who need organised, respectful missing-person workflows.',
      cards: [
        ['FindTrax', 'Search areas, volunteers, sightings, coverage, and field updates.', '/pages/findtrax'],
        ['IntelPro', 'Facts, leads, timelines, files, relationships, and review workflows.', '/pages/intelpro'],
        ['MediaReach', 'Public appeals, media kits, sharing controls, and update publishing.', '/pages/mediareach']
      ]
    },
    findtrax: {
      key: 'findtrax',
      label: 'FindTrax',
      intro: 'FindTrax is a Missing Alerts tool for coordinating search activity around a live missing-person appeal.',
      positioning: 'FindTrax helps Missing Alerts teams organise searches without scattering search areas, sightings, volunteer updates, and field notes across chats and spreadsheets.',
      features: ['Search planning', 'Map-based search zones', 'Volunteer and team assignment', 'Route and coverage tracking', 'Field status updates', 'Tip and sighting organisation', 'Search logs', 'Command overview'],
      audience: 'For coordinated searches where field teams, family supporters, and case leads need one structured view of activity and updates.'
    },
    intelpro: {
      key: 'intelpro',
      label: 'IntelPro',
      intro: 'IntelPro is the Missing Alerts intelligence workspace for organising complex case information.',
      positioning: 'IntelPro keeps case facts, people, leads, timelines, documents, and review notes structured so information is easier to assess and hand over professionally.',
      features: ['Case dashboard', 'Person and case records', 'Lead management', 'Timeline building', 'Evidence and document organisation', 'Relationship mapping', 'Task tracking', 'Review workflow', 'Professional handover readiness'],
      audience: 'For case reviewers, professional supporters, family liaison teams, and organised advocates working with large volumes of case information.'
    },
    mediareach: {
      key: 'mediareach',
      label: 'MediaReach',
      intro: 'MediaReach is the Missing Alerts media and outreach tool for controlled public visibility.',
      positioning: 'MediaReach helps build accurate appeals, press-ready summaries, campaign updates, and shareable outreach without exposing private investigation details.',
      features: ['Public appeal builder', 'Press-ready summaries', 'Social and media templates', 'Outreach coordination', 'Shareable campaign publishing', 'Update workflow', 'Messaging controls', 'Audience and reach visibility'],
      audience: 'For families, Missing Alerts supporters, media partners, and public-facing teams who need accurate outreach without uncontrolled private detail exposure.'
    }
  };

  function routeKey() {
    var path = window.location.pathname.replace(/\/+$/, '').toLowerCase();
    if (path === '/tools' || path === '/pages/tools') return 'tools';
    if (path === '/tools/findtrax' || path === '/pages/findtrax') return 'findtrax';
    if (path === '/tools/intelpro' || path === '/pages/intelpro') return 'intelpro';
    if (path === '/tools/mediareach' || path === '/pages/mediareach') return 'mediareach';
    return '';
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
    });
  }

  function updateCountdown(root) {
    var timer = root.querySelector('[data-ma-tools-countdown]');
    if (!timer) return;
    function pad(value, length) {
      return String(value).padStart(length || 2, '0');
    }
    function tick() {
      var target = new Date(timer.getAttribute('data-target') || '2026-07-01T00:00:00+01:00').getTime();
      var remaining = target - Date.now();
      if (remaining <= 0) {
        timer.textContent = 'NOW LIVE';
        timer.classList.add('is-live');
        return;
      }
      var totalSeconds = Math.floor(remaining / 1000);
      var days = Math.floor(totalSeconds / 86400);
      var hours = Math.floor((totalSeconds % 86400) / 3600);
      var minutes = Math.floor((totalSeconds % 3600) / 60);
      var seconds = totalSeconds % 60;
      timer.querySelector('[data-countdown-days]').textContent = pad(days, 3);
      timer.querySelector('[data-countdown-hours]').textContent = pad(hours);
      timer.querySelector('[data-countdown-minutes]').textContent = pad(minutes);
      timer.querySelector('[data-countdown-seconds]').textContent = pad(seconds);
    }
    tick();
    window.setInterval(tick, 1000);
  }

  function countdownHtml() {
    return '<div class="ma-tools-countdown" data-ma-tools-countdown data-target="2026-07-01T00:00:00+01:00"><div class="ma-tools-countdown__item"><span class="ma-tools-countdown__value" data-countdown-days>000</span><span class="ma-tools-countdown__label">Days</span></div><div class="ma-tools-countdown__item"><span class="ma-tools-countdown__value" data-countdown-hours>00</span><span class="ma-tools-countdown__label">Hours</span></div><div class="ma-tools-countdown__item"><span class="ma-tools-countdown__value" data-countdown-minutes>00</span><span class="ma-tools-countdown__label">Minutes</span></div><div class="ma-tools-countdown__item"><span class="ma-tools-countdown__value" data-countdown-seconds>00</span><span class="ma-tools-countdown__label">Seconds</span></div></div>';
  }

  function signupHtml(product) {
    return '<div id="tool-signup-' + escapeHtml(product.key) + '" class="ma-tools-page__launch"><div class="ma-tools-page__launch-title">COMING ON 1ST JULY 2026</div>' + countdownHtml() + '<h2>SIGN UP FOR RELEASE DAY</h2><p class="ma-tools-page__notice">Be first to know when this tool goes live.</p><form method="post" action="/contact#tool-signup-' + escapeHtml(product.key) + '" class="ma-tools-page__form"><input type="hidden" name="form_type" value="customer"><input type="hidden" name="utf8" value="✓"><input type="hidden" name="contact[tags]" value="tool-release-day,' + escapeHtml(product.key) + '"><input type="email" name="contact[email]" required aria-label="Email address" placeholder="Email address"><button type="submit">SIGN UP FOR RELEASE DAY</button></form></div>';
  }

  function cardsHtml(product) {
    if (product.cards) {
      return product.cards.map(function (card) {
        return '<article class="ma-tools-page__card"><strong>' + escapeHtml(card[0]) + '</strong><p>' + escapeHtml(card[1]) + '</p><p><a class="ma-tools-page__button ma-tools-page__button--ghost" href="' + escapeHtml(card[2]) + '">Open page</a></p></article>';
      }).join('');
    }
    return [
      ['Set up the case', 'Start from a verified Missing Alerts appeal and keep public information source-backed.'],
      ['Coordinate the work', 'Organise activity into structured updates instead of scattered chats, files, and posts.'],
      ['Publish safely', 'Share only approved public updates while protecting family, investigative, and private information.']
    ].map(function (card) {
      return '<article class="ma-tools-page__card"><strong>' + escapeHtml(card[0]) + '</strong><p>' + escapeHtml(card[1]) + '</p></article>';
    }).join('');
  }

  function pageHtml(product) {
    var featureItems = product.features.map(function (item) {
      return '<li>' + escapeHtml(item) + '</li>';
    }).join('');
    return '<section class="ma-tools-page" data-ma-tools-page="' + escapeHtml(product.key) + '"><div class="ma-tools-page__inner"><div class="ma-tools-page__hero"><div><span class="ma-tools-page__eyebrow">Missing Alerts tool</span><h1>' + escapeHtml(product.label) + '</h1><p class="ma-tools-page__intro">' + escapeHtml(product.intro) + '</p><p class="ma-tools-page__copy">' + escapeHtml(product.positioning) + '</p><div class="ma-tools-page__actions"><a class="ma-tools-page__button" href="#tool-signup-' + escapeHtml(product.key) + '">SIGN UP FOR RELEASE DAY</a><a class="ma-tools-page__button ma-tools-page__button--ghost" href="/pages/tools">All tools</a></div></div><div class="ma-tools-page__visual" aria-label="' + escapeHtml(product.label) + ' UI preview"><div class="ma-tools-page__window"><div class="ma-tools-page__window-top"><span>' + escapeHtml(product.label) + '</span><span>Preview</span></div><div class="ma-tools-page__preview-grid"><div class="ma-tools-page__preview-card"><strong>Case linked</strong><span>Connects work to a Missing Alerts public case.</span></div><div class="ma-tools-page__preview-card"><strong>Reviewable</strong><span>Structured updates and notes stay easier to assess.</span></div><div class="ma-tools-page__preview-card"><strong>Controlled visibility</strong><span>Separate public appeal fields from private working notes.</span></div><div class="ma-tools-page__preview-card"><strong>Release ready</strong><span>Product updates begin before public launch.</span></div></div></div></div></div><div class="ma-tools-page__section"><h2>Core features</h2><ul class="ma-tools-page__feature-list">' + featureItems + '</ul></div><div class="ma-tools-page__section"><h2>How it works</h2><div class="ma-tools-page__cards">' + cardsHtml(product) + '</div></div><div class="ma-tools-page__section"><h2>Who it is for</h2><p class="ma-tools-page__intro">' + escapeHtml(product.audience) + '</p></div><div class="ma-tools-page__section"><h2>Trust and privacy</h2><p class="ma-tools-page__intro">Each product is designed around source-backed case information, role-aware collaboration, and public/private field separation. Missing Alerts does not publish private family contact information or unverified sensitive claims in public product surfaces.</p></div>' + signupHtml(product) + '</div></section>';
  }

  function bootToolsPage() {
    var key = routeKey();
    if (!key || !products[key]) return;
    var main = document.getElementById('MainContent') || document.querySelector('main');
    if (!main) return;
    document.title = products[key].label + ' | Missing Alerts';
    main.innerHTML = pageHtml(products[key]);
    updateCountdown(main);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootToolsPage);
  } else {
    bootToolsPage();
  }
})();
