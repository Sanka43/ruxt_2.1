---
description: Universal standards for handling multi-monitor desktop vision automation, active display targeting, and coordinate offset normalization.
always_on: true
---

# Rule: Multi-Monitor Desktop Vision Automation Standards

When implementing or executing vision-based desktop automation on systems with multiple displays:

1. **Multi-Monitor Awareness**:
   - Always check `mss.monitors` or Windows API to detect if multiple monitors are connected.
   - Do not assume a single fixed resolution (e.g., 1920x1080). Systems may have extended virtual desktops (e.g., 3840x1080).

2. **Active Display & Target Window Alignment**:
   - Before taking an observation screenshot for a target application, inspect the foreground window's bounding rect (`win32gui.GetWindowRect`).
   - Determine which monitor (`left`, `top`, `width`, `height`) currently hosts the target application.
   - Capture the specific monitor hosting the active window, OR automatically move and snap/maximize the target window onto the Primary Monitor (`(0, 0)`) upon launch/focus to ensure consistent vision coordinates.

3. **Coordinate Offset Normalization**:
   - When converting normalized coordinates (0-1000) to physical pixels, always add the active monitor's `left` and `top` offsets:
     `px = monitor['left'] + int((norm_x / 1000) * monitor['width'])`
     `py = monitor['top'] + int((norm_y / 1000) * monitor['height'])`
   - Clamping must respect the monitor's coordinate bounds, avoiding accidental clicks on unintended displays.

4. **User Guidance for Multi-Screen Workflows**:
   - When troubleshooting vision execution halts, always inspect display configuration (extended vs duplicated display, primary display selection, and display scaling factors).
