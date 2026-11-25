import ast
import base64
import io
import json
import logging
import re
import time
from typing import Any, Callable, Dict, List, Optional
from PIL import Image

from .config import AppConfig
from .core.actions import DesktopActionExecutor
from .core.cursor import set_ai_cursor
from .core.ai_ghost_cursor import get_ai_ghost_cursor, stop_ai_ghost_cursor
from .core.grounding import VisualGrounder, OmniParserV2Grounder
from .core.loop_guard import LoopGuard, STOP as LOOP_STOP, WARN as LOOP_WARN
from .core.safety import BLOCK, CONFIRM, classify_action, safety_mode
from .core.observation import ScreenObserver, ScreenState
from .core.uia_grounding import WindowsUIAGrounder
from .llm.client import MultiModalLLMClient
from .llm.prompts import SYSTEM_PROMPT, format_worker_user_prompt

logger = logging.getLogger("ruxt_agent_s.agent")

class RuXtVisionAgent:
    """
    Autonomous Vision-Based Desktop Control Agent for RuXt.
    Enhanced with:
      - Microsoft OmniParser v2 Set-of-Marks (SOM) Clickable Icon Tagging
      - Claude 3.5/3.7 Computer-Use & ByteDance UI-TARS Support
      - PyAutoGUI + PyWinAuto Hybrid Controls
    """
    def __init__(
        self,
        config: AppConfig,
        on_step_callback: Optional[Callable[[Dict[str, Any]], None]] = None
    ):
        self.config = config
        self.on_step_callback = on_step_callback

        self.observer = ScreenObserver(
            max_width=config.grounding.screenshot_max_width,
            max_height=config.grounding.screenshot_max_height
        )
        screen_w, screen_h = self.observer.get_screen_resolution()
        
        self.actions = DesktopActionExecutor(
            screen_size=(screen_w, screen_h),
            move_duration=config.execution.mouse_move_duration,
            action_delay=config.execution.action_delay,
            type_via_clipboard=config.execution.type_via_clipboard,
            typing_interval=getattr(config.execution, "typing_interval", 0.025),
            failsafe=config.execution.failsafe,
            cursor_mode=config.execution.cursor_mode,
            independent_cursor=config.execution.independent_cursor,
            enable_pywinauto=config.execution.hybrid_uia_pyautogui
        )

        self.omniparser = (
            OmniParserV2Grounder(
                screen_width=screen_w,
                screen_height=screen_h,
                mode=config.grounding.omniparser_mode,
                endpoint=config.grounding.omniparser_endpoint,
                fast_mode=getattr(config.grounding, "fast_mode", True)
            )
            if config.grounding.use_omniparser
            else None
        )
        
        self.grounder = VisualGrounder(
            screen_width=screen_w,
            screen_height=screen_h,
            coordinate_scale=config.grounding.coordinate_scale,
            omniparser_grounder=self.omniparser
        )
        
        self.uia_grounder = WindowsUIAGrounder() if config.grounding.use_uia_tree else None
        
        self.llm = MultiModalLLMClient(
            provider=config.provider,
            model=config.model,
            api_key=config.api_key,
            base_url=config.base_url,
            screen_size=(screen_w, screen_h)
        )

        self.history: List[Dict[str, Any]] = []
        self.loop_guard = LoopGuard()

        # Clean up any leftover signals from previous aborted runs
        for ap in self._get_signal_paths("abort.signal"):
            try:
                if ap.exists(): ap.unlink()
            except Exception:
                pass

    def _normalize_single_action(self, line: str) -> Optional[str]:
        line = line.strip("` \t\r")
        if not line or line.startswith("#"):
            return None

        # Strip python code fences if any
        if line.startswith("```"):
            return None

        # Handle UI-TARS action syntax (e.g. click(start_box='(500, 300)'))
        if "start_box=" in line or "point=" in line:
            coords = self.grounder.extract_coordinates(line)
            if coords:
                line = f"agent.click(x={coords[0]}, y={coords[1]})"

        # Handle UI-TARS type(content='...')
        uitars_type = re.search(r"type\s*\(\s*(?:content|text)\s*=\s*['\"](.*?)['\"]\s*\)", line, re.IGNORECASE)
        if uitars_type:
            line = f'agent.type(text="{uitars_type.group(1)}")'

        valid_funcs = [
            "click", "double_click", "right_click", "type", "press_key", "hotkey",
            "scroll", "drag_and_drop", "draw_shape", "draw_stroke", "wait", "launch", "finish",
            "request_user_intervention", "ask_user", "pause_for_user", "request_user_takeover",
            "click_control", "focus_window", "maximize_window", "minimize_window", "close_window"
        ]

        if line.startswith("agent."):
            return line

        for vf in valid_funcs:
            if line.startswith(f"{vf}(") or re.match(rf"^{vf}\s*\(", line):
                return f"agent.{line}"

        # Search for agent.<func>(...) inside line
        found = re.search(r"(agent\.(?:" + "|".join(valid_funcs) + r")\(.*?\))", line)
        if found:
            return found.group(1)

        return None

    def _parse_response(self, text: str) -> Dict[str, Any]:
        reflection = ""
        plan = ""
        actions: List[str] = []

        ref_match = re.search(r"(?:Reflection|Thought):\s*(.*?)(?=\nPlan:|\nAction:|$)", text, re.DOTALL | re.IGNORECASE)
        if ref_match:
            reflection = ref_match.group(1).strip()

        plan_match = re.search(r"Plan:\s*(.*?)(?=\nAction:|$)", text, re.DOTALL | re.IGNORECASE)
        if plan_match:
            plan = plan_match.group(1).strip()

        action_match = re.search(r"Action:\s*(.*)", text, re.DOTALL | re.IGNORECASE)
        if action_match:
            raw_action_block = action_match.group(1).strip()
            # Parse lines and semicolon-separated commands under Action:
            for line in raw_action_block.split("\n"):
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                # Stop if next section starts
                if any(line.lower().startswith(p) for p in ["reflection:", "plan:", "thought:"]):
                    break
                sub_lines = [p.strip() for p in line.split(";") if p.strip()] if ";" in line else [line]
                for sub in sub_lines:
                    norm = self._normalize_single_action(sub)
                    if norm:
                        actions.append(norm)

        # Fallback if no actions extracted from Action: section
        if not actions:
            call_matches = re.findall(
                r"((?:agent\.)?(?:click|double_click|right_click|type|press_key|hotkey|scroll|drag_and_drop|draw_shape|draw_stroke|wait|launch|finish|request_user_intervention|ask_user|pause_for_user|request_user_takeover|click_control|focus_window|maximize_window|minimize_window|close_window)\(.*?\))",
                text,
                re.IGNORECASE
            )
            for cm in call_matches:
                norm = self._normalize_single_action(cm)
                if norm and norm not in actions:
                    actions.append(norm)

        # Cap max chain length according to configuration
        max_chain = getattr(self.config.agent, "max_chain_length", 5)
        if not getattr(self.config.agent, "allow_action_chaining", True):
            max_chain = 1
        actions = actions[:max_chain]
        primary_action = actions[0] if actions else ""

        return {
            "reflection": reflection,
            "plan": plan,
            "action": primary_action,
            "actions": actions,
            "raw": text
        }

    def _execute_parsed_action(self, action_call: str) -> str:
        if not action_call:
            return "No valid agent action parsed"

        action_call = action_call.strip("`").strip()
        if not action_call.startswith("agent."):
            action_call = f"agent.{action_call}"

        try:
            tree = ast.parse(action_call)
            expr = tree.body[0]
            if not isinstance(expr, ast.Expr) or not isinstance(expr.value, ast.Call):
                return "Invalid call format"

            call = expr.value
            func_name = call.func.attr if isinstance(call.func, ast.Attribute) else ""

            # Extract arguments
            kwargs = {}
            for kw in call.keywords:
                try:
                    kwargs[kw.arg] = ast.literal_eval(kw.value)
                except Exception:
                    kwargs[kw.arg] = str(kw.value)

            args = []
            for arg in call.args:
                try:
                    args.append(ast.literal_eval(arg))
                except Exception:
                    args.append(str(arg))

            logger.info(f"Executing: func={func_name} args={args} kwargs={kwargs}")

            # Safety gate: nothing risky touches the mouse/keyboard without passing this first
            verdict = classify_action(func_name, args, kwargs)
            if verdict.level == BLOCK:
                logger.warning(f"Action blocked by safety policy: {func_name} ({verdict.reason})")
                return f"BLOCKED_BY_SAFETY: {verdict.reason}. Choose a safer approach or ask the user."
            if verdict.level == CONFIRM and safety_mode() != "off":
                decision = self._request_approval(func_name, verdict.reason, action_call)
                if decision == "aborted":
                    return "USER_INTERVENTION_ABORTED"
                if decision != "approved":
                    return f"ACTION_DENIED_BY_USER: {verdict.reason}. Do not retry this action; find another way or finish."

            if func_name == "click":
                box_id = kwargs.get("box_id", None)
                x = kwargs.get("x", args[0] if len(args) > 0 and box_id is None else None)
                y = kwargs.get("y", args[1] if len(args) > 1 and box_id is None else None)
                desc = kwargs.get("description", "")
                button = kwargs.get("button", "left")
                clicks = kwargs.get("clicks", 1)

                px, py = None, None

                # 1. Resolve via OmniParser Set-of-Marks box_id
                if box_id is not None and self.omniparser:
                    box_coords = self.grounder.resolve_box_id(int(box_id))
                    if box_coords:
                        px, py = box_coords
                        logger.info(f"OmniParser SOM resolved Box [{box_id}] -> ({px}, {py})")

                # 2. Try UIA grounding if description is given
                if px is None and desc and self.uia_grounder:
                    uia_coords = self.uia_grounder.find_element_bounds(desc)
                    if uia_coords:
                        px, py = uia_coords

                # 3. Fallback to normalized coordinate grounding
                if px is None and x is not None and y is not None:
                    px, py = self.grounder.normalize_to_pixels(float(x), float(y))

                if px is not None and py is not None:
                    self.actions.click(px, py, button=button, clicks=clicks)
                    lbl = f" (Box {box_id})" if box_id is not None else ""
                    return f"Clicked at ({px}, {py}){lbl}"
                return f"Failed to ground click target: box_id={box_id}, desc={desc}, x={x}, y={y}"

            elif func_name in ["double_click", "dblclick"]:
                box_id = kwargs.get("box_id", None)
                x = kwargs.get("x", args[0] if len(args) > 0 and box_id is None else None)
                y = kwargs.get("y", args[1] if len(args) > 1 and box_id is None else None)
                px, py = None, None
                if box_id is not None and self.omniparser:
                    px, py = self.grounder.resolve_box_id(int(box_id)) or (None, None)
                if px is None and x is not None and y is not None:
                    px, py = self.grounder.normalize_to_pixels(float(x), float(y))

                if px is not None and py is not None:
                    self.actions.double_click(px, py)
                    return f"Double-clicked at ({px}, {py})"
                return "Missing coordinates or box_id for double_click"

            elif func_name in ["right_click", "write_click", "context_click"]:
                box_id = kwargs.get("box_id", None)
                x = kwargs.get("x", args[0] if len(args) > 0 and box_id is None else None)
                y = kwargs.get("y", args[1] if len(args) > 1 and box_id is None else None)
                px, py = None, None
                if box_id is not None and self.omniparser:
                    px, py = self.grounder.resolve_box_id(int(box_id)) or (None, None)
                if px is None and x is not None and y is not None:
                    px, py = self.grounder.normalize_to_pixels(float(x), float(y))

                if px is not None and py is not None:
                    self.actions.right_click(px, py)
                    return f"Right-clicked at ({px}, {py})"
                return "Missing coordinates or box_id for right_click"

            elif func_name == "type":
                text = kwargs.get("text", args[0] if len(args) > 0 else "")
                box_id = kwargs.get("box_id", None)
                x = kwargs.get("x", None)
                y = kwargs.get("y", None)
                clear_existing = kwargs.get("clear_existing", False)
                typing_interval = kwargs.get("typing_interval", kwargs.get("interval", None))

                px, py = None, None
                if box_id is not None and self.omniparser:
                    px, py = self.grounder.resolve_box_id(int(box_id)) or (None, None)
                elif x is not None and y is not None:
                    px, py = self.grounder.normalize_to_pixels(float(x), float(y))

                if px is not None and py is not None:
                    self.actions.click(px, py)
                    time.sleep(0.15)

                self.actions.type_text(str(text), clear_existing=clear_existing, typing_interval=float(typing_interval) if typing_interval is not None else None)
                return f"Typed text: '{str(text)[:20]}...'"

            elif func_name == "click_control":
                query = kwargs.get("query", args[0] if len(args) > 0 else "")
                button = kwargs.get("button", "left")
                success = self.actions.click_control(str(query), button=button)
                if success:
                    return f"PyWinAuto clicked control '{query}'"
                return f"Failed to find PyWinAuto control '{query}'"

            elif func_name == "focus_window":
                title = kwargs.get("title", args[0] if len(args) > 0 else "")
                success = self.actions.focus_window(str(title))
                return f"Focused window '{title}'" if success else f"Window '{title}' not found"

            elif func_name == "maximize_window":
                title = kwargs.get("title", args[0] if len(args) > 0 else "")
                self.actions.maximize_window(str(title))
                return "Maximized window"

            elif func_name == "minimize_window":
                title = kwargs.get("title", args[0] if len(args) > 0 else "")
                self.actions.minimize_window(str(title))
                return "Minimized window"

            elif func_name == "close_window":
                title = kwargs.get("title", args[0] if len(args) > 0 else "")
                self.actions.close_window(str(title))
                return "Closed window"

            elif func_name == "press_key":
                key = kwargs.get("key", args[0] if len(args) > 0 else "")
                self.actions.press_key(str(key))
                return f"Pressed key '{key}'"

            elif func_name == "hotkey":
                keys = kwargs.get("keys", args[0] if len(args) > 0 else [])
                self.actions.hotkey(keys)
                return f"Pressed hotkey {'+'.join(keys)}"

            elif func_name in ["drag_and_drop", "click_and_drag", "drag"]:
                fx = kwargs.get("from_x", args[0] if len(args) > 0 else 0)
                fy = kwargs.get("from_y", args[1] if len(args) > 1 else 0)
                tx = kwargs.get("to_x", args[2] if len(args) > 2 else 0)
                ty = kwargs.get("to_y", args[3] if len(args) > 3 else 0)
                duration = kwargs.get("duration", args[4] if len(args) > 4 else None)
                pfx, pfy = self.grounder.normalize_to_pixels(float(fx), float(fy))
                ptx, pty = self.grounder.normalize_to_pixels(float(tx), float(ty))
                self.actions.drag_and_drop(pfx, pfy, ptx, pty, duration=float(duration) if duration else None)
                return f"Dragged from ({pfx}, {pfy}) to ({ptx}, {pty})"

            elif func_name == "draw_stroke":
                raw_points = kwargs.get("points", args[0] if len(args) > 0 else [])
                duration = kwargs.get("duration", args[1] if len(args) > 1 else 0.5)
                pixel_points = []
                for p in raw_points:
                    if isinstance(p, (list, tuple)) and len(p) >= 2:
                        px, py = self.grounder.normalize_to_pixels(float(p[0]), float(p[1]))
                        pixel_points.append((px, py))
                self.actions.draw_stroke(pixel_points, duration=float(duration))
                return f"Drawn stroke with {len(pixel_points)} points"

            elif func_name == "draw_shape":
                shape = kwargs.get("shape", args[0] if len(args) > 0 else "circle")
                x = kwargs.get("x", args[1] if len(args) > 1 else 500)
                y = kwargs.get("y", args[2] if len(args) > 2 else 500)
                width = kwargs.get("width", args[3] if len(args) > 3 else 150)
                height = kwargs.get("height", args[4] if len(args) > 4 else 150)
                duration = kwargs.get("duration", args[5] if len(args) > 5 else 0.6)
                mode = kwargs.get("mode", args[6] if len(args) > 6 else "freehand")
                px, py = self.grounder.normalize_to_pixels(float(x), float(y))
                pw = max(15, int(float(width) / self.config.grounding.coordinate_scale * self.actions.screen_width))
                ph = max(15, int(float(height) / self.config.grounding.coordinate_scale * self.actions.screen_height))
                self.actions.draw_shape(shape=str(shape), x=px, y=py, width=pw, height=ph, duration=float(duration), mode=str(mode))
                return f"Drawn {shape} at ({px}, {py}) size {pw}x{ph} (mode={mode})"

            elif func_name == "scroll":
                amount = kwargs.get("amount", args[0] if len(args) > 0 else -300)
                x = kwargs.get("x", None)
                y = kwargs.get("y", None)
                px, py = (None, None)
                if x is not None and y is not None:
                    px, py = self.grounder.normalize_to_pixels(float(x), float(y))
                self.actions.scroll(int(amount), px, py)
                return f"Scrolled {amount}"

            elif func_name == "wait":
                secs = kwargs.get("seconds", args[0] if len(args) > 0 else 2.0)
                self.actions.wait(float(secs))
                return f"Waited {secs} seconds"

            elif func_name == "launch":
                app_name = kwargs.get("app_name", args[0] if len(args) > 0 else "")
                self.actions.launch_app(str(app_name))
                return f"Launched {app_name}"

            elif func_name == "finish":
                msg = kwargs.get("message", "Task finished")
                return f"FINISH: {msg}"

            elif func_name in ["request_user_intervention", "ask_user", "pause_for_user", "request_user_takeover"]:
                msg = kwargs.get("message", args[0] if len(args) > 0 else "Please complete action on screen and click Continue")
                return self._handle_user_takeover(str(msg))

            else:
                return f"Unknown action: {func_name}"

        except Exception as e:
            logger.error(f"Error executing action {action_call}: {e}", exc_info=True)
            return f"Action execution error: {e}"

    def _get_signal_paths(self, filename: str) -> list:
        from pathlib import Path
        import os
        dirs = []
        ruxt_data = os.environ.get("RUXT_DATA_DIR")
        if ruxt_data:
            dirs.append(Path(ruxt_data))
            dirs.append(Path(ruxt_data) / "desktop_runs")

        home = Path.home()
        dirs.append(home / "AppData" / "Roaming" / "RuXt" / "data")
        dirs.append(home / "AppData" / "Roaming" / "RuXt" / "data" / "desktop_runs")
        dirs.append(home / "AppData" / "Roaming" / "ruxt-desktop")

        dirs.append(Path(__file__).resolve().parent.parent / "data")
        dirs.append(Path.cwd() / "data")
        dirs.append(Path.cwd())

        cfg_dir = getattr(self.config.agent, "data_dir", None)
        if cfg_dir:
            dirs.append(Path(cfg_dir))

        paths = []
        seen = set()
        for d in dirs:
            p = d / filename
            if str(p) not in seen:
                seen.add(str(p))
                paths.append(p)
        return paths

    def _is_aborted(self) -> bool:
        for p in self._get_signal_paths("abort.signal"):
            if p.exists():
                return True
        return False

    def _request_approval(self, func_name: str, reason: str, action_call: str, max_wait: float = 120.0) -> str:
        """
        Pauses before a risky action and waits for the user to Approve or Deny it in the HUD.
        Returns 'approved', 'denied', 'aborted' or 'timeout' (timeout counts as a denial).
        """
        logger.info(f"=== Approval requested for {func_name}: {reason} ===")
        try:
            set_ai_cursor(False)  # give the user the real cursor so they can click Approve/Deny
        except Exception:
            pass

        approve_files = self._get_signal_paths("approve.signal")
        deny_files = self._get_signal_paths("deny.signal")
        abort_files = self._get_signal_paths("abort.signal")

        # Drop stale decisions from earlier requests so they can't auto-answer this one
        for sf in approve_files + deny_files:
            try:
                sf.parent.mkdir(parents=True, exist_ok=True)
                if sf.exists():
                    sf.unlink()
            except Exception:
                pass

        event = {
            "event": "approval_required",
            "message": f"Approve this action? {reason}",
            "reason": reason,
            "action": action_call[:200],
            "step": len(self.history) + 1,
            "status": "waiting_for_approval",
        }
        if self.on_step_callback:
            self.on_step_callback(event)
        try:
            print(json.dumps(event), flush=True)
        except Exception:
            pass

        decision = "timeout"
        start = time.time()
        while time.time() - start < max_wait:
            if any(p.exists() for p in abort_files):
                decision = "aborted"
                break
            if any(p.exists() for p in deny_files):
                decision = "denied"
                break
            if any(p.exists() for p in approve_files):
                decision = "approved"
                break
            time.sleep(0.25)

        for sf in approve_files + deny_files:
            try:
                if sf.exists():
                    sf.unlink()
            except Exception:
                pass

        try:
            print(json.dumps({"event": "approval_resolved", "decision": decision, "step": len(self.history) + 1}), flush=True)
        except Exception:
            pass
        if decision != "aborted":
            try:
                set_ai_cursor(True)
            except Exception:
                pass
            time.sleep(0.2)
        logger.info(f"Approval decision: {decision}")
        return decision

    def _handle_user_takeover(self, message: str) -> str:
        """
        Safely halts AI mouse/keyboard interaction, yields native control to the human user,
        and waits for the user to complete the credential / login / CAPTCHA action.
        """
        logger.info(f"=== Human-in-the-Loop Takeover Requested: '{message}' ===")
        # 1. Release AI cursor back to normal so user has native control
        try:
            set_ai_cursor(False)
        except Exception:
            pass

        # 2. Emit JSON event for RuXt Server & Electron overlay
        takeover_event = {
            "event": "waiting_for_user",
            "message": message,
            "step": len(self.history) + 1,
            "status": "waiting_for_user"
        }
        if self.on_step_callback:
            self.on_step_callback(takeover_event)

        # Print directly to stdout for JSON stream consumers
        try:
            import sys
            print(json.dumps(takeover_event), flush=True)
        except Exception:
            pass

        # 3. Wait for resume signal file (resume.signal in candidate dirs) or abort signal or timeout (300s)
        signal_files = self._get_signal_paths("resume.signal")
        abort_files = self._get_signal_paths("abort.signal")

        for sf in signal_files:
            try:
                sf.parent.mkdir(parents=True, exist_ok=True)
                if sf.exists():
                    sf.unlink()
            except Exception:
                pass

        start_wait = time.time()
        max_wait = 300.0  # 5 minutes timeout
        logger.info(f"Agent safely paused waiting for user input (max {int(max_wait)}s)...")

        resumed = False
        aborted = False
        while time.time() - start_wait < max_wait:
            for af in abort_files:
                if af.exists():
                    logger.info("Abort signal detected during user takeover! Halting execution.")
                    aborted = True
                    break
            if aborted:
                break

            for sf in signal_files:
                if sf.exists():
                    logger.info(f"Resume signal detected at '{sf}'! User completed required action.")
                    try:
                        sf.unlink()
                    except Exception:
                        pass
                    resumed = True
                    break
            if resumed:
                break
            time.sleep(0.3)

        if aborted:
            return "USER_INTERVENTION_ABORTED"

        if resumed:
            logger.info("Immediately capturing fresh post-intervention screenshot...")
            try:
                # Immediate post-takeover screenshot
                fresh_obs = self.observer.capture(resize_for_model=True)
                shot_event = {
                    "event": "screenshot_captured",
                    "message": "📸 Fresh screenshot captured. Analyzing UI to continue...",
                    "step": len(self.history) + 1
                }
                if self.on_step_callback:
                    self.on_step_callback(shot_event)
                print(json.dumps(shot_event), flush=True)
            except Exception as shot_err:
                logger.warning(f"Failed to capture fresh post-resume screenshot immediately: {shot_err}")

            # Restore AI cursor and brief delay for UI to settle
            try:
                set_ai_cursor(True)
            except Exception:
                pass
            time.sleep(0.3)
            return f"USER_INTERVENTION_COMPLETED: {message}"
        else:
            return f"USER_INTERVENTION_TIMEOUT: No user input detected within {int(max_wait)}s"

    def run_task(self, task: str) -> Dict[str, Any]:
        """
        Executes the autonomous loop:
        OBSERVE -> OMNIPARSER SOM TAG -> PLAN -> GROUND -> ACT -> VERIFY
        """
        logger.info(f"=== Starting RuXt Vision Task: '{task}' ===")
        self.history = []
        self.loop_guard.reset()
        max_steps = self.config.agent.max_steps

        # Clear any stale abort signals
        for ap in self._get_signal_paths("abort.signal"):
            try:
                if ap.exists(): ap.unlink()
            except Exception:
                pass

        # Start AI Ghost Cursor overlay ONLY if ghost mode is explicitly configured
        use_ghost = (
            getattr(self.config.execution, "cursor_mode", "direct") == "ghost"
            and self.config.execution.independent_cursor
        )
        if use_ghost:
            ghost = get_ai_ghost_cursor()
            ghost.start()
            ghost.show(True)
        else:
            set_ai_cursor(True)
        try:
            for step in range(1, max_steps + 1):
                if self._is_aborted():
                    logger.info("Task aborted by user via abort signal.")
                    return {"success": False, "message": "Task aborted by user", "history": self.history}

                logger.info(f"--- Step {step}/{max_steps} ---")
                
                # 1. OBSERVE Screen (Downsampled & compressed for high-speed LLM inference)
                obs = self.observer.capture(resize_for_model=True)
                
                # 2. MICROSOFT OMNIPARSER v2 SET-OF-MARKS TAGGING
                som_summary = ""
                model_image_b64 = obs.image_base64
                if self.omniparser:
                    try:
                        tagged_img, box_map, som_summary = self.omniparser.parse_screen(
                            obs.image,
                            obs.active_window_title
                        )
                        # Downsample tagged image for LLM inference efficiency
                        max_w = self.config.grounding.screenshot_max_width
                        max_h = self.config.grounding.screenshot_max_height
                        if tagged_img.width > max_w or tagged_img.height > max_h:
                            tagged_img.thumbnail((max_w, max_h), Image.Resampling.BILINEAR)

                        buffered = io.BytesIO()
                        tagged_img.save(buffered, format="JPEG", quality=60, optimize=False)
                        model_image_b64 = base64.b64encode(buffered.getvalue()).decode("utf-8")
                        logger.info(f"Step {step}: OmniParser tagged {len(box_map)} elements on screen.")
                    except Exception as som_err:
                        logger.warning(f"OmniParser tagging warning: {som_err}")

                # 3. PROMPT & PLAN
                open_windows = self.observer.get_visible_windows()
                user_prompt = format_worker_user_prompt(
                    task=task,
                    step_num=step,
                    max_steps=max_steps,
                    active_window=obs.active_window_title,
                    history=self.history,
                    som_summary=som_summary,
                    open_windows=open_windows
                )

                last_was_intervention = (
                    len(self.history) > 0 and 
                    "USER_INTERVENTION_" in str(self.history[-1].get("result", ""))
                )
                if last_was_intervention:
                    user_prompt += (
                        "\n\n[IMPORTANT STATUS: The user has completed the requested credential/login/action "
                        "and clicked Continue. The attached screenshot is a BRAND-NEW capture taken immediately after "
                        "the user's action. Observe the updated screen, verify the login/form state, and proceed with "
                        f"the NEXT required action towards the task goal: '{task}'. Do not ask for user intervention "
                        "again unless a fresh, uncompleted security challenge is clearly visible.]"
                    )

                last_was_halted = (
                    len(self.history) > 0 and 
                    "CHAIN_HALTED" in str(self.history[-1].get("result", ""))
                )
                if last_was_halted:
                    user_prompt += (
                        "\n\n[ATTENTION: The previous action chain was automatically halted early because an unexpected UI state, "
                        "modal popup, or window shift appeared on screen. The attached screenshot shows the CURRENT screen state. "
                        "Inspect the screen carefully, address any new dialogs, popups, or state changes, and plan your next action accordingly.]"
                    )

                try:
                    llm_response = self.llm.generate(
                        system_prompt=SYSTEM_PROMPT,
                        user_prompt=user_prompt,
                        image_base64=model_image_b64
                    )
                except Exception as e:
                    logger.error(f"LLM generation failed: {e}")
                    err_step = {
                        "step": step,
                        "action": "none",
                        "result": f"Error: {e}",
                        "status": f"LLM error: {e}",
                        "finished": True
                    }
                    if self.on_step_callback:
                        self.on_step_callback(err_step)
                    return {"success": False, "error": str(e), "history": self.history}

                parsed = self._parse_response(llm_response)
                actions_chain = parsed.get("actions", [])
                if not actions_chain and parsed.get("action"):
                    actions_chain = [parsed["action"]]

                # 4. ACT & GROUND (Adaptive Batch Execution for Action Chaining)
                results = []
                is_finished = False
                initial_hwnd = self.observer.get_foreground_hwnd()
                initial_title = self.observer.get_active_window_title()

                for idx, act in enumerate(actions_chain):
                    if not act:
                        continue
                    if self._is_aborted():
                        logger.info("Aborting action chain due to abort signal.")
                        return {"success": False, "message": "Task aborted by user", "history": self.history}

                    # Adaptive Safety Guard: Pre-condition check for subsequent chained actions
                    if idx > 0:
                        current_hwnd = self.observer.get_foreground_hwnd()
                        current_title = self.observer.get_active_window_title()

                        # 1. Check if an unexpected window, modal dialog, or popup took foreground focus
                        is_window_mgmt = any(
                            act.strip().startswith(prefix) for prefix in [
                                "agent.focus_window", "agent.close_window", 
                                "agent.maximize_window", "agent.minimize_window",
                                "focus_window", "close_window", "maximize_window", "minimize_window"
                            ]
                        )
                        if initial_hwnd and current_hwnd and current_hwnd != initial_hwnd and not is_window_mgmt:
                            if current_title != initial_title:
                                logger.warning(
                                    f"Adaptive Guard: Foreground window shifted from '{initial_title}' to '{current_title}' after action {idx}. "
                                    f"Halting remaining chain to capture fresh screen."
                                )
                                results.append(f"CHAIN_HALTED: Unexpected window/modal appeared ('{current_title}'). Re-observing screen.")
                                break

                        # 2. Check for transition boundary: consecutive clicks across changing state
                        prev_act = actions_chain[idx - 1]
                        is_prev_click = "click(" in prev_act and "double_click" not in prev_act and "right_click" not in prev_act
                        is_curr_click = "click(" in act and "double_click" not in act and "right_click" not in act
                        if is_prev_click and is_curr_click and current_title != initial_title:
                            logger.warning(
                                f"Adaptive Guard: Window state changed after click from '{initial_title}' to '{current_title}'. "
                                f"Halting chain before next click."
                            )
                            results.append(f"CHAIN_HALTED: Window title changed after click ('{current_title}'). Re-observing screen.")
                            break

                    logger.info(f"Executing chain action [{idx+1}/{len(actions_chain)}]: {act}")
                    res = self._execute_parsed_action(act)
                    results.append(res)
                    loop_state = self.loop_guard.record(act, res)
                    if loop_state == LOOP_STOP:
                        logger.error(f"Stopping: the same action keeps repeating without progress: {act}")
                        return {
                            "success": False,
                            "message": "Stopped: the same action was repeated many times without making progress",
                            "history": self.history,
                        }
                    if loop_state == LOOP_WARN:
                        results[-1] = res + " | LOOP_WARNING: this exact action has repeated several times with no progress; try a different approach."
                    if "USER_INTERVENTION_ABORTED" in res:
                        logger.info("User intervention aborted by user. Exiting task.")
                        return {"success": False, "message": "Task aborted by user", "history": self.history}
                    if "FINISH:" in res:
                        is_finished = True
                        break
                    if res.startswith(("BLOCKED_BY_SAFETY", "ACTION_DENIED_BY_USER")):
                        # Never carry on with the rest of a chain after a refused action
                        logger.info(f"Safety gate stopped the action chain: {res}")
                        break
                    if "USER_INTERVENTION_" in res:
                        logger.info(f"Human intervention event completed ({res}). Breaking batch to observe updated screen.")
                        break
                    if "Failed to ground" in res or "execution error" in res.lower():
                        logger.warning(f"Action '{act}' halted early: {res}. Pausing batch to refresh screen observation.")
                        break
                    if idx < len(actions_chain) - 1:
                        time.sleep(self.config.execution.action_delay)

                executed_count = len(results)
                if executed_count < len(actions_chain):
                    action_summary = " ; ".join(actions_chain[:executed_count]) + f" [HALTED {len(actions_chain) - executed_count} REMAINING FOR FRESH OBSERVATION]"
                else:
                    action_summary = " ; ".join(actions_chain) if len(actions_chain) > 1 else (actions_chain[0] if actions_chain else "none")
                result_summary = " | ".join(results) if results else "No action executed"

                step_data = {
                    "step": step,
                    "reflection": parsed["reflection"],
                    "plan": parsed["plan"],
                    "action": action_summary,
                    "actions": actions_chain,
                    "result": result_summary,
                    "status": "completed" if is_finished else "in_progress",
                    "active_window": obs.active_window_title
                }
                self.history.append(step_data)

                if self.on_step_callback:
                    self.on_step_callback(step_data)

                if is_finished:
                    logger.info(f"Task completed successfully at step {step}: {result_summary}")
                    return {"success": True, "message": result_summary, "history": self.history}

                time.sleep(self.config.execution.action_delay)

            return {"success": False, "message": "Max steps reached", "history": self.history}
        finally:
            if use_ghost:
                stop_ai_ghost_cursor()
            set_ai_cursor(False)
