"""RuXt agent kit: the shared part of every app-controlling MCP server.

An agent package copies this file next to its own server (the scaffolder does that) so the package
stays self-contained. The app-specific server only has to say how to find the app and what its tools do:

    from ruxt_mcp_base import McpServer, Workspace, ToolError, run_process

    server = McpServer("my-agent-app", "0.1.0")
    workspace = Workspace("excel")            # <workspace>/outputs/excel-projects/<project_id>/

    @server.tool("app_status", "Is the app installed?", {})
    def app_status(args): ...

    server.serve()

What this file provides (so no agent re-implements it):
  - the stdio JSON-RPC 2.0 loop of the Model Context Protocol
  - a project workspace with strict id and file-name checks (no traversal, no folders in names)
  - bounded numbers, output tails, a process runner with timeout
Handlers return a dict. {"ok": False, ...} is reported to the model as a tool error unless the dict
also has "_soft": True (a negative answer such as "file is not valid", which is a normal result).
"""

import argparse
import json
import os
import re
import secrets
import subprocess
import sys
from pathlib import Path

PROJECT_ID_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,63}$")
TAIL_CHARS = 4000


class ToolError(Exception):
    """A problem the caller can fix; reported as a tool error and never crashes the server."""


def tail(text, limit=TAIL_CHARS):
    text = (text or "").strip()
    return text if len(text) <= limit else "..." + text[-limit:]


def bounded_int(value, default, low, high, name):
    if value is None:
        return default
    if isinstance(value, bool) or not isinstance(value, int) or not low <= value <= high:
        raise ToolError(f"{name} must be a whole number from {low} to {high}.")
    return value


def failure(message, proc=None, timed_out=False):
    out = {"ok": False, "error": message}
    if proc is not None and not timed_out:
        out["exit_code"] = proc.returncode
        out["stderr_tail"] = tail(proc.stderr)
        out["stdout_tail"] = tail(proc.stdout)
    return out


def run_process(cmd, env_extra=None, timeout=120, cwd=None):
    """Run a program, capture text output. Returns (CompletedProcess, False) or (TimeoutExpired, True)."""
    env = {**os.environ, **(env_extra or {})}
    try:
        proc = subprocess.run(
            cmd, capture_output=True, text=True, encoding="utf-8", errors="replace",
            timeout=timeout, env=env, cwd=cwd,
        )
        return proc, False
    except subprocess.TimeoutExpired as exc:
        return exc, True


class Workspace:
    """Where an agent keeps its work: <workspace>/outputs/<app>-projects/<project_id>/"""

    def __init__(self, app, argv=None):
        parser = argparse.ArgumentParser(add_help=False)
        parser.add_argument("--workspace")
        known, _ = parser.parse_known_args(argv)
        value = known.workspace or os.environ.get("RUXT_WORKSPACE") or ""
        if not value or "${" in value:  # an unexpanded ${workspace} placeholder means "not provided"
            value = str(Path.home() / ".ruxt" / "workspace")
        self.root = Path(value) / "outputs" / f"{app}-projects"

    def project_dir(self, project_id, must_exist=True):
        if not isinstance(project_id, str) or not PROJECT_ID_RE.match(project_id):
            raise ToolError("project_id must be lowercase letters, digits, '-' or '_' (max 64 chars).")
        path = self.root / project_id
        if must_exist and not path.is_dir():
            raise ToolError(f"Project '{project_id}' does not exist. Call create_project first.")
        return path

    def file_path(self, project_id, filename, name_re, must_exist=True, what="file"):
        """A file directly inside a project. `name_re` decides which plain names are allowed."""
        if not isinstance(filename, str) or not name_re.match(filename):
            raise ToolError(f"{what} must be a plain file name of the right type (no folders).")
        path = self.project_dir(project_id) / filename
        if must_exist and not path.is_file():
            raise ToolError(f"{filename} was not found in project '{project_id}'.")
        return path

    def create_project(self, name):
        slug = re.sub(r"[^a-z0-9]+", "-", str(name or "project").lower()).strip("-")[:40] or "project"
        project_id = f"{slug}-{secrets.token_hex(3)}"
        path = self.root / project_id
        path.mkdir(parents=True, exist_ok=False)
        return project_id, path

    def list_projects(self, pattern="*"):
        projects = []
        if self.root.is_dir():
            for entry in sorted(self.root.iterdir()):
                if entry.is_dir() and PROJECT_ID_RE.match(entry.name):
                    projects.append({"project_id": entry.name, "files": sorted(f.name for f in entry.glob(pattern))})
        return projects

    def rel(self, path):
        return Path(path).relative_to(self.root).as_posix()


def schema(properties, required=()):
    return {"type": "object", "properties": properties, "required": list(required)}


class McpServer:
    def __init__(self, name, version="0.1.0"):
        self.name = name
        self.version = version
        self.tools = {}

    def tool(self, name, description, properties=None, required=()):
        def register(handler):
            self.tools[name] = {"description": description, "inputSchema": schema(properties or {}, required), "handler": handler}
            return handler
        return register

    # -- JSON-RPC ---------------------------------------------------------

    @staticmethod
    def _send(obj):
        sys.stdout.write(json.dumps(obj) + "\n")
        sys.stdout.flush()

    def _call(self, msg_id, params):
        tool = self.tools.get(params.get("name"))
        if tool is None:
            self._send({"jsonrpc": "2.0", "id": msg_id, "error": {"code": -32602, "message": f"Unknown tool {params.get('name')}"}})
            return
        try:
            result = tool["handler"](params.get("arguments") or {})
            soft = isinstance(result, dict) and result.pop("_soft", False)
            body = {"content": [{"type": "text", "text": json.dumps(result)}]}
            if isinstance(result, dict) and result.get("ok") is False and not soft:
                body["isError"] = True
            self._send({"jsonrpc": "2.0", "id": msg_id, "result": body})
        except ToolError as exc:
            self._send({"jsonrpc": "2.0", "id": msg_id, "result": {"isError": True, "content": [{"type": "text", "text": str(exc)}]}})
        except Exception as exc:  # report, never crash the server
            self._send({"jsonrpc": "2.0", "id": msg_id, "result": {"isError": True, "content": [{"type": "text", "text": f"{type(exc).__name__}: {exc}"}]}})

    def _handle(self, msg):
        method, msg_id = msg.get("method"), msg.get("id")
        if method == "initialize":
            self._send({"jsonrpc": "2.0", "id": msg_id, "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": {"tools": {}},
                "serverInfo": {"name": self.name, "version": self.version},
            }})
        elif method == "tools/list":
            tools = [{"name": n, "description": t["description"], "inputSchema": t["inputSchema"]} for n, t in self.tools.items()]
            self._send({"jsonrpc": "2.0", "id": msg_id, "result": {"tools": tools}})
        elif method == "tools/call":
            self._call(msg_id, msg.get("params") or {})
        elif msg_id is not None:  # unknown request; notifications (no id) are ignored
            self._send({"jsonrpc": "2.0", "id": msg_id, "error": {"code": -32601, "message": f"Method not found: {method}"}})

    def serve(self):
        """Handle requests one at a time, so an app is never driven by two calls at once."""
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue
            try:
                self._handle(json.loads(line))
            except json.JSONDecodeError:
                continue
