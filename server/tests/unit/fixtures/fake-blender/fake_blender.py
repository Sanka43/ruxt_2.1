"""Stand-in for blender.exe used by tests. Understands only what Omer's server passes:
--background --factory-startup --disable-autoexec [file.blend] --python-exit-code N --python script.py, and --version.
A fake `bpy` module (./bpy) provides just enough API for Omer's scripts. Real Blender is NOT exercised.
"""
import runpy
import sys
import traceback
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
args = sys.argv[1:]

if "--version" in args:
    print("Blender 4.2.0 (fake test double)")
    sys.exit(0)

blend = script = None
i = 0
while i < len(args):
    a = args[i]
    if a == "--python":
        script = args[i + 1]
        i += 2
    elif a == "--python-exit-code":
        i += 2
    elif a.startswith("-"):
        i += 1
    else:
        blend = a
        i += 1

import bpy  # noqa: E402

if blend:
    bpy._load(blend)

try:
    runpy.run_path(script, run_name="__main__")
except BaseException:
    traceback.print_exc()
    sys.exit(1)
