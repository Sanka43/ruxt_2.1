"""Live Progress Visualizer & Monitor for CapCut Agent."""

import sys
import time

class LiveMonitor:
    """Provides non-intrusive terminal HUD and live event feedback."""

    def __init__(self, title: str = "CapCut AI Project"):
        self.title = title
        self.steps = [
            ("Initializing Agent & Workspace", 0.1),
            ("Analyzing Media & Metadata", 0.3),
            ("Generating Timeline Tracks (Video/Audio)", 0.6),
            ("Synthesizing Captions & Subtitles", 0.8),
            ("Writing Project Draft & Registry", 0.95),
            ("Launching CapCut Desktop App", 1.0),
        ]
        self.current_step = 0

    def start(self):
        print("\n" + "=" * 65)
        print(f"🎬  CAPCUT AI AGENT: {self.title.upper()}")
        print("    [Zero-Mouse Live Synthesis Engine]")
        print("=" * 65)

    def log_event(self, message: str, step_index: int = None, progress: float = None):
        if step_index is not None:
            self.current_step = step_index
        
        # Render a progress bar
        p = progress if progress is not None else (self.current_step / max(1, len(self.steps) - 1))
        bar_len = 25
        filled = int(bar_len * p)
        bar = "█" * filled + "░" * (bar_len - filled)
        percent = int(p * 100)
        
        print(f"[{bar}] {percent:>3}% | ⚡ {message}")
        sys.stdout.flush()

    def display_timeline_summary(self, video_segments: list, audio_segments: list, text_segments: list, total_duration_sec: float):
        print("\n📊 Generated Timeline Architecture:")
        print(f"   ⏱️  Total Duration : {total_duration_sec:.2f}s")
        print(f"   🎥 Video Segments : {len(video_segments)}")
        print(f"   🎵 Audio Tracks   : {len(audio_segments)}")
        print(f"   📝 Subtitle Lines : {len(text_segments)}")
        print("-" * 65)

    def complete(self, project_path: str):
        print("\n" + "=" * 65)
        print("✨ CAPCUT PROJECT READY!")
        print(f"📁 Draft Location: {project_path}")
        print("🚀 Opening CapCut Desktop now...")
        print("=" * 65 + "\n")
        sys.stdout.flush()
