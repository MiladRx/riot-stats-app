// ── Board filter state ────────────────────────────────────────────────────────
var _boardSeason = "2026";
var _boardMode   = "solo";
var _boardAvailableSeasons = ["2026"]; // always starts with current; updated after fetch

var BOARD_MODES = [
  { id: "solo",  label: "Solo/Duo" },
  { id: "flex",  label: "Flex"     },
  { id: "clash", label: "Clash"    },
];
var MODE_LABELS = { solo: "Solo/Duo", flex: "Flex", clash: "Clash" };

function setBoardSeason(season) {
  _boardSeason = season;
  _renderFilterBar();
  _loadForFilter();
}

function setBoardMode(mode) {
  _boardMode = mode;
  _updatePageHeader();
  // Re-fetch available seasons for this mode, then reload
  _fetchAvailableSeasons(function() {
    // If current season no longer available in this mode, fall back to first available
    if (_boardAvailableSeasons.indexOf(_boardSeason) === -1) {
      _boardSeason = _boardAvailableSeasons[0] || "2026";
    }
    _renderFilterBar();
    _loadForFilter();
  });
}

function _updatePageHeader() {
  var titles = {
    solo:  { h1: "Solo / Duo Ranked", sub: "Solo / Duo Ranked · EUNE", rankCol: "Rank" },
    flex:  { h1: "Flex Ranked",        sub: "Flex 5v5 Ranked · EUNE",   rankCol: "Rank" },
    clash: { h1: "Clash",              sub: "Clash Tournament · EUNE",  rankCol: "Solo Strength" },
  };
  var t = titles[_boardMode] || titles.solo;
  var h1 = document.getElementById("page-title");
  var sub = document.getElementById("page-subtitle");
  var col = document.getElementById("lb-rank-header");
  if (h1) {
    var timer = document.getElementById("refreshTimer");
    h1.textContent = t.h1 + " ";
    if (timer) h1.appendChild(timer);
  }
  if (sub) sub.textContent = t.sub;
  if (col) col.textContent = t.rankCol;
}

function _fetchAvailableSeasons(cb) {
  fetch("/seasons-available?mode=" + _boardMode)
    .then(function(r) { return r.json(); })
    .then(function(d) {
      // Always include current season (live data), plus any with cached data, sorted newest first
      var avail = d.available || [];
      if (avail.indexOf("2026") === -1) avail.push("2026");
      avail.sort(function(a, b) { return parseInt(b) - parseInt(a); });
      _boardAvailableSeasons = avail;
      if (cb) cb();
    })
    .catch(function() { if (cb) cb(); });
}

function _loadForFilter() {
  // Live ranked data for current season solo; cached for everything else
  if (_boardSeason === "2026" && _boardMode === "solo") {
    loadSquad();
  } else {
    loadSquadStats(_boardSeason, _boardMode);
  }
}

function _renderFilterBar() {
  var seasonEl = document.getElementById("board-seasons");
  var modeEl   = document.getElementById("board-modes");
  if (seasonEl) {
    seasonEl.innerHTML = _boardAvailableSeasons.map(function(s) {
      return '<button class="bf-season' + (s === _boardSeason ? " active" : "") + '" onclick="setBoardSeason(\'' + s + '\')">' + s + '</button>';
    }).join('');
  }
  if (modeEl) {
    modeEl.innerHTML = BOARD_MODES.map(function(m) {
      if (m.id === 'clash') {
        return '<button class="bf-mode dev-locked" data-tip="In development" onclick="return false">' + m.label + '</button>';
      }
      return '<button class="bf-mode' + (m.id === _boardMode ? " active " + m.id : "") + '" onclick="setBoardMode(\'' + m.id + '\')">' + m.label + '</button>';
    }).join('');
  }
}

var _hideRank = false;

function loadSquadStats(season, mode) {
  currentOpenIdx = null;
  renderSkeletons();
  fetch("/squad-stats?season=" + season + "&mode=" + mode)
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.error) {
        document.getElementById("board").innerHTML = '<div style="text-align:center;color:var(--red);padding:40px">' + data.error + '</div>';
        return;
      }
      allData = data.players || [];
      _hideRank = !!data.hideRank;
      var col = document.getElementById("lb-rank-header");
      if (col) {
        col.textContent = _boardMode === "clash" ? "Solo Strength" : "Rank";
        col.style.visibility = _hideRank ? "hidden" : "";
      }
      if (data.ddragonVersion) {
        ICON_BASE = "https://ddragon.leagueoflegends.com/cdn/" + data.ddragonVersion + "/img/profileicon/";
      }
      renderBoard();
      document.getElementById("lastUpdated").textContent = "";
    })
    .catch(function(e) {
      document.getElementById("board").innerHTML = '<div style="text-align:center;color:var(--red);padding:40px">' + e.message + '</div>';
    });
}

function cardHTML(p, i, rankPos) {
  var delay = 'style="animation-delay:' + (i * 0.04 + 0.04) + 's"';

  // Error State
  if (p.error) {
    return '<div class="player-card is-error" ' + delay + ' id="player-card-' + i + '">'
      + '<div class="card-header">'
      + '<div class="rank-num">—</div>'
      + '<div class="player-id"><div class="icon-wrap"><div style="width:38px;height:38px;border-radius:10px;background:var(--bg3)"></div></div>'
      + '<div class="player-name"><div class="name">' + p.gameName + '</div><div class="tag">#' + p.tagLine + '</div></div></div>'
      + '<div class="error-label">Unable to load</div>'
      + '</div></div>';
  }

  // Unranked / No cached data
  if (!p.solo) {
    var noDataLabel = p.cached ? 'No data — fetch first' : 'Unranked';
    return '<div class="player-card" ' + delay + ' id="player-card-' + i + '">'
      + '<div class="card-header">'
      + '<div class="rank-num">—</div>'
      + '<div class="player-id"><div class="icon-wrap"><img src="' + ICON(p.profileIconId) + '" onerror="this.src=\'' + ICON(1) + '\'" />'
      + (p.summonerLevel ? '<div class="level-badge">' + p.summonerLevel + '</div>' : '')
      + '</div><div class="player-name"><div class="name">' + p.gameName + '</div><div class="tag">#' + p.tagLine + '</div></div></div>'
      + '<div class="unranked-label">' + noDataLabel + '</div>'
      + '</div></div>';
  }

  // Normal Ranked State
  var s = p.solo;
  var rankClass = rankPos <= 3 ? "rank-" + rankPos : "";

  // Multi-Badge Identity System (Max 3)
  var badgesArr = [];
  var totalGames = s.wins + s.losses;
  var kdaVal = parseFloat(s.kda) || 0;
  var deathsVal = parseFloat(s.deaths) || 0;
  var assistsVal = parseFloat(s.assists) || 0;
  var killsVal = parseFloat(s.kills) || 0;
  var wrVal = s.winRate;

  // TIER 1: DEATH / FEEDING
  if (deathsVal >= 8.0) {
    badgesArr.push('<span class="badge badge-feeder" data-tip="Averaging ' + deathsVal.toFixed(1) + ' deaths per game in their last 10. Someone call an ambulance.">☠ Inting</span>');
  } else if (deathsVal >= 6.5 && kdaVal <= 1.5) {
    badgesArr.push('<span class="badge badge-feeder-soft" data-tip="High deaths (' + deathsVal.toFixed(1) + ' avg) and a KDA of ' + kdaVal.toFixed(2) + '. Not great, not terrible.">💀 Dying A Lot</span>');
  }

  // TIER 2: KDA / PERFORMANCE
  if (s.kda === "Perfect" || kdaVal >= 5.0) {
    badgesArr.push('<span class="badge badge-godlike" data-tip="KDA of ' + (s.kda === "Perfect" ? "Perfect (0 deaths)" : kdaVal.toFixed(2)) + ' over last 10 games. Practically untouchable.">✦ Godlike KDA</span>');
  } else if (kdaVal >= 3.5 && deathsVal < 5.0) {
    badgesArr.push('<span class="badge badge-carry" data-tip="KDA of ' + kdaVal.toFixed(2) + ' with only ' + deathsVal.toFixed(1) + ' avg deaths. Carrying hard.">⚡ Carry Mode</span>');
  }

  // TIER 3: PLAYSTYLE
  if (killsVal >= 12.0) {
    badgesArr.push('<span class="badge badge-slayer" data-tip="Averaging ' + killsVal.toFixed(1) + ' kills per game. Pure bloodlust.">🩸 Slayer</span>');
  } else if (killsVal >= 9.0 && deathsVal < 6.0) {
    badgesArr.push('<span class="badge badge-hyper" data-tip="' + killsVal.toFixed(1) + ' avg kills with manageable deaths. A hyper carry doing hyper carry things.">🔪 Hyper Carry</span>');
  } else if (assistsVal >= 15.0 && killsVal <= 4.0) {
    badgesArr.push('<span class="badge badge-support" data-tip="' + assistsVal.toFixed(1) + ' avg assists and only ' + killsVal.toFixed(1) + ' kills. Living for the team, not the scoreboard.">🛡 Playmaker</span>');
  } else if (assistsVal >= 10.0 && killsVal <= 6.0) {
    badgesArr.push('<span class="badge badge-support" data-tip="' + assistsVal.toFixed(1) + ' avg assists. Prefers setting up kills over taking them.">🤝 Team Player</span>');
  }

  // TIER 4: SEASON WIN RATE + VOLUME
  if (wrVal >= 62 && totalGames >= 30) {
    badgesArr.push('<span class="badge badge-smurf" data-tip="' + wrVal + '% win rate over ' + totalGames + ' games. Either smurfing or criminally underranked.">👾 Smurf Alert</span>');
  } else if (wrVal >= 56 && totalGames >= 20) {
    badgesArr.push('<span class="badge badge-climbing" data-tip="' + wrVal + '% win rate across ' + totalGames + ' games this season. LP going up.">📈 Climbing</span>');
  } else if (wrVal >= 52 && totalGames >= 50) {
    badgesArr.push('<span class="badge badge-consistent" data-tip="Holding ' + wrVal + '% over ' + totalGames + ' games. Steady and reliable.">✔ Consistent</span>');
  } else if (wrVal <= 45 && totalGames >= 30) {
    badgesArr.push('<span class="badge badge-hardstuck" data-tip="' + wrVal + '% win rate after ' + totalGames + ' games. This might be their elo.">📉 Hardstuck</span>');
  } else if (wrVal <= 48 && totalGames >= 20) {
    badgesArr.push('<span class="badge badge-trenches" data-tip="' + wrVal + '% win rate. Losing more than winning but still grinding.">⛏ In the Trenches</span>');
  }

  // TIER 5: VOLUME / GRIND
  if (totalGames >= 500) {
    badgesArr.push('<span class="badge badge-grinder" data-tip="' + totalGames + ' games played this season. Touch grass.">💿 No-Lifer</span>');
  } else if (totalGames >= 300 && wrVal >= 48 && wrVal <= 52) {
    badgesArr.push('<span class="badge badge-grinder" data-tip="' + totalGames + ' games at a ~50% win rate. The definition of a grinder.">⚔ True Grinder</span>');
  } else if (totalGames <= 20 && totalGames > 0) {
    badgesArr.push('<span class="badge badge-fresh" data-tip="Only ' + totalGames + ' games played this season. Just getting started.">🌱 Fresh Season</span>');
  }

  // TIER 6: RIOT NATIVE (Hot Streak)
  if (s.hotStreak) {
    badgesArr.push('<span class="badge badge-streak" data-tip="Currently on a winning streak. Don\'t queue into them right now.">🔥 Hot Streak</span>');
  }

  // FALLBACK
  if (badgesArr.length === 0) {
    badgesArr.push('<span class="badge badge-neutral" data-tip="Nothing remarkable to report. Perfectly average in every way.">〜 Mid</span>');
  }

  var badges = badgesArr.slice(0, 3).join("");

  // LIVE badge
  if (p.isLive) {
    badges = '<span class="badge" style="background:rgba(255,69,58,0.2);color:#ff7369;border:1px solid rgba(255,69,58,0.5);box-shadow:0 0 8px rgba(255,69,58,0.4);animation:pulse 2s infinite">🔴 LIVE</span>' + badges;
  }

  var tierCol = '';
  if (p.mode === 'clash') {
    // Clash has no rank — show solo rank as a strength reference pill
    var soloStrHtml = '';
    if (p.liveRank && p.liveRank.tier) {
      soloStrHtml = '<div class="tier-name t-' + tc(p.liveRank.tier) + '" style="font-size:0.85rem">'
        + p.liveRank.tier + ' ' + p.liveRank.rank + '</div>'
        + '<div style="font-size:0.65rem;color:var(--text3);margin-top:2px;letter-spacing:.04em">Solo rank</div>';
    } else {
      soloStrHtml = '<div style="font-size:0.75rem;color:var(--text3)">Unranked</div>';
    }
    tierCol = '<div class="tier-col"><div class="tier-info">' + soloStrHtml + '</div></div>';
  } else if (p.cached) {
    var lrHtml = '';
    if (!_hideRank && p.liveRank && p.liveRank.tier) {
      lrHtml = '<div class="tier-name t-' + tc(p.liveRank.tier) + '" style="opacity:0.65;font-size:0.8rem">'
        + p.liveRank.tier + ' ' + p.liveRank.rank + '</div>';
    }
    var gamesHtml = _hideRank
      ? '<div style="font-size:0.9rem;font-weight:700;visibility:hidden">' + (s.wins + s.losses) + ' games</div>'
      : '';
    tierCol = '<div class="tier-col"><div class="tier-info">' + lrHtml + gamesHtml + '</div></div>';
  } else {
    tierCol = '<div class="tier-col">'
      + '<div class="tier-info"><div class="tier-name t-' + tc(s.tier) + '">' + s.tier + ' ' + s.rank + '</div><div class="tier-lp">' + s.lp + ' LP</div></div></div>';
  }

  var headerStr = '<div class="card-header">'
    + '<div class="rank-num">' + rankPos + '</div>'
    + '<div class="player-id"><div class="icon-wrap"><img src="' + ICON(p.profileIconId) + '" onerror="this.src=\'' + ICON(1) + '\'" />'
    + (p.summonerLevel ? '<div class="level-badge">' + p.summonerLevel + '</div>' : '')
    + '</div><div class="player-name"><div class="name">' + p.gameName + '</div><div class="tag">#' + p.tagLine + '</div>'
    + (badges ? '<div class="badge-row">' + badges + '</div>' : '')
    + '</div></div>'
    + tierCol
    + '<div class="wl-col"><div class="wl-numbers"><span class="w">' + s.wins + 'W</span> <span style="color:var(--text3)">/</span> <span class="l">' + s.losses + 'L</span></div>'
    + '<div class="wl-bar"><div class="wl-bar-fill" style="width:' + s.winRate + '%"></div></div></div>'
    + '<div class="wr-col">' + wrRing(s.winRate) + '</div>'
    + '<div class="games-col"><div class="g-num">' + (s.wins + s.losses) + '</div><div class="g-label">games</div></div>'
    + '<button class="vs-btn badge-carry" onclick="selectForCompare(' + i + ', event)" data-tip="Select to compare head-to-head. Pick a second player to open the matchup.">⚔</button>'
    + '</div>';

  var detailStr = '<div class="detail-wrapper"><div class="detail-inner">' + renderDetail(p, i) + '</div></div>';

  return '<div class="player-card ' + rankClass + '" ' + delay + ' id="player-card-' + i + '" onclick="togglePlayer(' + i + ')">'
    + headerStr + detailStr
    + '</div>';
}

function renderBoard() {
  var board = document.getElementById("board"), ranked = 0, html = "";
  for (var i = 0; i < allData.length; i++) {
    var p = allData[i];
    if (_hideRank && p.liveRank) p = Object.assign({}, p, { liveRank: null });
    var hasStats = p.solo && (p.solo.wins + p.solo.losses) > 0;
    html += cardHTML(p, i, hasStats ? ++ranked : null);
  }
  board.innerHTML = html;
}

function togglePlayer(idx) {
  if (currentOpenIdx === idx) { document.getElementById("player-card-" + idx).classList.remove("open"); currentOpenIdx = null; return; }
  if (currentOpenIdx !== null) { var prev = document.getElementById("player-card-" + currentOpenIdx); if (prev) prev.classList.remove("open"); }
  var current = document.getElementById("player-card-" + idx);
  if (current) current.classList.add("open");
  currentOpenIdx = idx;
}

function renderSkeletons() {
  var skels = "";
  for (var i = 0; i < 8; i++) skels += '<div class="skeleton"><div class="skel-block" style="width:28px;height:28px;border-radius:50%;flex-shrink:0"></div><div class="skel-block" style="width:44px;height:44px;border-radius:12px;flex-shrink:0"></div><div style="flex:1;display:flex;flex-direction:column;gap:6px"><div class="skel-block" style="height:14px;width:55%"></div><div class="skel-block" style="height:10px;width:30%"></div></div><div class="skel-block" style="width:70px;height:28px;margin-left:auto"></div></div>';
  document.getElementById("board").innerHTML = skels;
}

function loadSquad() {
  currentOpenIdx = null;
  _hideRank = false;
  var col = document.getElementById("lb-rank-header");
  if (col) col.textContent = "Rank";
  _fetchAvailableSeasons(_renderFilterBar);
  renderSkeletons();

  fetch("/squad")
    .then(function (r) { return r.json(); })
    .then(function (data) {
      allData = data.players || [];
      if (data.ddragonVersion) {
        ICON_BASE = "https://ddragon.leagueoflegends.com/cdn/" + data.ddragonVersion + "/img/profileicon/";
      }
      renderBoard();
      document.getElementById("lastUpdated").textContent = "";
    })
    .catch(function (e) {
      document.getElementById("board").innerHTML =
        '<div style="text-align:center;color:var(--red);padding:40px">' + e.message + '</div>';
    });
}
