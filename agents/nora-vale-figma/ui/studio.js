(() => {
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (sel) => [...document.querySelectorAll(sel)];
  const AGENT_ID = document.body.dataset.agentId || "nora-vale-figma";
  const STORE_KEY = `${AGENT_ID}-chats-v2`;
  const DESKTOP_HANDOFF = document.body.dataset.desktopHandoff === "true";
  const API = `/api/agent/${AGENT_ID}`;
  const ALLOW_SUPERVISORS = true; // mirrors manifest.allowSupervisors

  const TEMPLATES = [
    {
      id: "mobile",
      name: "Mobile app flow",
      blurb: "A polished flow with connected screens.",
      prompt: "Create a polished mobile app flow in Figma with a home screen, detail screen, and clickable prototype.",
      chips: ["Add an onboarding screen", "Use a dark theme", "Add an empty state"]
    },
    {
      id: "landing",
      name: "Landing page",
      blurb: "A clear marketing page with a strong CTA.",
      prompt: "Design a modern landing page in Figma with a clear hero, benefits, social proof, and call to action.",
      chips: ["Add pricing cards", "Try a warmer palette", "Make it responsive"]
    },
    {
      id: "dashboard",
      name: "Product dashboard",
      blurb: "An app dashboard with useful states.",
      prompt: "Create a clean analytics dashboard in Figma with navigation, summary cards, a chart, and an empty state.",
      chips: ["Add a mobile layout", "Add a loading state", "Use a compact density"]
    },
    {
      id: "system",
      name: "Design system",
      blurb: "Tokens and reusable components.",
      prompt: "Create a compact Figma design system with color tokens, typography, buttons, inputs, and reusable cards.",
      chips: ["Add form states", "Add a data table", "Create a component page"]
    },
    {
      id: "prototype",
      name: "Prototype review",
      blurb: "Turn an idea into a testable interaction.",
      prompt: "Turn this product idea into a focused Figma prototype with the key interaction states and a clear review path.",
      chips: ["Add a success state", "Add a back path", "Make the tap targets clearer"]
    },
    {
      id: "fix",
      name: "Open brief",
      blurb: "Start blank — tell Nora what you want designed.",
      prompt: "",
      chips: ["Create a settings screen", "Design a checkout flow", "Make a responsive card"]
    }
  ];

  const SEED_CHATS = [
    {
      id: "seed-mobile",
      name: "Mobile onboarding flow",
      templateId: "mobile",
      createdAt: Date.now() - 86400000 * 2,
      updatedAt: Date.now() - 86400000 * 2,
      status: "done",
      outputFile: null,
      lastResult: "A mobile onboarding flow with a clear first-run path.",
      messages: [
        { from: "nora", text: "The mobile flow is open — tell me which part of the experience you want to shape.", at: "Yesterday" },
        { from: "you", text: "Make the onboarding feel calm and easy to finish.", at: "Yesterday" },
        { from: "nora", text: "Done — the first-run path is clearer, with a focused CTA and a gentle exit path.", at: "Yesterday", result: true }
      ]
    },
    {
      id: "seed-dashboard",
      name: "Analytics dashboard",
      templateId: "dashboard",
      createdAt: Date.now() - 86400000 * 5,
      updatedAt: Date.now() - 86400000 * 4,
      status: "done",
      outputFile: null,
      lastResult: "A dashboard with summary cards, chart hierarchy, and empty state.",
      messages: [
        { from: "nora", text: "The dashboard workspace is ready. Which signal should be easiest to scan first?", at: "5 days ago" },
        { from: "you", text: "Make the weekly trend the visual anchor.", at: "5 days ago" },
        { from: "nora", text: "Done — the weekly trend leads, while the supporting cards stay easy to compare.", at: "4 days ago", result: true }
      ]
    },
    {
      id: "seed-system",
      name: "Core design system",
      templateId: "system",
      createdAt: Date.now() - 86400000 * 1,
      updatedAt: Date.now() - 1000,
      status: "done",
      outputFile: null,
      lastResult: "A compact token and component foundation for the product.",
      messages: [
        { from: "nora", text: "The system workspace is open — I’m ready to make the foundation reusable.", at: "Today" },
        { from: "you", text: "Start with type, color, buttons, and cards.", at: "Today" },
        { from: "nora", text: "Done — the core tokens and components are organized for the next screens.", at: "Today", result: true }
      ]
    }
  ];

  const state = {
    side: "chats",
    chats: [],
    activeId: null,
    selectedTemplate: "prop",
    busy: false,
    figma: null,
    supervisor: null,
    supervisors: [],
    allowSupervisors: ALLOW_SUPERVISORS,
    timedOutTaskIds: new Set(),
    finalizedTaskIds: new Set(),
    userName: "there",
    stopRequested: false,
    currentTaskId: null
    ,historyLimit: 12
  };

  function uid(prefix = "chat") {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  }

  // Normalize relative, absolute, and Markdown-linked Figma paths.
  function extractFigmaPath(text) {
    const raw = String(text || "");
    const match = raw.match(/(?:^|[(`\s])((?:[A-Za-z]:[\\/]|\/)?[^)\]`"\s]*outputs[\\/]figma-projects[\\/][^)\]`"\s]+\.(?:fig|figma))/i);
    if (!match) return null;
    const value = match[1].replace(/\\/g, "/");
    const index = value.toLowerCase().lastIndexOf("outputs/");
    return index >= 0 ? value.slice(index) : value;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function loadChats() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
      if (raw?.supervisor) state.supervisor = raw.supervisor;
      if (Array.isArray(raw?.chats) && raw.chats.length) {
        state.chats = raw.chats;
        return;
      }
      const legacy = JSON.parse(localStorage.getItem("nora-vale-figma-chats-v1") || "null");
      if (Array.isArray(legacy?.chats) && legacy.chats.length) {
        state.chats = legacy.chats;
        if (legacy.supervisor) state.supervisor = legacy.supervisor;
        saveChats();
        return;
      }
    } catch (_) {}
    state.chats = SEED_CHATS.map((item) => ({ ...item, messages: item.messages.map((m) => ({ ...m })) }));
    saveChats();
  }

  function saveChats() {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      chats: state.chats,
      supervisor: state.supervisor,
      savedAt: Date.now()
    }));
  }

  function templateById(id) {
    return TEMPLATES.find((item) => item.id === id) || TEMPLATES[0];
  }

  function activeChat() {
    return state.chats.find((item) => item.id === state.activeId) || null;
  }

  function latestChat() {
    return [...state.chats].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0] || null;
  }

  // Generate a useful compact title locally from the user's request. This
  // avoids an extra model call while still making the archive understandable.
  function smartChatTitle(prompt, fallback = "Figma project") {
    const clean = String(prompt || "").replace(/https?:\/\/\S+/g, "").replace(/[^\w\s'-]/g, " ").replace(/\s+/g, " ").trim();
    if (!clean) return fallback;
    const words = clean.split(" ").slice(0, 6);
    const title = words.join(" ");
    return title.length > 42 ? `${title.slice(0, 39).trim()}…` : title.charAt(0).toUpperCase() + title.slice(1);
  }

  function showSide(name) {
    state.side = name;
    document.body.classList.toggle("history-mode", name === "history");
    const heading = $("#chatListHeading");
    if (heading) heading.textContent = name === "history" ? "All Chats" : "Latest Chats";
    const allChats = $("#allChatsBtn");
    if (allChats) {
      allChats.textContent = name === "history" ? "Load more chats ↓" : "All Chats  →";
      allChats.classList.toggle("history-load", name === "history");
      allChats.hidden = false;
      allChats.disabled = name === "history" && state.historyLimit >= state.chats.length;
    }
    if ($("#pageChats")) $("#pageChats").hidden = !["chats", "history"].includes(name);
    if ($("#pageNew")) $("#pageNew").hidden = name !== "new";
    if ($("#pageSupervisor")) $("#pageSupervisor").hidden = name !== "supervisor";
  }

  function setPresence(text) {
    const raw = String(text || "");
    const inactive = /active now|waiting for you/i.test(raw);
    // Keep live status natural. Nora addresses the user in chat messages,
    // rather than repeating their name on every activity update.
    const displayText = raw;
    if ($("#presence")) $("#presence").textContent = displayText;
    const strip = $("#thinkingStrip");
    if (strip) {
      strip.hidden = inactive && !state.busy;
      if ($("#thinkingText")) $("#thinkingText").textContent = displayText || "I’m here with you.";
    }
  }

  function userAddress() {
    return state.userName && state.userName !== "there" ? state.userName : "there";
  }

  function caringError(message) {
    const text = String(message || "Something took longer than expected.").trim();
    if (/failed to fetch|networkerror|load failed/i.test(text)) {
      return `I’m sorry, ${userAddress()}. I briefly lost the local RuXt connection while I was working. The task may still be running; please reopen Nora or check Activities before starting it again.`;
    }
    return `I’m sorry, ${userAddress()}. ${text}`;
  }

  function setWorkingOverlay(on, status = "I’m working in Figma — I’ll call you once it’s done.") {
    // A late status-poll response must never resurrect the popup after a stop.
    if (on && state.stopRequested) on = false;
    const overlay = $("#workingOverlay");
    // Work progress belongs to the native Figma window, not Nora's chat or
    // the RuXt dashboard. Keep the legacy element hidden for old packages.
    if (overlay) overlay.hidden = true;
    if ($("#workingOverlayStatus")) $("#workingOverlayStatus").textContent = status;
    document.body.classList.remove("working-lock");
    fetch(`${API}/working-dialog`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ show: Boolean(on), status, taskId: state.currentTaskId || state.workingChat?.taskId || null })
    }).catch(() => {});
    try {
      if (window.parent && window.parent !== window) window.parent.postMessage({ type: "ruxt:agent-working", agentId: AGENT_ID, busy: Boolean(on), status }, "*");
    } catch (_) {}
  }

  async function reconcileWorkingDialog() {
    // A native popup can outlive an iframe reload. Only keep it open when the
    // server still has an active task for this agent; otherwise clear the stale
    // process and release the parent dashboard immediately.
    try {
      const tasks = await (await fetch("/api/tasks", { cache: "no-store" })).json();
      const active = Array.isArray(tasks) && tasks.find((task) => task.agent === AGENT_ID && ["running", "pending", "working"].includes(task.status));
      if (active) {
        setWorkingOverlay(true, active.lastStatus || "I’m still working in Figma — I’ll call you once it’s done.");
      } else {
        setWorkingOverlay(false);
      }
    } catch (_) {
      // If task state cannot be read, fail open for navigation and remove stale
      // UI state rather than leaving the user trapped behind a popup.
      setWorkingOverlay(false);
    }
  }

  function setTyping(on) {
    if ($("#typing")) $("#typing").hidden = !on;
    if (on) setPresence("Nora is typing…");
    else if (!state.busy) setPresence("Active now · Waiting for you");
  }

  function estimateMinutes(prompt) {
    const text = String(prompt || "").toLowerCase();
    if (/animation|animate|render|character|scene|texture|lighting|material/.test(text)) return 10;
    return 5;
  }

  async function cancelFigmaTask(taskId) {
    const response = await fetch(`${API}/cancel`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId })
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw Error(result.message || "The bridge could not confirm the stop.");
  }

  async function stopCurrentWork() {
    const chat = state.workingChat;
    if (!chat || !state.busy || state.stopRequested) return;
    state.stopRequested = true;
    setComposerEnabled(true);
    try {
      if (state.currentTaskId) {
        state.finalizedTaskIds.add(state.currentTaskId);
        await cancelFigmaTask(state.currentTaskId);
      }
      else if (state.handoffPending) await state.handoffPending;
    } catch (error) {
      state.finalizedTaskIds.delete(state.currentTaskId);
      state.stopRequested = false;
      chat.messages.push({ from: "nora", text: error.message, at: "Just now" });
      saveChats();
      renderChat();
      setComposerEnabled(true);
      return;
    }
    chat.status = "stopped";
    chat.taskId = null;
    chat.updatedAt = Date.now();
    chat.messages.push({ from: "nora", text: "I’ve stopped here. Let me know if you want me to pick this up again.", at: "Just now" });
    if (state.allowSupervisors && state.supervisor?.id) {
      chat.messages.push({ from: "supervisor", at: "Just now", text: pick([
        "Nora, put the bevel tool down. Yes, even the tiny one.",
        "Nora, step away from the canvas. The components can supervise themselves for a bit.",
        "Pencils down, Nora. I can still hear you clicking."
      ]) });
    }
    saveChats();
    setWorkingOverlay(false);
    setTyping(false);
    renderChat();
  }

  async function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function wantsFigmaWork(prompt, options = {}) {
    if (options.forceTask || options.continuation || options.mode === "fix") return true;
    const p = String(prompt || "").toLowerCase();
    if (/\b(hi|hello|hey|thanks|thank you|good morning|good evening|who are you|what can you do)\b/.test(p) && p.split(/\s+/).length < 7) return false;
    // Short object requests are still real build requests. Users should be
    // able to say “rabbit”, “colorful balls”, or “creare a rabbit” naturally;
    // do not force them through a clarification loop before opening Figma.
    return /\b(make|create|creare|build|built|model|draw|design|illustrat|animate|animation|add|update|fix|change|render|export|figma|mesh|rig|scene|prop|character|rabbit|animal|bird|fish|flower|tree|house|cube|sphere|cylinder|cone|torus|lamp|mug|ball|butterfly|camera|light|material|texture|fly|wing|warm|colorful)\b/.test(p)
      || (p.split(/\s+/).length <= 5 && !/[?]/.test(p) && p.length >= 3);
  }

  async function refreshFigmaStatus() {
    try {
      const res = await fetch(`${API}/status`);
      state.figma = await res.json();
    } catch (_) {
      state.figma = { installed: false, message: "Couldn’t reach the Figma bridge." };
    }
    renderFigmaCard();
    renderAgentWidgets();
  }

  function renderFigmaCard() {
    const card = $("#figmaCard");
    if (!card) return;
    const info = state.figma || {};
    const ready = Boolean(info.installed && info.desktopControl);
    const installedWithoutBridge = Boolean(info.installed && !info.desktopControl);
    const focusing = Boolean(info.focusing || info.job?.running);
    card.classList.toggle("ready", ready && !focusing);
    card.classList.toggle("needs-bridge", installedWithoutBridge && !focusing);
    card.classList.toggle("focusing", focusing);
    $("#figmaTitle").textContent = focusing
      ? "Working in Figma"
      : ready ? "Figma ready" : installedWithoutBridge ? "Figma installed · bridge needed" : "Figma not found";
    $("#figmaNote").textContent = focusing
      ? (info.job?.status || "Codex CLI MCP computer-use is working in Figma.")
        : installedWithoutBridge
        ? (info.capabilityMessage || (info.pluginImported ? "My plugin is installed. Run it in this Figma file; you do not need to reinstall it." : "Figma is installed, but my plugin is not running in this file."))
        : ready
        ? (info.connection || (info.bin ? `Using ${info.bin}` : "Figma app is available on this Mac."))
        : (info.brew
          ? "I can try installing via Homebrew when you ask."
          : "Install Figma, or let me try Homebrew if it’s available.");
  }

  function renderStats() {
    if (!$("#chatStats")) return;
    const done = state.chats.filter((p) => p.status === "done").length;
    const open = state.chats.filter((p) => p.status !== "done").length;
    $("#chatStats").innerHTML = `
      <div class="stat"><b>${state.chats.length}</b><span>Chats</span></div>
      <div class="stat"><b>${done}</b><span>Ready</span></div>
      <div class="stat"><b>${open}</b><span>Waiting</span></div>
      <div class="stat"><b>${TEMPLATES.length}</b><span>Starters</span></div>`;
  }

  function renderTemplates() {
    $("#templateGrid").innerHTML = TEMPLATES.map((tpl) => `
      <button type="button" class="template-card" data-template="${tpl.id}">
        <strong>${escapeHtml(tpl.name)}</strong>
        <p>${escapeHtml(tpl.blurb)}</p>
      </button>`).join("");

    $("#templatePick").innerHTML = TEMPLATES.map((tpl) => `
      <button type="button" class="template-card${tpl.id === state.selectedTemplate ? " active" : ""}" data-pick="${tpl.id}">
        <strong>${escapeHtml(tpl.name)}</strong>
        <p>${escapeHtml(tpl.blurb)}</p>
      </button>`).join("");

    $$("[data-template]").forEach((btn) => {
      btn.onclick = () => {
        state.selectedTemplate = btn.dataset.template;
        const tpl = templateById(state.selectedTemplate);
        $("#newName").value = tpl.name;
        $("#newBrief").value = "";
        showSide("new");
        renderTemplates();
      };
    });
    $$("[data-pick]").forEach((btn) => {
      btn.onclick = () => {
        state.selectedTemplate = btn.dataset.pick;
        const tpl = templateById(state.selectedTemplate);
        if (!$("#newName").value.trim()) $("#newName").value = tpl.name;
        renderTemplates();
      };
    });
  }

  function renderChatList() {
    const list = [...state.chats].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    if (!list.length) {
      $("#chatList").innerHTML = `<div class="empty">No chats yet. Start one with a Figma starter.</div>`;
      return;
    }
    const visibleChats = state.side === "history" ? list.slice(0, state.historyLimit) : list.slice(0, 6);
    $("#chatList").innerHTML = visibleChats.map((chat) => {
      const tpl = templateById(chat.templateId);
      const when = new Date(chat.updatedAt || chat.createdAt).toLocaleDateString();
      const active = chat.id === state.activeId ? " active" : "";
      return `<div class="chat-card${active}" data-chat-card="${chat.id}"><button type="button" class="chat-open" data-open="${chat.id}">
        <strong>${escapeHtml(chat.displayTitle || chat.name)}</strong><span class="chat-inline-meta">${chat.status === "done" ? "Ready" : "Waiting"} · ${escapeHtml(when)}</span>
      </button><button type="button" class="chat-delete" data-delete-chat="${chat.id}" aria-label="Delete ${escapeHtml(chat.name)}">×</button></div>`;
    }).join("");
    $$("[data-open]").forEach((btn) => {
      btn.onclick = () => openChat(btn.dataset.open);
    });
    $$(`[data-delete-chat]`).forEach((btn) => {
      btn.onclick = (event) => {
        event.stopPropagation();
        const chat = state.chats.find((item) => item.id === btn.dataset.deleteChat);
        if (!chat || !window.confirm(`Delete “${chat.name}”? This removes its local chat history.`)) return;
        state.chats = state.chats.filter((item) => item.id !== chat.id);
        if (state.activeId === chat.id) state.activeId = state.chats[0]?.id || null;
        saveChats(); renderChatList(); renderChat(); renderStats();
      };
    });
  }

  async function loadSupervisors() {
    if (!state.allowSupervisors) {
      state.supervisors = [];
      return;
    }
    try {
      const payload = await (await fetch("/api/supervisors")).json();
      state.supervisors = Array.isArray(payload.supervisors) ? payload.supervisors : [];
    } catch (_) {
      state.supervisors = [];
    }
  }

  function renderSupervisorCard() {
    const card = $("#supervisorCard");
    const slot = $("#supervisorSlot");
    if (!slot) return;
    const nav = $("#navSupervisorBtn");
    if (!state.allowSupervisors) {
      if (card) card.hidden = true;
      if (nav) nav.hidden = true;
      return;
    }
    if (card) card.hidden = false;
    if (nav) nav.hidden = false;
    if (!state.supervisor) {
      slot.innerHTML = `
        <strong>No supervisor</strong>
        <p>Add any installed supervisor agent to rate Nora’s finished work.</p>
        <button type="button" class="soft" id="addSupervisorBtn">Add supervisor</button>`;
      $("#addSupervisorBtn")?.addEventListener("click", openSupervisorPicker);
      return;
    }
    const s = state.supervisor;
    slot.innerHTML = `
      <div class="supervisor-active">
        <img src="${escapeHtml(s.avatar || `/agents/${s.id}/avatar.jpg`)}" alt="" />
        <div>
          <strong>${escapeHtml(s.name)}</strong>
          <p>${escapeHtml(s.role || "Supervisor")} · Rates Nora’s completed work</p>
        </div>
        <div class="supervisor-actions">
          <button type="button" class="ghost" id="changeSupervisorBtn">Change</button>
          <button type="button" class="ghost" id="removeSupervisorBtn">Remove</button>
        </div>
      </div>`;
    $("#changeSupervisorBtn")?.addEventListener("click", openSupervisorPicker);
    $("#removeSupervisorBtn")?.addEventListener("click", () => {
      state.supervisor = null;
      saveChats();
      renderSupervisorCard();
    });
  }

  async function openSupervisorPicker() {
    if (!state.allowSupervisors) return;
    await loadSupervisors();
    showSide("supervisor");
    renderSupervisorPicker();
  }

  function renderSupervisorPicker() {
    const list = state.supervisors || [];
    $("#supervisorPick").innerHTML = list.map((item) => `
      <button type="button" class="supervisor-option" data-supervisor="${escapeHtml(item.id)}">
        <img src="${escapeHtml(item.avatar || `/agents/${item.id}/avatar.jpg`)}" alt="" />
        <div>
          <strong>${escapeHtml(item.name)}</strong>
          <span>${escapeHtml(item.blurb || item.role || "Supervisor")}</span>
        </div>
        <span class="soft" style="pointer-events:none;padding:8px 10px;border-radius:999px;">Add</span>
      </button>`).join("") || `<div class="empty">No supervisor agents installed yet. Create an agent package with <code>"supervisor": true</code> in manifest.json.</div>`;

    $$("[data-supervisor]").forEach((btn) => {
      btn.onclick = () => {
        const item = list.find((s) => s.id === btn.dataset.supervisor);
        if (!item) return;
        state.supervisor = { ...item };
        saveChats();
        renderSideChats();
        if (state.activeId) {
          supervisorSay("I’m watching Nora’s work now. When she finishes, I’ll rate it and comment — or ask her to recreate it if there’s an error.");
        }
      };
    });
  }

  function renderSideChats() {
    showSide("chats");
    renderStats();
    renderSupervisorCard();
    renderTemplates();
    renderChatList();
    renderAgentWidgets();
  }

  function renderAgentWidgets() {
    const grid = $("#widgetGrid");
    if (!grid) return;
    const info = state.figma || {};
    const software = info.desktopControl ? "Canvas connected" : info.installed ? "Plugin setup needed" : "Needs setup";
    grid.innerHTML = `
      <article class="agent-widget"><span class="widget-icon">⌘</span><div><strong>Software access</strong><p>${escapeHtml(software)}</p></div></article>
      <article class="agent-widget"><span class="widget-icon">◌</span><div><strong>Current project</strong><p>${escapeHtml(activeChat()?.name || "No chat selected")}</p></div></article>
      <article class="agent-widget"><span class="widget-icon">✦</span><div><strong>Agent memory</strong><p>Personal UAM · learning enabled</p></div></article>`;
  }

  function scrollChatToEnd() {
    const thread = $("#thread");
    if (!thread) return;
    requestAnimationFrame(() => { thread.scrollTop = thread.scrollHeight; });
  }

  function appendBubble({ from, text, at, html }) {
    const thread = $("#thread");
    if (!thread) return null;
    const empty = $("#emptyChat");
    if (empty) empty.remove();
    const row = document.createElement("div");
    row.className = `row ${from}`;
    if (from === "nora") {
      row.innerHTML = `<img src="../avatar.jpg" alt="" /><div class="bubble">${html || escapeHtml(text)}<span class="meta">${escapeHtml(at || "Just now")}</span></div>`;
    } else if (from === "supervisor") {
      const avatar = state.supervisor?.avatar || `/agents/${state.supervisor?.id || "donald-trump-supervisor"}/avatar.jpg`;
      const name = state.supervisor?.name || "Supervisor";
      row.innerHTML = `<img src="${escapeHtml(avatar)}" alt="" /><div class="bubble"><span class="supervisor-tag">${escapeHtml(name).toUpperCase()}</span>${html || escapeHtml(text)}<span class="meta">${escapeHtml(at || "Just now")}</span></div>`;
    } else {
      row.innerHTML = `<div class="bubble">${html || escapeHtml(text)}<span class="meta">${escapeHtml(at || "Just now")}</span></div>`;
    }
    thread.appendChild(row);
    scrollChatToEnd();
    return row;
  }

  function friendlyComplete(result, { hasSupervisor = false, supervisorName = "", canvasUpdated = false } = {}) {
    const soft = String(result || "All set.").trim();
    const lines = [
      canvasUpdated
        ? "Done — I finished the design in the open Figma file and verified the canvas update."
        : "Done — I’ve finished your request and posted the Figma work below with a download link.",
      soft.length > 360 ? `${soft.slice(0, 340).trim()}…` : soft
    ];
    if (hasSupervisor) {
      lines.push(`${supervisorName || "Your supervisor"} verified the result before I delivered it.`);
    } else {
      lines.push("Download it, ask me to modify, or leave feedback. I won’t keep going unless you ask.");
    }
    return lines.join("\n\n");
  }

  function notifyParentWork({ prompt, result, outputFile, canvasUpdated = false }) {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({
          type: "ruxt:work-complete",
          agentId: AGENT_ID,
          prompt: String(prompt || "").trim(),
          result: String(result || "").trim(),
          outputFile: outputFile || null,
          canvasUpdated: Boolean(canvasUpdated)
        }, "*");
      }
    } catch (_) {}
  }

  async function postCompletedWork({ taskId, title, prompt, result, outputFile, canvasUpdated = false }) {
    try {
      const res = await fetch("/api/work-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: AGENT_ID,
          taskId,
          title: title || "Nora Vale work",
          prompt,
          result,
          outputFile: outputFile || null,
          canvasUpdated: Boolean(canvasUpdated)
        })
      });
      const payload = await res.json();
      if (!res.ok || payload.error) throw Error(payload.error || "Could not post work.");
      notifyParentWork({ prompt, result, outputFile: payload.outputFile || outputFile || null, canvasUpdated: Boolean(payload.canvasUpdated || canvasUpdated) });
      return payload;
    } catch (error) {
      if (AGENT_ID === "nora-vale-figma") throw error;
      notifyParentWork({ prompt, result, outputFile: outputFile || null, canvasUpdated });
      return {
        ok: false,
        outputFile: outputFile || null,
        downloadUrl: outputFile ? `/api/download?file=${encodeURIComponent(outputFile)}` : null
      };
    }
  }

  function resultCardHtml({ result, outputFile, prompt, downloadUrl, title, taskId, userRating }) {
    const fileName = outputFile ? String(outputFile).split("/").pop() : "Figma project";
    const href = downloadUrl || (outputFile ? `/api/download?file=${encodeURIComponent(outputFile)}` : "");
    return `
      <div class="work-post result-card" data-prompt="${escapeHtml(prompt || "")}" data-result="${escapeHtml(result || "")}" data-file="${escapeHtml(outputFile || "")}">
        <div class="delivery-heading"><span class="delivery-orb">✦</span><div><p class="work-eyebrow">DELIVERY READY</p><strong>${escapeHtml(title || "Design ready")}</strong></div></div>
        <div class="delivery-actions">
          <button type="button" data-act="download" ${href ? "" : "disabled"}>⇩ Save a copy</button>
          <button type="button" data-act="open" ${outputFile ? "" : "disabled"}>↗ Open in Figma</button>
          <button type="button" data-act="modify">✎ Request a change</button>
        </div>
        <div class="user-rating" data-task-id="${escapeHtml(taskId || "")}">
          <div class="rating-prompt"><span>How did this turn out?</span><button type="button" data-rating-edit ${userRating ? "" : "hidden"}>Change rating</button></div>
          <div class="star-row" role="group" aria-label="Rate Nora's work from 1 to 5 stars">
            ${[1,2,3,4,5].map((star) => `<button type="button" data-rating="${star}" class="${userRating && star <= userRating ? "selected" : ""}" ${userRating ? "disabled" : ""} aria-label="${star} star${star > 1 ? "s" : ""}">★</button>`).join("")}
          </div>
          <small data-rating-status>Give Nora a quick rating — it becomes part of her experience.</small>
        </div>
      </div>`;
  }

  function openChangeDialog(meta) {
    document.querySelector(".change-dialog-backdrop")?.remove();
    const backdrop = document.createElement("div");
    backdrop.className = "change-dialog-backdrop";
    backdrop.innerHTML = `<div class="change-dialog" role="dialog" aria-modal="true" aria-labelledby="changeDialogTitle">
      <div class="change-dialog-glow"></div><div class="change-dialog-head"><span class="delivery-orb">✎</span><div><p class="work-eyebrow">CONTINUE THIS PROJECT</p><h3 id="changeDialogTitle">What should Nora change?</h3></div><button type="button" class="change-dialog-close" data-close-change aria-label="Close">×</button></div>
      <p class="change-dialog-copy">I’ll keep this Figma project and apply your next instruction to it.</p>
      <textarea data-change-input placeholder="e.g. Make the fish blue and add a gentle swimming loop…"></textarea>
      <div class="change-dialog-actions"><button type="button" class="change-dialog-cancel" data-close-change>Cancel</button><button type="button" class="change-dialog-submit" data-submit-change>Start the change ✦</button></div>
    </div>`;
    document.body.appendChild(backdrop);
    const input = backdrop.querySelector("[data-change-input]");
    const close = () => backdrop.remove();
    backdrop.querySelectorAll("[data-close-change]").forEach((button) => button.addEventListener("click", close));
    backdrop.addEventListener("click", (event) => { if (event.target === backdrop) close(); });
    backdrop.querySelector("[data-submit-change]")?.addEventListener("click", () => {
      const correction = input?.value.trim();
      if (!correction) { input?.focus(); return; }
      close();
      sendMessage(correction, { mode: "fix", forceTask: true, continuation: { priorPrompt: meta.prompt || "", priorResult: meta.result || "", outputFile: meta.outputFile || null } });
    });
    requestAnimationFrame(() => input?.focus());
  }

  function bindResultCard(row, meta) {
    const card = row?.querySelector(".result-card, .work-post");
    if (!card) return;
    const download = () => {
      const href = meta.downloadUrl
        || (meta.outputFile ? `/api/download?file=${encodeURIComponent(meta.outputFile)}` : "");
      if (!href) return;
      location.href = href;
      noraSay("Downloaded — open it in Figma whenever you like.");
    };
    card.querySelector('[data-act="download"]')?.addEventListener("click", download);
    card.querySelector('[data-act="download-link"]')?.addEventListener("click", (event) => {
      event.preventDefault();
      download();
    });
    card.querySelector('[data-act="open"]')?.addEventListener("click", async () => {
      if (!meta.outputFile) return;
      try {
        const res = await fetch("/api/run-output", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file: meta.outputFile })
        });
        const payload = await res.json();
        if (!res.ok || payload.error) throw Error(payload.error || "Could not open file.");
        noraSay("Opened the file for you.");
      } catch (error) {
        noraSay(error.message || "I couldn’t open that file just now.");
      }
    });
    card.querySelector('[data-act="modify"]')?.addEventListener("click", () => openChangeDialog(meta));
    card.querySelectorAll("[data-rating]").forEach((button) => button.addEventListener("click", async () => {
      const rating = Number(button.dataset.rating);
      if (!rating) return;
      const stars = [...card.querySelectorAll("[data-rating]")];
      stars.forEach((item) => { item.classList.toggle("selected", Number(item.dataset.rating) <= rating); item.disabled = true; });
      const status = card.querySelector("[data-rating-status]");
      if (status) status.textContent = "Saving your rating to Nora’s UAM memory…";
      try {
        const response = await fetch(`/api/agents/${encodeURIComponent(AGENT_ID)}/feedback`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId: meta.taskId || null, taskStatus: "completed", taskPrompt: meta.prompt || "Figma delivery", rating, reviewerType: "user", reviewerId: state.userName || "workspace-user", comment: `User rated Nora's delivered Figma work ${rating}/5.`, lesson: rating >= 4 ? "This delivery style was useful to the user." : "Ask for clearer requirements and verify the result before delivery." })
        });
        if (!response.ok) throw Error("rating could not be saved");
        const current = activeChat();
        if (current) { current.userRating = rating; current.updatedAt = Date.now(); saveChats(); }
        if (status) status.textContent = `Saved — ${rating}/5 stars will guide Nora’s future work.`;
      } catch (_) {
        if (status) status.textContent = "I couldn’t save that rating yet. You can try again later.";
        stars.forEach((item) => { item.disabled = false; });
      }
    }));
    card.querySelector("[data-rating-edit]")?.addEventListener("click", () => {
      card.querySelectorAll("[data-rating]").forEach((item) => { item.disabled = false; });
      card.querySelector("[data-rating-edit]").hidden = true;
      const status = card.querySelector("[data-rating-status]");
      if (status) status.textContent = "Choose a new score — your latest rating will guide Nora.";
    });
  }

  function askThumbsDown(meta) {
    const row = appendBubble({
      from: "nora",
      html: `Oh no — thanks for saying so. What felt off?<div class="feedback-note"><textarea placeholder="e.g. improve the hierarchy / add a mobile state / simplify the flow"></textarea><button type="button" class="primary" data-send-down>Tell Nora</button></div>`,
      at: "Just now"
    });
    const area = row.querySelector("textarea");
    row.querySelector("[data-send-down]")?.addEventListener("click", () => {
      const why = area?.value.trim();
      if (!why) {
        area?.focus();
        return;
      }
      sendMessage(why, {
        mode: "fix",
        forceTask: true,
        apiPrompt: `Please update the Figma design. Feedback: ${why}`,
        continuation: {
          priorPrompt: meta.prompt || "",
          priorResult: meta.result || "",
          outputFile: meta.outputFile || null
        }
      });
    });
  }

  function pick(lines) {
    return lines[Math.floor(Math.random() * lines.length)];
  }

  function noraSay(text, html = null) {
    appendBubble({ from: "nora", text, html, at: "Just now" });
    const chat = activeChat();
    if (chat) {
      chat.messages.push({ from: "nora", text, at: "Just now" });
      chat.updatedAt = Date.now();
      saveChats();
      renderChatList();
    }
  }

  function supervisorSay(text) {
    appendBubble({ from: "supervisor", text, at: "Just now" });
    const chat = activeChat();
    if (chat) {
      chat.messages.push({ from: "supervisor", text, at: "Just now" });
      chat.updatedAt = Date.now();
      saveChats();
      renderChatList();
    }
  }

  async function runSupervisorReview({ prompt, result, outputFile, taskId }) {
    if (!state.allowSupervisors || !state.supervisor?.id) return { recreate: false, critical: false };
    const name = state.supervisor.name || "Supervisor";
    setPresence(`${name} is reviewing…`);
    setTyping(true);
    await wait(700);
    setTyping(false);

    let review = null;
    try {
      const res = await fetch("/api/supervise/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supervisorId: state.supervisor.id,
          workerId: AGENT_ID,
          taskId,
          workerName: "Nora Vale",
          agentName: "Nora Vale",
          prompt,
          result,
          outputFile
        })
      });
      review = await res.json();
      if (!res.ok || review.error) throw Error(review.error || "Supervisor review failed.");
    } catch (_) {
      supervisorSay("I couldn’t complete the independent review. This work is unrated.");
      return null;
    }
    if (review.verdict === "STOPPED") return null;
    const score = Number.isFinite(Number(review.score)) ? Number(review.score) : Math.round(Number(review.rating || 0) * 20);
    const rating = review.rating;
    const body = review.comment;
    const html = `<span class="supervisor-rating">${score}% · ${escapeHtml(review.verdict || (review.recreate ? "RECREATE" : "OK"))}</span><div>${escapeHtml(body)}</div>`;
    appendBubble({ from: "supervisor", html, at: "Just now" });
    const chat = activeChat();
    if (chat) {
      chat.messages.push({ from: "supervisor", text: `${score}% — ${body}`, at: "Just now" });
      chat.updatedAt = Date.now();
      saveChats();
      renderChatList();
    }
    return review;
  }

  async function reviewFigmaArtifact({ prompt, result, outputFile, attempt = 1 }) {
    setPresence("I’m checking the Figma result before I send it to the supervisor…");
    const res = await fetch(`${API}/review-artifact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, result, outputFile, attempt })
    });
    const review = await res.json().catch(() => ({}));
    if (!res.ok || !review) throw Error(review.error || "The Figma quality review could not start.");
    return review;
  }

  function setComposerEnabled(on) {
    if ($("#input")) $("#input").disabled = !on;
    if ($("#sendBtn")) $("#sendBtn").disabled = !on || state.busy;
    const stop = $("#stopWorkBtn");
    if (stop) {
      stop.hidden = !state.busy;
      stop.disabled = !state.busy || state.stopRequested || !state.workingChat;
    }
  }

  function renderChat() {
    const chat = activeChat();
    const thread = $("#thread");
    if (!chat) {
      $("#chatName").textContent = "Pick a chat";
      $("#chatType").textContent = "Open a chat on the right to begin";
      if ($("#chips")) {
        $("#chips").hidden = true;
        $("#chips").innerHTML = "";
      }
      thread.innerHTML = `<div class="empty-chat" id="emptyChat">
        <h2>Message Nora</h2>
        <p>Pick a chat on the right, or start a fresh Figma project.</p>
        <button type="button" class="primary empty-create" id="emptyCreateBtn">＋ Create a Figma project</button>
      </div>`;
      $("#emptyCreateBtn")?.addEventListener("click", openNewPage);
      setComposerEnabled(false);
      return;
    }

    const tpl = templateById(chat.templateId);
    const status = chat.status === "done" ? "Ready" : "Waiting for you";
    $("#chatName").textContent = chat.name;
    $("#chatType").textContent = `${tpl.name} · ${status}`;

    thread.innerHTML = "";
    (chat.messages || []).forEach((msg) => {
      if (msg.result) {
        const verifiedCanvas = Boolean(chat.canvasUpdated || chat.outputFile);
        const row = appendBubble({
          from: "nora",
          html: `${escapeHtml(msg.text)}${verifiedCanvas ? resultCardHtml({
            result: chat.lastResult || msg.text,
            outputFile: chat.outputFile,
            downloadUrl: chat.downloadUrl,
            prompt: chat.brief || chat.name,
            taskId: chat.lastTaskId,
            userRating: chat.userRating,
            title: chat.name
          }) : ""}`,
          at: msg.at
        });
        if (msg.userDecision) {
          const accept = document.createElement("button");
          accept.type = "button";
          accept.disabled = msg.userDecision === "accepted";
          accept.textContent = accept.disabled ? "Accepted" : "Accept work";
          accept.onclick = () => {
            msg.userDecision = "accepted";
            saveChats();
            renderChat();
          };
          row.querySelector(".result-actions")?.prepend(accept);
        }
        bindResultCard(row, {
          result: chat.lastResult || msg.text,
          outputFile: chat.outputFile,
          downloadUrl: chat.downloadUrl,
          prompt: chat.brief || msg.text,
          taskId: chat.lastTaskId,
          userRating: chat.userRating
        });
      } else if (msg.from === "supervisor") {
        appendBubble({ from: "supervisor", text: msg.text, at: msg.at });
      } else {
        appendBubble(msg);
      }
    });

    $("#chips").hidden = false;
    $("#chips").innerHTML = (tpl.chips || []).map((chip) =>
      `<button type="button" data-chip="${escapeHtml(chip)}">${escapeHtml(chip)}</button>`
    ).join("");
    $$("#chips [data-chip]").forEach((btn) => {
      btn.onclick = () => {
        if ($("#input")) {
          $("#input").value = btn.dataset.chip;
          $("#input").focus();
        }
      };
    });

    setComposerEnabled(true);
    scrollChatToEnd();
    renderChatList();
  }

  function openChat(id) {
    if (state.busy && id !== state.activeId) {
      noraSay("I’m still finishing the current Figma job — I’ll stay in this chat until it’s done.");
      return;
    }
    state.activeId = id;
    renderChat();
    showSide("chats");
    renderChatList();
  }

  function createChat({ name, brief, templateId }) {
    const tpl = templateById(templateId);
    const chat = {
      id: uid("chat"),
      projectId: uid("project"),
      name: name || tpl.name,
      displayTitle: name && name !== "New Figma project" ? name : "New Figma project",
      templateId: tpl.id,
      brief: brief || "",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: "open",
      outputFile: null,
      lastResult: "",
      messages: [
        {
          from: "nora",
          text: `Hey! Fresh ${tpl.name.toLowerCase()} chat. Before we begin, I’ll check whether Figma is installed. If it isn’t, I can install it when your computer allows, or guide you through the setup. What should we make?`,
          at: "Just now"
        }
      ]
    };
    state.chats.unshift(chat);
    saveChats();
    state.activeId = chat.id;
    renderSideChats();
    renderChat();
    refreshFigmaStatus().then(() => renderAgentWidgets()).catch(() => {});
    if (brief && $("#input")) {
      $("#input").value = brief;
      $("#input").disabled = false;
      $("#input").focus();
    }
  }

  async function ensureFigmaReady() {
    setPresence("Checking Figma…");
    const res = await fetch(`${API}/ensure`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const payload = await res.json();
    state.figma = payload;
    renderFigmaCard();
    if (!payload.ok && !payload.installed) {
      throw Error(payload.message || "Figma isn’t available yet.");
    }
    if (payload.action === "installed") {
      noraSay(payload.message || "Figma is installed now.");
    }
    const bridgeRes = await fetch(`${API}/ready`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const bridge = await bridgeRes.json().catch(() => ({}));
    if (!bridgeRes.ok || !bridge.ok) {
      const error = Error(bridge.message || "My Figma canvas bridge is not connected to the active file yet.");
      error.pluginDownload = bridge.pluginDownload || null;
      error.pluginGuide = bridge.pluginGuide || null;
      throw error;
    }
    return payload;
  }

  async function humanAck(prompt, isFix) {
    setTyping(true);
    await wait(450 + Math.min(700, prompt.length * 4));
    if (state.stopRequested) return;
    setTyping(false);
    const minutes = estimateMinutes(prompt);
    const address = state.userName !== "there" && Math.random() < 0.45 ? ` ${state.userName}` : "";
    const text = isFix
      ? pick([
        `Got it${address} — I’ll revise only what you asked in Figma. It should take about ${minutes} minutes; I’ll come back when the updated project is ready.`,
        `Thanks${address} — I’m opening the existing Figma project and applying that fix now. I’ll call you when it’s ready, roughly ${minutes} minutes.`,
        `On it${address} — one focused Figma fix coming up. I expect to be back in about ${minutes} minutes.`
      ])
      : pick([
        `I’ll open Figma and start “${prompt}” now. It should take about ${minutes} minutes; I’ll call you when the project is ready.`,
        `I’m starting “${prompt}” in Figma${address}. Give me around ${minutes} minutes and I’ll come back with the finished design.`,
        `I’ve got it${address} — Figma is next. I expect this to take about ${minutes} minutes, then I’ll return with the result.`
      ]);
    // Keep work status out of Nora's chat. The dashboard and Figma workspace
    // show this centrally so the conversation remains a clean project record.
    noraSay(text);
    setPresence("Opening Figma and starting the work…");
    setWorkingOverlay(true, text);
  }

  async function chatOnlyReply() {
    setTyping(true);
    await wait(500);
    setTyping(false);
    noraSay(pick([
      "What would you like me to create or change in Figma?",
      "I’m ready. Tell me the object or change you want, and I’ll open Figma.",
      "Could you describe what you want built in Figma — for example, a simple cube or a small scene?"
    ]));
  }

  async function waitForCodexTask(taskId, timeoutMs = 12 * 60 * 1000) {
    const started = Date.now();
    let connectionFailures = 0;
    let missingTaskPolls = 0;
    while (Date.now() - started < timeoutMs) {
      try {
        if (DESKTOP_HANDOFF) {
          const response = await fetch(`${API}/status`, { cache: "no-store" });
          if (!response.ok) throw Error(`Bridge status HTTP ${response.status}`);
          const status = await response.json().catch(() => ({}));
          const task = status?.task;
          if (task && String(task.id) === String(taskId) && ["completed", "failed", "cancelled"].includes(task.status)) {
            if (task.status !== "completed") throw Error(task.result || "Codex CLI MCP computer-use could not finish the Figma task.");
            return { ...task, done: true, outputFile: task.outputFile || null, result: task.result || "Figma work finished through Codex CLI MCP computer-use." };
          }
        } else {
          const response = await fetch("/api/tasks", { cache: "no-store" });
          if (!response.ok) throw Error(`Task status HTTP ${response.status}`);
          const tasks = await response.json();
          const task = Array.isArray(tasks) ? tasks.find((item) => item.id === taskId) : null;
          if (!task) {
            missingTaskPolls += 1;
            if (missingTaskPolls >= 3) {
              const lost = Error("RuXt no longer has this live task. I stopped waiting instead of leaving Nora stuck in reconnecting mode.");
              lost.code = "TASK_LOST";
              throw lost;
            }
          } else {
            missingTaskPolls = 0;
          }
          if (task && (task.done || ["completed", "failed", "cancelled"].includes(task.status))) {
            if (task.status !== "completed") throw Object.assign(Error(task.result || "I could not finish the Figma task."), {code:"TASK_TERMINAL"});
            if (!task.outputFile) {
              task.outputFile = extractFigmaPath(task.result);
            }
            return task;
          }
        }
        connectionFailures = 0;
      } catch (error) {
        if (error.code === "TASK_TERMINAL" || error.code === "TASK_LOST") throw error;
        connectionFailures += 1;
        if (connectionFailures >= 20) {
          const lost = Error("RuXt is temporarily disconnected from this task. I’m keeping Nora’s project open and will reconcile the result when the dashboard reconnects.");
          lost.code = "TASK_CONNECTION_LOST";
          throw lost;
        }
        setPresence(connectionFailures > 2 ? "Reconnecting to RuXt — your task is being kept alive…" : "Checking Nora’s task status…");
        await wait(Math.min(4000, 900 + connectionFailures * 500));
        continue;
      }
      await wait(1400);
    }
    const timeout = Error("I’m still working in Figma — I’ll call you once it’s done.");
    timeout.code = "TASK_STILL_RUNNING";
    throw timeout;
  }

  async function recoverPendingChat() {
    let chat = state.chats.find((item) => item.taskId && item.status === "working");
    try {
      const rows = await (await fetch("/api/tasks")).json();
      const latest = (Array.isArray(rows) ? rows : [])
        .filter(item => item.agent === AGENT_ID && item.status === "completed" && (item.canvasUpdated || item.outputFile))
        .sort((a,b) => b.createdAt - a.createdAt)
        .find(item => state.chats.some(chat => (chat.projectId || chat.id) === item.projectId));
      const candidate = latest && state.chats.find(chat => (chat.projectId || chat.id) === latest.projectId);
      if (!chat && candidate && candidate.lastTaskId !== latest.id && candidate.status !== "stopped") {
        candidate.taskId = latest.id;
        candidate.status = "working";
        chat = candidate;
        saveChats();
      }
    } catch (_) {}
    if (!chat) return;
    try {
      setWorkingOverlay(false);
      setPresence("Restoring Nora’s completed work…");
      const finished = await waitForCodexTask(chat.taskId);
      if (!finished.canvasUpdated || finished.outputFile) {
        const validation = await (await fetch(`${API}/validate`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ outputFile: finished.outputFile })
        })).json();
        if (!validation.valid) throw Error(validation.message || "I couldn’t verify the Figma project yet, so I haven’t marked this task complete.");
        await fetch(`${API}/open`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file: finished.outputFile })
        });
      }
      const result = String(finished.result || "Figma work finished.").trim();
      const supervisorReview = state.allowSupervisors && state.supervisor?.id
        ? await runSupervisorReview({ taskId: finished.id, prompt: chat.brief || chat.name, result, outputFile: finished.outputFile })
        : null;
      if (state.allowSupervisors && state.supervisor?.id && (!supervisorReview || supervisorReview.recreate)) {
        throw Error("The supervisor did not verify this restored result, so I have not marked it complete.");
      }
      const posted = await postCompletedWork({ taskId: finished.id, title: chat.name, prompt: chat.brief || chat.name, result, outputFile: finished.outputFile, canvasUpdated: Boolean(finished.canvasUpdated) });
      chat.messages.push({ from: "nora", text: friendlyComplete(result, { hasSupervisor: Boolean(state.supervisor), supervisorName: state.supervisor?.name || "your supervisor", canvasUpdated: Boolean(finished.canvasUpdated) }), at: "Just now", result: true });
      chat.status = "done";
      chat.taskId = null;
      chat.lastResult = result;
      chat.lastTaskId = finished.id;
      chat.visualPath = finished.visualPath || null;
      chat.outputFile = posted.outputFile || finished.outputFile;
      chat.canvasUpdated = Boolean(finished.canvasUpdated);
      chat.downloadUrl = posted.downloadUrl || null;
      chat.updatedAt = Date.now();
      saveChats();
      renderChat();
    } catch (error) {
      chat.status = "open";
      chat.taskId = null;
      saveChats();
      noraSay(caringError(error.message || "I couldn’t restore the finished Figma result yet."));
    } finally {
      setWorkingOverlay(false);
      setPresence("Active now · Waiting for you");
    }
  }

  async function reconcileCompletedTask(task) {
    const taskId = String(task?.id || task?.taskId || "").trim();
    if (task?.status === "cancelled" || !taskId || state.finalizedTaskIds.has(taskId)) return;
    const chat = state.chats.find((item) => item.taskId === taskId);
    if (!chat) return;
    try {
      let outputFile = task.outputFile || null;
      if (!outputFile) {
        outputFile = extractFigmaPath(task.result);
      }
      if (!task.canvasUpdated || outputFile) {
        if (!outputFile) throw Error("The Figma task finished, but RuXt could not locate its saved project evidence.");
        const validation = await (await fetch(`${API}/validate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outputFile }) })).json();
        if (!validation.valid) throw Error(validation.message || "I couldn’t verify the Figma project yet, so I haven’t marked this task complete.");
        await fetch(`${API}/open`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ file: outputFile }) });
      }
      const result = String(task.result || "Figma work finished.").trim();
      const supervisorReview = state.allowSupervisors && state.supervisor?.id
        ? await runSupervisorReview({ taskId, prompt: chat.brief || chat.name, result, outputFile })
        : null;
      if (state.allowSupervisors && state.supervisor?.id && (!supervisorReview || supervisorReview.recreate)) {
        throw Error("The supervisor did not verify this result, so I have not posted it as complete.");
      }
      const posted = await postCompletedWork({ taskId, title: chat.name, prompt: chat.brief || chat.name, result, outputFile, canvasUpdated: Boolean(task.canvasUpdated) });
      chat.messages.push({ from: "nora", text: friendlyComplete(result, { hasSupervisor: Boolean(state.supervisor), supervisorName: state.supervisor?.name || "your supervisor", canvasUpdated: Boolean(task.canvasUpdated) }), at: "Just now", result: true });
      chat.status = "done";
      chat.taskId = null;
      chat.lastResult = result;
      chat.visualPath = task.visualPath || null;
      chat.lastTaskId = taskId;
      chat.outputFile = posted.outputFile || outputFile;
      chat.canvasUpdated = Boolean(task.canvasUpdated);
      chat.downloadUrl = posted.downloadUrl || null;
      chat.updatedAt = Date.now();
      state.finalizedTaskIds.add(taskId);
      saveChats();
      renderChat();
    } catch (error) {
      state.finalizedTaskIds.delete(taskId);
      chat.status = "working";
      chat.taskId = taskId;
      saveChats();
      noraSay(caringError(error.message || "I couldn’t update this chat after the Figma task finished."));
    } finally {
      state.busy = false;
      state.timedOutTaskIds.delete(taskId);
      setWorkingOverlay(false);
      setComposerEnabled(true);
      setPresence("Active now · Waiting for you");
    }
  }

  async function runFigmaBuild(prompt, chat) {
    const controller = new AbortController();
    let activeTaskId = null;
    const poll = setInterval(async () => {
      try {
        if (state.stopRequested) {
          setWorkingOverlay(false);
          return;
        }
        const status = await (await fetch(`${API}/status`)).json();
        state.figma = status;
        renderFigmaCard();
        if (status?.job?.status) {
          const workingStatus = `I’m working in Figma — ${status.job.status}`;
          setPresence(workingStatus);
          setWorkingOverlay(true, workingStatus);
        } else if (status?.focusing) {
          const workingStatus = "I’m working in Figma — I’ll call you once it’s done.";
          setPresence(workingStatus);
          setWorkingOverlay(true, workingStatus);
        }
        if (activeTaskId) {
          const tasks = await (await fetch("/api/tasks")).json();
          const task = Array.isArray(tasks) ? tasks.find((item) => item.id === activeTaskId) : null;
          if (task?.lastStatus) {
            const workingStatus = `I’m working in Figma — ${task.lastStatus}`;
            setPresence(workingStatus);
            setWorkingOverlay(true, workingStatus);
            if ($("#figmaNote")) $("#figmaNote").textContent = task.lastStatus;
            live(task.lastStatus);
          }
        }
      } catch (_) {}
    }, 1200);

    try {
      const response = await fetch(`${API}/handoff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          name: chat?.name || "figma-project",
          baseFile: chat?.outputFile || "",
          projectId: chat?.projectId || chat?.id || "new-figma-project",
          priorPrompt: chat?.brief || "",
          priorResult: chat?.lastResult || ""
        }),
        signal: controller.signal
      });
      const done = await response.json().catch(() => ({}));
      if (!response.ok || done.error) throw Error(done.error || done.message || "Couldn’t build in Figma.");
      if (!done.ok) {
        const error = Error(done.message || "Figma build didn’t finish.");
        error.pluginDownload = done.pluginDownload || null;
        error.pluginGuide = done.pluginGuide || null;
        throw error;
      }
      if (!done.task?.id) throw Error("Codex handoff did not return a task.");
      if (state.stopRequested) {
        await cancelFigmaTask(done.task.id);
        return null;
      }
      activeTaskId = done.task.id;
      state.currentTaskId = done.task.id;
      chat.taskId = done.task.id;
      chat.status = "working";
      chat.updatedAt = Date.now();
      saveChats();
      const workingStatus = done.backupFile
        ? "I saved the previous Figma project and opened the working file. I’m building this update now — I’ll call you once it’s done."
        : "I opened Figma and started a fresh project. I’m building it now — I’ll call you once it’s done.";
      setPresence(workingStatus);
      setWorkingOverlay(true, workingStatus);
      const finished = await waitForCodexTask(done.task.id);
      if (!finished.outputFile && !finished.canvasUpdated) throw Error("I haven’t completed this Figma task yet because I couldn’t verify either a saved project or a canvas update.");
      if (finished.outputFile) {
        const validation = await (await fetch(`${API}/validate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ outputFile: finished.outputFile })
        })).json();
        if (!validation.valid) throw Error(validation.message || "I couldn’t verify the Figma project yet, so I haven’t marked this task complete.");
        await fetch(`${API}/open`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file: finished.outputFile })
        });
      }
      return {
        ...done,
        ...finished,
        ok: finished.status === "completed",
        result: finished.result || done.task.result || "Figma work finished.",
        outputFile: finished.outputFile || null,
        figmaFile: finished.outputFile || null
      };
    } finally {
      clearInterval(poll);
      try {
        await fetch(`${API}/focus-stop`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      } catch (_) {}
    }
  }

  async function runReviewedFigmaBuild(prompt, chat) {
    // Nora completes the requested work and hands the saved project to the
    // assigned supervisor. Quality review belongs to the supervisor only;
    // avoid making the worker perform a second, hidden review loop.
    return runFigmaBuild(prompt, chat);
  }

  async function sendMessage(raw, options = {}) {
    const prompt = String(raw || "").trim();
    if (!prompt || state.busy) return;
    const chat = activeChat();
    if (!chat) return;
    const workingChatId = chat.id;
    const previousBrief = chat.awaitingSubject;
    const taskPrompt = String(options.apiPrompt || (previousBrief
      ? `Create an illustration. Original request: ${previousBrief}. Clarification: ${prompt}`
      : prompt)).trim();
    let keepWorkingOverlay = false;

    showSide("chats");
    if (!chat.displayTitle || chat.displayTitle === "New Figma project") {
      chat.displayTitle = smartChatTitle(prompt, chat.name || "Figma project");
    }
    appendBubble({ from: "you", text: prompt, at: "Just now" });
    chat.messages.push({ from: "you", text: prompt, at: "Just now" });
    chat.updatedAt = Date.now();
    saveChats();
    renderChatList();

    if ($("#input")) {
      $("#input").value = "";
      $("#input").style.height = "auto";
    }
    if (previousBrief) {
      delete chat.awaitingSubject;
      saveChats();
    }
    state.busy = true;
    state.stopRequested = false;
    state.currentTaskId = null;
    state.workingChat = chat;
    state.activeId = workingChatId;
    setComposerEnabled(true);

    try {
      if (!previousBrief && !wantsFigmaWork(prompt, options)) {
        await chatOnlyReply();
        return;
      }

      setWorkingOverlay(true);
      // Confirm both Figma and the active canvas bridge before telling the
      // user that work has started. This prevents a reassuring acknowledgement
      // when no task can actually reach the canvas.
      await ensureFigmaReady();
      await humanAck(prompt, Boolean(options.continuation));
      if (state.stopRequested) return;
      // Give the user a moment to read Nora's plan before Figma comes
      // forward. This also makes the handoff feel intentional rather than
      // like an abrupt app switch.
      await wait(900);
      if (state.stopRequested) return;
      state.activeId = workingChatId;
      showSide("chats");
      setTyping(true);
      if (state.stopRequested) return;
      setPresence("I’m opening Figma and connecting the visual controls…");
      state.handoffPending = runReviewedFigmaBuild(taskPrompt, chat);
      const done = await state.handoffPending;
      if (state.stopRequested) return;
      state.workingChat = null;
      setComposerEnabled(true);
      // Do not mark a task finalized until the supervisor review and delivery
      // have succeeded. If review temporarily fails, recovery must be able to
      // pick this completed task up again after the iframe is revisited.
      const completedTaskId = String(done?.task?.id || done?.id || "");
      state.finalizedTaskIds.delete(completedTaskId);
      state.currentTaskId = null;
      setTyping(false);

      state.activeId = workingChatId;
      showSide("chats");

      const liveChat = state.chats.find((item) => item.id === workingChatId) || chat;
      const result = String(done.result || "All set.").trim();
      let outputFile = done.outputFile || done.figmaFile || null;
      const workTitle = liveChat.name || "Nora Vale work";
      const originalPrompt = options.continuation?.priorPrompt || prompt;
      const hasSupervisor = Boolean(state.allowSupervisors && state.supervisor && !options.skipSupervisor);
      const supervisorName = state.supervisor?.name || "your supervisor";
      let supervisorReview = null;

      // A supervisor is a delivery gate: verify the artifact before Nora posts
      // it as completed work. This prevents an unverified result from looking
      // finished in the chat or forum.
      if (hasSupervisor) {
        supervisorSay(`${supervisorName} here — I’m verifying Nora’s result before delivery.`);
        supervisorReview = await runSupervisorReview({
          prompt: originalPrompt,
          taskId: done.id || done.task?.id,
          result,
          outputFile
        });
        if (!supervisorReview) {
          liveChat.taskId = completedTaskId || liveChat.taskId;
          liveChat.status = "working";
          liveChat.updatedAt = Date.now();
          saveChats();
          noraSay("I’m waiting for the supervisor’s verification before I deliver this.");
          return;
        }
        const recreatePrompt = supervisorReview?.recreatePrompt || supervisorReview?.fixPrompt;
        if (supervisorReview.recreate && recreatePrompt && !options.fromSupervisorFix) {
          noraSay(`I’m going to recreate this after ${supervisorName} found an issue. I’ll bring you the corrected result next.`);
          state.busy = false;
          await sendMessage(recreatePrompt, {
            mode: "fix",
            forceTask: true,
            fromSupervisorFix: true,
            apiPrompt: recreatePrompt,
            continuation: { priorPrompt: originalPrompt, priorResult: result, outputFile }
          });
          return;
        }
        if (supervisorReview.recreate && options.fromSupervisorFix) {
          supervisorSay("The second pass still needs changes, so I’m not marking it complete.");
          noraSay("The supervisor still found an issue after the second pass. Tell me what you want changed next.");
          return;
        }
      }

      setPresence("Posting completed work…");
      const posted = await postCompletedWork({
        taskId: done.id,
        title: workTitle,
        prompt: originalPrompt,
        result,
        outputFile,
        canvasUpdated: Boolean(done.canvasUpdated)
      });
      outputFile = posted.outputFile || outputFile;
      const downloadUrl = posted.downloadUrl
        || (outputFile ? `/api/download?file=${encodeURIComponent(outputFile)}` : null);

      const friendly = friendlyComplete(result, { hasSupervisor, supervisorName, canvasUpdated: Boolean(done.canvasUpdated) });
      liveChat.messages.push({ from: "nora", text: friendly, at: "Just now", result: true });
      liveChat.visualPath = done.visualPath || null;
      liveChat.lastTaskId = completedTaskId;
      liveChat.status = "done";
      liveChat.taskId = null;
      liveChat.lastResult = result;
      liveChat.outputFile = outputFile;
      liveChat.canvasUpdated = Boolean(done.canvasUpdated);
      liveChat.downloadUrl = downloadUrl;
      if (completedTaskId) state.finalizedTaskIds.add(completedTaskId);
      liveChat.updatedAt = Date.now();
      saveChats();
      renderChat();
      scrollChatToEnd();

      if (hasSupervisor) {
        if (!supervisorReview.recreate) {
          const delivery = [...liveChat.messages].reverse().find(message => message.result);
          if (delivery) delivery.userDecision = "pending";
          saveChats();
          renderChat();
          noraSay(`The supervisor verified this at ${supervisorReview.score}%. Choose Accept work or Modify.`);
        }
      } else {
        noraSay("All set on my side — I’m waiting for you.");
      }

      state.activeId = workingChatId;
      showSide("chats");
      renderChat();
      scrollChatToEnd();
    } catch (error) {
      setTyping(false);
      try {
        await fetch(`${API}/focus-stop`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      } catch (_) {}
      state.activeId = workingChatId;
      showSide("chats");
      const failedChat = state.chats.find((item) => item.id === workingChatId);
      if (error?.code === "TASK_STILL_RUNNING" || error?.code === "TASK_CONNECTION_LOST") {
        if (failedChat) {
          failedChat.status = "working";
          failedChat.updatedAt = Date.now();
          saveChats();
        }
        // Keep the central working overlay visible while the task continues in
        // the background; do not turn a progress update into a chat message.
        setWorkingOverlay(true, error.message);
        setPresence(error.message);
        keepWorkingOverlay = true;
        if (failedChat?.taskId) state.timedOutTaskIds.add(failedChat.taskId);
        state.busy = true;
        return;
      }
      if (state.stopRequested) {
        return;
      }
      if (failedChat) {
        failedChat.status = "open";
        failedChat.taskId = null;
        failedChat.updatedAt = Date.now();
        saveChats();
      }
      const message = caringError(error.message || "Something got stuck while I was working. I’ll stay with you while we try again.");
      if (error?.pluginDownload) {
        const guide = error.pluginGuide || "Download and import my plugin from Figma’s Plugins → Development menu, then run it in the open file and try again.";
        noraSay(`${message}\n\n${guide}`, `<p>${escapeHtml(message)}</p><p>${escapeHtml(guide)}</p><a class="primary" href="${escapeHtml(error.pluginDownload)}" download>Download my Figma plugin</a>`);
      } else {
        noraSay(message);
      }
    } finally {
      state.workingChat = null;
      state.handoffPending = null;
      state.currentTaskId = null;
      state.busy = false;
      if (!keepWorkingOverlay) setWorkingOverlay(false);
      if (!keepWorkingOverlay) setComposerEnabled(true);
      setPresence("Active now · Waiting for you");
    }
  }

  function openNewPage() {
    createChat({ name: "New Figma project", brief: "", templateId: state.selectedTemplate });
    history.replaceState(null, "", `${location.pathname}${location.search}#chat`);
  }

  function openChatHistory() {
    renderChatList();
    showSide("history");
  }

  function openFromHash() {
    if (location.hash === "#new-chat") openNewPage();
    else if (location.hash === "#supervisor") openSupervisorPicker();
  }

  $("#navChatsBtn")?.addEventListener("click", openChatHistory);
  $("#allChatsBtn")?.addEventListener("click", () => {
    if (state.side === "history") {
      state.historyLimit += 12;
      renderChatList();
      showSide("history");
    } else openChatHistory();
  });
  $("#navNewBtn")?.addEventListener("click", openNewPage);
  $("#navSupervisorBtn")?.addEventListener("click", openSupervisorPicker);
  $("#newChatHeroBtn")?.addEventListener("click", openNewPage);
  $("#cancelNewBtn")?.addEventListener("click", renderSideChats);
  $("#cancelNewBtn2")?.addEventListener("click", renderSideChats);
  $("#cancelSupervisorBtn")?.addEventListener("click", renderSideChats);
  $("#addSupervisorBtn")?.addEventListener("click", openSupervisorPicker);

  $("#ensureFigmaBtn")?.addEventListener("click", async () => {
    $("#ensureFigmaBtn").disabled = true;
    setPresence("Checking Figma…");
    try {
      const res = await fetch(`${API}/ensure`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const payload = await res.json();
      state.figma = payload;
      renderFigmaCard();
      setPresence(payload.ok || payload.installed ? "Figma ready · Waiting for you" : "Active now · Waiting for you");
      if (state.activeId) {
        noraSay(payload.message || (payload.installed ? "Figma is ready." : "Still need Figma installed."));
      }
    } catch (error) {
      setPresence("Active now · Waiting for you");
      if (state.activeId) noraSay(error.message || "Couldn’t check Figma just now.");
    } finally {
      $("#ensureFigmaBtn").disabled = false;
    }
  });

  $("#openFigmaBtn")?.addEventListener("click", async () => {
    try {
      const res = await fetch(`${API}/open`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const payload = await res.json();
      state.figma = payload;
      renderFigmaCard();
      if (state.activeId) {
        noraSay(payload.ok ? "Opened Figma for you." : (payload.message || payload.error || "Couldn’t open Figma."));
      }
    } catch (error) {
      if (state.activeId) noraSay(error.message || "Couldn’t open Figma.");
    }
  });

  $("#newChatForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    createChat({
      name: $("#newName").value.trim(),
      brief: $("#newBrief").value.trim(),
      templateId: state.selectedTemplate
    });
  });

  $("#composer")?.addEventListener("submit", (event) => {
    event.preventDefault();
    sendMessage($("#input")?.value);
  });
  $("#stopWorkBtn")?.addEventListener("click", (event) => {
    event.preventDefault();
    stopCurrentWork();
  });

  window.addEventListener("message", (event) => {
    const data = event.data;
    if (!data || typeof data !== "object") return;
    if (data.type === "ruxt:task-complete" && data.agentId === AGENT_ID) {
      const taskId = String(data.taskId || "");
      if (!state.busy || state.timedOutTaskIds.has(taskId)) {
        waitForCodexTask(taskId).then(reconcileCompletedTask).catch(() => {});
      }
    }
  });

  window.addEventListener("hashchange", openFromHash);

  $("#input")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage($("#input").value);
    }
  });

  $("#input")?.addEventListener("input", () => {
    const input = $("#input");
    input.style.height = "auto";
    input.style.height = `${Math.min(120, input.scrollHeight)}px`;
  });

  (async () => {
    loadChats();
    try {
      const workspace = await (await fetch("/api/workspace")).json();
      const profile = workspace?.settings?.profile || {};
      state.userName = String(profile.preferredName || profile.fullName || profile.personal?.firstName || "there").trim() || "there";
    } catch (_) {}
    try {
      const payload = await (await fetch("/api/installed-agents")).json();
      const self = (payload.agents || []).find((a) => a.id === AGENT_ID);
      if (self && typeof self.allowSupervisors === "boolean") {
        state.allowSupervisors = self.allowSupervisors;
      }
    } catch (_) {}
    await loadSupervisors();
    renderSideChats();
    refreshFigmaStatus();
    openFromHash();
    const last = latestChat();
    if (last) openChat(last.id);
    else renderChat();
    await reconcileWorkingDialog();
    recoverPendingChat();
  })();
})();



