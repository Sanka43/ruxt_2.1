---
description: Universal rule ensuring host IDE bridges (Antigravity, Cursor, etc.) execute silently in the background without polluting user editor UI.
always_on: true
---

# Rule: Host Bridge Stealth & Silent Background Execution

When integrating with local host IDE runtimes (e.g., Google Antigravity, Cursor, Claude Code) as cognitive backend providers:

1. **Zero Editor UI Clutter**:
   - External companion applications and agent dispatchers must NEVER cause new conversation tabs, panels, or notification popups to appear in the user's active foreground IDE.

2. **Isolated Execution Namespace & Working Directory**:
   - When invoking `agentapi` or any Antigravity host binary via CLI/SDK, **NEVER** inherit the active project's working directory (`process.cwd()`).
   - Always execute Antigravity host sub-processes within an isolated working directory (e.g., `~/.ruxt/workspace` or `data/bridge_workspace`).
   - Setting `cwd` outside the open repository root ensures that conversations appear under Antigravity's independent **Conversations** section and never pollute the active workspace's project chat panel.
   - Direct all host bridge conversations to an isolated application data directory or headless subclient mode so the host editor does not render them in the active project conversation tree.

3. **Background Session Reuse**:
   - Never spawn a new workspace conversation for every single prompt turn. Reuse a single durable background channel or pipe to avoid tab sprawl.

4. **Ephemeral Brain Pruning**:
   - Automatically purge or detach temporary conversation artifacts generated solely for single-turn model responses.

5. **Clean Fallback Order**:
   - If a host runtime cannot be operated headlessly or silently, automatically route to local offline Ollama or direct API execution to preserve the user's editor cleanliness.
