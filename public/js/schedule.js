// Countdown Timer & Auto-Reload
var _scheduleData = null;
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

// Init
loadSquad();
pollSchedule();
setInterval(pollSchedule, 15000);
