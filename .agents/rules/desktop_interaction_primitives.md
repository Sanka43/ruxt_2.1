---
description: Invariant standards and guidelines for all desktop mouse interactions (click, double-click, right-click, click-and-drag, scroll, and drawing).
always_on: true
---

# Rule: Standard Desktop Mouse & Pointer Primitives

When planning and executing GUI desktop interactions:

1. **Standard Mouse Actions**:
   - **Click**: Target elements via `box_id` or `(x, y)` coordinates using `agent.click()`.
   - **Double Click**: Open files, folders, or select text segments via `agent.double_click()` (alias: `dblclick`).
   - **Right Click (Context Menu)**: Access contextual options via `agent.right_click()` (aliases: `write_click`, `context_click`).
   - **Click and Drag (`drag_and_drop`)**: Move sliders, drag files, select bounding areas, or draw lines via `agent.drag_and_drop()` (alias: `click_and_drag`).
   - **Scroll**: Navigate document or web pages via `agent.scroll(amount, x, y)`.
   - **Continuous Canvas Drawing**:
     - Use `agent.draw_shape(shape="circle", x=..., y=..., width=..., height=..., mode="freehand")` for pencil/brush strokes.
     - Use `agent.draw_shape(shape="circle", x=..., y=..., width=..., height=..., mode="drag_box")` when Paint's built-in Shape Tool (Oval/Rectangle) is active.
     - Use `agent.draw_stroke(points=[...])` for custom multi-point curves and sketches.

2. **Single Direct Cursor Invariant**:
   - Always operate using the direct single system cursor mode. Never generate duplicate floating overlays unless specifically instructed.

3. **Window & Input Focus Safety**:
   - Always verify and focus the target application window or canvas before initiating drag, drawing, or typing actions.
