---
name: blender-design
description: Plan and build Blender scenes with generated bpy scripts, then save, render a preview and verify the .blend
---

# Blender design

## Tools
- `app_status`: is Blender installed, which version, where projects live.
- `create_project`: new project folder; returns `project_id`.
- `list_projects`: existing projects and their .blend files.
- `run_script`: run a bpy script you wrote for this request. New work starts from an empty scene; pass `open_file` to continue an existing .blend. Pass `save_as` to save.
- `scene_info`: objects, materials, cameras, lights, frame range of a saved .blend.
- `render_preview`: one PNG still (default 50% size) into the project's `previews/` folder.
- `validate_output`: confirms the .blend is real and loads. Required before you say the work is done.
- `open_in_blender`: open the result in a visible Blender window for the user.

## Workflow
1. `app_status`. Continue only if `installed` is true.
2. `create_project` (or reuse one the user names).
3. Plan stages: blockout, materials, lighting and camera, animation. Write one small bpy script per stage and `run_script` it with `open_file` set after the first stage and `save_as` set every time.
4. `scene_info` to confirm the scene matches the plan; fix with another `run_script` if not.
5. `render_preview` to check how it looks.
6. `validate_output`, then report the project id, file name and what was built.

## Rules for scripts
- Scripts run headless with no window. They may only write inside the project folder, cannot start programs and have no network.
- Write fresh bpy code for each request; do not paste a fixed scene template.
- Keep scripts short so a failure points at one stage. If `run_script` fails, read `stderr_tail`, fix that cause, and run again; do not repeat the same script.
- Never say work is saved or done unless the tool result confirms it.
