import ast
import json
import logging
import re
import time
from typing import Any, Callable, Dict, List, Optional

from .config import AppConfig
from .core.actions import DesktopActionExecutor
from .core.cursor import set_ai_cursor
from .core.ai_ghost_cursor import get_ai_ghost_cursor, stop_ai_ghost_cursor
from .core.grounding import VisualGrounder
from .core.observation import ScreenObserver, ScreenState
from .core.uia_grounding import WindowsUIAGrounder
from .llm.client import MultiModalLLMClient
from .llm.prompts import SYSTEM_PROMPT, format_worker_user_prompt

logger = logging.getLogger("ruxt_agent_s.agent")

class RuXtVisionAgent:
    """
    Autonomous Vision-Based Desktop Control Agent for RuXt.
    Combines Multimodal Vision Planning, UIA Grounding, and Action Verification.
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
            failsafe=config.execution.failsafe
        )
        
        self.grounder = VisualGrounder(
            screen_width=screen_w,
            screen_height=screen_h,
            coordinate_scale=config.grounding.coordinate_scale
        )
        
        self.uia_grounder = WindowsUIAGrounder() if config.grounding.use_uia_tree else None
        
        self.llm = MultiModalLLMClient(
            provider=config.provider,
            model=config.model,
            api_key=config.api_key,
            base_url=config.base_url
        )

        self.history: List[Dict[str, Any]] = []

    def _parse_response(self, text: str) -> Dict[str, Any]:
        reflection = ""
        plan = ""
        action_str = ""

        ref_match = re.search(r"Reflection:\s*(.*?)(?=\nPlan:|\nAction:|$)", text, re.DOTALL | re.IGNORECASE)
        if ref_match:
            reflection = ref_match.group(1).strip()

        plan_match = re.search(r"Plan:\s*(.*?)(?=\nAction:|$)", text, re.DOTALL | re.IGNORECASE)
        if plan_match:
            plan = plan_match.group(1).strip()

        action_match = re.search(r"Action:\s*(.*)", text, re.DOTALL | re.IGNORECASE)
        if action_match:
            action_str = action_match.group(1).strip()
        else:
            # Fallback: search for agent.* pattern
            call_match = re.search(r"(agent\.\w+\(.*?\))", text, re.DOTALL)
            if call_match:
                action_str = call_match.group(1).strip()

        return {
            "reflection": reflection,
            "plan": plan,
            "action": action_str,
            "raw": text
        }

    def _execute_parsed_action(self, action_call: str) -> str:
        if not action_call or not action_call.startswith("agent."):
            return "No valid agent action parsed"

        try:
            # Parse python AST
            tree = ast.parse(action_call)
            expr = tree.body[0]
            if not isinstance(expr, ast.Expr) or not isinstance(expr.value, ast.Call):
                return "Invalid call format"

            call = expr.value
            func_name = call.func.attr if isinstance(call.func, ast.Attribute) else ""

            # Extract arguments
            kwargs = {}
            for kw in call.keywords:
                kwargs[kw.arg] = ast.literal_eval(kw.value)

            args = [ast.literal_eval(arg) for arg in call.args]

            logger.info(f"Executing: func={func_name} args={args} kwargs={kwargs}")

            if func_name == "click":
                x = kwargs.get("x", args[0] if len(args) > 0 else None)
                y = kwargs.get("y", args[1] if len(args) > 1 else None)
                desc = kwargs.get("description", "")
                button = kwargs.get("button", "left")
                clicks = kwargs.get("clicks", 1)

                px, py = None, None
                # Try UIA grounding first if description is present
                if desc and self.uia_grounder:
                    uia_coords = self.uia_grounder.find_element_bounds(desc)
                    if uia_coords:
                        px, py = uia_coords

                if px is None and x is not None and y is not None:
                    px, py = self.grounder.normalize_to_pixels(float(x), float(y))

                if px is not None and py is not None:
                    self.actions.click(px, py, button=button, clicks=clicks)
                    return f"Clicked at ({px}, {py})"
                return f"Failed to ground click coordinates for {desc}"

            elif func_name == "double_click":
                x = kwargs.get("x", args[0] if len(args) > 0 else None)
                y = kwargs.get("y", args[1] if len(args) > 1 else None)
                if x is not None and y is not None:
                    px, py = self.grounder.normalize_to_pixels(float(x), float(y))
                    self.actions.double_click(px, py)
                    return f"Double-clicked at ({px}, {py})"
                return "Missing coordinates for double_click"

            elif func_name == "right_click":
                x = kwargs.get("x", args[0] if len(args) > 0 else None)
                y = kwargs.get("y", args[1] if len(args) > 1 else None)
                if x is not None and y is not None:
                    px, py = self.grounder.normalize_to_pixels(float(x), float(y))
                    self.actions.right_click(px, py)
                    return f"Right-clicked at ({px}, {py})"
                return "Missing coordinates for right_click"

            elif func_name == "type":
                text = kwargs.get("text", args[0] if len(args) > 0 else "")
                x = kwargs.get("x", None)
                y = kwargs.get("y", None)
                clear_existing = kwargs.get("clear_existing", False)
                if x is not None and y is not None:
                    px, py = self.grounder.normalize_to_pixels(float(x), float(y))
                    self.actions.click(px, py)
                    time.sleep(0.2)
                self.actions.type_text(text, clear_existing=clear_existing)
                return f"Typed text: '{text[:20]}...'"

            elif func_name == "press_key":
                key = kwargs.get("key", args[0] if len(args) > 0 else "")
                self.actions.press_key(key)
                return f"Pressed key '{key}'"

            elif func_name == "hotkey":
                keys = kwargs.get("keys", args[0] if len(args) > 0 else [])
                self.actions.hotkey(keys)
                return f"Pressed hotkey {'+'.join(keys)}"

            elif func_name == "drag_and_drop":
                fx = kwargs.get("from_x", args[0] if len(args) > 0 else 0)
                fy = kwargs.get("from_y", args[1] if len(args) > 1 else 0)
                tx = kwargs.get("to_x", args[2] if len(args) > 2 else 0)
                ty = kwargs.get("to_y", args[3] if len(args) > 3 else 0)
                pfx, pfy = self.grounder.normalize_to_pixels(float(fx), float(fy))
                ptx, pty = self.grounder.normalize_to_pixels(float(tx), float(ty))
                self.actions.drag_and_drop(pfx, pfy, ptx, pty)
                return f"Dragged from ({pfx}, {pfy}) to ({ptx}, {pty})"

            elif func_name == "scroll":
                amount = kwargs.get("amount", args[0] if len(args) > 0 else -300)
                x = kwargs.get("x", None)
                y = kwargs.get("y", None)
                px, py = (None, None)
                if x is not None and y is not None:
                    px, py = self.grounder.normalize_to_pixels(float(x), float(y))
                self.actions.scroll(amount, px, py)
                return f"Scrolled {amount}"

            elif func_name == "wait":
                secs = kwargs.get("seconds", args[0] if len(args) > 0 else 2.0)
                self.actions.wait(float(secs))
                return f"Waited {secs} seconds"

            elif func_name == "launch":
                app_name = kwargs.get("app_name", args[0] if len(args) > 0 else "")
                self.actions.launch_app(app_name)
                return f"Launched {app_name}"

            elif func_name == "finish":
                msg = kwargs.get("message", "Task finished")
                return f"FINISH: {msg}"

            else:
                return f"Unknown action: {func_name}"

        except Exception as e:
            logger.error(f"Error parsing/executing action {action_call}: {e}", exc_info=True)
            return f"Action execution error: {e}"

    def run_task(self, task: str) -> Dict[str, Any]:
        """
        Executes the autonomous loop:
        OBSERVE -> PLAN -> GROUND -> ACT -> VERIFY
        """
        logger.info(f"=== Starting RuXt Vision Task: '{task}' ===")
        self.history = []
        max_steps = self.config.agent.max_steps

        # Visually indicate AI desktop control by launching independent Ghost Cursor
        ghost = get_ai_ghost_cursor()
        ghost.start()
        ghost.show(True)
        try:
            for step in range(1, max_steps + 1):
                logger.info(f"--- Step {step}/{max_steps} ---")
                
                # 1. OBSERVE
                obs = self.observer.capture(resize_for_model=True)
                
                # 2. PROMPT & PLAN
                user_prompt = format_worker_user_prompt(
                    task=task,
                    step_num=step,
                    max_steps=max_steps,
                    active_window=obs.active_window_title,
                    history=self.history
                )

                try:
                    llm_response = self.llm.generate(
                        system_prompt=SYSTEM_PROMPT,
                        user_prompt=user_prompt,
                        image_base64=obs.image_base64
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

                # 3. ACT & GROUND
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
            stop_ai_ghost_cursor()
            set_ai_cursor(False)
