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
  if (h1) h1.textContent = t.h1;
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
        window._ddragonVersion = data.ddragonVersion;
      }
      window._currentMode = _boardMode;
      window._currentSeason = _boardSeason;
      renderBoard();
      document.getElementById("lastUpdated").textContent = "";
    })
    .catch(function(e) {
      document.getElementById("board").innerHTML = '<div style="text-align:center;color:var(--red);padding:40px">' + e.message + '</div>';
    });
}

function _badge(type, icon, label, tip) {
  return '<span class="badge badge-' + type + '" data-tip="' + tip.replace(/"/g, '&quot;') + '">' + icon + ' ' + label + '</span>';
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

  // ── Badge System ──────────────────────────────────────────
  var totalGames = s.wins + s.losses;
  var kdaVal     = parseFloat(s.kda) || 0;
  var deathsVal  = parseFloat(s.deaths) || 0;
  var assistsVal = parseFloat(s.assists) || 0;
  var killsVal   = parseFloat(s.kills) || 0;
  var wrVal      = s.winRate;
  var perfectKda = s.kda === "Perfect";

  // ── 1. PERFORMANCE BADGE (based on last-10 stats) ── pick ONE
  var perfBadge = '';
  if (deathsVal >= 7.5) {
    perfBadge = _badge('feeder', '☠', 'Inting',
      deathsVal.toFixed(1) + ' deaths per game. The enemy jungler sends their regards.');
  } else if (deathsVal >= 6.0 && kdaVal <= 2.0) {
    perfBadge = _badge('feeder-soft', '💀', 'Feeding',
      kdaVal.toFixed(2) + ' KDA with ' + deathsVal.toFixed(1) + ' avg deaths. Playing the game generously.');
  } else if (perfectKda || kdaVal >= 4.5) {
    var kdaStr = perfectKda ? 'Perfect (0 deaths)' : kdaVal.toFixed(2);
    perfBadge = _badge('godlike', '✦', 'Godlike',
      kdaStr + ' KDA — ' + killsVal.toFixed(1) + '/' + deathsVal.toFixed(1) + '/' + assistsVal.toFixed(1) + '. Cannot be touched.');
  } else if (kdaVal >= 3.0 && killsVal >= 6.0 && deathsVal < 5.5) {
    perfBadge = _badge('carry', '⚡', 'Carrying',
      kdaVal.toFixed(2) + ' KDA, ' + killsVal.toFixed(1) + ' kills/game. The team eats because of them.');
  } else if (killsVal >= 9.0 && deathsVal < 6.5) {
    perfBadge = _badge('slayer', '🩸', 'Slayer',
      killsVal.toFixed(1) + ' kills per game. Their damage profile is mostly faces.');
  } else if (assistsVal >= 13.0 && killsVal <= 5.0) {
    perfBadge = _badge('support', '🛡', 'Playmaker',
      assistsVal.toFixed(1) + ' assists, ' + killsVal.toFixed(1) + ' kills. Does the work, skips the glory.');
  } else if (assistsVal >= 9.0 && kdaVal >= 2.5 && killsVal <= 7.0) {
    perfBadge = _badge('support', '🤝', 'Team Player',
      assistsVal.toFixed(1) + ' avg assists at ' + kdaVal.toFixed(2) + ' KDA. Wins as a unit, not an individual.');
  }

  // ── 2. SEASON BADGE (based on full record) ── pick ONE
  var seasonBadge = '';
  if (s.hotStreak) {
    seasonBadge = _badge('streak', '🔥', 'Hot Streak',
      'On a winning streak right now. Best to avoid them in queue.');
  } else if (totalGames >= 500) {
    seasonBadge = _badge('grinder', '💿', 'No-Lifer',
      totalGames + ' games this split. Grass is a myth to this person.');
  } else if (wrVal >= 62 && totalGames >= 25) {
    seasonBadge = _badge('smurf', '👾', 'Smurf?',
      wrVal + '% WR over ' + totalGames + ' games. Either boosted or hiding their MMR.');
  } else if (wrVal >= 56 && totalGames >= 15) {
    seasonBadge = _badge('climbing', '📈', 'Climbing',
      wrVal + '% WR — ' + s.wins + 'W / ' + s.losses + 'L. LP is going up this split.');
  } else if (wrVal >= 52 && totalGames >= 40) {
    seasonBadge = _badge('consistent', '✔', 'Consistent',
      'Holding ' + wrVal + '% over ' + totalGames + ' games. Slow and steady wins the split.');
  } else if (wrVal <= 44 && totalGames >= 35) {
    seasonBadge = _badge('hardstuck', '📉', 'Hardstuck',
      wrVal + '% after ' + totalGames + ' games. The matchmaking has spoken.');
  } else if (wrVal <= 48 && totalGames >= 20) {
    seasonBadge = _badge('trenches', '⛏', 'Struggling',
      wrVal + '% WR across ' + totalGames + ' games. More losses than wins, but still queuing up.');
  } else if (totalGames >= 250) {
    seasonBadge = _badge('grinder', '⚔', 'Grinder',
      totalGames + ' games deep this season. League is their full-time job.');
  } else if (totalGames <= 12 && totalGames > 0) {
    seasonBadge = _badge('fresh', '🌱', 'Fresh Start',
      'Only ' + totalGames + ' games in. The split has barely begun for them.');
  }

  // ── Combine: perf first, then season. Max 2 ──
  var badgesArr = [];
  if (perfBadge)   badgesArr.push(perfBadge);
  if (seasonBadge) badgesArr.push(seasonBadge);

  if (badgesArr.length === 0) {
    badgesArr.push(_badge('neutral', '〜', 'Average',
      wrVal + '% WR, ' + kdaVal.toFixed(2) + ' KDA. Nothing stands out — yet.'));
  }

  var badges = badgesArr.join('');

  if (p.isLive) {
    badges = _badge('live', '🔴', 'Live', 'Currently in a game.') + badges;
  }

  var tierCol = '';
  if (p.mode === 'clash') {
    var soloStrHtml = '';
    if (p.liveRank && p.liveRank.tier) {
      var lrKey2 = tc(p.liveRank.tier);
      soloStrHtml = '<div class="tier-info"><div class="tier-name t-' + lrKey2 + '">' + p.liveRank.tier + ' ' + p.liveRank.rank + '</div>'
        + '<div class="tier-lp">Solo rank</div></div>';
    } else {
      soloStrHtml = '<div class="tier-info"><div style="font-size:0.75rem;color:var(--text3)">Unranked</div></div>';
    }
    tierCol = '<div class="tier-col">' + soloStrHtml + '</div>';
  } else if (p.cached) {
    var lrHtml = '';
    if (!_hideRank && p.liveRank && p.liveRank.tier) {
      var lrKey3 = tc(p.liveRank.tier);
      lrHtml = '<div class="tier-info"><div class="tier-name t-' + lrKey3 + '" style="opacity:0.7">' + p.liveRank.tier + ' ' + p.liveRank.rank + '</div></div>';
    }
    var gamesHtml = _hideRank
      ? '<div style="font-size:0.9rem;font-weight:700;visibility:hidden">' + (s.wins + s.losses) + ' games</div>'
      : '';
    tierCol = '<div class="tier-col">' + lrHtml + gamesHtml + '</div>';
  } else {
    var tk = tc(s.tier);
    tierCol = '<div class="tier-col">'
      + '<div class="tier-info"><div class="tier-name t-' + tk + '">' + s.tier + ' ' + s.rank + '</div><div class="tier-lp">' + s.lp + ' LP</div></div>'
      + '</div>';
  }

  // Tier accent class for left border color
  var tierAccent = '';
  if (!p.cached && s.tier) {
    tierAccent = ' t-' + tc(s.tier) + '-accent';
  } else if (p.liveRank && p.liveRank.tier) {
    tierAccent = ' t-' + tc(p.liveRank.tier) + '-accent';
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

  return '<div class="player-card ' + rankClass + tierAccent + '" ' + delay + ' id="player-card-' + i + '" onclick="togglePlayer(' + i + ')">'
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
        window._ddragonVersion = data.ddragonVersion;
      }
      window._currentMode = _boardMode;
      window._currentSeason = _boardSeason;
      renderBoard();
      document.getElementById("lastUpdated").textContent = "";
    })
    .catch(function (e) {
      document.getElementById("board").innerHTML =
        '<div style="text-align:center;color:var(--red);padding:40px">' + e.message + '</div>';
    });
}
