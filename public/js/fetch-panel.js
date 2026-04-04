// Per-Player Panel Fetch
function startPlayerFetch(gameName, tagLine) {
  fetch("/fetch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ players: [gameName] }),
  })
    .then(function (r) { return r.json(); })
    .then(function () { pollFetchStatus(); });
}

// Deep Fetch Panel
var _fetchPollTimer = null;

function openFetchPanel() {
  document.getElementById("fetch-panel").classList.remove("hidden");
  document.body.style.overflow = "hidden";
  pollFetchStatus();
}

function closeFetchPanel() {
  document.getElementById("fetch-panel").classList.add("hidden");
  document.body.style.overflow = "";
  clearTimeout(_fetchPollTimer);
}

function startFetch() {
  fetch("/fetch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) })
    .then(function (r) { return r.json(); })
    .then(function () { pollFetchStatus(); });
}

function stopFetch() {
  fetch("/fetch", { method: "DELETE" })
    .then(function () { pollFetchStatus(); });
}

function pollFetchStatus() {
  clearTimeout(_fetchPollTimer);
  fetch("/fetch-status")
    .then(function (r) { return r.json(); })
    .then(function (data) {
      renderFetchStatus(data);
      if (data.running) _fetchPollTimer = setTimeout(pollFetchStatus, 2500);
    })
    .catch(function () { });
}

function renderFetchStatus(data) {
  var startBtn = document.getElementById("fetchStartBtn");
  var stopBtn = document.getElementById("fetchStopBtn");
  var label = document.getElementById("fetchStatusLabel");

  if (data.running) {
    startBtn.style.display = "none";
    stopBtn.style.display = "";
    label.textContent = "Running…";
    label.style.color = "var(--green)";
  } else {
    startBtn.style.display = "";
    stopBtn.style.display = "none";
    label.textContent = data.startedAt ? "Idle" : "";
    label.style.color = "var(--text3)";
  }

  var STATUS_ICON = { idle: "○", starting: "⟳", fetching: "⟳", done: "✓", error: "✕" };
  var STATUS_COLOR = { idle: "var(--text3)", starting: "var(--orange)", fetching: "var(--accent)", done: "var(--green)", error: "var(--red)" };
  var listHtml = "";
  var players = allData.length ? allData : [];
  for (var i = 0; i < players.length; i++) {
    var pl = players[i];
    var key = (pl.gameName + "#" + pl.tagLine).toLowerCase();
    var prog = data.progress && data.progress[key];
    var st = prog ? prog.status : "idle";
    var icon = STATUS_ICON[st] || "○";
    var color = STATUS_COLOR[st] || "var(--text3)";
    var newBadge = prog && prog.newThisRun > 0 ? '<span class="fetch-new-badge">+' + prog.newThisRun + ' new</span>' : "";
    var cached = prog ? prog.fetched || 0 : 0;
    var isFetching = st === "fetching" || st === "starting";
    var btnLabel = isFetching ? "⟳ Fetching…" : (st === "done" ? "↻ Update" : "▶ Fetch");
    var btnDisabled = (data.running && !isFetching) ? 'disabled title="Another fetch is running"' : (isFetching ? "disabled" : "");
    listHtml += '<div class="fetch-player-row">'
      + '<span class="fetch-player-icon" style="color:' + color + '">' + icon + '</span>'
      + '<span class="fetch-player-name">' + pl.gameName + '</span>'
      + '<span class="fetch-player-count">' + cached + ' games cached</span>'
      + newBadge
      + '<button class="fetch-player-btn" onclick="startPlayerFetch(\'' + pl.gameName + '\',\'' + pl.tagLine + '\')" ' + btnDisabled + '>' + btnLabel + '</button>'
      + '</div>';
  }
  document.getElementById("fetchProgressList").innerHTML = listHtml || '<div style="color:var(--text3);font-size:0.8rem;padding:8px 0">Loading players…</div>';

  if (data.log && data.log.length) {
    var logEl = document.getElementById("fetchLog");
    logEl.innerHTML = data.log.slice().reverse().map(function (l) {
      return '<div class="fetch-log-line">' + l + '</div>';
    }).join("");
  }
}
