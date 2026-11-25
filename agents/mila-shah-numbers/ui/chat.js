(() => {
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (sel) => [...document.querySelectorAll(sel)];
  const AGENT_ID = "mila-shah-numbers";
  const STORE_KEY = "mila-shah-numbers-chats-v5";
  const ALLOW_SUPERVISORS = true; // mirrors manifest.allowSupervisors

  const TEMPLATES = [
    {
      id: "calendar",
      name: "Monthly calendar",
      blurb: "Month grid, weekend shading, editable notes.",
      prompt: "Create a clean monthly calendar in Apple Numbers with weekend shading and room for notes.",
      chips: ["Add public holidays", "Make a second month", "Export-friendly layout"],
      columns: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      sheetBits: ["35 day cells", "Weekend fill", "Notes column"],
      tip: "Ask for holidays or a second month tab anytime."
    },
    {
      id: "timetable",
      name: "School timetable",
      blurb: "Weekly class grid for kids or tutors.",
      prompt: "Build a colorful weekly school timetable in Numbers with editable subject cells.",
      chips: ["Add Saturday classes", "Color by subject", "Add teacher column"],
      columns: ["Period", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      sheetBits: ["Periods × days", "Subject colors", "Break rows"],
      tip: "Color by subject keeps the week easy to scan."
    },
    {
      id: "budget",
      name: "Household budget",
      blurb: "Income, rent, groceries, savings totals.",
      prompt: "Make a household budget sheet in Numbers with rent, groceries, utilities, and savings totals.",
      chips: ["Add income section", "Track last month too", "Highlight overspend"],
      columns: ["Category", "Planned", "Actual", "Diff", "Notes", "%", "Flag"],
      sheetBits: ["SUM totals", "Diff formulas", "Overspend tint"],
      tip: "Planned vs actual with a running difference column."
    },
    {
      id: "invoice",
      name: "Invoice tracker",
      blurb: "Clients, amounts, due dates, paid status.",
      prompt: "Create an invoice tracker in Numbers with client, amount, due date, and paid status columns.",
      chips: ["Add tax column", "Filter unpaid only", "Monthly summary"],
      columns: ["Invoice", "Client", "Amount", "Due", "Paid", "Tax", "Status"],
      sheetBits: ["Status column", "Due dates", "Unpaid filter"],
      tip: "Filter to unpaid rows when chasing payments."
    },
    {
      id: "inventory",
      name: "Inventory list",
      blurb: "Items, quantity, reorder level.",
      prompt: "Build a simple inventory sheet in Numbers with item, quantity, unit cost, and reorder level.",
      chips: ["Low-stock highlight", "Add supplier field", "Value totals"],
      columns: ["Item", "Qty", "Unit $", "Reorder", "Supplier", "Value", "Alert"],
      sheetBits: ["Qty × cost", "Reorder alert", "Supplier"],
      tip: "Low-stock highlight uses reorder level vs quantity."
    },
    {
      id: "habit",
      name: "Habit tracker",
      blurb: "Daily checkboxes for a month.",
      prompt: "Make a monthly habit tracker in Numbers with daily checkboxes and a weekly completion count.",
      chips: ["Add streak formula", "More habits", "Soft color theme"],
      columns: ["Habit", "W1", "W2", "W3", "W4", "Total", "Streak"],
      sheetBits: ["Daily checks", "Weekly count", "Streak"],
      tip: "Weekly counts make streaks feel encouraging, not scary."
    }
  ];

  const SEED_CHATS = [
    {
      id: "seed-calendar",
      name: "December 2026 calendar",
      templateId: "calendar",
      createdAt: Date.now() - 86400000 * 2,
      updatedAt: Date.now() - 86400000 * 2,
      status: "done",
      outputFile: null,
      lastResult: "December calendar with weekend shading is ready.",
      messages: [
        { from: "mila", text: "Hey! New calendar chat — tell me the month and any extras you want when you’re ready.", at: "Yesterday" },
        { from: "you", text: "December 2026 with weekend shading, please.", at: "Yesterday" },
        { from: "mila", text: "Done — spacious week cells and weekend shading. Want holidays next?", at: "Yesterday", result: true }
      ]
    },
    {
      id: "seed-budget",
      name: "March household budget",
      templateId: "budget",
      createdAt: Date.now() - 86400000 * 5,
      updatedAt: Date.now() - 86400000 * 4,
      status: "done",
      outputFile: null,
      lastResult: "Budget sheet with rent, groceries, utilities, and savings.",
      messages: [
        { from: "mila", text: "Budget chat is open. Say the word when you want categories built.", at: "5 days ago" },
        { from: "you", text: "Rent, groceries, utilities, savings.", at: "5 days ago" },
        { from: "mila", text: "All set — editable totals are in place. Tweak anytime.", at: "4 days ago", result: true }
      ]
    },
    {
      id: "seed-timetable",
      name: "Grade 1 weekly timetable",
      templateId: "timetable",
      createdAt: Date.now() - 86400000 * 8,
      updatedAt: Date.now() - 86400000 * 8,
      status: "done",
      outputFile: null,
      lastResult: "Colorful Grade 1 weekly timetable ready.",
      messages: [
        { from: "mila", text: "Timetable chat ready — age group and days whenever you like.", at: "Last week" },
        { from: "you", text: "Grade 1, Monday to Friday, colorful please.", at: "Last week" },
        { from: "mila", text: "Done! Colorful editable cells for the week. Want Saturday too?", at: "Last week", result: true }
      ]
    },
    {
      id: "seed-invoice",
      name: "Studio invoice tracker",
      templateId: "invoice",
      createdAt: Date.now() - 86400000 * 3,
      updatedAt: Date.now() - 86400000 * 3,
      status: "done",
      outputFile: null,
      lastResult: "Invoice tracker with client, amount, due, and paid status.",
      messages: [
        { from: "mila", text: "Invoice tracker chat — which clients should I seed when you ask?", at: "3 days ago" },
        { from: "you", text: "Clients, amounts, due dates, and paid/unpaid please.", at: "3 days ago" },
        { from: "mila", text: "Ready — filter unpaid anytime. Want a tax column next?", at: "3 days ago", result: true }
      ]
    },
    {
      id: "seed-inventory",
      name: "Craft supply inventory",
      templateId: "inventory",
      createdAt: Date.now() - 86400000 * 6,
      updatedAt: Date.now() - 86400000 * 6,
      status: "done",
      outputFile: null,
      lastResult: "Inventory with quantity, unit cost, and reorder alerts.",
      messages: [
        { from: "mila", text: "Inventory chat — what are you stocking?", at: "6 days ago" },
        { from: "you", text: "Paper, ink, glue sticks — with reorder levels.", at: "6 days ago" },
        { from: "mila", text: "Stocked. Low rows will tint when qty dips under reorder.", at: "6 days ago", result: true }
      ]
    },
    {
      id: "seed-habit",
      name: "November habit tracker",
      templateId: "habit",
      createdAt: Date.now() - 86400000 * 1,
      updatedAt: Date.now() - 1000,
      status: "done",
      outputFile: null,
      lastResult: "Monthly habit tracker with daily checks and weekly counts.",
      messages: [
        { from: "mila", text: "Habit tracker — which habits for this month?", at: "Today" },
        { from: "you", text: "Read, walk, stretch — daily checks for November.", at: "Today" },
        { from: "mila", text: "Done — daily cells plus weekly completion counts. Streaks next?", at: "Today", result: true }
      ]
    }
  ];

  const state = {
    side: "chats",
    chats: [],
    activeId: null,
    selectedTemplate: "calendar",
    busy: false,
    abortPoll: false,
    supervisor: null,
    supervisors: [],
    allowSupervisors: ALLOW_SUPERVISORS,
    page: "home"
  };

  function uid(prefix = "chat") {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function bindWidgetLinks() {
    $$("[data-page]").forEach((el) => {
      if (el.dataset.bound === "1") return;
      el.dataset.bound = "1";
      el.addEventListener("click", (event) => {
        event.preventDefault();
        openPage(el.dataset.page);
      });
    });
  }

  function loadChats() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
      if (raw?.supervisor) state.supervisor = raw.supervisor;
      if (Array.isArray(raw?.chats) && raw.chats.length) {
        state.chats = raw.chats;
        return;
      }
      // migrate older project store if present
      const legacy = JSON.parse(localStorage.getItem("mila-shah-numbers-projects-v2") || "null")
        || JSON.parse(localStorage.getItem("mila-shah-numbers-chats-v3") || "null");
      if (Array.isArray(legacy?.chats) && legacy.chats.length) {
        state.chats = legacy.chats;
        if (legacy.supervisor) state.supervisor = legacy.supervisor;
        saveChats();
        return;
      }
      if (Array.isArray(legacy?.projects) && legacy.projects.length) {
        state.chats = legacy.projects;
        saveChats();
        return;
      }
    } catch (_) {}
    state.chats = SEED_CHATS.map((item) => ({ ...item, messages: item.messages.map((m) => ({ ...m })) }));
    saveChats();
  }

  function saveChats() {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      chats: state.chats.filter((chat) => !chat.ephemeral),
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

  function ensureChatView() {
    const workspace = $("#workspace");
    state.page = "home";
    state.side = "chats";
    workspace?.classList.remove("page-mode");
    if ($("#chatPane")) $("#chatPane").hidden = false;
    if ($("#sidePane")) $("#sidePane").hidden = false;
    Object.entries({
      overview: "#pageOverview",
      howto: "#pageHowto",
      chats: "#pageChatsAll",
      templates: "#pageTemplates",
      tips: "#pageTips",
      supervisor: "#pageSupervisor",
      new: "#pageNew"
    }).forEach(([, selector]) => {
      const el = $(selector);
      if (el) el.hidden = true;
    });
  }

  function openPage(name) {
    // Stay in the live chat while Mila is working — don't jump to widget pages.
    if (state.busy && name !== "home") {
      return;
    }
    const page = String(name || "home");
    state.page = page;
    state.side = page === "home" ? "chats" : page;
    const workspace = $("#workspace");
    const home = page === "home";
    workspace?.classList.toggle("page-mode", !home);
    if ($("#chatPane")) $("#chatPane").hidden = !home;
    if ($("#sidePane")) $("#sidePane").hidden = !home;

    const pages = {
      overview: "#pageOverview",
      howto: "#pageHowto",
      chats: "#pageChatsAll",
      templates: "#pageTemplates",
      tips: "#pageTips",
      supervisor: "#pageSupervisor",
      new: "#pageNew"
    };
    Object.entries(pages).forEach(([key, selector]) => {
      const el = $(selector);
      if (el) el.hidden = key !== page;
    });

    if (page === "supervisor") {
      loadSupervisors().then(() => {
        renderSupervisorCard();
        renderSupervisorPicker();
      });
    }
    if (page === "chats") renderChatList();
    if (page === "templates" || page === "new") {
      renderTemplates();
      renderTemplatePreview();
    }
    if (page === "overview") renderStats();
  }

  function showSide(name) {
    if (name === "chats") openPage("home");
    else openPage(name);
  }

  function setPresence(text) {
    if ($("#presence")) $("#presence").textContent = text;
  }

  function setTyping(on) {
    if ($("#typing")) $("#typing").hidden = !on;
    if (on) setPresence("Mila is typing…");
    else if (!state.busy) setPresence("Active now · Waiting for you");
  }

  async function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function wantsSheetWork(prompt, options = {}) {
    if (options.forceTask || options.continuation || options.mode === "fix") return true;
    const p = String(prompt || "").toLowerCase();
    return /\b(make|create|build|add|update|fix|change|remove|export|download|open|calendar|budget|invoice|timetable|inventory|habit|sheet|numbers|column|row|formula|weekend|holiday|tracker|total)\b/.test(p);
  }

  function renderStats() {
    const done = state.chats.filter((p) => p.status === "done").length;
    const open = state.chats.filter((p) => p.status !== "done").length;
    const html = `
      <div class="stat"><b>${state.chats.length}</b><span>Chats</span></div>
      <div class="stat"><b>${done}</b><span>Ready</span></div>
      <div class="stat"><b>${open}</b><span>Waiting</span></div>
      <div class="stat"><b>${TEMPLATES.length}</b><span>Templates</span></div>`;
    if ($("#chatStats")) $("#chatStats").innerHTML = html;
    if ($("#chatStatsPreview")) $("#chatStatsPreview").innerHTML = html;
    if ($("#chatsPreview")) {
      $("#chatsPreview").textContent = `${state.chats.length} chats · ${done} ready · ${open} waiting`;
    }
    if ($("#templatesPreview")) {
      $("#templatesPreview").textContent = `${TEMPLATES.length} Numbers templates ready to start.`;
    }
  }

  function renderTemplatePreview() {
    const tpl = templateById(state.selectedTemplate);
    if ($("#previewTitle")) $("#previewTitle").textContent = tpl.name;
    if ($("#previewBlurb")) $("#previewBlurb").textContent = tpl.blurb;
    if ($("#previewMeta")) {
      $("#previewMeta").innerHTML = [
        ...(tpl.sheetBits || []).map((bit) => `<li>${escapeHtml(bit)}</li>`),
        `<li>${escapeHtml(tpl.tip || "")}</li>`
      ].join("");
    }
    if ($("#miniSheet")) {
      const cols = tpl.columns || ["A", "B", "C", "D", "E", "F", "G"];
      const header = `<div class="ms-row">${cols.map((c) => `<div class="ms-cell">${escapeHtml(c)}</div>`).join("")}</div>`;
      const body = [1, 2, 3].map((row) =>
        `<div class="ms-row">${cols.map((_, i) =>
          `<div class="ms-cell${i === 0 || i === cols.length - 1 ? " accent" : ""}">${row}</div>`
        ).join("")}</div>`
      ).join("");
      $("#miniSheet").innerHTML = header + body;
    }
  }

  function renderTemplates() {
    if ($("#templateGrid")) {
      $("#templateGrid").innerHTML = TEMPLATES.map((tpl) => `
        <button type="button" class="template-card" data-template="${tpl.id}">
          <strong>${escapeHtml(tpl.name)}</strong>
          <p>${escapeHtml(tpl.blurb)}</p>
        </button>`).join("");
    }

    if ($("#templatePick")) {
      $("#templatePick").innerHTML = TEMPLATES.map((tpl) => `
        <button type="button" class="template-card${tpl.id === state.selectedTemplate ? " active" : ""}" data-pick="${tpl.id}">
          <strong>${escapeHtml(tpl.name)}</strong>
          <p>${escapeHtml(tpl.blurb)}</p>
        </button>`).join("");
    }

    $$("[data-template]").forEach((btn) => {
      btn.onclick = () => {
        state.selectedTemplate = btn.dataset.template;
        const tpl = templateById(state.selectedTemplate);
        if ($("#newName")) $("#newName").value = tpl.name;
        if ($("#newBrief")) $("#newBrief").value = "";
        openPage("new");
      };
    });
    $$("[data-pick]").forEach((btn) => {
      btn.onclick = () => {
        state.selectedTemplate = btn.dataset.pick;
        const tpl = templateById(state.selectedTemplate);
        if ($("#newName") && !$("#newName").value.trim()) $("#newName").value = tpl.name;
        renderTemplates();
        renderTemplatePreview();
      };
    });
    renderTemplatePreview();
  }

  function chatCardHtml(chat) {
    const tpl = templateById(chat.templateId);
    const when = new Date(chat.updatedAt || chat.createdAt).toLocaleDateString();
    const active = chat.id === state.activeId ? " active" : "";
    return `<div class="chat-card-row"><button type="button" class="chat-card${active}" data-open="${chat.id}">
      <strong>${escapeHtml(chat.name)}</strong>
      <p>${escapeHtml(tpl.name)} · ${chat.status === "done" ? "Ready" : "Waiting"}</p>
      <div class="meta">${escapeHtml(when)}</div>
    </button><button type="button" class="chat-delete" data-delete="${escapeHtml(chat.id)}" aria-label="Delete ${escapeHtml(chat.name)}">×</button></div>`;
  }

  function renderChatList() {
    const list = [...state.chats].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const full = $("#chatList");
    const mini = $("#chatListMini");
    if (full) {
      full.innerHTML = list.length
        ? list.map(chatCardHtml).join("")
        : `<div class="empty">No chats yet. Start one with a Numbers template.</div>`;
    }
    if (mini) {
      mini.innerHTML = list.length
        ? list.slice(0, 3).map(chatCardHtml).join("")
        : `<div class="empty">No chats yet.</div>`;
    }
    $$("[data-open]").forEach((btn) => {
      btn.onclick = () => openChat(btn.dataset.open);
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
    const preview = $("#supervisorPreview");
    const manage = $("#manageSupervisorLink");
    const addBtn = $("#addSupervisorBtn");
    const nav = $("#navSupervisorBtn");
    if (!state.allowSupervisors) {
      if (card) card.hidden = true;
      if (nav) nav.hidden = true;
      return;
    }
    if (card) card.hidden = false;
    if (nav) nav.hidden = false;
    if (!state.supervisor) {
      if (preview) preview.textContent = "No supervisor assigned yet.";
      if (manage) manage.hidden = true;
      if (addBtn) addBtn.hidden = false;
      if (slot) {
        slot.innerHTML = `
          <strong>No supervisor</strong>
          <p>Add any installed supervisor agent to rate Mila’s finished work.</p>`;
      }
      return;
    }
    const s = state.supervisor;
    if (preview) preview.textContent = `${s.name} · rates finished work`;
    if (manage) manage.hidden = false;
    if (addBtn) addBtn.textContent = "Change supervisor";
    if (slot) {
      slot.innerHTML = `
        <div class="supervisor-active">
          <img src="${escapeHtml(s.avatar || `/agents/${s.id}/avatar.jpg`)}" alt="" />
          <div>
            <strong>${escapeHtml(s.name)}</strong>
            <p>${escapeHtml(s.role || "Supervisor")} · Rates Mila’s completed work</p>
          </div>
          <div class="supervisor-actions">
            <button type="button" class="ghost" id="removeSupervisorBtn">Remove</button>
          </div>
        </div>`;
      $("#removeSupervisorBtn")?.addEventListener("click", () => {
        state.supervisor = null;
        saveChats();
        renderSupervisorCard();
      });
    }
  }

  async function openSupervisorPicker() {
    if (!state.allowSupervisors) return;
    await loadSupervisors();
    openPage("supervisor");
  }

  function renderSupervisorPicker() {
    const list = state.supervisors || [];
    const pick = $("#supervisorPick");
    if (!pick) return;
    pick.innerHTML = list.map((item) => `
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
        renderSupervisorCard();
        openPage("home");
        if (state.activeId) {
          supervisorSay(`I’m watching Mila’s work now. When she finishes, I’ll rate it and comment — or ask her to recreate it if there’s an error.`);
        }
      };
    });
  }

  function renderSideChats() {
    renderStats();
    renderSupervisorCard();
    renderTemplates();
    renderChatList();
    bindWidgetLinks();
    openPage("home");
  }

  function scrollChatToEnd() {
    const thread = $("#thread");
    if (!thread) return;
    requestAnimationFrame(() => {
      thread.scrollTop = thread.scrollHeight;
    });
  }

  function appendBubble({ from, text, at, html }) {
    const thread = $("#thread");
    if (!thread) return null;
    const empty = $("#emptyChat");
    if (empty) empty.remove();
    const row = document.createElement("div");
    row.className = `row ${from}`;
    if (from === "mila") {
      row.innerHTML = `<img src="../avatar.jpg" alt="" /><div class="bubble">${html || escapeHtml(text)}<span class="meta">${escapeHtml(at || "Just now")}</span></div>`;
    } else if (from === "trump" || from === "supervisor") {
      const avatar = state.supervisor?.avatar || `/agents/${state.supervisor?.id || "donald-trump-supervisor"}/avatar.jpg`;
      const name = state.supervisor?.name || "Supervisor";
      row.innerHTML = `<img src="${escapeHtml(avatar)}" alt="" /><div class="bubble"><span class="trump-tag">${escapeHtml(name).toUpperCase()}</span>${html || escapeHtml(text)}<span class="meta">${escapeHtml(at || "Just now")}</span></div>`;
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
      "Done — I’ve finished your request and posted the work below with a download link.",
      soft.length > 360 ? `${soft.slice(0, 340).trim()}…` : soft
    ];
    if (hasSupervisor) {
      lines.push(`I’ve also notified ${supervisorName || "your supervisor"} to review it.`);
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
          title: title || "Mila Shah work",
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

  function resultCardHtml({ result, outputFile, prompt, downloadUrl, title }) {
    const fileName = outputFile ? String(outputFile).split("/").pop() : "Completed work";
    const href = downloadUrl || (outputFile ? `/api/download?file=${encodeURIComponent(outputFile)}` : "");
    return `
      <div class="work-post result-card" data-prompt="${escapeHtml(prompt || "")}" data-result="${escapeHtml(result || "")}" data-file="${escapeHtml(outputFile || "")}">
        <p class="work-eyebrow">POSTED WORK · MILA SHAH</p>
        <strong>✓ ${escapeHtml(title || "Spreadsheet ready")}</strong>
        <p class="work-summary">${escapeHtml((result || "").slice(0, 420) || fileName)}</p>
        ${href
          ? `<a class="download-link" href="${escapeHtml(href)}" download data-act="download-link">⬇ Download work</a>`
          : `<span class="download-link disabled">Download unavailable</span>`}
        <div class="result-actions">
          <button type="button" data-act="download" ${href ? "" : "disabled"}>Download</button>
          <button type="button" data-act="open" class="soft" ${outputFile ? "" : "disabled"}>Open in Numbers</button>
          <button type="button" data-act="modify">Modify</button>
          <button type="button" data-act="up">👍</button>
          <button type="button" data-act="down">👎</button>
        </div>
      </div>`;
  }

  function bindResultCard(row, meta) {
    const card = row?.querySelector(".result-card, .work-post");
    if (!card) return;
    const download = () => {
      const href = meta.downloadUrl
        || (meta.outputFile ? `/api/download?file=${encodeURIComponent(meta.outputFile)}` : "");
      if (!href) return;
      location.href = href;
      milaSay("Downloaded — hope it opens cleanly on your Mac!");
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
        milaSay("Opened it in Numbers for you.");
      } catch (error) {
        milaSay(error.message || "I couldn’t open that file just now.");
      }
    });
    card.querySelector('[data-act="modify"]')?.addEventListener("click", () => {
      const correction = prompt("What should I change in this spreadsheet?");
      if (!correction?.trim()) return;
      sendMessage(correction.trim(), {
        mode: "fix",
        forceTask: true,
        continuation: {
          priorPrompt: meta.prompt || "",
          priorResult: meta.result || "",
          outputFile: meta.outputFile || null
        }
      });
    });
    card.querySelector('[data-act="up"]')?.addEventListener("click", () => {
      milaSay(pick([
        "Aww thank you — that means a lot. I’ll wait here until you need another change.",
        "Thanks! Glad this one landed well. Ping me only when you want a tweak.",
        "Appreciate the thumbs up 💛 Sitting quiet until you ask."
      ]));
    });
    card.querySelector('[data-act="down"]')?.addEventListener("click", () => {
      askThumbsDown(meta);
    });
  }

  function askThumbsDown(meta) {
    const row = appendBubble({
      from: "mila",
      html: `Oh no — thanks for the honesty. What felt off?<div class="feedback-note"><textarea placeholder="e.g. weekends aren’t shaded / add a totals row"></textarea><button type="button" class="primary" data-send-down>Tell Mila</button></div>`,
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
        apiPrompt: `Please update the spreadsheet. Feedback: ${why}`,
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

  function milaSay(text) {
    appendBubble({ from: "mila", text, at: "Just now" });
    const chat = activeChat();
    if (chat) {
      chat.messages.push({ from: "mila", text, at: "Just now" });
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
          workerName: "Mila Shah",
          agentName: "Mila Shah",
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
    const rating = review.rating;
    const body = review.comment;
    const html = `<span class="supervisor-rating">${rating}/5 · ${escapeHtml(review.verdict || (review.recreate ? "RECREATE" : "OK"))}</span><div>${escapeHtml(body)}</div>`;
    appendBubble({ from: "supervisor", html, at: "Just now" });
    const chat = activeChat();
    if (chat) {
      chat.messages.push({ from: "supervisor", text: `${rating}/5 — ${body}`, at: "Just now" });
      chat.updatedAt = Date.now();
      saveChats();
      renderChatList();
    }
    return review;
  }

  function setComposerEnabled(on) {
    if ($("#input")) $("#input").disabled = !on;
    if ($("#sendBtn")) $("#sendBtn").disabled = !on || state.busy;
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
        <h2>Message Mila</h2>
        <p>Pick a chat on the right — she only builds when you ask.</p>
      </div>`;
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
          from: "mila",
          html: `${escapeHtml(msg.text)}${resultCardHtml({
            result: chat.lastResult || msg.text,
            outputFile: chat.outputFile,
            downloadUrl: chat.downloadUrl,
            prompt: chat.brief || chat.name,
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
          prompt: chat.brief || msg.text
        });
      } else if (msg.from === "trump" || msg.from === "supervisor") {
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
      milaSay("I’m still finishing the current sheet — I’ll stay in this chat until it’s done.");
      return;
    }
    state.activeId = id;
    renderChat();
    openPage("home");
    renderChatList();
  }

  function createChat({ name, brief, templateId }) {
    const tpl = templateById(templateId);
    const chat = {
      id: uid("chat"),
      name: name || tpl.name,
      templateId: tpl.id,
      brief: brief || "",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: "open",
      ephemeral: true,
      outputFile: null,
      lastResult: "",
      messages: [
        {
          from: "mila",
          text: `Hey! Fresh ${tpl.name.toLowerCase()} chat. I’m here when you want something built in Numbers — just ask.`,
          at: "Just now"
        }
      ]
    };
    state.chats.unshift(chat);
    state.activeId = chat.id;
    renderSideChats();
    renderChat();
    // draft only — do not auto-run Numbers
    if (brief && $("#input")) {
      $("#input").value = brief;
      $("#input").disabled = false;
      $("#input").focus();
    }
  }

  async function humanAck(prompt, isFix) {
    setTyping(true);
    await wait(450 + Math.min(700, prompt.length * 4));
    setTyping(false);
    const text = isFix
      ? pick([
        "Got it — I’ll revise only what you asked.",
        "Thanks — updating the sheet with that change now.",
        "On it — one focused fix coming up."
      ])
      : pick([
        "Okay — working on exactly that in Numbers.",
        "Got your ask. Building just that sheet now.",
        "On it — only what you requested."
      ]);
    milaSay(text);
  }

  async function chatOnlyReply(prompt) {
    setTyping(true);
    await wait(500);
    setTyping(false);
    milaSay(pick([
      "Got it. Tell me when you want a Numbers change and I’ll jump in.",
      "I’m listening. When you’re ready for a sheet update, just ask clearly.",
      "Noted. I won’t start Numbers work until you ask for a build or fix."
    ]));
  }

  async function runTask(prompt, options = {}) {
    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        agent: AGENT_ID,
        mode: options.mode || (options.continuation ? "fix" : "run"),
        continuation: options.continuation || null
      })
    });
    const task = await response.json().catch(() => ({}));
    if (!response.ok || task.error) throw Error(task.error || "Couldn’t start the spreadsheet work.");

    const started = Date.now();
    while (Date.now() - started < 300000) {
      if (state.abortPoll) throw Error("Stopped.");
      await wait(1500);
      const rows = await (await fetch("/api/tasks")).json();
      const current = (rows || []).find((item) => item.id === task.id);
      if (!current) continue;
      if (!current.done) setPresence(current.lastStatus || "Working in Numbers…");
      if (current.status === "cancelled") throw Error(current.result || "I stopped here at your request.");
      if (current.done) return current;
    }
    throw Error("That took too long — try a smaller ask?");
  }

  async function sendMessage(raw, options = {}) {
    const prompt = String(raw || "").trim();
    if (!prompt || state.busy) return;
    const chat = activeChat();
    if (!chat) return;
    if (chat.ephemeral) {
      chat.ephemeral = false;
      saveChats();
    }
    const workingChatId = chat.id;
    const taskPrompt = String(options.apiPrompt || prompt).trim();

    ensureChatView();
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
    state.activeId = workingChatId;
    setComposerEnabled(true);

    try {
      if (!wantsSheetWork(prompt, options)) {
        await chatOnlyReply(prompt);
        return;
      }

      await humanAck(prompt, Boolean(options.continuation));
      state.activeId = workingChatId;
      ensureChatView();
      setTyping(true);
      setPresence("Working in Numbers…");
      const done = await runTask(taskPrompt, options);
      setTyping(false);

      // Always return to the chat that ran the task before announcing.
      state.activeId = workingChatId;
      ensureChatView();

      const liveChat = state.chats.find((item) => item.id === workingChatId) || chat;
      const result = String(done.result || "All set.").trim();
      let outputFile = done.outputFile || null;
      const workTitle = liveChat.name || "Mila Shah work";
      const originalPrompt = options.continuation?.priorPrompt || prompt;
      const hasSupervisor = Boolean(state.allowSupervisors && state.supervisor && !options.skipSupervisor);
      const supervisorName = state.supervisor?.name || "your supervisor";

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
      liveChat.messages.push({ from: "mila", text: friendly, at: "Just now", result: true });
      liveChat.status = "done";
      liveChat.lastResult = result;
      liveChat.outputFile = outputFile;
      liveChat.downloadUrl = downloadUrl;
      liveChat.updatedAt = Date.now();
      saveChats();
      renderChat();
      scrollChatToEnd();

      if (hasSupervisor) {
        supervisorSay(`${supervisorName} here — Mila finished “${workTitle}”. I’m reviewing it now.`);
        const review = await runSupervisorReview({
          prompt: originalPrompt,
          taskId: done.id,
          result,
          outputFile
        });
        if (!review) return;
        const needsRecreate = review.recreate;
        const recreatePrompt = review?.recreatePrompt || review?.fixPrompt;
        if (!needsRecreate) {
          const delivery = [...liveChat.messages].reverse().find(message => message.result);
          if (delivery) delivery.userDecision = "pending";
          saveChats();
          renderChat();
          milaSay(`The supervisor scored this ${review.score}%. Choose Accept work or Modify.`);
        }
        if (needsRecreate && recreatePrompt && !options.fromSupervisorFix) {
          milaSay(`Got it — ${supervisorName} asked me to recreate this. Working on a fresh version now.`);
          state.busy = false;
          await sendMessage(recreatePrompt, {
            mode: "fix",
            forceTask: true,
            fromSupervisorFix: true,
            apiPrompt: recreatePrompt,
            continuation: {
              priorPrompt: originalPrompt,
              priorResult: result,
              outputFile
            }
          });
          return;
        }
        if (needsRecreate && options.fromSupervisorFix) {
          supervisorSay("Still not good enough after the recreate. Ask Mila again when you want another pass — I’ll keep watching.");
          milaSay("I tried a recreate, but the supervisor still wants changes. Tell me what to fix next.");
        }
      } else {
        milaSay("All set on my side — I’m waiting for you.");
      }

      state.activeId = workingChatId;
      ensureChatView();
      renderChat();
      scrollChatToEnd();
    } catch (error) {
      setTyping(false);
      state.activeId = workingChatId;
      ensureChatView();
      milaSay(error.message || "Hmm, something got stuck. Want to try a shorter ask?");
    } finally {
      state.busy = false;
      setComposerEnabled(true);
      setPresence("Active now · Waiting for you");
    }
  }

  function openNewPage() {
    if (state.busy) return;
    const tpl = templateById(state.selectedTemplate);
    createChat({ name: `New ${tpl.name}`, brief: "", templateId: tpl.id });
  }

  $("#navChatsBtn")?.addEventListener("click", renderSideChats);
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-delete]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const chat = state.chats.find((item) => item.id === button.dataset.delete);
    if (!chat || !confirm(`Delete “${chat.name}”?`)) return;
    state.chats = state.chats.filter((item) => item.id !== chat.id);
    if (state.activeId === chat.id) {
      state.activeId = state.chats[0]?.id || null;
      renderChat();
    }
    saveChats();
    renderChatList();
  }, true);
  $("#navNewBtn")?.addEventListener("click", openNewPage);
  $("#navSupervisorBtn")?.addEventListener("click", openSupervisorPicker);
  $("#newChatHeroBtn")?.addEventListener("click", openNewPage);
  $("#newChatShelfBtn")?.addEventListener("click", openNewPage);
  $("#allChatsShelfBtn")?.addEventListener("click", () => openPage("chats"));
  $("#newChatFromPageBtn")?.addEventListener("click", openNewPage);
  $("#startTemplateBtn")?.addEventListener("click", () => openPage("templates"));
  $("#addSupervisorBtn")?.addEventListener("click", openSupervisorPicker);
  $$("[data-back-home]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (state.busy) return;
      openPage("home");
    });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    // Keep the live chat open while working; never bubble Escape to the parent shell.
    if (state.busy) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (state.page !== "home") {
      event.preventDefault();
      event.stopPropagation();
      openPage("home");
    }
  }, true);

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
      const payload = await (await fetch("/api/installed-agents")).json();
      const self = (payload.agents || []).find((a) => a.id === AGENT_ID);
      if (self && typeof self.allowSupervisors === "boolean") {
        state.allowSupervisors = self.allowSupervisors;
      }
    } catch (_) {}
    await loadSupervisors();
    renderSideChats();
    const last = latestChat();
    if (last) openChat(last.id);
    else renderChat();
  })();
})();
