// Runs the authored widget script with a delayed storage transport, not a live Core.
const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../../rooms/v3-orbit-lab/widget/main.js'),'utf8');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
async function fixture(initial=0) {
 const nodes=new Map(),writes=[],pending=[];let click,stored=initial;
 const node=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',addEventListener:(event,fn)=>{if(id==='cycle'&&event==='click')click=fn;},getBoundingClientRect:()=>({x:0,y:0,width:10,height:10})});return nodes.get(id);};
 const unsubscribe=()=>{};
 const context={URLSearchParams,location:{search:''},crypto:{randomUUID:()=> 'fixture-instance'},document:{getElementById:node},addEventListener:()=>{},requestAnimationFrame:()=>1,cancelAnimationFrame:()=>{},queueMicrotask,
  Dext:{session:{},config:{subscribe:()=>unsubscribe,get:()=>({})},scene:{subscribeGeometry:()=>unsubscribe,publishGeometry:async()=>({status:'accepted'})},
   desk:{subscribe:fn=>{fn({operable:true,targetDeskId:null});return unsubscribe;}},
   capabilities:{subscribe:fn=>{fn({'storage.read':'available','storage.write':'available'});return unsubscribe;}},data:{subscribe:()=>unsubscribe},
   storage:{get:async()=>stored,set:(key,value)=>{writes.push(value);return new Promise(resolve=>pending.push(status=>{if(status==='accepted')stored=value;resolve({status});}));}},actions:{activate:async()=>({status:'accepted'})},dispose:()=>{}}};
 vm.runInNewContext(source,context);await flush();
 return {nodes,writes,click:async()=>{click();await flush();},complete:async status=>{assert.ok(pending.length,'a save must be pending');pending.shift()(status);await flush();},stored:()=>stored};
}
(async()=>{
 const f=await fixture(4);await f.click();await f.click();
 assert.deepEqual(f.writes,[5],'only one save may be in flight');
 await f.complete('accepted');
 assert.deepEqual(f.writes,[5,6],'successful stale completion must schedule latest count');
 assert.notEqual(f.nodes.get('memory-state').textContent,'本机记忆 · 已保存','pending latest count must not claim saved');
 await f.complete('accepted');assert.equal(f.stored(),6);assert.equal(f.nodes.get('memory-state').textContent,'本机记忆 · 已保存');
 const reopened=await fixture(f.stored());assert.equal(reopened.nodes.get('count').textContent,'06');
 const failed=await fixture();await failed.click();await failed.click();await failed.complete('denied');
 assert.deepEqual(failed.writes,[1],'denied writes must not spin retries');
 assert.notEqual(failed.nodes.get('memory-state').textContent,'本机记忆 · 已保存');
 console.log('PASS delayed save coalesces latest count, accurate saved state, next document reads persisted count, failure does not spin');
})().catch(error=>{console.error(error);process.exitCode=1;});
