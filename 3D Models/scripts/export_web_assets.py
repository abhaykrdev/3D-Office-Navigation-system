



import bpy,bmesh,json,math,sys,argparse,time
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[1];web=root.parent/'Website'
parser=argparse.ArgumentParser();parser.add_argument('--floor');parser.add_argument('--export-only',action='store_true')
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
floors=json.loads((web/'data/navigation-geometry.json').read_text())
(web/'models').mkdir(exist_ok=True);report={}
for key,f in floors.items():
    if args.floor and key!=args.floor:continue
    filename={'ground':'0th Floor.blend','first':'1st Floor.blend','second':'2nd Floor.blend'}[key]
    bpy.ops.wm.open_mainfile(filepath=str(root/'source'/filename),load_ui=False)
    scene=bpy.context.scene;scene.frame_set(1)


    for mat in bpy.data.materials:
        color=tuple(mat.diffuse_color)
        if mat.use_nodes:
            principled=next((n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
            if principled and not principled.inputs['Base Color'].is_linked:color=tuple(principled.inputs['Base Color'].default_value)
        if max(color[:3])<.025:color=(.12,.15,.18,1)
        mat.use_nodes=True;mat.node_tree.nodes.clear()
        bsdf=mat.node_tree.nodes.new('ShaderNodeBsdfPrincipled');bsdf.inputs['Base Color'].default_value=color
        bsdf.inputs['Roughness'].default_value=.72
        output=mat.node_tree.nodes.new('ShaderNodeOutputMaterial');mat.node_tree.links.new(bsdf.outputs['BSDF'],output.inputs['Surface'])
        mat.diffuse_color=color

    for o in list(scene.objects):
        if o.type in {'LIGHT','CAMERA'} or 'door' in o.name.lower():bpy.data.objects.remove(o,do_unlink=True)
    if key=='first':
        ceiling=bpy.data.objects.get('Plane')
        if ceiling:bpy.data.objects.remove(ceiling,do_unlink=True)
    openings=[];adjustments=[]
    if key=='ground':
        wall=bpy.data.objects.get('Cube')
        bpy.ops.object.select_all(action='DESELECT');wall.select_set(True);bpy.context.view_layer.objects.active=wall
        bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
        bm=bmesh.new();bm.from_mesh(wall.data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(wall.data);bm.free()


        cutters=[]
        for a,b in f['edges']:
            p,q=[Vector((f['nodes'][id]['pos3d'][0],-f['nodes'][id]['pos3d'][2],5.1)) for id in (a,b)]
            delta=q-p
            if delta.length<.01:continue
            bpy.ops.mesh.primitive_cube_add(size=1,location=(p+q)/2)
            cutter=bpy.context.object;cutter.name='Plan corridor opening'
            cutter.dimensions=(delta.length+.9,.9,10);cutter.rotation_euler.z=math.atan2(delta.y,delta.x)
            bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);cutters.append(cutter)
            openings.append({'edge':[a,b],'from':list(p),'to':list(q),'width':.9})
        partition=bpy.data.objects.get('Cube.031')
        for cutter in cutters:
            for target in [wall,partition]:
                if target is None:continue
                bpy.ops.object.select_all(action='DESELECT');target.select_set(True);bpy.context.view_layer.objects.active=target
                mod=target.modifiers.new('Plan-based corridor opening','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cutter
                bpy.ops.object.modifier_apply(modifier=mod.name)
            bpy.data.objects.remove(cutter,do_unlink=True)



        bm=bmesh.new();bm.from_mesh(wall.data)
        low=(-14.5,-17.9,.13);high=(-12.8,-16.1,2.8)
        for axis in range(3):
            normal=Vector((int(axis==0),int(axis==1),int(axis==2)))
            for value in [low[axis],high[axis]]:
                co=Vector((0,0,0));co[axis]=value
                bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.00001,plane_co=co,plane_no=normal)
        delete=[face for face in bm.faces if all(low[i]-.00001<=face.calc_center_median()[i]<=high[i]+.00001 for i in range(3))]
        bmesh.ops.delete(bm,geom=delete,context='FACES');bm.to_mesh(wall.data);bm.free()

        for name in ['Glass.003','Glass.004','Glass.008']:
            obj=bpy.data.objects.get(name)
            if obj:bpy.data.objects.remove(obj,do_unlink=True)
        for name in ['Vending Machine','Plane.004']:
            obj=bpy.data.objects.get(name)
            if obj:obj.location.y+=1.5
        adjustments=['Opened plan corridor in wall mesh and glazed partition Cube.031 / Glass.008',
                     'Shifted vending machine and front panel 1.5 model units to clear the stair-to-lift approach']
    bpy.ops.object.select_all(action='DESELECT')
    for obj in scene.objects:
        if obj.type=='MESH' and not obj.hide_render:obj.select_set(True)


    palette={}
    for obj in list(bpy.context.selected_objects):
        for slot in obj.material_slots:
            if not slot.material:continue
            color=tuple(round(v,4) for v in slot.material.diffuse_color)
            if color not in palette:palette[color]=slot.material
            slot.material=palette[color]
    bpy.context.view_layer.objects.active=bpy.context.selected_objects[0]
    bpy.ops.object.join()
    blocked=[]
    depsgraph=bpy.context.evaluated_depsgraph_get()
    for a,b in f['edges']:
        for z in [.5 if key!='first' else .35,f['eyeHeight']]:
            p,q=[Vector((f['nodes'][id]['pos3d'][0],-f['nodes'][id]['pos3d'][2],z)) for id in (a,b)]
            delta=q-p
            if delta.length<.03:continue
            hit,loc,normal,index,obj,matrix=scene.ray_cast(depsgraph,p+delta.normalized()*.01,delta.normalized(),distance=max(0,delta.length-.02))
            if hit:blocked.append({'edge':[a,b],'height':z,'point':list(loc)})
    (root/'derived').mkdir(exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(root/'derived'/f'{key}-web.blend'))
    bpy.ops.export_scene.gltf(filepath=str(web/'models'/f'{key}.glb'),export_format='GLB',
        use_selection=True,export_animations=False,export_cameras=False,export_lights=False,export_apply=True,
        export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6)
    report[key]={'modelBytes':(web/'models'/f'{key}.glb').stat().st_size,
                 'corridorReconciliation':openings,'derivedAdjustments':adjustments,
                 'routeIntersections':blocked,'destinations':len(f['locations']),
                 'materialMode':'Self-contained PBR using original base colors'}
reportpath=web/'reports/asset-report.json'
old=json.loads(reportpath.read_text()) if reportpath.exists() else {}
old.update(report);reportpath.write_text(json.dumps(old,indent=2))
print('MODEL_EXPORT_COMPLETE',list(report),flush=True)
