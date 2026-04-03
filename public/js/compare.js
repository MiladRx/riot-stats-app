// Head-to-Head Compare
function selectForCompare(idx, e) {
  e.stopPropagation();
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
      { label: "Rank", rawA: aLp, rawB: bLp, hi: true, dA: sa.tier ? '<div class="cmp-rank-box"><div>' + sa.tier + ' ' + sa.rank + '</div><div class="cmp-lp-text">' + (sa.lp || 0) + ' LP</div></div>' : "—", dB: sb.tier ? '<div class="cmp-rank-box"><div>' + sb.tier + ' ' + sb.rank + '</div><div class="cmp-lp-text">' + (sb.lp || 0) + ' LP</div></div>' : "—" },
      { label: "KDA", rawA: aKda, rawB: bKda, hi: true, dA: sa.kda || "—", dB: sb.kda || "—" },
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

  var rowsWrap = document.getElementById("cmpRowsWrap");
  var verdictEl = document.getElementById("cmpVerdict");
  if (rowsWrap && verdictEl) {
    rowsWrap.innerHTML = '<div class="cmp-col-labels"><span>' + a.gameName + '</span><span>' + b.gameName + '</span></div>'
      + '<div class="cmp-rows">' + rowsHtml + '</div>';
    verdictEl.innerHTML = verdictHtml;
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
