/* ── Dev Auth Gate ── */
(function() {
  var _PW = "qan38amy";
  var _pendingCb = null;

  window._devAuthGate = function(cb) {
    _pendingCb = cb;
    var modal = document.getElementById("dev-auth-modal");
    var input = document.getElementById("dev-auth-input");
    var err   = document.getElementById("dev-auth-error");
    err.classList.add("hidden");
    input.value = "";
    modal.classList.remove("hidden");
    setTimeout(function() { input.focus(); }, 80);
  };

  window._devAuthSubmit = function() {
    var input = document.getElementById("dev-auth-input");
    var err   = document.getElementById("dev-auth-error");
    if (input.value === _PW) {
      document.getElementById("dev-auth-modal").classList.add("hidden");
      if (_pendingCb) { var cb = _pendingCb; _pendingCb = null; cb(); }
    } else {
      err.classList.remove("hidden");
      input.value = "";
      input.focus();
    }
  };

  window._devAuthCancel = function() {
    _pendingCb = null;
    document.getElementById("dev-auth-modal").classList.add("hidden");
  };

  // Allow Enter key to submit
  document.addEventListener("keydown", function(e) {
    var modal = document.getElementById("dev-auth-modal");
    if (modal && !modal.classList.contains("hidden")) {
      if (e.key === "Enter") _devAuthSubmit();
      if (e.key === "Escape") _devAuthCancel();
    }
  });
})();
