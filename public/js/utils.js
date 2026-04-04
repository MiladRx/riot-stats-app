var allData = [];
var currentOpenIdx = null;
var compareSelection = [];

// ── Force Refresh (admin only) ──────────────────────────────────────────────
function forceRefresh() {
  _devAuthGate(function() {
    var btn = document.querySelector(".force-refresh-btn");
    if (btn) { btn.classList.add("spinning"); }
    fetch("/force-refresh", { method: "POST" })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (d.ok) {
          loadSquad();
        }
      })
      .catch(function() {})
      .finally(function() {
        setTimeout(function() {
          if (btn) btn.classList.remove("spinning");
        }, 800);
      });
  });
}

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
