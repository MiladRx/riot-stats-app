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

function _timeAgo(ts) {
  var diff = Date.now() - ts;
  var m = Math.floor(diff / 60000);
  if (m < 60) return m + 'm ago';
  var h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  return Math.floor(h / 24) + 'd ago';
}

function _statRow(label, val, valColor) {
  return '<div class="dp2-stat-row">'
    + '<span class="dp2-stat-label">' + label + '</span>'
    + '<span class="dp2-stat-val"' + (valColor ? ' style="color:' + valColor + '"' : '') + '>' + val + '</span>'
    + '</div>';
}

function renderDetail(p, i) {
  if (!p.solo) return "";
  var s = p.solo;
  var tierKey = tc(s.tier);
  var champVersion = (p.topChamp ? p.topChamp.version : null) || window._ddragonVersion || "14.10.1";
  var kdaC = _kdaColor(s.kda);
  var ringColor = TIER_RING[tierKey] || 'rgba(255,255,255,0.18)';

  var timePlayed = "";
  if (s.totalTimeSecs) {
    var _d = Math.floor(s.totalTimeSecs / 86400);
    var _h = Math.floor((s.totalTimeSecs % 86400) / 3600);
    timePlayed = _d > 0 ? _d + "d " + _h + "h" : _h + "h " + Math.floor((s.totalTimeSecs % 3600) / 60) + "m";
  }

  var wrPct = s.wins / (s.wins + s.losses) * 100;

  // ── Hero bar ──
  var heroBar =
    '<div class="dp2-hero">'

    // Rank badge
    + '<div class="dp2-rank">'
    + '<div class="dp2-rank-glow" style="background:' + ringColor + '"></div>'
    + '<div class="dp2-rank-tier t-' + tierKey + '">' + s.tier + ' ' + s.rank + '</div>'
    + '<div class="dp2-rank-lp">' + s.lp + ' LP</div>'
    + '</div>'

    // WR
    + '<div class="dp2-pill">'
    + '<div class="dp2-pill-label">Win Rate</div>'
    + '<div class="dp2-pill-val" style="color:' + wrHex(s.winRate) + '">' + s.winRate + '%</div>'
    + '<div class="dp2-pill-sub">'
    + '<span style="color:var(--green)">' + s.wins + 'W</span>'
    + ' <span style="opacity:.4">·</span> '
    + '<span style="color:var(--red)">' + s.losses + 'L</span>'
    + '</div>'
    + '<div class="dp2-wr-bar"><div class="dp2-wr-fill" style="width:' + wrPct.toFixed(1) + '%"></div></div>'
    + '</div>'

    // KDA
    + '<div class="dp2-pill">'
    + '<div class="dp2-pill-label">KDA Ratio</div>'
    + '<div class="dp2-pill-val" style="color:' + kdaC + '">' + (s.kda || '—') + '</div>'
    + '<div class="dp2-pill-sub">'
    + s.kills + ' <span style="opacity:.4">/</span> <span style="color:var(--red)">' + s.deaths + '</span> <span style="opacity:.4">/</span> ' + s.assists
    + '</div>'
    + '</div>'

    // Games
    + (function() {
        var mainGames = s.wins + s.losses;
        var combined  = mainGames + (p.altGames || 0);
        var gameTip = '';
        if (p.altAccount && s.totalTimeSecs && mainGames > 0) {
          var avgSecs = s.totalTimeSecs / mainGames;
          var totalSecs = Math.round(s.totalTimeSecs + avgSecs * p.altGames);
          var td = Math.floor(totalSecs / 86400);
          var th = Math.floor((totalSecs % 86400) / 3600);
          var tm = Math.floor((totalSecs % 3600) / 60);
          var totalTime = td > 0 ? td + 'd ' + th + 'h' : th + 'h ' + tm + 'm';
          gameTip = p.gameName + ' + ' + p.altAccount.gameName + '&#10;Total: ' + totalTime;
        }
        return '<div class="dp2-pill"' + (gameTip ? ' data-tip="' + gameTip + '" data-tip-title="Time played"' : '') + '>'
          + '<div class="dp2-pill-label">Games</div>'
          + '<div class="dp2-pill-val">' + mainGames + '</div>'
          + '<div class="dp2-pill-sub">' + (timePlayed || '—') + '</div>'
          + '</div>';
      })()

    // Champions button
    + '<button class="dp2-champ-btn" onclick="openChampHistory(\'' + encodeURIComponent(p.gameName) + '\',\'' + encodeURIComponent(p.tagLine) + '\',\'' + champVersion + '\',' + (p.profileIconId||1) + '); event.stopPropagation()">'
    + '<span>⚔</span><span>Champions</span>'
    + '</button>'

    + '</div>';

  // ── Right panel: stats ──
  var statsRows = ''
    + _statRow('Avg Kills',   s.kills   || '—', 'var(--green)')
    + _statRow('Avg Deaths',  s.deaths  || '—', 'var(--red)')
    + _statRow('Avg Assists', s.assists || '—', '')
    + _statRow('KDA Ratio',   s.kda     || '—', kdaC);
  if (s.avgCsMin)  statsRows += _statRow('CS / Min',     s.avgCsMin,                   'var(--yellow)');
  if (s.avgVision) statsRows += _statRow('Vision Score', s.avgVision,                  '');
  if (s.avgDamage) statsRows += _statRow('Avg Damage',   formatMastery(s.avgDamage),   '');
  if (s.topRole)   statsRows += _statRow('Main Role',    (ROLE_LABELS[s.topRole]||s.topRole), 'var(--accent)');

  // ── Right panel: streaks ──
  var streakHtml = '';
  if (!p.cached && s.streak) {
    var sw = s.streak > 0;
    streakHtml += '<div class="dp2-streak ' + (sw ? 'dp2-streak-w' : 'dp2-streak-l') + '">'
      + '<span class="dp2-streak-val">' + (sw ? '🔥' : '💀') + ' ' + Math.abs(s.streak) + (sw ? 'W' : 'L') + '</span>'
      + '<span class="dp2-streak-sub">' + (sw ? 'On a roll' : 'Rough patch') + '</span>'
      + '</div>';
  }
  if (s.bestStreak)  streakHtml += '<div class="dp2-streak dp2-streak-w"><span class="dp2-streak-val">🔥 ' + s.bestStreak + 'W</span><span class="dp2-streak-sub">Best streak</span></div>';
  if (s.bestLStreak) streakHtml += '<div class="dp2-streak dp2-streak-l"><span class="dp2-streak-val">💀 ' + s.bestLStreak + 'L</span><span class="dp2-streak-sub">Worst streak</span></div>';

  // ── Right panel: season totals ──
  var statsRowsHtml = '';
  if (timePlayed)     statsRowsHtml += '<div class="dp2-total-cell"><span class="dp2-total-val">' + timePlayed + '</span><span class="dp2-total-label">Time</span></div>';
  if (s.totalKills)   statsRowsHtml += '<div class="dp2-total-cell"><span class="dp2-total-val" style="color:var(--green)">' + s.totalKills + '</span><span class="dp2-total-label">Kills</span></div>';
  if (s.totalDeaths)  statsRowsHtml += '<div class="dp2-total-cell"><span class="dp2-total-val" style="color:var(--red)">' + s.totalDeaths + '</span><span class="dp2-total-label">Deaths</span></div>';
  if (s.totalAssists) statsRowsHtml += '<div class="dp2-total-cell"><span class="dp2-total-val">' + s.totalAssists + '</span><span class="dp2-total-label">Assists</span></div>';

  var pentaHtml = '';
  if (s.pentas || s.maxKillsDeathless) {
    pentaHtml = '<div class="dp2-penta-row">';
    if (s.pentas) pentaHtml += '<div class="dp2-penta-badge"><span>🏆</span>' + s.pentas + ' Penta' + (s.pentas > 1 ? 's' : '') + '</div>';
    if (s.maxKillsDeathless) pentaHtml += '<div class="dp2-penta-badge dp2-penta-deathless" data-tip="Highest kills in a single game with 0 deaths">🎯 Kill Streak: ' + s.maxKillsDeathless + '</div>';
    pentaHtml += '</div>';
  }

  var totalsBlock = (statsRowsHtml || pentaHtml)
    ? '<div class="dp2-totals-block"><div class="dp2-totals">' + statsRowsHtml + '</div>' + pentaHtml + '</div>'
    : '';

  // ── Right panel assembled ──
  var rightPanel =
    '<div class="dp2-right">'
    + '<div class="dp2-stats-block">' + statsRows + '</div>'
    + (streakHtml ? '<div class="dp2-streaks-block"><div class="dp2-streaks">' + streakHtml + '</div></div>' : '')
    + totalsBlock
    + '</div>';

  // ── Left panel: match history ──
  var matchHistId = 'mh-' + p.gameName.replace(/[^a-z0-9]/gi,'') + '-' + p.tagLine;
  var leftPanel =
    '<div class="dp2-left">'
    + '<div class="dp2-mh-wrap" id="' + matchHistId + '">'
    + '<div class="dp2-mh-skeleton">' + Array(6).fill('<div class="dp2-mh-skel-row"></div>').join('') + '</div>'
    + '</div>'
    + '</div>';

  // Fetch match history after render
  setTimeout(function() {
    var el = document.getElementById(matchHistId);
    if (!el) return;
    fetch('/match-history/' + encodeURIComponent(p.gameName) + '/' + encodeURIComponent(p.tagLine) + '?season=' + (window._currentSeason || '2026') + '&mode=' + (window._currentMode || 'solo'))
      .then(function(r) { return r.json(); })
      .then(function(data) {
        var el2 = document.getElementById(matchHistId);
        if (!el2) return;
        var matches = (data.matches || []);
        if (!matches.length) { el2.innerHTML = '<div class="dp2-mh-empty">No games cached yet</div>'; return; }

        var rows = matches.map(function(m, idx) {
          var win = m.win;
          var mins = Math.floor(m.duration / 60);
          var secs = String(m.duration % 60).padStart(2, '0');
          var endTs = m.ts + (m.duration * 1000);
          var ago = _timeAgo(endTs);
          var kda = m.deaths === 0 ? '∞' : ((m.kills + m.assists) / m.deaths).toFixed(2);
          var kdaC2 = parseFloat(kda) >= 4 ? 'var(--green)' : parseFloat(kda) >= 2.5 ? 'var(--yellow)' : parseFloat(kda) < 2 ? 'var(--red)' : 'var(--orange)';
          var _champOverrides = {
            'Wukong':'MonkeyKing','Nunu & Willump':'Nunu','Renata Glasc':'Renata',
            "Bel'Veth":'Belveth',"Cho'Gath":'Chogath',"Kha'Zix":'Khazix',
            "Kog'Maw":'KogMaw',"Rek'Sai":'RekSai',"Vel'Koz":'Velkoz',
            "Kai'Sa":'Kaisa',"LeBlanc":'Leblanc',"Jarvan IV":'JarvanIV',
            "Dr. Mundo":'DrMundo',"Aurelion Sol":'AurelionSol',
            "Master Yi":'MasterYi',"Miss Fortune":'MissFortune',
            "Tahm Kench":'TahmKench',"Twisted Fate":'TwistedFate',
            "Xin Zhao":'XinZhao',"Lee Sin":'LeeSin',"Kog'Maw":'KogMaw',
            "K'Sante":'KSante',"Briar":'Briar',"Hwei":'Hwei',
            "Smolder":'Smolder',"Mel":'Mel',
            'FiddleSticks':'Fiddlesticks','Fiddlesticks':'Fiddlesticks'
          };
          var champKey = _champOverrides[m.champion] || m.champion.replace(/\s/g,'').replace(/['.]/g,'');
          var icon = 'https://ddragon.leagueoflegends.com/cdn/' + (window._ddragonVersion||'14.10.1') + '/img/champion/' + champKey + '.png';

          return '<div class="dp2-mh-row ' + (win ? 'dp2-mh-w' : 'dp2-mh-l') + '" style="animation-delay:' + (idx * 18) + 'ms">'
            + '<div class="dp2-mh-outcome">' + (win ? 'W' : 'L') + '</div>'
            + '<img class="dp2-mh-icon" src="' + icon + '" onerror="this.style.opacity=0" />'
            + '<div class="dp2-mh-champ-wrap">'
            + '<div class="dp2-mh-champ-name">' + m.champion + (m.pentas ? '<span class="dp2-mh-penta">PENTA</span>' : '') + '</div>'
            + '<div class="dp2-mh-champ-sub">' + ago + '</div>'
            + '</div>'
            + '<div class="dp2-mh-kda">'
            + m.kills + '<span class="dp2-mh-slash">/</span><span class="dp2-mh-d">' + m.deaths + '</span><span class="dp2-mh-slash">/</span>' + m.assists
            + '</div>'
            + '<div class="dp2-mh-ratio" style="color:' + kdaC2 + '">' + kda + '</div>'
            + '<div class="dp2-mh-cs">' + m.cs + ' CS</div>'
            + '<div class="dp2-mh-time">'
            + '<span>' + mins + ':' + secs + '</span>'
            + '<span class="dp2-mh-ago">' + ago + '</span>'
            + '</div>'
            + '</div>';
        }).join('');

        // Build KDA trend chart (most recent → left)
        var kdaChartId = matchHistId + '-kda-chart';
        var kdaVals = matches.slice().reverse().map(function(m) {
          return m.deaths === 0 ? (m.kills + m.assists) : ((m.kills + m.assists) / m.deaths);
        });
        var kdaColors = matches.slice().reverse().map(function(m) {
          return m.win ? 'rgba(48,209,88,0.85)' : 'rgba(255,69,58,0.75)';
        });
        var chartHtml = typeof Chart !== 'undefined'
          ? '<div class="dp2-kda-chart-wrap"><canvas id="' + kdaChartId + '" height="56"></canvas></div>'
          : '';
        el2.innerHTML = chartHtml + '<div class="dp2-mh-list">' + rows + '</div>';

        // Mount the chart
        if (typeof Chart !== 'undefined') {
          requestAnimationFrame(function() {
            var cv = document.getElementById(kdaChartId);
            if (!cv) return;
            new Chart(cv, {
              type: 'bar',
              data: {
                labels: kdaVals.map(function(_, i) { return 'G' + (i + 1); }),
                datasets: [{
                  data: kdaVals,
                  backgroundColor: kdaColors,
                  borderRadius: 3,
                  borderSkipped: false,
                }]
              },
              options: {
                animation: { duration: 500 },
                plugins: { legend: { display: false }, tooltip: {
                  callbacks: { label: function(ctx) { return 'KDA: ' + ctx.raw.toFixed(2); } }
                }},
                scales: {
                  x: { display: false },
                  y: { display: false, min: 0 }
                },
                responsive: true,
                maintainAspectRatio: false,
              }
            });
          });
        }

        // Sync left column height to right panel's natural height
        requestAnimationFrame(function() {
          var body = el2.closest('.dp2-body');
          if (!body) return;
          var right = body.querySelector('.dp2-right');
          var left = body.querySelector('.dp2-left');
          if (!right || !left) return;
          var rightH = right.getBoundingClientRect().height;
          left.style.height = rightH + 'px';
        });
      })
      .catch(function() {
        var el2 = document.getElementById(matchHistId);
        if (el2) el2.innerHTML = '<div class="dp2-mh-empty">Could not load</div>';
      });
  }, 60);

  return '<div class="dp2-wrap">'
    + '<div class="dp2-hero-section">' + heroBar + '</div>'
    + '<div class="dp2-body">' + leftPanel + rightPanel + '</div>'
    + '</div>';
}

function _champCard2(art, pill, name, sub, nameColor, glowColor) {
  return '<div class="dp2-champ-card">'
    + (glowColor ? '<div class="dp2-champ-glow" style="background:' + glowColor + '"></div>' : '')
    + '<img class="dp2-champ-art" src="' + art + '" onerror="this.style.display=\'none\'" />'
    + '<div class="dp2-champ-info">'
    + '<span class="dp2-champ-pill">' + pill + '</span>'
    + '<div class="dp2-champ-name"' + (nameColor ? ' style="color:' + nameColor + '"' : '') + '>' + name + '</div>'
    + '<div class="dp2-champ-sub">' + sub + '</div>'
    + '</div>'
    + '</div>';
}
