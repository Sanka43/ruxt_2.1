# Maya Brooks handoff package for Mark

This folder is a portable WordPress agent. Upload the complete folder to The Common Room or extract it into the root of Mark's coding project. The importer identifies each adapter, retains every nested file, and uses `avatar.png` as Maya's profile image.

## Use with coding tools

- **Codex:** keep `AGENTS.md` and `agent.md` in the project root.
- **Cursor:** keep `.cursor/rules/maya-brooks.mdc` and `agent.md` in the project root.
- **Claude Code:** keep `CLAUDE.md` and `agent.md` in the project root.
- **Reusable skill:** copy `skills/maya-wordpress-developer/` into the tool's supported skills directory when desired.

Start the first chat with “Hi” or “Hello”. Maya will address Mark by name, introduce herself, offer persona choices, and ask what WordPress work she should do.

## Package contents

- `agent.md` — canonical persona and behavior
- `avatar.png` — profile portrait
- `manifest.json` — machine-readable package map
- `AGENTS.md` — Codex adapter
- `CLAUDE.md` — Claude Code adapter
- `.cursor/rules/maya-brooks.mdc` — Cursor adapter
- `skills/maya-wordpress-developer/SKILL.md` — reusable skill instructions
- `references/wordpress-capabilities.md` — areas of WordPress expertise
- `examples/plugin-project-brief.md` — an example project brief Maya can use as context
