var allData = [];
var currentOpenIdx = null;
var compareSelection = [];

var ROLE_LABELS = { TOP: "Top", JUNGLE: "Jungle", MIDDLE: "Mid", BOTTOM: "Bot", UTILITY: "Support" };
var ROLE_ICONS  = { TOP: "⚔", JUNGLE: "🌲", MIDDLE: "✦", BOTTOM: "🏹", UTILITY: "🛡" };

var TIER_SCORES = { IRON:0, BRONZE:400, SILVER:800, GOLD:1200, PLATINUM:1600, EMERALD:2000, DIAMOND:2400, MASTER:2800, GRANDMASTER:3200, CHALLENGER:3600 };
var RANK_SCORES = { IV:0, III:100, II:200, I:300 };
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

function renderDetail(p) {
  if (!p.solo) return "";
  var s = p.solo;
  var games = s.wins + s.losses;
  var winDiff = s.wins - s.losses;
  var diffColor = winDiff >= 0 ? "var(--green)" : "var(--red)";
  var diffLabel = winDiff >= 0 ? "Positive record" : "Negative record";
  var tierColor = "var(--tier-" + tc(s.tier) + ", var(--accent))";
  
  // Tier Emblem from community assets
  var tierEmblem = "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-emblem/emblem-" + tc(s.tier) + ".png";

  var champHTML = "";
  if (p.topChamp) {
    champHTML = '<div class="stat-box signature-box">'
      + '<div class="st-label">Signature Pick</div>'
      + '<div class="sig-content">'
      +   '<img src="' + CHAMP_ICON(p.topChamp.version, p.topChamp.id) + '" />'
      +   '<div><div class="st-val">' + p.topChamp.name + '</div>'
      +   '<div class="st-sub" style="color:var(--yellow)">' + formatMastery(p.topChamp.points) + ' Pts</div></div>'
      + '</div></div>';
  }

  return '<div class="detail-panel-inner">'
    + '<div class="detail-header">'
    +   '<div class="detail-icon"><img src="' + ICON(p.profileIconId) + '" /></div>'
    +   '<div class="detail-name"><h3>' + p.gameName + ' <span>#' + p.tagLine + '</span></h3><p>Solo / Duo Ranked</p></div>'
    +   '<div class="detail-tier-badge">'
    +     '<div class="tier-emblem-clip"><img src="' + tierEmblem + '" class="tier-emblem-large" /></div>'
    +     '<div><div class="dtier t-' + tc(s.tier) + '">' + s.tier + ' ' + s.rank + '</div>'
    +     '<div style="font-size:0.9rem;color:var(--text);font-weight:700">' + s.lp + ' LP</div></div>'
    +   '</div>'
    + '</div>'
    + '<div class="stat-grid">'
    +   champHTML
    +   '<div class="stat-box"><div class="st-label">Win Rate</div><div class="st-val" style="color:' + wrHex(s.winRate) + '">' + s.winRate + '%</div><div class="prog-bar"><div class="prog-fill" style="width:' + s.winRate + '%;background:' + wrHex(s.winRate) + '"></div></div><div class="st-sub">' + wrLabel(s.winRate) + '</div></div>'
    +   '<div class="stat-box"><div class="st-label">Total Games</div><div class="st-val">' + games + '</div><div class="st-sub">Solo / Duo queue</div></div>'
    +   '<div class="stat-box"><div class="st-label">W/L Diff</div><div class="st-val" style="color:' + diffColor + '">' + (winDiff >= 0 ? "+" : "") + winDiff + '</div><div class="st-sub">' + diffLabel + '</div></div>'
    +   '<div class="stat-box"><div class="st-label">Avg Kills</div><div class="st-val" style="color:var(--green)">' + (s.kills || "0.0") + '</div><div class="st-sub">All stored games</div></div>'
    +   '<div class="stat-box"><div class="st-label">Avg Deaths</div><div class="st-val" style="color:var(--red)">' + (s.deaths || "0.0") + '</div><div class="st-sub">All stored games</div></div>'
    +   '<div class="stat-box"><div class="st-label">Avg Assists</div><div class="st-val">' + (s.assists || "0.0") + '</div><div class="st-sub">All stored games</div></div>'
    +   '<div class="stat-box"><div class="st-label">KDA Ratio</div><div class="st-val" style="color:var(--orange)">' + (s.kda || "0.00") + '</div><div class="st-sub">All stored games</div></div>'
    +   (s.topRole ? '<div class="stat-box"><div class="st-label">Main Role</div><div class="st-val" style="color:var(--accent)">' + (ROLE_ICONS[s.topRole] || "") + ' ' + (ROLE_LABELS[s.topRole] || s.topRole) + '</div><div class="st-sub">All stored games</div></div>' : '')
    +   (s.avgCsMin ? '<div class="stat-box"><div class="st-label">CS / Min</div><div class="st-val" style="color:var(--yellow)">' + s.avgCsMin + '</div><div class="st-sub">Farming efficiency</div></div>' : '')
    +   (s.avgVision ? '<div class="stat-box"><div class="st-label">Vision Score</div><div class="st-val" style="color:var(--accent)">' + s.avgVision + '</div><div class="st-sub">Avg per game</div></div>' : '')
    +   (s.avgDamage ? '<div class="stat-box"><div class="st-label">Avg Damage</div><div class="st-val">' + formatMastery(s.avgDamage) + '</div><div class="st-sub">To champions</div></div>' : '')
    +   (s.avgDuration ? '<div class="stat-box"><div class="st-label">Game Length</div><div class="st-val" style="color:var(--text)">' + s.avgDuration + ' min</div><div class="st-sub">' + (s.avgDuration <= 25 ? "Fast games" : s.avgDuration <= 33 ? "Average length" : "Long games") + '</div></div>' : '')
    +   (s.totalTimeSecs ? (function() { var d = Math.floor(s.totalTimeSecs / 86400); var h = Math.floor((s.totalTimeSecs % 86400) / 3600); var label = d > 0 ? d + "d " + h + "h" : h + "h " + Math.floor((s.totalTimeSecs % 3600) / 60) + "m"; return '<div class="stat-box"><div class="st-label">Time Played</div><div class="st-val" style="color:var(--text)">' + label + '</div><div class="st-sub">This season</div></div>'; })() : '')
    +   (s.totalKills   ? '<div class="stat-box"><div class="st-label">Total Kills</div><div class="st-val" style="color:var(--green)">'  + s.totalKills   + '</div><div class="st-sub">This season</div></div>' : '')
    +   (s.totalAssists ? '<div class="stat-box"><div class="st-label">Total Assists</div><div class="st-val" style="color:var(--accent)">' + s.totalAssists + '</div><div class="st-sub">This season</div></div>' : '')
    +   (s.totalDeaths  ? '<div class="stat-box"><div class="st-label">Total Deaths</div><div class="st-val" style="color:var(--red)">'    + s.totalDeaths  + '</div><div class="st-sub">This season</div></div>' : '')
    +   (s.pentas != null ? '<div class="stat-box"><div class="st-label">Total Pentas</div><div class="st-val" style="color:' + (s.pentas > 0 ? 'var(--orange)' : 'var(--text)') + '">' + (s.pentas > 0 ? '🏆 ' : '') + s.pentas + '</div><div class="st-sub">' + (s.pentas > 0 ? 'This season' : 'None yet this season') + '</div></div>' : '')
    +   (s.streak       ? '<div class="stat-box"><div class="st-label">Current Streak</div><div class="st-val" style="color:' + (s.streak > 0 ? "var(--green)" : "var(--red)") + '">' + (s.streak > 0 ? "🔥 " + s.streak + "W" : "💀 " + Math.abs(s.streak) + "L") + '</div><div class="st-sub">' + (s.streak > 0 ? "On a roll" : "Rough patch") + '</div></div>' : '')
    +   (s.bestStreak   ? '<div class="stat-box"><div class="st-label">Best Streak</div><div class="st-val" style="color:var(--green)">🔥 ' + s.bestStreak + 'W</div><div class="st-sub">Longest win run</div></div>' : '')
    +   (s.bestLStreak  ? '<div class="stat-box"><div class="st-label">Worst Streak</div><div class="st-val" style="color:var(--red)">💀 ' + s.bestLStreak + 'L</div><div class="st-sub">Longest loss run</div></div>' : '')
    +   (s.topCachedChamp ? '<div class="stat-box"><div class="st-label">Season Spam</div><div class="st-val" style="color:var(--orange)">' + s.topCachedChamp.name + '</div><div class="st-sub">' + s.topCachedChamp.games + ' games · ' + s.topCachedChamp.winRate + '% WR</div></div>' : '')
    + '</div>'
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

  var detailStr = '<div class="detail-wrapper"><div class="detail-inner">' + renderDetail(p) + '</div></div>';

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
}

function renderSkeletons() {
  var skels = "";
  for (var i = 0; i < 8; i++) skels += '<div class="skeleton"><div class="skel-block" style="width:28px;height:28px;border-radius:50%;flex-shrink:0"></div><div class="skel-block" style="width:44px;height:44px;border-radius:12px;flex-shrink:0"></div><div style="flex:1;display:flex;flex-direction:column;gap:6px"><div class="skel-block" style="height:14px;width:55%"></div><div class="skel-block" style="height:10px;width:30%"></div></div><div class="skel-block" style="width:70px;height:28px;margin-left:auto"></div></div>';
  document.getElementById("board").innerHTML = skels;
}

// ── Per-Player Panel Fetch ──
function startPlayerFetch(gameName, tagLine) {
  fetch("/fetch-history/" + encodeURIComponent(gameName) + "/" + encodeURIComponent(tagLine), { method: "POST" })
    .then(function(r) { return r.json(); })
    .then(function() { pollFetchStatus(); });
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
    .then(function(r) { return r.json(); })
    .then(function() { pollFetchStatus(); });
}

function stopFetch() {
  fetch("/fetch-history", { method: "DELETE" })
    .then(function() { pollFetchStatus(); });
}

function pollFetchStatus() {
  clearTimeout(_fetchPollTimer);
  fetch("/fetch-status")
    .then(function(r) { return r.json(); })
    .then(function(data) {
      renderFetchStatus(data);
      if (data.running) _fetchPollTimer = setTimeout(pollFetchStatus, 2500);
    })
    .catch(function() {});
}

function renderFetchStatus(data) {
  var startBtn = document.getElementById("fetchStartBtn");
  var stopBtn  = document.getElementById("fetchStopBtn");
  var label    = document.getElementById("fetchStatusLabel");

  if (data.running) {
    startBtn.style.display = "none";
    stopBtn.style.display  = "";
    label.textContent = "Running…";
    label.style.color = "var(--green)";
  } else {
    startBtn.style.display = "";
    stopBtn.style.display  = "none";
    label.textContent = data.startedAt ? "Idle" : "";
    label.style.color = "var(--text3)";
  }

  // Progress list — always show all players
  var STATUS_ICON  = { idle: "○", starting: "⟳", fetching: "⟳", done: "✓", error: "✕" };
  var STATUS_COLOR = { idle: "var(--text3)", starting: "var(--orange)", fetching: "var(--accent)", done: "var(--green)", error: "var(--red)" };
  var listHtml = "";
  var players = allData.length ? allData : [];
  for (var i = 0; i < players.length; i++) {
    var pl   = players[i];
    var key  = (pl.gameName + "#" + pl.tagLine).toLowerCase();
    var prog = data.progress && data.progress[key];
    var st   = prog ? prog.status : "idle";
    var icon  = STATUS_ICON[st]  || "○";
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
    logEl.innerHTML = data.log.slice().reverse().map(function(l) {
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

function showCompareModal() {
  var a = allData[compareSelection[0]], b = allData[compareSelection[1]];
  document.getElementById("compare-content").innerHTML = renderCompareContent(a, b);
  document.getElementById("compare-modal").classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeCompareModal() {
  document.getElementById("compare-modal").classList.add("hidden");
  document.body.style.overflow = "";
  compareSelection.forEach(function(idx) {
    var c = document.getElementById("player-card-" + idx);
    if (c) c.classList.remove("compare-selected");
  });
  compareSelection = [];
}

function renderCompareContent(a, b) {
  var sa = a.solo || {}, sb = b.solo || {};

  function cval(v) { return v !== undefined && v !== null ? v : "—"; }
  function kdaNum(k) { return k === "Perfect" ? 99 : (parseFloat(k) || 0); }
  function winner(av, bv, higherBetter) {
    if (av === null || av === undefined || bv === null || bv === undefined) return "";
    if (av === bv) return "tie";
    return (higherBetter ? av > bv : av < bv) ? "a" : "b";
  }

  function row(label, aDisplay, bDisplay, w) {
    return '<div class="cmp-row">'
      + '<div class="cmp-val' + (w === "a" ? " cmp-win" : (w === "tie" ? " cmp-tie" : "")) + '">' + cval(aDisplay) + '</div>'
      + '<div class="cmp-label">' + label + '</div>'
      + '<div class="cmp-val' + (w === "b" ? " cmp-win" : (w === "tie" ? " cmp-tie" : "")) + '">' + cval(bDisplay) + '</div>'
      + '</div>';
  }

  function playerHead(p, s) {
    var tierEmblem = s.tier ? "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-emblem/emblem-" + tc(s.tier) + ".png" : "";
    return '<div class="cmp-player">'
      + '<img class="cmp-icon" src="' + ICON(p.profileIconId) + '" />'
      + '<div class="cmp-pname">' + p.gameName + '<span>#' + p.tagLine + '</span></div>'
      + (s.tier ? '<div class="cmp-rank t-' + tc(s.tier) + '">' + s.tier + ' ' + (s.rank || "") + ' · ' + (s.lp || 0) + ' LP</div>' : '<div class="cmp-rank">Unranked</div>')
      + '</div>';
  }

  var aLp = lpToScore(sa.tier, sa.rank, sa.lp);
  var bLp = lpToScore(sb.tier, sb.rank, sb.lp);
  var aEst = sa.lpEstimate || 0, bEst = sb.lpEstimate || 0;

  return '<div class="cmp-header">'
    + playerHead(a, sa)
    + '<div class="cmp-vs">VS</div>'
    + playerHead(b, sb)
    + '</div>'
    + '<div class="cmp-body">'
    + row("Overall Rank", sa.tier ? sa.tier + " " + sa.rank : "Unranked", sb.tier ? sb.tier + " " + sb.rank : "Unranked", winner(aLp, bLp, true))
    + row("Win Rate", sa.winRate ? sa.winRate + "%" : "—", sb.winRate ? sb.winRate + "%" : "—", winner(sa.winRate, sb.winRate, true))
    + row("Total Games", (sa.wins||0)+(sa.losses||0) || "—", (sb.wins||0)+(sb.losses||0) || "—", "")
    + row("W/L Diff", sa.wins !== undefined ? (sa.wins-sa.losses >= 0 ? "+" : "") + (sa.wins-sa.losses) : "—", sb.wins !== undefined ? (sb.wins-sb.losses >= 0 ? "+" : "") + (sb.wins-sb.losses) : "—", winner(sa.wins-sa.losses, sb.wins-sb.losses, true))
    + row("Avg Kills", sa.kills || "—", sb.kills || "—", winner(parseFloat(sa.kills), parseFloat(sb.kills), true))
    + row("Avg Deaths", sa.deaths || "—", sb.deaths || "—", winner(parseFloat(sa.deaths), parseFloat(sb.deaths), false))
    + row("Avg Assists", sa.assists || "—", sb.assists || "—", winner(parseFloat(sa.assists), parseFloat(sb.assists), true))
    + row("KDA", sa.kda || "—", sb.kda || "—", winner(kdaNum(sa.kda), kdaNum(sb.kda), true))
    + row("Est. LP/10", sa.lpEstimate !== null && sa.lpEstimate !== undefined ? (aEst > 0 ? "+" : "") + aEst : "—", sb.lpEstimate !== null && sb.lpEstimate !== undefined ? (bEst > 0 ? "+" : "") + bEst : "—", winner(aEst, bEst, true))
    + row("Main Role", sa.topRole ? (ROLE_ICONS[sa.topRole] || "") + " " + (ROLE_LABELS[sa.topRole] || sa.topRole) : "—", sb.topRole ? (ROLE_ICONS[sb.topRole] || "") + " " + (ROLE_LABELS[sb.topRole] || sb.topRole) : "—", "")
    + row("Sig. Champion", a.topChamp ? a.topChamp.name : "—", b.topChamp ? b.topChamp.name : "—", "")
    + '</div>';
}

document.addEventListener("keydown", function(e) { if (e.key === "Escape") closeCompareModal(); });

document.getElementById("refreshBtn").addEventListener("click", function () {
  loadSquad();
});

function loadSquad() {
  var btn = document.getElementById("refreshBtn");
  btn.classList.add("loading");
  currentOpenIdx = null;
  renderSkeletons();
  
  fetch("/squad")
    .then(function(r) { return r.json(); })
    .then(function(data) {
      allData = data.players || [];
      renderBoard();
      
      if (data.cachedAt) {
        var cachedTime = new Date(data.cachedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        document.getElementById("lastUpdated").innerHTML = 'Cached at <span style="color:var(--text)">' + cachedTime + '</span>';
      } else {
        document.getElementById("lastUpdated").textContent = "Last updated " + new Date().toLocaleTimeString();
      }
    })
    .catch(function(e) { document.getElementById("board").innerHTML = '<div style="text-align:center;color:var(--red);padding:40px">' + e.message + '</div>'; })
    .finally(function() {
      btn.classList.remove("loading");
    });
}

loadSquad();

// ── Badge Tooltip Engine ──
(function () {
  var tip = document.createElement("div");
  tip.id = "badge-tip";
  tip.setAttribute("aria-hidden", "true");
  document.body.appendChild(tip);

  var showTimer, hideTimer;
  var currentTarget = null;

  var accentMap = {
    'badge-feeder':      '#ef4444',
    'badge-feeder-soft': '#f97316',
    'badge-godlike':     '#f59e0b',
    'badge-carry':       '#3b82f6',
    'badge-slayer':      '#dc2626',
    'badge-hyper':       '#7c3aed',
    'badge-support':     '#06b6d4',
    'badge-smurf':       '#ec4899',
    'badge-climbing':    '#10b981',
    'badge-consistent':  '#22c55e',
    'badge-hardstuck':   '#f97316',
    'badge-trenches':    '#94a3b8',
    'badge-grinder':     '#94a3b8',
    'badge-fresh':       '#34d399',
    'badge-streak':      '#fb923c',
    'badge-neutral':     '#64748b'
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
    var top  = rect.top  + scrollY - th - 10;

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
    tip.style.top  = top  + "px";

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

