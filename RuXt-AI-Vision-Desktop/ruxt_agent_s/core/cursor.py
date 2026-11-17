"""
RuXt Desktop Cursor Manager - Futuristic Neon Blue Pointer Transformation
Transforms the Windows system mouse pointer into the glowing Neon Blue Arrow
during autonomous desktop control, and restores the standard cursor scheme when finished.
"""

import atexit
import ctypes
from ctypes import wintypes
import logging
import os
from pathlib import Path
import platform
from typing import Optional

logger = logging.getLogger("ruxt_agent_s.cursor")

# Win32 Cursor Constants
IMAGE_CURSOR = 2
LR_LOADFROMFILE = 0x0010
OCR_NORMAL = 32512
OCR_IBEAM = 32513
OCR_HAND = 32649
OCR_APPSTARTING = 32650
SPI_SETCURSORS = 0x0057

AI_CURSOR_IDS = [OCR_NORMAL, OCR_HAND, OCR_APPSTARTING]

_is_neon_cursor_active = False

def _resolve_neon_cursor_path() -> Optional[Path]:
    """Discovers the ruxt_neon.cur asset file path across dev and packaged locations."""
    current_dir = Path(__file__).resolve().parent
    candidates = [
        current_dir.parent / "assets" / "ruxt_neon.cur",
        current_dir.parents[1] / "assets" / "ruxt_neon.cur",
        current_dir.parents[2] / "public" / "assets" / "ruxt_neon.cur",
        current_dir.parents[2] / "server" / "assets" / "ruxt_neon.cur",
        current_dir.parents[2] / "server" / "services" / "assets" / "ruxt_neon.cur",
        Path("RuXt-AI-Vision-Desktop/ruxt_agent_s/assets/ruxt_neon.cur").resolve(),
        Path("server/assets/ruxt_neon.cur").resolve(),
        Path("server/services/assets/ruxt_neon.cur").resolve(),
        Path("public/assets/ruxt_neon.cur").resolve(),
        Path(os.environ.get("LOCALAPPDATA", "")) / "Programs" / "RuXt AI Studio" / "resources" / "app.asar.unpacked" / "RuXt-AI-Vision-Desktop" / "ruxt_agent_s" / "assets" / "ruxt_neon.cur",
        Path(os.environ.get("LOCALAPPDATA", "")) / "Programs" / "RuXt AI Studio" / "resources" / "app.asar.unpacked" / "server" / "assets" / "ruxt_neon.cur"
    ]
    for c in candidates:
        if c.exists():
            return c
    return None

def set_ai_cursor(active: bool = True) -> bool:
    """
    Switches the Windows system mouse cursor to the glowing Neon Blue AI Arrow
    when active=True, and restores the user's standard Windows cursor scheme when active=False.
    """
    global _is_neon_cursor_active

    if platform.system() != "Windows":
        return True

    user32 = ctypes.windll.user32

    if active:
        if _is_neon_cursor_active:
            return True

        cur_path = _resolve_neon_cursor_path()
        if not cur_path:
            logger.warning("Neon blue cursor asset (ruxt_neon.cur) not found.")
            return False

        try:
            success_count = 0
            for cid in AI_CURSOR_IDS:
                hcur = user32.LoadImageW(None, str(cur_path), IMAGE_CURSOR, 36, 36, LR_LOADFROMFILE)
                if not hcur:
                    hcur = user32.LoadImageW(None, str(cur_path), IMAGE_CURSOR, 0, 0, LR_LOADFROMFILE)
                if hcur:
                    # Copy icon handle because SetSystemCursor destroys the passed handle
                    hcur_copy = user32.CopyIcon(hcur)
                    res = user32.SetSystemCursor(hcur_copy, cid)
                    user32.DestroyCursor(hcur)
                    if res != 0:
                        success_count += 1

            if success_count > 0:
                _is_neon_cursor_active = True
                logger.info("Transformed system mouse cursor to Neon Blue AI pointer.")
                return True
            else:
                logger.warning("SetSystemCursor returned 0 for all IDs.")
                return False
        except Exception as e:
            logger.error(f"Error activating Neon Blue cursor: {e}")
            return False
    else:
        return restore_cursor()

def restore_cursor() -> bool:
    """
    Restores the standard Windows mouse cursor scheme.
    Guaranteed to run on normal finish, abort, or application exit.
    """
    global _is_neon_cursor_active

    if platform.system() != "Windows":
        return True

    user32 = ctypes.windll.user32
    try:
        res = user32.SystemParametersInfoW(SPI_SETCURSORS, 0, None, 0)
        _is_neon_cursor_active = False
        logger.info("Restored standard system cursor scheme.")
        return res != 0
    except Exception as e:
        logger.error(f"Error restoring system cursor: {e}")
        return False

# Register atexit handler so the cursor is ALWAYS restored if process exits or terminates
atexit.register(restore_cursor)
