const test=require('node:test'),assert=require('node:assert/strict');
const {createTaskAreaController}=require('./task-area-controller.js');
function fixture(){
 let visible=true,component={consumerId:'component.dock',kind:'dock',state:'active',placement:{width:1000,height:100},config:{dextTaskArea:{version:1,rect:{x:0,y:0,width:1000,height:100}}}};
 const calls=[],waits=[];let available=false,enabled=false;
 const area={configure(c){calls.push(['configure',c]);return !!c?.config?.dextTaskArea;},setAvailable(v){available=v;calls.push(['available',v]);},setInputEnabled(v){enabled=v;},accept:()=>true,read:()=>({occlusion:component?{x:0,y:0,width:1920,height:1080}:null}),dispose(){calls.push(['dispose']);}};
 const dom={readDiagnostics:()=>({instances:component?[component]:[]}),setTaskAreaOcclusion:r=>{calls.push(['occlusion',r]);return new Promise(resolve=>waits.push(resolve));},refreshGeometry:async()=>true};
 const context={viewKind:'dock',manifest:{dockComponentId:'dock'}};
 const snapshot={active:true,operable:true,lifecycle:{stage:'desktop',locked:false}};
 const c=createTaskAreaController({createArea:()=>area,getState:()=>({context,snapshot,dom,viewport:{width:1000,height:100},visible})});
 return {c,calls,waits,area,dom,context,snapshot,setVisible:v=>visible=v,setComponent:v=>component=v,available:()=>available,enabled:()=>enabled};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('official area waits for author-occlusion acknowledgement and is read-only without native actions',async()=>{
 const f=fixture(),done=f.c.refresh();await tick();assert.equal(f.available(),false);f.waits.shift()(true);assert.equal(await done,true);assert.equal(f.available(),true);assert.equal(f.enabled(),false);
 const count=f.calls.length;f.c.accept({sequence:1},false);assert.equal(f.calls.length,count);assert.equal(f.enabled(),false);
});
test('hiding during an outstanding barrier cannot resurrect the area',async()=>{
 const f=fixture(),first=f.c.refresh();await tick();f.setVisible(false);const hidden=f.c.refresh();assert.equal(f.available(),false);
 f.waits.shift()(true);await first;await tick();f.waits.shift()(true);await hidden;assert.equal(f.available(),false);
});
test('effective instance is used; missing or inactive declaration clears the region',async()=>{
 const f=fixture();f.setComponent({consumerId:'component.dock',kind:'dock',state:'active',config:{dextTaskArea:{version:1,rect:{x:30}}}});
 const first=f.c.refresh();await tick();assert.equal(f.calls.find(c=>c[0]==='configure')[1].config.dextTaskArea.rect.x,30);f.waits.shift()(true);await first;
 f.setComponent(null);const removed=f.c.refresh();await tick();assert.equal(f.calls.at(-1)[1],null);f.waits.shift()(true);await removed;assert.equal(f.available(),false);
});
test('dispose cancels pending enable and desktop view never configures a task region',async()=>{
 const f=fixture(),pending=f.c.refresh();await tick();f.c.dispose();f.waits.shift()(true);await pending;assert.equal(f.available(),false);
 const g=fixture();g.context.viewKind='desktop';const done=g.c.refresh();await tick();g.waits.shift()(true);await done;assert.equal(g.available(),false);
});
test('failed occlusion and geometry refresh leave task buttons hidden',async()=>{
 const f=fixture();f.dom.refreshGeometry=async()=>false;
 const done=f.c.refresh();await tick();f.waits.shift()(false);assert.equal(await done,false);assert.equal(f.available(),false);assert.equal(f.c.read().phase,'geometryUnavailable');
});
test('visible native Dock survives another foreground window and desktop playback pause',async()=>{
 const f=fixture();f.snapshot.operable=false;f.snapshot.lifecycle.playbackPaused=true;
 const done=f.c.refresh();await tick();f.waits.shift()(true);assert.equal(await done,true);assert.equal(f.available(),true);
});
test('plain geometry success cannot replace rejection of the requested task occlusion',async()=>{
 const f=fixture();let refreshes=0;f.dom.refreshGeometry=async()=>{refreshes++;return true;};
 const done=f.c.refresh();await tick();f.waits.shift()(false);assert.equal(await done,false);assert.equal(f.available(),false);assert.equal(refreshes,0);
});
