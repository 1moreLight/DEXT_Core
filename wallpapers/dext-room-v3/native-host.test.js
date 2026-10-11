const test=require('node:test');
const assert=require('node:assert/strict');
const {createNativeHost}=require('./native-host.js');
const identity={runtimeGeneration:1,sessionId:'room-session',revision:1};
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function fixture(){
 let time=0,next=1;const tasks=new Map(),sent=[],listeners=new Set();
 const host=createNativeHost({initialIdentity:identity,transport:{postMessage:v=>{assert.equal(typeof v,'string');sent.push(JSON.parse(v));},addEventListener:(_,cb)=>listeners.add(cb),removeEventListener:(_,cb)=>listeners.delete(cb)},
   setTimeout:(cb,ms)=>{const id=next++;tasks.set(id,{cb,due:time+ms});return id;},clearTimeout:id=>tasks.delete(id)});
 function answer(request,payload={}){for(const cb of listeners)cb({data:{type:'dext:v3-native-response',requestId:request.requestId,...identity,runtimeGeneration:request.runtimeGeneration,sessionId:request.sessionId,revision:request.revision,status:'accepted',...payload}});}
 async function advance(ms){time+=ms;for(const [id,task]of [...tasks])if(task.due<=time){tasks.delete(id);task.cb();}await flush();}
 return{host,sent,tasks,listeners,answer,advance};
}
test('native request sends only fixed consumer identity and current scope',async()=>{
 const f=fixture();const promise=f.host.readCapabilities({consumerId:'scene',identity});const q=f.sent[0];
 assert.deepEqual(q,{type:'dext:v3-native-request',protocolVersion:1,requestId:'n1',method:'capabilities',...identity,consumer:'scene'});
 f.answer(q,{capabilities:{'time.read':'accepted'}});assert.equal((await promise).capabilities['time.read'],'accepted');f.host.dispose();
});
test('wrong scope or unknown reply cannot complete a request',async()=>{
 const f=fixture();let finished=false;const promise=f.host.request('buttons',{consumer:'scene'}).then(()=>finished=true);
 f.answer(f.sent[0],{revision:2,buttons:[]});await flush();assert.equal(finished,false);
 f.answer(f.sent[0],{requestId:'unknown',buttons:[]});await flush();assert.equal(finished,false);
 f.answer(f.sent[0],{buttons:[]});await promise;f.host.dispose();
});
test('revision advancement cancels old requests and stale replies do not escape',async()=>{
 const f=fixture();const result=f.host.request('buttons',{consumer:'scene'}).catch(e=>e.code);
 assert.equal(f.host.acceptIdentity({...identity,revision:2}),true);assert.equal(await result,'staleInput');
 assert.equal(f.host.acceptIdentity(identity),false);f.answer(f.sent[0],{buttons:[{id:'private'}]});assert.equal(f.host.readDiagnostics().pendingRequests,0);f.host.dispose();
});
test('timeouts and pending limit are bounded and release all request timers',async()=>{
 const f=fixture();const promises=[];for(let i=0;i<64;i++)promises.push(f.host.request('buttons',{consumer:'scene'}).catch(e=>e.code));
 await assert.rejects(f.host.request('buttons',{consumer:'scene'}),e=>e.code==='requestLimit');await f.advance(5000);
 assert.deepEqual(await Promise.all(promises),Array(64).fill('timeout'));assert.equal(f.tasks.size,0);f.host.dispose();
});
test('malformed methods and authored authority fields never reach WebView',async()=>{
 const f=fixture();for(const [method,params]of [['data',{consumer:'scene',capability:'time.read',value:'forged'}],['data',{consumer:'scene',capability:'storage.read'}],['activate',{consumer:'scene',button:'open',geometryVersion:0}],['anything',{}]])
 await assert.rejects(f.host.request(method,params),e=>e.code==='invalidArgument');assert.equal(f.sent.length,0);f.host.dispose();
});
test('one data provider polls only after completion and reauthorizes each value',async()=>{
 const f=fixture(),values=[];const stop=f.host.subscribeData({consumerId:'scene',capability:'time.read',identity},s=>values.push(s));
 assert.equal(f.sent.length,1);await f.advance(1000);assert.equal(f.sent.length,1);
 f.answer(f.sent[0],{data:{status:'available',value:{tick:1}}});await flush();assert.deepEqual(values,[{status:'available',value:{tick:1}}]);
 await f.advance(1000);assert.equal(f.sent.length,2);assert.equal(f.sent[1].method,'data');
 f.answer(f.sent[1],{status:'missingPermission',data:{status:'available',value:{tick:99}}});await flush();assert.deepEqual(values.at(-1),{status:'denied'});
 stop();assert.equal(f.tasks.size,0);f.host.dispose();
});
test('unsubscribed or old-revision data can never publish a late value',async()=>{
 const f=fixture(),values=[];const stop=f.host.subscribeData({consumerId:'scene',capability:'time.read',identity},s=>values.push(s));stop();
 f.answer(f.sent[0],{data:{status:'available',value:'old'}});await flush();assert.deepEqual(values,[]);
 f.host.subscribeData({consumerId:'scene',capability:'time.read',identity},s=>values.push(s));f.host.acceptIdentity({...identity,revision:2});
 f.answer(f.sent[1],{data:{status:'available',value:'old'}});await flush();assert.deepEqual(values,[]);assert.equal(f.tasks.size,0);f.host.dispose();
});
test('suspension stops reads and permission watch recovers without global revision changes',async()=>{
 const f=fixture(),changes=[];const release=f.host.watchCapabilities('scene',reply=>changes.push(reply.capabilities?.['time.read']));
 f.answer(f.sent[0],{capabilities:{'time.read':'accepted'}});await flush();await f.advance(1000);
 f.answer(f.sent[1],{capabilities:{'time.read':'missingPermission'}});await flush();await f.advance(1000);
 f.answer(f.sent[2],{capabilities:{'time.read':'accepted'}});await flush();assert.deepEqual(changes,['accepted','missingPermission','accepted']);
 f.host.setSuspended(true);const count=f.sent.length;await f.advance(5000);assert.equal(f.sent.length,count);
 await assert.rejects(f.host.request('buttons',{consumer:'scene'}),e=>e.code==='notOperable');f.host.setSuspended(false);assert.equal(f.sent.length,count+1);
 release();f.host.dispose();await flush();assert.equal(f.tasks.size,0);assert.equal(f.listeners.size,0);
});
test('available data is bounded JSON; failures strip attached private values',async()=>{
 const f=fixture(),values=[];const stop=f.host.subscribeData({consumerId:'scene',capability:'time.read',identity},v=>values.push(v));
 f.answer(f.sent[0],{data:{status:'missing',value:'private'}});await flush();assert.deepEqual(values,[{status:'missing'}]);await f.advance(1000);
 f.answer(f.sent[1],{data:{status:'available',value:'x'.repeat(32769)}});await flush();assert.deepEqual(values.at(-1),{status:'error'});stop();f.host.dispose();
});
test('dispose is permanent and releases an outstanding watcher and data read',async()=>{
 const f=fixture();f.host.watchCapabilities('scene',()=>{});f.host.subscribeData({consumerId:'scene',capability:'time.read',identity},()=>{throw new Error('late');});
 f.host.dispose();f.host.dispose();await flush();assert.equal(f.tasks.size,0);assert.equal(f.listeners.size,0);assert.equal(f.host.acceptIdentity({...identity,revision:2}),false);
 await assert.rejects(f.host.request('buttons',{consumer:'scene'}),e=>e.code==='disposed');
});

test('storage queries carry only current consumer key and detached bounded JSON',async()=>{
 const f=fixture(),value={label:'\u65e5\u671f',at:'2026-10-03T00:00:00Z',items:[1,true,null]};
 const put=f.host.request('storageSet',{consumer:'component.shared',key:'notes',value});put.catch(()=>{});value.items.push(2);
 assert.deepEqual(f.sent[0],{type:'dext:v3-native-request',protocolVersion:1,requestId:'n1',method:'storageSet',...identity,consumer:'component.shared',key:'notes',value:{label:'\u65e5\u671f',at:'2026-10-03T00:00:00Z',items:[1,true,null]}});
 f.answer(f.sent[0]);assert.equal((await put).status,'accepted');const get=f.host.request('storageGet',{consumer:'component.shared',key:'notes'});f.answer(f.sent[1],{value:null});assert.equal((await get).value,null);f.host.dispose();
});
test('malformed storage data and authority aliases never reach the native bridge',async()=>{
 const f=fixture();for(const [method,params]of [['storageGet',{consumer:'scene',key:'../private'}],['storageGet',{consumer:'scene',key:'notes',path:'C:/private'}],['storageSet',{consumer:'scene',key:'notes'}],['storageSet',{consumer:'scene',key:'notes',value:Infinity}],['storageSet',{consumer:'scene',key:'notes',value:Array(4097).fill(0)}],['storageSet',{consumer:'scene',key:'notes',value:'x'.repeat(32769)}]])
 await assert.rejects(f.host.request(method,params),e=>e.code==='invalidArgument');assert.equal(f.sent.length,0);f.host.dispose();
});

test('strict navigation carries private correlation and cannot name a binding or proof',async()=>{
 const f=fixture();
 for(const action of [{type:'desk.next'},{type:'desk.previous'},{type:'desk.go',deskId:'focus'}]){
 const promise=f.host.request('navigate',{consumer:'scene',action,geometryVersion:1,inputSequence:0});promise.catch(()=>{});const request=f.sent.at(-1);assert.equal(request.method,'navigate');
 f.answer(request,{status:'queued',inputSequence:7,inputConsumed:true});assert.equal((await promise).status,'queued');}
 for(const params of [{consumer:'scene',action:{type:'binding.launch'},geometryVersion:1,inputSequence:0},{consumer:'scene',action:{type:'desk.next',deskId:'focus'},geometryVersion:1,inputSequence:0},{consumer:'scene',action:{type:'desk.go'},geometryVersion:1,inputSequence:0},{consumer:'scene',action:{type:'desk.next'},geometryVersion:1,inputSequence:-1},{consumer:'scene',action:{type:'desk.next'},geometryVersion:1,inputSequence:0,ticket:'fake'}])
 await assert.rejects(f.host.request('navigate',params),{code:'invalidArgument'});assert.equal(f.sent.length,3);f.host.dispose();
});
test('expired action response resolves and invalid private consumption receipts are ignored',async()=>{
 const f=fixture();let done=false;
 const promise=f.host.request('activate',{consumer:'scene',button:'open',geometryVersion:1,inputSequence:4}).then(v=>{done=true;return v;});promise.catch(()=>{});
 const request=f.sent.at(-1);assert.equal(request.method,'activate');f.answer(request,{status:'expiredInput',inputSequence:1.2,inputConsumed:true});await flush();assert.equal(done,false);
 f.answer(request,{status:'expiredInput',inputSequence:4,inputConsumed:false});assert.equal((await promise).status,'expiredInput');f.host.dispose();
});

test('a completed native navigation receipt may follow its own same-document Core revision',async()=>{
 const f=fixture();const promise=f.host.request('navigate',{consumer:'scene',action:{type:'desk.next'},geometryVersion:1,inputSequence:0}).catch(e=>({status:e.code}));const request=f.sent.at(-1);
 f.host.acceptIdentity({...identity,revision:2});f.answer(request,{status:'accepted',inputSequence:7,inputConsumed:true});
 assert.equal((await promise).status,'accepted');f.host.dispose();
});
test('pending actions still retire on native generation change or playback suspension',async()=>{
 for(const mode of ['generation','pause']){const f=fixture();const promise=f.host.request('navigate',{consumer:'scene',action:{type:'desk.next'},geometryVersion:1,inputSequence:0}).catch(e=>e.code);const request=f.sent.at(-1);
 if(mode==='generation')f.host.acceptIdentity({...identity,runtimeGeneration:2});else f.host.setSuspended(true);
 f.answer(request,{status:'accepted',inputSequence:7,inputConsumed:true});assert.equal(await promise,mode==='generation'?'staleInput':'notOperable');f.host.dispose();}
});


test('native controls whitelist actions and patches and require private completion receipts',async()=>{
 const f=fixture(),base={consumer:'scene',geometryVersion:1,inputSequence:7};
 for(const action of ['play','pause','toggle','next','previous']){
   const pending=f.host.request('mediaControl',{...base,action});pending.catch(()=>{});
   assert.equal(f.sent.at(-1)?.action,action);f.answer(f.sent.at(-1),{inputSequence:7,inputConsumed:true});assert.equal((await pending).status,'accepted');
 }
 for(const settings of [{volume:0},{volume:1},{muted:true},{volume:.5,muted:false}]){
   const pending=f.host.request('audioControl',{...base,settings});pending.catch(()=>{});
   assert.deepEqual(f.sent.at(-1).settings,settings);f.answer(f.sent.at(-1),{status:'controlUnavailable',inputSequence:7,inputConsumed:true});assert.equal((await pending).status,'controlUnavailable');
 }
 f.host.dispose();
});
test('invalid native controls never reach the private bridge',async()=>{
 const f=fixture(),base={consumer:'scene',geometryVersion:1,inputSequence:0};
 for(const [method,extra]of [['mediaControl',{action:'seek'}],['mediaControl',{action:'play',button:'fake'}],['audioControl',{settings:{}}],['audioControl',{settings:{volume:2}}],['audioControl',{settings:{volume:null}}],['audioControl',{settings:{muted:1}}],['audioControl',{settings:{path:'private'}}],['audioControl',{settings:{volume:NaN}}]]){
   await assert.rejects(f.host.request(method,{...base,...extra}),{code:'invalidArgument'});
 }
 assert.equal(f.sent.length,0);f.host.dispose();
});
test('control receipts survive same-document revision but require authentic consumption fields',async()=>{
 const f=fixture(),p=f.host.request('mediaControl',{consumer:'scene',action:'pause',geometryVersion:1,inputSequence:7});p.catch(()=>{});let done=false;p.then(()=>done=true,()=>done=true);
 assert.equal(f.sent.length,1);f.host.acceptIdentity({...identity,revision:2});f.answer(f.sent[0],{inputSequence:0,inputConsumed:true});await flush();assert.equal(done,false);
 f.answer(f.sent[0],{status:'rateLimited',inputSequence:7,inputConsumed:false});assert.equal((await p).status,'rateLimited');f.host.dispose();
});
test('pause replacement and disposal cancel outstanding controls',async()=>{
 for(const mode of ['pause','generation','dispose']){
   const f=fixture(),p=f.host.request('audioControl',{consumer:'scene',settings:{muted:true},geometryVersion:1,inputSequence:0}).catch(e=>e.code);
   assert.equal(f.sent.length,1);
   if(mode==='pause')f.host.setSuspended(true);else if(mode==='generation')f.host.acceptIdentity({...identity,runtimeGeneration:2});else f.host.dispose();
   assert.equal(await p,mode==='pause'?'notOperable':mode==='dispose'?'disposed':'staleInput');f.host.dispose();
 }
});

test('official layout read/save use current identity independent revision and closed coordinates',async()=>{
 const f=fixture(),layout={revision:0,icons:{},components:{}};
 const read=f.host.request('layoutRead',{}).catch(e=>e.code);assert.equal(f.sent.length,1);f.answer(f.sent[0],{layout});assert.deepEqual((await read).layout,layout);
 const save=f.host.request('layoutSave',{layoutRevision:0,change:{kind:'icon',id:'icon-1',deskId:'home',x:240,y:360}}).catch(e=>e.code);
 assert.equal(f.sent[1].layoutRevision,0);assert.equal(f.sent[1].change.x,240);f.answer(f.sent[1],{layout:{...layout,revision:1}});assert.equal((await save).layout.revision,1);
 for(const change of [{kind:'icon',id:'i',deskId:'home',x:1825,y:0},{kind:'widget',id:'w',x:0,y:0,width:0,height:100},{kind:'dock',id:'w',x:0,y:0,width:100,height:100}]){
  await assert.rejects(f.host.request('layoutSave',{layoutRevision:1,change}),e=>e.code==='invalidArgument');
 }
 await assert.rejects(f.host.request('layoutRead',{consumer:'scene'}),e=>e.code==='invalidArgument');f.host.dispose();
});
test('private layout read alone may run during pause; save and author data remain stopped',async()=>{
 const f=fixture();f.host.setSuspended(true);const read=f.host.request('layoutRead',{}).catch(e=>e.code);assert.equal(f.sent.length,1);
 f.answer(f.sent[0],{layout:{revision:3,icons:{},components:{}}});assert.equal((await read).layout.revision,3);
 for(const [method,params]of [['layoutSave',{layoutRevision:3,change:{kind:'icon',id:'i',deskId:'home',x:0,y:0}}],['data',{consumer:'scene',capability:'time.read'}]])
  await assert.rejects(f.host.request(method,params),e=>e.code==='notOperable');f.host.dispose();
});
test('layout reply rejects unknown fields invalid coordinates and stale identity',async()=>{
 const f=fixture();const result=f.host.request('layoutRead',{}).catch(e=>e.code);assert.equal(f.sent.length,1);
 f.answer(f.sent[0],{layout:{revision:1,icons:{},components:{},targets:{}}});assert.equal(await result,'invalidPayload');f.host.dispose();
});

const preciseEntry=(entryId='icon.home/first')=>({consumer:'official',button:'open',entryId,x:.1,y:.1,width:.3,height:.2,tabIndex:0,polygons:[[{x:.1,y:.1},{x:.4,y:.1},{x:.4,y:.3},{x:.1,y:.3}]]});
test('private precise entries allow two presentations of one action and preserve their polygons',async()=>{
 const f=fixture(),params={geometryVersion:1,viewport:{width:1920,height:1080,dpr:1},buttons:[preciseEntry(),{...preciseEntry('icon.home/second'),tabIndex:1}]};
 const result=f.host.request('geometry',params).catch(e=>e.code);assert.equal(f.sent.length,1);assert.deepEqual(f.sent[0].buttons,params.buttons);f.answer(f.sent[0]);assert.equal((await result).status,'accepted');f.host.dispose();
});
test('precise geometry rejects malformed shapes budgets identity collisions and rectangle disagreement',async()=>{
 const f=fixture(),base={geometryVersion:1,viewport:{width:1920,height:1080,dpr:1}};
 const bad=[
 {...preciseEntry(),entryId:'x'.repeat(193)}, {...preciseEntry(),entryId:'bad'+String.fromCharCode(127)}, {...preciseEntry(),entryId:null},
 {...preciseEntry(),polygons:null}, {...preciseEntry(),polygons:[]},
 {...preciseEntry(),polygons:[[{x:.1,y:.1},{x:.4,y:.3},{x:.4,y:.1},{x:.1,y:.3}]]},
 {...preciseEntry(),polygons:[[{x:.1,y:.1},{x:.4,y:.1},{x:.2,y:.2},{x:.4,y:.3},{x:.1,y:.3}]]},
 {...preciseEntry(),polygons:[[{x:.1,y:.1},{x:.4,y:.1},{x:.4,y:.3},{x:.1,y:.3},{x:.1,y:.1}]]},
 {...preciseEntry(),polygons:[[{x:.1,y:.1},{x:.4,y:.1},{x:NaN,y:.3}]]},
 {...preciseEntry(),x:.09}, {...preciseEntry(),polygons:Array(65).fill(preciseEntry().polygons[0])},
 {...preciseEntry(),polygons:[Array(33).fill({x:.1,y:.1})]},
 {...preciseEntry(),proof:'forged'}, {...preciseEntry(),polygons:[preciseEntry().polygons[0].map(p=>({...p,extra:1}))]}
 ];
 for(const b of bad)await assert.rejects(f.host.request('geometry',{...base,buttons:[b]}),{code:'invalidArgument'});
 await assert.rejects(f.host.request('geometry',{...base,buttons:[preciseEntry(),preciseEntry()]}),{code:'invalidArgument'});
 const {entryId,polygons,...legacy}=preciseEntry();await assert.rejects(f.host.request('geometry',{...base,buttons:[legacy,preciseEntry()]}),{code:'invalidArgument'});
 assert.equal(f.sent.length,0);f.host.dispose();
});
test('native focus and activation events have closed kind-specific identities',()=>{
 const listeners=new Set(),events=[];
 const host=createNativeHost({initialIdentity:identity,onInput:e=>events.push(e),transport:{postMessage(){},addEventListener:(_,cb)=>listeners.add(cb),removeEventListener:(_,cb)=>listeners.delete(cb)}});
 const event={type:'dext:v3-native-event',...identity,geometryVersion:1,kind:'focus',consumer:'official',button:'open',entryId:'icon.home/first'};
 const send=e=>{for(const cb of listeners)cb({data:e});};
 send(event);send({...event,consumer:null,button:null,entryId:null});
 send({...event,entryId:'x'.repeat(193)});send({...event,consumer:null,button:null,entryId:'dangling'});
 send({...event,kind:'activate',consumer:null,button:null,entryId:null,inputSequence:1});send({...event,kind:'activate',inputSequence:0});send({...event,unknown:'forged'});
 send({...event,kind:'activate',inputSequence:1});assert.equal(events.length,3);host.dispose();
});

test('official author route retains the original SDK envelope while Player selects positive native correlation',async()=>{
 const f=fixture(),params={consumer:'scene',instanceId:'instance',requestJson:JSON.stringify({requestId:'r1',method:'actions.activate',params:{buttonId:'open'}}),geometryVersion:3};
 const p=f.host.request('authorInput',params);assert.equal(f.sent.length,1);assert.equal('inputSequence' in f.sent[0],false);
 f.answer(f.sent[0],{inputSequence:7,inputConsumed:true});assert.equal((await p).inputSequence,7);f.host.dispose();
});
test('desktop presentation accepts a full snapshot then a context-only cache reply',async()=>{
 const f=fixture(),desktop={contextId:'scan1',deskId:'home',items:[{id:'desktop-'+'a'.repeat(64),name:'File.txt',kind:'file',slot:0,iconPng:null}],issueCount:0,truncated:false};
 try{
  let promise=f.host.request('presentationRead',{});
  f.answer(f.sent.at(-1),{presentation:{revision:1,skins:{},locator:null,desktop}});
  assert.equal((await promise).presentation.desktop.items[0].name,'File.txt');
  promise=f.host.request('presentationRead',{desktopContextId:'scan1'});
  assert.equal(f.sent.at(-1).desktopContextId,'scan1');
  f.answer(f.sent.at(-1),{presentation:{revision:1,skins:{},locator:null,desktop:{...desktop,items:null}}});
  assert.equal((await promise).presentation.desktop.items,null);
 }finally{f.host.dispose();}
});

test('desktop drop uses native additional objects and survives ordinary pause and revision changes',async()=>{
 const sent=[],objects=[],listeners=new Set(),timers=new Map();let serial=0;
 const host=createNativeHost({initialIdentity:identity,transport:{postMessage:()=>assert.fail('plain JSON transport'),
  postMessageWithAdditionalObjects:(json,files)=>{sent.push(JSON.parse(json));objects.push(files);},
  addEventListener:(_,cb)=>listeners.add(cb),removeEventListener:(_,cb)=>listeners.delete(cb)},
  setTimeout:(cb)=>{timers.set(++serial,cb);return serial;},clearTimeout:id=>timers.delete(id)});
 host.setSuspended(true);
 const files=[{name:'one.txt'}],params={desktopContextId:'ctx',deskId:'home',x:.2,y:.3,modifiers:1,allowedEffects:'all'};
 const result=host.dropFiles(params,files);
 assert.equal(sent.length,1);assert.equal(objects[0],files);assert.equal(Object.hasOwn(sent[0],'files'),false);
 host.setSuspended(false);host.setSuspended(true);host.acceptIdentity({...identity,revision:2});
 for(const cb of listeners)cb({data:{type:'dext:v3-native-response',requestId:sent[0].requestId,...identity,status:'cancelled',data:null}});
 assert.equal((await result).status,'cancelled');assert.equal(timers.size,0);host.dispose();
});

test('desktop activation preserves native key modifiers and system double-click settings',()=>{
 let receive;const events=[];
 const host=createNativeHost({initialIdentity:identity,onInput:value=>events.push(value),transport:{postMessage(){},addEventListener:(_name,cb)=>receive=cb,removeEventListener(){}}});
 const value={type:'dext:v3-native-event',...identity,kind:'activate',geometryVersion:1,inputSequence:1,consumer:'official.desktop',button:'desktop-file',entryId:'desktop.scan/file',
  desktopInput:{key:0,modifiers:3,x:123,y:456,at:1000,doubleClickTime:500,doubleClickWidth:4,doubleClickHeight:4}};
 receive({data:value});assert.deepEqual(events,[value]);host.dispose();
});
test('native rename waits through its dialog pause and revision until receipt',async()=>{
 for(const method of ['desktopRename','desktopPaste']){
  const f=fixture();
  try{
   const result=f.host.request(method,{consumer:'official.desktop',button:method==='desktopPaste'?'desktop.paste':'desktop-a',geometryVersion:1,inputSequence:1}).catch(e=>({error:e.code}));
   await flush();assert.equal(f.sent.length,1);
   f.host.setSuspended(true);f.host.acceptIdentity({...identity,revision:2});await f.advance(6000);
   assert.equal(f.host.readDiagnostics().pendingRequests,1);
   f.answer(f.sent[0],{inputSequence:1,inputConsumed:true,data:{completed:1}});
   assert.equal((await result).data.completed,1);
  }finally{f.host.dispose();}
 }
});

test('desktop open sends selected IDs and retains the native action receipt across revision',async()=>{
 for(const method of ['desktopOpen','desktopCopy','desktopCut','desktopDelete']){
  const f=fixture();const params={consumer:'official.desktop',button:'desktop-a',selectedIds:['desktop-a','desktop-b'],geometryVersion:1,inputSequence:2};
  try{
   const promise=f.host.request(method,params).catch(e=>({error:e.code}));await flush();
   assert.deepEqual(f.sent[0]?.selectedIds,params.selectedIds);
   f.host.setSuspended(true);f.host.acceptIdentity({...identity,revision:2});f.answer(f.sent[0],{inputSequence:2,inputConsumed:true});
   assert.equal((await promise).inputConsumed,true);
  }finally{f.host.dispose();}
 }
});
