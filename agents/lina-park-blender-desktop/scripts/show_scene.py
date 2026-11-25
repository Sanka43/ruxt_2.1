"""Briefly point to visible mesh objects in the delivered scene using Blender's own UI."""
import bpy
import blf
from bpy_extras.view3d_utils import location_3d_to_region_2d
from mathutils import Vector


def start():
    area = next((a for a in bpy.context.window.screen.areas if a.type == 'VIEW_3D'), None)
    if not area:
        return
    objects = [obj for obj in bpy.context.visible_objects if obj.type == 'MESH'][:8]
    if not objects:
        return
    index = 0

    def draw():
        if bpy.context.area != area or index >= len(objects):
            return
        obj = objects[index]
        center = obj.matrix_world @ (sum((Vector(v) for v in obj.bound_box), Vector()) / 8)
        region = bpy.context.region
        point = location_3d_to_region_2d(region, bpy.context.region_data, center)
        text = 'Scene walkthrough  %d/%d   %s' % (index + 1, len(objects), obj.name)
        try:
            blf.size(0, 18)
        except TypeError:
            blf.size(0, 18, 72)
        blf.color(0, 0.65, 1.0, 0.4, 1.0)
        blf.position(0, 24, 44, 0)
        blf.draw(0, text)
        if point and 0 < point.x < region.width and 0 < point.y < region.height:
            blf.position(0, point.x, point.y, 0)
            blf.draw(0, '+ ' + obj.name)

    handler = bpy.types.SpaceView3D.draw_handler_add(draw, (), 'WINDOW', 'POST_PIXEL')
    area.tag_redraw()

    def advance():
        nonlocal index
        index += 1
        if index >= len(objects):
            bpy.types.SpaceView3D.draw_handler_remove(handler, 'WINDOW')
        area.tag_redraw()
        return 1.4 if index < len(objects) else None

    bpy.app.timers.register(advance, first_interval=1.4)


bpy.app.timers.register(start, first_interval=0.8)
