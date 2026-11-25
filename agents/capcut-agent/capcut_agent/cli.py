"""CapCut AI Agent CLI and Orchestration Engine."""

import argparse
import json
import os
import sys
import time
from pathlib import Path

# Ensure package directory is in sys.path
agent_root = Path(__file__).resolve().parent.parent
if str(agent_root) not in sys.path:
    sys.path.insert(0, str(agent_root))

from capcut_agent.draft_builder import CapCutDraftBuilder, get_media_info
from capcut_agent.live_monitor import LiveMonitor
from capcut_agent.window_controller import WindowController


def create_capcut_project(
    title: str,
    videos: list,
    audio: str = None,
    subtitles: list = None,
    aspect_ratio: str = "9:16",
    auto_open: bool = True,
):
    """Orchestrates draft synthesis and opens CapCut Desktop."""
    monitor = LiveMonitor(title=title)
    monitor.start()

    # Step 1: Initialize
    monitor.log_event("Initializing CapCut Draft Synthesizer...", step_index=1, progress=0.15)
    builder = CapCutDraftBuilder(title=title, aspect_ratio=aspect_ratio)

    # Step 2: Process Videos
    monitor.log_event(f"Processing & analyzing {len(videos)} video track(s)...", step_index=2, progress=0.35)
    for v in videos:
        if isinstance(v, dict):
            builder.add_video(
                file_path=v["path"],
                start_time_sec=v.get("start", 0.0),
                duration_sec=v.get("duration", None),
            )
        else:
            builder.add_video(file_path=str(v))

    # Step 3: Process Audio
    if audio and os.path.exists(audio):
        monitor.log_event(f"Adding background audio: {os.path.basename(audio)}", step_index=3, progress=0.55)
        builder.add_audio(file_path=audio)

    # Step 4: Process Subtitles
    if subtitles:
        monitor.log_event(f"Synchronizing {len(subtitles)} subtitle caption(s)...", step_index=4, progress=0.75)
        for sub in subtitles:
            builder.add_subtitle(
                text=sub["text"],
                start_sec=sub["start"],
                duration_sec=sub["duration"],
            )

    # Step 5: Build Draft Files
    monitor.log_event("Assembling draft_content.json and registering with CapCut Root Store...", step_index=5, progress=0.90)
    draft_dir = builder.build()

    total_dur_sec = sum(c["duration"] for c in builder.video_clips) / 1_000_000
    monitor.display_timeline_summary(
        video_segments=builder.video_clips,
        audio_segments=builder.audio_clips,
        text_segments=builder.subtitles,
        total_duration_sec=total_dur_sec,
    )

    # Step 6: Launch CapCut
    if auto_open:
        monitor.log_event("Launching CapCut Desktop App...", step_index=6, progress=0.98)
        try:
            WindowController.launch_capcut()
            WindowController.find_and_focus_capcut(timeout_sec=8)
        except Exception as e:
            print(f"⚠️ Notice on launch: {e}")

    monitor.complete(project_path=str(draft_dir))
    return str(draft_dir)


def main():
    parser = argparse.ArgumentParser(description="CapCut AI Agent - Automated Project Synthesizer")
    parser.add_argument("--payload", type=str, default=None, help="JSON string or path to JSON file containing project configuration")
    parser.add_argument("--title", type=str, default="AI Video Project", help="Title for the CapCut project")
    parser.add_argument("--videos", type=str, default=None, help="Comma-separated paths to video files")
    parser.add_argument("--audio", type=str, default=None, help="Path to audio file (optional)")
    parser.add_argument("--subtitles", type=str, default=None, help="Optional text file or comma-separated captions")
    parser.add_argument("--ratio", type=str, default="9:16", choices=["9:16", "16:9", "1:1", "4:5"], help="Aspect ratio")
    parser.add_argument("--no-open", action="store_true", help="Do not launch CapCut Desktop automatically")

    args = parser.parse_args()

    # Priority 1: JSON Payload mode
    if args.payload:
        data = None
        if os.path.exists(args.payload):
            with open(args.payload, "r", encoding="utf-8") as f:
                data = json.load(f)
        else:
            data = json.loads(args.payload)

        title = data.get("title", args.title)
        ratio = data.get("ratio", data.get("aspect_ratio", args.ratio))
        videos = data.get("videos", [])
        audio = data.get("audio", None)
        subtitles = data.get("subtitles", [])
        auto_open = data.get("auto_open", not args.no_open)

        create_capcut_project(
            title=title,
            videos=videos,
            audio=audio,
            subtitles=subtitles,
            aspect_ratio=ratio,
            auto_open=auto_open,
        )
        return

    if not args.videos:
        parser.error("--videos or --payload is required")

    video_list = [v.strip() for v in args.videos.split(",") if v.strip()]

    # Parse simple subtitles if provided
    sub_list = []
    if args.subtitles:
        if os.path.exists(args.subtitles):
            with open(args.subtitles, "r", encoding="utf-8") as f:
                lines = [line.strip() for line in f if line.strip()]
                for idx, line in enumerate(lines):
                    sub_list.append({"text": line, "start": idx * 2.5, "duration": 2.2})
        else:
            for idx, text in enumerate(args.subtitles.split(",")):
                sub_list.append({"text": text.strip(), "start": idx * 2.5, "duration": 2.2})

    create_capcut_project(
        title=args.title,
        videos=video_list,
        audio=args.audio,
        subtitles=sub_list,
        aspect_ratio=args.ratio,
        auto_open=not args.no_open,
    )


if __name__ == "__main__":
    main()
