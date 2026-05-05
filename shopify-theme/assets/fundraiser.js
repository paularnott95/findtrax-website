(function() {
  function money(value, currency) {
    var amount = (Number(value) || 0) / 100;
    try {
      return new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: currency || 'GBP'
      }).format(amount);
    } catch (error) {
      return (currency || 'GBP') + ' ' + amount.toFixed(2);
    }
  }

  function amountLabel(minor, currency) {
    var amount = (Number(minor) || 0) / 100;
    try {
      return new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: currency || 'GBP',
        maximumFractionDigits: amount % 1 === 0 ? 0 : 2
      }).format(amount);
    } catch (error) {
      return (currency || 'GBP') + ' ' + amount.toFixed(0);
    }
  }

  function timeAgo(value) {
    if (!value) return '';
    var then = new Date(value).getTime();
    if (!then) return '';
    var seconds = Math.max(1, Math.round((Date.now() - then) / 1000));
    if (seconds < 60) return 'Last contribution just now';
    var minutes = Math.round(seconds / 60);
    if (minutes < 60) return 'Last contribution ' + minutes + 'm ago';
    var hours = Math.round(minutes / 60);
    if (hours < 48) return 'Last contribution ' + hours + 'h ago';
    var days = Math.round(hours / 24);
    return 'Last contribution ' + days + 'd ago';
  }

  function setFeedback(card, message, withBoostLink) {
    var feedback = card.querySelector('[data-fundraiser-feedback]');
    if (!feedback) return;
    feedback.hidden = false;
    if (withBoostLink) {
      feedback.innerHTML = '<span>' + message + '</span> <a href="#boost-this-appeal">HELP BOOST THIS CASE</a>';
    } else {
      feedback.textContent = message;
    }
  }

  function setDonateLoading(button, loading) {
    if (!button) return;
    button.disabled = !!loading;
    if (loading) {
      button.setAttribute('data-original-label', button.textContent || 'SUPPORT SECURELY');
      button.textContent = 'OPENING SECURE CHECKOUT...';
    } else if (button.getAttribute('data-original-label')) {
      button.textContent = button.getAttribute('data-original-label');
    }
  }

  function renderSuggestedButtons(card, fundraiser, selectedAmountRef) {
    var wrap = card.querySelector('.case-fundraiser-amounts');
    if (!wrap || !Array.isArray(fundraiser.suggested_amounts)) return;
    wrap.innerHTML = fundraiser.suggested_amounts.map(function(item) {
      var minor = Number(item.amount_gross || item.amountGross || (Number(item.amount || 0) * 100));
      var active = minor === selectedAmountRef.value ? ' is-active' : '';
      var badge = item.most_common || item.mostCommon ? '<span>MOST COMMON</span>' : '';
      return '<button type="button" class="case-fundraiser-amount' + active + '" data-donation-amount="' + minor + '">' + amountLabel(minor, fundraiser.currency) + ' ' + badge + '</button>';
    }).join('');
  }

  function updateSummary(card, fundraiser, selectedAmountRef, selectedTipRef) {
    var currency = fundraiser && fundraiser.currency ? fundraiser.currency : 'GBP';
    var donation = Math.max(0, Number(selectedAmountRef.value || 0));
    var tip = Math.max(0, Number(selectedTipRef.value || 0));
    var feePercent = Number((fundraiser && (fundraiser.platform_fee_percent || fundraiser.platformFeePercent)) || 7);
    var familyNet = Math.max(0, donation - Math.round(donation * (feePercent / 100)));
    var total = donation + tip;
    var donationEl = card.querySelector('[data-summary-donation]');
    var tipEl = card.querySelector('[data-summary-tip]');
    var totalEl = card.querySelector('[data-summary-total]');
    var familyNetEl = card.querySelector('[data-summary-family-net]');
    var platformFeeEl = card.querySelector('[data-summary-platform-fee]');
    var platformFee = Math.round(donation * (feePercent / 100));
    if (donationEl) donationEl.textContent = money(donation, currency);
    if (tipEl) tipEl.textContent = money(tip, currency);
    if (totalEl) totalEl.textContent = money(total, currency);
    if (familyNetEl) familyNetEl.textContent = money(familyNet, currency);
    if (platformFeeEl) platformFeeEl.textContent = money(platformFee, currency);
  }

  function bindAmountControls(card, fundraiser, selectedAmountRef, selectedTipRef) {
    renderSuggestedButtons(card, fundraiser, selectedAmountRef);
    var customInput = card.querySelector('[data-donation-custom]');
    card.querySelectorAll('[data-donation-amount]').forEach(function(button) {
      button.addEventListener('click', function() {
        selectedAmountRef.value = Number(button.getAttribute('data-donation-amount') || '0') || selectedAmountRef.value;
        if (customInput) customInput.value = '';
        card.querySelectorAll('[data-donation-amount]').forEach(function(item) {
          item.classList.toggle('is-active', item === button);
        });
        updateSummary(card, fundraiser, selectedAmountRef, selectedTipRef);
      });
    });
    if (customInput && customInput.getAttribute('data-fundraiser-custom-ready') !== 'true') {
      customInput.setAttribute('data-fundraiser-custom-ready', 'true');
      customInput.addEventListener('input', function() {
        var major = Number(customInput.value || '0');
        if (major > 0) {
          selectedAmountRef.value = Math.round(major * 100);
          card.querySelectorAll('[data-donation-amount]').forEach(function(item) {
            item.classList.remove('is-active');
          });
          updateSummary(card, fundraiser, selectedAmountRef, selectedTipRef);
        }
      });
    }
  }

  function bindTipControls(card, fundraiser, selectedAmountRef, selectedTipRef) {
    var customTip = card.querySelector('[data-tip-custom]');
    card.querySelectorAll('[data-tip-amount], [data-tip-percent]').forEach(function(button) {
      if (button.getAttribute('data-tip-ready') === 'true') return;
      button.setAttribute('data-tip-ready', 'true');
      button.addEventListener('click', function() {
        var fixed = button.getAttribute('data-tip-amount');
        var percent = button.getAttribute('data-tip-percent');
        if (fixed !== null) selectedTipRef.value = Math.max(0, Number(fixed || 0));
        if (percent !== null) selectedTipRef.value = Math.round(Math.max(0, Number(selectedAmountRef.value || 0)) * (Number(percent || 0) / 100));
        if (customTip) customTip.value = '';
        card.querySelectorAll('[data-tip-amount], [data-tip-percent]').forEach(function(item) {
          item.classList.toggle('is-active', item === button);
        });
        updateSummary(card, fundraiser, selectedAmountRef, selectedTipRef);
      });
    });
    if (customTip && customTip.getAttribute('data-tip-custom-ready') !== 'true') {
      customTip.setAttribute('data-tip-custom-ready', 'true');
      customTip.addEventListener('input', function() {
        var major = Number(customTip.value || '0');
        selectedTipRef.value = Math.max(0, Math.round(major * 100));
        card.querySelectorAll('[data-tip-amount], [data-tip-percent]').forEach(function(item) {
          item.classList.remove('is-active');
        });
        updateSummary(card, fundraiser, selectedAmountRef, selectedTipRef);
      });
    }
    var activePercent = card.querySelector('[data-tip-percent].is-active');
    if (activePercent) selectedTipRef.value = Math.round(Math.max(0, Number(selectedAmountRef.value || 0)) * (Number(activePercent.getAttribute('data-tip-percent') || 0) / 100));
    updateSummary(card, fundraiser, selectedAmountRef, selectedTipRef);
  }

  function applyFundraiserState(card, fundraiser, selectedAmountRef, selectedTipRef) {
    var isInline = card.hasAttribute('data-inline-fundraiser');
    var livePanel = card.querySelector('[data-fundraiser-live]') || card;
    var lockedPanel = card.querySelector('[data-fundraiser-locked]');
    var raisedEl = card.querySelector('[data-fundraiser-raised]');
    var goalEl = card.querySelector('[data-fundraiser-goal]');
    var progressTextEl = card.querySelector('[data-fundraiser-progress-text]');
    var progressEl = card.querySelector('[data-fundraiser-progress]');
    var donorCountEl = card.querySelector('[data-fundraiser-donor-count]');
    var lastDonationEl = card.querySelector('[data-fundraiser-last-donation]');
    var urgentEl = card.querySelector('[data-fundraiser-urgent]');

    if (!fundraiser || !fundraiser.exists) {
      card.hidden = false;
      if (livePanel) livePanel.hidden = true;
      if (lockedPanel) lockedPanel.hidden = false;
      return;
    }
    if (!fundraiser.active) {
      card.hidden = false;
      if (livePanel) livePanel.hidden = true;
      if (lockedPanel) lockedPanel.hidden = false;
      var ownerSettings = card.querySelector('[data-fundraiser-owner-settings]');
      if (ownerSettings) ownerSettings.hidden = !(fundraiser.ownerMatch || fundraiser.can_turn_on);
      return;
    }

    card.hidden = false;
    if (livePanel) livePanel.hidden = false;
    if (lockedPanel) lockedPanel.hidden = true;

    var raised = money(fundraiser.total_raised_gross || fundraiser.totalRaisedGross, fundraiser.currency);
    var goal = money(fundraiser.goal_amount || fundraiser.goalAmount || 0, fundraiser.currency);
    var donorCount = Number(fundraiser.donor_count || fundraiser.donorCount || 0);
    var progressPercent = Number(fundraiser.progress_percent || fundraiser.progressPercent || 0);
    var hasGoal = Number(fundraiser.goal_amount || fundraiser.goalAmount || 0) > 0;

    if (raisedEl) raisedEl.textContent = isInline ? raised + ' raised' : 'Raised: ' + raised;
    if (goalEl) goalEl.textContent = hasGoal ? 'Goal: ' + goal : '';
    if (progressTextEl) progressTextEl.textContent = hasGoal ? raised + ' raised of ' + goal : raised + ' raised';
    if (progressEl) progressEl.style.width = Math.min(100, Math.max(0, progressPercent)) + '%';
    if (donorCountEl) donorCountEl.textContent = donorCount + (donorCount === 1 ? ' supporter has contributed so far.' : ' supporters have contributed so far.');
    if (lastDonationEl) lastDonationEl.textContent = timeAgo(fundraiser.last_donation_at || fundraiser.lastDonationAt);
    if (urgentEl) urgentEl.hidden = !(hasGoal && progressPercent < 20);
    bindAmountControls(card, fundraiser, selectedAmountRef, selectedTipRef);
    bindTipControls(card, fundraiser, selectedAmountRef, selectedTipRef);
  }

  function initCard(card) {
    if (!card || card.getAttribute('data-fundraiser-ready') === 'true') return;
    card.setAttribute('data-fundraiser-ready', 'true');

    var apiBase = card.getAttribute('data-api-base') || '';
    var handle = card.getAttribute('data-case-handle') || '';
    var ownerCustomerId = card.getAttribute('data-owner-customer-id') || '';
    var donateButton = card.querySelector('[data-fundraiser-donate]');
    var selectedAmountRef = { value: 1000 };
    var selectedTipRef = { value: card.querySelector('[data-tip-percent], [data-tip-amount], [data-tip-custom]') ? 100 : 0 };
    var fundraiser = null;

    var urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('fundraiser') === 'success' || urlParams.get('donation') === 'success') {
      setFeedback(card, 'Thank you for supporting this verified family. Sharing this case can help even more.', true);
    } else if (urlParams.get('fundraiser') === 'cancelled' || urlParams.get('donation') === 'cancel') {
      setFeedback(card, 'Support checkout was cancelled. You can try again anytime.');
    }

    var copyButton = card.querySelector('[data-fundraiser-copy-link]');
    if (copyButton) {
      copyButton.addEventListener('click', function() {
        var url = window.location.origin + window.location.pathname;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(function() {
            setFeedback(card, 'Support link copied.');
          }).catch(function() {
            setFeedback(card, url);
          });
        } else {
          setFeedback(card, url);
        }
      });
    }

    if (donateButton) {
      donateButton.addEventListener('click', async function() {
        if (!fundraiser || !fundraiser.active) return;
        if (selectedAmountRef.value <= 0) {
          setFeedback(card, 'Enter a support amount greater than zero.');
          return;
        }
        if (selectedTipRef.value < 0) {
          setFeedback(card, 'Optional tip cannot be negative.');
          return;
        }
        setDonateLoading(donateButton, true);
        setFeedback(card, 'Opening secure checkout...');
        try {
          var response = await fetch(apiBase + '/api/fundraisers/donate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fundraiser_id: fundraiser.fundraiser_id || fundraiser.id || '',
              case_handle: handle,
              donation_amount: selectedAmountRef.value / 100,
              optional_tip_amount: selectedTipRef.value / 100
            })
          });
          var data = await response.json();
          if (!response.ok || !data.ok) throw new Error(data.error || 'Support checkout failed.');
          window.location.href = data.url;
        } catch (error) {
          setFeedback(card, error && error.message ? error.message : 'Support checkout failed.');
          setDonateLoading(donateButton, false);
        }
      });
    }

    fetch(apiBase + '/api/fundraisers/case?handle=' + encodeURIComponent(handle) + '&customerId=' + encodeURIComponent(ownerCustomerId), {
      headers: { Accept: 'application/json' }
    })
      .then(function(response) { return response.json(); })
      .then(function(data) {
        fundraiser = data && data.fundraiser ? data.fundraiser : null;
        applyFundraiserState(card, fundraiser, selectedAmountRef, selectedTipRef);
      })
      .catch(function(error) {
        console.error('Fundraiser lookup failed', error);
      });
  }

  function initAll() {
    document.querySelectorAll('[data-case-fundraiser], [data-inline-fundraiser]').forEach(initCard);
  }

  initAll();
  document.addEventListener('shopify:section:load', initAll);
})();
