
import bpy,json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
(root/'reports').mkdir(exist_ok=True)
result={}
for key,name,z in [('ground','0th Floor.blend',.8),('first','1st Floor.blend',.55),('second','2nd Floor.blend',.8)]:
    bpy.ops.wm.open_mainfile(filepath=str(root/'source'/name),load_ui=False)
    segments=[]
    for obj in bpy.context.scene.objects:
        if obj.type!='MESH' or obj.hide_render or 'door' in obj.name.lower(): continue
        mesh=obj.to_mesh(); mesh.calc_loop_triangles()
        coords=[obj.matrix_world@v.co for v in mesh.vertices]
        for tri in mesh.loop_triangles:
            pts=[coords[i] for i in tri.vertices]; hits=[]
            for a,b in zip(pts,pts[1:]+pts[:1]):
                if (a.z<z<=b.z) or (b.z<z<=a.z):
                    t=(z-a.z)/(b.z-a.z)
                    hits.append([a.x+t*(b.x-a.x),a.y+t*(b.y-a.y)])
            if len(hits)==2: segments.append(hits)
        obj.to_mesh_clear()
    result[key]=segments
out=root/'reports/obstacles.json'; out.write_text(json.dumps(result))
print('SECTIONS', {k:len(v) for k,v in result.items()})
