// ── Power Rankings ─────────────────────────────────────────────────────────
var _prData = null;
var _prResetTimer = null;

function openPowerRankings() {
  document.getElementById("pr-modal").classList.remove("hidden");
  document.body.style.overflow = "hidden";
  _renderPrLoading();
  fetch("/power-rankings")
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.error) { _renderPrError(d.error); return; }
      _prData = d;
      if (d.ddragonVersion) ICON_BASE = "https://ddragon.leagueoflegends.com/cdn/" + d.ddragonVersion + "/img/profileicon/";
      _renderPr(d);
    })
    .catch(function(e) { _renderPrError(e.message); });
}

function closePowerRankings() {
  document.getElementById("pr-modal").classList.add("hidden");
  document.body.style.overflow = "";
  if (_prResetTimer) { clearInterval(_prResetTimer); _prResetTimer = null; }
}

function _renderPrLoading() {
  document.getElementById("pr-body").innerHTML =
    '<div style="text-align:center;padding:80px 0 40px;color:var(--text3);font-size:0.82rem;letter-spacing:0.5px">Loading rankings…</div>';
}

function _renderPrError(msg) {
  document.getElementById("pr-body").innerHTML =
    '<div style="text-align:center;padding:50px 20px;color:#f87171;font-size:0.82rem">' + msg + '</div>';
}

function _scoreClass(n) { return n > 0 ? "positive" : n < 0 ? "negative" : "neutral"; }

function _scoreLabel(n, hasSnap) {
  if (!hasSnap) return "—";
  if (n === 0) return "0 pts";
  return (n > 0 ? "+" : "") + n + " pts";
}

function _pillsHTML(r) {
  var pills = "";
  if (r.lpProgress !== 0) {
    var lpCls = r.lpProgress > 0 ? "pr-pill-lp" : "pr-pill-wr down";
    pills += '<span class="pr-pill ' + lpCls + '">' + (r.lpProgress > 0 ? "+" : "") + r.lpProgress + " LP</span>";
  }
  if (r.gamesThisWeek > 0) {
    pills += '<span class="pr-pill pr-pill-games">'
      + '<span style="color:#4ade80">' + r.winsThisWeek + 'W</span>'
      + '<span style="opacity:0.4;margin:0 2px">/</span>'
      + '<span style="color:#f87171">' + r.lossesThisWeek + 'L</span>'
      + '</span>';
    if (r.weekWR !== null) {
      var wrCls = r.weekWR >= 55 ? "up" : r.weekWR <= 45 ? "down" : "flat";
      pills += '<span class="pr-pill pr-pill-wr ' + wrCls + '">' + r.weekWR + '% WR</span>';
    }
  }
  return pills;
}

function _podHTML(r, place, delay) {
  var cls = "pr-pod-" + place;
  var posLabel = place === 1 ? "1st Place" : place === 2 ? "2nd Place" : "3rd Place";
  var scoreVal = _scoreLabel(r.score, r.hasSnapshot);

  return '<div class="pr-pod ' + cls + '" style="animation-delay:' + delay + 's">'
    // Crown only on 1st
    + (place === 1 ? '<div class="pr-pod-crown">👑</div>' : '')
    + '<div class="pr-pod-icon-wrap">'
    + '<img class="pr-pod-icon" src="' + ICON(r.profileIconId) + '" onerror="this.src=\'' + ICON(1) + '\'" />'
    + '</div>'
    + '<div class="pr-pod-name">' + r.gameName + '</div>'
    + '<div class="pr-pod-tag">#' + r.tagLine + '</div>'
    + '<div class="pr-pod-score-wrap">'
    + '<span class="pr-pod-score ' + _scoreClass(r.score) + '">' + scoreVal + '</span>'
    + '<span class="pr-pod-score-sub">Weekly Score</span>'
    + '</div>'
    + '<div class="pr-pod-pills">' + _pillsHTML(r) + '</div>'
    + '</div>';
}

function _rowHTML(r, pos, delay) {
  return '<div class="pr-row" style="animation-delay:' + delay + 's">'
    + '<div class="pr-row-num">' + pos + '</div>'
    + '<img class="pr-row-icon" src="' + ICON(r.profileIconId) + '" onerror="this.src=\'' + ICON(1) + '\'" />'
    + '<div class="pr-row-info">'
    + '<div class="pr-row-name">' + r.gameName + ' <span class="pr-row-tag-inline">#' + r.tagLine + '</span></div>'
    + '<div class="pr-row-pills">' + _pillsHTML(r) + '</div>'
    + '</div>'
    + '<div class="pr-row-score ' + _scoreClass(r.score) + '">' + _scoreLabel(r.score, r.hasSnapshot) + '</div>'
    + '</div>';
}

function _formatCountdown(ms) {
  if (ms <= 0) return "soon";
  var s = Math.floor(ms / 1000);
  var d = Math.floor(s / 86400); s %= 86400;
  var h = Math.floor(s / 3600); s %= 3600;
  var m = Math.floor(s / 60);
  if (d > 0) return d + "d " + h + "h";
  if (h > 0) return h + "h " + m + "m";
  return m + "m";
}

function _startResetCountdown(nextResetAt) {
  if (_prResetTimer) clearInterval(_prResetTimer);
  function tick() {
    var el = document.getElementById("pr-reset-badge");
    if (!el) { clearInterval(_prResetTimer); return; }
    var rem = nextResetAt - Date.now();
    el.textContent = rem > 0 ? "Resets in " + _formatCountdown(rem) : "Resetting…";
  }
  tick();
  _prResetTimer = setInterval(tick, 30000);
}

function _renderPr(d) {
  var r = d.rankings;
  // Parse week number from key like "2026-W01"
  var weekNum = d.weekKey ? d.weekKey.split("-W")[1] : "—";
  var weekEl = document.getElementById("pr-week-badge");
  var resetEl = document.getElementById("pr-reset-badge");
  if (weekEl) weekEl.textContent = "Week " + weekNum;
  _startResetCountdown(d.nextResetAt);

  var html = "";

  if (r.length === 0) {
    html = '<div class="pr-empty"><strong>No data yet</strong>Squad data hasn\'t loaded. Try again in a moment.</div>';
    document.getElementById("pr-body").innerHTML = html;
    return;
  }

  // Podium — 2nd | 1st | 3rd
  html += '<div class="pr-podium">';
  if (r.length >= 2) html += _podHTML(r[1], 2, 0.18);
  else html += '<div></div>';
  html += _podHTML(r[0], 1, 0.04);
  if (r.length >= 3) html += _podHTML(r[2], 3, 0.28);
  else html += '<div></div>';
  html += '</div>';

  // Rows #4+
  if (r.length > 3) {
    html += '<div class="pr-list">';
    html += '<div class="pr-list-header">'
      + '<div class="pr-list-header-line"></div>'
      + '<div class="pr-list-header-text">Rest of the squad</div>'
      + '<div class="pr-list-header-line"></div>'
      + '</div>';
    for (var i = 3; i < r.length; i++) {
      html += _rowHTML(r[i], i + 1, (i - 3) * 0.055);
    }
    html += '</div>';
  }

  document.getElementById("pr-body").innerHTML = html;
}
