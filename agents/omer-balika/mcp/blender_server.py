"""Omer Balika - Blender MCP server.

Everything generic (JSON-RPC loop, project folders, path checks, process runner) comes from
ruxt_mcp_base.py. This file only knows Blender: where it is, how to start it headless, and the tools.

Headless mode: every tool starts `blender --background`, so no Blender window is needed.
Projects live in <workspace>/outputs/blender-projects/<project_id>/ and nothing outside that folder
is read or written by these tools.
"""

import json
import os
import re
import secrets
import shutil
import subprocess
import time
from pathlib import Path

from ruxt_mcp_base import McpServer, ToolError, Workspace, bounded_int, failure, run_process, tail

HERE = Path(__file__).resolve().parent
SCRIPTS = HERE / "blender_scripts"

BLEND_NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9 _.-]{0,100}\.blend$")
PNG_NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9 _.-]{0,100}\.png$")
ENGINES = {"CYCLES", "BLENDER_EEVEE", "BLENDER_EEVEE_NEXT", "BLENDER_WORKBENCH"}
MAX_SCRIPT_BYTES = 200_000

server = McpServer("omer-balika-blender", "0.3.0")
workspace = Workspace("blender")


# ---------------------------------------------------------------- Blender specifics

def find_blender():
    """Blender executable on this PC, or None. Same order as the manifest's app.detect."""
    env = os.environ.get("BLENDER_BIN")
    if env and Path(env).is_file():
        return env
    for root_var, sub in (("ProgramFiles", "Blender Foundation"), ("LOCALAPPDATA", "Programs/Blender Foundation")):
        root = os.environ.get(root_var)
        if not root:
            continue
        base = Path(root) / sub
        if base.is_dir():
            for folder in sorted(base.iterdir(), reverse=True):
                exe = folder / "blender.exe"
                if exe.is_file():
                    return str(exe)
    return shutil.which("blender") or shutil.which("blender.exe")


def require_blender():
    exe = find_blender()
    if not exe:
        raise ToolError("Blender was not found. Install it from blender.org or set BLENDER_BIN.")
    return exe


def run_blender(args, env_extra=None, timeout=120):
    return run_process([require_blender(), "--background", "--factory-startup", *args], env_extra=env_extra, timeout=timeout)


def blend_file(project_id, filename, must_exist=True):
    return workspace.file_path(project_id, filename, BLEND_NAME_RE, must_exist, what="file (a .blend)")


def parse_json_line(stdout):
    for line in reversed((stdout or "").splitlines()):
        if line.startswith("RUXT_JSON:"):
            return json.loads(line[len("RUXT_JSON:"):])
    return None


PID = {"type": "string", "description": "Project id returned by create_project"}
FILE = {"type": "string", "description": "A .blend file name inside the project, e.g. scene.blend"}


# ---------------------------------------------------------------- tools

@server.tool("app_status", "Check whether Blender is installed on this PC, its version, and where projects are stored.")
def app_status(_args):
    exe = find_blender()
    version = None
    if exe:
        try:
            out = subprocess.run([exe, "--version"], capture_output=True, text=True, timeout=30, errors="replace").stdout
            version = (out.strip().splitlines() or [None])[0]
        except (OSError, subprocess.SubprocessError):
            pass
    return {"installed": exe is not None, "bin": exe, "version": version, "projects_root": str(workspace.root)}


@server.tool("create_project", "Create a new project folder under outputs/blender-projects and return its project_id.",
             {"name": {"type": "string", "description": "Short human name, e.g. 'low poly car'"}})
def create_project(args):
    project_id, path = workspace.create_project(args.get("name"))
    return {"ok": True, "project_id": project_id, "dir": str(path)}


@server.tool("list_projects", "List existing projects and the .blend files in each.")
def list_projects(_args):
    return {"ok": True, "projects": [{"project_id": p["project_id"], "blend_files": p["files"]} for p in workspace.list_projects("*.blend")]}


@server.tool(
    "run_script",
    "Run a Blender Python (bpy) script headless inside a project. Without open_file it starts from an empty scene "
    "(no default cube, camera or light). Set save_as to save the result as a .blend. The script may only write "
    "inside the project folder and cannot start programs or use the network.",
    {
        "project_id": PID,
        "script": {"type": "string", "description": "Blender Python source to execute"},
        "open_file": {**FILE, "description": "Existing .blend in the project to open first (keeps its content)"},
        "save_as": {**FILE, "description": ".blend file name to save to after the script succeeds"},
        "timeout_s": {"type": "integer", "description": "5-900, default 120"},
    },
    ["project_id", "script"],
)
def run_script(args):
    project_id = args.get("project_id")
    script = args.get("script")
    pdir = workspace.project_dir(project_id)
    if not isinstance(script, str) or not script.strip():
        raise ToolError("script (Blender Python) is required.")
    if len(script.encode("utf-8")) > MAX_SCRIPT_BYTES:
        raise ToolError(f"script is larger than {MAX_SCRIPT_BYTES} bytes; split it into stages.")
    timeout = bounded_int(args.get("timeout_s"), 120, 5, 900, "timeout_s")

    open_file = args.get("open_file")
    save_as = args.get("save_as")
    blend_args = [str(blend_file(project_id, open_file))] if open_file else []
    save_path = blend_file(project_id, save_as, must_exist=False) if save_as else None

    runs = pdir / "_runs"
    runs.mkdir(exist_ok=True)
    script_path = runs / f"{time.strftime('%Y%m%d-%H%M%S')}-{secrets.token_hex(2)}.py"
    script_path.write_text(script, encoding="utf-8")  # kept as an audit trail of what ran

    before = {p.name for p in pdir.iterdir()}
    # Temp files of the run go inside the project so the guard can keep the system temp folder closed
    tmp_dir = pdir / "_tmp"
    tmp_dir.mkdir(exist_ok=True)
    env = {
        "TEMP": str(tmp_dir), "TMP": str(tmp_dir), "TMPDIR": str(tmp_dir),
        "RUXT_PROJECT_DIR": str(pdir),
        "RUXT_SCRIPT": str(script_path),
        "RUXT_EMPTY": "0" if open_file else "1",
        "RUXT_SAVE_AS": str(save_path) if save_path else "",
    }
    proc, timed_out = run_blender(
        ["--disable-autoexec", *blend_args, "--python-exit-code", "1", "--python", str(SCRIPTS / "run_wrapper.py")],
        env_extra=env, timeout=timeout,
    )
    shutil.rmtree(tmp_dir, ignore_errors=True)
    if timed_out:
        return failure(f"Blender did not finish within {timeout}s and was stopped.")
    if proc.returncode != 0:
        return failure("The script failed.", proc)

    result = {
        "ok": True,
        "exit_code": 0,
        "stdout_tail": tail(proc.stdout),
        "script_log": workspace.rel(script_path),
        "new_files": sorted(p.name for p in pdir.iterdir() if p.name not in before and p.name != "_tmp"),
    }
    if save_path:
        if save_path.is_file() and save_path.stat().st_size > 0:
            result["saved_file"] = save_path.name
        else:
            return failure(f"The script finished but {save_path.name} was not saved.", proc)
    return result


@server.tool("scene_info", "Read a saved .blend and return its objects, materials, cameras, lights, frame range and render settings.",
             {"project_id": PID, "file": FILE}, ["project_id", "file"])
def scene_info(args):
    path = blend_file(args.get("project_id"), args.get("file"))
    proc, timed_out = run_blender(
        ["--disable-autoexec", str(path), "--python-exit-code", "1", "--python", str(SCRIPTS / "scene_info.py")], timeout=60,
    )
    if timed_out:
        return failure("Blender did not finish reading the file within 60s.")
    if proc.returncode != 0:
        return failure("Blender could not open the file.", proc)
    info = parse_json_line(proc.stdout)
    if info is None:
        return failure("Blender ran but returned no scene data.", proc)
    return {"ok": True, "file": path.name, "scene": info}


@server.tool(
    "render_preview",
    "Render one still frame of a .blend to a PNG in the project's previews folder.",
    {
        "project_id": PID, "file": FILE,
        "frame": {"type": "integer", "description": "Frame number, default the scene's start frame"},
        "resolution_percentage": {"type": "integer", "description": "10-100, default 50"},
        "engine": {"type": "string", "enum": sorted(ENGINES), "description": "Override the render engine"},
        "output_name": {"type": "string", "description": "PNG file name, default <file>-preview.png"},
        "timeout_s": {"type": "integer", "description": "10-900, default 300"},
    },
    ["project_id", "file"],
)
def render_preview(args):
    path = blend_file(args.get("project_id"), args.get("file"))
    percent = bounded_int(args.get("resolution_percentage"), 50, 10, 100, "resolution_percentage")
    frame = bounded_int(args.get("frame"), None, 0, 1_000_000, "frame")
    timeout = bounded_int(args.get("timeout_s"), 300, 10, 900, "timeout_s")
    engine = args.get("engine")
    if engine is not None and engine not in ENGINES:
        raise ToolError(f"engine must be one of {sorted(ENGINES)}.")
    out_name = args.get("output_name") or f"{path.stem}-preview.png"
    if not PNG_NAME_RE.match(out_name):
        raise ToolError("output_name must be a plain name ending in .png.")
    previews = path.parent / "previews"
    previews.mkdir(exist_ok=True)
    out_path = previews / out_name

    env = {"RUXT_RENDER_OUT": str(out_path), "RUXT_PERCENT": str(percent), "RUXT_ENGINE": engine or ""}
    if frame is not None:
        env["RUXT_FRAME"] = str(frame)
    proc, timed_out = run_blender(
        ["--disable-autoexec", str(path), "--python-exit-code", "1", "--python", str(SCRIPTS / "render_preview.py")],
        env_extra=env, timeout=timeout,
    )
    if timed_out:
        return failure(f"Rendering did not finish within {timeout}s and was stopped.")
    if proc.returncode != 0:
        return failure("Rendering failed.", proc)
    if not out_path.is_file() or out_path.stat().st_size == 0:
        return failure("Blender finished but no preview image was written.", proc)
    return {"ok": True, "preview": workspace.rel(out_path), "bytes": out_path.stat().st_size}


@server.tool("validate_output",
             "Check that a saved .blend exists, has a valid Blender header and loads. Call this before telling the user the work is done.",
             {"project_id": PID, "file": FILE}, ["project_id", "file"])
def validate_output(args):
    path = blend_file(args.get("project_id"), args.get("file"), must_exist=False)
    if not path.is_file():
        return {"ok": False, "valid": False, "message": f"{path.name} does not exist.", "_soft": True}
    size = path.stat().st_size
    with open(path, "rb") as fh:
        head = fh.read(7)
    # .blend files start with "BLENDER"; compressed ones start with a gzip or zstd signature
    looks_like_blend = head == b"BLENDER" or head[:2] == b"\x1f\x8b" or head[:4] == b"\x28\xb5\x2f\xfd"
    if size == 0 or not looks_like_blend:
        return {"ok": False, "valid": False, "message": f"{path.name} is not a Blender file.", "_soft": True}
    info = scene_info(args)
    if not info.get("ok"):
        return {"ok": False, "valid": False, "message": "Blender could not load the file.", "detail": info, "_soft": True}
    return {"ok": True, "valid": True, "file": path.name, "bytes": size, "object_count": len(info["scene"]["objects"])}


@server.tool("open_in_blender", "Open a saved .blend in a visible Blender window for the user.",
             {"project_id": PID, "file": FILE}, ["project_id", "file"])
def open_in_blender(args):
    path = blend_file(args.get("project_id"), args.get("file"))
    exe = require_blender()
    flags = 0
    if os.name == "nt":
        flags = subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP
    subprocess.Popen([exe, "--disable-autoexec", str(path)], creationflags=flags,
                     stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return {"ok": True, "opened": path.name}


if __name__ == "__main__":
    server.serve()
