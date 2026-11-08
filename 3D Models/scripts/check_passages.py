import bpy,json
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[1]
f=json.loads((root.parent/'Website'/'data/navigation-source.json').read_text())['ground']
bpy.ops.wm.open_mainfile(filepath=str(root/'source/0th Floor.blend'),load_ui=False)
c=f['calibration'];cx,cy=c['center'];span=c['span']
for a,b in [('hall2','hall3'),('hall1','reception'),('hall0','discussion'),('hall2','environment-cell'),('hall11','washroom'),('west0','west1')]:
    p,q=[Vector((cx+(f['nodes'][id]['map'][0]/1400-.5)*span,cy+(.5-f['nodes'][id]['map'][1]/1400)*span,.8)) for id in (a,b)]
    direction=(q-p).normalized();length=(q-p).length;hits=[];start=p
    for i in range(20):
        hit,loc,normal,idx,obj,mat=bpy.context.scene.ray_cast(bpy.context.evaluated_depsgraph_get(),start,direction,distance=(q-start).length)
        if not hit:break
        hits.append((obj.name,[round(v,2) for v in loc]));start=loc+direction*.01
        if (start-p).length>length:break
    print('PASSAGE',a,b,hits)
