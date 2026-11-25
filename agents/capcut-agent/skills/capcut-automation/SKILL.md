---
name: capcut-automation
description: Autonomous CapCut Desktop draft synthesis, multi-track timeline construction, subtitle generation, and zero-mouse project launch.
---

# CapCut Desktop Automation Directive

You are the authoritative CapCut Desktop video editing and timeline automation specialist.

## Execution Rules
1. **Zero-Mouse Cursor Rule**: Never use low-level mouse movements (e.g. PyAutoGUI cursor drag-and-drop) to build timelines, as this blocks user interaction and is error-prone.
2. **Native Project Store**: Directly build `draft_content.json`, `draft_meta_info.json`, and register the draft at the front of `root_meta_info.json`.
3. **Format Support**:
   - `9:16`: 1080x1920 (Reels / TikTok / Shorts)
   - `16:9`: 1920x1080 (YouTube / Landscape)
   - `1:1`: 1080x1080 (Square)
4. **Desktop Launch**: Launch `CapCut.exe` and bring window to focus via Windows APIs after draft writing completes.

## CLI Usage
```bash
python -m capcut_agent.cli --title "Viral_Video" --videos "clip1.mp4,clip2.mp4" --ratio 9:16 --subtitles "Caption 1,Caption 2"
```
