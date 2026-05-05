(function () {
  function pad(value, length) {
    return String(value).padStart(length || 2, "0");
  }

  function updateTimer(timer) {
    var targetValue = timer.getAttribute("data-target");
    var target = targetValue ? new Date(targetValue).getTime() : new Date("2026-07-01T00:00:00+01:00").getTime();
    var remaining = target - Date.now();
    var daysEl = timer.querySelector("[data-countdown-days]");
    var hoursEl = timer.querySelector("[data-countdown-hours]");
    var minutesEl = timer.querySelector("[data-countdown-minutes]");
    var secondsEl = timer.querySelector("[data-countdown-seconds]");

    if (remaining <= 0) {
      timer.textContent = "NOW LIVE";
      timer.classList.add("is-live");
      return false;
    }

    var totalSeconds = Math.floor(remaining / 1000);
    var days = Math.floor(totalSeconds / 86400);
    var hours = Math.floor((totalSeconds % 86400) / 3600);
    var minutes = Math.floor((totalSeconds % 3600) / 60);
    var seconds = totalSeconds % 60;

    if (daysEl) daysEl.textContent = pad(days, 3);
    if (hoursEl) hoursEl.textContent = pad(hours);
    if (minutesEl) minutesEl.textContent = pad(minutes);
    if (secondsEl) secondsEl.textContent = pad(seconds);
    return true;
  }

  function initCountdowns() {
    document.querySelectorAll("[data-ma-tools-countdown]").forEach(function (timer) {
      if (timer.dataset.countdownReady === "true") return;
      timer.dataset.countdownReady = "true";
      updateTimer(timer);
      window.setInterval(function () {
        updateTimer(timer);
      }, 1000);
    });
  }

  window.MissingAlertsToolsCountdownInit = initCountdowns;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCountdowns);
  } else {
    initCountdowns();
  }
})();
