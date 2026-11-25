"""Windows UI & Process Controller for CapCut without mouse interference."""

import os
import subprocess
import time
import ctypes
from ctypes import wintypes
from capcut_agent.config import get_capcut_executable

user32 = ctypes.windll.user32

class WindowController:
    """Manages CapCut process and window activation without moving the mouse."""

    @staticmethod
    def launch_capcut(target_exe: str = None) -> subprocess.Popen:
        exe = target_exe or get_capcut_executable()
        if not os.path.exists(exe):
            raise FileNotFoundError(f"CapCut executable not found at: {exe}")
        
        proc = subprocess.Popen([exe], shell=False)
        return proc

    @staticmethod
    def find_and_focus_capcut(timeout_sec: int = 10) -> bool:
        """Finds CapCut window and brings it to the foreground without cursor moves."""
        start_time = time.time()
        hwnd_target = None

        def enum_windows_callback(hwnd, extra):
            nonlocal hwnd_target
            if user32.IsWindowVisible(hwnd):
                length = user32.GetWindowTextLengthW(hwnd)
                if length > 0:
                    buff = ctypes.create_unicode_buffer(length + 1)
                    user32.GetWindowTextW(hwnd, buff, length + 1)
                    title = buff.value
                    if "CapCut" in title:
                        hwnd_target = hwnd
                        return False
            return True

        WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, wintypes.HWND, wintypes.LPARAM)
        cb = WNDENUMPROC(enum_windows_callback)

        while time.time() - start_time < timeout_sec:
            user32.EnumWindows(cb, 0)
            if hwnd_target:
                # Restore if minimized
                user32.ShowWindow(hwnd_target, 9) # SW_RESTORE
                # Bring to front
                user32.SetForegroundWindow(hwnd_target)
                return True
            time.sleep(0.5)

        return False
