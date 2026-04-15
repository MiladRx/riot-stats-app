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

// Unique canvas ID counter for Chart.js rings
var _wrRingSeq = 0;

function wrRing(wr) {
  var cls = wrColor(wr);
  var id  = "wr-ring-canvas-" + (++_wrRingSeq);
  // Render a placeholder div; after insertion, mount Chart.js doughnut via wrRingMount()
  return '<div class="wr-ring" data-wr="' + wr + '" data-canvas="' + id + '">'
    + '<canvas id="' + id + '" width="48" height="48" style="position:absolute;top:0;left:0"></canvas>'
    + '<span class="wr-text ' + cls + '">' + wr + '%</span>'
    + '</div>';
}

// Call after HTML is inserted into DOM to paint all pending wr-ring canvases
function wrRingMountAll(container) {
  var rings = (container || document).querySelectorAll('.wr-ring[data-canvas]');
  rings.forEach(function(div) {
    var canvasId = div.getAttribute('data-canvas');
    var wr       = parseInt(div.getAttribute('data-wr'), 10);
    var canvas   = document.getElementById(canvasId);
    if (!canvas || canvas._chartMounted) return;
    canvas._chartMounted = true;
    div.removeAttribute('data-canvas');
    var col = wrHex(wr);
    new Chart(canvas, {
      type: 'doughnut',
      data: {
        datasets: [{
          data: [wr, 100 - wr],
          backgroundColor: wr >= 50
            ? ['rgba(48,209,88,0.9)',  'rgba(255,69,58,0.25)']
            : ['rgba(48,209,88,0.25)', 'rgba(255,69,58,0.9)'],
          borderWidth: 0,
          borderRadius: 3,
        }]
      },
      options: {
        cutout: '74%',
        animation: { duration: 600, easing: 'easeOutCubic' },
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        events: [],
      }
    });
  });
}
