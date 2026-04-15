// Countdown Timer & Auto-Reload — Socket.io powered
var _scheduleData  = null;
var _cycleTriggered  = false;
var _timerTick       = null;
var _schedSocket     = null;

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
  var d   = _scheduleData;
  var now = Date.now();

  el.classList.add("visible");

  if (_cycleTriggered || d.fetchRunning) {
    el.className = "update-timer visible state-fetching";
    el.innerHTML = '<span class="loading loading-spinner loading-xs"></span>Fetching new data…';
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

function _handleSchedule(d) {
  _scheduleData = d;
  _updateTimerUI();

  var now = Date.now();

  if (!_cycleTriggered && !d.fetchRunning && d.nextFetchAt && d.nextFetchAt <= now) {
    _triggerCycle();
    return;
  }

}

// Trigger full cycle from browser
function _triggerCycle() {
  if (_cycleTriggered) return;
  _cycleTriggered = true;
  _updateTimerUI();
  fetch("/full-cycle", { method: "POST" })
    .then(function(r) { return r.json(); })
    .then(function() {
      _cycleTriggered = false;
      loadSquad();
      // Socket will push updated schedule automatically
    })
    .catch(function() { _cycleTriggered = false; });
}

// Legacy HTTP poll — only used when socket isn't available
function pollSchedule() {
  fetch("/schedule")
    .then(function(r) { return r.json(); })
    .then(_handleSchedule)
    .catch(function() {});
}

// ── Socket.io connection ──────────────────────────────────────────────────────
function _initSocket() {
  if (typeof io === "undefined") {
    // Fallback to HTTP polling if socket.io not loaded
    pollSchedule();
    setInterval(pollSchedule, 15000);
    return;
  }

  _schedSocket = io();

  _schedSocket.on("schedule", function(d) {
    _handleSchedule(d);
  });

  _schedSocket.on("squad:updated", function() {
    loadSquad();
  });

  _schedSocket.on("disconnect", function() {
    // Fallback to polling on disconnect
    setTimeout(pollSchedule, 2000);
  });

  _schedSocket.on("connect", function() {
    // Re-request current state on reconnect
    pollSchedule();
  });
}

// Tick the timer every second for smooth countdown
if (_timerTick) clearInterval(_timerTick);
_timerTick = setInterval(_updateTimerUI, 1000);

// Init
loadSquad();
_initSocket();
// Also do one HTTP poll immediately for resilience
pollSchedule();
setInterval(pollSchedule, 30000); // reduced from 15s since socket handles most updates
