"""Runs inside Blender (blender --background --python run_wrapper.py).

Configuration comes from environment variables set by blender_server.py:
  RUXT_PROJECT_DIR  folder the script may write to
  RUXT_SCRIPT       the generated script to execute
  RUXT_EMPTY        "1" = start from an empty scene (no default cube, camera or light)
  RUXT_SAVE_AS      optional .blend path to save after the script finishes
"""

import os
import runpy
import sys

import bpy

mcp_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, mcp_dir)
import ruxt_script_guard  # noqa: E402

if os.environ.get("RUXT_EMPTY") == "1":
    bpy.ops.wm.read_factory_settings(use_empty=True)

ruxt_script_guard.install([os.environ["RUXT_PROJECT_DIR"]], allow_network=False)

# An exception here propagates; blender_server passes --python-exit-code 1 so it is reported as a failure.
runpy.run_path(os.environ["RUXT_SCRIPT"], run_name="__main__")

save_as = os.environ.get("RUXT_SAVE_AS")
if save_as:
    bpy.ops.wm.save_as_mainfile(filepath=save_as)
