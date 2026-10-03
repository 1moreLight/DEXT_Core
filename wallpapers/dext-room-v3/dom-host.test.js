const test=require('node:test'),assert=require('node:assert/strict');
const {createDomHost}=require('./dom-host.js');
const {createRuntime}=require('./runtime-model.js');
const {createNativeHost}=require('./native-host.js');
const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
function fixture(options={}){
 const room={version:3,apiVersion:1,id:'room',resources:['scene.html','widget.html','bg.svg','start.svg','idle.svg'],roomScene:{entry:'scene.html',capabilities:['desk.read']},
   transition:{type:'slide',durationMs:450},buttons:[{id:'next',name:'Next',scope:'room',action:{type:'desk.next'}}],
   components:[{id:'shared',role:'widget',entry:'widget.html',placement:{x:400,y:50,width:200,height:100},capabilities:[],buttonIds:['next'],config:{theme:'blue'}}],
   desks:[{id:'home',name:'Home',icons:[{id:'icon',buttonId:'next',x:0,y:0,label:'Next'}],components:['shared'],background:{type:'image',src:'bg.svg'}},
     {id:'focus',name:'Focus',icons:[],components:['shared']}]};
 Object.assign(room,options.room||{});
 const snap=(revision=1,changes={})=>({protocolVersion:1,sessionId:'session',roomId:'room',installationStamp:'stamp',revision,currentDeskId:'home',targetDeskId:null,queuedDeskId:null,transitionId:null,deadlineUtc:null,active:true,operable:true,lifecycle:{stage:'desktop',playbackPaused:false,locked:false,revision:1},...changes});
 const calls=[],controls=[],frames=new Map(),medias=new Map(),raf=new Map();let now=0,id=0;
 const node=tag=>({tag,style:{},dataset:{},children:[],attrs:{},handlers:{},hidden:false,setAttribute(k,v){this.attrs[k]=v;},addEventListener(k,cb){this.handlers[k]=cb;},removeEventListener(k){delete this.handlers[k];},append(child){child.parent=this;this.children.push(child);},remove(){if(this.parent)this.parent.children=this.parent.children.filter(c=>c!==this);},getBoundingClientRect(){return{left:0,top:0,width:1920,height:1080};}});
 const document={createElement:node};const container=node('root');
 const bridge=options.native||{identity:null,acceptIdentity(v){this.identity=v;return true;},setSuspended(v){calls.push({method:'suspended',value:v});},request(method,params,scope){calls.push({method,params,scope});return options.request?.(method,params,scope)??Promise.resolve({status:'accepted',buttons:[]});},readCapabilities:async()=>({status:'accepted',capabilities:{'desk.read':'accepted'}}),subscribeData:()=>()=>{},watchCapabilities:()=>()=>{},dispose(){calls.push({method:'dispose'});},readDiagnostics:()=>({})};
 const frameFactory=opts=>({mount(def,parent){const old=frames.get(def.instanceId);if(old)return old.node;const value={def,node:node('iframe'),state:def.state,opts};frames.set(def.instanceId,value);parent.append(value.node);return value.node;},setState(id,state){frames.get(id).state=state;},updateConfig(id,config){frames.get(id).config=config;},acceptSnapshot:v=>{calls.push({method:'frameSnapshot',revision:v.revision});options.onFrameSnapshot?.(v,opts);},setGeometry:v=>calls.push({method:'frameGeometry',value:v}),setPlaybackSuspended:v=>calls.push({method:'framePause',value:v}),refreshPermissions(){},disposeInstance(id){frames.get(id)?.node.remove();frames.delete(id);},dispose(){frames.clear();},readDiagnostics:()=>({count:frames.size})});
 const mediaFactory=opts=>({mount(def,parent){if(medias.has(def.instanceId))return medias.get(def.instanceId).node;const value={def,node:def.content.type==='html'?opts.mountHTML(def,parent):node('img'),opts,state:def.state};if(def.content.type!=='html')parent.append(value.node);medias.set(def.instanceId,value);return value.node;},setState(id,state){medias.get(id).state=state;},refresh(){},completeHTML:id=>medias.has(id),setPlaybackSuspended:v=>calls.push({method:'mediaPause',value:v}),disposeInstance:id=>medias.delete(id),dispose(){medias.clear();},readDiagnostics:()=>({count:medias.size})});
 const host=createDomHost({document,container,context:{runtimeGeneration:1,sessionId:'session',roomId:'room',installationStamp:'stamp',manifest:room,resources:room.resources.map(path=>({path})),resourceBasePath:'/content/1/'},initialSnapshot:options.initialSnapshot||snap(),native:bridge,
   createRuntime,createFrameHost:frameFactory,createMediaHost:mediaFactory,sendControl:v=>controls.push(v),getViewport:()=>({width:1920,height:1080,dpr:1}),now:()=>now,
   requestAnimationFrame:cb=>{raf.set(++id,cb);return id;},cancelAnimationFrame:id=>raf.delete(id)});
 async function advance(ms){now+=ms;const tasks=[...raf];raf.clear();for(const [,cb]of tasks)cb(now);await flush();}
 return{host,room,snap,calls,controls,frames,medias,bridge,container,advance,raf};
}
test('first DOM mutation waits for invalidation and input waits for publication ack',async()=>{
 let release;const f=fixture({request:(method)=>method==='invalidateGeometry'?new Promise(r=>release=r):Promise.resolve({status:'accepted'})});
 assert.equal(f.container.children.length,0);assert.equal(f.host.readDiagnostics().inputReady,false);await flush();release({status:'accepted'});await f.host.ready;
 assert.equal(f.frames.size,2);assert.equal(f.medias.size,1);assert.deepEqual(f.calls.filter(v=>['invalidateGeometry','geometry'].includes(v.method)).map(v=>v.method),['invalidateGeometry','geometry']);assert.equal(f.host.readDiagnostics().inputReady,true);f.host.dispose();
});
test('queue-only revisions republish input and retain shared DOM and animation clock',async()=>{
 const f=fixture();await f.host.ready;const nodes=[...f.frames.values()].map(v=>v.node);
 await f.host.acceptSnapshot(f.snap(2,{targetDeskId:'focus',transitionId:'transition',deadlineUtc:'2030-01-01T00:00:00Z'}));await f.advance(100);
 const elapsed=f.host.readDiagnostics().transition.elapsed;await f.host.acceptSnapshot(f.snap(3,{targetDeskId:'focus',queuedDeskId:'home',transitionId:'transition',deadlineUtc:'2030-01-01T00:00:00Z'}));
 assert.deepEqual([...f.frames.values()].map(v=>v.node),nodes);assert.equal(f.host.readDiagnostics().transition.elapsed,elapsed);
 assert.equal(f.calls.filter(v=>v.method==='geometry').length,3);assert.equal(f.calls.filter(v=>v.method==='geometry').at(-1).scope.revision,3);f.host.dispose();
});
test('default animation transforms the same shared node and only asks Core to commit',async()=>{
 const f=fixture();await f.host.ready;const widget=[...f.frames.values()].find(v=>v.def.consumerId==='component.shared').node;
 await f.host.acceptSnapshot(f.snap(2,{targetDeskId:'focus',transitionId:'transition',deadlineUtc:'2030-01-01T00:00:00Z'}));await f.advance(450);
 assert.equal(f.host.readDiagnostics().currentDeskId,'home');assert.equal(f.controls.filter(v=>v.type==='dext:v3-transition-complete').length,1);
 await f.host.acceptSnapshot(f.snap(3,{currentDeskId:'focus'}));assert.equal([...f.frames.values()].find(v=>v.def.consumerId==='component.shared').node,widget);assert.equal(f.host.readDiagnostics().currentDeskId,'focus');f.host.dispose();
});
test('private playback suspension preserves transition time and retained nodes',async()=>{
 const f=fixture();await f.host.ready;await f.host.acceptSnapshot(f.snap(2,{targetDeskId:'focus',transitionId:'transition',deadlineUtc:'2030-01-01T00:00:00Z'}));await f.advance(100);
 f.host.setPlaybackSuspended(true);await f.advance(1000);assert.equal(f.controls.length,0);assert.equal(f.host.readDiagnostics().transition.elapsed,100);
 f.host.setPlaybackSuspended(false);await flush();await f.advance(350);assert.equal(f.controls.filter(v=>v.type==='dext:v3-transition-complete').length,1);assert.equal(f.frames.size,2);f.host.dispose();
});
test('HTML media delegates to the persistent frame host and startup completion uses current Core identity',async()=>{
 const f=fixture({room:{start:{type:'html',src:'scene.html'},idle:{type:'image',src:'idle.svg'}},initialSnapshot:{protocolVersion:1,sessionId:'session',roomId:'room',installationStamp:'stamp',revision:1,currentDeskId:'home',targetDeskId:null,queuedDeskId:null,transitionId:null,deadlineUtc:null,active:true,operable:false,lifecycle:{stage:'starting',playbackPaused:false,locked:false,revision:4}}});await f.host.ready;
 const start=[...f.medias.values()].find(v=>v.def.consumerId==='slot.start');assert.equal(start.node.tag,'iframe');await start.opts.onStartupComplete({sessionId:'session',revision:1,lifecycleRevision:4});
 assert.deepEqual(f.calls.find(v=>v.method==='startupComplete').params,{lifecycleRevision:4});assert.equal(f.calls.find(v=>v.method==='startupComplete').scope.revision,1);f.host.dispose();
});
test('resource resolution cannot leave the current inventory or generation',async()=>{
 const f=fixture();await f.host.ready;assert.equal(f.host.resolveResource('bg.svg'),'/content/1/bg.svg');
 for(const path of ['https://outside.test','../bg.svg','/bg.svg','undeclared.svg','content/2/bg.svg'])assert.throws(()=>f.host.resolveResource(path));f.host.dispose();
});
test('old snapshot cannot mutate DOM or trigger requests',async()=>{
 const f=fixture();await f.host.ready;const count=f.calls.length;assert.equal(await f.host.acceptSnapshot(f.snap()),false);assert.equal(f.calls.length,count);f.host.dispose();
});
test('author component geometry translates local rects and publishes only its declared active buttons',async()=>{
 const f=fixture();await f.host.ready;const geometryVersion=f.host.readDiagnostics().geometryVersion;
 assert.equal(await f.host.publishGeometry('component.shared',{sessionId:'session',revision:1,transitionId:null,geometryVersion,buttons:[{buttonId:'next',x:10,y:20,width:30,height:40}]}),true);
 const button=f.calls.filter(v=>v.method==='geometry').at(-1).params.buttons.find(v=>v.consumer==='component.shared');assert.equal(button.x,410/1920);assert.equal(button.y,70/1080);
 assert.equal(await f.host.publishGeometry('component.shared',{sessionId:'session',revision:1,transitionId:null,geometryVersion:f.host.readDiagnostics().geometryVersion,groups:{}}),false);f.host.dispose();
});
test('stale native focus or activation cannot use newer geometry',async()=>{
 const f=fixture();await f.host.ready;const version=f.host.readDiagnostics().inputVersion;
 assert.equal(f.host.handleNativeInput({kind:'activate',sessionId:'session',runtimeGeneration:1,revision:1,geometryVersion:version-1,consumer:'official',button:'next'}),false);
 f.host.handleNativeInput({kind:'activate',sessionId:'session',runtimeGeneration:1,revision:1,geometryVersion:version,consumer:'official',button:'next'});await flush();assert.equal(f.calls.filter(v=>v.method==='activate').length,1);f.host.dispose();
});
test('disposed host cannot revive a frame, input or animation',async()=>{
 const f=fixture();await f.host.ready;f.host.dispose();f.host.dispose();assert.equal(await f.host.acceptSnapshot(f.snap(2)),false);assert.equal(f.frames.size,0);assert.equal(f.medias.size,0);assert.equal(f.raf.size,0);assert.equal(f.host.readDiagnostics().inputReady,false);
});

test('author global scale applies around the canvas origin and matches translated input',async()=>{
 const f=fixture({room:{transition:{type:'author',durationMs:450}}});await f.host.ready;
 await f.host.publishGeometry('component.shared',{sessionId:'session',revision:1,transitionId:null,geometryVersion:f.host.readDiagnostics().geometryVersion,buttons:[{buttonId:'next',x:10,y:20,width:30,height:40}]});
 await f.host.publishGeometry('scene',{sessionId:'session',revision:1,transitionId:null,geometryVersion:f.host.readDiagnostics().geometryVersion,groups:{shared:{matrix:[2,0,0,2,10,20],opacity:1}}});
 const widget=f.container.children[0].children.find(v=>v.dataset.consumer==='component.shared');assert.equal(widget.style.transform,'matrix(2,0,0,2,410,70)');
 const button=f.calls.filter(v=>v.method==='geometry').at(-1).params.buttons.find(v=>v.consumer==='component.shared');assert.equal(button.x,830/1920);assert.equal(button.y,160/1080);f.host.dispose();
});

test('busy Core geometry admission retries a newer version instead of leaving input disabled',async()=>{
 let attempts=0;const f=fixture({request:method=>Promise.resolve({status:method==='geometry'&&++attempts===1?'staleInput':'accepted'})});await f.host.ready;
 const geometry=f.calls.filter(v=>v.method==='geometry');assert.equal(geometry.length,2);assert.equal(geometry[1].params.geometryVersion,geometry[0].params.geometryVersion+1);assert.equal(f.host.readDiagnostics().inputReady,true);f.host.dispose();
});

test('new-snapshot frame authorization reaches the production native bridge in the same scope',async()=>{
 const listeners=new Set(),reads=[],identity={runtimeGeneration:1,sessionId:'session',revision:1};
 const native=createNativeHost({initialIdentity:identity,transport:{
  postMessage:raw=>{const q=JSON.parse(raw);queueMicrotask(()=>{for(const receive of listeners)receive({data:{type:'dext:v3-native-response',requestId:q.requestId,runtimeGeneration:q.runtimeGeneration,sessionId:q.sessionId,revision:q.revision,status:'accepted',capabilities:{'desk.read':'accepted'}}});});},
  addEventListener:(_,cb)=>listeners.add(cb),removeEventListener:(_,cb)=>listeners.delete(cb)}});
 const f=fixture({native,onFrameSnapshot:(v,opts)=>reads.push(opts.readCapabilities({consumerId:'scene',identity:{...identity,revision:v.revision}}).then(r=>r.status,e=>e.code))});
 try{await f.host.ready;await f.host.acceptSnapshot(f.snap(2));assert.deepEqual(await Promise.all(reads),['accepted','accepted']);}
 finally{f.host.dispose();}
});

test('official DOM storage forwards fixed consumer and Core JSON without private metadata',async()=>{
 const value={label:'\u65e5\u671f',at:'2026-10-03T00:00:00Z',items:[1,null]};const f=fixture({request:(method)=>Promise.resolve({status:'accepted',value:method==='storageGet'?value:null,buttons:[],targets:'private'})});await f.host.ready;
 const scene=[...f.frames.values()].find(v=>v.def.consumerId==='scene');assert.equal(scene.opts.implementedCapabilities.includes('storage.read'),true);assert.equal(scene.opts.implementedCapabilities.includes('storage.write'),true);
 const identity={runtimeGeneration:1,sessionId:'session',revision:1};const get=await scene.opts.invoke({method:'storage.get',consumerId:'scene',params:{key:'notes'},identity});assert.deepEqual(get,value);assert.equal('targets' in get,false);
 assert.deepEqual(await scene.opts.invoke({method:'storage.set',consumerId:'scene',params:{key:'notes',value},identity}),{status:'accepted'});
 assert.deepEqual(f.calls.filter(v=>v.method.startsWith('storage')).map(v=>[v.method,v.params,v.scope]),[['storageGet',{consumer:'scene',key:'notes'},identity],['storageSet',{consumer:'scene',key:'notes',value},identity]]);f.host.dispose();
});
test('storage refusals and malformed successful replies cannot be treated as saved values',async()=>{
 let status='missingPermission';const f=fixture({request:method=>Promise.resolve(method.startsWith('storage')?{status}: {status:'accepted'})});await f.host.ready;const scene=[...f.frames.values()].find(v=>v.def.consumerId==='scene'),identity={runtimeGeneration:1,sessionId:'session',revision:1};
 await assert.rejects(scene.opts.invoke({method:'storage.set',consumerId:'scene',params:{key:'notes',value:1},identity}),{code:'missingPermission'});status='accepted';
 await assert.rejects(scene.opts.invoke({method:'storage.get',consumerId:'scene',params:{key:'notes'},identity}),{code:'storageUnavailable'});f.host.dispose();
});
