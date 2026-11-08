const {chromium}=require('@playwright/test');
const assert=require('node:assert/strict');
(async()=>{
    const browser=await chromium.launch({...(process.env.CHROME_EXECUTABLE_PATH?{executablePath:process.env.CHROME_EXECUTABLE_PATH}:{channel:'chrome'}),headless:true,args:['--enable-unsafe-swiftshader']});
    try{
        const p=await browser.newPage();const errors=[];const missing=[];const models=[];
        const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
        p.on('response',r=>{if(r.url().includes('/models/') && r.url().includes('.glb'))models.push(r);});
        p.on('pageerror',e=>errors.push(e.message));
        p.on('response',r=>{if(r.status()>=400)missing.push(r.url());});
        await p.goto('http://127.0.0.1:8080/');
        await p.locator('.location-item').first().waitFor();
        assert.equal(await p.locator('.location-item').count(),37);
        await p.locator('#globalSearch').fill('Employee1');
        await p.locator('#searchResults button').first().click();
        assert.equal(await p.locator('#selectionName').textContent(),'Employee1');
        assert.equal(await p.locator('.route-line').count(),1);
        await p.locator('[data-view="3d"]').click();
        await p.waitForFunction(()=>document.querySelector('#mediaContainer').dataset.navigationMode==='topdown',{}, {timeout:30000});
        await p.waitForFunction(()=>document.querySelector('#statusText').textContent.includes('reached the checkpoint'),{}, {timeout:30000});
        await p.locator('.media-controls button',{hasText:'POV',exact:true}).click();
        assert.equal(await p.locator('#minimap').isVisible(),true);
        await p.locator('[data-floor="second"]').click();
        assert.equal(await p.locator('.location-item').count(),27);
        for(const key of ['second','ground']){
            await p.locator(`[data-floor="${key}"]`).click();
            await p.locator('[data-view="3d"]').click();
            await p.waitForFunction(()=>document.querySelector('#mediaContainer').dataset.navigationMode==='topdown',{}, {timeout:30000});
        }
        for(const key of ['first','second','ground']){
            const response=models.find(r=>r.url().includes(`/models/${key}.glb?v=`));
            assert.ok(response,`${key}: versioned model requested`);
            const expected=fs.readFileSync(path.join(__dirname,`../models/${key}.glb`));
            assert.equal(crypto.createHash('sha256').update(await response.body()).digest('hex'),crypto.createHash('sha256').update(expected).digest('hex'));
            assert.ok(new URL(response.url()).searchParams.get('v')===crypto.createHash('sha256').update(expected).digest('hex').slice(0,12));
        }
        await p.setViewportSize({width:390,height:844});
        assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
        assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
        console.log('Placeholder search, routing, Top-down/POV playback, minimap and mobile checks passed.');
    }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
