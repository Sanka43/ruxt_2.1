"""Runs inside Blender: prints the open scene as one JSON line prefixed with RUXT_JSON:."""

import json

import bpy

scene = bpy.context.scene
info = {
    "scene": scene.name,
    "frame_start": scene.frame_start,
    "frame_end": scene.frame_end,
    "fps": scene.render.fps,
    "render_engine": scene.render.engine,
    "resolution": [scene.render.resolution_x, scene.render.resolution_y],
    "objects": [
        {
            "name": o.name,
            "type": o.type,
            "location": [round(v, 4) for v in o.location],
            "scale": [round(v, 4) for v in o.scale],
            "material_slots": [s.material.name for s in o.material_slots if s.material],
        }
        for o in bpy.data.objects
    ],
    "materials": [m.name for m in bpy.data.materials],
    "cameras": [c.name for c in bpy.data.cameras],
    "lights": [l.name for l in bpy.data.lights],
}
print("RUXT_JSON:" + json.dumps(info))
