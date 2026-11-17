import ctypes
from ctypes import wintypes
import logging
import math
import os
import platform
import subprocess
import time
from typing import List, Optional, Tuple
import pyautogui
import pyperclip

from .ai_ghost_cursor import get_ai_ghost_cursor

logger = logging.getLogger("ruxt_agent_s.actions")

# Win32 Hardware Mouse Event Constants
MOUSEEVENTF_MOVE = 0x0001
MOUSEEVENTF_LEFTDOWN = 0x0002
MOUSEEVENTF_LEFTUP = 0x0004
MOUSEEVENTF_RIGHTDOWN = 0x0008
MOUSEEVENTF_RIGHTUP = 0x0010
MOUSEEVENTF_MIDDLEDOWN = 0x0020
MOUSEEVENTF_MIDDLEUP = 0x0040
MOUSEEVENTF_ABSOLUTE = 0x8000

class POINT(ctypes.Structure):
    _fields_ = [("x", wintypes.LONG), ("y", wintypes.LONG)]

def get_physical_cursor_pos() -> Tuple[int, int]:
    pt = POINT()
    ctypes.windll.user32.GetCursorPos(ctypes.byref(pt))
    return int(pt.x), int(pt.y)

def set_physical_cursor_pos(x: int, y: int):
    ctypes.windll.user32.SetCursorPos(int(x), int(y))

def win32_hardware_mouse_move(x: int, y: int, screen_width: int, screen_height: int):
    """
    Sends true Windows hardware MOUSEEVENTF_MOVE with MOUSEEVENTF_ABSOLUTE.
    This injects authentic WM_MOUSEMOVE messages with the active button state
    directly into the Windows message queue, ensuring MS Paint and canvas applications
    receive continuous mouse move messages to render strokes.
    """
    if platform.system() == "Windows":
        norm_x = int(round(x * 65535.0 / max(1, screen_width - 1)))
        norm_y = int(round(y * 65535.0 / max(1, screen_height - 1)))
        ctypes.windll.user32.mouse_event(MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE, norm_x, norm_y, 0, 0)
        ctypes.windll.user32.SetCursorPos(int(x), int(y))
    else:
        pyautogui.moveTo(x, y)

def win32_hardware_mouse_down(button: str = "left"):
    if platform.system() == "Windows":
        flag = MOUSEEVENTF_RIGHTDOWN if button == "right" else MOUSEEVENTF_LEFTDOWN
        ctypes.windll.user32.mouse_event(flag, 0, 0, 0, 0)
    else:
        pyautogui.mouseDown(button=button)

def win32_hardware_mouse_up(button: str = "left"):
    if platform.system() == "Windows":
        flag = MOUSEEVENTF_RIGHTUP if button == "right" else MOUSEEVENTF_LEFTUP
        ctypes.windll.user32.mouse_event(flag, 0, 0, 0, 0)
    else:
        pyautogui.mouseUp(button=button)

class DesktopActionExecutor:
    """
    Hybrid PyAutoGUI + PyWinAuto Action Execution Engine.
    Combines PyWinAuto (Windows native UIA control hierarchy & window management)
    with PyAutoGUI & RuXt AI Ghost Cursor (fluid visual movement, dual-cursor preservation,
    global clipboard typing, and hotkeys).
    """
    def __init__(
        self,
        screen_size: Tuple[int, int],
        move_duration: float = 0.20,
        action_delay: float = 0.10,
        type_via_clipboard: bool = True,
        failsafe: bool = True,
        cursor_mode: str = "direct",
        independent_cursor: bool = False,
        enable_pywinauto: bool = True
    ):
        self.screen_width, self.screen_height = screen_size
        self.move_duration = move_duration
        self.action_delay = action_delay
        self.type_via_clipboard = type_via_clipboard
        if cursor_mode == "ghost" or independent_cursor:
            self.cursor_mode = "ghost"
            self.independent_cursor = True
        else:
            self.cursor_mode = "direct"
            self.independent_cursor = False
        self.enable_pywinauto = enable_pywinauto
        self.ghost_cursor = get_ai_ghost_cursor() if self.independent_cursor else None
        pyautogui.FAILSAFE = False if self.independent_cursor else failsafe

        self._uia_desktop = None
        if self.enable_pywinauto and platform.system() == "Windows":
            try:
                from pywinauto import Desktop
                self._uia_desktop = Desktop(backend="uia")
                logger.info("PyWinAuto UIA hybrid backend initialized successfully.")
            except Exception as e:
                logger.warning(f"PyWinAuto UIA init notice: {e}")

    def _clamp(self, x: int, y: int) -> Tuple[int, int]:
        clamped_x = max(0, min(int(x), self.screen_width - 1))
        clamped_y = max(0, min(int(y), self.screen_height - 1))
        return clamped_x, clamped_y

    def move_to(self, x: int, y: int, smooth: bool = True):
        cx, cy = self._clamp(x, y)
        if self.independent_cursor and self.ghost_cursor:
            # Glide the RuXt AI Ghost Cursor smoothly to target coordinate
            self.ghost_cursor.move_to(cx, cy, duration=self.move_duration)
        else:
            if smooth and self.move_duration > 0:
                start_x, start_y = get_physical_cursor_pos()
                dist = math.hypot(cx - start_x, cy - start_y)
                steps = max(5, int(dist / 12.0))
                step_delay = max(0.002, self.move_duration / steps)
                for s in range(1, steps + 1):
                    t = s / steps
                    ease_t = 1.0 - math.pow(1.0 - t, 3)  # Smooth cubic ease-out
                    ix = int(round(start_x + (cx - start_x) * ease_t))
                    iy = int(round(start_y + (cy - start_y) * ease_t))
                    win32_hardware_mouse_move(ix, iy, self.screen_width, self.screen_height)
                    time.sleep(step_delay)
            else:
                win32_hardware_mouse_move(cx, cy, self.screen_width, self.screen_height)
            time.sleep(0.01)

    def click(self, x: int, y: int, button: str = "left", clicks: int = 1):
        cx, cy = self._clamp(x, y)
        logger.info(f"Clicking at ({cx}, {cy}) button={button} clicks={clicks}")
        
        self.move_to(cx, cy)

        if self.independent_cursor and self.ghost_cursor:
            # Dual Cursor Park-Click-Return Pipeline:
            user_x, user_y = get_physical_cursor_pos()
            try:
                self.ghost_cursor.trigger_click_effect()
                set_physical_cursor_pos(cx, cy)
                win32_hardware_mouse_move(cx, cy, self.screen_width, self.screen_height)
                for _ in range(clicks):
                    win32_hardware_mouse_down(button)
                    time.sleep(0.04)
                    win32_hardware_mouse_up(button)
                    time.sleep(0.04)
            finally:
                if user_x > 0 or user_y > 0:
                    set_physical_cursor_pos(user_x, user_y)
            time.sleep(self.action_delay)
        else:
            win32_hardware_mouse_move(cx, cy, self.screen_width, self.screen_height)
            for _ in range(clicks):
                win32_hardware_mouse_down(button)
                time.sleep(0.04)
                win32_hardware_mouse_up(button)
                time.sleep(0.04)
            time.sleep(self.action_delay)

    def double_click(self, x: int, y: int):
        self.click(x, y, button="left", clicks=2)

    def right_click(self, x: int, y: int):
        self.click(x, y, button="right", clicks=1)

    def drag_and_drop(self, from_x: int, from_y: int, to_x: int, to_y: int, duration: Optional[float] = None):
        fx, fy = self._clamp(from_x, from_y)
        tx, ty = self._clamp(to_x, to_y)
        drag_duration = duration if duration is not None else max(0.25, self.move_duration * 1.5)
        logger.info(f"Dragging from ({fx}, {fy}) to ({tx}, {ty}) duration={drag_duration:.2f}s")
        
        # 1. ALWAYS position physical mouse to start coordinate first!
        self.move_to(fx, fy)
        win32_hardware_mouse_move(fx, fy, self.screen_width, self.screen_height)
        if self.independent_cursor and self.ghost_cursor:
            self.ghost_cursor.set_position(fx, fy)
        time.sleep(0.06)  # Allow target window (e.g. Paint canvas) to capture pointer focus

        # 2. Mouse down with stabilizing pause (injects authentic WM_LBUTTONDOWN)
        win32_hardware_mouse_down("left")
        time.sleep(0.06)

        # 3. Dense hardware drag movement (injects continuous WM_MOUSEMOVE with MK_LBUTTON)
        dist = math.hypot(tx - fx, ty - fy)
        sub_steps = max(10, int(dist / 3.0))
        sub_delay = max(0.002, drag_duration / sub_steps)
        
        for s in range(1, sub_steps + 1):
            t = s / sub_steps
            # Smooth ease-in-out curve
            ease_t = 0.5 * (1.0 - math.cos(math.pi * t))
            ix = int(round(fx + (tx - fx) * ease_t))
            iy = int(round(fy + (ty - fy) * ease_t))
            win32_hardware_mouse_move(ix, iy, self.screen_width, self.screen_height)
            if self.independent_cursor and self.ghost_cursor:
                self.ghost_cursor.set_position(ix, iy)
            time.sleep(sub_delay)

        time.sleep(0.06)
        win32_hardware_mouse_move(tx, ty, self.screen_width, self.screen_height)
        win32_hardware_mouse_up("left")
        time.sleep(self.action_delay)

    def draw_stroke(self, points: List[Tuple[int, int]], duration: float = 0.6):
        """
        Draws a smooth continuous multi-point stroke on canvas using native Win32 hardware drag events.
        Guarantees that MS Paint receives continuous WM_MOUSEMOVE packets while left button is down.
        """
        if not points:
            return
        if len(points) == 1:
            self.click(points[0][0], points[0][1])
            return

        clamped_points = [self._clamp(p[0], p[1]) for p in points]
        start_x, start_y = clamped_points[0]
        
        logger.info(f"Drawing stroke with {len(clamped_points)} waypoints starting at ({start_x}, {start_y})")
        
        # 1. Position physical mouse to start coordinate
        self.move_to(start_x, start_y)
        win32_hardware_mouse_move(start_x, start_y, self.screen_width, self.screen_height)
        if self.independent_cursor and self.ghost_cursor:
            self.ghost_cursor.set_position(start_x, start_y)
        time.sleep(0.06)  # Give Paint time to capture canvas

        # 2. Hold left mouse down (authentically sends WM_LBUTTONDOWN)
        win32_hardware_mouse_down("left")
        time.sleep(0.06)

        # 3. Dense waypoint traversal with sub-step interpolation
        num_segments = len(clamped_points) - 1
        time_per_segment = max(0.015, duration / max(1, num_segments))
        
        for i in range(num_segments):
            p1 = clamped_points[i]
            p2 = clamped_points[i + 1]
            dist = math.hypot(p2[0] - p1[0], p2[1] - p1[1])
            
            # Interpolate sub-steps so mouse moves every ~2.5 pixels
            sub_steps = max(2, int(dist / 2.5))
            sub_delay = max(0.002, time_per_segment / sub_steps)
            
            for s in range(1, sub_steps + 1):
                t = s / sub_steps
                ix = int(round(p1[0] + (p2[0] - p1[0]) * t))
                iy = int(round(p1[1] + (p2[1] - p1[1]) * t))
                win32_hardware_mouse_move(ix, iy, self.screen_width, self.screen_height)
                if self.independent_cursor and self.ghost_cursor:
                    self.ghost_cursor.set_position(ix, iy)
                time.sleep(sub_delay)

        time.sleep(0.06)
        last_x, last_y = clamped_points[-1]
        win32_hardware_mouse_move(last_x, last_y, self.screen_width, self.screen_height)
        win32_hardware_mouse_up("left")
        time.sleep(self.action_delay)

    def draw_shape(
        self,
        shape: str,
        x: int,
        y: int,
        width: int = 150,
        height: int = 150,
        duration: float = 0.6,
        mode: str = "freehand"
    ):
        """
        Draws geometric shapes (rectangle, circle, ellipse, triangle, line, star) on canvas.
        Coordinates (x, y) represent the center of the shape.
        mode="freehand": Draws perimeter stroke using dense Win32 move events.
        mode="drag_box": Drags bounding box from top-left to bottom-right (for MS Paint shape tools like Oval/Rectangle).
        """
        s = shape.lower().strip()
        w = max(10, int(width))
        h = max(10, int(height))
        hw = w // 2
        hh = h // 2

        logger.info(f"Drawing shape '{s}' at center ({x}, {y}) w={w} h={h} mode={mode}")

        if mode == "drag_box":
            # For MS Paint native shape tools (Oval, Rectangle, Rounded Rect, etc.)
            self.drag_and_drop(x - hw, y - hh, x + hw, y + hh, duration=duration)
            return

        if s in ["rectangle", "rect", "box", "square"]:
            pts = [
                (x - hw, y - hh),
                (x + hw, y - hh),
                (x + hw, y + hh),
                (x - hw, y + hh),
                (x - hw, y - hh)
            ]
        elif s in ["circle", "ellipse", "oval", "round"]:
            steps = 36
            pts = []
            for i in range(steps + 1):
                theta = 2.0 * math.pi * (i / steps)
                px = int(round(x + hw * math.cos(theta)))
                py = int(round(y + hh * math.sin(theta)))
                pts.append((px, py))
        elif s in ["triangle"]:
            pts = [
                (x, y - hh),
                (x + hw, y + hh),
                (x - hw, y + hh),
                (x, y - hh)
            ]
        elif s in ["line"]:
            pts = [
                (x - hw, y - hh),
                (x + hw, y + hh)
            ]
        elif s in ["star"]:
            steps = 10
            pts = []
            for i in range(steps + 1):
                r = hw if i % 2 == 0 else hw // 2
                theta = -math.pi / 2 + 2.0 * math.pi * (i / steps)
                px = int(round(x + r * math.cos(theta)))
                py = int(round(y + r * math.sin(theta)))
                pts.append((px, py))
        else:
            steps = 32
            pts = []
            for i in range(steps + 1):
                theta = 2.0 * math.pi * (i / steps)
                px = int(round(x + hw * math.cos(theta)))
                py = int(round(y + hh * math.sin(theta)))
                pts.append((px, py))

        self.draw_stroke(pts, duration=duration)

    def type_text(self, text: str, clear_existing: bool = False):
        logger.info(f"Typing text (len={len(text)}): {text[:30]}...")
        if clear_existing:
            pyautogui.hotkey("ctrl", "a")
            time.sleep(0.05)
            pyautogui.press("backspace")
            time.sleep(0.05)

        if self.type_via_clipboard:
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

    # =========================================================================
    # PyWinAuto Hybrid Windows Interaction & Window Controls
    # =========================================================================

    def click_control(self, query: str, button: str = "left") -> bool:
        """
        Locates a control by text/automation_id using PyWinAuto UIA,
        glides the AI Ghost Cursor to the control center, and clicks it.
        """
        if not self._uia_desktop:
            logger.warning("PyWinAuto not initialized, cannot click control by query")
            return False

        try:
            q_lower = query.lower().strip()
            windows = self._uia_desktop.windows(visible_only=True)
            for win in windows[:5]:
                try:
                    for child in win.descendants():
                        name = (child.element_info.name or "").strip().lower()
                        auto_id = (child.element_info.automation_id or "").strip().lower()
                        if q_lower in name or q_lower == auto_id:
                            rect = child.rectangle()
                            if rect.width() > 0 and rect.height() > 0:
                                cx = (rect.left + rect.right) // 2
                                cy = (rect.top + rect.bottom) // 2
                                logger.info(f"PyWinAuto matched '{query}' at ({cx}, {cy})")
                                self.click(cx, cy, button=button)
                                return True
                except Exception:
                    continue
        except Exception as e:
            logger.warning(f"Error in click_control('{query}'): {e}")
        return False

    def focus_window(self, title_query: str) -> bool:
        """Finds and activates a window matching title_query."""
        if not self._uia_desktop:
            return False
        try:
            q_lower = title_query.lower().strip()
            windows = self._uia_desktop.windows(visible_only=True)
            for win in windows:
                w_title = (win.window_text() or "").lower()
                if q_lower in w_title:
                    logger.info(f"Focusing window: '{win.window_text()}'")
                    win.set_focus()
                    time.sleep(self.action_delay)
                    return True
        except Exception as e:
            logger.warning(f"focus_window error: {e}")
        return False

    def maximize_window(self, title_query: str = "") -> bool:
        """Maximizes target window (or active foreground window if title_query is empty)."""
        if not self._uia_desktop:
            return False
        try:
            target_win = None
            if title_query:
                q_lower = title_query.lower().strip()
                for win in self._uia_desktop.windows(visible_only=True):
                    if q_lower in (win.window_text() or "").lower():
                        target_win = win
                        break
            else:
                target_win = self._uia_desktop.active()

            if target_win:
                target_win.maximize()
                time.sleep(self.action_delay)
                return True
        except Exception as e:
            logger.warning(f"maximize_window error: {e}")
        return False

    def minimize_window(self, title_query: str = "") -> bool:
        """Minimizes target window."""
        if not self._uia_desktop:
            return False
        try:
            target_win = None
            if title_query:
                q_lower = title_query.lower().strip()
                for win in self._uia_desktop.windows(visible_only=True):
                    if q_lower in (win.window_text() or "").lower():
                        target_win = win
                        break
            else:
                target_win = self._uia_desktop.active()

            if target_win:
                target_win.minimize()
                time.sleep(self.action_delay)
                return True
        except Exception as e:
            logger.warning(f"minimize_window error: {e}")
        return False

    def close_window(self, title_query: str = "") -> bool:
        """Closes target window."""
        if not self._uia_desktop:
            return False
        try:
            target_win = None
            if title_query:
                q_lower = title_query.lower().strip()
                for win in self._uia_desktop.windows(visible_only=True):
                    if q_lower in (win.window_text() or "").lower():
                        target_win = win
                        break
            else:
                target_win = self._uia_desktop.active()

            if target_win:
                target_win.close()
                time.sleep(self.action_delay)
                return True
        except Exception as e:
            logger.warning(f"close_window error: {e}")
        return False
