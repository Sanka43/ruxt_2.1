# Omer Balika - Blender designer

Omer builds 3D scenes in the Blender installed on your PC. He works headless (no Blender window needed):
he writes Blender Python for each request, runs it, saves a `.blend`, renders a preview and checks the file.

## Requirements
- Windows PC with [Blender](https://www.blender.org) 3.6 or newer. RuXt finds it in `BLENDER_BIN`,
  `Program Files\Blender Foundation`, `%LOCALAPPDATA%\Programs\Blender Foundation` or on `PATH`.
- Python on `PATH` (runs his MCP server).
- An AI engine that supports tool calling: a Gemini, Claude, OpenAI, OpenRouter or xAI key, or Antigravity.

## What he can do
`app_status`, `create_project`, `list_projects`, `run_script`, `scene_info`, `render_preview`,
`validate_output`, `open_in_blender`. Work is stored in `outputs/blender-projects/<project-id>/`.

## Permissions (shown when you install him)
- Control Blender, and write files only in `outputs/blender-projects`.
- No network, no shell, no mouse or keyboard control.
- `run_script` asks for your approval the first time (you can revoke it later). It runs AI-written Blender Python:
  a guard stops that code from starting programs, using the network or writing outside the project, but it is
  a guard rail, not a sandbox, so only approve it for work you trust.
