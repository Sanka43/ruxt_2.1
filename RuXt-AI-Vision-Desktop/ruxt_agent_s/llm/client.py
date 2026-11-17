import json
import logging
import os
import re
from typing import Any, Dict, List, Optional
import httpx

logger = logging.getLogger("ruxt_agent_s.llm")

class MultiModalLLMClient:
    """
    Lightweight, robust multimodal API client supporting:
      - Anthropic Claude 3.5 & 3.7 Sonnet (Native Computer-Use tool protocol)
      - Google Gemini 3.5 Flash / Lite (Speed priority default)
      - ByteDance UI-TARS (via Ollama / vLLM / OpenRouter)
      - OpenAI GPT-4o / GPT-4o-mini
      - Local Antigravity Zero-API Bridge
    Communicates directly via HTTP to eliminate SDK version conflict issues.
    """
    def __init__(
        self,
        provider: str = "gemini",
        model: str = "gemini-3.5-flash",
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        timeout: float = 30.0,
        screen_size: tuple = (1280, 720)
    ):
        self.provider = provider.lower()
        self.model = model
        self.api_key = api_key or ""
        self.base_url = base_url
        self.timeout = timeout
        self.screen_width, self.screen_height = screen_size
        self.http_client = httpx.Client(timeout=timeout)
        self._bridge_proc = None

    def __del__(self):
        if self._bridge_proc and self._bridge_proc.poll() is None:
            try:
                self._bridge_proc.stdin.close()
                self._bridge_proc.terminate()
            except Exception:
                pass

    def generate(self, system_prompt: str, user_prompt: str, image_base64: str) -> str:
        """Sends multimodal vision query to the configured LLM provider."""
        # Clean data URL prefix if present
        raw_b64 = image_base64
        if "base64," in raw_b64:
            raw_b64 = raw_b64.split("base64,")[1]

        p = self.provider
        if p == "antigravity":
            return self._call_antigravity(system_prompt, user_prompt, raw_b64)
        elif p in ["openai", "openrouter", "ollama"]:
            return self._call_openai_compatible(system_prompt, user_prompt, raw_b64)
        elif p == "anthropic":
            # Check if Claude model should use native Anthropic Computer-Use
            if any(s in self.model.lower() for s in ["sonnet", "computer", "3-5", "3.5", "3-7", "3.7"]):
                try:
                    return self._call_anthropic_computer_use(system_prompt, user_prompt, raw_b64)
                except Exception as ce:
                    logger.warning(f"Claude Computer-Use call notice: {ce}, falling back to standard Claude vision")
            return self._call_anthropic(system_prompt, user_prompt, raw_b64)
        elif p in ["ui-tars", "uitars"]:
            return self._call_ui_tars(system_prompt, user_prompt, raw_b64)
        elif p == "gemini":
            return self._call_gemini(system_prompt, user_prompt, raw_b64)
        else:
            return self._call_gemini(system_prompt, user_prompt, raw_b64)

    # =========================================================================
    # Anthropic Claude 3.5 & Claude 3.7 Native Computer Use
    # =========================================================================

    def _call_anthropic_computer_use(self, system_prompt: str, user_prompt: str, image_base64: str) -> str:
        """
        Calls Anthropic Messages API with the official `computer_20241022` tool definition.
        Translates Anthropic tool_use outputs into standard RuXt agent actions.
        """
        url = self.base_url or "https://api.anthropic.com/v1/messages"
        headers = {
            "Content-Type": "application/json",
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "anthropic-beta": "computer-use-2024-10-22"
        }

        # Map model name
        m = self.model
        if "3.7" in m or "3-7" in m:
            claude_model = "claude-3-7-sonnet-20250219"
        else:
            claude_model = "claude-3-5-sonnet-20241022"

        tools = [
            {
                "type": "computer_20241022",
                "name": "computer",
                "display_width_px": self.screen_width,
                "display_height_px": self.screen_height
            }
        ]

        payload = {
            "model": claude_model,
            "max_tokens": 1024,
            "tools": tools,
            "system": system_prompt,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/jpeg",
                                "data": image_base64
                            }
                        },
                        {"type": "text", "text": user_prompt}
                    ]
                }
            ]
        }

        resp = self.http_client.post(url, headers=headers, json=payload, timeout=25.0)
        resp.raise_for_status()
        data = resp.json()

        # Parse Claude's content blocks (thought texts and tool_use)
        thoughts = []
        action_str = ""

        for block in data.get("content", []):
            b_type = block.get("type")
            if b_type == "text":
                thoughts.append(block.get("text", ""))
            elif b_type == "tool_use" and block.get("name") == "computer":
                inp = block.get("input", {})
                tool_action = inp.get("action", "")
                coord = inp.get("coordinate", [])
                text_val = inp.get("text", "")

                # Translate tool action to RuXt format:
                if tool_action == "left_click":
                    if coord and len(coord) == 2:
                        action_str = f"agent.click(x={coord[0]}, y={coord[1]})"
                    else:
                        action_str = "agent.click()"
                elif tool_action == "right_click":
                    if coord and len(coord) == 2:
                        action_str = f"agent.right_click(x={coord[0]}, y={coord[1]})"
                    else:
                        action_str = "agent.right_click()"
                elif tool_action == "double_click":
                    if coord and len(coord) == 2:
                        action_str = f"agent.double_click(x={coord[0]}, y={coord[1]})"
                    else:
                        action_str = "agent.double_click()"
                elif tool_action == "type":
                    action_str = f'agent.type(text="{text_val}")'
                elif tool_action == "key":
                    action_str = f'agent.press_key(key="{text_val}")'
                elif tool_action == "mouse_move" and coord and len(coord) == 2:
                    action_str = f"agent.move_to(x={coord[0]}, y={coord[1]})"
                elif tool_action == "cursor_position":
                    action_str = "agent.wait(seconds=1.0)"

        thought_text = " ".join(thoughts).strip()
        if not action_str:
            action_str = "agent.finish(message='Task completed by Claude')"

        return f"Reflection: {thought_text}\nPlan: Execute computer action via Claude\nAction: {action_str}"

    # =========================================================================
    # ByteDance UI-TARS Support
    # =========================================================================

    def _call_ui_tars(self, system_prompt: str, user_prompt: str, image_base64: str) -> str:
        """
        Calls UI-TARS model hosted via Ollama, vLLM, or OpenRouter.
        Supports native UI-TARS action syntax (click(start_box='(x, y)'), click(point='[x, y]')).
        """
        url = self.base_url or "http://localhost:11434/v1/chat/completions"
        if not url.endswith("/chat/completions"):
            url = url.rstrip("/") + "/chat/completions"

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}" if self.api_key else ""
        }

        # UI-TARS specific system format
        uitars_system = (
            "You are a GUI agent. Given a screenshot and instruction, "
            "output Thought: ... and Action: click(start_box='(x, y)') or type(content='...')."
        )

        messages = [
            {"role": "system", "content": uitars_system},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": user_prompt},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"}
                    }
                ]
            }
        ]

        payload = {
            "model": self.model or "ui-tars-7b",
            "messages": messages,
            "max_tokens": 512,
            "temperature": 0.0
        }

        resp = self.http_client.post(url, headers=headers, json=payload, timeout=25.0)
        resp.raise_for_status()
        data = resp.json()
        raw_content = data["choices"][0]["message"]["content"]
        return raw_content

    # =========================================================================
    # Standard OpenAI, Anthropic, Gemini, Antigravity Implementations
    # =========================================================================

    def _call_openai_compatible(self, system_prompt: str, user_prompt: str, image_base64: str) -> str:
        url = self.base_url or "https://api.openai.com/v1"
        if not url.endswith("/chat/completions"):
            url = url.rstrip("/") + "/chat/completions"

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}" if self.api_key else ""
        }

        messages = [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": user_prompt},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"}
                    }
                ]
            }
        ]

        payload = {
            "model": self.model,
            "messages": messages,
            "max_tokens": 1024,
            "temperature": 0.1
        }

        resp = self.http_client.post(url, headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]

    def _call_anthropic(self, system_prompt: str, user_prompt: str, image_base64: str) -> str:
        url = self.base_url or "https://api.anthropic.com/v1/messages"
        headers = {
            "Content-Type": "application/json",
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01"
        }

        payload = {
            "model": self.model,
            "system": system_prompt,
            "max_tokens": 1024,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/jpeg",
                                "data": image_base64
                            }
                        },
                        {"type": "text", "text": user_prompt}
                    ]
                }
            ]
        }

        resp = self.http_client.post(url, headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()
        text_blocks = [b["text"] for b in data.get("content", []) if b.get("type") == "text"]
        return "\n".join(text_blocks)

    def _call_gemini(self, system_prompt: str, user_prompt: str, image_base64: str) -> str:
        # Check if OpenAI compatibility endpoint is used for Gemini
        if self.base_url and "v1" in self.base_url:
            return self._call_openai_compatible(system_prompt, user_prompt, image_base64)

        model_name = self.model or "gemini-3.5-flash"
        if model_name in ["flash", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-2.5-flash"]:
            model_name = "gemini-3.5-flash"

        payload = {
            "system_instruction": {"parts": [{"text": system_prompt}]},
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {"text": user_prompt},
                        {
                            "inline_data": {
                                "mime_type": "image/jpeg",
                                "data": image_base64
                            }
                        }
                    ]
                }
            ],
            "generationConfig": {"temperature": 0.1, "maxOutputTokens": 1024}
        }
        headers = {"Content-Type": "application/json"}

        # Try models with snappy 8s timeout, then fall back
        models_to_try = [model_name]
        if model_name != "gemini-3.5-flash-lite":
            models_to_try.append("gemini-3.5-flash-lite")

        for attempt_model in models_to_try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{attempt_model}:generateContent?key={self.api_key}"
            try:
                resp = self.http_client.post(url, headers=headers, json=payload, timeout=8.0)
                if resp.status_code == 200:
                    data = resp.json()
                    candidates = data.get("candidates", [])
                    if candidates and "content" in candidates[0]:
                        parts = candidates[0]["content"].get("parts", [])
                        return "\n".join([p.get("text", "") for p in parts])
                else:
                    logger.warning(f"Gemini model {attempt_model} returned HTTP {resp.status_code}: {resp.text[:150]}")
            except Exception as ex:
                logger.warning(f"Gemini model {attempt_model} connection exception: {ex}")

        # If all direct Gemini cloud calls fail, fallback to local Antigravity ACP bridge
        logger.warning("All direct Gemini API models unavailable. Gracefully falling back to Antigravity ACP...")
        return self._call_antigravity(system_prompt, user_prompt, image_base64)

    def _call_antigravity(self, system_prompt: str, user_prompt: str, image_base64: str) -> str:
        server_port = os.getenv("PORT", "1234")
        api_url = f"http://localhost:{server_port}/api/desktop/vision-prompt"
        payload = {
            "systemPrompt": system_prompt,
            "system": system_prompt,
            "userPrompt": user_prompt,
            "prompt": user_prompt,
            "imageBase64": image_base64,
            "image": image_base64,
            "model": self.model or "flash"
        }
        # 1. Fast Path: Local RuXt HTTP API with persistent warm ACP connection
        try:
            resp = self.http_client.post(api_url, json=payload, timeout=20.0)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("success") and data.get("content"):
                    return data["content"]
        except Exception:
            pass

        # 2. Standalone Daemon Fallback: Persistent Node antigravityBridgeCli.js process
        root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        local_app = os.environ.get("LOCALAPPDATA", "")
        candidates = [
            os.path.join(root_dir, "server", "services", "antigravityBridgeCli.js"),
            os.path.join(root_dir, "resources", "app.asar.unpacked", "server", "services", "antigravityBridgeCli.js"),
            os.path.join(root_dir, "app.asar.unpacked", "server", "services", "antigravityBridgeCli.js"),
            os.path.join(local_app, "Programs", "RuXt AI Studio", "resources", "app.asar.unpacked", "server", "services", "antigravityBridgeCli.js"),
            r"C:\xampp\htdocs\ruxt_2.1\server\services\antigravityBridgeCli.js",
        ]
        bridge_script = next((c for c in candidates if os.path.exists(c)), None)
        if bridge_script:
            import subprocess
            import shutil

            if self._bridge_proc is None or self._bridge_proc.poll() is not None:
                node_candidates = [
                    shutil.which("node"),
                    os.path.join(local_app, "nodejs-lts", "node-v24.19.0-win-x64", "node.exe"),
                    r"C:\Program Files\nodejs\node.exe",
                    r"C:\Program Files (x86)\nodejs\node.exe",
                    "node"
                ]
                node_bin = next((n for n in node_candidates if n and os.path.exists(n)), "node")
                self._bridge_proc = subprocess.Popen(
                    [node_bin, bridge_script],
                    stdin=subprocess.PIPE,
                    stdout=subprocess.PIPE,
                    stderr=None,
                    text=True,
                    encoding="utf-8",
                    bufsize=1
                )

            try:
                line_in = json.dumps(payload) + "\n"
                self._bridge_proc.stdin.write(line_in)
                self._bridge_proc.stdin.flush()

                while True:
                    resp_line = self._bridge_proc.stdout.readline()
                    if not resp_line:
                        break
                    trimmed_line = resp_line.strip()
                    if trimmed_line.startswith("{") and trimmed_line.endswith("}"):
                        try:
                            res_obj = json.loads(trimmed_line)
                            if "success" in res_obj:
                                if res_obj.get("success") and res_obj.get("content"):
                                    return res_obj["content"]
                                elif res_obj.get("error"):
                                    raise RuntimeError(res_obj["error"])
                        except json.JSONDecodeError:
                            continue
                raise RuntimeError("Bridge stdout closed without returning JSON result")
            except Exception as bridge_err:
                try:
                    self._bridge_proc.terminate()
                except Exception:
                    pass
                self._bridge_proc = None
                raise RuntimeError(f"Local Antigravity bridge communication error: {bridge_err}")

        raise RuntimeError("Local Google Antigravity bridge unavailable. Please ensure Antigravity IDE is running.")
