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
