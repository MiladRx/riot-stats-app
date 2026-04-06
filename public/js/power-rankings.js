// ── Power Rankings ─────────────────────────────────────────────────────────
var _prData = null;
var _prResetTimer = null;

function openPowerRankings() {
  fetch("/power-rankings")
    .then(function(r) { return r.json(); })
    .then(function(d) {
      document.getElementById("pr-modal").classList.remove("hidden");
      document.body.style.overflow = "hidden";
      if (d.error) { _renderPrError(d.error); return; }
      _prData = d;
      if (d.ddragonVersion) ICON_BASE = "https://ddragon.leagueoflegends.com/cdn/" + d.ddragonVersion + "/img/profileicon/";
      _renderPr(d);
    })
    .catch(function(e) {
      document.getElementById("pr-modal").classList.remove("hidden");
      document.body.style.overflow = "hidden";
      _renderPrError(e.message);
    });
}

function closePowerRankings() {
  document.getElementById("pr-modal").classList.add("hidden");
  document.body.style.overflow = "";
  if (_prResetTimer) { clearInterval(_prResetTimer); _prResetTimer = null; }
}

function _renderPrError(msg) {
  document.getElementById("pr-body").innerHTML =
    '<div class="pr-body-inner"><div class="pr-empty"><strong>Something went wrong</strong>' + msg + '</div></div>';
}

function _scoreClass(n) { return n == null ? "neutral" : n > 0 ? "positive" : n < 0 ? "negative" : "neutral"; }

function _scoreLabel(n, hasSnap) {
  if (!hasSnap || n == null) return "—";
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
      + '<span style="color:var(--green)">' + r.winsThisWeek + 'W</span>'
      + '<span style="opacity:0.4;margin:0 2px">/</span>'
      + '<span style="color:var(--red)">' + r.lossesThisWeek + 'L</span>'
      + '</span>';
    if (r.weekWR !== null) {
      var wrCls = r.weekWR >= 55 ? "up" : r.weekWR <= 45 ? "down" : "flat";
      pills += '<span class="pr-pill pr-pill-wr ' + wrCls + '">' + r.weekWR + '% WR</span>';
    }
  }
  return pills;
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

// ── #1 Hero card ──
function _heroHTML(r) {
  return '<div class="pr-hero">'
    + '<div class="pr-hero-left">'
    + '<div class="pr-hero-rank">1</div>'
    + '<div class="pr-hero-icon-wrap">'
    + '<div class="pr-hero-crown">👑</div>'
    + '<img class="pr-hero-icon" src="' + ICON(r.profileIconId) + '" onerror="this.src=\'' + ICON(1) + '\'" />'
    + '</div>'
    + '<div class="pr-hero-info">'
    + '<div class="pr-hero-name">' + r.gameName + '</div>'
    + '<div class="pr-hero-tag">#' + r.tagLine + '</div>'
    + '<div class="pr-hero-pills">' + _pillsHTML(r) + '</div>'
    + '</div>'
    + '</div>'
    + '<div class="pr-hero-score-col">'
    + '<span class="pr-hero-score ' + _scoreClass(r.score) + '">' + _scoreLabel(r.score, r.hasSnapshot) + '</span>'
    + '<span class="pr-hero-score-label">Weekly Score</span>'
    + '</div>'
    + '</div>';
}

// ── #2 / #3 mini card ──
function _miniHTML(r, place) {
  var cls = place === 2 ? 'pr-mini-2' : 'pr-mini-3';
  var delay = place === 2 ? '0.06' : '0.12';
  return '<div class="pr-mini ' + cls + '" style="animation-delay:' + delay + 's">'
    + '<div class="pr-mini-rank">' + place + '</div>'
    + '<img class="pr-mini-icon" src="' + ICON(r.profileIconId) + '" onerror="this.src=\'' + ICON(1) + '\'" />'
    + '<div class="pr-mini-info">'
    + '<div class="pr-mini-name">' + r.gameName + '</div>'
    + '<div class="pr-mini-tag">#' + r.tagLine + '</div>'
    + '<div class="pr-mini-pills">' + _pillsHTML(r) + '</div>'
    + '</div>'
    + '<div class="pr-mini-score ' + _scoreClass(r.score) + '">' + _scoreLabel(r.score, r.hasSnapshot) + '</div>'
    + '</div>';
}

// ── #4+ leaderboard row ──
function _lbRowHTML(r, pos, delay) {
  return '<div class="pr-lb-row" style="animation-delay:' + delay + 's">'
    + '<div class="pr-lb-num">' + pos + '</div>'
    + '<img class="pr-lb-icon" src="' + ICON(r.profileIconId) + '" onerror="this.src=\'' + ICON(1) + '\'" />'
    + '<div class="pr-lb-info">'
    + '<div class="pr-lb-name">' + r.gameName + ' <span class="pr-lb-tag">#' + r.tagLine + '</span></div>'
    + '<div class="pr-lb-pills">' + _pillsHTML(r) + '</div>'
    + '</div>'
    + '<div class="pr-lb-score ' + _scoreClass(r.score) + '">' + _scoreLabel(r.score, r.hasSnapshot) + '</div>'
    + '</div>';
}

function _renderPr(d) {
  var r = d.rankings;
  var weekNum = d.weekKey ? d.weekKey.split("-W")[1] : "—";
  var weekEl = document.getElementById("pr-week-badge");
  if (weekEl) weekEl.textContent = "Week " + weekNum;
  _startResetCountdown(d.nextResetAt);

  if (r.length === 0) {
    document.getElementById("pr-body").innerHTML =
      '<div class="pr-body-inner"><div class="pr-empty"><strong>No data yet</strong>Squad data hasn\'t loaded. Try again in a moment.</div></div>';
    return;
  }

  var html = '<div class="pr-body-inner">';

  // #1 hero
  html += _heroHTML(r[0]);

  // #2 and #3 stacked vertically
  if (r.length >= 2) html += _miniHTML(r[1], 2);
  if (r.length >= 3) html += _miniHTML(r[2], 3);

  // #4+ list
  if (r.length > 3) {
    html += '<div class="pr-leaderboard">';
    html += '<div class="pr-lb-divider">'
      + '<div class="pr-lb-divider-line"></div>'
      + '<div class="pr-lb-divider-text">Rest of the squad</div>'
      + '<div class="pr-lb-divider-line"></div>'
      + '</div>';
    for (var i = 3; i < r.length; i++) {
      html += _lbRowHTML(r[i], i + 1, (i - 3) * 0.05);
    }
    html += '</div>';
  }

  html += '</div>';
  document.getElementById("pr-body").innerHTML = html;
}
