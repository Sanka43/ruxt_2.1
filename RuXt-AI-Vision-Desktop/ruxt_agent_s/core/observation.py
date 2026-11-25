import base64
import ctypes
import io
import os
import platform
from dataclasses import dataclass
from typing import Optional, Tuple
import mss
from PIL import Image

_dpi_bound = False

def bind_thread_to_input_desktop():
    """Binds the current thread to the default Windows input desktop (WinStation)."""
    global _dpi_bound
    if _dpi_bound:
        return
    if platform.system() == "Windows":
        try:
            # Set DPI awareness so coordinates match real screen pixels on Windows
            ctypes.windll.shcore.SetProcessDpiAwareness(2)
        except Exception:
            try:
                ctypes.windll.user32.SetProcessDPIAware()
            except Exception:
                pass

        try:
            user32 = ctypes.windll.user32
            # DESKTOP_ALL_ACCESS = 0x01FF
            hdesk = user32.OpenDesktopW("default", 0, False, 0x01FF)
            if hdesk:
                user32.SetThreadDesktop(hdesk)
                user32.CloseDesktop(hdesk)
        except Exception:
            pass
        _dpi_bound = True

@dataclass
class ScreenState:
    image: Image.Image
    image_base64: str
    width: int
    height: int
    active_window_title: str

class ScreenObserver:
    def __init__(self, max_width: int = 1024, max_height: int = 768):
        bind_thread_to_input_desktop()
        self.max_width = max_width
        self.max_height = max_height
        self._sct = mss.MSS()

    def get_screen_resolution(self) -> Tuple[int, int]:
        bind_thread_to_input_desktop()
        monitor = self._sct.monitors[1]  # Primary monitor
        return monitor["width"], monitor["height"]

    def get_foreground_hwnd(self) -> int:
        if platform.system() == "Windows":
            try:
                import win32gui
                return int(win32gui.GetForegroundWindow() or 0)
            except Exception:
                pass
        return 0

    def get_visible_windows(self) -> list:
        """Returns list of currently open top-level application windows with active status."""
        if platform.system() != "Windows":
            return []
        bind_thread_to_input_desktop()
        active_hwnd = self.get_foreground_hwnd()
        windows = []

        ignore_titles = {
            "program manager", "settings", "windows input experience",
            "nvidia geforce overlay", "ruxt desktop overlay", ""
        }

        try:
            import win32gui
            def enum_cb(hwnd, _):
                if win32gui.IsWindowVisible(hwnd):
                    title = win32gui.GetWindowText(hwnd).strip()
                    if title and title.lower() not in ignore_titles:
                        rect = win32gui.GetWindowRect(hwnd)
                        w = rect[2] - rect[0]
                        h = rect[3] - rect[1]
                        if w > 120 and h > 100:
                            windows.append({
                                "title": title,
                                "hwnd": hwnd,
                                "is_active": (hwnd == active_hwnd),
                                "width": w,
                                "height": h
                            })
                return True

            win32gui.EnumWindows(enum_cb, None)
        except Exception:
            pass
        return windows

    def get_active_window_title(self) -> str:
        if platform.system() == "Windows":
            try:
                import win32gui
                hwnd = win32gui.GetForegroundWindow()
                if hwnd:
                    return win32gui.GetWindowText(hwnd).strip()
            except Exception:
                pass
        return "Unknown"

    def capture(self, resize_for_model: bool = True) -> ScreenState:
        """Captures full desktop screenshot and returns structured ScreenState."""
        bind_thread_to_input_desktop()
        monitor = self._sct.monitors[1]
        try:
            sct_img = self._sct.grab(monitor)
            img = Image.frombytes("RGB", sct_img.size, sct_img.bgra, "raw", "BGRX")
            real_w, real_h = img.size
        except Exception as e:
            # Fallback if Windows display session is locked, sleeping, or BitBlt busy
            real_w = monitor.get("width", 1920)
            real_h = monitor.get("height", 1080)
            img = Image.new("RGB", (real_w, real_h), color=(30, 30, 30))

        # Optimize size for Vision LLMs with fast Bilinear downsampling
        model_img = img
        if resize_for_model and (real_w > self.max_width or real_h > self.max_height):
            model_img = img.copy()
            model_img.thumbnail((self.max_width, self.max_height), Image.Resampling.BILINEAR)

        # Convert to base64 JPEG with optimized compression for fast IPC transfer
        buffered = io.BytesIO()
        model_img.save(buffered, format="JPEG", quality=55, optimize=False)
        img_b64 = base64.b64encode(buffered.getvalue()).decode("utf-8")

        return ScreenState(
            image=img,
            image_base64=img_b64,
            width=real_w,
            height=real_h,
            active_window_title=self.get_active_window_title()
        )
