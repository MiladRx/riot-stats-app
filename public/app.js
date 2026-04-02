var allData = [];
var currentOpenIdx = null;
var compareSelection = [];

var ROLE_LABELS = { TOP: "Top", JUNGLE: "Jungle", MIDDLE: "Mid", BOTTOM: "Bot", UTILITY: "Support" };
var ROLE_ICONS = { TOP: "", JUNGLE: "", MIDDLE: "", BOTTOM: "", UTILITY: "" };

var TIER_SCORES = { IRON: 0, BRONZE: 400, SILVER: 800, GOLD: 1200, PLATINUM: 1600, EMERALD: 2000, DIAMOND: 2400, MASTER: 2800, GRANDMASTER: 3200, CHALLENGER: 3600 };
var RANK_SCORES = { IV: 0, III: 100, II: 200, I: 300 };
function lpToScore(tier, rank, lp) {
  return (TIER_SCORES[tier] || 0) + (RANK_SCORES[rank] || 0) + (lp || 0);
}

var ICON_BASE = "https://ddragon.leagueoflegends.com/cdn/14.10.1/img/profileicon/";
function ICON(id) { return ICON_BASE + (id || 1) + ".png"; }
function CHAMP_ICON(ver, id) { return "https://ddragon.leagueoflegends.com/cdn/" + ver + "/img/champion/" + id + ".png"; }
function tc(t) { return t ? t.toLowerCase() : "unranked"; }

// Formats big numbers (e.g. 1500000 -> 1.5M, 450000 -> 450k)
function formatMastery(pts) {
  if (pts >= 1000000) return (pts / 1000000).toFixed(1) + "M";
  if (pts >= 1000) return (pts / 1000).toFixed(0) + "k";
  return pts;
}

function wrColor(wr) { if (wr >= 55) return "wr-good"; if (wr >= 48) return "wr-ok"; return "wr-bad"; }
function wrHex(wr) { if (wr >= 55) return "var(--green)"; if (wr >= 48) return "var(--orange)"; return "var(--red)"; }
function wrLabel(wr) { if (wr >= 55) return "Above average"; if (wr >= 48) return "Average"; return "Below average"; }

function wrRing(wr) {
  var r = 18;
  var circ = 2 * Math.PI * r;
  var fill = (wr / 100) * circ;
  var col = wrHex(wr);
  var cls = wrColor(wr);
  return '<div class="wr-ring">'
    + '<svg width="48" height="48" viewBox="0 0 48 48">'
    + '<circle cx="24" cy="24" r="' + r + '" fill="none" stroke="var(--bg4)" stroke-width="4"/>'
    + '<circle cx="24" cy="24" r="' + r + '" fill="none" stroke="' + col + '" stroke-width="4"'
    + ' stroke-dasharray="' + fill.toFixed(2) + ' ' + circ.toFixed(2) + '" stroke-linecap="round"/>'
    + '</svg>'
    + '<span class="wr-text ' + cls + '">' + wr + '%</span>'
    + '</div>';
}

function renderDetail(p, i) {
  if (!p.solo) return "";
  var s = p.solo;
  var games = s.wins + s.losses;
  var winDiff = s.wins - s.losses;
  var tierKey = tc(s.tier);
  var tierEmblem = "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-emblem/emblem-" + tierKey + ".png";

  // Time played label
  var timePlayed = "";
  if (s.totalTimeSecs) {
    var _d = Math.floor(s.totalTimeSecs / 86400);
    var _h = Math.floor((s.totalTimeSecs % 86400) / 3600);
    timePlayed = _d > 0 ? _d + "d " + _h + "h" : _h + "h " + Math.floor((s.totalTimeSecs % 3600) / 60) + "m";
  }

  return '<div class="detail-panel-inner">'

    // ── Hero Header ──
    + '<div class="detail-hero">'
    + '<div class="dh-left">'
    + '<img class="dh-avatar" src="' + ICON(p.profileIconId) + '" onerror="this.src=\'' + ICON(1) + '\'" />'
    + '<div class="dh-info">'
    + '<div class="dh-name">' + p.gameName + ' <span>#' + p.tagLine + '</span></div>'
    + '<div class="dh-sub">Solo / Duo Ranked</div>'
    + '<div class="dh-chips">'
    + '<span class="dh-chip" style="color:' + wrHex(s.winRate) + ';border-color:' + wrHex(s.winRate) + '33">' + s.winRate + '% WR</span>'
    + '<span class="dh-chip"><span style="color:var(--green)">' + s.wins + 'W</span> / <span style="color:var(--red)">' + s.losses + 'L</span></span>'
    + '<span class="dh-chip">' + games + ' Games</span>'
    + (s.avgDuration ? '<span class="dh-chip">' + s.avgDuration + ' min avg</span>' : '')
    + '</div>'
    + ''
    + '</div>'
    + '</div>'
    + '<div class="detail-tier-badge">'
    + '<div class="tier-emblem-clip"><img src="' + tierEmblem + '" class="tier-emblem-large" /></div>'
    + '<div><div class="dtier t-' + tierKey + '">' + s.tier + ' ' + s.rank + '</div>'
    + '<div style="font-size:0.9rem;color:var(--text);font-weight:700">' + s.lp + ' LP</div></div>'
    + '</div>'
    + '</div>'

    // ── Combat + Performance side by side ──
    + '<div class="ds-two-col">'
    + '<div class="detail-section">'
    + '<div class="ds-title">Combat</div>'
    + '<div class="ds-grid ds-2">'
    + '<div class="stat-box"><div class="st-label">Avg Kills</div><div class="st-val" style="color:var(--green)">' + (s.kills || "0.0") + '</div><div class="st-sub">Per game</div></div>'
    + '<div class="stat-box"><div class="st-label">Avg Deaths</div><div class="st-val" style="color:var(--red)">' + (s.deaths || "0.0") + '</div><div class="st-sub">Per game</div></div>'
    + '<div class="stat-box"><div class="st-label">Avg Assists</div><div class="st-val">' + (s.assists || "0.0") + '</div><div class="st-sub">Per game</div></div>'
    + '<div class="stat-box"><div class="st-label">KDA Ratio</div><div class="st-val" style="color:var(--orange)">' + (s.kda || "0.00") + '</div><div class="st-sub">All stored games</div></div>'
    + '</div>'
    + '</div>'
    + '<div class="detail-section">'
    + '<div class="ds-title">Performance</div>'
    + '<div class="ds-grid ds-2">'
    + (s.topRole ? '<div class="stat-box"><div class="st-label">Main Role</div><div class="st-val" style="color:var(--accent)">' + (ROLE_ICONS[s.topRole] || "") + ' ' + (ROLE_LABELS[s.topRole] || s.topRole) + '</div><div class="st-sub">Most played</div></div>' : '')
    + (s.avgCsMin ? '<div class="stat-box"><div class="st-label">CS / Min</div><div class="st-val" style="color:var(--yellow)">' + s.avgCsMin + '</div><div class="st-sub">Farming efficiency</div></div>' : '')
    + (s.avgVision ? '<div class="stat-box"><div class="st-label">Vision Score</div><div class="st-val" style="color:var(--accent)">' + s.avgVision + '</div><div class="st-sub">Avg per game</div></div>' : '')
    + (s.avgDamage ? '<div class="stat-box"><div class="st-label">Avg Damage</div><div class="st-val">' + formatMastery(s.avgDamage) + '</div><div class="st-sub">To champions</div></div>' : '')
    + '</div>'
    + '</div>'
    + '</div>'

    // ── Section: Season Totals ──
    + '<div class="detail-section">'
    + '<div class="ds-title">Season Totals</div>'
    + '<div class="ds-grid ds-5">'
    + (timePlayed ? '<div class="stat-box"><div class="st-label">Time Played</div><div class="st-val">' + timePlayed + '</div><div class="st-sub">This season</div></div>' : '')
    + (s.totalKills ? '<div class="stat-box"><div class="st-label">Total Kills</div><div class="st-val" style="color:var(--green)">' + s.totalKills + '</div><div class="st-sub">This season</div></div>' : '')
    + (s.totalAssists ? '<div class="stat-box"><div class="st-label">Total Assists</div><div class="st-val" style="color:var(--accent)">' + s.totalAssists + '</div><div class="st-sub">This season</div></div>' : '')
    + (s.totalDeaths ? '<div class="stat-box"><div class="st-label">Total Deaths</div><div class="st-val" style="color:var(--red)">' + s.totalDeaths + '</div><div class="st-sub">This season</div></div>' : '')
    + (s.pentas != null ? '<div class="stat-box"><div class="st-label">Total Pentas</div><div class="st-val" style="color:' + (s.pentas > 0 ? "var(--orange)" : "var(--text)") + '">' + (s.pentas > 0 ? "🏆 " : "") + s.pentas + '</div><div class="st-sub">' + (s.pentas > 0 ? "This season" : "None yet") + '</div></div>' : '')
    + '</div>'
    + '</div>'

    // ── Section: Streaks ──
    + ((s.streak || s.bestStreak || s.bestLStreak) ?
      '<div class="detail-section">'
      + '<div class="ds-title">Streaks</div>'
      + '<div class="ds-grid ds-3">'
      + (s.streak ? '<div class="stat-box"><div class="st-label">Current</div><div class="st-val" style="color:' + (s.streak > 0 ? "var(--green)" : "var(--red)") + '">' + (s.streak > 0 ? "🔥 " + s.streak + "W" : "💀 " + Math.abs(s.streak) + "L") + '</div><div class="st-sub">' + (s.streak > 0 ? "On a roll" : "Rough patch") + '</div></div>' : '')
      + (s.bestStreak ? '<div class="stat-box"><div class="st-label">Best Win Streak</div><div class="st-val" style="color:var(--green)">🔥 ' + s.bestStreak + 'W</div><div class="st-sub">Longest win run</div></div>' : '')
      + (s.bestLStreak ? '<div class="stat-box"><div class="st-label">Worst Loss Streak</div><div class="st-val" style="color:var(--red)">💀 ' + s.bestLStreak + 'L</div><div class="st-sub">Longest loss run</div></div>' : '')
      + '</div>'
      + '</div>'
      : '')

    // ── Section: Champions ──
    + ((p.topChamp || s.topCachedChamp) ?
      '<div class="detail-section">'
      + '<div class="ds-title">Champions</div>'
      + '<div class="ds-grid ds-2">'
      + (p.topChamp ? '<div class="stat-box"><div class="st-label">Signature Pick</div><div class="sig-content"><img src="' + CHAMP_ICON(p.topChamp.version, p.topChamp.id) + '" /><div><div class="st-val">' + p.topChamp.name + '</div><div class="st-sub" style="color:var(--yellow)">' + formatMastery(p.topChamp.points) + ' Pts mastery</div></div></div></div>' : '')
      + (s.topCachedChamp ? '<div class="stat-box"><div class="st-label">Season Spam</div><div class="sig-content"><img src="' + CHAMP_ICON(p.topChamp ? p.topChamp.version : "14.10.1", s.topCachedChamp.name.replace(/ /g, "")) + '" onerror="this.style.display=\'none\'" /><div><div class="st-val" style="color:var(--orange)">' + s.topCachedChamp.name + '</div><div class="st-sub">' + s.topCachedChamp.games + ' games · ' + s.topCachedChamp.winRate + '% WR</div></div></div></div>' : '')
      + '</div>'
      + '</div>'
      : '')

    + '</div>';
}


// ── Card HTML ──
function cardHTML(p, i, rankPos) {
  var delay = 'style="animation-delay:' + (i * 0.04 + 0.04) + 's"';

  // 1. Error State
  if (p.error) {
    return '<div class="player-card is-error" ' + delay + ' id="player-card-' + i + '">'
      + '<div class="card-header">'
      + '<div class="rank-num">—</div>'
      + '<div class="player-id"><div class="icon-wrap"><div style="width:38px;height:38px;border-radius:10px;background:var(--bg3)"></div></div>'
      + '<div class="player-name"><div class="name">' + p.gameName + '</div><div class="tag">#' + p.tagLine + '</div></div></div>'
      + '<div class="error-label">Unable to load</div>'
      + '</div></div>';
  }

  // 2. Unranked State
  if (!p.solo) {
    return '<div class="player-card" ' + delay + ' id="player-card-' + i + '" onclick="togglePlayer(' + i + ')">'
      + '<div class="card-header">'
      + '<div class="rank-num">—</div>'
      + '<div class="player-id"><div class="icon-wrap"><img src="' + ICON(p.profileIconId) + '" onerror="this.src=\'' + ICON(1) + '\'" />'
      + (p.summonerLevel ? '<div class="level-badge">' + p.summonerLevel + '</div>' : '')
      + '</div><div class="player-name"><div class="name">' + p.gameName + '</div><div class="tag">#' + p.tagLine + '</div></div></div>'
      + '<div class="unranked-label">Unranked</div>'
      + '</div></div>';
  }

  // 3. Normal Ranked State
  var s = p.solo;
  var rankClass = rankPos <= 3 ? "rank-" + rankPos : "";

  // ── Multi-Badge Identity System (Max 3) ──
  var badgesArr = [];
  var totalGames = s.wins + s.losses;
  var kdaVal = parseFloat(s.kda) || 0;
  var deathsVal = parseFloat(s.deaths) || 0;
  var assistsVal = parseFloat(s.assists) || 0;
  var killsVal = parseFloat(s.kills) || 0;
  var wrVal = s.winRate;

  // ── TIER 1: DEATH / FEEDING (Highest priority negative) ──
  if (deathsVal >= 8.0) {
    badgesArr.push('<span class="badge badge-feeder" data-tip="Averaging ' + deathsVal.toFixed(1) + ' deaths per game in their last 10. Someone call an ambulance.">☠ Inting</span>');
  } else if (deathsVal >= 6.5 && kdaVal <= 1.5) {
    badgesArr.push('<span class="badge badge-feeder-soft" data-tip="High deaths (' + deathsVal.toFixed(1) + ' avg) and a KDA of ' + kdaVal.toFixed(2) + '. Not great, not terrible.">💀 Dying A Lot</span>');
  }

  // ── TIER 2: KDA / PERFORMANCE (All stored games) ──
  if (s.kda === "Perfect" || kdaVal >= 5.0) {
    badgesArr.push('<span class="badge badge-godlike" data-tip="KDA of ' + (s.kda === "Perfect" ? "Perfect (0 deaths)" : kdaVal.toFixed(2)) + ' over last 10 games. Practically untouchable.">✦ Godlike KDA</span>');
  } else if (kdaVal >= 3.5 && deathsVal < 5.0) {
    badgesArr.push('<span class="badge badge-carry" data-tip="KDA of ' + kdaVal.toFixed(2) + ' with only ' + deathsVal.toFixed(1) + ' avg deaths. Carrying hard.">⚡ Carry Mode</span>');
  }

  // ── TIER 3: PLAYSTYLE (All stored games) ──
  if (killsVal >= 12.0) {
    badgesArr.push('<span class="badge badge-slayer" data-tip="Averaging ' + killsVal.toFixed(1) + ' kills per game. Pure bloodlust.">🩸 Slayer</span>');
  } else if (killsVal >= 9.0 && deathsVal < 6.0) {
    badgesArr.push('<span class="badge badge-hyper" data-tip="' + killsVal.toFixed(1) + ' avg kills with manageable deaths. A hyper carry doing hyper carry things.">🔪 Hyper Carry</span>');
  } else if (assistsVal >= 15.0 && killsVal <= 4.0) {
    badgesArr.push('<span class="badge badge-support" data-tip="' + assistsVal.toFixed(1) + ' avg assists and only ' + killsVal.toFixed(1) + ' kills. Living for the team, not the scoreboard.">🛡 Playmaker</span>');
  } else if (assistsVal >= 10.0 && killsVal <= 6.0) {
    badgesArr.push('<span class="badge badge-support" data-tip="' + assistsVal.toFixed(1) + ' avg assists. Prefers setting up kills over taking them.">🤝 Team Player</span>');
  }

  // ── TIER 4: SEASON WIN RATE + VOLUME ──
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

  // ── TIER 5: VOLUME / GRIND ──
  if (totalGames >= 500) {
    badgesArr.push('<span class="badge badge-grinder" data-tip="' + totalGames + ' games played this season. Touch grass.">💿 No-Lifer</span>');
  } else if (totalGames >= 300 && wrVal >= 48 && wrVal <= 52) {
    badgesArr.push('<span class="badge badge-grinder" data-tip="' + totalGames + ' games at a ~50% win rate. The definition of a grinder.">⚔ True Grinder</span>');
  } else if (totalGames <= 20 && totalGames > 0) {
    badgesArr.push('<span class="badge badge-fresh" data-tip="Only ' + totalGames + ' games played this season. Just getting started.">🌱 Fresh Season</span>');
  }

  // ── TIER 6: RIOT NATIVE (Hot Streak) ──
  if (s.hotStreak) {
    badgesArr.push('<span class="badge badge-streak" data-tip="Currently on a winning streak. Don\'t queue into them right now.">🔥 Hot Streak</span>');
  }

  // ── FALLBACK ──
  if (badgesArr.length === 0) {
    badgesArr.push('<span class="badge badge-neutral" data-tip="Nothing remarkable to report. Perfectly average in every way.">〜 Mid</span>');
  }

  // Hard cap at 3 badges
  var badges = badgesArr.slice(0, 3).join("");

  // Append LIVE Status Badge FIRST if they are in game
  if (p.isLive) {
    badges = '<span class="badge" style="background:rgba(255,69,58,0.2);color:#ff7369;border:1px solid rgba(255,69,58,0.5);box-shadow:0 0 8px rgba(255,69,58,0.4);animation:pulse 2s infinite">🔴 LIVE</span>' + badges;
  }

  // HTML String Construction
  var headerStr = '<div class="card-header">'
    + '<div class="rank-num">' + rankPos + '</div>'
    + '<div class="player-id"><div class="icon-wrap"><img src="' + ICON(p.profileIconId) + '" onerror="this.src=\'' + ICON(1) + '\'" />'
    + (p.summonerLevel ? '<div class="level-badge">' + p.summonerLevel + '</div>' : '')
    + '</div><div class="player-name"><div class="name">' + p.gameName + '</div><div class="tag">#' + p.tagLine + '</div>'
    + (badges ? '<div class="badge-row">' + badges + '</div>' : '')
    + '</div></div>'
    + '<div class="tier-col">'
    + '<div class="tier-info"><div class="tier-name t-' + tc(s.tier) + '">' + s.tier + ' ' + s.rank + '</div><div class="tier-lp">' + s.lp + ' LP</div></div></div>'
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
  for (var i = 0; i < allData.length; i++) html += cardHTML(allData[i], i, allData[i].solo ? ++ranked : null);
  board.innerHTML = html;
}

function togglePlayer(idx) {
  if (currentOpenIdx === idx) { document.getElementById("player-card-" + idx).classList.remove("open"); currentOpenIdx = null; return; }
  if (currentOpenIdx !== null) { var prev = document.getElementById("player-card-" + currentOpenIdx); if (prev) prev.classList.remove("open"); }
  var current = document.getElementById("player-card-" + idx);
  if (current) current.classList.add("open");
  currentOpenIdx = idx;
  // Load recent games for this player
  var p = allData[idx];
}

var _rgCache = {};

function _loadRecentGames(idx, gameName, tagLine) {
  var el = document.getElementById("rg-" + idx);
  if (!el) return;
  var ck = (gameName + "#" + tagLine).toLowerCase();
  if (_rgCache[ck]) { _renderRgRow(el, _rgCache[ck], idx); return; }
  fetch("/player-history/" + encodeURIComponent(gameName) + "/" + encodeURIComponent(tagLine))
    .then(function (r) { return r.json(); })
    .then(function (d) {
      _rgCache[ck] = d.recentGames || [];
      _renderRgRow(el, _rgCache[ck], idx);
    })
    .catch(function () { el.innerHTML = ""; });
}

function _renderRgRow(el, games, playerIdx) {
  if (!games || !games.length) { el.innerHTML = ""; return; }
  var p = allData[playerIdx];
  var ver = (p && p.topChamp) ? p.topChamp.version : "14.10.1";
  var html = '<div class="rg-games">';
  for (var i = 0; i < games.length; i++) {
    var g = games[i];
    var champId = g.champion ? g.champion.replace(/ /g, "") : "";
    html += '<div class="rg-game ' + (g.win ? "rg-w" : "rg-l") + '" onmouseenter="showGameTooltip(' + i + ',' + playerIdx + ',this)" onmouseleave="hideGameTooltip()">'
      + '<img src="' + CHAMP_ICON(ver, champId) + '" onerror="this.src=\'\'" />'
      + '<div class="rg-badge">' + (g.win ? "W" : "L") + '</div>'
      + '</div>';
  }
  html += '</div>';
  el.innerHTML = html;
}

function renderSkeletons() {
  var skels = "";
  for (var i = 0; i < 8; i++) skels += '<div class="skeleton"><div class="skel-block" style="width:28px;height:28px;border-radius:50%;flex-shrink:0"></div><div class="skel-block" style="width:44px;height:44px;border-radius:12px;flex-shrink:0"></div><div style="flex:1;display:flex;flex-direction:column;gap:6px"><div class="skel-block" style="height:14px;width:55%"></div><div class="skel-block" style="height:10px;width:30%"></div></div><div class="skel-block" style="width:70px;height:28px;margin-left:auto"></div></div>';
  document.getElementById("board").innerHTML = skels;
}

// ── Per-Player Panel Fetch ──
function startPlayerFetch(gameName, tagLine) {
  fetch("/fetch-history/" + encodeURIComponent(gameName) + "/" + encodeURIComponent(tagLine), { method: "POST" })
    .then(function (r) { return r.json(); })
    .then(function () { pollFetchStatus(); });
}

// ── Deep Fetch Panel ──
var _fetchPollTimer = null;

function openFetchPanel() {
  document.getElementById("fetch-panel").classList.remove("hidden");
  document.body.style.overflow = "hidden";
  pollFetchStatus();
}

function closeFetchPanel() {
  document.getElementById("fetch-panel").classList.add("hidden");
  document.body.style.overflow = "";
  clearTimeout(_fetchPollTimer);
}

function startFetch() {
  fetch("/fetch-history", { method: "POST" })
    .then(function (r) { return r.json(); })
    .then(function () { pollFetchStatus(); });
}

function stopFetch() {
  fetch("/fetch-history", { method: "DELETE" })
    .then(function () { pollFetchStatus(); });
}

function pollFetchStatus() {
  clearTimeout(_fetchPollTimer);
  fetch("/fetch-status")
    .then(function (r) { return r.json(); })
    .then(function (data) {
      renderFetchStatus(data);
      if (data.running) _fetchPollTimer = setTimeout(pollFetchStatus, 2500);
    })
    .catch(function () { });
}

function renderFetchStatus(data) {
  var startBtn = document.getElementById("fetchStartBtn");
  var stopBtn = document.getElementById("fetchStopBtn");
  var label = document.getElementById("fetchStatusLabel");

  if (data.running) {
    startBtn.style.display = "none";
    stopBtn.style.display = "";
    label.textContent = "Running…";
    label.style.color = "var(--green)";
  } else {
    startBtn.style.display = "";
    stopBtn.style.display = "none";
    label.textContent = data.startedAt ? "Idle" : "";
    label.style.color = "var(--text3)";
  }

  // Progress list — always show all players
  var STATUS_ICON = { idle: "○", starting: "⟳", fetching: "⟳", done: "✓", error: "✕" };
  var STATUS_COLOR = { idle: "var(--text3)", starting: "var(--orange)", fetching: "var(--accent)", done: "var(--green)", error: "var(--red)" };
  var listHtml = "";
  var players = allData.length ? allData : [];
  for (var i = 0; i < players.length; i++) {
    var pl = players[i];
    var key = (pl.gameName + "#" + pl.tagLine).toLowerCase();
    var prog = data.progress && data.progress[key];
    var st = prog ? prog.status : "idle";
    var icon = STATUS_ICON[st] || "○";
    var color = STATUS_COLOR[st] || "var(--text3)";
    var newBadge = prog && prog.newThisRun > 0 ? '<span class="fetch-new-badge">+' + prog.newThisRun + ' new</span>' : "";
    var cached = prog ? prog.fetched || 0 : 0;
    var isFetching = st === "fetching" || st === "starting";
    var btnLabel = isFetching ? "⟳ Fetching…" : (st === "done" ? "↻ Update" : "▶ Fetch");
    var btnDisabled = (data.running && !isFetching) ? 'disabled title="Another fetch is running"' : (isFetching ? "disabled" : "");
    listHtml += '<div class="fetch-player-row">'
      + '<span class="fetch-player-icon" style="color:' + color + '">' + icon + '</span>'
      + '<span class="fetch-player-name">' + pl.gameName + '</span>'
      + '<span class="fetch-player-count">' + cached + ' games cached</span>'
      + newBadge
      + '<button class="fetch-player-btn" onclick="startPlayerFetch(\'' + pl.gameName + '\',\'' + pl.tagLine + '\')" ' + btnDisabled + '>' + btnLabel + '</button>'
      + '</div>';
  }
  document.getElementById("fetchProgressList").innerHTML = listHtml || '<div style="color:var(--text3);font-size:0.8rem;padding:8px 0">Loading players…</div>';

  // Log
  if (data.log && data.log.length) {
    var logEl = document.getElementById("fetchLog");
    logEl.innerHTML = data.log.slice().reverse().map(function (l) {
      return '<div class="fetch-log-line">' + l + '</div>';
    }).join("");
  }
}

// ── Head-to-Head Compare ──
function selectForCompare(idx, e) {
  e.stopPropagation();
  // Close any open card first so user can see the full list
  if (currentOpenIdx !== null) {
    var open = document.getElementById("player-card-" + currentOpenIdx);
    if (open) open.classList.remove("open");
    currentOpenIdx = null;
  }
  var pos = compareSelection.indexOf(idx);
  if (pos !== -1) {
    compareSelection.splice(pos, 1);
    var card = document.getElementById("player-card-" + idx);
    if (card) card.classList.remove("compare-selected");
    return;
  }
  if (compareSelection.length === 2) {
    var old = compareSelection.shift();
    var oldCard = document.getElementById("player-card-" + old);
    if (oldCard) oldCard.classList.remove("compare-selected");
  }
  compareSelection.push(idx);
  var card = document.getElementById("player-card-" + idx);
  if (card) card.classList.add("compare-selected");
  if (compareSelection.length === 2) showCompareModal();
}

var _cmpSharedChamps = [];
var _cmpA = null, _cmpB = null;

function showCompareModal() {
  _cmpA = allData[compareSelection[0]];
  _cmpB = allData[compareSelection[1]];
  _renderCompare(null);
  document.getElementById("compare-modal").classList.remove("hidden");
  document.body.style.overflow = "hidden";
  // fetch shared champs in background
  var keyA = (_cmpA.gameName + "#" + _cmpA.tagLine).toLowerCase();
  var keyB = (_cmpB.gameName + "#" + _cmpB.tagLine).toLowerCase();
  fetch("/compare/" + encodeURIComponent(keyA) + "/" + encodeURIComponent(keyB))
    .then(function (r) { return r.json(); })
    .then(function (d) {
      _cmpSharedChamps = d.shared || [];
      _buildChampFilter();
    })
    .catch(function () { _cmpSharedChamps = []; });
}

function closeCompareModal() {
  document.getElementById("compare-modal").classList.add("hidden");
  document.body.style.overflow = "";
  compareSelection.forEach(function (idx) {
    var c = document.getElementById("player-card-" + idx);
    if (c) c.classList.remove("compare-selected");
  });
  compareSelection = [];
  _cmpSharedChamps = [];
  _cmpSelectedChamp = null;
  document.getElementById("compare-content").innerHTML = "";
}

var _cmpSelectedChamp = null;

function _buildChampFilter() {
  var wrap = document.getElementById("cmpFilter");
  if (!wrap || _cmpSharedChamps.length === 0) return;
  wrap.innerHTML = '<div class="cmp-filter-toggle" onclick="toggleChampDropdown()">'
    + '<span class="cmp-ft-text">All Champions</span>'
    + '<span class="cmp-ft-arrow">▾</span>'
    + '</div>'
    + '<div class="cmp-dropdown hidden" id="cmpDropdown"></div>';
  _buildDropdownList();
}

function _buildDropdownList() {
  var dd = document.getElementById("cmpDropdown");
  if (!dd) return;
  var ver = (_cmpA && _cmpA.topChamp) ? _cmpA.topChamp.version : "14.10.1";
  var html = '<div class="cmp-dd-item' + (_cmpSelectedChamp === null ? ' active' : '') + '" onclick="pickCompareChamp(null)">'
    + '<span class="cmp-dd-name">All Champions</span></div>';
  for (var i = 0; i < _cmpSharedChamps.length; i++) {
    var c = _cmpSharedChamps[i];
    var cid = c.name.replace(/[^a-zA-Z0-9]/g, "");
    var isActive = _cmpSelectedChamp === c.name;
    html += '<div class="cmp-dd-item' + (isActive ? ' active' : '') + '" onclick="pickCompareChamp(\'' + c.name.replace(/'/g, "\\'") + '\')">'
      + '<img src="' + CHAMP_ICON(ver, cid) + '" onerror="this.style.display=\'none\'" />'
      + '<span class="cmp-dd-name">' + c.name + '</span>'
      + '<span class="cmp-dd-games">' + c.a.games + ' vs ' + c.b.games + '</span>'
      + '</div>';
  }
  dd.innerHTML = html;
}

function toggleChampDropdown() {
  var dd = document.getElementById("cmpDropdown");
  var tog = document.querySelector(".cmp-filter-toggle");
  if (!dd) return;
  var open = !dd.classList.contains("hidden");
  if (open) {
    dd.classList.add("hidden");
    if (tog) tog.classList.remove("open");
  } else {
    dd.classList.remove("hidden");
    if (tog) tog.classList.add("open");
  }
}

function pickCompareChamp(champName) {
  _cmpSelectedChamp = champName;
  var dd = document.getElementById("cmpDropdown");
  var tog = document.querySelector(".cmp-filter-toggle");
  if (dd) dd.classList.add("hidden");
  if (tog) {
    tog.classList.remove("open");
    var ver = (_cmpA && _cmpA.topChamp) ? _cmpA.topChamp.version : "14.10.1";
    if (champName) {
      var cid = champName.replace(/[^a-zA-Z0-9]/g, "");
      tog.innerHTML = '<img class="cmp-ft-icon" src="' + CHAMP_ICON(ver, cid) + '" onerror="this.style.display=\'none\'" />'
        + '<span class="cmp-ft-text">' + champName + '</span>'
        + '<span class="cmp-ft-arrow">▾</span>';
    } else {
      tog.innerHTML = '<span class="cmp-ft-text">All Champions</span><span class="cmp-ft-arrow">▾</span>';
    }
  }
  _buildDropdownList();
  _renderCompare(champName);
}

function _renderCompare(champName) {
  var a = _cmpA, b = _cmpB;
  var sa = a.solo || {}, sb = b.solo || {};

  var champData = null;
  if (champName) {
    for (var ci = 0; ci < _cmpSharedChamps.length; ci++) {
      if (_cmpSharedChamps[ci].name === champName) { champData = _cmpSharedChamps[ci]; break; }
    }
  }

  function w(av, bv, hi) {
    if (av === bv) return "tie";
    return (hi ? av > bv : av < bv) ? "a" : "b";
  }
  function bars(rawA, rawB) {
    var mn = Math.min(rawA, rawB, 0);
    var av = rawA - mn, bv = rawB - mn, t = av + bv;
    return t === 0 ? { aw: 50, bw: 50 } : { aw: Math.round(av / t * 100), bw: Math.round(bv / t * 100) };
  }

  var stats;
  if (champData) {
    var ca = champData.a, cb = champData.b;
    var aKda = ca.kda === "Perfect" ? 99 : parseFloat(ca.kda) || 0;
    var bKda = cb.kda === "Perfect" ? 99 : parseFloat(cb.kda) || 0;
    stats = [
      { label: "Games Played", rawA: ca.games, rawB: cb.games, hi: true, dA: ca.games, dB: cb.games },
      { label: "Win Rate", rawA: ca.winRate, rawB: cb.winRate, hi: true, dA: ca.winRate + "%", dB: cb.winRate + "%" },
      { label: "KDA", rawA: aKda, rawB: bKda, hi: true, dA: ca.kda, dB: cb.kda },
      { label: "Avg Kills", rawA: parseFloat(ca.avgKills), rawB: parseFloat(cb.avgKills), hi: true, dA: ca.avgKills, dB: cb.avgKills },
      { label: "Avg Deaths", rawA: parseFloat(ca.avgDeaths), rawB: parseFloat(cb.avgDeaths), hi: false, dA: ca.avgDeaths, dB: cb.avgDeaths },
      { label: "Avg Assists", rawA: parseFloat(ca.avgAssists), rawB: parseFloat(cb.avgAssists), hi: true, dA: ca.avgAssists, dB: cb.avgAssists },
      { label: "Avg CS", rawA: ca.avgCs, rawB: cb.avgCs, hi: true, dA: ca.avgCs, dB: cb.avgCs },
      { label: "Avg Damage", rawA: ca.avgDamage, rawB: cb.avgDamage, hi: true, dA: (ca.avgDamage / 1000).toFixed(1) + "k", dB: (cb.avgDamage / 1000).toFixed(1) + "k" },
      { label: "Avg Gold", rawA: ca.avgGold, rawB: cb.avgGold, hi: true, dA: (ca.avgGold / 1000).toFixed(1) + "k", dB: (cb.avgGold / 1000).toFixed(1) + "k" },
      { label: "Avg Vision", rawA: parseFloat(ca.avgVision), rawB: parseFloat(cb.avgVision), hi: true, dA: ca.avgVision, dB: cb.avgVision },
    ];
  } else {
    var aLp = lpToScore(sa.tier, sa.rank, sa.lp);
    var bLp = lpToScore(sb.tier, sb.rank, sb.lp);
    var aWr = sa.winRate || 0, bWr = sb.winRate || 0;
    var aKda = sa.kda === "Perfect" ? 99 : (parseFloat(sa.kda) || 0);
    var bKda = sb.kda === "Perfect" ? 99 : (parseFloat(sb.kda) || 0);
    var aK = parseFloat(sa.kills) || 0, bK = parseFloat(sb.kills) || 0;
    var aD = parseFloat(sa.deaths) || 0, bD = parseFloat(sb.deaths) || 0;
    var aA = parseFloat(sa.assists) || 0, bA = parseFloat(sb.assists) || 0;
    var aGs = (sa.wins || 0) + (sa.losses || 0), bGs = (sb.wins || 0) + (sb.losses || 0);
    var aDiff = (sa.wins || 0) - (sa.losses || 0), bDiff = (sb.wins || 0) - (sb.losses || 0);
    var aDmg = sa.avgDamage || 0, bDmg = sb.avgDamage || 0;
    var aVis = parseFloat(sa.avgVision) || 0, bVis = parseFloat(sb.avgVision) || 0;
    var aCsM = parseFloat(sa.avgCsMin) || 0, bCsM = parseFloat(sb.avgCsMin) || 0;

    stats = [
{ label: "Rank",         rawA: aLp,   rawB: bLp,   hi: true,  dA: sa.tier ? '<div class="cmp-rank-box"><div>' + sa.tier + ' ' + sa.rank + '</div><div class="cmp-lp-text">' + (sa.lp||0) + ' LP</div></div>' : "—", dB: sb.tier ? '<div class="cmp-rank-box"><div>' + sb.tier + ' ' + sb.rank + '</div><div class="cmp-lp-text">' + (sb.lp||0) + ' LP</div></div>' : "—" },      { label: "KDA", rawA: aKda, rawB: bKda, hi: true, dA: sa.kda || "—", dB: sb.kda || "—" },
      { label: "Avg Kills", rawA: aK, rawB: bK, hi: true, dA: sa.kills || "—", dB: sb.kills || "—" },
      { label: "Avg Deaths", rawA: aD, rawB: bD, hi: false, dA: sa.deaths || "—", dB: sb.deaths || "—" },
      { label: "Avg Assists", rawA: aA, rawB: bA, hi: true, dA: sa.assists || "—", dB: sb.assists || "—" },
      { label: "CS / Min", rawA: aCsM, rawB: bCsM, hi: true, dA: aCsM || "—", dB: bCsM || "—" },
      { label: "Avg Damage", rawA: aDmg, rawB: bDmg, hi: true, dA: aDmg ? (aDmg / 1000).toFixed(1) + "k" : "—", dB: bDmg ? (bDmg / 1000).toFixed(1) + "k" : "—" },
      { label: "Vision Score", rawA: aVis, rawB: bVis, hi: true, dA: aVis || "—", dB: bVis || "—" },
      { label: "W / L Diff", rawA: aDiff, rawB: bDiff, hi: true, dA: (aDiff >= 0 ? "+" : "") + aDiff, dB: (bDiff >= 0 ? "+" : "") + bDiff },
      { label: "Games Played", rawA: aGs, rawB: bGs, hi: false, dA: aGs || "—", dB: bGs || "—" },
    ];
  }

  var aWins = 0, bWins = 0;
  stats.forEach(function (s) {
    s.winner = w(s.rawA, s.rawB, s.hi);
    s.bars = bars(s.rawA, s.rawB);
    if (s.winner === "a") aWins++;
    else if (s.winner === "b") bWins++;
  });
  var overall = aWins > bWins ? "a" : bWins > aWins ? "b" : "tie";

  function playerHead(p, s, side) {
    var tk = tc(s.tier);
    var emb = s.tier ? "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-emblem/emblem-" + tk + ".png" : "";
    var wc = side === "a" ? aWins : bWins;
    var leading = (side === "a" ? aWins > bWins : bWins > aWins);
    return '<div class="cmp-player cmp-player-' + side + '">'
      + '<div class="cmp-av-wrap">'
      + '<img class="cmp-avatar" src="' + ICON(p.profileIconId) + '" onerror="this.src=\'' + ICON(1) + '\'" />'
      + (emb ? '<img class="cmp-emblem" src="' + emb + '" />' : '')
      + '</div>'
      + '<div class="cmp-info">'
      + '<div class="cmp-pname">' + p.gameName + '</div>'
      + '<div class="cmp-rank-pill t-' + tk + '">' + (s.tier ? s.tier + ' ' + (s.rank || '') + ' · ' + (s.lp || 0) + ' LP' : 'Unranked') + '</div>'
      + '<div class="cmp-score' + (leading ? ' cmp-score-lead' : '') + '">' + wc + ' / ' + stats.length + '</div>'
      + '</div>'
      + '</div>';
  }

  var rowsHtml = stats.map(function (s, idx) {
    var isA = s.winner === "a", isB = s.winner === "b";
    return '<div class="cmp-row" style="animation-delay:' + (0.06 + idx * 0.04) + 's">'
      + '<div class="cmp-val cmp-val-a' + (isA ? ' val-win' : s.winner === 'tie' ? ' val-tie' : ' val-lose') + '">' + s.dA + '</div>'
      + '<div class="cmp-bars">'
      + '<div class="cmp-half cmp-half-a"><div class="cmp-fill' + (isA ? ' fill-a' : '') + '" id="cmpA' + idx + '"></div></div>'
      + '<div class="cmp-half cmp-half-b"><div class="cmp-fill' + (isB ? ' fill-b' : '') + '" id="cmpB' + idx + '"></div></div>'
      + '</div>'
      + '<div class="cmp-val cmp-val-b' + (isB ? ' val-win' : s.winner === 'tie' ? ' val-tie' : ' val-lose') + '">' + s.dB + '</div>'
      + '<div class="cmp-row-label">' + s.label + '</div>'
      + '</div>';
  }).join("");

  var verdictHtml = overall === "tie"
    ? '<span class="vd-icon">🤝</span><span>Evenly matched</span>'
    : '<span class="vd-icon">🏆</span><strong>' + (overall === "a" ? a.gameName : b.gameName) + '</strong><span>leads ' + (overall === "a" ? aWins : bWins) + ' of ' + stats.length + '</span>';

  // Only replace rows area — keep header + filter intact
  var rowsWrap = document.getElementById("cmpRowsWrap");
  var verdictEl = document.getElementById("cmpVerdict");
  if (rowsWrap && verdictEl) {
    rowsWrap.innerHTML = '<div class="cmp-col-labels"><span>' + a.gameName + '</span><span>' + b.gameName + '</span></div>'
      + '<div class="cmp-rows">' + rowsHtml + '</div>';
    verdictEl.innerHTML = verdictHtml;
    // update header scores
    var scoreEls = document.querySelectorAll(".cmp-score");
    if (scoreEls[0]) { scoreEls[0].textContent = aWins + " / " + stats.length; scoreEls[0].className = "cmp-score" + (aWins > bWins ? " cmp-score-lead" : ""); }
    if (scoreEls[1]) { scoreEls[1].textContent = bWins + " / " + stats.length; scoreEls[1].className = "cmp-score" + (bWins > aWins ? " cmp-score-lead" : ""); }
  } else {
    document.getElementById("compare-content").innerHTML =
      '<div class="cmp-header">'
      + playerHead(a, sa, "a")
      + '<div class="cmp-vs-col"><div class="cmp-vs">VS</div></div>'
      + playerHead(b, sb, "b")
      + '</div>'
      + '<div id="cmpFilter" class="cmp-filter"></div>'
      + '<div class="cmp-rows-wrap" id="cmpRowsWrap"><div class="cmp-col-labels"><span>' + a.gameName + '</span><span>' + b.gameName + '</span></div>'
      + '<div class="cmp-rows">' + rowsHtml + '</div></div>'
      + '<div class="cmp-verdict" id="cmpVerdict">' + verdictHtml + '</div>';
  }

  // animate bars
  setTimeout(function () {
    stats.forEach(function (s, i) {
      setTimeout(function () {
        var elA = document.getElementById("cmpA" + i);
        var elB = document.getElementById("cmpB" + i);
        if (elA) elA.style.width = s.bars.aw + "%";
        if (elB) elB.style.width = s.bars.bw + "%";
      }, i * 45);
    });
  }, 80);
}

document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeCompareModal(); });
document.addEventListener("click", function (e) {
  var dd = document.getElementById("cmpDropdown");
  if (!dd || dd.classList.contains("hidden")) return;
  if (!e.target.closest(".cmp-filter")) {
    dd.classList.add("hidden");
    var tog = document.querySelector(".cmp-filter-toggle");
    if (tog) tog.classList.remove("open");
  }
});

function loadSquad() {
  currentOpenIdx = null;
  renderSkeletons();

  fetch("/squad")
    .then(function (r) { return r.json(); })
    .then(function (data) {
      allData = data.players || [];
      if (data.ddragonVersion) {
        ICON_BASE = "https://ddragon.leagueoflegends.com/cdn/" + data.ddragonVersion + "/img/profileicon/";
      }

      renderBoard();

      // Clear lastUpdated completely
      document.getElementById("lastUpdated").textContent = "";
    })
    .catch(function (e) {
      document.getElementById("board").innerHTML =
        '<div style="text-align:center;color:var(--red);padding:40px">' +
        e.message +
        '</div>';
    });
}

loadSquad();

// ── Countdown Timer & Auto-Reload ──
var _scheduleData = null;
var _countdownTimer = null;
var _reloadScheduled = false;

function pollSchedule() {
  fetch("/schedule")
    .then(function (r) { return r.json(); })
    .then(function (d) {
      _scheduleData = d;
      // Auto-reload when cache is invalidated after deep fetch
      if (d.scheduleReloadAt && !_reloadScheduled) {
        var delay = d.scheduleReloadAt - Date.now();
        if (delay > 0) {
          _reloadScheduled = true;
          setTimeout(function () {
            _reloadScheduled = false;
            loadSquad();
          }, delay + 2000); // small buffer after cache invalidation
        } else if (delay > -5000) {
          // Just happened, reload now
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
  var txt = min + ":" + (sec < 10 ? "0" : "") + sec;
  el.textContent = txt;
  el.className = "h1-timer" + (totalSec <= 60 ? " soon" : "");

  if (totalSec <= 0) {
    el.textContent = "Fetching...";
    el.className = "h1-timer fetching";
  }
}

pollSchedule();
setInterval(pollSchedule, 15000);
_countdownTimer = setInterval(updateCountdown, 1000);

// ── Badge Tooltip Engine ──
(function () {
  var tip = document.createElement("div");
  tip.id = "badge-tip";
  tip.setAttribute("aria-hidden", "true");
  document.body.appendChild(tip);

  var showTimer, hideTimer;
  var currentTarget = null;

  var accentMap = {
    'badge-feeder': '#ef4444',
    'badge-feeder-soft': '#f97316',
    'badge-godlike': '#f59e0b',
    'badge-carry': '#3b82f6',
    'badge-slayer': '#dc2626',
    'badge-hyper': '#7c3aed',
    'badge-support': '#06b6d4',
    'badge-smurf': '#ec4899',
    'badge-climbing': '#10b981',
    'badge-consistent': '#22c55e',
    'badge-hardstuck': '#f97316',
    'badge-trenches': '#94a3b8',
    'badge-grinder': '#94a3b8',
    'badge-fresh': '#34d399',
    'badge-streak': '#fb923c',
    'badge-neutral': '#64748b'
  };

  function show(el) {
    clearTimeout(hideTimer);
    var text = el.getAttribute("data-tip");
    if (!text) return;
    currentTarget = el;

    // Pick accent color from badge class
    var accent = '#8b5cf6';
    var cls = el.className || '';
    for (var key in accentMap) {
      if (cls.indexOf(key) !== -1) { accent = accentMap[key]; break; }
    }

    tip.style.setProperty('--tip-accent', accent);
    tip.innerHTML =
      '<div class="tip-title">' + el.textContent.trim() + '</div>' +
      '<div class="tip-body">' + text + '</div>';
    tip.classList.remove("tip-hide");

    // Position
    var rect = el.getBoundingClientRect();
    var scrollY = window.scrollY || document.documentElement.scrollTop;
    var scrollX = window.scrollX || document.documentElement.scrollLeft;

    tip.style.visibility = "hidden";
    tip.style.display = "block";
    var tw = tip.offsetWidth;
    var th = tip.offsetHeight;
    tip.style.display = "";
    tip.style.visibility = "";

    var left = rect.left + scrollX + rect.width / 2 - tw / 2;
    var top = rect.top + scrollY - th - 10;

    // Clamp horizontally
    var margin = 12;
    left = Math.max(margin, Math.min(left, window.innerWidth - tw - margin));

    // Flip below if not enough room above
    if (top < scrollY + 8) {
      top = rect.bottom + scrollY + 10;
      tip.classList.add("tip-below");
    } else {
      tip.classList.remove("tip-below");
    }

    tip.style.left = left + "px";
    tip.style.top = top + "px";

    showTimer = setTimeout(function () { tip.classList.add("tip-show"); }, 10);
  }

  function hide() {
    clearTimeout(showTimer);
    tip.classList.remove("tip-show");
    hideTimer = setTimeout(function () { currentTarget = null; }, 220);
  }

  document.addEventListener("mouseover", function (e) {
    var el = e.target.closest("[data-tip]");
    if (el && el !== currentTarget) show(el);
  });
  document.addEventListener("mouseout", function (e) {
    var el = e.target.closest("[data-tip]");
    if (el) hide();
  });
  document.addEventListener("touchstart", function (e) {
    var el = e.target.closest("[data-tip]");
    if (el) { show(el); setTimeout(hide, 2400); }
  }, { passive: true });
})();

// ── Game Tooltip ──────────────────────────────────────────────
var _tipHideTimer = null;

function showGameTooltip(gameIdx, playerIdx, el) {
  clearTimeout(_tipHideTimer);
  var p = allData[playerIdx];
  if (!p) return;
  var ck = (p.gameName + "#" + p.tagLine).toLowerCase();
  var games = _rgCache[ck];
  if (!games || !games.length) return;

  var g = games[gameIdx];
  var ver = (p && p.topChamp) ? p.topChamp.version : "14.10.1";
  var champId = g.champion ? g.champion.replace(/[^a-zA-Z0-9]/g, "") : "";

  var kdaNum = g.deaths === 0 ? null : (g.kills + g.assists) / g.deaths;
  var kdaCol = kdaNum === null || kdaNum >= 3 ? "#30d158" : kdaNum >= 1.5 ? "#ff9f0a" : "#ff453a";
  var mins = Math.floor(g.duration / 60);
  var secs = g.duration % 60;
  var dur = mins + "m " + (secs < 10 ? "0" : "") + secs + "s";
  var dt = new Date(g.ts);
  var dateStr = dt.toLocaleDateString([], { month: "short", day: "numeric" });
  var role = ROLE_LABELS[g.role] || g.role || "—";
  var colHex = g.win ? "#30d158" : "#ff453a";
  var csMin = g.duration > 0 ? (g.cs / (g.duration / 60)).toFixed(1) : "0";

  var allGs = games;
  var maxCs = Math.max.apply(null, allGs.map(function (x) { return x.cs || 0; })) || 1;
  var maxDmg = Math.max.apply(null, allGs.map(function (x) { return x.damage || 0; })) || 1;
  var maxGold = Math.max.apply(null, allGs.map(function (x) { return x.gold || 0; })) || 1;
  var csPct = Math.round(((g.cs || 0) / maxCs) * 100);
  var dmgPct = Math.round(((g.damage || 0) / maxDmg) * 100);
  var goldPct = Math.round(((g.gold || 0) / maxGold) * 100);

  var loadingUrl = "https://ddragon.leagueoflegends.com/cdn/img/champion/loading/" + champId + "_0.jpg";

  var tip = document.getElementById("gm-tooltip");
  tip.innerHTML =
    '<div class="tip-splash">'
    + '<div class="tip-splash-bg" style="background-image:url(\'' + loadingUrl + '\')"></div>'
    + '<div class="tip-splash-ov"></div>'
    + '<div class="tip-result-word" style="color:' + colHex + '">' + (g.win ? "VICTORY" : "DEFEAT") + '</div>'
    + '<div class="tip-header">'
    + '<img class="tip-icon" src="' + CHAMP_ICON(ver, champId) + '" style="border-color:' + colHex + '88" onerror="this.src=\'\'" />'
    + '<div>'
    + '<div class="tip-champ">' + (g.champion || "—") + '</div>'
    + '<div class="tip-meta">' + role + ' · ' + dur + ' · ' + dateStr + '</div>'
    + '</div>'
    + '</div>'
    + '</div>'
    + '<div class="tip-body">'
    + '<div class="tip-kda-row">'
    + '<span class="tip-kn tip-k" id="tipK">0</span>'
    + '<span class="tip-sep">/</span>'
    + '<span class="tip-kn tip-d" id="tipD">0</span>'
    + '<span class="tip-sep">/</span>'
    + '<span class="tip-kn tip-a" id="tipA">0</span>'
    + '<div class="tip-kda-badge" style="color:' + kdaCol + '"><span id="tipKdaN">' + (kdaNum === null ? "Perfect" : "0.00") + '</span> KDA</div>'
    + '</div>'
    + '<div class="tip-bars">'
    + '<div class="tip-bar-row"><span class="tip-bar-lbl">CS</span><div class="tip-bar-track"><div class="tip-bar-fill tip-bar-y" id="tipBcs"></div></div><span class="tip-bar-val"><span id="tipCs">0</span><span class="tip-bar-sub"> (' + csMin + '/m)</span></span></div>'
    + '<div class="tip-bar-row"><span class="tip-bar-lbl">DMG</span><div class="tip-bar-track"><div class="tip-bar-fill tip-bar-r" id="tipBdmg"></div></div><span class="tip-bar-val" id="tipDmg">0k</span></div>'
    + '<div class="tip-bar-row"><span class="tip-bar-lbl">Gold</span><div class="tip-bar-track"><div class="tip-bar-fill tip-bar-g" id="tipBgold"></div></div><span class="tip-bar-val" id="tipGold">0k</span></div>'
    + '</div>'
    + '<div class="tip-footer">'
    + '<span class="tip-footer-item"><span style="color:#64d2ff" id="tipVis">0</span> Vision</span>'
    + (g.pentas > 0 ? '<span class="tip-footer-item tip-penta">🏆 Pentakill' + (g.pentas > 1 ? " ×" + g.pentas : "") + '</span>' : '')
    + '</div>'
    + '</div>';

  // Position above the hovered element, centered
  var rect = el.getBoundingClientRect();
  var tipW = 285;
  var left = rect.left + rect.width / 2 - tipW / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - tipW - 8));
  tip.style.left = left + "px";
  tip.style.top = rect.top + "px";

  tip.className = "gm-tooltip";

  setTimeout(function () {
    var bc = document.getElementById("tipBcs");
    var bd = document.getElementById("tipBdmg");
    var bg = document.getElementById("tipBgold");
    if (bc) bc.style.width = csPct + "%";
    if (bd) bd.style.width = dmgPct + "%";
    if (bg) bg.style.width = goldPct + "%";
    _gmCountInt("tipK", g.kills, 360);
    _gmCountInt("tipD", g.deaths, 360);
    _gmCountInt("tipA", g.assists, 360);
    if (kdaNum !== null) _gmCountDec("tipKdaN", kdaNum, 440);
    _gmCountInt("tipCs", g.cs || 0, 460);
    _gmCountK("tipDmg", g.damage || 0, 480);
    _gmCountK("tipGold", g.gold || 0, 480);
    _gmCountInt("tipVis", g.vision || 0, 460);
  }, 30);
}

function hideGameTooltip() {
  _tipHideTimer = setTimeout(function () {
    var tip = document.getElementById("gm-tooltip");
    if (!tip || tip.classList.contains("hidden")) return;
    tip.classList.add("tip-hiding");
    setTimeout(function () {
      tip.className = "gm-tooltip hidden";
    }, 160);
  }, 80);
}

// ── Count-up utilities ────────────────────────────────────────
function _DEAD_START() {
  var kdaNum = 0, kdaCol = "", g = {}, champId = "", ver = "";
  var mins = Math.floor(g.duration / 60);
  var secs = g.duration % 60;
  var dur = mins + "m " + (secs < 10 ? "0" : "") + secs + "s";
  var dt = new Date(g.ts);
  var dateStr = dt.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  var timeStr = dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  var role = ROLE_LABELS[g.role] || g.role || "—";
  var colHex = g.win ? "#30d158" : "#ff453a";
  var csMin = g.duration > 0 ? (g.cs / (g.duration / 60)).toFixed(1) : "0";

  // Best KDA game across the 5
  var bestIdx = 0, bestKda = -1;
  for (var bi = 0; bi < _gmGames.length; bi++) {
    var bk = _gmGames[bi].deaths === 0 ? 999 : (_gmGames[bi].kills + _gmGames[bi].assists) / _gmGames[bi].deaths;
    if (bk > bestKda) { bestKda = bk; bestIdx = bi; }
  }
  var isBest = (_gmIdx === bestIdx && _gmGames.length > 1);

  // Relative bar widths (vs max across 5 games)
  var maxCs = Math.max.apply(null, _gmGames.map(function (x) { return x.cs || 0; })) || 1;
  var maxDmg = Math.max.apply(null, _gmGames.map(function (x) { return x.damage || 0; })) || 1;
  var maxGold = Math.max.apply(null, _gmGames.map(function (x) { return x.gold || 0; })) || 1;
  var csPct = Math.round(((g.cs || 0) / maxCs) * 100);
  var dmgPct = Math.round(((g.damage || 0) / maxDmg) * 100);
  var goldPct = Math.round(((g.gold || 0) / maxGold) * 100);

  // Arrow states
  document.getElementById("gmPrev").disabled = (_gmIdx === 0);
  document.getElementById("gmNext").disabled = (_gmIdx === _gmGames.length - 1);

  // URLs
  var splashUrl = "https://ddragon.leagueoflegends.com/cdn/img/champion/splash/" + champId + "_0.jpg";
  var loadingUrl = "https://ddragon.leagueoflegends.com/cdn/img/champion/loading/" + champId + "_0.jpg";

  // Panel result glow
  var panel = document.getElementById("gmPanel");
  if (panel) {
    panel.style.border = "1px solid " + (g.win ? "rgba(48,209,88,0.38)" : "rgba(255,69,58,0.38)");
    panel.style.boxShadow = "0 48px 120px rgba(0,0,0,0.95), 0 0 0 1px rgba(255,255,255,0.04), 0 0 70px -10px " + (g.win ? "rgba(48,209,88,0.28)" : "rgba(255,69,58,0.28)");
  }

  // ── Build HTML ──
  document.getElementById("gmContent").innerHTML =

    // Splash hero
    '<div class="gm-splash">'
    + '<div class="gm-splash-bg" style="background-image:url(\'' + splashUrl + '\')"></div>'
    + '<div class="gm-splash-overlay"></div>'
    + '<img class="gm-loading-art" src="' + loadingUrl + '" alt="" />'
    + '<div class="gm-splash-glow" style="background:' + colHex + '"></div>'
    + '<div class="gm-result-overlay" style="color:' + colHex + '">' + (g.win ? "VICTORY" : "DEFEAT") + '</div>'
    + '<button class="gm-close-btn" onclick="closeGameModal()">✕</button>'
    + '<div class="gm-splash-content">'
    + '<img class="gm-avatar" src="' + CHAMP_ICON(ver, champId) + '" style="border-color:' + colHex + '99" />'
    + '<div class="gm-hero-text">'
    + '<div class="gm-hero-name">' + (g.champion || "—") + (isBest ? '<span class="gm-best-chip">★ Best</span>' : '') + '</div>'
    + '<div class="gm-hero-meta">' + role + ' · ' + dur + ' · ' + dateStr + ' · ' + timeStr + '</div>'
    + '</div>'
    + '</div>'
    + '</div>'

    // Body
    + '<div class="gm-body-inner">'

    // 4-box stat row
    + '<div class="gm-stat-row">'
    + '<div class="gm-stat-box gm-stat-k" style="--delay:0s">'
    + '<div class="gm-stat-val" id="gmK">0</div>'
    + '<div class="gm-stat-lbl">Kills</div>'
    + '</div>'
    + '<div class="gm-stat-box gm-stat-d" style="--delay:0.07s">'
    + '<div class="gm-stat-val" id="gmD">0</div>'
    + '<div class="gm-stat-lbl">Deaths</div>'
    + '</div>'
    + '<div class="gm-stat-box gm-stat-a" style="--delay:0.14s">'
    + '<div class="gm-stat-val" id="gmA">0</div>'
    + '<div class="gm-stat-lbl">Assists</div>'
    + '</div>'
    + '<div class="gm-stat-box gm-stat-kda" style="--delay:0.21s">'
    + '<div class="gm-stat-val" style="color:' + kdaCol + '" id="gmKda">' + (kdaNum === null ? "Perfect" : "0.00") + '</div>'
    + '<div class="gm-stat-lbl">KDA</div>'
    + '</div>'
    + '</div>'

    // 3 Bars: CS / Damage / Gold
    + '<div class="gm-bars">'
    + '<div class="gm-bar-row">'
    + '<span class="gm-bar-lbl">CS</span>'
    + '<div class="gm-bar-track"><div class="gm-bar-fill gm-bar-yellow" id="gmBarCs"></div></div>'
    + '<span class="gm-bar-val"><span id="gmCsNum">0</span><span class="gm-bar-sub"> (' + csMin + '/m)</span></span>'
    + '</div>'
    + '<div class="gm-bar-row">'
    + '<span class="gm-bar-lbl">DMG</span>'
    + '<div class="gm-bar-track"><div class="gm-bar-fill gm-bar-red" id="gmBarDmg"></div></div>'
    + '<span class="gm-bar-val" id="gmDmgVal">0k</span>'
    + '</div>'
    + '<div class="gm-bar-row">'
    + '<span class="gm-bar-lbl">Gold</span>'
    + '<div class="gm-bar-track"><div class="gm-bar-fill gm-bar-gold" id="gmBarGold"></div></div>'
    + '<span class="gm-bar-val" id="gmGoldVal">0k</span>'
    + '</div>'
    + '</div>'

    // Mini stats: Vision + Pentas
    + '<div class="gm-mini-stats">'
    + '<div class="gm-mini"><div class="gm-mini-val" style="color:var(--accent)" id="gmVis">0</div><div class="gm-mini-lbl">Vision Score</div></div>'
    + '<div class="gm-mini"><div class="gm-mini-val" style="color:' + (g.pentas > 0 ? "var(--orange)" : "var(--text3)") + '">' + (g.pentas > 0 ? "🏆 " + g.pentas : "—") + '</div><div class="gm-mini-lbl">Pentakills</div></div>'
    + '</div>'
    + '</div>'; // gm-body-inner

  // ── Navigation strip ──
  var strip = "";
  for (var si = 0; si < _gmGames.length; si++) {
    var sg = _gmGames[si];
    var sc = sg.champion ? sg.champion.replace(/[^a-zA-Z0-9]/g, "") : "";
    strip += '<div class="gm-strip-item ' + (si === _gmIdx ? "active " : "") + (sg.win ? "strip-w" : "strip-l") + '" onclick="navToGame(' + si + ')">'
      + '<img src="' + CHAMP_ICON(ver, sc) + '" />'
      + '<div class="gm-strip-pip"></div>'
      + '</div>';
  }
  document.getElementById("gmStrip").innerHTML = strip;

  // ── Animate ──
  setTimeout(function () {
    var bc = document.getElementById("gmBarCs");
    var bd = document.getElementById("gmBarDmg");
    var bg = document.getElementById("gmBarGold");
    if (bc) bc.style.width = csPct + "%";
    if (bd) bd.style.width = dmgPct + "%";
    if (bg) bg.style.width = goldPct + "%";
    _gmCountInt("gmK", g.kills, 480);
    _gmCountInt("gmD", g.deaths, 480);
    _gmCountInt("gmA", g.assists, 480);
    if (kdaNum !== null) _gmCountDec("gmKda", kdaNum, 580);
    _gmCountInt("gmCsNum", g.cs || 0, 620);
    _gmCountK("gmDmgVal", g.damage || 0, 650);
    _gmCountK("gmGoldVal", g.gold || 0, 650);
    _gmCountInt("gmVis", g.vision || 0, 650);
  }, 50);
}

function _gmCountInt(id, target, dur) {
  var el = document.getElementById(id); if (!el) return;
  var t0 = performance.now();
  (function tick(now) {
    var t = Math.min((now - t0) / dur, 1), e = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(e * target);
    if (t < 1) requestAnimationFrame(tick);
  })(t0);
}
function _gmCountDec(id, target, dur) {
  var el = document.getElementById(id); if (!el) return;
  var t0 = performance.now();
  (function tick(now) {
    var t = Math.min((now - t0) / dur, 1), e = 1 - Math.pow(1 - t, 3);
    el.textContent = (e * target).toFixed(2);
    if (t < 1) requestAnimationFrame(tick);
  })(t0);
}
function _gmCountK(id, target, dur) {
  var el = document.getElementById(id); if (!el) return;
  var t0 = performance.now();
  (function tick(now) {
    var t = Math.min((now - t0) / dur, 1), e = 1 - Math.pow(1 - t, 3);
    el.textContent = (e * target / 1000).toFixed(1) + "k";
    if (t < 1) requestAnimationFrame(tick);
  })(t0);
}


