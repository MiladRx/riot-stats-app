// Countdown Timer & Auto-Reload
var _scheduleData = null;
var _countdownTimer = null;
var _reloadScheduled = false;

function pollSchedule() {
  fetch("/schedule")
    .then(function (r) { return r.json(); })
    .then(function (d) {
      _scheduleData = d;
      if (d.scheduleReloadAt && !_reloadScheduled) {
        var delay = d.scheduleReloadAt - Date.now();
        if (delay > 0) {
          _reloadScheduled = true;
          setTimeout(function () {
            _reloadScheduled = false;
            loadSquad();
          }, delay + 2000);
        } else if (delay > -5000) {
          loadSquad();
        }
      }
    })
    .catch(function () { });
}

function updateCountdown() {
  var el = document.getElementById("refreshTimer");
  if (!el || !_scheduleData) return;

  if (_scheduleData.fetchRunning) {
    el.textContent = "Fetching...";
    el.className = "h1-timer fetching";
    return;
  }

  if (!_scheduleData.nextFetchAt) { el.textContent = ""; return; }

  var remaining = Math.max(0, _scheduleData.nextFetchAt - Date.now());
  var totalSec = Math.ceil(remaining / 1000);
  var min = Math.floor(totalSec / 60);
  var sec = totalSec % 60;
  el.textContent = min + ":" + (sec < 10 ? "0" : "") + sec;
  el.className = "h1-timer" + (totalSec <= 60 ? " soon" : "");

  if (totalSec <= 0) {
    el.textContent = "Fetching...";
    el.className = "h1-timer fetching";
  }
}

// Init
loadSquad();
pollSchedule();
setInterval(pollSchedule, 15000);
_countdownTimer = setInterval(updateCountdown, 1000);
