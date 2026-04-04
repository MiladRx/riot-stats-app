// ── Champion History Modal ──
var _chCache = {};
var _chAllChamps = [];
var _chHighlights = null; // computed once on load, never changes with sort
var _chSortKey = 'games';
var _chVersion = '14.10.1';

function champIconUrl(name, version) {
  var n = (name || '').replace(/ /g, '').replace(/'/g, '').replace(/\./g, '');
  // Special cases
  var map = { 'Nunu&Willump': 'Nunu', 'Renata Glasc': 'Renata', 'K\'Sante': 'KSante', 'Bel\'Veth': 'Belveth', 'Kog\'Maw': 'KogMaw', 'Vel\'Koz': 'Velkoz', 'Kha\'Zix': 'Khazix', 'Cho\'Gath': 'Chogath', 'Kai\'Sa': 'Kaisa', 'Rek\'Sai': 'RekSai', 'Twitch': 'Twitch' };
  n = map[name] || n;
  return 'https://ddragon.leagueoflegends.com/cdn/' + version + '/img/champion/' + n + '.png';
}

function kdaColor(kda) {
  if (kda === 'Perfect') return 'var(--green)';
  var v = parseFloat(kda);
  if (v >= 4) return 'var(--green)';
  if (v >= 2.5) return 'var(--yellow)';
  return 'var(--red)';
}

function wrColor(wr) {
  if (wr >= 60) return '#4ade80';
  if (wr >= 53) return '#a3e635';
  if (wr >= 50) return '#facc15';
  if (wr >= 45) return '#fb923c';
  return '#f87171';
}

function openChampHistory(gn, tl, version, iconId) {
  var gameName = decodeURIComponent(gn);
  var tagLine = decodeURIComponent(tl);
  _chVersion = version || '14.10.1';
  var key = gameName + '#' + tagLine;

  var modal = document.getElementById('ch-modal');
  var playerIcon = document.getElementById('ch-player-icon');
  var playerName = document.getElementById('ch-player-name');
  var playerSub = document.getElementById('ch-player-sub');
  var list = document.getElementById('ch-list');
  var highlights = document.getElementById('ch-highlights');
  var search = document.getElementById('ch-search');

  playerName.textContent = gameName + ' #' + tagLine;
  playerSub.textContent = 'Champion History · ' + (window._currentSeason || '2026') + ' · ' + (window._currentMode || 'solo').toUpperCase();
  playerIcon.src = 'https://ddragon.leagueoflegends.com/cdn/' + _chVersion + '/img/profileicon/' + iconId + '.png';
  search.value = '';
  _chSortKey = 'games';
  document.querySelectorAll('.ch-sort-btn').forEach(function(b) { b.classList.toggle('active', b.dataset.sort === 'games'); });

  modal.classList.remove('hidden');
  requestAnimationFrame(function() { modal.classList.add('ch-open'); });

  if (_chCache[key]) {
    _chAllChamps = _chCache[key];
    _chHighlights = computeHighlights(_chAllChamps);
    renderChList();
    return;
  }

  list.innerHTML = '<div class="ch-loading"><div class="ch-spinner"></div><span>Loading champions…</span></div>';
  highlights.innerHTML = '';

  var mode = window._currentMode || 'solo';
  var season = window._currentSeason || '2026';
  fetch('/player-history/' + encodeURIComponent(gameName) + '/' + encodeURIComponent(tagLine) + '?season=' + season + '&mode=' + mode)
    .then(function(r) { return r.json(); })
    .then(function(d) {
      _chCache[key] = d.champions || [];
      _chAllChamps = _chCache[key];
      _chHighlights = computeHighlights(_chAllChamps);
      renderChList();
    })
    .catch(function() {
      list.innerHTML = '<div class="ch-empty">Failed to load champion data.</div>';
    });
}

function closeChampHistory() {
  var modal = document.getElementById('ch-modal');
  modal.classList.remove('ch-open');
  setTimeout(function() { modal.classList.add('hidden'); }, 350);
}

function computeHighlights(all) {
  var qualified = all.filter(function(c) { return c.games >= 3; });
  var mostPlayed = all.slice().sort(function(a, b) { return b.games - a.games; })[0] || null;
  var bestWR = qualified.slice().sort(function(a, b) { return b.winRate - a.winRate; })[0] || null;
  var bestKDA = qualified.slice().sort(function(a, b) {
    var ka = a.kda === 'Perfect' ? 999 : parseFloat(a.kda);
    var kb = b.kda === 'Perfect' ? 999 : parseFloat(b.kda);
    return kb - ka;
  })[0] || null;
  return { mostPlayed: mostPlayed, bestWR: bestWR, bestKDA: bestKDA };
}

function sortChampions(key, btn) {
  _chSortKey = key;
  document.querySelectorAll('.ch-sort-btn').forEach(function(b) { b.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  renderChList();
}

function filterChampions() {
  renderChList();
}

function renderChList() {
  var search = document.getElementById('ch-search').value.toLowerCase();
  var list = document.getElementById('ch-list');
  var highlights = document.getElementById('ch-highlights');

  var champs = _chAllChamps.slice();

  // Sort
  champs.sort(function(a, b) {
    if (_chSortKey === 'wr') return b.winRate - a.winRate;
    if (_chSortKey === 'kda') {
      var ka = a.kda === 'Perfect' ? 999 : parseFloat(a.kda);
      var kb = b.kda === 'Perfect' ? 999 : parseFloat(b.kda);
      return kb - ka;
    }
    return b.games - a.games;
  });

  if (_chHighlights) {
    highlights.innerHTML = [
      _chHighlights.mostPlayed ? buildHighlight('🎯 Most Played', _chHighlights.mostPlayed, 'games', '') : '',
      _chHighlights.bestWR     ? buildHighlight('📈 Best Win Rate', _chHighlights.bestWR, 'wr', 'min 3 games') : '',
      _chHighlights.bestKDA    ? buildHighlight('⚡ Best KDA', _chHighlights.bestKDA, 'kda', 'min 3 games') : '',
    ].join('');
  }

  // Filter
  if (search) champs = champs.filter(function(c) { return c.name.toLowerCase().includes(search); });

  if (!champs.length) {
    list.innerHTML = '<div class="ch-empty">No champions found.</div>';
    return;
  }

  var total = _chAllChamps.reduce(function(s, c) { return s + c.games; }, 0);
  var html = '<div class="ch-col-header">'
    + '<span></span><span></span>'
    + '<span>Champion</span>'
    + '<span class="col-games">Games</span>'
    + '<span class="col-record">Record</span>'
    + '<span class="col-wr">Win Rate</span>'
    + '<span class="col-kda">KDA</span>'
    + '</div>';

  champs.forEach(function(c, i) {
    var wins = Math.round(c.games * c.winRate / 100);
    var losses = c.games - wins;
    var wr = c.winRate;
    var wrc = wrColor(wr);
    var kc = kdaColor(c.kda);
    var playShare = total > 0 ? Math.round(c.games / total * 100) : 0;
    var iconUrl = champIconUrl(c.name, _chVersion);

    html += '<div class="ch-row" style="animation-delay:' + Math.min(i * 25, 400) + 'ms">'
      + '<div class="ch-row-rank">' + (i + 1) + '</div>'
      + '<img class="ch-row-icon" src="' + iconUrl + '" onerror="this.style.opacity=\'0.3\'" />'
      + '<div class="ch-row-info">'
      + '<div class="ch-row-name">' + c.name + '</div>'
      + '<div class="ch-row-sub">' + playShare + '% of games</div>'
      + '</div>'
      + '<div class="ch-row-games"><span class="ch-games-pill">' + c.games + 'G</span></div>'
      + '<div class="ch-row-wl">'
      + '<span class="ch-w">' + wins + 'W</span>'
      + '<div class="ch-split-bar"><div class="ch-split-w" style="width:' + wr + '%"></div></div>'
      + '<span class="ch-l">' + losses + 'L</span>'
      + '</div>'
      + '<div class="ch-row-wr" style="color:' + wrc + '">' + wr + '%</div>'
      + '<div class="ch-row-kda" style="color:' + kc + '">' + c.kda + '</div>'
      + '</div>';
  });

  list.innerHTML = html;

  // Animate split bars
  requestAnimationFrame(function() {
    list.querySelectorAll('.ch-split-w').forEach(function(el) {
      var target = el.style.width;
      el.style.width = '0';
      requestAnimationFrame(function() {
        el.style.transition = 'width 0.5s cubic-bezier(0.4,0,0.2,1)';
        el.style.width = target;
      });
    });
  });
}

function buildHighlight(label, c, stat, note) {
  var n = (c.name || '').replace(/ /g, '').replace(/'/g, '').replace(/\./g, '');
  var map = { 'Nunu&Willump': 'Nunu', 'RenataGlasc': 'Renata', 'KSante': 'KSante', 'BelVeth': 'Belveth', 'KogMaw': 'KogMaw', 'VelKoz': 'Velkoz', 'KhaZix': 'Khazix', 'ChoGath': 'Chogath', 'KaiSa': 'Kaisa', 'RekSai': 'RekSai' };
  n = map[n] || n;
  var iconUrl = 'https://ddragon.leagueoflegends.com/cdn/img/champion/loading/' + n + '_0.jpg';
  var val = stat === 'games' ? c.games + ' games'
           : stat === 'wr'   ? c.winRate + '% WR'
           : c.kda + ' KDA';
  var color = stat === 'games' ? 'var(--accent)'
            : stat === 'wr'    ? wrColor(c.winRate)
            : kdaColor(c.kda);
  return '<div class="ch-highlight">'
    + '<img class="ch-hl-icon" src="' + iconUrl + '" />'
    + '<div class="ch-hl-label">' + label + (note ? ' <span class="ch-hl-note">' + note + '</span>' : '') + '</div>'
    + '<div class="ch-hl-name">' + c.name + '</div>'
    + '<div class="ch-hl-val" style="color:' + color + '">' + val + '</div>'
    + '</div>';
}

// Close on Escape
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeChampHistory();
});
