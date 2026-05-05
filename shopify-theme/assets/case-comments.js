(function() {
  var config = window.MissingAlertsCaseComments || {};
  var card = document.querySelector('[data-case-comments-card]');
  if (!card || card.dataset.initialized === 'true') return;
  card.dataset.initialized = 'true';

  var apiBase = String(config.apiBase || window.MISSING_ALERTS_API_BASE || '').replace(/\/+$/, '');
  var list = card.querySelector('[data-case-comments-list]');
  var form = card.querySelector('[data-case-comments-form]');
  var feedback = card.querySelector('[data-case-comments-feedback]');
  var proMessage = card.querySelector('[data-case-comments-pro-message]');

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDate(value) {
    var parsed = new Date(value);
    return isNaN(parsed.getTime()) ? '' : parsed.toLocaleString();
  }

  function setFeedback(message, tone) {
    if (!feedback) return;
    feedback.hidden = !message;
    feedback.textContent = message || '';
    if (message) feedback.setAttribute('data-tone', tone || 'info');
  }

  function headers() {
    return {
      'Content-Type': 'application/json',
      'X-Shopify-Customer-Id': String(config.customerId || ''),
      'X-Shopify-Customer-Email': String(config.customerEmail || ''),
      'X-Shopify-Customer-Name': String(config.customerName || '')
    };
  }

  function canShowContact() {
    return Boolean(config.signedIn && config.isProfessional && config.premiumProfessional && config.caseAllowsProfessionalContact);
  }

  function renderProMessage() {
    if (!proMessage || !config.signedIn || !config.isProfessional) return;
    if (canShowContact()) {
      proMessage.hidden = true;
      proMessage.textContent = '';
      return;
    }
    proMessage.hidden = false;
    proMessage.textContent = 'UPGRADE TO PREMIUM TO CONTACT FAMILIES DIRECTLY';
  }

  function renderComments(comments) {
    if (!list) return;
    if (!comments || !comments.length) {
      list.innerHTML = '<div class="case-comments-card__empty">LEAVE A COMMENT</div>';
      renderProMessage();
      return;
    }

    list.innerHTML = comments.map(function(comment) {
      var likeCount = Number(comment.likeCount || comment.like_count || 0);
      var contactButton = canShowContact()
        ? '<button type="button" class="case-comments-card__contact" data-comment-contact="' + escapeHtml(comment.id) + '">MESSAGE THIS PERSON</button>'
        : '';
      var badge = config.isProfessional
        ? '<span>Moderated</span>'
        : '';

      return (
        '<article class="case-comments-card__item">' +
          '<div class="case-comments-card__meta">' +
            '<strong>' + escapeHtml(comment.commenterName || comment.customerName || 'Community member') + '</strong>' +
            '<span>' + escapeHtml(formatDate(comment.createdAt || comment.created_at)) + '</span>' +
            badge +
          '</div>' +
          '<p class="case-comments-card__body">' + escapeHtml(comment.body || comment.commentBody) + '</p>' +
          '<div class="case-comments-card__actions">' +
            '<button type="button" class="case-comments-card__like" data-comment-like="' + escapeHtml(comment.id) + '">LIKE <span>' + likeCount + '</span></button>' +
            contactButton +
          '</div>' +
        '</article>'
      );
    }).join('');
    renderProMessage();
  }

  async function loadComments() {
    if (!apiBase || !list) return;
    var params = new URLSearchParams();
    if (config.caseHandle) params.set('caseHandle', config.caseHandle);
    if (config.articleId) params.set('article_id', config.articleId);

    try {
      var response = await fetch(apiBase + '/api/case-comments/list?' + params.toString(), { headers: headers() });
      var json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.error || 'Failed to load comments.');
      renderComments(json.comments || []);
    } catch (error) {
      list.innerHTML = '<div class="case-comments-card__empty">LEAVE A COMMENT</div>';
    }
  }

  if (form) {
    form.addEventListener('submit', async function(event) {
      event.preventDefault();
      var textarea = form.querySelector('textarea[name="comment_body"]');
      var body = textarea ? textarea.value.trim() : '';
      if (!body || !apiBase) return;

      setFeedback('Submitting comment...', 'info');
      try {
        var response = await fetch(apiBase + '/api/case-comments/submit', {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({
            caseHandle: config.caseHandle,
            articleId: config.articleId,
            caseTitle: config.caseTitle,
            customerId: config.customerId,
            customerEmail: config.customerEmail,
            customerName: config.customerName,
            body: body
          })
        });
        var json = await response.json();
        if (!response.ok || !json.ok) throw new Error(json.error || 'Failed to submit comment.');
        textarea.value = '';
        setFeedback(json.message || 'Comment submitted.', 'success');
        loadComments();
      } catch (error) {
        setFeedback(error && error.message ? error.message : 'Failed to submit comment.', 'error');
      }
    });
  }

  card.addEventListener('click', async function(event) {
    var likeButton = event.target.closest('[data-comment-like]');
    var contactButton = event.target.closest('[data-comment-contact]');

    if (likeButton) {
      if (!config.signedIn) {
        window.location.href = '/account/login';
        return;
      }
      var commentId = likeButton.getAttribute('data-comment-like');
      try {
        var response = await fetch(apiBase + '/api/case-comments/like', {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({ commentId: commentId, customerId: config.customerId, customerEmail: config.customerEmail })
        });
        var json = await response.json();
        if (json && json.comment) {
          likeButton.querySelector('span').textContent = String(json.comment.likeCount || 0);
        }
      } catch (error) {}
    }

    if (contactButton) {
      var id = contactButton.getAttribute('data-comment-contact');
      contactButton.disabled = true;
      try {
        await fetch(apiBase + '/api/case-comments/contact', {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({ commentId: id, caseHandle: config.caseHandle, status: 'requested' })
        });
        contactButton.textContent = 'REQUEST LOGGED';
      } catch (error) {
        contactButton.disabled = false;
      }
    }
  });

  loadComments();
})();
