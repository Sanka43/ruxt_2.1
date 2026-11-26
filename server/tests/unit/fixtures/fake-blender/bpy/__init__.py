"""Tiny fake of Blender's bpy for tests. Persists object names as JSON after a 'BLENDER' header."""
import json
from types import SimpleNamespace as NS


class _Collection(list):
    def new(self, name, type="MESH"):
        obj = NS(name=name, type=type, location=(0.0, 0.0, 0.0), scale=(1.0, 1.0, 1.0), material_slots=[])
        self.append(obj)
        return obj


data = NS(objects=_Collection(), materials=[], cameras=[], lights=[])
_render = NS(fps=24, engine="BLENDER_EEVEE", resolution_x=1920, resolution_y=1080, resolution_percentage=100,
             filepath="", image_settings=NS(file_format="PNG"))
_scene = NS(name="Scene", frame_start=1, frame_end=250, render=_render, frame_set=lambda n: None)
context = NS(scene=_scene)


def _load(path):
    raw = open(path, "rb").read()
    names = json.loads(raw[len(b"BLENDER-v402"):] or b"[]") if raw.startswith(b"BLENDER") else []
    data.objects[:] = []
    for name in names:
        data.objects.new(name)


def _read_factory_settings(use_empty=False):
    data.objects[:] = [] if use_empty else [NS(name="Cube", type="MESH", location=(0.0, 0.0, 0.0), scale=(1.0, 1.0, 1.0), material_slots=[])]


def _save_as_mainfile(filepath):
    with open(filepath, "wb") as fh:
        fh.write(b"BLENDER-v402" + json.dumps([o.name for o in data.objects]).encode())


def _render_still(write_still=False):
    out = _render.filepath if _render.filepath.endswith(".png") else _render.filepath + ".png"
    with open(out, "wb") as fh:
        fh.write(b"\x89PNG\r\n\x1a\n" + b"fake")


ops = NS(wm=NS(read_factory_settings=_read_factory_settings, save_as_mainfile=_save_as_mainfile),
         render=NS(render=_render_still))
