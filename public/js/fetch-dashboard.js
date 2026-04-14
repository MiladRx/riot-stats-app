// ── Fetch Dashboard ──

var _fdOpen       = false;
var _fdSeason     = "2025";
var _fdMode       = "solo";
var _fdSel        = {};      // { gameName: bool }
var _fdSummary    = [];      // [{ gameName, tagLine, total, lastUpdated }]
var _fdPollTimer  = null;

var FD_SEASONS = ["2026", "2025", "2024", "2023"];
var FD_MODES   = [
  { id: "solo",  label: "Solo/Duo" },
  { id: "clash", label: "Clash"    },
];

// ── Open / Close ──────────────────────────────────────────────────────────────
function openFetchDashboard() {
  _devAuthGate(function() {
    document.getElementById("fd-modal").classList.remove("hidden");
    document.body.style.overflow = "hidden";
    _fdOpen = true;
    _fdRefreshSummary();
    _fdPollStatus();
  });
}

function closeFetchDashboard() {
  document.getElementById("fd-modal").classList.add("hidden");
  document.body.style.overflow = "";
  _fdOpen = false;
  _fdStopPoll();
}

// ── Season / Mode selection ───────────────────────────────────────────────────
function _fdSetSeason(season) {
  _fdSeason = season;
  _fdRefreshSummary();
}

function _fdSetMode(mode) {
  _fdMode = mode;
  _fdRefreshSummary();
}

// ── Player selection ──────────────────────────────────────────────────────────
function _fdTogglePlayer(gameName) {
  _fdSel[gameName] = !_fdSel[gameName];
  _fdRenderPlayers();
  _fdUpdateActions();
}

function _fdSelectAll(val) {
  _fdSummary.forEach(function(p) { _fdSel[p.gameName] = val; });
  _fdRenderPlayers();
  _fdUpdateActions();
}

// ── Fetch controls ────────────────────────────────────────────────────────────
function _fdStart() {
  var selected = _fdSummary
    .filter(function(p) { return _fdSel[p.gameName]; })
    .map(function(p) { return p.gameName; });
  if (selected.length === 0) return;

  fetch("/fetch-history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ players: selected, season: _fdSeason }),
  })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.status === "started" || d.status === "already_running") {
        _fdStartPoll();
        _fdPollStatus();
      }
    })
    .catch(function() {});
}

function _fdStop() {
  fetch("/fetch-history", { method: "DELETE" })
    .then(function() { _fdPollStatus(); });
}

// ── Polling ───────────────────────────────────────────────────────────────────
function _fdStartPoll() {
  if (_fdPollTimer) return;
  _fdPollTimer = setInterval(function() {
    if (!_fdOpen) { _fdStopPoll(); return; }
    _fdPollStatus();
  }, 1500);
}

function _fdStopPoll() {
  if (_fdPollTimer) { clearInterval(_fdPollTimer); _fdPollTimer = null; }
}

function _fdPollStatus() {
  fetch("/fetch-history/status")
    .then(function(r) { return r.json(); })
    .then(function(d) {
      _fdRenderStatus(d);
      if (d.running) {
        _fdStartPoll();
      } else {
        _fdStopPoll();
        if (d.startedAt) _fdRefreshSummary();
      }
    })
    .catch(function() {});
}

function _fdRefreshSummary() {
  fetch("/match-history-summary")
    .then(function(r) { return r.json(); })
    .then(function(d) {
      _fdSummary = d.players || [];
      _fdSummary.forEach(function(p) {
        if (_fdSel[p.gameName] === undefined) _fdSel[p.gameName] = true;
      });
      _fdRender();
    })
    .catch(function() {});
}

// ── Render ────────────────────────────────────────────────────────────────────
function _fdRender() {
  _fdRenderSeasons();
  _fdRenderModes();
  _fdRenderPlayers();
  _fdUpdateActions();
}

function _fdRenderSeasons() {
  var el = document.getElementById("fd-seasons");
  if (!el) return;
  el.innerHTML = FD_SEASONS.map(function(s) {
    var active = s === _fdSeason ? " active" : "";
    return '<button class="fd-season-pill' + active + '" onclick="_fdSetSeason(\'' + s + '\')">' + s + '</button>';
  }).join('');
}

function _fdRenderModes() {
  var el = document.getElementById("fd-modes");
  if (!el) return;
  el.innerHTML = FD_MODES.map(function(m) {
    var active = m.id === _fdMode ? " active " + m.id : "";
    return '<button class="fd-mode-tab' + active + '" onclick="_fdSetMode(\'' + m.id + '\')">' + m.label + '</button>';
  }).join('');
}

function _fdRenderPlayers() {
  var el = document.getElementById("fd-players");
  if (!el) return;
  el.innerHTML = _fdSummary.map(function(p) {
    var sel = !!_fdSel[p.gameName];
    var countHtml = p.total > 0
      ? '<span class="fd-count">' + p.total + 'G</span>'
      : '<span class="fd-count-zero">0G</span>';
    var agoHtml = p.lastUpdated
      ? '<span class="fd-ago">· ' + _fdTimeAgo(p.lastUpdated) + '</span>'
      : '<span class="fd-never">· never fetched</span>';
    var cbMode = _fdMode === "clash" ? " clash" : "";
    return '<div class="fd-player-row" data-name="' + p.gameName + '" onclick="_fdTogglePlayer(\'' + p.gameName + '\')">'
      + '<span class="fd-cb' + (sel ? " checked" + cbMode : "") + '"></span>'
      + '<span class="fd-pname">' + p.gameName + '</span>'
      + '<span class="fd-prog-icon" id="fdprog-' + _fdSafeId(p.gameName) + '"></span>'
      + countHtml + agoHtml
      + '</div>';
  }).join('');
}

function _fdRenderStatus(data) {
  var startBtn = document.getElementById("fd-start-btn");
  var stopBtn  = document.getElementById("fd-stop-btn");
  var statusTxt = document.getElementById("fd-status-txt");
  var headerBtn = document.getElementById("fd-header-btn");

  var isMine = data.running && data.season === _fdSeason && data.mode === _fdMode;

  if (startBtn) startBtn.style.display = data.running ? "none" : "";
  if (stopBtn)  stopBtn.style.display  = isMine ? "" : "none";
  if (statusTxt) {
    if (data.running) {
      var label = isMine ? "Running…" : "Another fetch in progress";
      statusTxt.textContent = label;
      statusTxt.className = "fd-status-txt running";
    } else {
      statusTxt.textContent = "";
      statusTxt.className = "fd-status-txt";
    }
  }
  if (headerBtn) {
    headerBtn.className = "fetch-dash-btn" + (data.running ? " running" : "");
    headerBtn.innerHTML = data.running ? "⟳ <span>Fetching…</span>" : "📊 <span>Fetch</span>";
  }

  // Update per-player progress icons
  if (data.progress) {
    for (var key in data.progress) {
      var prog = data.progress[key];
      var icon = document.getElementById("fdprog-" + _fdSafeId(prog.gameName));
      if (!icon) continue;
      var html = "";
      if (prog.status === "fetching" || prog.status === "starting") {
        html = '<span style="color:var(--orange);font-size:0.8rem">⟳</span>';
      } else if (prog.status === "done") {
        html = '<span style="color:var(--green);font-size:0.72rem">✓</span>';
        if (prog.newThisRun > 0) html += '<span class="fd-prog-new">+' + prog.newThisRun + '</span>';
      } else if (prog.status === "error") {
        html = '<span style="color:var(--red);font-size:0.72rem">✕</span>';
      }
      icon.innerHTML = html;
    }
  }

  // Update log
  var logEl = document.getElementById("fd-log");
  if (logEl && data.log && data.log.length) {
    logEl.innerHTML = data.log.slice().reverse().map(function(l) {
      return '<div class="fd-log-line">' + l + '</div>';
    }).join('');
  }
}

function _fdUpdateActions() {
  var startBtn = document.getElementById("fd-start-btn");
  if (!startBtn) return;
  var count = _fdSummary.filter(function(p) { return _fdSel[p.gameName]; }).length;
  startBtn.disabled = count === 0;
  var modeLabel = _fdMode === "clash" ? "Clash" : "Solo/Duo";
  startBtn.textContent = count > 0
    ? "▶ Fetch " + count + " Player" + (count !== 1 ? "s" : "") + " — " + _fdSeason + " All Games"
    : "▶ Select Players to Fetch";
  startBtn.className = "fd-start-btn mode-" + _fdMode;

  // Also update start btn visibility based on running state
  fetch("/fetch-status")
    .then(function(r) { return r.json(); })
    .then(_fdRenderStatus)
    .catch(function() {});
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function _fdTimeAgo(ts) {
  var diff = Date.now() - ts;
  var m = Math.floor(diff / 60000);
  var h = Math.floor(diff / 3600000);
  var d = Math.floor(diff / 86400000);
  if (d > 0) return d + "d ago";
  if (h > 0) return h + "h ago";
  if (m > 0) return m + "m ago";
  return "just now";
}

function _fdSafeId(name) {
  return name.replace(/[^a-zA-Z0-9]/g, "_");
}

// ── Keyboard ──────────────────────────────────────────────────────────────────
document.addEventListener("keydown", function(e) {
  if (e.key === "Escape" && _fdOpen) closeFetchDashboard();
});
