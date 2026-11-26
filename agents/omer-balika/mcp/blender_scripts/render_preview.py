"""Runs inside Blender: renders one still frame.

Environment: RUXT_RENDER_OUT (png path), RUXT_FRAME, RUXT_PERCENT, RUXT_ENGINE (optional).
"""

import os

import bpy

scene = bpy.context.scene
engine = os.environ.get("RUXT_ENGINE")
if engine:
    scene.render.engine = engine
scene.render.resolution_percentage = int(os.environ.get("RUXT_PERCENT", "50"))
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = os.environ["RUXT_RENDER_OUT"]
scene.frame_set(int(os.environ.get("RUXT_FRAME", str(scene.frame_start))))
bpy.ops.render.render(write_still=True)
