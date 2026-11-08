


import bpy,json
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[1];web=root.parent/'Website'
floors=json.loads((web/'data/navigation-geometry.json').read_text())
report=json.loads((web/'reports/asset-report.json').read_text())
for key,f in floors.items():
    bpy.ops.wm.open_mainfile(filepath=str(root/'derived'/f'{key}-web.blend'),load_ui=False)
    scene=bpy.context.scene;dg=bpy.context.evaluated_depsgraph_get();blocked=[]
    for a,b in f['edges']:
        for z in [.5 if key!='first' else .35,f['eyeHeight']]:
            p,q=[Vector((f['nodes'][id]['pos3d'][0],-f['nodes'][id]['pos3d'][2],z)) for id in (a,b)]
            delta=q-p
            if delta.length<.03:continue
            hit,loc,normal,index,obj,matrix=scene.ray_cast(dg,p+delta.normalized()*.01,delta.normalized(),distance=max(0,delta.length-.02))
            if hit:blocked.append({'edge':[a,b],'height':z,'point':list(loc)})
    bpy.ops.object.select_all(action='DESELECT')
    for o in scene.objects:
        if o.type=='MESH' and not o.hide_render:o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(web/'models'/f'{key}.glb'),export_format='GLB',
       use_selection=True,export_animations=False,export_cameras=False,export_lights=False,
       export_apply=True,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6)
    report[key].update(modelBytes=(web/'models'/f'{key}.glb').stat().st_size,
        routeIntersections=blocked,destinations=len(f['locations']),
        checkpoints=len({l['node'] for l in f['locations']}),geometryFrozen=True)
    print('FINAL_MODEL',key,'intersections',len(blocked),flush=True)
(web/'reports/asset-report.json').write_text(json.dumps(report,indent=2))
