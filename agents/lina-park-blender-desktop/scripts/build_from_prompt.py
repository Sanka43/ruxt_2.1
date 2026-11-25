"""
Lina Park — build a Blender scene from a natural-language prompt.
Writes a .blend and optional preview PNG into OUT_DIR.
"""
import bpy
import math
import os
import re
import sys

PROMPT = os.environ.get("LINA_PROMPT", " ".join(sys.argv[sys.argv.index("--") + 1:]) if "--" in sys.argv else "simple prop")
OUT_DIR = os.environ.get("LINA_OUT_DIR", os.path.expanduser("~/Desktop/lina-blender-out"))
ACTION = os.environ.get("LINA_ACTION", "create")
BASE_BLEND = os.environ.get("LINA_BASE_BLEND", "")
BLEND_PATH = os.path.join(OUT_DIR, "scene.blend")
PREVIEW_PATH = os.path.join(OUT_DIR, "preview.png")

os.makedirs(OUT_DIR, exist_ok=True)


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in list(bpy.data.meshes):
        bpy.data.meshes.remove(block)
    for block in list(bpy.data.materials):
        bpy.data.materials.remove(block)
    for block in list(bpy.data.curves):
        bpy.data.curves.remove(block)


def mat(name, color, roughness=0.45, metallic=0.0, emission=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nodes = m.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (*color, 1.0)
        if "Roughness" in bsdf.inputs:
            bsdf.inputs["Roughness"].default_value = roughness
        if "Metallic" in bsdf.inputs:
            bsdf.inputs["Metallic"].default_value = metallic
        if emission and "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
            if "Emission Strength" in bsdf.inputs:
                bsdf.inputs["Emission Strength"].default_value = 0.35
    return m


def add_camera_light():
    bpy.ops.object.light_add(type="AREA", location=(3.5, -2.5, 4.5))
    light = bpy.context.object
    light.data.energy = 250
    light.data.size = 3
    light.name = "KeyLight"

    bpy.ops.object.light_add(type="AREA", location=(-3.0, 2.0, 2.5))
    fill = bpy.context.object
    fill.data.energy = 80
    fill.data.size = 4
    fill.name = "FillLight"

    bpy.ops.object.camera_add(location=(5.5, -5.5, 3.2), rotation=(math.radians(68), 0, math.radians(45)))
    cam = bpy.context.object
    cam.name = "ShotCam"
    bpy.context.scene.camera = cam


def ground():
    bpy.ops.mesh.primitive_plane_add(size=12, location=(0, 0, 0))
    plane = bpy.context.object
    plane.name = "Ground"
    plane.data.materials.append(mat("GroundMat", (0.82, 0.78, 0.72), roughness=0.9))


def make_butterfly():
    body_mat = mat("Body", (0.18, 0.12, 0.28), roughness=0.35)
    wing_mat = mat("Wing", (0.95, 0.45, 0.18), roughness=0.3, emission=(1.0, 0.55, 0.15))

    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.12, location=(0, 0, 1.2))
    body = bpy.context.object
    body.name = "ButterflyBody"
    body.scale = (0.55, 1.5, 0.55)
    bpy.ops.object.transform_apply(scale=True)
    body.data.materials.append(body_mat)

    def wing(name, x):
        bpy.ops.mesh.primitive_plane_add(size=1.0, location=(x, 0.05, 1.25))
        w = bpy.context.object
        w.name = name
        w.scale = (0.75, 1.1, 1.0)
        bpy.ops.object.transform_apply(scale=True)
        w.rotation_euler = (math.radians(90), 0, 0)
        w.data.materials.append(wing_mat)
        # parent empty for flap
        bpy.ops.object.empty_add(type="PLAIN_AXES", location=(0, 0, 1.2))
        pivot = bpy.context.object
        pivot.name = name + "Pivot"
        w.parent = pivot
        w.location = (x * 0.55, 0.02, 0.05)
        return pivot

    left = wing("WingL", -0.55)
    right = wing("WingR", 0.55)
    left.parent = body
    right.parent = body

    scene = bpy.context.scene
    scene.frame_start = 1
    scene.frame_end = 72
    fps = scene.render.fps or 24

    for frame in range(1, 73):
        scene.frame_set(frame)
        flap = math.sin(frame / fps * math.pi * 6) * math.radians(42)
        left.rotation_euler = (0, flap, 0)
        right.rotation_euler = (0, -flap, 0)
        left.keyframe_insert(data_path="rotation_euler", frame=frame)
        right.keyframe_insert(data_path="rotation_euler", frame=frame)

        t = frame / 72.0
        body.location = (
            math.sin(t * math.pi * 2) * 1.4,
            math.cos(t * math.pi * 2) * 1.1,
            1.1 + math.sin(t * math.pi * 4) * 0.25,
        )
        body.rotation_euler = (0, 0, t * math.pi * 2)
        body.keyframe_insert(data_path="location", frame=frame)
        body.keyframe_insert(data_path="rotation_euler", frame=frame)

    return body


def make_bouncing_ball():
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.45, location=(0, 0, 0.45))
    ball = bpy.context.object
    ball.name = "BounceBall"
    ball.data.materials.append(mat("Ball", (0.2, 0.55, 0.95), roughness=0.25))
    scene = bpy.context.scene
    scene.frame_start = 1
    scene.frame_end = 48
    for frame in range(1, 49):
        scene.frame_set(frame)
        t = (frame - 1) / 24.0
        y = abs(math.sin(t * math.pi * 2)) * 1.6 + 0.45
        squash = 1.0 - 0.25 * max(0, 1 - y)
        ball.location = (0, 0, y)
        ball.scale = (1 / squash, 1 / squash, squash)
        ball.keyframe_insert(data_path="location", frame=frame)
        ball.keyframe_insert(data_path="scale", frame=frame)
    return ball


def make_mug():
    bpy.ops.mesh.primitive_cylinder_add(radius=0.45, depth=0.9, location=(0, 0, 0.45))
    cup = bpy.context.object
    cup.name = "Mug"
    cup.data.materials.append(mat("Clay", (0.86, 0.62, 0.48), roughness=0.7))
    bpy.ops.mesh.primitive_torus_add(major_radius=0.28, minor_radius=0.05, location=(0.55, 0, 0.5), rotation=(math.radians(90), 0, 0))
    handle = bpy.context.object
    handle.name = "Handle"
    handle.data.materials.append(mat("Clay2", (0.86, 0.62, 0.48), roughness=0.7))
    return cup


def make_lamp():
    bpy.ops.mesh.primitive_cylinder_add(radius=0.35, depth=0.08, location=(0, 0, 0.04))
    base = bpy.context.object
    base.name = "LampBase"
    base.data.materials.append(mat("Metal", (0.2, 0.2, 0.22), roughness=0.25, metallic=0.8))
    bpy.ops.mesh.primitive_cylinder_add(radius=0.05, depth=1.1, location=(0, 0, 0.6))
    stem = bpy.context.object
    stem.name = "LampStem"
    stem.data.materials.append(mat("Metal2", (0.25, 0.25, 0.28), roughness=0.3, metallic=0.75))
    bpy.ops.mesh.primitive_cone_add(radius1=0.45, depth=0.4, location=(0, 0, 1.25))
    shade = bpy.context.object
    shade.name = "Shade"
    shade.data.materials.append(mat("Shade", (0.95, 0.88, 0.7), roughness=0.65, emission=(1.0, 0.92, 0.7)))
    return base


def make_generic(label):
    bpy.ops.mesh.primitive_cube_add(size=1.2, location=(0, 0, 0.6))
    obj = bpy.context.object
    obj.name = "Hero"
    obj.data.materials.append(mat("HeroMat", (0.9, 0.5, 0.25), roughness=0.4))
    # gentle spin so something visibly "happened"
    scene = bpy.context.scene
    scene.frame_start = 1
    scene.frame_end = 60
    for frame in (1, 60):
        scene.frame_set(frame)
        obj.rotation_euler = (0, 0, 0 if frame == 1 else math.radians(180))
        obj.keyframe_insert(data_path="rotation_euler", frame=frame)
    return obj


def choose_builder(prompt: str):
    p = prompt.lower()
    if re.search(r"butter\s*fly|moth|wing", p):
        return "butterfly", make_butterfly
    if re.search(r"bounce|ball", p):
        return "ball", make_bouncing_ball
    if re.search(r"mug|cup|clay", p):
        return "mug", make_mug
    if re.search(r"lamp|desk light", p):
        return "lamp", make_lamp
    return "generic", lambda: make_generic(prompt[:40])


def setup_render():
    scene = bpy.context.scene
    for engine in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE", "CYCLES"):
        try:
            scene.render.engine = engine
            break
        except Exception:
            continue
    scene.render.resolution_x = 960
    scene.render.resolution_y = 540
    scene.render.filepath = PREVIEW_PATH
    scene.render.image_settings.file_format = "PNG"
    scene.frame_set(scene.frame_start)


def modify_existing_scene(prompt: str):
    """Apply a small, predictable edit without destroying the existing scene."""
    text = prompt.lower()
    active = bpy.context.active_object or next((obj for obj in bpy.context.scene.objects if obj.type == 'MESH'), None)
    if active and re.search(r"bigger|larger|scale up", text):
        active.scale = tuple(value * 1.2 for value in active.scale)
    elif active and re.search(r"smaller|reduce|scale down", text):
        active.scale = tuple(value * 0.8 for value in active.scale)
    if active and re.search(r"spin|rotate|turntable|animate|animation|move", text):
        active.rotation_euler.z = 0
        active.keyframe_insert(data_path="rotation_euler", frame=1)
        active.rotation_euler.z = math.radians(360)
        active.keyframe_insert(data_path="rotation_euler", frame=72)
        bpy.context.scene.frame_start = 1
        bpy.context.scene.frame_end = 72
    if re.search(r"camera|shot|view|angle", text):
        add_camera_light()
    if re.search(r"light|lighting|bright|dark", text):
        add_camera_light()
    if active and re.search(r"red|blue|green|gold|black|white|metal|clay|material|colour|color", text):
        material = active.data.materials[0] if active.data.materials else mat("UpdatedMaterial", (0.3, 0.55, 0.9), roughness=0.45)
        if not active.data.materials:
            active.data.materials.append(material)
        material.diffuse_color = (0.3, 0.55, 0.9, 1.0)
    return active or bpy.context.scene


def main():
    if ACTION == "modify" and BASE_BLEND and os.path.exists(BASE_BLEND):
        bpy.ops.wm.open_mainfile(filepath=BASE_BLEND)
        modify_existing_scene(PROMPT)
        kind = "modified"
    else:
        clear_scene()
        ground()
        add_camera_light()
        kind, builder = choose_builder(PROMPT)
        builder()
    setup_render()
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
    try:
        bpy.ops.render.render(write_still=True)
    except Exception as exc:
        print("PREVIEW_RENDER_SKIPPED", exc)
    print("LINA_KIND", kind)
    print("LINA_BLEND", BLEND_PATH)
    print("LINA_PREVIEW", PREVIEW_PATH)
    print("LINA_PROMPT", PROMPT)


if __name__ == "__main__":
    main()
