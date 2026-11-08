const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {route}=require('../src/js/router.js');
const floors=require('../data/demo.json');
test('All placeholder destinations have connected routes and placeholder labels',()=>{
    for(const f of Object.values(floors)){
        for(const l of f.locations){
            assert.match(l.name,/^(Employee|Room)\d+$/);
            assert.match(l.department,/^Dep\d+$/);
            assert.match(l.designation,/^Room\d+$/);
            assert.ok(route(f,f.start,l.node));
        }
        const raw=fs.readFileSync(path.join(__dirname,'..',f.model.split('?')[0]));
        assert.equal(raw.readUInt32LE(0),0x46546c67);
        assert.equal(raw.readUInt32LE(8),raw.length);
        assert.ok(fs.existsSync(path.join(__dirname,'..',f.map.split('?')[0])));
    }
});
test('Private directory sources and annotated floor plans are absent',()=>{
    for(const item of ['videos','reference','assets','reports','legacy.html','data/legacy-directory.js']){
        assert.equal(fs.existsSync(path.join(__dirname,'..',item)),false,item);
    }
    assert.equal(fs.existsSync(path.join(__dirname,'../../3D Models/source')),true);
});
