---
description: Universal rule for dynamic, cross-platform host runtime and AI tool discovery without fixed hardcoded paths.
always_on: true
---

# Rule: Dynamic Host Tool & Runtime Discovery Invariant

When discovering external tools, runtimes, and local AI engines (e.g., Google Antigravity, Anthropic Claude, Cursor, Ollama, Codex) on a user's machine:

1. **Never Assume Hardcoded Paths**:
   - Never hardcode user profiles (`C:\Users\username\...`) or assume a specific drive letter (`C:\`).
   - Use dynamic environment variables (`%LOCALAPPDATA%`, `%APPDATA%`, `%PROGRAMFILES%`, `%USERPROFILE%`).

2. **Always Follow the 5-Tier Discovery Cascade**:
   - **Tier 1 (Active OS Process Inspection)**: Query the OS process table for live running processes to get the exact executable path directly from memory.
   - **Tier 2 (System PATH)**: Check environment PATH via `where.exe` (Windows) or `which` (POSIX).
   - **Tier 3 (Platform Registry / App Paths)**: Query Windows Registry application and uninstall keys (`HKCU\Software\Microsoft\Windows\CurrentVersion\App Paths`, etc.).
   - **Tier 4 (Dynamic Standard Conventions)**: Scan known application directories across all available environment paths and drives.
   - **Tier 5 (User Custom Overrides)**: Always allow users to manually specify and persist custom binary paths in settings.

3. **Graceful Fallback & Actionable Guidance**:
   - If a runtime is not detected, inform the user clearly with instructions on how to install or configure the custom path in Settings.

4. **Host Account Discovery & Machine Boundaries**:
   - **Local Host Account Detection**: Always attempt zero-friction discovery of existing signed-in accounts on the current host machine:
     - Google Antigravity: Check `%USERPROFILE%\.openmausbot\providers\antigravity\*\acp_token.json`, `%USERPROFILE%\.gemini\antigravity`, or `engine-status.json` for active OAuth profile email.
     - Cursor: Check `%APPDATA%\Cursor\User\globalStorage\state.vscdb` for existing logged-in email and CLI presence (`cursor-agent`).
   - **Secondary Client Machine Policy**: Never expect credentials from a developer's PC to exist inside a distributed `.exe` on a clean client machine. When running on a new machine without local IDE tokens:
     - Provide a direct link to sign in with that exact same Google email via Google AI Studio (`aistudio.google.com`) for free Gemini API quota.
     - Clearly explain that the email's free quota applies immediately upon entering the key.
