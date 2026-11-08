import bpy,bmesh
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[1]
path=root/'derived/ground-web.blend'
bpy.ops.wm.open_mainfile(filepath=str(path),load_ui=False)
for name in ['Cube','Cube.031']:
    wall=bpy.data.objects.get(name)
    if wall is None:continue
    bpy.ops.object.select_all(action='DESELECT');wall.select_set(True);bpy.context.view_layer.objects.active=wall
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    bm=bmesh.new();bm.from_mesh(wall.data)
    low=(-23.1,-15.85,.13);high=(-19.2,-14.45,2.8)
    for axis in range(3):
        normal=Vector(tuple(int(axis==i) for i in range(3)))
        for value in [low[axis],high[axis]]:
            co=Vector((0,0,0));co[axis]=value
            bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.00001,plane_co=co,plane_no=normal)
    faces=[f for f in bm.faces if all(low[i]-.00001<=f.calc_center_median()[i]<=high[i]+.00001 for i in range(3))]
    bmesh.ops.delete(bm,geom=faces,context='FACES');bm.to_mesh(wall.data);bm.free()
bpy.ops.wm.save_as_mainfile(filepath=str(path))
