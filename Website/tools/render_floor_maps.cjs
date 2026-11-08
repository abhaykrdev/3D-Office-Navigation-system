const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {chromium}=require('@playwright/test');
const root=path.resolve(__dirname,'..');
(async()=>{
    const floors=JSON.parse(fs.readFileSync(path.join(root,'data/demo.json'),'utf8'));
    const source=fs.readFileSync(path.join(root,'src/js/viewer3d.js'),'utf8');
    const colors=source.slice(source.indexOf('    const overheadMaterials'),source.indexOf('    const bounds ='));
    const browser=await chromium.launch({...(process.env.CHROME_EXECUTABLE_PATH?{executablePath:process.env.CHROME_EXECUTABLE_PATH}:{channel:'chrome'}),headless:true,args:['--enable-unsafe-swiftshader']});
    try{
        const page=await browser.newPage();
        await page.goto('http://127.0.0.1:8080/');
        for(const [key,floor] of Object.entries(floors)){
            const png=await page.evaluate(async({floor,colors})=>{
                const THREE=await import('/vendor/three/three.module.js');
                const {GLTFLoader}=await import('/vendor/three/addons/loaders/GLTFLoader.js');
                const {DRACOLoader}=await import('/vendor/three/addons/loaders/DRACOLoader.js');
                const decoder=new DRACOLoader().setDecoderPath('/vendor/three/draco/');
                const model=(await new GLTFLoader().setDRACOLoader(decoder).loadAsync(floor.model)).scene;
                const palette=await (await fetch(floor.model.replace('.glb','-topdown.json'))).json();
                new Function('THREE','model','palette','floor',colors+`
                    model.traverse(o=>{const m=originalMaterials.get(o);if(!m)return;
                    o.material=Array.isArray(m)?m.map(v=>overheadMaterials.get(v)):overheadMaterials.get(m);
                    o.geometry=overheadGeometry.get(o)||o.geometry;});`)(THREE,model,palette,floor);
                const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
                renderer.setSize(1400,1400);renderer.outputColorSpace=THREE.SRGBColorSpace;
                renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
                renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
                const scene=new THREE.Scene();scene.background=new THREE.Color('#d4d8db');scene.add(model);
                scene.add(new THREE.HemisphereLight('#ffffff','#8e9ca5',1.2));
                const bounds=new THREE.Box3().setFromObject(model),center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
                const span=Math.max(size.x,size.z),sun=new THREE.DirectionalLight('#ffffff',2);
                sun.position.set(center.x-span*.45,span*.85,center.z-span*.3);sun.target.position.copy(center);
                sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
                Object.assign(sun.shadow.camera,{left:-span*.75,right:span*.75,top:span*.75,bottom:-span*.75,near:.1,far:span*4});
                sun.shadow.normalBias=.025;sun.shadow.bias=-.0001;sun.shadow.intensity=.7;scene.add(sun,sun.target);
                const s=floor.calibration.span,[cx,cy]=floor.calibration.center;
                const camera=new THREE.OrthographicCamera(-s/2,s/2,s/2,-s/2,.1,800);
                camera.up.set(0,0,-1);camera.position.set(cx,bounds.max.y+s+10,-cy);camera.lookAt(cx,0,-cy);
                renderer.render(scene,camera);const result=renderer.domElement.toDataURL('image/png').split(',')[1];
                model.traverse(o=>{o.geometry?.dispose();if(o.material)for(const m of [].concat(o.material))m.dispose();});
                decoder.dispose();renderer.dispose();renderer.forceContextLoss();return result;
            },{floor,colors});
            const file=floor.map.split('?')[0],bytes=Buffer.from(png,'base64');fs.writeFileSync(path.join(root,file),bytes);
            floor.map=file+'?v='+crypto.createHash('sha256').update(bytes).digest('hex').slice(0,12);
            console.log(`Rendered ${key} floor map with the 3D palette.`);
        }
    }finally{await browser.close();}
    fs.writeFileSync(path.join(root,'data/demo.json'),JSON.stringify(floors,null,2)+'\n');
    const data='const NAV_DATA = '+JSON.stringify(floors,null,2)+';\n';fs.writeFileSync(path.join(root,'data/data.js'),data);
    const index=path.join(root,'index.html');fs.writeFileSync(index,fs.readFileSync(index,'utf8').replace(/data\/data\.js(?:\?v=[a-f0-9]+)?/g,'data/data.js?v='+crypto.createHash('sha256').update(data).digest('hex').slice(0,12)));
})().catch(e=>{console.error(e);process.exitCode=1;});
