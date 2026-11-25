# Blender Automation & 3D Scene Architecture Skill

This skill allows the agent to construct procedural 3D scenes, manage spatial coordinates, apply PBR materials, and configure camera viewpoints in Blender.

## Coordinate System
- **Z-Axis:** Up / Down (+Z is up)
- **X-Axis:** Left / Right
- **Y-Axis:** Forward / Backward (Depth)

## Available MCP Tool Specifications
- `create_mesh`: Generates geometric primitives (`cube`, `sphere`, `cylinder`, `cone`, `plane`, `torus`).
- `set_material`: Assigns RGB/Hex colors, metallic factors, and roughness to mesh objects.
- `setup_lighting`: Configures `SUN`, `POINT`, `SPOT`, or `AREA` light sources.
- `setup_camera`: Places camera with focal length, orientation, and target framing.
- `get_scene_objects`: Retrieves a list of active meshes and properties in the current scene.
- `render_scene`: Executes rendering via Blender Eevee or Cycles engine.
