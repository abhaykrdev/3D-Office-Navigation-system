
import bpy
import json
from pathlib import Path
from mathutils import Vector

root = Path(__file__).resolve().parents[1]
(root/'reports').mkdir(exist_ok=True)
reports = []
for name in ['0th Floor.blend', '1st Floor.blend', '2nd Floor.blend']:
    bpy.ops.wm.open_mainfile(filepath=str(root / 'source' / name), load_ui=False)
    objects = []
    for obj in bpy.context.scene.objects:
        if obj.type not in {'MESH', 'CAMERA', 'CURVE', 'EMPTY'}:
            continue
        bounds = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
        objects.append({
            'name': obj.name, 'type': obj.type,
            'position': list(obj.matrix_world.translation),
            'dimensions': list(obj.dimensions),
            'bounds_min': [min(v[i] for v in bounds) for i in range(3)],
            'bounds_max': [max(v[i] for v in bounds) for i in range(3)],
            'vertices': len(obj.data.vertices) if obj.type == 'MESH' else 0,
            'hidden_render': obj.hide_render,
            'collections': [c.name for c in obj.users_collection],
        })
    reports.append({
        'file': name, 'units': bpy.context.scene.unit_settings.system,
        'unit_scale': bpy.context.scene.unit_settings.scale_length,
        'objects': objects,
        'missing_images': [image.filepath for image in bpy.data.images
                           if image.source == 'FILE' and not image.packed_file
                           and not Path(bpy.path.abspath(image.filepath)).exists()],
    })
output = root / 'reports/model_audit.json'
output.write_text(json.dumps(reports, indent=2), encoding='utf-8')
for report in reports:
    print('AUDIT', report['file'], 'objects', len(report['objects']),
          'vertices', sum(o['vertices'] for o in report['objects']),
          'missing_images', len(report['missing_images']))
