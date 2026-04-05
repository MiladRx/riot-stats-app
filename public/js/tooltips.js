// Badge Tooltip Engine
(function () {
  var tip = document.createElement("div");
  tip.id = "badge-tip";
  tip.setAttribute("aria-hidden", "true");
  document.body.appendChild(tip);

  var showTimer, hideTimer;
  var currentTarget = null;

  var accentMap = {
    'badge-live':         '#ff6058',
    'badge-feeder':       '#ef4444',
    'badge-feeder-soft':  '#f97316',
    'badge-glass-cannon': '#ff7a45',
    'badge-godlike':      '#f5c800',
    'badge-carry':        '#60b3ff',
    'badge-slayer':       '#ff7055',
    'badge-ironwall':     '#90caf9',
    'badge-support':      '#34d0cc',
    'badge-smurf':        '#d08ef5',
    'badge-climbing':     '#34d399',
    'badge-consistent':   '#4ade80',
    'badge-hardstuck':    '#ef6060',
    'badge-trenches':     '#fb923c',
    'badge-grinder':      '#b8a898',
    'badge-veteran':      '#d4956a',
    'badge-fresh':        '#6ee7b7',
    'badge-streak':       '#ffa726',
    'badge-phantom':      '#c0c8e8',
    'badge-assassin':     '#f06080',
    'badge-snowball':     '#67d5f8',
    'badge-underdog':     '#fb923c',
    'badge-committed':    '#a5b4fc',
    'badge-tilted':       '#fc8181',
    'badge-icecold':      '#2dd4bf',
    'badge-neutral':      '#64748b'
  };
  

  function show(el) {
    clearTimeout(hideTimer);
    var text = el.getAttribute("data-tip");
    if (!text) return;
    currentTarget = el;

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

    var margin = 12;
    left = Math.max(margin, Math.min(left, window.innerWidth - tw - margin));

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
