(() => {
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (sel) => [...document.querySelectorAll(sel)];
  const AGENT_ID = document.body.dataset.agentId || "lina-park-blender";
  const STORE_KEY = `${AGENT_ID}-chats-v2`;
  const DESKTOP_HANDOFF = document.body.dataset.desktopHandoff === "true";
  const API = `/api/agent/${AGENT_ID}`;
  const ALLOW_SUPERVISORS = true; // mirrors manifest.allowSupervisors

  const TEMPLATES = [
    {
      id: "prop",
      name: "Simple prop",
      blurb: "Mug, chair, lamp — clean hard-surface.",
      prompt: "Create a simple hard-surface prop in Blender with clear materials and a soft studio light.",
      chips: ["Add a turntable camera", "Make it ceramic", "Export a preview render"]
    },
    {
      id: "character",
      name: "Stylized character",
      blurb: "Low-poly friendly character blockout.",
      prompt: "Block out a stylized low-poly character in Blender with basic materials.",
      chips: ["Add a simple idle pose", "Friendlier face", "Softer colors"]
    },
    {
      id: "product",
      name: "Product shot",
      blurb: "Hero object on a seamless backdrop.",
      prompt: "Build a product-shot scene in Blender with a hero object, seamless backdrop, and soft key light.",
      chips: ["Three-point lighting", "Matte black stand", "Render preview"]
    },
    {
      id: "animation",
      name: "Short animation",
      blurb: "A few seconds of motion.",
      prompt: "Create a butterfly and animate it flapping and flying.",
      chips: ["Create a butterfly and animate it", "Bounce a ball", "Slow orbit camera"]
    },
    {
      id: "scene",
      name: "Mini scene",
      blurb: "Small environment with a focal object.",
      prompt: "Build a small Blender scene with a focal object, ground, and soft ambient light.",
      chips: ["Add a plant", "Warmer light", "Isometric camera"]
    },
    {
      id: "fix",
      name: "Open brief",
      blurb: "Start blank — tell Lina what you want.",
      prompt: "",
      chips: ["Model a clay vase", "Animate a bouncing ball", "Make a desk lamp"]
    }
  ];

  const SEED_CHATS = [
    {
      id: "seed-mug",
      name: "Clay mug turntable",
      templateId: "prop",
      createdAt: Date.now() - 86400000 * 2,
      updatedAt: Date.now() - 86400000 * 2,
      status: "done",
      outputFile: null,
      lastResult: "Clay mug with soft studio light and a short turntable.",
      messages: [
        { from: "lina", text: "Hey! Prop chat is open — tell me what to model when you’re ready.", at: "Yesterday" },
        { from: "you", text: "A simple clay mug with a turntable, please.", at: "Yesterday" },
        { from: "lina", text: "Done — clean mug, soft clay material, short orbit. Want a render next?", at: "Yesterday", result: true }
      ]
    },
    {
      id: "seed-bounce",
      name: "Bouncing ball loop",
      templateId: "animation",
      createdAt: Date.now() - 86400000 * 5,
      updatedAt: Date.now() - 86400000 * 4,
      status: "done",
      outputFile: null,
      lastResult: "Short bouncing ball animation with ease-in/out.",
      messages: [
        { from: "lina", text: "Animation chat ready. What should move?", at: "5 days ago" },
        { from: "you", text: "A bouncing ball loop, a couple seconds.", at: "5 days ago" },
        { from: "lina", text: "Loop’s in — squash on impact, easy to scrub. Tweak the bounce height?", at: "4 days ago", result: true }
      ]
    },
    {
      id: "seed-lamp",
      name: "Desk lamp product",
      templateId: "product",
      createdAt: Date.now() - 86400000 * 1,
      updatedAt: Date.now() - 1000,
      status: "done",
      outputFile: null,
      lastResult: "Desk lamp product shot on a seamless backdrop.",
      messages: [
        { from: "lina", text: "Product chat — what are we shooting?", at: "Today" },
        { from: "you", text: "A desk lamp on a seamless backdrop, soft key light.", at: "Today" },
        { from: "lina", text: "Hero lamp’s set with soft key light. Want three-point next?", at: "Today", result: true }
      ]
    }
  ];

  const state = {
    side: "chats",
    chats: [],
    activeId: null,
    selectedTemplate: "prop",
    busy: false,
    blender: null,
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

  // Normalize relative, absolute, and Markdown-linked Blender paths.
  function extractBlendPath(text) {
    const raw = String(text || "");
    const match = raw.match(/(?:^|[(`\s])((?:[A-Za-z]:[\\/]|\/)?[^)\]`"\s]*outputs[\\/][^)\]`"\s]+\.blend)/i);
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
      const legacy = JSON.parse(localStorage.getItem("lina-park-blender-chats-v1") || "null");
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
  function smartChatTitle(prompt, fallback = "Blender project") {
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
    // Keep live status natural. Lina addresses the user in chat messages,
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
      return `I’m sorry, ${userAddress()}. I briefly lost the local RuXt connection while I was working. The task may still be running; please reopen Lina or check Activities before starting it again.`;
    }
    return `I’m sorry, ${userAddress()}. ${text}`;
  }

  function setWorkingOverlay(on, status = "I’m working in Blender — I’ll call you once it’s done.") {
    // A late status-poll response must never resurrect the popup after a stop.
    if (on && state.stopRequested) on = false;
    const overlay = $("#workingOverlay");
    // Work progress belongs to the native Blender window, not Lina's chat or
    // the RuXt dashboard. Keep the legacy element hidden for old packages.
    if (overlay) overlay.hidden = true;
    if ($("#workingOverlayStatus")) $("#workingOverlayStatus").textContent = status;
    document.body.classList.remove("working-lock");
    fetch(`${API}/working-dialog`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ show: Boolean(on), status })
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
        setWorkingOverlay(true, active.lastStatus || "I’m still working in Blender — I’ll call you once it’s done.");
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
    if (on) setPresence("Lina is typing…");
    else if (!state.busy) setPresence("Active now · Waiting for you");
  }

  function estimateMinutes(prompt) {
    const text = String(prompt || "").toLowerCase();
    if (/animation|animate|render|character|scene|texture|lighting|material/.test(text)) return 10;
    return 5;
  }

  async function cancelBlenderTask(taskId) {
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
        await cancelBlenderTask(state.currentTaskId);
      }
      else if (state.handoffPending) await state.handoffPending;
    } catch (error) {
      state.finalizedTaskIds.delete(state.currentTaskId);
      state.stopRequested = false;
      chat.messages.push({ from: "lina", text: error.message, at: "Just now" });
      saveChats();
      renderChat();
      setComposerEnabled(true);
      return;
    }
    chat.status = "stopped";
    chat.taskId = null;
    chat.updatedAt = Date.now();
    chat.messages.push({ from: "lina", text: "I’ve stopped here. Let me know if you want me to pick this up again.", at: "Just now" });
    if (state.allowSupervisors && state.supervisor?.id) {
      chat.messages.push({ from: "supervisor", at: "Just now", text: pick([
        "Lina, put the bevel tool down. Yes, even the tiny one.",
        "Lina, step away from the cube. It can supervise itself for a bit.",
        "Pencils down, Lina. I can still hear you clicking."
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

  function wantsBlenderWork(prompt, options = {}) {
    if (options.forceTask || options.continuation || options.mode === "fix") return true;
    const p = String(prompt || "").toLowerCase();
    return /\b(make|create|build|built|model|animate|animation|add|update|fix|change|render|export|blender|mesh|rig|scene|prop|character|cube|sphere|cylinder|cone|torus|lamp|mug|ball|butterfly|camera|light|material|texture|fly|wing)\b/.test(p);
  }

  async function refreshBlenderStatus() {
    try {
      const res = await fetch(`${API}/status`);
      state.blender = await res.json();
    } catch (_) {
      state.blender = { installed: false, message: "Couldn’t reach the Blender bridge." };
    }
    renderBlenderCard();
    renderAgentWidgets();
  }

  function renderBlenderCard() {
    const card = $("#blenderCard");
    if (!card) return;
    const info = state.blender || {};
    const ready = Boolean(info.installed);
    const focusing = Boolean(info.focusing || info.job?.running);
    card.classList.toggle("ready", ready && !focusing);
    card.classList.toggle("focusing", focusing);
    $("#blenderTitle").textContent = focusing
      ? "Working in Blender"
      : ready ? "Blender ready" : "Blender not found";
    $("#blenderNote").textContent = focusing
      ? (info.job?.status || "Codex CLI MCP computer-use is working in Blender.")
        : ready
        ? (info.connection || (info.bin ? `Using ${info.bin}` : "Blender app is available on this Mac."))
        : (info.brew
          ? "I can try installing via Homebrew when you ask."
          : "Install Blender, or let me try Homebrew if it’s available.");
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
      $("#chatList").innerHTML = `<div class="empty">No chats yet. Start one with a scene starter.</div>`;
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
        <p>Add any installed supervisor agent to rate Lina’s finished work.</p>
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
          <p>${escapeHtml(s.role || "Supervisor")} · Rates Lina’s completed work</p>
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
          supervisorSay("I’m watching Lina’s work now. When she finishes, I’ll rate it and comment — or ask her to recreate it if there’s an error.");
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
    const info = state.blender || {};
    const software = info.installed ? "Ready to open" : "Needs setup";
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
    if (from === "lina") {
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

  function friendlyComplete(result, { hasSupervisor = false, supervisorName = "" } = {}) {
    const soft = String(result || "All set.").trim();
    const lines = [
      "Done — I’ve finished your request and posted the Blender work below with a download link.",
      soft.length > 360 ? `${soft.slice(0, 340).trim()}…` : soft
    ];
    if (hasSupervisor) {
      lines.push(`${supervisorName || "Your supervisor"} verified the result before I delivered it.`);
    } else {
      lines.push("Download it, ask me to modify, or leave feedback. I won’t keep going unless you ask.");
    }
    return lines.join("\n\n");
  }

  function notifyParentWork({ prompt, result, outputFile }) {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({
          type: "ruxt:work-complete",
          agentId: AGENT_ID,
          prompt: String(prompt || "").trim(),
          result: String(result || "").trim(),
          outputFile: outputFile || null
        }, "*");
      }
    } catch (_) {}
  }

  async function postCompletedWork({ title, prompt, result, outputFile }) {
    try {
      const res = await fetch("/api/work-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: AGENT_ID,
          title: title || "Lina Park work",
          prompt,
          result,
          outputFile: outputFile || null
        })
      });
      const payload = await res.json();
      if (!res.ok || payload.error) throw Error(payload.error || "Could not post work.");
      notifyParentWork({ prompt, result, outputFile: payload.outputFile || outputFile || null });
      return payload;
    } catch (_) {
      notifyParentWork({ prompt, result, outputFile: outputFile || null });
      return {
        ok: false,
        outputFile: outputFile || null,
        downloadUrl: outputFile ? `/api/download?file=${encodeURIComponent(outputFile)}` : null
      };
    }
  }

  function resultCardHtml({ result, outputFile, prompt, downloadUrl, title, taskId, userRating }) {
    const fileName = outputFile ? String(outputFile).split("/").pop() : "Blender project";
    const href = downloadUrl || (outputFile ? `/api/download?file=${encodeURIComponent(outputFile)}` : "");
    return `
      <div class="work-post result-card" data-prompt="${escapeHtml(prompt || "")}" data-result="${escapeHtml(result || "")}" data-file="${escapeHtml(outputFile || "")}">
        <div class="delivery-heading"><span class="delivery-orb">✦</span><div><p class="work-eyebrow">DELIVERY READY</p><strong>${escapeHtml(title || "Scene ready")}</strong></div></div>
        <div class="delivery-actions">
          <button type="button" data-act="download" ${href ? "" : "disabled"}>⇩ Save a copy</button>
          <button type="button" data-act="open" ${outputFile ? "" : "disabled"}>↗ Open in Blender</button>
          <button type="button" data-act="modify">✎ Request a change</button>
        </div>
        <div class="user-rating" data-task-id="${escapeHtml(taskId || "")}">
          <div class="rating-prompt"><span>How did this turn out?</span><button type="button" data-rating-edit ${userRating ? "" : "hidden"}>Change rating</button></div>
          <div class="star-row" role="group" aria-label="Rate Lina's work from 1 to 5 stars">
            ${[1,2,3,4,5].map((star) => `<button type="button" data-rating="${star}" class="${userRating && star <= userRating ? "selected" : ""}" ${userRating ? "disabled" : ""} aria-label="${star} star${star > 1 ? "s" : ""}">★</button>`).join("")}
          </div>
          <small data-rating-status>Give Lina a quick rating — it becomes part of her experience.</small>
        </div>
      </div>`;
  }

  function openChangeDialog(meta) {
    document.querySelector(".change-dialog-backdrop")?.remove();
    const backdrop = document.createElement("div");
    backdrop.className = "change-dialog-backdrop";
    backdrop.innerHTML = `<div class="change-dialog" role="dialog" aria-modal="true" aria-labelledby="changeDialogTitle">
      <div class="change-dialog-glow"></div><div class="change-dialog-head"><span class="delivery-orb">✎</span><div><p class="work-eyebrow">CONTINUE THIS PROJECT</p><h3 id="changeDialogTitle">What should Lina change?</h3></div><button type="button" class="change-dialog-close" data-close-change aria-label="Close">×</button></div>
      <p class="change-dialog-copy">I’ll keep this Blender project and apply your next instruction to it.</p>
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
      linaSay("Downloaded — open it in Blender whenever you like.");
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
        linaSay("Opened the file for you.");
      } catch (error) {
        linaSay(error.message || "I couldn’t open that file just now.");
      }
    });
    card.querySelector('[data-act="modify"]')?.addEventListener("click", () => openChangeDialog(meta));
    card.querySelectorAll("[data-rating]").forEach((button) => button.addEventListener("click", async () => {
      const rating = Number(button.dataset.rating);
      if (!rating) return;
      const stars = [...card.querySelectorAll("[data-rating]")];
      stars.forEach((item) => { item.classList.toggle("selected", Number(item.dataset.rating) <= rating); item.disabled = true; });
      const status = card.querySelector("[data-rating-status]");
      if (status) status.textContent = "Saving your rating to Lina’s UAM memory…";
      try {
        const response = await fetch(`/api/agents/${encodeURIComponent(AGENT_ID)}/feedback`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId: meta.taskId || null, taskStatus: "completed", taskPrompt: meta.prompt || "Blender delivery", rating, reviewerType: "user", reviewerId: state.userName || "workspace-user", comment: `User rated Lina's delivered Blender work ${rating}/5.`, lesson: rating >= 4 ? "This delivery style was useful to the user." : "Ask for clearer requirements and verify the result before delivery." })
        });
        if (!response.ok) throw Error("rating could not be saved");
        const current = activeChat();
        if (current) { current.userRating = rating; current.updatedAt = Date.now(); saveChats(); }
        if (status) status.textContent = `Saved — ${rating}/5 stars will guide Lina’s future work.`;
      } catch (_) {
        if (status) status.textContent = "I couldn’t save that rating yet. You can try again later.";
        stars.forEach((item) => { item.disabled = false; });
      }
    }));
    card.querySelector("[data-rating-edit]")?.addEventListener("click", () => {
      card.querySelectorAll("[data-rating]").forEach((item) => { item.disabled = false; });
      card.querySelector("[data-rating-edit]").hidden = true;
      const status = card.querySelector("[data-rating-status]");
      if (status) status.textContent = "Choose a new score — your latest rating will guide Lina.";
    });
  }

  function askThumbsDown(meta) {
    const row = appendBubble({
      from: "lina",
      html: `Oh no — thanks for saying so. What felt off?<div class="feedback-note"><textarea placeholder="e.g. too shiny / add a camera orbit / simplify the mesh"></textarea><button type="button" class="primary" data-send-down>Tell Lina</button></div>`,
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
        apiPrompt: `Please update the Blender scene. Feedback: ${why}`,
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

  function linaSay(text) {
    appendBubble({ from: "lina", text, at: "Just now" });
    const chat = activeChat();
    if (chat) {
      chat.messages.push({ from: "lina", text, at: "Just now" });
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
          workerName: "Lina Park",
          agentName: "Lina Park",
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

  async function reviewBlenderArtifact({ prompt, result, outputFile, attempt = 1 }) {
    setPresence("I’m checking the Blender result before I send it to the supervisor…");
    const res = await fetch(`${API}/review-artifact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, result, outputFile, attempt })
    });
    const review = await res.json().catch(() => ({}));
    if (!res.ok || !review) throw Error(review.error || "The Blender quality review could not start.");
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
        <h2>Message Lina</h2>
        <p>Pick a chat on the right, or start a fresh Blender project.</p>
        <button type="button" class="primary empty-create" id="emptyCreateBtn">＋ Create a Blender project</button>
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
        const row = appendBubble({
          from: "lina",
          html: `${escapeHtml(msg.text)}${resultCardHtml({
            result: chat.lastResult || msg.text,
            outputFile: chat.outputFile,
            downloadUrl: chat.downloadUrl,
            prompt: chat.brief || chat.name,
            taskId: chat.lastTaskId,
            userRating: chat.userRating,
            title: chat.name
          })}`,
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
      linaSay("I’m still finishing the current Blender job — I’ll stay in this chat until it’s done.");
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
      displayTitle: name && name !== "New Blender project" ? name : "New Blender project",
      templateId: tpl.id,
      brief: brief || "",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: "open",
      outputFile: null,
      lastResult: "",
      messages: [
        {
          from: "lina",
          text: `Hey! Fresh ${tpl.name.toLowerCase()} chat. Before we begin, I’ll check whether Blender is installed. If it isn’t, I can install it when your computer allows, or guide you through the setup. What should we make?`,
          at: "Just now"
        }
      ]
    };
    state.chats.unshift(chat);
    saveChats();
    state.activeId = chat.id;
    renderSideChats();
    renderChat();
    refreshBlenderStatus().then(() => renderAgentWidgets()).catch(() => {});
    if (brief && $("#input")) {
      $("#input").value = brief;
      $("#input").disabled = false;
      $("#input").focus();
    }
  }

  async function ensureBlenderReady() {
    setPresence("Checking Blender…");
    const res = await fetch(`${API}/ensure`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const payload = await res.json();
    state.blender = payload;
    renderBlenderCard();
    if (!payload.ok && !payload.installed) {
      throw Error(payload.message || "Blender isn’t available yet.");
    }
    if (payload.action === "installed") {
      linaSay(payload.message || "Blender is installed now.");
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
        `Got it${address} — I’ll revise only what you asked in Blender. It should take about ${minutes} minutes; I’ll come back when the updated project is ready.`,
        `Thanks${address} — I’m opening the existing scene and applying that fix now. I’ll call you when it’s ready, roughly ${minutes} minutes.`,
        `On it${address} — one focused Blender fix coming up. I expect to be back in about ${minutes} minutes.`
      ])
      : pick([
        `I’ll open Blender and start “${prompt}” now. It should take about ${minutes} minutes; I’ll call you when the project is ready.`,
        `I’m starting “${prompt}” in Blender${address}. Give me around ${minutes} minutes and I’ll come back with the finished scene.`,
        `I’ve got it${address} — Blender is next. I expect this to take about ${minutes} minutes, then I’ll return with the result.`
      ]);
    // Keep work status out of Lina's chat. The dashboard and Blender workspace
    // show this centrally so the conversation remains a clean project record.
    linaSay(text);
    setPresence("Opening Blender and starting the work…");
    setWorkingOverlay(true, text);
  }

  async function chatOnlyReply() {
    setTyping(true);
    await wait(500);
    setTyping(false);
    linaSay(pick([
      "What would you like me to create or change in Blender?",
      "I’m ready. Tell me the object or change you want, and I’ll open Blender.",
      "Could you describe what you want built in Blender — for example, a simple cube or a small scene?"
    ]));
  }

  async function waitForCodexTask(taskId, timeoutMs = 12 * 60 * 1000) {
    const started = Date.now();
    let connectionFailures = 0;
    while (Date.now() - started < timeoutMs) {
      try {
        if (DESKTOP_HANDOFF) {
          const response = await fetch(`${API}/status`, { cache: "no-store" });
          if (!response.ok) throw Error(`Bridge status HTTP ${response.status}`);
          const status = await response.json().catch(() => ({}));
          const task = status?.task;
          if (task && String(task.id) === String(taskId) && ["completed", "failed", "cancelled"].includes(task.status)) {
            if (task.status !== "completed") throw Error(task.result || "Codex CLI MCP computer-use could not finish the Blender task.");
            return { ...task, done: true, outputFile: task.outputFile || null, result: task.result || "Blender work finished through Codex CLI MCP computer-use." };
          }
        } else {
          const response = await fetch("/api/tasks", { cache: "no-store" });
          if (!response.ok) throw Error(`Task status HTTP ${response.status}`);
          const tasks = await response.json();
          const task = Array.isArray(tasks) ? tasks.find((item) => item.id === taskId) : null;
          if (task && (task.done || ["completed", "failed", "cancelled"].includes(task.status))) {
            if (task.status !== "completed") throw Error(task.result || "Codex could not finish the Blender task.");
            if (!task.outputFile) {
              task.outputFile = extractBlendPath(task.result);
            }
            return task;
          }
        }
        connectionFailures = 0;
      } catch (_) {
        connectionFailures += 1;
        setPresence(connectionFailures > 2 ? "Reconnecting to RuXt — your task is being kept alive…" : "Checking Lina’s task status…");
        await wait(Math.min(4000, 900 + connectionFailures * 500));
        continue;
      }
      await wait(1400);
    }
    const timeout = Error("I’m still working in Blender — I’ll call you once it’s done.");
    timeout.code = "TASK_STILL_RUNNING";
    throw timeout;
  }

  async function recoverPendingChat() {
    let chat = state.chats.find((item) => item.taskId && item.status === "working");
    try {
      const rows = await (await fetch("/api/tasks")).json();
      const candidate = latestChat();
      const lastPrompt = [...(candidate?.messages || [])].reverse().find((message) => message.from === "you")?.text || "";
      const latest = (Array.isArray(rows) ? rows : [])
        .filter((item) => item.agent === AGENT_ID && item.status === "completed" && (item.outputFile || extractBlendPath(item.result)))
        .filter((item) => !lastPrompt || String(item.prompt || "").trim().toLowerCase() === String(lastPrompt).trim().toLowerCase())
        .sort((a, b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0))[0];
      const alreadyShown = candidate?.messages?.some((message) => message.result && String(message.text || "").includes(String(latest?.result || "").slice(0, 60)));
      if (latest && candidate && candidate.status !== "stopped" && !alreadyShown && Number(latest.createdAt || 0) >= Number(candidate.createdAt || 0)) {
        candidate.taskId = latest.id;
        candidate.status = "working";
        chat = candidate;
        saveChats();
      }
    } catch (_) {}
    if (!chat) return;
    try {
      setWorkingOverlay(true, "I’m still working in Blender — I’ll call you once it’s done.");
      setPresence("Restoring Lina’s completed work…");
      const finished = await waitForCodexTask(chat.taskId);
      const validation = await (await fetch(`${API}/validate`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outputFile: finished.outputFile })
      })).json();
      if (!validation.valid) throw Error(validation.message || "I couldn’t verify the Blender project yet, so I haven’t marked this task complete.");
      await fetch(`${API}/open`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: finished.outputFile })
      });
      const result = String(finished.result || "Blender work finished.").trim();
      const supervisorReview = state.allowSupervisors && state.supervisor?.id
        ? await runSupervisorReview({ taskId: finished.id, prompt: chat.brief || chat.name, result, outputFile: finished.outputFile })
        : null;
      if (state.allowSupervisors && state.supervisor?.id && (!supervisorReview || supervisorReview.recreate)) {
        throw Error("The supervisor did not verify this restored result, so I have not marked it complete.");
      }
      const posted = await postCompletedWork({ title: chat.name, prompt: chat.brief || chat.name, result, outputFile: finished.outputFile });
      chat.messages.push({ from: "lina", text: friendlyComplete(result, { hasSupervisor: Boolean(state.supervisor), supervisorName: state.supervisor?.name || "your supervisor" }), at: "Just now", result: true });
      chat.status = "done";
      chat.taskId = null;
      chat.lastResult = result;
      chat.lastTaskId = finished.id;
      chat.visualPath = finished.visualPath || null;
      chat.outputFile = posted.outputFile || finished.outputFile;
      chat.downloadUrl = posted.downloadUrl || null;
      chat.updatedAt = Date.now();
      saveChats();
      renderChat();
    } catch (error) {
      chat.status = "open";
      chat.taskId = null;
      saveChats();
      linaSay(caringError(error.message || "I couldn’t restore the finished Blender result yet."));
    } finally {
      setPresence("Active now · Waiting for you");
    }
  }

  async function reconcileCompletedTask(task) {
    const taskId = String(task?.id || task?.taskId || "").trim();
    if (task?.status === "cancelled" || !taskId || state.finalizedTaskIds.has(taskId)) return;
    const chat = state.chats.find((item) => item.taskId === taskId) || activeChat();
    if (!chat) return;
    try {
      let outputFile = task.outputFile || null;
      if (!outputFile) {
        outputFile = extractBlendPath(task.result);
      }
      if (!outputFile) throw Error("The Blender task finished, but RuXt could not locate its .blend file.");
      const validation = await (await fetch(`${API}/validate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outputFile }) })).json();
      if (!validation.valid) throw Error(validation.message || "I couldn’t verify the Blender project yet, so I haven’t marked this task complete.");
      await fetch(`${API}/open`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ file: outputFile }) });
      const result = String(task.result || "Blender work finished.").trim();
      const supervisorReview = state.allowSupervisors && state.supervisor?.id
        ? await runSupervisorReview({ taskId, prompt: chat.brief || chat.name, result, outputFile })
        : null;
      if (state.allowSupervisors && state.supervisor?.id && (!supervisorReview || supervisorReview.recreate)) {
        throw Error("The supervisor did not verify this result, so I have not posted it as complete.");
      }
      const posted = await postCompletedWork({ title: chat.name, prompt: chat.brief || chat.name, result, outputFile });
      chat.messages.push({ from: "lina", text: friendlyComplete(result, { hasSupervisor: Boolean(state.supervisor), supervisorName: state.supervisor?.name || "your supervisor" }), at: "Just now", result: true });
      chat.status = "done";
      chat.taskId = null;
      chat.lastResult = result;
      chat.visualPath = task.visualPath || null;
      chat.lastTaskId = taskId;
      chat.outputFile = posted.outputFile || outputFile;
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
      linaSay(caringError(error.message || "I couldn’t update this chat after the Blender task finished."));
    } finally {
      state.busy = false;
      state.timedOutTaskIds.delete(taskId);
      setWorkingOverlay(false);
      setComposerEnabled(true);
      setPresence("Active now · Waiting for you");
    }
  }

  async function runBlenderBuild(prompt, chat) {
    const controller = new AbortController();
    let activeTaskId = null;
    const poll = setInterval(async () => {
      try {
        if (state.stopRequested) {
          setWorkingOverlay(false);
          return;
        }
        const status = await (await fetch(`${API}/status`)).json();
        state.blender = status;
        renderBlenderCard();
        if (status?.job?.status) {
          const workingStatus = `I’m working in Blender — ${status.job.status}`;
          setPresence(workingStatus);
          setWorkingOverlay(true, workingStatus);
        } else if (status?.focusing) {
          const workingStatus = "I’m working in Blender — I’ll call you once it’s done.";
          setPresence(workingStatus);
          setWorkingOverlay(true, workingStatus);
        }
        if (activeTaskId) {
          const tasks = await (await fetch("/api/tasks")).json();
          const task = Array.isArray(tasks) ? tasks.find((item) => item.id === activeTaskId) : null;
          if (task?.lastStatus) {
            const workingStatus = `I’m working in Blender — ${task.lastStatus}`;
            setPresence(workingStatus);
            setWorkingOverlay(true, workingStatus);
            if ($("#blenderNote")) $("#blenderNote").textContent = task.lastStatus;
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
          name: chat?.name || "scene",
          baseFile: chat?.outputFile || "",
          projectId: chat?.projectId || chat?.id || "new-blender-project",
          priorPrompt: chat?.brief || "",
          priorResult: chat?.lastResult || ""
        }),
        signal: controller.signal
      });
      const done = await response.json().catch(() => ({}));
      if (!response.ok || done.error) throw Error(done.error || done.message || "Couldn’t build in Blender.");
      if (!done.ok) throw Error(done.message || "Blender build didn’t finish.");
      if (!done.task?.id) throw Error("Codex handoff did not return a task.");
      if (state.stopRequested) {
        await cancelBlenderTask(done.task.id);
        return null;
      }
      activeTaskId = done.task.id;
      state.currentTaskId = done.task.id;
      chat.taskId = done.task.id;
      chat.status = "working";
      chat.updatedAt = Date.now();
      saveChats();
      const workingStatus = done.backupFile
        ? "I saved the previous Blender project and opened the working scene. I’m building this update now — I’ll call you once it’s done."
        : "I opened Blender and started a fresh project. I’m building it now — I’ll call you once it’s done.";
      setPresence(workingStatus);
      setWorkingOverlay(true, workingStatus);
      const finished = await waitForCodexTask(done.task.id);
      if (!finished.outputFile) throw Error("I haven’t completed this Blender task yet because I couldn’t locate a saved .blend project. I’m not sending it for supervisor review until I have a valid file.");
      const validation = await (await fetch(`${API}/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outputFile: finished.outputFile })
      })).json();
      if (!validation.valid) throw Error(validation.message || "I couldn’t verify the Blender project yet, so I haven’t marked this task complete.");
      await fetch(`${API}/open`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: finished.outputFile })
      });
      return {
        ...done,
        ...finished,
        ok: finished.status === "completed",
        result: finished.result || done.task.result || "Blender work finished.",
        outputFile: finished.outputFile || null,
        blendFile: finished.outputFile || null
      };
    } finally {
      clearInterval(poll);
      try {
        await fetch(`${API}/focus-stop`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      } catch (_) {}
    }
  }

  async function runReviewedBlenderBuild(prompt, chat) {
    // Lina completes the requested work and hands the saved project to the
    // assigned supervisor. Quality review belongs to the supervisor only;
    // avoid making the worker perform a second, hidden review loop.
    return runBlenderBuild(prompt, chat);
  }

  async function sendMessage(raw, options = {}) {
    const prompt = String(raw || "").trim();
    if (!prompt || state.busy) return;
    const chat = activeChat();
    if (!chat) return;
    const workingChatId = chat.id;
    const taskPrompt = String(options.apiPrompt || prompt).trim();
    let keepWorkingOverlay = false;

    showSide("chats");
    if (!chat.displayTitle || chat.displayTitle === "New Blender project") {
      chat.displayTitle = smartChatTitle(prompt, chat.name || "Blender project");
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
    state.busy = true;
    state.stopRequested = false;
    state.currentTaskId = null;
    state.workingChat = chat;
    state.activeId = workingChatId;
    setComposerEnabled(true);

    try {
      if (!wantsBlenderWork(prompt, options)) {
        await chatOnlyReply();
        return;
      }

      setWorkingOverlay(true);
      await humanAck(prompt, Boolean(options.continuation));
      if (state.stopRequested) return;
      // Give the user a moment to read Lina's plan before Blender comes
      // forward. This also makes the handoff feel intentional rather than
      // like an abrupt app switch.
      await wait(900);
      if (state.stopRequested) return;
      state.activeId = workingChatId;
      showSide("chats");
      setTyping(true);
      await ensureBlenderReady();
      if (state.stopRequested) return;
      setPresence("I’m opening Blender and connecting the visual controls…");
      state.handoffPending = runReviewedBlenderBuild(taskPrompt, chat);
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
      let outputFile = done.outputFile || done.blendFile || null;
      const workTitle = liveChat.name || "Lina Park work";
      const originalPrompt = options.continuation?.priorPrompt || prompt;
      const hasSupervisor = Boolean(state.allowSupervisors && state.supervisor && !options.skipSupervisor);
      const supervisorName = state.supervisor?.name || "your supervisor";
      let supervisorReview = null;

      // A supervisor is a delivery gate: verify the artifact before Lina posts
      // it as completed work. This prevents an unverified result from looking
      // finished in the chat or forum.
      if (hasSupervisor) {
        supervisorSay(`${supervisorName} here — I’m verifying Lina’s result before delivery.`);
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
          linaSay("I’m waiting for the supervisor’s verification before I deliver this.");
          return;
        }
        const recreatePrompt = supervisorReview?.recreatePrompt || supervisorReview?.fixPrompt;
        if (supervisorReview.recreate && recreatePrompt && !options.fromSupervisorFix) {
          linaSay(`I’m going to recreate this after ${supervisorName} found an issue. I’ll bring you the corrected result next.`);
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
          linaSay("The supervisor still found an issue after the second pass. Tell me what you want changed next.");
          return;
        }
      }

      setPresence("Posting completed work…");
      const posted = await postCompletedWork({
        title: workTitle,
        prompt: originalPrompt,
        result,
        outputFile
      });
      outputFile = posted.outputFile || outputFile;
      const downloadUrl = posted.downloadUrl
        || (outputFile ? `/api/download?file=${encodeURIComponent(outputFile)}` : null);

      const friendly = friendlyComplete(result, { hasSupervisor, supervisorName });
      liveChat.messages.push({ from: "lina", text: friendly, at: "Just now", result: true });
      liveChat.visualPath = done.visualPath || null;
      liveChat.lastTaskId = completedTaskId;
      liveChat.status = "done";
      liveChat.taskId = null;
      liveChat.lastResult = result;
      liveChat.outputFile = outputFile;
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
          linaSay(`The supervisor verified this at ${supervisorReview.score}%. Choose Accept work or Modify.`);
        }
      } else {
        linaSay("All set on my side — I’m waiting for you.");
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
      if (error?.code === "TASK_STILL_RUNNING") {
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
      linaSay(caringError(error.message || "Something got stuck while I was working. I’ll stay with you while we try again."));
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
    createChat({ name: "New Blender project", brief: "", templateId: state.selectedTemplate });
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

  $("#ensureBlenderBtn")?.addEventListener("click", async () => {
    $("#ensureBlenderBtn").disabled = true;
    setPresence("Checking Blender…");
    try {
      const res = await fetch(`${API}/ensure`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const payload = await res.json();
      state.blender = payload;
      renderBlenderCard();
      setPresence(payload.ok || payload.installed ? "Blender ready · Waiting for you" : "Active now · Waiting for you");
      if (state.activeId) {
        linaSay(payload.message || (payload.installed ? "Blender is ready." : "Still need Blender installed."));
      }
    } catch (error) {
      setPresence("Active now · Waiting for you");
      if (state.activeId) linaSay(error.message || "Couldn’t check Blender just now.");
    } finally {
      $("#ensureBlenderBtn").disabled = false;
    }
  });

  $("#openBlenderBtn")?.addEventListener("click", async () => {
    try {
      const res = await fetch(`${API}/open`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const payload = await res.json();
      state.blender = payload;
      renderBlenderCard();
      if (state.activeId) {
        linaSay(payload.ok ? "Opened Blender for you." : (payload.message || payload.error || "Couldn’t open Blender."));
      }
    } catch (error) {
      if (state.activeId) linaSay(error.message || "Couldn’t open Blender.");
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
        reconcileCompletedTask({ id: taskId, result: data.result, outputFile: data.outputFile });
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
    refreshBlenderStatus();
    openFromHash();
    const last = latestChat();
    if (last) openChat(last.id);
    else renderChat();
    await reconcileWorkingDialog();
    recoverPendingChat();
  })();
})();
