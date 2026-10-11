const test=require('node:test'),assert=require('node:assert/strict');
const {createPressEdit}=require('./press-edit.js');
function fixture(){let timer,allowed=true;const calls=[];const edit=createPressEdit({setTimeout:cb=>(timer=cb,1),clearTimeout:()=>timer=null,eligible:()=>allowed,
 begin:v=>calls.push(['begin',v]),preview:(...v)=>calls.push(['preview',...v]),commit:(...v)=>calls.push(['commit',...v]),cancel:v=>calls.push(['cancel',v])});
 return{edit,calls,hold:()=>{const cb=timer;timer=null;cb?.();},deny:()=>allowed=false};}
test('short press leaves normal action intact and writes nothing',()=>{const f=fixture();f.edit.down({id:1,x:20,y:20},'icon');assert.equal(f.edit.up({id:1,x:20,y:20}),false);f.hold();assert.deepEqual(f.calls,[]);assert.equal(f.edit.suppresses(1),false);});
test('long press drags beyond click tolerance and suppresses only its own action',()=>{const f=fixture();f.edit.down({id:3,x:20,y:20},'widget');f.hold();f.edit.move({id:3,x:220,y:120});assert.equal(f.edit.up({id:3,x:230,y:120}),true);assert.deepEqual(f.calls.at(-1),['commit','widget',210,100]);assert.equal(f.edit.suppresses(3),true);assert.equal(f.edit.suppresses(4),false);});
test('movement before hold cancels editing',()=>{const f=fixture();f.edit.down({id:1,x:0,y:0},'icon');f.edit.move({id:1,x:9,y:0});f.hold();assert.deepEqual(f.calls,[]);});
test('cancel after hold restores position but still suppresses release activation',()=>{const f=fixture();f.edit.down({id:1,x:0,y:0},'icon');f.hold();f.edit.cancel();f.edit.up({id:1,x:30,y:30});assert.deepEqual(f.calls.map(x=>x[0]),['begin','cancel']);assert.equal(f.edit.suppresses(1),true);});
test('scope or pause revocation cannot commit',()=>{const f=fixture();f.edit.down({id:1,x:0,y:0},'icon');f.hold();f.deny();f.edit.up({id:1,x:30,y:30});assert.deepEqual(f.calls.map(x=>x[0]),['begin','cancel']);});
test('old pointer cannot move or finish new hold',()=>{const f=fixture();f.edit.down({id:1,x:0,y:0},'icon');f.edit.down({id:2,x:0,y:0},'widget');f.hold();f.edit.up({id:1,x:20,y:20});assert.equal(f.edit.read().phase,'dragging');});
