// ── Rank emblem URL (ddragon – tightly cropped) ──
function _rankEmblemUrl(tierKey) {
  if (!tierKey) return '';
  return "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-emblem/emblem-" + tierKey + ".png";
}

// ── Tier ring colors ──
var TIER_RING = {
  iron:'#8c7b6b', bronze:'#cd7f32', silver:'#a8b2bd', gold:'#c89b3c',
  platinum:'#4db6ac', emerald:'#30d158', diamond:'#9cb4e8',
  master:'#bf5af2', grandmaster:'#ff453a', challenger:'#ffd60a'
};

function _kdaColor(kda) {
  if (kda === 'Perfect' || parseFloat(kda) >= 4) return 'var(--green)';
  if (parseFloat(kda) >= 2.5) return 'var(--yellow)';
  if (parseFloat(kda) < 2)   return 'var(--red)';
  return 'var(--orange)';
}

function _dpSection(html, delay) {
  return '<div class="dp-section" style="transition-delay:' + delay + 'ms">' + html + '</div>';
}

function _statBox(label, val, sub, color) {
  return '<div class="dp-stat-box">'
    + '<div class="dp-stat-label">' + label + '</div>'
    + '<div class="dp-stat-val"' + (color ? ' style="color:' + color + '"' : '') + '>' + val + '</div>'
    + (sub ? '<div class="dp-stat-sub">' + sub + '</div>' : '')
    + '</div>';
}

function _miniCell(label, val, color) {
  return '<div class="dp-mini-cell">'
    + '<div class="dp-mini-label">' + label + '</div>'
    + '<div class="dp-mini-val"' + (color ? ' style="color:' + color + '"' : '') + '>' + val + '</div>'
    + '</div>';
}

function _streakBox(val, label, color, sub) {
  return '<div class="dp-streak-box">'
    + '<div class="dp-streak-label">' + label + '</div>'
    + '<div class="dp-streak-val"' + (color ? ' style="color:' + color + '"' : '') + '>' + val + '</div>'
    + '<div class="dp-streak-sub">' + sub + '</div>'
    + '</div>';
}

function _champCard(art, label, name, sub, nameColor) {
  return '<div class="dp-champ-card">'
    + '<img class="dp-champ-art-img" src="' + art + '" onerror="this.style.display=\'none\'" />'
    + '<div class="dp-champ-info">'
    + '<div class="dp-champ-label">' + label + '</div>'
    + '<div class="dp-champ-name"' + (nameColor ? ' style="color:' + nameColor + '"' : '') + '>' + name + '</div>'
    + '<div class="dp-champ-sub">' + sub + '</div>'
    + '</div></div>';
}

function renderDetail(p, i) {
  if (!p.solo) return "";
  var s = p.solo;
  var tierKey = tc(s.tier);
  var champVersion = (p.topChamp ? p.topChamp.version : null) || window._ddragonVersion || "14.10.1";
  var iconSrc = ICON(p.profileIconId);
  var kdaC = _kdaColor(s.kda);
  var ringColor = TIER_RING[tierKey] || 'rgba(255,255,255,0.18)';

  // Time played
  var timePlayed = "";
  if (s.totalTimeSecs) {
    var _d = Math.floor(s.totalTimeSecs / 86400);
    var _h = Math.floor((s.totalTimeSecs % 86400) / 3600);
    timePlayed = _d > 0 ? _d + "d " + _h + "h" : _h + "h " + Math.floor((s.totalTimeSecs % 3600) / 60) + "m";
  }

  // Background art — top champ loading art if available
  var bgArt = (p.topChamp && p.topChamp.id)
    ? 'https://ddragon.leagueoflegends.com/cdn/img/champion/loading/' + p.topChamp.id + '_0.jpg'
    : iconSrc;

  // Rank emblem
  var rankHtml = '';
  if (s.tier) {
    var embUrl = _rankEmblemUrl(tierKey);
    rankHtml = '<div class="dp-rank-text">'
      + '<div class="dp-rank-tier t-' + tierKey + '">' + s.tier + ' ' + s.rank + '</div>'
      + '<div class="dp-rank-lp">' + s.lp + ' LP</div>'
      + '</div>';
  } else if (p.liveRank && p.liveRank.tier) {
    var lrk = p.liveRank.tier.toLowerCase();
    var lrEmb = _rankEmblemUrl(lrk);
    rankHtml = '<div class="dp-rank-text">'
      + '<div class="dp-rank-tier t-' + lrk + '" style="opacity:0.7">' + p.liveRank.tier + ' ' + p.liveRank.rank + '</div>'
      + '<div class="dp-rank-lp">Current rank</div>'
      + '</div>';
  }

  // ── 1. Banner ──
  var banner = _dpSection(
    '<div class="dp-banner">'
    + '<div class="dp-banner-bg" style="background-image:url(\'' + bgArt + '\')"></div>'
    + '<div class="dp-banner-scrim"></div>'
    + '<div class="dp-banner-avatar-wrap">'
    + '<img class="dp-banner-avatar" src="' + iconSrc + '" style="--ring:' + ringColor + '" onerror="this.src=\'' + ICON(1) + '\'" />'
    + (p.summonerLevel ? '<div class="dp-level-badge">' + p.summonerLevel + '</div>' : '')
    + '</div>'
    + '<div class="dp-banner-info">'
    + '<div class="dp-banner-name">' + p.gameName + '<span class="dp-banner-tag"> #' + p.tagLine + '</span></div>'
    + '<div class="dp-banner-sub">' + (p.cached ? (MODE_LABELS[p.mode] || p.mode) + ' · Season ' + p.season : 'Solo / Duo · EUNE') + '</div>'
    + '</div>'
    + '<div class="dp-banner-rank">' + rankHtml + '</div>'
    + '</div>',
    0
  );

  // ── 2. Hero stat row ──
  var heroRow = _dpSection(
    '<div class="dp-hero-row">'
    + '<div class="dp-hero-cell">'
    + '<div class="dp-hero-label">Win Rate</div>'
    + '<div class="dp-hero-val" style="color:' + wrHex(s.winRate) + '">' + s.winRate + '%</div>'
    + '<div class="dp-hero-sub"><span style="color:var(--green)">' + s.wins + 'W</span><span class="dp-hero-dot">·</span><span style="color:var(--red)">' + s.losses + 'L</span></div>'
    + '</div>'
    + '<div class="dp-hero-sep"></div>'
    + '<div class="dp-hero-cell">'
    + '<div class="dp-hero-label">KDA Ratio</div>'
    + '<div class="dp-hero-val" style="color:' + kdaC + '">' + (s.kda || '—') + '</div>'
    + '<div class="dp-hero-sub">' + (s.kills||0) + ' / ' + (s.deaths||0) + ' / ' + (s.assists||0) + '</div>'
    + '</div>'
    + '<div class="dp-hero-sep"></div>'
    + '<div class="dp-hero-cell">'
    + '<div class="dp-hero-label">Games</div>'
    + '<div class="dp-hero-val">' + (s.wins + s.losses) + '</div>'
    + '<div class="dp-hero-sub">' + (timePlayed || 'this season') + '</div>'
    + '</div>'
    + '<div class="dp-hero-sep"></div>'
    + '<button class="dp-champ-btn" onclick="openChampHistory(\'' + encodeURIComponent(p.gameName) + '\',\'' + encodeURIComponent(p.tagLine) + '\',\'' + champVersion + '\',' + (p.profileIconId||1) + '); event.stopPropagation()">'
    + '<div class="dp-champ-btn-inner">'
    + '<span class="dp-champ-btn-icon">⚔</span>'
    + '<span class="dp-champ-btn-label">Champions</span>'
    + '<span class="dp-champ-btn-arrow">›</span>'
    + '</div></button>'
    + '</div>',
    60
  );

  // ── 3. Combat + Performance ──
  var combatPerf = _dpSection(
    '<div class="dp-two-col">'
    + '<div class="dp-subsection"><div class="dp-section-title">Combat</div>'
    + '<div class="dp-stat-grid dp-g2">'
    + _statBox('Avg Kills',   s.kills  || '0.0', 'Per game', 'var(--green)')
    + _statBox('Avg Deaths',  s.deaths || '0.0', 'Per game', 'var(--red)')
    + _statBox('Avg Assists', s.assists|| '0.0', 'Per game', '')
    + _statBox('KDA Ratio',   s.kda    || '0.00','Per game', kdaC)
    + '</div></div>'
    + '<div class="dp-subsection"><div class="dp-section-title">Performance</div>'
    + '<div class="dp-stat-grid dp-g2">'
    + (s.topRole  ? _statBox('Main Role',    (ROLE_ICONS[s.topRole]||'') + ' ' + (ROLE_LABELS[s.topRole]||s.topRole), 'Most played',       'var(--accent)') : '')
    + (s.avgCsMin ? _statBox('CS / Min',     s.avgCsMin,              'Farming efficiency',  'var(--yellow)') : '')
    + (s.avgVision? _statBox('Vision Score', s.avgVision,             'Avg per game',        'var(--accent)') : '')
    + (s.avgDamage? _statBox('Avg Damage',   formatMastery(s.avgDamage),'To champions',      '') : '')
    + '</div></div>'
    + '</div>',
    120
  );

  // ── 4. Season totals ──
  var stCells = [];
  if (timePlayed)      stCells.push(_miniCell('Time',    timePlayed,                    ''));
  if (s.totalKills)    stCells.push(_miniCell('Kills',   s.totalKills,                  'var(--green)'));
  if (s.totalAssists)  stCells.push(_miniCell('Assists', s.totalAssists,                'var(--accent)'));
  if (s.totalDeaths)   stCells.push(_miniCell('Deaths',  s.totalDeaths,                 'var(--red)'));
  if (s.pentas != null) stCells.push(_miniCell('Pentas', (s.pentas > 0 ? '🏆 ' : '') + s.pentas, s.pentas > 0 ? 'var(--orange)' : 'var(--text3)'));

  var seasonTotals = stCells.length ? _dpSection(
    '<div class="dp-section-title">Season Totals</div>'
    + '<div class="dp-mini-rail">'
    + stCells.map(function(c, idx) { return (idx > 0 ? '<div class="dp-mini-sep"></div>' : '') + c; }).join('')
    + '</div>',
    180
  ) : '';

  // ── 5. Streaks ──
  var streaks = '';
  if (s.bestStreak || s.bestLStreak || (!p.cached && s.streak)) {
    var sc = '';
    if (!p.cached && s.streak) sc += _streakBox(s.streak > 0 ? '🔥 ' + s.streak + 'W' : '💀 ' + Math.abs(s.streak) + 'L', 'Current', s.streak > 0 ? 'var(--green)' : 'var(--red)', s.streak > 0 ? 'On a roll' : 'Rough patch');
    if (s.bestStreak)  sc += _streakBox('🔥 ' + s.bestStreak  + 'W', 'Best Win Streak',   'var(--green)', 'Longest win run');
    if (s.bestLStreak) sc += _streakBox('💀 ' + s.bestLStreak + 'L', 'Worst Loss Streak', 'var(--red)',   'Longest loss run');
    streaks = _dpSection(
      '<div class="dp-section-title">Streaks</div><div class="dp-streak-row">' + sc + '</div>',
      230
    );
  }

  // ── 6. Champions ──
  var champsSection = '';
  if (p.topChamp || s.topCachedChamp) {
    var cc = '';
    if (p.topChamp) {
      var art1 = 'https://ddragon.leagueoflegends.com/cdn/img/champion/loading/' + p.topChamp.id + '_0.jpg';
      cc += _champCard(art1, 'Signature Pick', p.topChamp.name, formatMastery(p.topChamp.points) + ' pts mastery', 'var(--yellow)');
    }
    if (s.topCachedChamp) {
      var cid = (s.topCachedChamp.name||'').replace(/ /g,'').replace(/'/g,'').replace(/\./g,'');
      var art2 = 'https://ddragon.leagueoflegends.com/cdn/img/champion/loading/' + cid + '_0.jpg';
      cc += _champCard(art2, 'Season Spam', s.topCachedChamp.name, s.topCachedChamp.games + ' games · ' + s.topCachedChamp.winRate + '% WR', 'var(--orange)');
    }
    champsSection = _dpSection(
      '<div class="dp-section-title">Champions</div><div class="dp-champ-row">' + cc + '</div>',
      280
    );
  }

  return '<div class="dp-wrap">'
    + banner + heroRow + combatPerf + seasonTotals + streaks + champsSection
    + '</div>';
}
