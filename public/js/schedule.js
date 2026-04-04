// Countdown Timer & Auto-Reload
var _scheduleData = null;
var _reloadScheduled = false;
var _timerTick = null;

function _fmtCountdown(ms) {
  if (ms <= 0) return "now";
  var s = Math.ceil(ms / 1000);
  var m = Math.floor(s / 60); s = s % 60;
  if (m > 0) return m + "m " + s + "s";
  return s + "s";
}

function _updateTimerUI() {
  var el = document.getElementById("update-timer");
  if (!el || !_scheduleData) return;
  var d = _scheduleData;
  var now = Date.now();

  el.classList.add("visible");

  if (d.fetchRunning) {
    el.className = "update-timer visible state-fetching";
    el.innerHTML = '<div class="update-timer-dot"></div>Fetching new data…';
    return;
  }

  if (d.scheduleReloadAt && d.scheduleReloadAt > now) {
    var rem = d.scheduleReloadAt - now;
    el.className = "update-timer visible state-reload";
    el.innerHTML = '<div class="update-timer-dot"></div>Refreshing in ' + _fmtCountdown(rem);
    return;
  }

  if (d.nextFetchAt) {
    var rem2 = d.nextFetchAt - now;
    el.className = "update-timer visible state-idle";
    el.innerHTML = '<div class="update-timer-dot"></div>Next update in ' + _fmtCountdown(rem2);
    return;
  }

  el.className = "update-timer";
}

function pollSchedule() {
  fetch("/schedule")
    .then(function (r) { return r.json(); })
    .then(function (d) {
      _scheduleData = d;
      _updateTimerUI();
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

// Tick the timer every second for smooth countdown
if (_timerTick) clearInterval(_timerTick);
_timerTick = setInterval(_updateTimerUI, 1000);

// Init
loadSquad();
pollSchedule();
setInterval(pollSchedule, 15000);
