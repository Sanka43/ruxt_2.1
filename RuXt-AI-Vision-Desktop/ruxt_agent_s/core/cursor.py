import atexit
import ctypes
import logging
import os
import platform

logger = logging.getLogger(__name__)

# Win32 Constants
IMAGE_CURSOR = 2
LR_LOADFROMFILE = 0x00000010
OCR_NORMAL = 32512  # Standard arrow cursor
SPI_SETCURSORS = 0x0057  # Reload system cursors

_cursor_active = False

def set_ai_cursor(active: bool = True) -> bool:
    """
    Sets the Windows system mouse cursor to a distinct high-contrast
    Black Arrow with White Border ('arrow_r.cur') during AI desktop control,
    or restores the default system cursor when active=False.
    """
    global _cursor_active

    if platform.system() != "Windows":
        return False

    user32 = ctypes.windll.user32

    if active:
        # Candidate cursor files (Windows Black Scheme)
        candidates = [
            os.path.join(os.environ.get("WINDIR", r"C:\Windows"), "Cursors", "arrow_r.cur"),
            os.path.join(os.environ.get("WINDIR", r"C:\Windows"), "Cursors", "arrow_rm.cur"),
            os.path.join(os.environ.get("WINDIR", r"C:\Windows"), "Cursors", "arrow_rl.cur"),
        ]

        cursor_path = next((c for c in candidates if os.path.exists(c)), None)
        if not cursor_path:
            logger.warning("[RuXt Cursor] Windows Black cursor file ('arrow_r.cur') not found.")
            return False

        try:
            # Load cursor from file
            hcur = user32.LoadImageW(0, cursor_path, IMAGE_CURSOR, 0, 0, LR_LOADFROMFILE)
            if not hcur:
                logger.warning(f"[RuXt Cursor] Failed to load cursor image from {cursor_path}")
                return False

            # SetSystemCursor replaces OCR_NORMAL system-wide and takes ownership of hcur
            res = user32.SetSystemCursor(hcur, OCR_NORMAL)
            if res:
                _cursor_active = True
                logger.info("[RuXt Cursor] Switched mouse cursor to Black Arrow with White Border.")
                return True
            else:
                logger.warning("[RuXt Cursor] SetSystemCursor returned failure code.")
                return False
        except Exception as e:
            logger.warning(f"[RuXt Cursor] Exception while setting AI cursor: {e}")
            return False
    else:
        # Restore system cursors back to user's configured default scheme
        try:
            res = user32.SystemParametersInfoW(SPI_SETCURSORS, 0, 0, 0)
            if res:
                _cursor_active = False
                logger.info("[RuXt Cursor] Restored standard Windows system mouse cursor.")
                return True
            else:
                logger.warning("[RuXt Cursor] SystemParametersInfoW(SPI_SETCURSORS) returned failure.")
                return False
        except Exception as e:
            logger.warning(f"[RuXt Cursor] Exception while restoring system cursor: {e}")
            return False


def restore_cursor():
    """Safety cleanup handler to guarantee cursor is restored."""
    global _cursor_active
    if _cursor_active:
        set_ai_cursor(False)

# Register safety exit cleanup
atexit.register(restore_cursor)
