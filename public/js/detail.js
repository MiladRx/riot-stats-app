function renderDetail(p, i) {
  if (!p.solo) return "";
  var s = p.solo;
  var games = s.wins + s.losses;
  var winDiff = s.wins - s.losses;
  var tierKey = tc(s.tier);
  var tierEmblem = "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-emblem/emblem-" + tierKey + ".png";

  var seasonLabel = p.season ? "Season " + p.season : "This season";
  var timePlayed = "";
  if (s.totalTimeSecs) {
    var _d = Math.floor(s.totalTimeSecs / 86400);
    var _h = Math.floor((s.totalTimeSecs % 86400) / 3600);
    timePlayed = _d > 0 ? _d + "d " + _h + "h" : _h + "h " + Math.floor((s.totalTimeSecs % 3600) / 60) + "m";
  }

  return '<div class="detail-panel-inner">'

    // Hero Header
    + '<div class="detail-hero">'
    + '<div class="dh-left">'
    + '<img class="dh-avatar" src="' + ICON(p.profileIconId) + '" onerror="this.src=\'' + ICON(1) + '\'" />'
    + '<div class="dh-info">'
    + '<div class="dh-name">' + p.gameName + ' <span>#' + p.tagLine + '</span></div>'
    + '<div class="dh-sub">' + (p.cached ? (MODE_LABELS[p.mode] || p.mode || 'Cached') + ' · Season ' + p.season : 'Solo / Duo Ranked') + '</div>'
    + '<div class="dh-chips">'
    + '<span class="dh-chip" style="color:' + wrHex(s.winRate) + ';border-color:' + wrHex(s.winRate) + '33">' + s.winRate + '% WR</span>'
    + '<span class="dh-chip"><span style="color:var(--green)">' + s.wins + 'W</span> / <span style="color:var(--red)">' + s.losses + 'L</span></span>'
    + '<span class="dh-chip">' + games + ' Games</span>'
    + (s.avgDuration ? '<span class="dh-chip">' + s.avgDuration + ' min avg</span>' : '')
    + '</div>'
    + '</div>'
    + '</div>'
    + (s.tier ? '<div class="detail-tier-badge">'
      + '<div class="tier-emblem-clip"><img src="' + tierEmblem + '" class="tier-emblem-large" /></div>'
      + '<div><div class="dtier t-' + tierKey + '">' + s.tier + ' ' + s.rank + '</div>'
      + '<div style="font-size:0.9rem;color:var(--text);font-weight:700">' + s.lp + ' LP</div></div>'
      + '</div>' : (function() {
          var lr = p.liveRank;
          if (lr && lr.tier) {
            var lrKey = lr.tier.toLowerCase();
            var lrEmblem = "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-emblem/emblem-" + lrKey + ".png";
            return '<div class="detail-tier-badge">'
              + '<div class="tier-emblem-clip" style="opacity:0.55"><img src="' + lrEmblem + '" class="tier-emblem-large" /></div>'
              + '<div><div class="dtier t-' + lrKey + '" style="opacity:0.7">' + lr.tier + ' ' + lr.rank + '</div>'
              + '<div style="font-size:0.7rem;color:var(--text3);margin-top:3px">Current rank · ' + (p.season || '') + ' cache</div></div>'
              + '</div>';
          }
          return '';
        })())
    + '</div>'

    // Combat + Performance
    + '<div class="ds-two-col">'
    + '<div class="detail-section">'
    + '<div class="ds-title">Combat</div>'
    + '<div class="ds-grid ds-2">'
    + '<div class="stat-box"><div class="st-label">Avg Kills</div><div class="st-val" style="color:var(--green)">' + (s.kills || "0.0") + '</div><div class="st-sub">Per game</div></div>'
    + '<div class="stat-box"><div class="st-label">Avg Deaths</div><div class="st-val" style="color:var(--red)">' + (s.deaths || "0.0") + '</div><div class="st-sub">Per game</div></div>'
    + '<div class="stat-box"><div class="st-label">Avg Assists</div><div class="st-val">' + (s.assists || "0.0") + '</div><div class="st-sub">Per game</div></div>'
    + '<div class="stat-box"><div class="st-label">KDA Ratio</div><div class="st-val" style="color:var(--orange)">' + (s.kda || "0.00") + '</div><div class="st-sub">Per game</div></div>'
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

    // Season Totals
    + '<div class="detail-section">'
    + '<div class="ds-title">Season Totals</div>'
    + '<div class="ds-grid ds-5">'
    + (timePlayed ? '<div class="stat-box"><div class="st-label">Time Played</div><div class="st-val">' + timePlayed + '</div><div class="st-sub">' + seasonLabel + '</div></div>' : '')
    + (s.totalKills ? '<div class="stat-box"><div class="st-label">Total Kills</div><div class="st-val" style="color:var(--green)">' + s.totalKills + '</div><div class="st-sub">' + seasonLabel + '</div></div>' : '')
    + (s.totalAssists ? '<div class="stat-box"><div class="st-label">Total Assists</div><div class="st-val" style="color:var(--accent)">' + s.totalAssists + '</div><div class="st-sub">' + seasonLabel + '</div></div>' : '')
    + (s.totalDeaths ? '<div class="stat-box"><div class="st-label">Total Deaths</div><div class="st-val" style="color:var(--red)">' + s.totalDeaths + '</div><div class="st-sub">' + seasonLabel + '</div></div>' : '')
    + (s.pentas != null ? '<div class="stat-box"><div class="st-label">Total Pentas</div><div class="st-val" style="color:' + (s.pentas > 0 ? "var(--orange)" : "var(--text)") + '">' + (s.pentas > 0 ? "🏆 " : "") + s.pentas + '</div><div class="st-sub">' + (s.pentas > 0 ? seasonLabel : "None yet") + '</div></div>' : '')
    + '</div>'
    + '</div>'

    // Streaks
    + ((s.bestStreak || s.bestLStreak || (!p.cached && s.streak)) ?
      '<div class="detail-section">'
      + '<div class="ds-title">Streaks</div>'
      + '<div class="ds-grid ds-3">'
      + (!p.cached && s.streak ? '<div class="stat-box"><div class="st-label">Current</div><div class="st-val" style="color:' + (s.streak > 0 ? "var(--green)" : "var(--red)") + '">' + (s.streak > 0 ? "🔥 " + s.streak + "W" : "💀 " + Math.abs(s.streak) + "L") + '</div><div class="st-sub">' + (s.streak > 0 ? "On a roll" : "Rough patch") + '</div></div>' : '')
      + (s.bestStreak ? '<div class="stat-box"><div class="st-label">Best Win Streak</div><div class="st-val" style="color:var(--green)">🔥 ' + s.bestStreak + 'W</div><div class="st-sub">Longest win run</div></div>' : '')
      + (s.bestLStreak ? '<div class="stat-box"><div class="st-label">Worst Loss Streak</div><div class="st-val" style="color:var(--red)">💀 ' + s.bestLStreak + 'L</div><div class="st-sub">Longest loss run</div></div>' : '')
      + '</div>'
      + '</div>'
      : '')

    // Champions
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
