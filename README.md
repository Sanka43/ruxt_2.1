# RuXt AI Studio 2.1 🚀

Autonomous Local AI Agent Desktop Studio & Framework.

## Features
- **Zero-Configuration:** Standalone Windows desktop app requiring no Node.js, terminal, or environment setups from end-clients.
- **Embedded Engine:** Background Node.js agent runner auto-managed on port `1234`.
- **Local Persistence:** Embedded SQLite 3 database in WAL mode.
- **Agents Studio:** Built-in support for agent packages, manifests, custom HTML interfaces, and chat.
- **Task Runner:** Integrated goal-tracking and task board for agents.
- **Multi-Provider AI Bridge:** Supports Google Gemini API, OpenAI API, and local mock fallback.

## Quick Start
```bash
# Install dependencies
npm install

# Start local dev server & UI
npm run electron:dev

# Or run server only
npm run server
```

## Build Executable for Distribution
```bash
npm run dist
```
Outputs standalone installers in the `release/` directory. See [DELIVERY_GUIDE.md](./DELIVERY_GUIDE.md) for complete details.

## Desktop automation: safety and platform support
- **Windows only.** The vision/desktop operator relies on Windows APIs. On macOS/Linux those endpoints answer `501` with a clear message (`/api/status` reports `desktopAutomation: false`); everything else works everywhere.
- **Safety gate.** Before the AI performs a risky action (deleting, paying, shell commands, `Alt+F4`, `Shift+Delete`, launching `cmd`/`powershell`...), the run pauses and the HUD shows **Approve / Deny**. A 120 s timeout counts as a denial. Destructive commands (e.g. `format c:`, `rm -rf /`) are always blocked. Set `RUXT_SAFETY_MODE=off` to skip the prompts (blocks still apply).
- **Loop guard.** If the AI repeats the exact same action with the same result, it is warned after 4 repeats and the task stops after 8.
- **Stop at any time** with `Esc` or the HUD **Stop** button.

## Tests
```bash
npm test                 # server unit tests (plain Node)
npm run test:electron    # same, plus SQLite-backed tests (Electron's Node ABI)
cd RuXt-AI-Vision-Desktop && python -m pytest tests/test_safety.py tests/test_loop_guard.py tests/test_safety_gate.py tests/test_agent.py
```
Live desktop tests (`test_live_execution.py` and friends) control your real mouse and keyboard; run them deliberately.

## Agents, memory and packages
- **What an agent may do** is shown from its manifest (`permissions`: `network`, `filesystem` = `none|agent|user`, `desktopControl`, `shell`) plus any MCP servers it starts: `GET /api/marketplace/permissions/<slug>`, and in the install/import responses (`access`). Imports also return the package `sha256`; downloads carry an `X-Content-SHA256` header so a package can be compared with what its author published.
- **MCP servers** may only be launched with `python`, `python3`, `py` or `node`, and their script must live inside the agent folder. A server that crashes is restarted on the next call (max 3 times).
- **Agent memory:** `GET /api/agents/<slug>/memory`, `.../memory/export` (download), `DELETE .../memory?scope=all|memories|experiences|preferences`, `DELETE .../memory/<id>`.
- **Boardroom export:** `GET /api/boardroom/export/<id>` returns the session as Markdown.
- **Per-step timings** (`observe`, `prepare`, `llm`, `act` in ms) are logged by the vision agent and included in each step event.

## First-run setup guide
New installs (no API key saved, no conversation yet) get a 3-step guide: welcome, connect an AI (Gemini, OpenAI, Claude, Ollama or Antigravity, with an honest connection test that does not count a silent fallback to another AI as success) and how approvals work. Existing users are never interrupted. Re-open it any time from Settings, Storage, "Run Setup Guide Again". The same card offers the support bundle download.
