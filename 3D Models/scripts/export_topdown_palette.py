
import bpy,json
from pathlib import Path
root=Path(__file__).resolve().parents[1];web=root.parent/'Website'
for key,name in [('ground','0th Floor.blend'),('first','1st Floor.blend'),('second','2nd Floor.blend')]:
    bpy.ops.wm.open_mainfile(filepath=str(root/'source'/name),load_ui=False)
    colors={m.name:list(m.diffuse_color[:3]) for m in bpy.data.materials}
    (web/'models'/f'{key}-topdown.json').write_text(json.dumps(colors))
    print('TOPDOWN_PALETTE',key,len(colors))
