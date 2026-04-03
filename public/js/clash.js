// ── Clash Team Builder ──

var _clashLineups = null;
var _clashActiveTab = 0;

function openClashModal() {
  var modal = document.getElementById("clash-modal");
  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  _clashActiveTab = 0;
  _renderClashLoading();
  fetch("/clash-lineup")
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.error) { _renderClashError(d.error); return; }
      _clashLineups = d.lineups;
      _renderClash();
    })
    .catch(function() { _renderClashError("Failed to load — is the server running?"); });
}

function closeClashModal() {
  document.getElementById("clash-modal").classList.add("hidden");
  document.body.style.overflow = "";
}

function _renderClashLoading() {
  document.getElementById("clash-content").innerHTML =
    '<div class="clash-loading"><div class="clash-spinner"></div><div>Crunching ' + (126 * 120).toLocaleString() + ' lineup combinations…</div></div>';
}

function _renderClashError(msg) {
  document.getElementById("clash-content").innerHTML =
    '<div class="clash-error"><div class="clash-error-icon">⚠️</div><div>' + msg + '</div></div>';
}

function _selectClashTab(idx) {
  _clashActiveTab = idx;
  _renderClash();
}

var ROLE_EMOJI  = { TOP: "⚔️", JUNGLE: "🌿", MIDDLE: "🔥", BOTTOM: "🏹", UTILITY: "🛡️" };
var ROLE_LABEL  = { TOP: "Top",  JUNGLE: "Jungle", MIDDLE: "Mid", BOTTOM: "Bot", UTILITY: "Support" };
var ROLE_COLOR  = { TOP: "#e8794a", JUNGLE: "#48d986", MIDDLE: "#7eb8ff", BOTTOM: "#f5c842", UTILITY: "#bf5af2" };

function _tierLabel(solo) {
  if (!solo) return "Unranked";
  return solo.tier.charAt(0) + solo.tier.slice(1).toLowerCase() + " " + solo.rank + " · " + solo.lp + " LP";
}
function _tierClass(solo) { return solo ? "t-" + solo.tier.toLowerCase() : ""; }

function _emblemUrl(solo) {
  if (!solo) return "";
  return "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-emblem/emblem-" + solo.tier.toLowerCase() + ".png";
}

// Human-readable "why this pick"
function _whyPick(slot) {
  var g = slot.roleGames, wr = slot.roleWR, kda = slot.roleKDA;
  if (g === 0) {
    if (slot.solo && slot.solo.sortScore > 2400) return "Highest-ranked available — raw mechanics carry";
    return "No role history — assigned by rank";
  }
  if (slot.isTopRole && g >= 30 && wr >= 54) return g + " games on main role · " + wr + "% WR — proven pick";
  if (slot.isTopRole && g >= 15) return "Their main role with " + g + " games this season";
  if (!slot.isTopRole && wr >= 58 && g >= 15) return "Off-role but " + wr + "% WR in " + g + " games shows natural ability";
  if (!slot.isTopRole && wr >= 52 && g >= 8) return "Solid secondary role · " + g + " games at " + wr + "% WR";
  if (kda !== null && kda >= 3.5 && g >= 5) return kda + " KDA here — mechanically consistent";
  if (g >= 5) return g + " games on this role" + (wr !== null ? " · " + wr + "% WR" : "");
  return "Best remaining fit for this slot";
}

// Pick confidence tag
function _pickTag(slot) {
  var g = slot.roleGames, wr = slot.roleWR;
  if (g === 0) return { label: "No Data", cls: "conf-low" };
  if (slot.isTopRole && g >= 20 && wr >= 54) return { label: "★ Perfect Fit", cls: "conf-perfect" };
  if (slot.isTopRole && g >= 10) return { label: "Main Role", cls: "conf-high" };
  if (!slot.isTopRole && wr >= 56 && g >= 10) return { label: "Hidden Main", cls: "conf-high" };
  if (wr >= 52 && g >= 8) return { label: "Strong Pick", cls: "conf-high" };
  if (g >= 5) return { label: "Decent Fit", cls: "conf-mid" };
  return { label: "Off-Role", cls: "conf-low" };
}

// Recent form dots
function _formDots(recentForm) {
  if (!recentForm || recentForm.length === 0) return '';
  var dots = recentForm.map(function(win) {
    return '<span class="form-dot ' + (win ? 'form-w' : 'form-l') + '" title="' + (win ? 'Win' : 'Loss') + '"></span>';
  }).join('');
  return '<div class="clash-form" title="Last ' + recentForm.length + ' games on this role">' + dots + '</div>';
}

// Champion icon strip (top 3 on this role)
function _champStrip(slot) {
  if (!slot.topChamps || slot.topChamps.length === 0) return '';
  var icons = slot.topChamps.map(function(c) {
    var url = slot.ddragonVersion
      ? "https://ddragon.leagueoflegends.com/cdn/" + slot.ddragonVersion + "/img/champion/" + c.name + ".png"
      : "";
    return '<div class="clash-champ-icon" title="' + c.name + ' · ' + c.games + 'G · ' + c.wr + '% WR">'
      + '<img src="' + url + '" onerror="this.parentNode.style.display=\'none\'">'
      + '</div>';
  }).join('');
  return '<div class="clash-champs">' + icons + '</div>';
}

function _slotHTML(slot, idx) {
  var roleCol = ROLE_COLOR[slot.role] || "var(--text3)";
  var tag = _pickTag(slot);
  var why = _whyPick(slot);
  var tierCls = _tierClass(slot.solo);
  var emblem = _emblemUrl(slot.solo);

  return '<div class="clash-slot" data-role="' + slot.role + '" style="--role-col:' + roleCol + ';animation-delay:' + (idx * 70) + 'ms">'
    + '<div class="clash-role-header">'
    +   '<span class="clash-role-icon">' + ROLE_EMOJI[slot.role] + '</span>'
    +   '<span class="clash-role-name">' + ROLE_LABEL[slot.role] + '</span>'
    + '</div>'
    + '<div class="clash-slot-body">'
    +   '<div class="clash-av-wrap">'
    +     '<img class="clash-avatar" src="' + ICON(slot.profileIconId) + '" onerror="this.src=\'' + ICON(1) + '\'">'
    +     (emblem ? '<img class="clash-emblem" src="' + emblem + '" onerror="this.style.display=\'none\'">' : '')
    +   '</div>'
    +   '<div class="clash-slot-name">' + slot.gameName + '</div>'
    +   '<div class="clash-slot-rank ' + tierCls + '">' + _tierLabel(slot.solo) + '</div>'
    +   _champStrip(slot)
    +   _formDots(slot.recentForm)
    +   (slot.roleGames > 0
        ? '<div class="clash-role-nums">'
          + (slot.roleWR !== null ? '<span class="rn ' + (slot.roleWR >= 55 ? 'rn-g' : slot.roleWR >= 50 ? 'rn-o' : 'rn-r') + '">' + slot.roleWR + '% WR</span>' : '')
          + '<span class="rn rn-n">' + slot.roleGames + 'G</span>'
          + (slot.roleKDA !== null ? '<span class="rn rn-n">' + slot.roleKDA + ' KDA</span>' : '')
          + '</div>'
        : '<div class="clash-role-nums"><span class="rn rn-muted">No role data</span></div>')
    +   '<div class="clash-why">' + why + '</div>'
    + '</div>'
    + '<div class="clash-slot-foot">'
    +   '<span class="clash-conf ' + tag.cls + '">' + tag.label + '</span>'
    + '</div>'
    + '</div>';
}

function _teamOverviewHTML(summary) {
  var tierCls = summary.avgTier ? 't-' + summary.avgTier.toLowerCase() : '';

  var strengthItems = summary.strengths.map(function(s) {
    return '<div class="ts-item ts-strength"><span class="ts-icon">✓</span>' + s + '</div>';
  }).join('');
  var warningItems = summary.warnings.map(function(w) {
    return '<div class="ts-item ts-warning"><span class="ts-icon">⚠</span>' + w + '</div>';
  }).join('');

  return '<div class="clash-overview">'
    + '<div class="clash-ov-stats">'
    +   '<div class="clash-ov-box">'
    +     '<div class="clash-ov-val ' + tierCls + '">' + summary.avgTier + '</div>'
    +     '<div class="clash-ov-lbl">Avg Rank</div>'
    +   '</div>'
    +   '<div class="clash-ov-box">'
    +     '<div class="clash-ov-val">' + (summary.avgWR !== null ? summary.avgWR + '%' : '—') + '</div>'
    +     '<div class="clash-ov-lbl">Avg Role WR</div>'
    +   '</div>'
    +   '<div class="clash-ov-box">'
    +     '<div class="clash-ov-val">' + summary.mainCount + '<span class="ov-denom">/5</span></div>'
    +     '<div class="clash-ov-lbl">On Main Role</div>'
    +   '</div>'
    +   '<div class="clash-ov-box">'
    +     '<div class="clash-ov-val">' + summary.highCount + '<span class="ov-denom">/5</span></div>'
    +     '<div class="clash-ov-lbl">Strong Picks</div>'
    +   '</div>'
    + '</div>'
    + (strengthItems || warningItems
      ? '<div class="ts-list">' + strengthItems + warningItems + '</div>'
      : '')
    + '</div>';
}

function _benchHTML(bench) {
  if (!bench || bench.length === 0) return '';
  var items = bench.map(function(p) {
    var role = p.topRole ? ROLE_EMOJI[p.topRole] + ' ' + ROLE_LABEL[p.topRole] : 'No data';
    var rank = p.solo ? p.solo.tier.charAt(0) + p.solo.tier.slice(1).toLowerCase() + ' ' + p.solo.rank : 'Unranked';
    var emblem = p.solo ? "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-emblem/emblem-" + p.solo.tier.toLowerCase() + ".png" : "";
    var tierCls = p.solo ? 't-' + p.solo.tier.toLowerCase() : '';
    return '<div class="bench-player">'
      + '<div class="bench-av-wrap">'
      +   '<img class="bench-avatar" src="' + ICON(p.profileIconId) + '" onerror="this.src=\'' + ICON(1) + '\'">'
      +   (emblem ? '<img class="bench-emblem" src="' + emblem + '" onerror="this.style.display=\'none\'">' : '')
      + '</div>'
      + '<div class="bench-info">'
      +   '<div class="bench-name">' + p.gameName + '</div>'
      +   '<div class="bench-meta"><span class="' + tierCls + '">' + rank + '</span> · ' + role + '</div>'
      + '</div>'
      + '</div>';
  }).join('');

  return '<div class="clash-bench">'
    + '<div class="clash-section-label">BENCH</div>'
    + '<div class="clash-bench-row">' + items + '</div>'
    + '</div>';
}

function _renderClash() {
  var lineups = _clashLineups;
  if (!lineups || lineups.length === 0) { _renderClashError("No lineups could be generated."); return; }

  // Inject ddragonVersion into each slot so _champStrip can use it
  var ddv = lineups[0].ddragonVersion;
  lineups.forEach(function(l) {
    l.slots.forEach(function(s) { s.ddragonVersion = ddv; });
  });

  var tabs = lineups.map(function(l, i) {
    var label, sub = '';
    if (i === 0) {
      label = '⭐ Best Lineup';
    } else {
      label = 'Alt ' + i;
      if (l.diff) sub = ' <span class="tab-diff">' + l.diff.swappedOut + ' → ' + l.diff.swappedIn + '</span>';
    }
    var active = i === _clashActiveTab ? " active" : "";
    return '<button class="clash-tab' + active + '" onclick="_selectClashTab(' + i + ')">' + label + sub + '</button>';
  }).join('');

  var lineup = lineups[_clashActiveTab];
  var slots = lineup.slots.map(function(s, i) { return _slotHTML(s, i); }).join('');

  var html = '<div class="clash-tabs">' + tabs + '</div>'
    + _teamOverviewHTML(lineup.teamSummary)
    + '<div class="clash-section-label" style="margin:22px 0 14px">ROLE ASSIGNMENTS</div>'
    + '<div class="clash-slots">' + slots + '</div>'
    + _benchHTML(lineup.bench);

  document.getElementById("clash-content").innerHTML = html;
}

document.addEventListener("keydown", function(e) {
  if (e.key === "Escape" && !document.getElementById("clash-modal").classList.contains("hidden"))
    closeClashModal();
});
