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
