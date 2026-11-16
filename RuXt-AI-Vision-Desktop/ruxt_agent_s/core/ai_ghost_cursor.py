import atexit
import ctypes
from ctypes import wintypes
import logging
import math
import os
import threading
import time
from typing import Optional, Tuple

logger = logging.getLogger(__name__)

# Win32 Constants
WS_EX_TOPMOST = 0x00000008
WS_EX_TRANSPARENT = 0x00000020
WS_EX_LAYERED = 0x00080000
WS_EX_TOOLWINDOW = 0x00000080
WS_EX_NOACTIVATE = 0x08000000
WS_POPUP = 0x80000000

SWP_NOSIZE = 0x0001
SWP_NOACTIVATE = 0x0010
SWP_SHOWWINDOW = 0x0040
HWND_TOPMOST = -1

ULW_ALPHA = 0x00000002
AC_SRC_OVER = 0x00
AC_SRC_ALPHA = 0x01

# GDI / Drawing structures
class POINT(ctypes.Structure):
    _fields_ = [("x", wintypes.LONG), ("y", wintypes.LONG)]

class SIZE(ctypes.Structure):
    _fields_ = [("cx", wintypes.LONG), ("cy", wintypes.LONG)]

class BLENDFUNCTION(ctypes.Structure):
    _fields_ = [
        ("BlendOp", ctypes.c_byte),
        ("BlendFlags", ctypes.c_byte),
        ("SourceConstantAlpha", ctypes.c_byte),
        ("AlphaFormat", ctypes.c_byte)
    ]


class AIGhostCursorOverlay:
    """
    Transparent, click-through, topmost floating AI Ghost Cursor overlay.
    Operates on its own dedicated thread to smoothly animate RuXt's cursor
    independently of the user's physical mouse cursor.
    """
    def __init__(self, size: int = 40):
        self.size = size
        self.hwnd = None
        self.current_x = 100
        self.current_y = 100
        self.target_x = 100
        self.target_y = 100
        self.is_running = False
        self.is_visible = False
        self._thread = None
        self._lock = threading.Lock()
        self._action_label = ""
        self._clicking_effect = 0

    def start(self):
        if self.is_running:
            return
        self.is_running = True
        self._thread = threading.Thread(target=self._run_window_loop, daemon=True)
        self._thread.start()
        # Wait until window initialized
        for _ in range(50):
            if self.hwnd:
                break
            time.sleep(0.02)

    def stop(self):
        self.is_running = False
        if self.hwnd:
            try:
                ctypes.windll.user32.PostMessageW(self.hwnd, 0x0010, 0, 0)  # WM_CLOSE
            except Exception:
                pass
        self.hwnd = None

    def move_to(self, x: int, y: int, duration: float = 0.2, label: str = ""):
        """Smoothly glides the AI Ghost Cursor to (x, y) over duration seconds."""
        if not self.hwnd:
            self.start()

        self._action_label = label
        start_x = self.current_x
        start_y = self.current_y
        dist = math.hypot(x - start_x, y - start_y)
        if dist < 2 or duration <= 0:
            self.set_position(x, y)
            return

        steps = max(5, int(duration * 60))
        for step in range(1, steps + 1):
            t = step / steps
            # Smooth ease-out cubic
            ease = 1.0 - math.pow(1.0 - t, 3)
            cx = int(start_x + (x - start_x) * ease)
            cy = int(start_y + (y - start_y) * ease)
            self.set_position(cx, cy)
            time.sleep(duration / steps)

    def trigger_click_effect(self):
        """Shows a brief click ring animation around the cursor."""
        self._clicking_effect = 4

    def set_position(self, x: int, y: int):
        with self._lock:
            self.current_x = x
            self.current_y = y
        if self.hwnd:
            ctypes.windll.user32.SetWindowPos(
                self.hwnd,
                HWND_TOPMOST,
                int(x),
                int(y),
                0,
                0,
                SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW
            )

    def show(self, visible: bool = True):
        self.is_visible = visible
        if self.hwnd:
            ctypes.windll.user32.ShowWindow(self.hwnd, 5 if visible else 0)

    def _run_window_loop(self):
        user32 = ctypes.windll.user32
        gdi32 = ctypes.windll.gdi32
        kernel32 = ctypes.windll.kernel32

        # Window Procedure callback
        LRESULT = ctypes.c_int64 if ctypes.sizeof(ctypes.c_void_p) == 8 else ctypes.c_long
        WPARAM = wintypes.WPARAM
        LPARAM = wintypes.LPARAM
        WNDPROC = ctypes.WINFUNCTYPE(LRESULT, wintypes.HWND, wintypes.UINT, WPARAM, LPARAM)

        user32.DefWindowProcW.argtypes = [wintypes.HWND, wintypes.UINT, WPARAM, LPARAM]
        user32.DefWindowProcW.restype = LRESULT

        def wnd_proc(hwnd, msg, wparam, lparam):
            try:
                if msg == 0x0010:  # WM_CLOSE
                    user32.DestroyWindow(hwnd)
                    return 0
                elif msg == 0x0002:  # WM_DESTROY
                    user32.PostQuitMessage(0)
                    return 0
                return user32.DefWindowProcW(hwnd, msg, wparam, lparam)
            except Exception:
                return 0

        wnd_proc_ptr = WNDPROC(wnd_proc)

        class WNDCLASSW(ctypes.Structure):
            _fields_ = [
                ("style", wintypes.UINT),
                ("lpfnWndProc", WNDPROC),
                ("cbClsExtra", ctypes.c_int),
                ("cbWndExtra", ctypes.c_int),
                ("hInstance", wintypes.HINSTANCE),
                ("hIcon", wintypes.HICON),
                ("hCursor", wintypes.HCURSOR),
                ("hbrBackground", wintypes.HBRUSH),
                ("lpszMenuName", wintypes.LPCWSTR),
                ("lpszClassName", wintypes.LPCWSTR),
            ]

        self._wnd_proc_ptr = wnd_proc_ptr

        class_name = f"RuXtGhostCursor_{os.getpid()}"
        self._wc = WNDCLASSW()
        self._wc.style = 0
        self._wc.lpfnWndProc = self._wnd_proc_ptr
        self._wc.cbClsExtra = 0
        self._wc.cbWndExtra = 0
        self._wc.hInstance = kernel32.GetModuleHandleW(None)
        self._wc.hIcon = 0
        self._wc.hCursor = 0
        self._wc.hbrBackground = 0
        self._wc.lpszMenuName = None
        self._wc.lpszClassName = class_name

        user32.RegisterClassW.argtypes = [ctypes.POINTER(WNDCLASSW)]
        user32.RegisterClassW.restype = wintypes.ATOM
        user32.RegisterClassW(ctypes.byref(self._wc))

        user32.CreateWindowExW.argtypes = [
            wintypes.DWORD, wintypes.LPCWSTR, wintypes.LPCWSTR, wintypes.DWORD,
            ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int,
            wintypes.HWND, wintypes.HMENU, wintypes.HINSTANCE, wintypes.LPVOID
        ]
        user32.CreateWindowExW.restype = wintypes.HWND

        ex_style = WS_EX_TOPMOST | WS_EX_TRANSPARENT | WS_EX_LAYERED | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE
        self.hwnd = user32.CreateWindowExW(
            ex_style,
            class_name,
            "RuXt AI Ghost Cursor",
            WS_POPUP,
            self.current_x,
            self.current_y,
            self.size + 40,
            self.size + 20,
            None,
            None,
            self._wc.hInstance,
            None
        )

        if not self.hwnd:
            logger.error("[AIGhostCursor] Failed to create overlay window.")
            return

        self._render_ghost_cursor()
        user32.ShowWindow(self.hwnd, 5)  # SW_SHOW

        # Standard Windows message pump
        msg = wintypes.MSG()
        while self.is_running:
            res = user32.PeekMessageW(ctypes.byref(msg), 0, 0, 0, 1)  # PM_REMOVE
            if res > 0:
                if msg.message == 0x0012:  # WM_QUIT
                    break
                user32.TranslateMessage(ctypes.byref(msg))
                user32.DispatchMessageW(ctypes.byref(msg))
            else:
                time.sleep(0.01)

    def _render_ghost_cursor(self):
        """Draws a high-contrast Black Arrow with White Border & RuXt AI Badge onto the layered window."""
        user32 = ctypes.windll.user32
        gdi32 = ctypes.windll.gdi32

        w = self.size + 40
        h = self.size + 20

        hdc_screen = user32.GetDC(0)
        hdc_mem = gdi32.CreateCompatibleDC(hdc_screen)

        class BITMAPINFOHEADER(ctypes.Structure):
            _fields_ = [
                ("biSize", wintypes.DWORD),
                ("biWidth", wintypes.LONG),
                ("biHeight", wintypes.LONG),
                ("biPlanes", wintypes.WORD),
                ("biBitCount", wintypes.WORD),
                ("biCompression", wintypes.DWORD),
                ("biSizeImage", wintypes.DWORD),
                ("biXPelsPerMeter", wintypes.LONG),
                ("biYPelsPerMeter", wintypes.LONG),
                ("biClrUsed", wintypes.DWORD),
                ("biClrImportant", wintypes.DWORD),
            ]

        bmi = BITMAPINFOHEADER()
        bmi.biSize = ctypes.sizeof(BITMAPINFOHEADER)
        bmi.biWidth = w
        bmi.biHeight = -h  # top-down
        bmi.biPlanes = 1
        bmi.biBitCount = 32
        bmi.biCompression = 0  # BI_RGB

        p_bits = ctypes.c_void_p()
        hbmp = gdi32.CreateDIBSection(hdc_mem, ctypes.byref(bmi), 0, ctypes.byref(p_bits), 0, 0)
        old_bmp = gdi32.SelectObject(hdc_mem, hbmp)

        # Draw procedural 32-bit ARGB pixel cursor
        buffer_len = w * h * 4
        pixel_data = (ctypes.c_ubyte * buffer_len).from_address(p_bits.value)

        def set_pixel(px, py, r, g, b, a):
            if 0 <= px < w and 0 <= py < h:
                idx = (py * w + px) * 4
                alpha_factor = a / 255.0
                pixel_data[idx] = int(b * alpha_factor)
                pixel_data[idx + 1] = int(g * alpha_factor)
                pixel_data[idx + 2] = int(r * alpha_factor)
                pixel_data[idx + 3] = a

        # Standard Arrow geometry (24px height)
        arrow_poly = [
            (0, 0), (0, 22), (5, 17), (10, 26), (13, 24), (8, 15), (15, 15)
        ]

        # Draw White Glow / Border (outer)
        for dx in range(-2, 3):
            for dy in range(-2, 3):
                if dx == 0 and dy == 0:
                    continue
                for i in range(len(arrow_poly)):
                    p1 = arrow_poly[i]
                    p2 = arrow_poly[(i + 1) % len(arrow_poly)]
                    steps = max(abs(p2[0] - p1[0]), abs(p2[1] - p1[1])) * 2
                    for s in range(steps + 1):
                        lx = int(p1[0] + (p2[0] - p1[0]) * (s / max(1, steps))) + dx
                        ly = int(p1[1] + (p2[1] - p1[1]) * (s / max(1, steps))) + dy
                        set_pixel(lx, ly, 255, 255, 255, 240)

        # Draw Black Interior
        for py in range(24):
            for px in range(py + 1):
                if px <= 16 and py <= 23:
                    set_pixel(px, py, 15, 15, 15, 255)

        # Small "AI" badge next to cursor tip
        badge_x, badge_y = 20, 10
        for by in range(12):
            for bx in range(24):
                set_pixel(badge_x + bx, badge_y + by, 20, 30, 45, 220)
                if bx == 0 or bx == 23 or by == 0 or by == 11:
                    set_pixel(badge_x + bx, badge_y + by, 0, 230, 255, 255)

        # Update layered window
        pt_src = POINT(0, 0)
        size_wnd = SIZE(w, h)
        pt_dst = POINT(self.current_x, self.current_y)
        blend = BLENDFUNCTION(AC_SRC_OVER, 0, 255, AC_SRC_ALPHA)

        user32.UpdateLayeredWindow(
            self.hwnd,
            hdc_screen,
            ctypes.byref(pt_dst),
            ctypes.byref(size_wnd),
            hdc_mem,
            ctypes.byref(pt_src),
            0,
            ctypes.byref(blend),
            ULW_ALPHA
        )

        gdi32.SelectObject(hdc_mem, old_bmp)
        gdi32.DeleteObject(hbmp)
        gdi32.DeleteDC(hdc_mem)
        user32.ReleaseDC(0, hdc_screen)


# Singleton instance
_ghost_cursor: Optional[AIGhostCursorOverlay] = None

def get_ai_ghost_cursor() -> AIGhostCursorOverlay:
    global _ghost_cursor
    if _ghost_cursor is None:
        _ghost_cursor = AIGhostCursorOverlay()
    return _ghost_cursor

def stop_ai_ghost_cursor():
    global _ghost_cursor
    if _ghost_cursor is not None:
        _ghost_cursor.stop()
        _ghost_cursor = None

atexit.register(stop_ai_ghost_cursor)
