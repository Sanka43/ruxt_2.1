---
description: Standards for developing and building Electron applications with embedded Express backend engines and native modules.
globs: ["electron/**/*", "server/**/*", "package.json"]
---

# Electron Fullstack & Packaging Standards

## 1. Native C++ Modules (e.g. better-sqlite3)
- Always run `@electron/rebuild -f -w <module>` before packaging or when running Electron in development.
- Ensure the native module matches Electron's ABI (`NODE_MODULE_VERSION`), not the host Node.js version.

## 2. Path Resolution in Packaged Apps (app.asar)
- Never use `process.cwd()` to find bundled resources (frontend `dist/`, `public/`, or `agents/`). In installed apps, `process.cwd()` points to the installation folder or user directory, not inside `app.asar`.
- Always resolve paths relative to `__dirname` (e.g. `path.resolve(__dirname, '..')`).

## 3. Background Engine Startup & Resiliency
- In development mode (`NODE_ENV=development`), avoid duplicate server spawns if a dev tool (like `concurrently`) already runs the server.
- In `createWindow()`, implement retry polling (`did-fail-load` or retry loops) when connecting to the internal localhost port so network races do not display a blank screen.

## 4. End-User Runtime Isolation & Cognitive Engine Fallback
- Packaged executables (`.exe`, `.dmg`, `.AppImage`) will be deployed onto clean client operating systems lacking developer tools, IDEs, or CLI environments.
- **Never hardcode developer host bridges** (e.g. Antigravity Local Engine Bridge, Cursor Bridge) as the mandatory or non-verifiable default on fresh installs.
- **Dynamic Preflight Check**:
  - On first boot or database seeding on a target machine, check whether local host binaries actually exist via `findAntigravityBinary()` or `acpService.isAvailable()`.
  - If the host runtime is missing, automatically set `active_provider` to `gemini` (Cloud API) or present an onboarding setup view prompting the user for an API key (Google Gemini, OpenAI, Claude) or local Ollama endpoint.
- **Honest Connection States**:
  - UI status indicators must accurately reflect `installed: false` and `unreachable` rather than showing phantom `Connected & Ready` when binaries are missing.
