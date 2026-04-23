// ── Heatmap Modal ─────────────────────────────────────────────────────────────
var _hmPlayer  = null; // null = all players
var _hmPlayers = [];   // [{gameName, tagLine, key}]

var HM_DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

// Pre-load on boot — called once the page is ready
function _hmPreload() {
  _hmLoadPlayers();
}

function openHeatmap() {
  document.getElementById("hm-modal").classList.remove("hidden");
  // Data already loaded — just render. If somehow not ready yet, load now.
  if (!_hmData) {
    _loadHeatmap();
  } else {
    _renderHeatmap(_hmData);
  }
}

function closeHeatmap() {
  document.getElementById("hm-modal").classList.add("hidden");
}

function _hmLoadPlayers() {
  fetch("/squad")
    .then(function(r) { return r.json(); })
    .then(function(data) {
      _hmPlayers = (data.players || [])
        .filter(function(p) { return !p.error; })
        .map(function(p) {
          return {
            gameName: p.gameName,
            tagLine:  p.tagLine,
            key:      (p.gameName + "#" + p.tagLine).toLowerCase(),
          };
        });
      _renderHmPlayerPicker();
      _loadHeatmap();
    })
    .catch(function() {
      _renderHmPlayerPicker();
      _loadHeatmap();
    });
}

function _renderHmPlayerPicker() {
  var sel = document.getElementById("hm-player-select");
  // Keep "All Players" option, rebuild the rest
  sel.innerHTML = '<option value="">All Players</option>';
  for (var i = 0; i < _hmPlayers.length; i++) {
    var p    = _hmPlayers[i];
    var opt  = document.createElement("option");
    opt.value = p.key;
    opt.textContent = p.gameName;
    if (_hmPlayer === p.key) opt.selected = true;
    sel.appendChild(opt);
  }
}

function _hmSetPlayer(key) {
  _hmPlayer = key;
  _hmData   = null;
  _renderHmPlayerPicker();
  _loadHeatmap();
}

function _loadHeatmap() {
  var content = document.getElementById("hm-content");
  // Only show loading spinner if modal is open
  if (!document.getElementById("hm-modal").classList.contains("hidden")) {
    content.innerHTML = '<div style="text-align:center;padding:48px;color:var(--txt3);">Loading…</div>';
  }

  var url = "/heatmap?season=2026&mode=solo";
  if (_hmPlayer) url += "&player=" + encodeURIComponent(_hmPlayer);

  fetch(url)
    .then(function(r) { return r.json(); })
    .then(function(data) {
      _hmData = data;
      // Only render into DOM if modal is open; otherwise data is ready for when it opens
      if (!document.getElementById("hm-modal").classList.contains("hidden")) {
        _renderHeatmap(data);
      }
    })
    .catch(function() {
      if (!document.getElementById("hm-modal").classList.contains("hidden")) {
        content.innerHTML = '<div style="text-align:center;padding:48px;color:var(--txt3);">Failed to load data</div>';
      }
    });
}

function _renderHeatmap(data) {
  var grid  = data.grid;
  var total = data.total;

  // Max for colour scaling
  var SLOTS = 12;
  var max = 0;
  for (var d = 0; d < 7; d++)
    for (var s = 0; s < SLOTS; s++)
      if (grid[d][s] > max) max = grid[d][s];

  // Totals for stats
  var dayTotals  = new Array(7).fill(0);
  var slotTotals = new Array(SLOTS).fill(0);
  var peakDay = 0, peakSlot = 0, peakVal = 0;
  for (var d = 0; d < 7; d++) {
    for (var s = 0; s < SLOTS; s++) {
      var v = grid[d][s];
      dayTotals[d]   += v;
      slotTotals[s]  += v;
      if (v > peakVal) { peakVal = v; peakDay = d; peakSlot = s; }
    }
  }
  var busyDayIdx  = dayTotals.indexOf(Math.max.apply(null, dayTotals));
  var busySlotIdx = slotTotals.indexOf(Math.max.apply(null, slotTotals));

  var html = '';

  // Slot labels (every 2 hours)
  html += '<div class="hm-hour-labels">';
  html += '<div class="hm-hour-label blank"></div>';
  for (var s = 0; s < SLOTS; s++) {
    var lh = String(s * 2).padStart(2, '0');
    html += '<div class="hm-hour-label">' + lh + ':00</div>';
  }
  html += '</div>';

  // Grid rows
  html += '<div class="hm-grid-wrap"><div class="hm-grid">';
  for (var d = 0; d < 7; d++) {
    html += '<div class="hm-day-label">' + HM_DAYS[d] + '</div>';
    for (var s = 0; s < SLOTS; s++) {
      var count     = grid[d][s];
      var intensity = max > 0 ? count / max : 0;
      var color     = _hmColor(intensity);
      var tipText   = count + ' game' + (count !== 1 ? 's' : '') + ' · ' + HM_DAYS[d] + ' ' + _hmFmtSlot(s);
      html += '<div class="hm-cell" data-count="' + count + '" style="background:' + color + '"'
            + ' onmouseenter="_hmShowTip(event,\'' + tipText + '\')"'
            + ' onmouseleave="_hmHideTip()"></div>';
    }
  }
  html += '</div></div>';

  // Legend
  html += '<div class="hm-legend">'
        + '<span class="hm-legend-label">Less</span>'
        + '<div class="hm-legend-scale">';
  for (var i = 0; i <= 8; i++) {
    html += '<div class="hm-legend-step" style="background:' + _hmColor(i / 8) + '"></div>';
  }
  html += '</div><span class="hm-legend-label">More</span></div>';

  // Stats
  html += '<div class="hm-stats-row">'
        + _hmStat(total,               'Total Games')
        + _hmStat(HM_DAYS[busyDayIdx], 'Busiest Day')
        + _hmStat(_hmFmtSlot(busySlotIdx), 'Busiest Time')
        + _hmStat(peakVal,             'Peak in One Slot')
        + '</div>';

  document.getElementById("hm-content").innerHTML = html;
}

function _hmColor(t) {
  if (t <= 0) return 'rgba(255,255,255,0.04)';
  var r = Math.round(40  + t * 215);
  var g = Math.round(30  + t * 170);
  var b = 0;
  var a = (0.25 + t * 0.75).toFixed(2);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
}

function _hmFmtSlot(s) {
  var h1 = String(s * 2).padStart(2, '0');
  var h2 = String((s * 2 + 2) % 24).padStart(2, '0');
  return h1 + ':00–' + h2 + ':00';
}

function _hmStat(val, label) {
  return '<div class="hm-stat"><div class="hm-stat-val">' + val + '</div><div class="hm-stat-label">' + label + '</div></div>';
}

// ── Tooltip ───────────────────────────────────────────────────────────────────
var _hmTip = null;

function _hmShowTip(e, text) {
  if (!_hmTip) {
    _hmTip = document.createElement("div");
    _hmTip.className = "hm-tooltip";
    document.body.appendChild(_hmTip);
  }
  _hmTip.textContent = text;
  _hmTip.classList.add("visible");
  _hmTip.style.left = (e.clientX + 14) + "px";
  _hmTip.style.top  = (e.clientY - 36) + "px";
}

function _hmHideTip() {
  if (_hmTip) _hmTip.classList.remove("visible");
}

document.addEventListener("keydown", function(e) {
  if (e.key === "Escape") closeHeatmap();
});

// Pre-fetch on page load so opening the modal is instant
document.addEventListener("DOMContentLoaded", function() {
  _hmPreload();
});
