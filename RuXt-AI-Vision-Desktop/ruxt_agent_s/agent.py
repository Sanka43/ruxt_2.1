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
                endpoint=config.grounding.omniparser_endpoint
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

    def _parse_response(self, text: str) -> Dict[str, Any]:
        reflection = ""
        plan = ""
        action_str = ""

        ref_match = re.search(r"(?:Reflection|Thought):\s*(.*?)(?=\nPlan:|\nAction:|$)", text, re.DOTALL | re.IGNORECASE)
        if ref_match:
            reflection = ref_match.group(1).strip()

        plan_match = re.search(r"Plan:\s*(.*?)(?=\nAction:|$)", text, re.DOTALL | re.IGNORECASE)
        if plan_match:
            plan = plan_match.group(1).strip()

        action_match = re.search(r"Action:\s*(.*)", text, re.DOTALL | re.IGNORECASE)
        if action_match:
            raw_action = action_match.group(1).strip()
            first_line = raw_action.split("\n")[0].strip()
            if "(" in first_line and ")" in first_line:
                action_str = first_line
            else:
                action_str = raw_action
        else:
            # Fallback: search for agent.* or standard function calls
            call_match = re.search(
                r"((?:agent\.)?(?:click|double_click|right_click|type|press_key|hotkey|scroll|drag_and_drop|wait|launch|finish|click_control|focus_window|maximize_window|minimize_window|close_window)\(.*?\))",
                text,
                re.DOTALL | re.IGNORECASE
            )
            if call_match:
                action_str = call_match.group(1).strip()

        action_str = action_str.strip("`").strip()

        # Handle UI-TARS action syntax (e.g. click(start_box='(500, 300)'))
        if "start_box=" in action_str or "point=" in action_str:
            coords = self.grounder.extract_coordinates(action_str)
            if coords:
                action_str = f"agent.click(x={coords[0]}, y={coords[1]})"

        # Handle UI-TARS type(content='...')
        uitars_type = re.search(r"type\s*\(\s*(?:content|text)\s*=\s*['\"](.*?)['\"]\s*\)", action_str, re.IGNORECASE)
        if uitars_type:
            action_str = f'agent.type(text="{uitars_type.group(1)}")'

        if action_str and not action_str.startswith("agent."):
            valid_funcs = [
                "click", "double_click", "right_click", "type", "press_key", "hotkey",
                "scroll", "drag_and_drop", "wait", "launch", "finish",
                "click_control", "focus_window", "maximize_window", "minimize_window", "close_window"
            ]
            for vf in valid_funcs:
                if action_str.startswith(f"{vf}("):
                    action_str = f"agent.{action_str}"
                    break

        return {
            "reflection": reflection,
            "plan": plan,
            "action": action_str,
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

                px, py = None, None
                if box_id is not None and self.omniparser:
                    px, py = self.grounder.resolve_box_id(int(box_id)) or (None, None)
                elif x is not None and y is not None:
                    px, py = self.grounder.normalize_to_pixels(float(x), float(y))

                if px is not None and py is not None:
                    self.actions.click(px, py)
                    time.sleep(0.15)

                self.actions.type_text(str(text), clear_existing=clear_existing)
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

            else:
                return f"Unknown action: {func_name}"

        except Exception as e:
            logger.error(f"Error executing action {action_call}: {e}", exc_info=True)
            return f"Action execution error: {e}"

    def run_task(self, task: str) -> Dict[str, Any]:
        """
        Executes the autonomous loop:
        OBSERVE -> OMNIPARSER SOM TAG -> PLAN -> GROUND -> ACT -> VERIFY
        """
        logger.info(f"=== Starting RuXt Vision Task: '{task}' ===")
        self.history = []
        max_steps = self.config.agent.max_steps

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
                logger.info(f"--- Step {step}/{max_steps} ---")
                
                # 1. OBSERVE Screen
                obs = self.observer.capture(resize_for_model=False)
                
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
                user_prompt = format_worker_user_prompt(
                    task=task,
                    step_num=step,
                    max_steps=max_steps,
                    active_window=obs.active_window_title,
                    history=self.history,
                    som_summary=som_summary
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
                action_code = parsed["action"]

                # 4. ACT & GROUND
                action_result = self._execute_parsed_action(action_code)
                is_finished = "FINISH:" in action_result

                step_data = {
                    "step": step,
                    "reflection": parsed["reflection"],
                    "plan": parsed["plan"],
                    "action": action_code,
                    "result": action_result,
                    "status": "completed" if is_finished else "in_progress",
                    "active_window": obs.active_window_title
                }
                self.history.append(step_data)

                if self.on_step_callback:
                    self.on_step_callback(step_data)

                if is_finished:
                    logger.info(f"Task completed successfully at step {step}: {action_result}")
                    return {"success": True, "message": action_result, "history": self.history}

                time.sleep(self.config.execution.action_delay)

            return {"success": False, "message": "Max steps reached", "history": self.history}
        finally:
            if use_ghost:
                stop_ai_ghost_cursor()
            set_ai_cursor(False)
