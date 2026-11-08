
import bpy, json, math
from pathlib import Path
from mathutils import Vector
root = Path(__file__).resolve().parents[1]
out = root.parent / 'Website' / 'maps'
out.mkdir(exist_ok=True)
for key, filename in [('ground','0th Floor.blend'),('first','1st Floor.blend'),('second','2nd Floor.blend')]:
    bpy.ops.wm.open_mainfile(filepath=str(root / 'source' / filename), load_ui=False)
    scene = bpy.context.scene

    points = [o.matrix_world @ v.co for o in scene.objects if o.type == 'MESH' for v in o.data.vertices]
    lo = [min(p[i] for p in points) for i in range(3)]
    hi = [max(p[i] for p in points) for i in range(3)]
    cx, cy = (lo[0]+hi[0])/2, (lo[1]+hi[1])/2
    width, height = hi[0]-lo[0]+2, hi[1]-lo[1]+2
    bpy.ops.object.camera_add(location=(cx, cy, hi[2]+50))
    cam = bpy.context.object
    cam.rotation_euler = (0,0,0)
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = max(width,height)
    scene.camera = cam
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.display.shading.light = 'STUDIO'
    scene.display.shading.color_type = 'MATERIAL'
    scene.display.shading.show_shadows = True
    scene.display.shading.show_cavity = True
    scene.display.shading.cavity_type = 'BOTH'
    scene.display.shading.background_type = 'WORLD'
    scene.world.color = (.8,.8,.8)
    scene.render.resolution_x = 1400
    scene.render.resolution_y = 1400
    scene.render.resolution_percentage = 100
    scene.render.image_settings.media_type = 'IMAGE'
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = str(out / (key+'.png'))
    scene.render.film_transparent = False
    bpy.ops.render.render(write_still=True)
    meta = {'bounds_min':lo,'bounds_max':hi,'center':[cx,cy],
            'span':cam.data.ortho_scale,'size':1400,
            'mapToBlender':'x=cx+(u/1400-.5)*span; y=cy+(.5-v/1400)*span'}
    (out/(key+'.json')).write_text(json.dumps(meta,indent=2))
    print('PREVIEW',key,meta)
