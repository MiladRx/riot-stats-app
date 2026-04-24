// ── Enhancements: GSAP · CountUp ─────────────────────────────────────────────
// Note: tooltips are handled by tooltips.js (badge-specific accent colors)

// ── CountUp helper ────────────────────────────────────────────────────────────
function animateCountUp(el, endVal, opts) {
  if (typeof CountUp === "undefined" || !el || isNaN(endVal)) return;
  var cu = new CountUp(el, endVal, Object.assign({
    duration: 1.2,
    useEasing: true,
    useGrouping: true,
    decimal: ".",
  }, opts || {}));
  if (!cu.error) cu.start();
}

// ── Board card animations ─────────────────────────────────────────────────────
function animateBoard(board) {
  if (typeof gsap === "undefined" || !board) return;

  var cards = board.querySelectorAll(".player-card");
  if (!cards.length) return;

  // Pause CSS animations temporarily so GSAP can control opacity/transform
  // Live cards keep their border-pulse — only suppress slideUp
  cards.forEach(function(c) {
    if (c.classList.contains("is-live")) {
      // Keep liveBorderPulse running, just reset position for GSAP
      c.style.opacity = "0";
      c.style.transform = "translateY(22px)";
    } else {
      c.style.animation = "none";
      c.style.opacity = "0";
      c.style.transform = "translateY(22px)";
    }
  });

  gsap.to(cards, {
    opacity: 1,
    y: 0,
    duration: 0.38,
    stagger: 0.045,
    ease: "power3.out",
    clearProps: "transform,opacity", // only clears transform+opacity, CSS animation stays intact
  });
}

// ── Number countup on visible card stats ─────────────────────────────────────
function animateCardNumbers(board) {
  if (typeof CountUp === "undefined" || !board) return;

  // Games count (.g-num)
  board.querySelectorAll(".g-num").forEach(function(el) {
    var v = parseInt(el.textContent, 10);
    if (!isNaN(v)) animateCountUp(el, v, { duration: 1.0 });
  });

  // Wins & losses
  board.querySelectorAll(".wl-numbers .w").forEach(function(el) {
    var v = parseInt(el.textContent, 10);
    if (!isNaN(v)) animateCountUp(el, v, {
      duration: 1.0,
      suffix: "W",
      formattingFn: function(n) { return Math.round(n) + "W"; },
    });
  });

  board.querySelectorAll(".wl-numbers .l").forEach(function(el) {
    var v = parseInt(el.textContent, 10);
    if (!isNaN(v)) animateCountUp(el, v, {
      duration: 1.0,
      formattingFn: function(n) { return Math.round(n) + "L"; },
    });
  });

  // Win rate text inside wr-ring
  board.querySelectorAll(".wr-text").forEach(function(el) {
    var v = parseInt(el.textContent, 10);
    if (!isNaN(v)) animateCountUp(el, v, {
      duration: 1.1,
      suffix: "%",
      formattingFn: function(n) { return Math.round(n) + "%"; },
    });
  });

  // LP
  board.querySelectorAll(".tier-lp").forEach(function(el) {
    var raw = el.textContent.trim();
    var v = parseInt(raw, 10);
    if (!isNaN(v)) animateCountUp(el, v, {
      duration: 1.0,
      suffix: " LP",
      formattingFn: function(n) { return Math.round(n) + " LP"; },
    });
  });
}

// ── Patch renderBoard to run enhancements after every render ─────────────────
(function() {
  var _originalRenderBoard = null;

  function waitForRenderBoard() {
    if (typeof renderBoard === "undefined") {
      setTimeout(waitForRenderBoard, 50);
      return;
    }
    _originalRenderBoard = renderBoard;

    window.renderBoard = function() {
      _originalRenderBoard();
      var board = document.getElementById("board");
      if (!board) return;
      animateBoard(board);
      animateCardNumbers(board);
    };
  }

  waitForRenderBoard();
})();

// ── GSAP: animate modals opening ─────────────────────────────────────────────
(function() {
  if (typeof gsap === "undefined") return;

  // Watch for modals becoming visible
  function animateModalPanel(panel) {
    if (!panel || panel._gsapAnimated) return;
    panel._gsapAnimated = true;
    gsap.fromTo(panel,
      { opacity: 0, scale: 0.93, y: 20 },
      { opacity: 1, scale: 1, y: 0, duration: 0.32, ease: "power3.out",
        onComplete: function() { panel._gsapAnimated = false; }
      }
    );
  }

  var modalSelectors = [
    ".fd-panel", ".pr-panel",
    ".ch-panel", ".compare-panel", ".dev-auth-box"
  ];

  // Patch hidden→visible transitions
  var modalObs = new MutationObserver(function(mutations) {
    mutations.forEach(function(m) {
      if (m.type === "attributes" && m.attributeName === "class") {
        var el = m.target;
        var wasHidden = m.oldValue && m.oldValue.indexOf("hidden") !== -1;
        var nowVisible = !el.classList.contains("hidden");
        if (wasHidden && nowVisible) {
          modalSelectors.forEach(function(sel) {
            var panel = el.querySelector(sel);
            if (panel) animateModalPanel(panel);
          });
        }
      }
    });
  });

  document.querySelectorAll(".fd-modal, .pr-modal, .ch-modal, .compare-modal, .dev-auth-overlay")
    .forEach(function(modal) {
      modalObs.observe(modal, { attributes: true, attributeOldValue: true });
    });
})();

// ── GSAP: animate detail panel expand ────────────────────────────────────────
(function() {
  if (typeof gsap === "undefined") return;

  var _origToggle = null;

  function waitForToggle() {
    if (typeof togglePlayer === "undefined") {
      setTimeout(waitForToggle, 50);
      return;
    }
    _origToggle = togglePlayer;

    window.togglePlayer = function(idx) {
      var wasOpen = currentOpenIdx === idx;
      _origToggle(idx);

      if (!wasOpen) {
        requestAnimationFrame(function() {
          var card = document.getElementById("player-card-" + idx);
          if (!card) return;
          var detail = card.querySelector(".detail-wrapper");
          if (!detail) return;
          gsap.fromTo(detail,
            { opacity: 0, y: -6 },
            { opacity: 1, y: 0, duration: 0.2, ease: "power2.out" }
          );
        });
      }
    };
  }

  waitForToggle();
})();

// ── Header entrance animation ─────────────────────────────────────────────────
(function() {
  if (typeof gsap === "undefined") return;
  window.addEventListener("load", function() {
    gsap.fromTo("header",
      { opacity: 0, y: -16 },
      { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" }
    );
    gsap.fromTo(".board-filter-bar",
      { opacity: 0, y: -8 },
      { opacity: 1, y: 0, duration: 0.4, ease: "power3.out", delay: 0.15 }
    );
    gsap.fromTo(".lb-header",
      { opacity: 0 },
      { opacity: 1, duration: 0.35, ease: "power2.out", delay: 0.25 }
    );
  });
})();
