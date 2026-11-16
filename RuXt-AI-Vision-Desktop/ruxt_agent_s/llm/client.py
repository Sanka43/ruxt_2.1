import json
import logging
import os
from typing import Any, Dict, List, Optional
import httpx

logger = logging.getLogger("ruxt_agent_s.llm")

class MultiModalLLMClient:
    """
    Lightweight, robust multimodal API client supporting OpenAI, Anthropic, Gemini, Ollama, OpenRouter.
    Communicates directly via HTTP to eliminate SDK version conflict issues.
    """
    def __init__(
        self,
        provider: str = "openai",
        model: str = "gpt-4o",
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        timeout: float = 60.0
    ):
        self.provider = provider.lower()
        self.model = model
        self.api_key = api_key or ""
        self.base_url = base_url
        self.timeout = timeout
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
        if self.provider == "antigravity":
            return self._call_antigravity(system_prompt, user_prompt, image_base64)
        elif self.provider in ["openai", "openrouter", "ollama"]:
            return self._call_openai_compatible(system_prompt, user_prompt, image_base64)
        elif self.provider == "anthropic":
            return self._call_anthropic(system_prompt, user_prompt, image_base64)
        elif self.provider == "gemini":
            return self._call_gemini(system_prompt, user_prompt, image_base64)
        else:
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

            # Launch persistent daemon if not running
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

            # Stream JSON line to persistent daemon
            try:
                line_in = json.dumps(payload) + "\n"
                self._bridge_proc.stdin.write(line_in)
                self._bridge_proc.stdin.flush()

                # Read stdout lines until valid JSON response is received
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
                # If pipe broken, reset proc
                try:
                    self._bridge_proc.terminate()
                except Exception:
                    pass
                self._bridge_proc = None
                raise RuntimeError(f"Local Antigravity bridge communication error: {bridge_err}")

        raise RuntimeError("Local Google Antigravity bridge unavailable. Please ensure Antigravity IDE is running.")

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

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"
        headers = {"Content-Type": "application/json"}

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

        resp = self.http_client.post(url, headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()
        candidates = data.get("candidates", [])
        if candidates and "content" in candidates[0]:
            parts = candidates[0]["content"].get("parts", [])
            return "\n".join([p.get("text", "") for p in parts])
        return ""
