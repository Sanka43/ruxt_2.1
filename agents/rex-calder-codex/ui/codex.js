(() => {
  const $ = (s, root = document) => root.querySelector(s);
  const state = { project: null };

  function note(text) {
    const el = $("#launchNote");
    if (el) el.textContent = text;
  }

  function syncPreview() {
    const prompt = $("#projectGoal")?.value.trim() || "";
    const preview = $("#promptPreview");
    if (preview) preview.textContent = prompt || "Your prompt will appear here.";
  }

  async function api(path, body) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {})
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.error) throw Error(payload.error || "Request failed.");
    return payload;
  }

  async function refreshStatus() {
    try {
      const payload = await (await fetch("/api/tools")).json();
      const codex = (payload.tools || []).find((tool) => tool.id === "codex");
      const status = $("#toolStatus");
      if (!status) return;
      if (codex?.connected || codex?.state === "ready" || codex?.state === "connected") {
        status.textContent = "Codex ready";
        status.classList.add("ready");
      } else {
        status.textContent = codex?.label || "Codex missing";
        status.classList.remove("ready");
      }
    } catch (_) {
      note("Could not check Codex status.");
    }
  }

  async function launchCodexWithPrompt() {
    const name = $("#projectName")?.value.trim() || "";
    const prompt = $("#projectGoal")?.value.trim() || "";
    if (!name) {
      note("Add a project name first.");
      return;
    }
    if (!prompt) {
      note("Write the prompt you want Codex to receive.");
      return;
    }
    const btn = $("#launchCodexBtn");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Opening Codex…";
    }
    note("Creating project, opening Codex, and sending your prompt…");
    try {
      const payload = await api("/api/codex/launch", { name, prompt });
      state.project = payload.project;
      if ($("#openFolderBtn")) $("#openFolderBtn").disabled = false;
      note(payload.launch?.message || "Codex opened with your prompt.");
      const steps = $("#stepList");
      if (steps) {
        steps.innerHTML = `
          <li class="done">Created project at ${escapeHtml(payload.project?.path || "")}</li>
          <li class="done">Opened Codex on that project</li>
          <li class="done">Started Codex with your prompt</li>`;
      }
    } catch (error) {
      note(error.message || "Could not open Codex with your prompt.");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Open Codex with this prompt";
      }
      await refreshStatus();
    }
  }

  async function openFolder() {
    if (!state.project?.path) return;
    try {
      const payload = await api("/api/codex/open-folder", { path: state.project.path });
      note(payload.message || `Opened ${state.project.path}`);
    } catch (error) {
      note(error.message || "Could not open folder.");
    }
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  $("#launchCodexBtn")?.addEventListener("click", launchCodexWithPrompt);
  $("#refreshStatusBtn")?.addEventListener("click", refreshStatus);
  $("#openFolderBtn")?.addEventListener("click", openFolder);
  $("#projectGoal")?.addEventListener("input", syncPreview);
  $("#projectName")?.addEventListener("input", syncPreview);

  syncPreview();
  refreshStatus();
})();
