"""CapCut Agent Configuration & Path Detection for Windows."""

import os
from pathlib import Path

# Base Paths
LOCAL_APPDATA = os.environ.get("LOCALAPPDATA", r"C:\Users\isank\AppData\Local")
CAPCUT_ROOT = Path(LOCAL_APPDATA) / "CapCut"
CAPCUT_APPS = CAPCUT_ROOT / "Apps"
CAPCUT_USER_DATA = CAPCUT_ROOT / "User Data"
CAPCUT_PROJECTS_ROOT = CAPCUT_USER_DATA / "Projects"
CAPCUT_DRAFT_ROOT = CAPCUT_PROJECTS_ROOT / "com.lveditor.draft"
ROOT_META_INFO_PATH = CAPCUT_DRAFT_ROOT / "root_meta_info.json"

# Auto-detect latest CapCut.exe
def get_capcut_executable() -> str:
    # 1. Main Apps shortcut
    main_exe = CAPCUT_APPS / "CapCut.exe"
    if main_exe.exists():
        return str(main_exe)
    
    # 2. Versioned folder search
    if CAPCUT_APPS.exists():
        version_dirs = [d for d in CAPCUT_APPS.iterdir() if d.is_dir()]
        version_dirs.sort(reverse=True)
        for vdir in version_dirs:
            exe = vdir / "CapCut.exe"
            if exe.exists():
                return str(exe)
    return str(main_exe)

# Default Canvas Presets (Microseconds duration: 1 sec = 1,000,000 microseconds)
CANVAS_PRESETS = {
    "9:16": {"width": 1080, "height": 1920, "ratio": "9:16"},   # TikTok, Reels, Shorts
    "16:9": {"width": 1920, "height": 1080, "ratio": "16:9"},   # YouTube, Landscape
    "1:1": {"width": 1080, "height": 1080, "ratio": "1:1"},     # Square
    "4:5": {"width": 1080, "height": 1350, "ratio": "4:5"},     # Instagram Portrait
}

MICROSECOND = 1_000_000
DEFAULT_FPS = 30.0
