const test=require('node:test'),assert=require('node:assert/strict');
const {resolveTaskArea,createTaskAreaState}=require('./task-area-model.js');
const id=n=>n.toString(16).padStart(32,'0');
const view=(sequence=1,contextId=id(1),items)=>({contextId,sequence,items:items||[{id:id(2),name:'Editor',pinned:true,active:false,windows:[{id:id(3),title:'Document',active:false}]}]});
const declaration={version:1,rect:{x:100,y:20,width:800,height:80},style:{iconSizeDip:40,gapDip:8,radiusDip:16,surface:'#112233aa',accent:'#66ffaa'}};
const component={placement:{x:200,y:700,width:1000,height:120},config:{dextTaskArea:declaration}};
test('author local region maps to viewport CSS pixels and canvas occlusion',()=>{
 const r=resolveTaskArea(component,{width:1000,height:120});
 assert.deepEqual(r.rect,{x:100,y:20,width:800,height:80});
 assert.deepEqual(r.occlusion,{x:192,y:180,width:1536,height:720});
 assert.equal(r.style.iconSizeDip,40);
});
test('missing invalid or undersized regions decline fusion',()=>{
 for(const change of [undefined,{...declaration,version:2},{...declaration,rect:{x:-1,y:0,width:100,height:50}},{...declaration,rect:{x:0,y:0,width:1001,height:50}},{...declaration,style:{surface:'url(file:private)'}}])
  assert.equal(resolveTaskArea({...component,config:{dextTaskArea:change}},{width:1000,height:120}),null);
 assert.equal(resolveTaskArea(component,{width:30,height:20}),null);
});
test('default style is bounded and supplied values cannot mutate result',()=>{
 const c=structuredClone(component);delete c.config.dextTaskArea.style;
 const r=resolveTaskArea(c,{width:1000,height:120});assert.equal(r.style.iconSizeDip,40);c.config.dextTaskArea.rect.x=900;assert.equal(r.rect.x,100);
 assert.equal(resolveTaskArea({...component,config:{dextTaskArea:{...declaration,style:{iconSizeDip:65}}}},{width:1000,height:120}),null);
});
test('ordinary refresh while pressed completes once then publishes newest structure',()=>{
 const m=createTaskAreaState();assert.equal(m.accept(view()),true);assert.equal(m.begin(id(2)),true);
 const next=view(2);next.items.push({id:id(4),name:'Browser',pinned:false,active:true,windows:[]});
 assert.equal(m.accept(next),true);assert.equal(m.read().items.length,1);
 assert.deepEqual(m.finish(id(2)),{contextId:id(1),itemId:id(2),action:'activate',windowId:null});
 assert.equal(m.read().items.length,2);assert.equal(m.finish(id(2)),null);
});
test('context change or removed item cancels pending click',()=>{
 const m=createTaskAreaState();m.accept(view());m.begin(id(2));m.accept(view(2,id(9)));assert.equal(m.finish(id(2)),null);
 m.begin(id(2));m.accept(view(3,id(9),[]));assert.equal(m.finish(id(2)),null);
});
test('removed window selection is not redirected to another window',()=>{
 const m=createTaskAreaState();m.accept(view());assert.equal(m.begin(id(2),id(3),'chooseWindow'),true);
 const next=view(2);next.items[0].windows=[{id:id(4),title:'Other',active:false}];m.accept(next);assert.equal(m.finish(id(2),id(3),'chooseWindow'),null);
 assert.equal(m.begin(id(2),id(4),'chooseWindow'),true);assert.equal(m.finish(id(2),id(4),'chooseWindow').windowId,id(4));
});
test('malformed or stale snapshots preserve current state',()=>{
 const m=createTaskAreaState();const v=view();m.accept(v);v.items[0].name='mutated';assert.equal(m.read().items[0].name,'Editor');
 assert.equal(m.accept(view()),false);assert.equal(m.accept({...view(2),items:[view().items[0],view().items[0]]}),false);
 assert.equal(m.read().sequence,1);assert.throws(()=>{m.read().items.push({});});
});
test('pointer mismatch hidden state and cancellation produce no action',()=>{
 const m=createTaskAreaState();m.accept(view());m.begin(id(2));assert.equal(m.finish(id(8)),null);
 m.begin(id(2));m.setAvailable(false);assert.equal(m.finish(id(2)),null);assert.equal(m.begin(id(2)),false);
 m.setAvailable(true);m.begin(id(2));m.cancel();assert.equal(m.finish(id(2)),null);
 assert.equal(m.begin(id(2),null,'launchPath'),false);
});
