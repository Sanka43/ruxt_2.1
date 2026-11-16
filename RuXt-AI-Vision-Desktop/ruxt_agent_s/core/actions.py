import ctypes
from ctypes import wintypes
import logging
import os
import subprocess
import time
from typing import List, Optional, Tuple
import pyautogui
import pyperclip

from .ai_ghost_cursor import get_ai_ghost_cursor

logger = logging.getLogger("ruxt_agent_s.actions")

class POINT(ctypes.Structure):
    _fields_ = [("x", wintypes.LONG), ("y", wintypes.LONG)]

def get_physical_cursor_pos() -> Tuple[int, int]:
    pt = POINT()
    ctypes.windll.user32.GetCursorPos(ctypes.byref(pt))
    return int(pt.x), int(pt.y)

def set_physical_cursor_pos(x: int, y: int):
    ctypes.windll.user32.SetCursorPos(int(x), int(y))

class DesktopActionExecutor:
    def __init__(
        self,
        screen_size: Tuple[int, int],
        move_duration: float = 0.15,
        action_delay: float = 0.15,
        type_via_clipboard: bool = True,
        failsafe: bool = True,
        independent_cursor: bool = True
    ):
        self.screen_width, self.screen_height = screen_size
        self.move_duration = move_duration
        self.action_delay = action_delay
        self.type_via_clipboard = type_via_clipboard
        self.independent_cursor = independent_cursor
        self.ghost_cursor = get_ai_ghost_cursor()
        pyautogui.FAILSAFE = False if independent_cursor else failsafe

    def _clamp(self, x: int, y: int) -> Tuple[int, int]:
        clamped_x = max(0, min(int(x), self.screen_width - 1))
        clamped_y = max(0, min(int(y), self.screen_height - 1))
        return clamped_x, clamped_y

    def move_to(self, x: int, y: int):
        cx, cy = self._clamp(x, y)
        if self.independent_cursor:
            # Glide the RuXt AI Ghost Cursor smoothly to target coordinate
            # while leaving the user's physical mouse cursor untouched!
            self.ghost_cursor.move_to(cx, cy, duration=self.move_duration)
        else:
            pyautogui.moveTo(cx, cy, duration=self.move_duration, tween=pyautogui.easeOutQuad)
            time.sleep(0.02)

    def click(self, x: int, y: int, button: str = "left", clicks: int = 1):
        cx, cy = self._clamp(x, y)
        logger.info(f"Clicking at ({cx}, {cy}) button={button} clicks={clicks}")
        
        # 1. Animate RuXt AI Ghost Cursor to coordinate
        self.move_to(cx, cy)

        if self.independent_cursor:
            # Dual Cursor Park-Click-Return Pipeline:
            # Record user's working mouse position
            user_x, user_y = get_physical_cursor_pos()
            try:
                # Trigger click effect on AI Ghost Cursor
                self.ghost_cursor.trigger_click_effect()
                # Snap to AI target, fire click
                set_physical_cursor_pos(cx, cy)
                pyautogui.click(x=cx, y=cy, clicks=clicks, button=button)
            finally:
                # If user had an active cursor position, instantly restore it (< 5ms)
                if user_x > 0 or user_y > 0:
                    set_physical_cursor_pos(user_x, user_y)
            time.sleep(self.action_delay)
        else:
            pyautogui.click(x=cx, y=cy, clicks=clicks, button=button)
            time.sleep(self.action_delay)

    def double_click(self, x: int, y: int):
        self.click(x, y, button="left", clicks=2)

    def right_click(self, x: int, y: int):
        self.click(x, y, button="right", clicks=1)

    def drag_and_drop(self, from_x: int, from_y: int, to_x: int, to_y: int):
        fx, fy = self._clamp(from_x, from_y)
        tx, ty = self._clamp(to_x, to_y)
        logger.info(f"Dragging from ({fx}, {fy}) to ({tx}, {ty})")
        self.move_to(fx, fy)
        pyautogui.mouseDown(button="left")
        time.sleep(0.1)
        pyautogui.moveTo(tx, ty, duration=self.move_duration * 1.5, tween=pyautogui.easeInOutQuad)
        pyautogui.mouseUp(button="left")
        time.sleep(self.action_delay)

    def type_text(self, text: str, clear_existing: bool = False):
        logger.info(f"Typing text (len={len(text)}): {text[:30]}...")
        if clear_existing:
            pyautogui.hotkey("ctrl", "a")
            time.sleep(0.05)
            pyautogui.press("backspace")
            time.sleep(0.05)

        if self.type_via_clipboard:
            # Safe for Unicode, emojis, Windows special characters
            pyperclip.copy(text)
            time.sleep(0.05)
            pyautogui.hotkey("ctrl", "v")
        else:
            pyautogui.write(text, interval=0.02)
        time.sleep(self.action_delay)

    def press_key(self, key: str, presses: int = 1):
        norm_key = key.lower()
        logger.info(f"Pressing key: {norm_key} (x{presses})")
        for _ in range(presses):
            pyautogui.press(norm_key)
            time.sleep(0.05)
        time.sleep(self.action_delay)

    def hotkey(self, keys: List[str]):
        norm_keys = [k.lower() for k in keys]
        logger.info(f"Hotkey: {'+'.join(norm_keys)}")
        pyautogui.hotkey(*norm_keys)
        time.sleep(self.action_delay)

    def scroll(self, amount: int, x: Optional[int] = None, y: Optional[int] = None):
        if x is not None and y is not None:
            self.move_to(x, y)
        logger.info(f"Scrolling amount: {amount}")
        pyautogui.scroll(amount)
        time.sleep(self.action_delay)

    def wait(self, seconds: float):
        logger.info(f"Waiting for {seconds}s")
        time.sleep(seconds)

    def launch_app(self, app_name: str):
        logger.info(f"Launching app: {app_name}")
        if os.name == "nt":
            try:
                os.startfile(app_name)
            except Exception:
                subprocess.Popen(f'start "" "{app_name}"', shell=True)
        else:
            subprocess.Popen([app_name])
        time.sleep(2.0)
