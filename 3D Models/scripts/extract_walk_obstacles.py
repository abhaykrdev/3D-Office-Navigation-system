
import bpy,json
from pathlib import Path
root=Path(__file__).resolve().parents[1];web=root.parent/'Website';result={}
for key,filename,eye in [('ground','derived/ground-web.blend',1.5),('first','source/1st Floor.blend',.85),('second','source/2nd Floor.blend',1.5)]:
    bpy.ops.wm.open_mainfile(filepath=str(root/filename),load_ui=False)
    segments=[];footprints=[]
    for o in bpy.context.scene.objects:
        if o.type!='MESH' or o.hide_render or 'door' in o.name.lower():continue
        mesh=o.to_mesh();mesh.calc_loop_triangles();coords=[o.matrix_world@v.co for v in mesh.vertices]
        for tri in mesh.loop_triangles:
            pts=[coords[i] for i in tri.vertices]
            normal=(pts[1]-pts[0]).cross(pts[2]-pts[0])
            if normal.length>1e-8 and abs(normal.normalized().z)>.65 and min(p.z for p in pts)>.16 and max(p.z for p in pts)<eye+.15:
                footprints.append([[p.x,p.y] for p in pts])
            for z in [.5 if key!='first' else .35,eye]:
                hits=[]
                for a,b in zip(pts,pts[1:]+pts[:1]):
                    if (a.z<z<=b.z) or (b.z<z<=a.z):
                        t=(z-a.z)/(b.z-a.z);hits.append([a.x+t*(b.x-a.x),a.y+t*(b.y-a.y)])
                if len(hits)==2:segments.append(hits)
        o.to_mesh_clear()
    result[key]={'segments':segments,'footprints':footprints}
(web/'cache').mkdir(exist_ok=True)
(web/'cache/walk-obstacles.json').write_text(json.dumps(result))
print('WALK_OBSTACLES', {k:(len(v['segments']),len(v['footprints'])) for k,v in result.items()})
