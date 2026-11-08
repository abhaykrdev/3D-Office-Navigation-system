import bpy,json
from pathlib import Path
from mathutils import Vector
r=Path(__file__).resolve().parents[1]
f=json.loads((r.parent/'Website/data/navigation-geometry.json').read_text())['ground']
bpy.ops.wm.open_mainfile(filepath=str(r/'source/0th Floor.blend'),load_ui=False)
bpy.data.objects.remove(bpy.data.objects['Cube'],do_unlink=True)
for a,b in f['edges']:
 p,q=[Vector((f['nodes'][id]['pos3d'][0],-f['nodes'][id]['pos3d'][2],1.5)) for id in (a,b)]
 d=q-p
 if d.length<.01:continue
 hit,loc,normal,idx,obj,mat=bpy.context.scene.ray_cast(bpy.context.evaluated_depsgraph_get(),p+d.normalized()*.01,d.normalized(),distance=max(0,d.length-.02))
 if hit:print('COMPONENT',a,b,obj.name,list(loc))
