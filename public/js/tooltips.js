// Badge Tooltip Engine
(function () {
  var tip = document.createElement("div");
  tip.id = "badge-tip";
  tip.setAttribute("aria-hidden", "true");
  document.body.appendChild(tip);

  var showTimer, hideTimer;
  var currentTarget = null;

  var accentMap = {
    'badge-live': '#ff6058',
    'badge-feeder': '#ef4444',
    'badge-feeder-soft': '#f97316',
    'badge-godlike': '#f59e0b',
    'badge-carry': '#3b82f6',
    'badge-slayer': '#dc2626',
    'badge-hyper': '#7c3aed',
    'badge-support': '#06b6d4',
    'badge-smurf': '#ec4899',
    'badge-climbing': '#10b981',
    'badge-consistent': '#22c55e',
    'badge-hardstuck': '#f97316',
    'badge-trenches': '#94a3b8',
    'badge-grinder': '#94a3b8',
    'badge-fresh': '#34d399',
    'badge-streak': '#fb923c',
    'badge-neutral': '#64748b'
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
