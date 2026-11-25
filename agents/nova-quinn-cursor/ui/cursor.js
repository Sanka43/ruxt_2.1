(() => {
  const $ = (s, root = document) => root.querySelector(s);
  const API = "/api/agent/nova-quinn-cursor";
  const state = { pending: null, project: null, pollTimer: null };

  function note(text) {
    if ($("#note")) $("#note").textContent = text;
  }

  function live(text) {
    if ($("#liveBox")) $("#liveBox").textContent = text;
  }

  function steps(html) {
    if ($("#stepList")) $("#stepList").innerHTML = html;
  }

  async function api(route, body) {
    const response = await fetch(`${API}${route}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {})
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.error) throw Error(payload.error || "Request failed.");
    return payload;
  }

  function current() {
    return {
      name: $("#projectName")?.value.trim() || "cursor-project",
      prompt: $("#promptInput")?.value.trim() || "",
      mode: $("#modeSelect")?.value || "agent"
    };
  }

  function renderSession(session) {
    if (!session) return;
    const lines = (session.log || []).map((item) => item.text).filter(Boolean);
    live([
      session.lastStatus || "…",
      "",
      lines.slice(-18).join("\n")
    ].filter((part, i, arr) => part || arr[i - 1]).join("\n") || "Ready.");

    if (session.running) {
      steps(`
        <li class="done">Prompt ready</li>
        <li class="done">Permission granted</li>
        <li class="active">Cursor Agent running (${session.mode})</li>`);
      if ($("#prepareBtn")) {
        $("#prepareBtn").disabled = true;
        $("#prepareBtn").textContent = "Running…";
      }
    } else if (session.finishedAt || (session.log || []).length) {
      steps(`
        <li class="done">Prompt ready</li>
        <li class="done">Permission granted</li>
        <li class="done">${session.error ? "Run ended with an issue" : "Cursor Agent finished"}</li>`);
      if ($("#prepareBtn")) {
        $("#prepareBtn").disabled = false;
        $("#prepareBtn").textContent = "Prepare run";
      }
      if (session.error) note(session.error);
      else if (session.lastStatus) note(session.lastStatus);
    }
  }

  function startPolling() {
    clearInterval(state.pollTimer);
    state.pollTimer = setInterval(async () => {
      try {
        const payload = await api("/status", {});
        renderSession(payload.session);
        if (!payload.session?.running) clearInterval(state.pollTimer);
      } catch (_) {}
    }, 1400);
  }

  async function refreshStatus() {
    try {
      const payload = await api("/status", {});
      const status = $("#toolStatus");
      if (status) {
        if (payload.available) {
          status.textContent = payload.runningApp ? "Cursor open" : "Cursor ready";
          status.classList.add("ready");
        } else {
          status.textContent = "Cursor missing";
          status.classList.remove("ready");
        }
      }
      renderSession(payload.session);
    } catch (_) {
      note("Could not check Cursor status.");
    }
  }

  function showPermission(preview) {
    state.pending = preview;
    if ($("#permissionPreview")) {
      $("#permissionPreview").textContent = [
        `Project: ${preview.name}`,
        `Mode: ${preview.mode}`,
        "",
        "Prompt:",
        preview.prompt
      ].join("\n");
    }
    if ($("#permissionCard")) $("#permissionCard").hidden = false;
    note("Permission needed on this RuXt page before Cursor Agent starts.");
    steps(`
      <li class="done">Prompt ready</li>
      <li class="active">Waiting for permission</li>
      <li>Cursor Agent executes</li>`);
  }

  function hidePermission() {
    state.pending = null;
    if ($("#permissionCard")) $("#permissionCard").hidden = true;
  }

  async function prepare() {
    const data = current();
    if (!data.prompt) {
      note("Write a coding prompt first.");
      return;
    }
    try {
      const payload = await api("/launch", { ...data, confirmed: false });
      if (payload.needsPermission) {
        showPermission(payload.preview || data);
        return;
      }
      note(payload.message || "Ready.");
    } catch (error) {
      note(error.message || "Could not prepare Cursor run.");
    }
  }

  async function allowAndRun() {
    const pending = state.pending || current();
    if (!pending.prompt) {
      note("Nothing to approve.");
      return;
    }
    if ($("#allowBtn")) $("#allowBtn").disabled = true;
    if ($("#prepareBtn")) {
      $("#prepareBtn").disabled = true;
      $("#prepareBtn").textContent = "Launching…";
    }
    note("Permission granted. Launching Cursor Agent…");
    try {
      const payload = await api("/launch", {
        name: pending.name,
        prompt: pending.prompt,
        mode: pending.mode,
        confirmed: true
      });
      hidePermission();
      state.project = payload.project;
      if ($("#openFolderBtn")) $("#openFolderBtn").disabled = false;
      if ($("#openCursorBtn")) $("#openCursorBtn").disabled = false;
      note(payload.message || "Cursor Agent started.");
      renderSession(payload.session);
      startPolling();
    } catch (error) {
      note(error.message || "Could not start Cursor Agent.");
      live(error.message || "Launch failed.");
      if ($("#prepareBtn")) {
        $("#prepareBtn").disabled = false;
        $("#prepareBtn").textContent = "Prepare run";
      }
    } finally {
      if ($("#allowBtn")) $("#allowBtn").disabled = false;
    }
  }

  function deny() {
    hidePermission();
    note("Permission denied. Cursor was not launched.");
    steps(`
      <li>Write project + prompt</li>
      <li>Ask permission here</li>
      <li>Cursor Agent executes</li>`);
    live("Ready.");
  }

  async function stopRun() {
    try {
      const payload = await api("/stop", {});
      note(payload.message || "Stopping…");
      renderSession(payload.session);
    } catch (error) {
      note(error.message || "Could not stop.");
    }
  }

  async function openFolder() {
    if (!state.project?.path) return;
    try {
      // Reuse Cursor open with Finder via open-folder equivalent: open in Cursor is enough;
      // also ask OS to reveal via open route when path given.
      await api("/open", { path: state.project.path });
      note(`Opened Cursor on ${state.project.path}`);
    } catch (error) {
      note(error.message || "Could not open project.");
    }
  }

  $("#prepareBtn")?.addEventListener("click", prepare);
  $("#allowBtn")?.addEventListener("click", allowAndRun);
  $("#denyBtn")?.addEventListener("click", deny);
  $("#refreshBtn")?.addEventListener("click", refreshStatus);
  $("#stopBtn")?.addEventListener("click", stopRun);
  $("#openCursorBtn")?.addEventListener("click", openFolder);
  $("#openFolderBtn")?.addEventListener("click", openFolder);

  refreshStatus();
})();
