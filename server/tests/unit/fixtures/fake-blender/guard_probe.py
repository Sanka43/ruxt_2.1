"""Installs Omer's script guard on a temp folder, tries risky operations, prints one JSON result."""
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile

sys.path.insert(0, sys.argv[1])  # agents/omer-balika/mcp
import ruxt_script_guard as sandbox_guard  # noqa: E402

project = sys.argv[2]
outside = sys.argv[3]
os.makedirs(project, exist_ok=True)
os.makedirs(outside, exist_ok=True)
os.makedirs(os.path.join(project, "_tmp"), exist_ok=True)  # the caller points TEMP here, like blender_server.py does
victim = os.path.join(outside, "victim.txt")
open(victim, "w").write("keep me")
sandbox_guard.install([project])


def attempt(fn):
    try:
        fn()
        return "allowed"
    except PermissionError as exc:
        return "blocked" if "guard blocked" in str(exc) else f"other:{exc}"
    except Exception as exc:  # a different failure means the guard did not stop it
        return f"error:{type(exc).__name__}"


inside_file = os.path.join(project, "ok.txt")
results = {
    "write_inside": attempt(lambda: open(inside_file, "w").write("x")),
    "write_temp": attempt(lambda: open(os.path.join(tempfile.gettempdir(), "omer_guard_probe.tmp"), "w").write("x")),
    "write_real_system_temp": attempt(lambda: open(os.path.join(sys.argv[4], "omer_guard_probe.tmp"), "w").write("x")),
    "read_outside": attempt(lambda: open(victim).read()),
    "write_outside": attempt(lambda: open(os.path.join(outside, "new.txt"), "w").write("x")),
    "append_outside": attempt(lambda: open(victim, "a").write("x")),
    "delete_outside": attempt(lambda: os.remove(victim)),
    "rename_outside": attempt(lambda: os.rename(victim, victim + ".bak")),
    "rmtree_outside": attempt(lambda: shutil.rmtree(outside)),
    "traversal": attempt(lambda: open(os.path.join(project, "..", "escape.txt"), "w").write("x")),
    "subprocess": attempt(lambda: subprocess.run([sys.executable, "-c", "pass"])),
    "os_system": attempt(lambda: os.system("echo hi")),
    "network": attempt(lambda: socket.create_connection(("127.0.0.1", 9), timeout=1)),
    "delete_inside": attempt(lambda: os.remove(inside_file)),
}
results["victim_intact"] = open(victim).read() == "keep me" if os.path.exists(victim) else False
print(json.dumps(results))
