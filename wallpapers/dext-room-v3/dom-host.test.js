const test=require('node:test'),assert=require('node:assert/strict');
const {createDomHost}=require('./dom-host.js');
const {createRuntime}=require('./runtime-model.js');
const {createNativeHost}=require('./native-host.js');
const layoutModel=require('./layout-model.js');
const geometry=require('./geometry.js');
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
 const node=tag=>({tag,style:{},dataset:{},children:[],attrs:{},handlers:{},hidden:false,setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];},addEventListener(k,cb){this.handlers[k]=cb;},removeEventListener(k){delete this.handlers[k];},append(child){child.parent=this;this.children.push(child);},remove(){if(this.parent)this.parent.children=this.parent.children.filter(c=>c!==this);},getBoundingClientRect(){return{left:0,top:0,width:1920,height:1080};}});
 const document={createElement:node,createElementNS:(_ns,tag)=>node(tag)};const container=node('root');
 const bridge=options.native||{dropFiles:(params,files,scope)=>options.dropFiles?.(params,files,scope),identity:null,acceptIdentity(v){this.identity=v;return true;},setSuspended(v){calls.push({method:'suspended',value:v});},request(method,params,scope){calls.push({method,params,scope});return options.request?.(method,params,scope)??Promise.resolve({status:'accepted',buttons:[],...(method==='layoutRead'?{layout:{revision:0,icons:{},components:{}}}:{})});},readCapabilities:async()=>({status:'accepted',capabilities:{'desk.read':'accepted'}}),subscribeData:()=>()=>{},watchCapabilities:()=>()=>{},dispose(){calls.push({method:'dispose'});},readDiagnostics:()=>({})};
 const frameFactory=opts=>({mount(def,parent){const old=frames.get(def.instanceId);if(old)return old.node;const value={def,node:node('iframe'),state:def.state,opts};frames.set(def.instanceId,value);parent.append(value.node);return value.node;},setState(id,state){frames.get(id).state=state;},updateConfig(id,config){frames.get(id).config=config;},acceptSnapshot:v=>{calls.push({method:'frameSnapshot',revision:v.revision});options.onFrameSnapshot?.(v,opts);},setGeometry:v=>calls.push({method:'frameGeometry',value:v}),setPlaybackSuspended:v=>calls.push({method:'framePause',value:v}),refreshPermissions(){},disposeInstance(id){frames.get(id)?.node.remove();frames.delete(id);},dispose(){frames.clear();},readDiagnostics:()=>({count:frames.size})});
 const mediaFactory=opts=>({mount(def,parent){if(medias.has(def.instanceId))return medias.get(def.instanceId).node;const value={def,node:def.content.type==='html'?opts.mountHTML(def,parent):node('img'),opts,state:def.state};if(def.content.type!=='html')parent.append(value.node);medias.set(def.instanceId,value);return value.node;},setState(id,state){medias.get(id).state=state;},refresh(){},completeHTML:id=>medias.has(id),setPlaybackSuspended:v=>calls.push({method:'mediaPause',value:v}),disposeInstance:id=>medias.delete(id),dispose(){medias.clear();},readDiagnostics:()=>({count:medias.size})});
 const host=createDomHost({document,container,context:{viewKind:options.viewKind,runtimeGeneration:1,sessionId:'session',roomId:'room',installationStamp:'stamp',manifest:room,resources:room.resources.map(path=>({path})),resourceBasePath:'/content/1/'},initialSnapshot:options.initialSnapshot||snap(),native:bridge,
   layoutModel,geometry,createRuntime,createFrameHost:frameFactory,createMediaHost:mediaFactory,sendControl:v=>controls.push(v),getViewport:options.getViewport||(()=>({width:1920,height:1080,dpr:1})),now:()=>now,
   requestAnimationFrame:cb=>{raf.set(++id,cb);return id;},cancelAnimationFrame:id=>raf.delete(id),setTimeout:options.setTimeout,clearTimeout:options.clearTimeout});
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
 assert.equal(f.calls.filter(v=>v.method==='geometry').at(-1).params.eventSamples,false);
 assert.equal(await f.host.publishGeometry('component.shared',{sessionId:'session',revision:1,transitionId:null,geometryVersion:f.host.readDiagnostics().geometryVersion,groups:{}}),false);f.host.dispose();
});
test('stale native focus or activation cannot use newer geometry',async()=>{
 const f=fixture();await f.host.ready;const version=f.host.readDiagnostics().inputVersion;
 assert.equal(f.host.handleNativeInput({kind:'activate',sessionId:'session',runtimeGeneration:1,revision:1,geometryVersion:version-1,consumer:'official',button:'next'}),false);
 f.host.handleNativeInput({kind:'activate',sessionId:'session',runtimeGeneration:1,revision:1,geometryVersion:version,inputSequence:1,consumer:'official',button:'next'});await flush();assert.equal(f.calls.filter(v=>v.method==='activate').length,1);f.host.dispose();
});
test('disposed host cannot revive a frame, input or animation',async()=>{
 const f=fixture();await f.host.ready;f.host.dispose();f.host.dispose();assert.equal(await f.host.acceptSnapshot(f.snap(2)),false);assert.equal(f.frames.size,0);assert.equal(f.medias.size,0);assert.equal(f.raf.size,0);assert.equal(f.host.readDiagnostics().inputReady,false);
});

test('author global scale applies around the canvas origin and matches translated input',async()=>{
 const f=fixture({room:{transition:{type:'author',durationMs:450}}});await f.host.ready;
 await f.host.publishGeometry('component.shared',{sessionId:'session',revision:1,transitionId:null,geometryVersion:f.host.readDiagnostics().geometryVersion,buttons:[{buttonId:'next',x:10,y:20,width:30,height:40}]});
 await f.host.publishGeometry('scene',{sessionId:'session',revision:1,transitionId:null,geometryVersion:f.host.readDiagnostics().geometryVersion,groups:{shared:{matrix:[2,0,0,2,10,20],opacity:1}}});
 const widget=f.container.children[0].children.find(v=>v.dataset.consumer==='component.shared');assert.equal(widget.style.transform,'matrix(2,0,0,2,410,70)');
 const button=f.host.readInputSample({runtimeGeneration:1,sessionId:'session',revision:1},f.host.readDiagnostics().inputVersion).buttons.find(v=>v.consumer==='component.shared');assert.equal(button.x,830/1920);assert.equal(button.y,160/1080);f.host.dispose();
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

function actionFixture(request){
 let time=0,id=0;const timers=new Map();
 const f=fixture({request:(method,params,scope)=>request(method==='authorInput'?({'actions.activate':'activate','desk.navigate':'navigate','media.control':'mediaControl','audio.control':'audioControl'}[JSON.parse(params.requestJson).method]):method,params,scope),setTimeout:(cb,ms)=>{const key=++id;timers.set(key,{cb,due:time+ms});return key;},clearTimeout:key=>timers.delete(key)});
 f.tick=async ms=>{time+=ms;for(const[key,v]of [...timers])if(v.due<=time){timers.delete(key);v.cb();}await flush();};
 f.event=(sequence,consumer='scene')=>({kind:'activate',runtimeGeneration:1,sessionId:'session',revision:1,geometryVersion:f.host.readDiagnostics().inputVersion,inputSequence:sequence,consumer,button:'next'});
 f.invoke=(method='desk.navigate',params={action:{type:'desk.next'}})=>{
   const frame=[...f.frames.values()].find(v=>v.def.consumerId==='scene'),identity={runtimeGeneration:1,sessionId:'session',revision:1};
   const requestJson=JSON.stringify({type:'dext:runtime:request',apiVersion:1,instanceId:'instance',sessionId:'session',token:'fixture',requestId:'r1',method,params});
   return frame.opts.invoke({method,params,consumerId:'scene',instanceId:'instance',requestId:'r1',requestJson,identity});
 };
 return f;
}
test('authored navigation receipt cancels its late native event and exposes status only',async()=>{
 const f=actionFixture(method=>Promise.resolve(method==='navigate'?{status:'accepted',inputSequence:7,inputConsumed:true,privateTarget:'secret'}:{status:'accepted'}));await f.host.ready;
 assert.equal([...f.frames.values()][0].opts.implementedCapabilities.includes('desk.navigate'),true);
 assert.deepEqual(await f.invoke(),{status:'accepted'});
 assert.equal(f.calls.find(v=>v.method==='authorInput').params.instanceId,'instance');assert.deepEqual(JSON.parse(f.calls.find(v=>v.method==='authorInput').params.requestJson).params,{action:{type:'desk.next'}});assert.equal('inputSequence' in f.calls.find(v=>v.method==='authorInput').params,false);
 assert.equal(f.host.handleNativeInput(f.event(7)),false);await f.tick(1000);assert.equal(f.calls.filter(v=>v.method==='activate').length,0);f.host.dispose();
});
test('native event and authored navigation share one completion without default double dispatch',async()=>{
 const f=actionFixture(method=>Promise.resolve(method==='navigate'?{status:'queued',inputSequence:7,inputConsumed:true}:{status:'accepted'}));await f.host.ready;
 assert.equal(f.host.handleNativeInput(f.event(7)),true);assert.deepEqual(await f.invoke(),{status:'queued'});await f.tick(1000);
 assert.equal(f.calls.find(v=>v.method==='authorInput').params.geometryVersion,1);assert.equal('inputSequence' in f.calls.find(v=>v.method==='authorInput').params,false);assert.equal(f.calls.filter(v=>v.method==='activate').length,0);f.host.dispose();
});
test('denied navigation preserves configured fallback with the exact native sequence',async()=>{
 const f=actionFixture(method=>Promise.resolve(method==='navigate'?{status:'denied',inputSequence:7,inputConsumed:false}:{status:'accepted',inputSequence:7,inputConsumed:true}));await f.host.ready;
 f.host.handleNativeInput(f.event(7));await assert.rejects(f.invoke(),{code:'denied'});await f.tick(1000);
 assert.deepEqual(f.calls.find(v=>v.method==='activate').params,{consumer:'scene',button:'next',geometryVersion:1,inputSequence:7});f.host.dispose();
});
test('SDK request preceding native event holds fallback until its consumption receipt',async()=>{
 let release;const f=actionFixture(method=>method==='navigate'?new Promise(r=>release=r):Promise.resolve({status:'accepted'}));await f.host.ready;
 const pending=f.invoke();pending.catch(()=>{});await flush();f.host.handleNativeInput(f.event(7));await f.tick(1000);assert.equal(f.calls.filter(v=>v.method==='activate').length,0);
 release({status:'accepted',inputSequence:7,inputConsumed:true});await pending;await f.tick(1000);assert.equal(f.calls.filter(v=>v.method==='activate').length,0);f.host.dispose();
});
test('old duplicate events and delayed defaults cannot dispatch a later physical completion',async()=>{
 const f=actionFixture(method=>Promise.resolve({status:'accepted',inputSequence:9,inputConsumed:true}));await f.host.ready;
 f.host.handleNativeInput(f.event(7));f.host.handleNativeInput(f.event(9));assert.equal(f.host.handleNativeInput(f.event(7)),false);assert.equal(f.host.handleNativeInput(f.event(9)),false);
 await f.tick(1000);const requests=f.calls.filter(v=>v.method==='activate');assert.equal(requests.length,1);assert.equal(requests[0].params.inputSequence,9);f.host.dispose();
});
test('snapshot change private pause and disposal cancel pending native fallback',async()=>{
 for(const mode of ['snapshot','pause','dispose']){const f=actionFixture(()=>Promise.resolve({status:'accepted'}));await f.host.ready;f.host.handleNativeInput(f.event(7));
 if(mode==='snapshot')await f.host.acceptSnapshot(f.snap(2));if(mode==='pause')f.host.setPlaybackSuspended(true);if(mode==='dispose')f.host.dispose();
 await f.tick(1000);assert.equal(f.calls.filter(v=>v.method==='activate').length,0);f.host.dispose();}
});
test('official DOM click cannot race native dispatch or invent an input sequence',async()=>{
 const f=actionFixture(()=>Promise.resolve({status:'accepted',inputSequence:7,inputConsumed:true}));await f.host.ready;
 const icon=f.container.children[0].children.find(v=>v.tag==='button');icon.handlers.click?.();await flush();assert.equal(f.calls.filter(v=>v.method==='activate').length,0);
 f.host.handleNativeInput(f.event(7,'official'));await flush();assert.equal(f.calls.filter(v=>v.method==='activate').length,1);assert.equal(f.calls.find(v=>v.method==='activate').params.inputSequence,7);f.host.dispose();
});


test('author controls use fixed consumer once and reveal status without private receipt',async()=>{
 for(const [method,params,nativeMethod]of [['media.control',{action:'pause'},'mediaControl'],['audio.control',{settings:{volume:.25,muted:true}},'audioControl']]){
   const f=actionFixture(m=>Promise.resolve(m===nativeMethod?{status:'accepted',inputSequence:7,inputConsumed:true,deviceId:'private'}:{status:'accepted'}));await f.host.ready;
   assert.equal([...f.frames.values()][0].opts.implementedCapabilities.includes(method),true);
   f.host.handleNativeInput(f.event(7));assert.deepEqual(await f.invoke(method,params),{status:'accepted'});await f.tick(1000);
   assert.deepEqual(JSON.parse(f.calls.find(v=>v.method==='authorInput').params.requestJson).params,params);assert.equal(f.calls.find(v=>v.method==='authorInput').params.consumer,'scene');
   assert.equal(f.calls.filter(v=>v.method==='activate').length,0);f.host.dispose();
 }
});
test('system failure after consumption suppresses fallback; rate denial preserves it',async()=>{
 for(const [status,consumed]of [['controlUnavailable',true],['rateLimited',false],['denied',false]]){
   const f=actionFixture(m=>Promise.resolve(m==='mediaControl'?{status,inputSequence:7,inputConsumed:consumed}:{status:'accepted',inputSequence:7,inputConsumed:true}));await f.host.ready;f.host.handleNativeInput(f.event(7));
   await assert.rejects(f.invoke('media.control',{action:'pause'}),{code:status});await f.tick(1000);
   assert.equal(f.calls.filter(v=>v.method==='activate').length,consumed?0:1);f.host.dispose();
 }
});
test('control before native event holds exact default until async Windows receipt',async()=>{
 let release;const f=actionFixture(m=>m==='audioControl'?new Promise(r=>release=r):Promise.resolve({status:'accepted'}));await f.host.ready;
 const p=f.invoke('audio.control',{settings:{muted:true}});p.catch(()=>{});await flush();assert.equal(typeof release,'function');
 f.host.handleNativeInput(f.event(7));await f.tick(1000);assert.equal(f.calls.filter(v=>v.method==='activate').length,0);
 release({status:'accepted',inputSequence:7,inputConsumed:true});await p;await f.tick(1000);assert.equal(f.calls.filter(v=>v.method==='activate').length,0);f.host.dispose();
});

test('exit entry advertises Dext confirmation and keeps private continuation out of author replies',async()=>{
 const f=actionFixture(method=>Promise.resolve(method==='activate'?{status:'requiresConfirmation',inputSequence:7,inputConsumed:true,exit:{secret:'Core-only'}}:{status:'accepted'}));await f.host.ready;
 assert.equal([...f.frames.values()][0].opts.implementedCapabilities.includes('dext.exit'),true);
 f.host.handleNativeInput(f.event(7));assert.deepEqual(await f.invoke('actions.activate',{buttonId:'next'}),{status:'requiresConfirmation'});await f.tick(1000);
 assert.equal(f.calls.filter(v=>v.method==='authorInput').length,1);f.host.dispose();
});

test('no-idle retains the desktop picture without publishing official activation until wake',async()=>{
 const f=fixture();await f.host.ready;
 const root=f.container.children[0],icon=root.children.find(v=>v.tag==='button'),nodes=[...f.frames.values()].map(v=>v.node);
 await f.host.acceptSnapshot(f.snap(2,{operable:false,lifecycle:{stage:'idle',playbackPaused:false,locked:false,revision:2}}));
 assert.equal(icon.hidden,false);
 assert.deepEqual([...f.frames.values()].map(v=>v.node),nodes);
 for(const consumer of ['scene','component.shared','slot.background.home'])assert.equal(root.children.find(v=>v.dataset.consumer===consumer).hidden,false);
 assert.equal([...f.frames.values()].every(v=>v.state==='suspended'),true);
 assert.equal(f.calls.filter(v=>v.method==='geometry').at(-1).params.buttons.some(v=>v.consumer==='official'),false);
 await f.host.acceptSnapshot(f.snap(3,{lifecycle:{stage:'desktop',playbackPaused:false,locked:false,revision:3}}));
 assert.equal(icon.hidden,false);assert.deepEqual([...f.frames.values()].map(v=>v.node),nodes);
 assert.equal(f.calls.filter(v=>v.method==='geometry').at(-1).params.buttons.some(v=>v.consumer==='official'),true);f.host.dispose();
});
test('configured idle hides the desktop icons while retaining their nodes for wake',async()=>{
 const f=fixture({room:{idle:{type:'image',src:'idle.svg'}}});await f.host.ready;
 const root=f.container.children[0],icon=root.children.find(v=>v.tag==='button');
 await f.host.acceptSnapshot(f.snap(2,{operable:false,lifecycle:{stage:'idle',playbackPaused:false,locked:false,revision:2}}));
 assert.equal(icon.hidden,true);assert.equal(root.children.find(v=>v.dataset.consumer==='slot.idle').hidden,false);
 assert.equal(f.calls.filter(v=>v.method==='geometry').at(-1).params.buttons.some(v=>v.consumer==='official'),false);f.host.dispose();
});


function savedLayout(revision=1){return{revision,icons:{home:{icon:{x:240,y:360}}},components:{shared:{x:600,y:240,width:200,height:100}}};}
function wrapper(f,consumer){return f.container.children[0].children.find(v=>v.dataset.consumer===consumer);}
test('private Core layout is read in current scope and applied without replacing shared documents',async()=>{
 const f=fixture({request:method=>method==='layoutRead'?Promise.resolve({status:'accepted',layout:savedLayout()}):undefined});await f.host.ready;
 assert.deepEqual(f.calls.find(v=>v.method==='layoutRead').params,{});
 assert.equal(f.calls.find(v=>v.method==='layoutRead').scope.revision,1);
 assert.equal(wrapper(f,'component.shared').style.left,'600px');
 const icon=f.container.children[0].children.find(v=>v.className==='dext-v3-icon');assert.equal(icon.style.left,'240px');assert.equal(icon.style.top,'360px');
 const widget=[...f.frames.values()].find(v=>v.def.consumerId==='component.shared').node;
 await f.host.acceptSnapshot(f.snap(2,{currentDeskId:'focus'}));
 assert.equal([...f.frames.values()].find(v=>v.def.consumerId==='component.shared').node,widget);
 assert.equal(f.host.readDiagnostics().layout.revision,1);assert.equal(f.host.readDiagnostics().layout.ready,true);
 assert.equal(f.calls.filter(v=>v.method==='layoutSave').length,0);f.host.dispose();
});
test('a late layout read cannot apply to a newer Desk or block its rendering',async()=>{
 let release;const f=fixture({request:(method,params,scope)=>method==='layoutRead'?(scope.revision===1?new Promise(r=>release=r):Promise.resolve({status:'accepted',layout:savedLayout(2)})):undefined});
 await flush();await f.host.acceptSnapshot(f.snap(2,{currentDeskId:'focus'}));assert.equal(wrapper(f,'component.shared').style.left,'600px');
 const old=savedLayout(1);old.components.shared.x=100;release({status:'accepted',layout:old});await f.host.ready;
 assert.equal(wrapper(f,'component.shared').style.left,'600px');assert.equal(f.host.readDiagnostics().layout.revision,2);f.host.dispose();
});
test('author local button geometry follows effective personal placement and logical scaling',async()=>{
 const personal=savedLayout();personal.components.shared.width=100;personal.components.shared.height=50;
 const f=fixture({request:method=>method==='layoutRead'?Promise.resolve({status:'accepted',layout:personal}):undefined});await f.host.ready;
 await f.host.publishGeometry('component.shared',{sessionId:'session',revision:1,transitionId:null,geometryVersion:f.host.readDiagnostics().geometryVersion,buttons:[{buttonId:'next',x:10,y:20,width:30,height:40}]});
 const button=f.calls.filter(v=>v.method==='geometry').at(-1).params.buttons.find(v=>v.consumer==='component.shared');
 assert.equal(button.x,605/1920);assert.equal(button.y,250/1080);assert.equal(button.width,15/1920);assert.equal(button.height,20/1080);
 assert.equal(wrapper(f,'component.shared').style.width,'200px');assert.equal(wrapper(f,'component.shared').style.height,'100px');f.host.dispose();
});
test('viewport layout retains baseline CSS size and restores saved positions without saving or remounting',async()=>{
 let viewport={width:1920,height:1080,dpr:1};
 const f=fixture({getViewport:()=>viewport});await f.host.ready;const widget=[...f.frames.values()].find(v=>v.def.consumerId==='component.shared').node;
 viewport={width:960,height:540,dpr:2};await f.host.resize();
 const item=f.host.readDiagnostics().layout.items.find(v=>v.key==='widget:shared');
 assert.equal(item.effectiveRect.width,400);assert.equal(item.effectiveRect.height,200);assert.equal(item.scale,1);
 assert.equal(wrapper(f,'component.shared').style.width,'200px');
 viewport={width:1920,height:1080,dpr:1};await f.host.resize();
 assert.equal(wrapper(f,'component.shared').style.left,'400px');assert.equal(wrapper(f,'component.shared').style.top,'50px');
 assert.equal([...f.frames.values()].find(v=>v.def.consumerId==='component.shared').node,widget);
 assert.equal(f.calls.filter(v=>v.method==='layoutSave').length,0);f.host.dispose();
});
test('scene occupied areas affect official layout and remain reserved until an explicit new report',async()=>{
 const f=fixture();await f.host.ready;
 const occupied=[{id:'reserved',x:400,y:50,width:200,height:100}];
 await f.host.publishGeometry('scene',{sessionId:'session',revision:1,transitionId:null,geometryVersion:f.host.readDiagnostics().geometryVersion,occupied});
 let item=f.host.readDiagnostics().layout.items.find(v=>v.key==='widget:shared');
 assert.equal(layoutModel.validateDrop({candidate:item.effectiveRect,itemKey:item.key,occupied,otherItems:[]}).accepted,true);
 await f.host.acceptSnapshot(f.snap(2));
 item=f.host.readDiagnostics().layout.items.find(v=>v.key==='widget:shared');
 assert.equal(layoutModel.validateDrop({candidate:item.effectiveRect,itemKey:item.key,occupied,otherItems:[]}).accepted,true);
 await f.host.publishGeometry('scene',{sessionId:'session',revision:2,transitionId:null,geometryVersion:f.host.readDiagnostics().geometryVersion,occupied:[]});
 assert.equal(wrapper(f,'component.shared').style.left,'400px');assert.equal(wrapper(f,'component.shared').style.top,'50px');f.host.dispose();
});
test('failed layout refresh keeps confirmed presentation and disables layout saving readiness',async()=>{
 const f=fixture({request:(method,params,scope)=>method==='layoutRead'?Promise.resolve(scope.revision===1?{status:'accepted',layout:savedLayout()}:{status:'storageUnavailable'}):undefined});
 await f.host.ready;await f.host.acceptSnapshot(f.snap(2));
 assert.equal(wrapper(f,'component.shared').style.left,'600px');assert.equal(f.host.readDiagnostics().layout.ready,false);assert.equal(f.host.readDiagnostics().layout.error,'storageUnavailable');f.host.dispose();
});
test('disposed host drops an outstanding layout read without reviving DOM',async()=>{
 let release;const f=fixture({request:method=>method==='layoutRead'?new Promise(r=>release=r):undefined});await flush();f.host.dispose();
 release({status:'accepted',layout:savedLayout()});await f.host.ready;assert.equal(f.container.children.length,0);assert.equal(f.frames.size,0);
});

test('rotated author region publishes its actual polygon rather than its bounding corners',async()=>{
 const f=fixture({room:{transition:{type:'author',durationMs:450}}});await f.host.ready;
 await f.host.publishGeometry('component.shared',{sessionId:'session',revision:1,transitionId:null,geometryVersion:f.host.readDiagnostics().geometryVersion,buttons:[{buttonId:'next',x:10,y:20,width:30,height:40}]});
 await f.host.publishGeometry('scene',{sessionId:'session',revision:1,transitionId:null,geometryVersion:f.host.readDiagnostics().geometryVersion,groups:{shared:{matrix:[1,.5,-.5,1,200,0],opacity:1}}});
 const b=f.host.readInputSample({runtimeGeneration:1,sessionId:'session',revision:1},f.host.readDiagnostics().inputVersion).buttons.find(v=>v.consumer==='component.shared');
 assert.equal(b.entryId,'button.next');assert.equal(b.polygons.length,1);
 assert.equal(geometry.containsPoint(b.polygons[0],{x:b.x+1e-7,y:b.y+1e-7},{includeBoundary:false}),false);
 assert.equal(geometry.containsPoint(b.polygons[0],{x:((410+15)-.5*(70+20)+200)/1920,y:(.5*(410+15)+70+20)/1080},{includeBoundary:false}),true);f.host.dispose();
});

function dockFixture(rect){
 const f=fixture({room:{resources:['scene.html','widget.html','bg.svg','dock.html'],components:[
 {id:'shared',role:'widget',entry:'widget.html',placement:{x:400,y:50,width:200,height:100},capabilities:[],buttonIds:['next']},
 {id:'bar',role:'dock',entry:'dock.html',placement:rect,capabilities:[],buttonIds:[]}],
 desks:[{id:'home',name:'Home',icons:[{id:'icon',buttonId:'next',x:0,y:0}],components:['shared','bar'],background:{type:'image',src:'bg.svg'}},{id:'focus',name:'Focus',icons:[],components:['shared','bar']}]}});return f;
}
test('front iframe cuts a native entry into separate visible pieces and fully covered entry disappears',async()=>{
 for(const [rect,count]of [[{x:48,y:32,width:32,height:104},2],[{x:32,y:32,width:96,height:104},0]]){
  // Layout avoids the saved Dock rectangle; an author visual transform can
  // still move the Dock over an icon. Verify the current visible sample.
  const f=dockFixture({x:1600,y:900,width:rect.width,height:rect.height});await f.host.ready;
  await f.host.publishGeometry('scene',{sessionId:'session',revision:1,transitionId:null,geometryVersion:f.host.readDiagnostics().geometryVersion,
    groups:{shared:{matrix:[1,0,0,1,rect.x-1600,rect.y-900],opacity:1}}});
  const sample=f.host.beginNativeInputSample({runtimeGeneration:1,sessionId:'session',revision:1},f.host.readDiagnostics().inputVersion,'occlusion');
  const b=sample.buttons.find(v=>v.consumer==='official');
  if(!count)assert.equal(b,undefined);else{
   assert.equal(b.polygons.length,count);
   assert.equal(b.polygons.some(p=>geometry.containsPoint(p,{x:64/1920,y:70/1080},{includeBoundary:false})),false);
   assert.equal(b.polygons.some(p=>geometry.containsPoint(p,{x:100/1920,y:70/1080},{includeBoundary:false})),true);
  }f.host.dispose();
 }
});
test('two official icons bound to one action retain separate presentation entries',async()=>{
 const f=fixture({room:{desks:[{id:'home',name:'Home',icons:[{id:'first',buttonId:'next',x:0,y:0},{id:'second',buttonId:'next',x:1,y:0}],components:['shared']},{id:'focus',name:'Focus',icons:[],components:['shared']}]}});await f.host.ready;
 const entries=f.calls.filter(v=>v.method==='geometry').at(-1).params.buttons.filter(v=>v.consumer==='official');
 assert.deepEqual(entries.map(v=>v.entryId),['icon.home/first','icon.home/second']);assert.equal(entries.every(v=>v.polygons.length===1),true);f.host.dispose();
});
test('native focus outlines the acknowledged entry and immediately clears on invalidation or pause',async()=>{
 const f=fixture({room:{desks:[{id:'home',name:'Home',icons:[{id:'first',buttonId:'next',x:0,y:0},{id:'second',buttonId:'next',x:1,y:0}],components:['shared']},{id:'focus',name:'Focus',icons:[],components:['shared']}]}});await f.host.ready;
 const event={kind:'focus',runtimeGeneration:1,sessionId:'session',revision:1,geometryVersion:f.host.readDiagnostics().inputVersion,consumer:'official',button:'next',entryId:'icon.home/second'};
 assert.equal(f.host.handleNativeInput(event),true);
 assert.deepEqual(f.host.readDiagnostics().focus,{consumer:'official',button:'next',entryId:'icon.home/second'});
 const outline=f.container.children[0].children.find(v=>v.className==='dext-v3-focus');assert.equal(outline.hidden,false);assert.equal(Object.hasOwn(outline.attrs,'hidden'),false);assert.equal(outline.children.length,1);
 assert.equal(f.host.handleNativeInput({...event,entryId:'icon.home/missing'}),false);
 assert.equal(f.host.handleNativeInput({...event,consumer:null,button:null,entryId:null}),true);assert.equal(outline.hidden,true);
 f.host.handleNativeInput(event);const refresh=f.host.acceptSnapshot(f.snap(2));assert.equal(outline.hidden,true);await refresh;
 assert.equal(f.host.handleNativeInput(event),false);
 f.host.handleNativeInput({...event,revision:2,geometryVersion:f.host.readDiagnostics().inputVersion});f.host.setPlaybackSuspended(true);
 assert.equal(outline.hidden,true);assert.equal(Object.hasOwn(outline.attrs,'hidden'),true);assert.equal(f.host.readDiagnostics().focus,null);f.host.dispose();
});
test('zero-opacity front layers do not occlude lower native input or intercept DOM pointers',async()=>{
 const f=dockFixture({x:32,y:32,width:96,height:104});await f.host.ready;
 await f.host.publishGeometry('scene',{sessionId:'session',revision:1,transitionId:null,geometryVersion:f.host.readDiagnostics().geometryVersion,groups:{shared:{matrix:[1,0,0,1,0,0],opacity:0}}});
 assert.deepEqual(f.host.readInputSample({runtimeGeneration:1,sessionId:'session',revision:1},f.host.readDiagnostics().inputVersion).buttons.map(b=>b.consumer),['official']);
 const bar=f.container.children[0].children.find(v=>v.dataset.consumer==='component.bar');assert.equal(bar.style.pointerEvents,'none');f.host.dispose();
});

test('transparent source iframe releases target icon input while its actual pointer interception is disabled',async()=>{
 const f=fixture({room:{transition:{type:'author',durationMs:450},resources:['scene.html','dock.html'],components:[{id:'bar',role:'dock',entry:'dock.html',placement:{x:32,y:32,width:96,height:104},capabilities:[],buttonIds:[]}],
 desks:[{id:'home',name:'Home',icons:[],components:['bar']},{id:'focus',name:'Focus',icons:[{id:'icon',buttonId:'next',x:0,y:0}],components:[]}]}});
 await f.host.ready;await f.host.acceptSnapshot(f.snap(2,{targetDeskId:'focus',transitionId:'t',deadlineUtc:'2030-01-01T00:00:00Z'}));
 assert.equal(f.calls.filter(v=>v.method==='geometry').at(-1).params.buttons.some(v=>v.consumer==='official'),false);
 await f.host.publishGeometry('scene',{sessionId:'session',revision:2,transitionId:'t',geometryVersion:f.host.readDiagnostics().geometryVersion,groups:{source:{matrix:[1,0,0,1,0,0],opacity:0}}});
 assert.equal(f.host.readInputSample({runtimeGeneration:1,sessionId:'session',revision:2},f.host.readDiagnostics().inputVersion).buttons.some(v=>v.entryId==='icon.focus/icon'),true);
 const bar=f.container.children[0].children.find(v=>v.dataset.consumer==='component.bar');assert.equal(bar.style.pointerEvents,'none');f.host.dispose();
});
test('native focus is rejected before a new geometry acknowledgement and after publication failure',async()=>{
 let hold=false,release;const f=fixture({request:m=>m==='geometry'&&hold?new Promise(r=>release=r):Promise.resolve({status:'accepted',...(m==='layoutRead'?{layout:{revision:0,icons:{},components:{}}}:{})})});await f.host.ready;
 const event={kind:'focus',runtimeGeneration:1,sessionId:'session',revision:1,geometryVersion:1,consumer:'official',button:'next',entryId:'icon.home/icon'};
 assert.equal(f.host.handleNativeInput(event),true);hold=true;const pending=f.host.resize();
 // Force a changed author geometry instead of an unchanged viewport.
 await pending;const changed=f.host.publishGeometry('component.shared',{sessionId:'session',revision:1,transitionId:null,geometryVersion:f.host.readDiagnostics().geometryVersion,buttons:[{buttonId:'next',x:0,y:0,width:20,height:20}]});
 await flush();assert.equal(f.host.handleNativeInput({...event,geometryVersion:f.host.readDiagnostics().inputVersion}),false);
 release({status:'denied'});await changed;assert.equal(f.host.readDiagnostics().focus,null);assert.equal(f.host.readDiagnostics().inputReady,false);f.host.dispose();
});
test('a shared entry under a moving foreground cover waits for event sampling without frame IPC',async()=>{
 const f=fixture({room:{components:[{id:'shared',role:'widget',entry:'widget.html',placement:{x:400,y:50,width:200,height:100},capabilities:[],buttonIds:['next']},{id:'bar',role:'dock',entry:'widget.html',placement:{x:350,y:50,width:50,height:100},capabilities:[],buttonIds:[]}],
 desks:[{id:'home',name:'Home',icons:[],components:['shared','bar']},{id:'focus',name:'Focus',icons:[],components:['shared']}]}});await f.host.ready;
 await f.host.publishGeometry('component.shared',{sessionId:'session',revision:1,transitionId:null,geometryVersion:f.host.readDiagnostics().geometryVersion,buttons:[{buttonId:'next',x:0,y:0,width:200,height:100}]});
 await f.host.acceptSnapshot(f.snap(2,{targetDeskId:'focus',transitionId:'t',deadlineUtc:'2030-01-01T00:00:00Z'}));const count=f.calls.filter(v=>v.method==='geometry').length;
 assert.equal(f.calls.filter(v=>v.method==='geometry').at(-1).params.buttons.some(v=>v.consumer==='component.shared'),false);
 await f.advance(100);assert.equal(f.calls.filter(v=>v.method==='geometry').length,count);f.host.dispose();
});

test('event samples read moving target icons at their painted position without frame IPC',async()=>{
 const f=fixture({room:{desks:[{id:'home',name:'Home',icons:[],components:[]},{id:'focus',name:'Focus',icons:[{id:'icon',buttonId:'next',x:0,y:0}],components:[]}]}});await f.host.ready;
 await f.host.acceptSnapshot(f.snap(2,{targetDeskId:'focus',transitionId:'t',deadlineUtc:'2030-01-01T00:00:00Z'}));await f.advance(225);
 const version=f.host.readDiagnostics().inputVersion,count=f.calls.filter(v=>v.method==='geometry').length;
 const sample=f.host.readInputSample({runtimeGeneration:1,sessionId:'session',revision:2},version);
 assert.equal(sample.geometryVersion,version);assert.equal(sample.buttons.length,1);assert.equal(sample.buttons[0].entryId,'icon.focus/icon');
 assert.equal(sample.buttons[0].x,(32+960)/1920);assert.equal(f.calls.filter(v=>v.method==='geometry').length,count);
 await f.advance(100);assert.equal(sample.buttons[0].x,(32+960)/1920);f.host.dispose();
});
test('event sample clips a moving foreground cover at its current transform',async()=>{
 const f=fixture({room:{components:[{id:'shared',role:'widget',entry:'widget.html',placement:{x:400,y:50,width:200,height:100},capabilities:[],buttonIds:['next']},{id:'bar',role:'dock',entry:'widget.html',placement:{x:1920-200,y:50,width:200,height:100},capabilities:[],buttonIds:[]}],
 desks:[{id:'home',name:'Home',icons:[],components:['shared','bar']},{id:'focus',name:'Focus',icons:[],components:['shared']}]}});await f.host.ready;
 await f.host.acceptSnapshot(f.snap(2,{targetDeskId:'focus',transitionId:'t',deadlineUtc:'2030-01-01T00:00:00Z'}));
 await f.host.publishGeometry('component.shared',{sessionId:'session',revision:2,transitionId:'t',geometryVersion:f.host.readDiagnostics().geometryVersion,buttons:[{buttonId:'next',x:0,y:0,width:200,height:100}]});
 await f.advance(300);const count=f.calls.filter(v=>v.method==='geometry').length;
 const sample=f.host.readInputSample({runtimeGeneration:1,sessionId:'session',revision:2},f.host.readDiagnostics().inputVersion);
 const button=sample.buttons.find(v=>v.consumer==='component.shared');
 assert.equal(button.x,400/1920);assert.ok(Math.abs(button.width-40/1920)<=32*Number.EPSILON);
 assert.equal(f.calls.filter(v=>v.method==='geometry').length,count);f.host.dispose();
});
test('event sample uses acknowledged scope and stays unavailable while paused or invalidated',async()=>{
 const f=fixture();await f.host.ready;const scope={runtimeGeneration:1,sessionId:'session',revision:1},version=f.host.readDiagnostics().inputVersion;
 assert.equal(f.host.readInputSample({...scope,revision:2},version),null);assert.equal(f.host.readInputSample(scope,version+1),null);
 f.host.setPlaybackSuspended(true);assert.equal(f.host.readInputSample(scope,version),null);f.host.dispose();
 assert.equal(f.host.readInputSample(scope,version),null);
});

test('native visual sample holds painted animation until actual dispatch then catches up',async()=>{
 const f=fixture({room:{desks:[{id:'home',name:'Home',icons:[],components:[]},{id:'focus',name:'Focus',icons:[{id:'icon',buttonId:'next',x:0,y:0}],components:[]}]}});await f.host.ready;
 await f.host.acceptSnapshot(f.snap(2,{targetDeskId:'focus',transitionId:'t',deadlineUtc:'2030-01-01T00:00:00Z'}));await f.advance(225);
 const scope={runtimeGeneration:1,sessionId:'session',revision:2},version=f.host.readDiagnostics().inputVersion,count=f.calls.filter(v=>v.method==='geometry').length;
 const held=f.host.beginNativeInputSample(scope,version,'sample-1');assert.equal(held.sampleId,'sample-1');const x=held.buttons[0].x;
 await f.advance(100);assert.equal(f.host.readDiagnostics().transition.elapsed,225);
 assert.equal(f.host.readInputSample(scope,version).buttons[0].x,x);assert.equal(f.host.endNativeInputSample('other'),false);
 assert.equal(f.host.endNativeInputSample('sample-1'),true);await f.advance(0);assert.equal(f.host.readDiagnostics().transition.elapsed,325);
 assert.equal(f.calls.filter(v=>v.method==='geometry').length,count);f.host.dispose();
});
test('visual sample holds are released by lifecycle invalidation and cannot revive old animation',async()=>{
 const f=fixture();await f.host.ready;const scope={runtimeGeneration:1,sessionId:'session',revision:1},version=f.host.readDiagnostics().inputVersion;
 assert.ok(f.host.beginNativeInputSample(scope,version,'sample-1'));f.host.setPlaybackSuspended(true);
 assert.equal(f.host.endNativeInputSample('sample-1'),false);assert.equal(f.host.beginNativeInputSample(scope,version,'sample-2'),null);
 f.host.dispose();
});

test('event samples include clipped source icons while boundary geometry keeps target scope',async()=>{
 const f=fixture({room:{desks:[{id:'home',name:'Home',icons:[{id:'source',buttonId:'next',x:8,y:0}],components:[]},{id:'focus',name:'Focus',icons:[],components:[]}]}});
 await f.host.ready;await f.host.acceptSnapshot(f.snap(2,{targetDeskId:'focus',transitionId:'t',deadlineUtc:'2030-01-01T00:00:00Z'}));await f.advance(225);
 const version=f.host.readDiagnostics().inputVersion,sample=f.host.readInputSample({runtimeGeneration:1,sessionId:'session',revision:2},version);
 const source=sample.buttons.find(v=>v.entryId==='icon.home/source');assert.ok(source);assert.equal(source.x,0);assert.ok(source.width>0&&source.width<96/1920);
 assert.equal(f.calls.filter(v=>v.method==='geometry').at(-1).params.buttons.some(v=>v.entryId==='icon.home/source'),false);
 f.host.dispose();
});
test('visible source widget publishes desk scoped region only for event sampling and retires on commit',async()=>{
 const f=fixture({room:{buttons:[{id:'home',name:'Home',scope:'home'}],components:[{id:'source',role:'widget',entry:'widget.html',placement:{x:1200,y:200,width:200,height:100},capabilities:[],buttonIds:['home']}],
  desks:[{id:'home',name:'Home',icons:[],components:['source']},{id:'focus',name:'Focus',icons:[],components:[]}]}});
 await f.host.ready;await f.host.acceptSnapshot(f.snap(2,{targetDeskId:'focus',transitionId:'t',deadlineUtc:'2030-01-01T00:00:00Z'}));await f.advance(225);
 assert.equal(await f.host.publishGeometry('component.source',{sessionId:'session',revision:2,transitionId:'t',geometryVersion:f.host.readDiagnostics().geometryVersion,
  buttons:[{buttonId:'home',x:0,y:0,width:100,height:100}]}),true);
 const scope={runtimeGeneration:1,sessionId:'session',revision:2};
 const sample=f.host.readInputSample(scope,f.host.readDiagnostics().inputVersion);assert.equal(sample.buttons[0].consumer,'component.source');assert.equal(sample.buttons[0].x,240/1920);
 assert.equal(f.calls.filter(v=>v.method==='geometry').at(-1).params.buttons.length,0);
 await f.host.acceptSnapshot(f.snap(3,{currentDeskId:'focus'}));
 const committed=f.host.readInputSample({...scope,revision:3},f.host.readDiagnostics().inputVersion);assert.equal(committed.buttons.length,0);f.host.dispose();
});

test('sampled source focus follows painted movement and hides after leaving canvas without frame IPC',async()=>{
 const f=fixture({room:{desks:[{id:'home',name:'Home',icons:[{id:'source',buttonId:'next',x:8,y:0}],components:[]},{id:'focus',name:'Focus',icons:[],components:[]}]}});
 await f.host.ready;await f.host.acceptSnapshot(f.snap(2,{targetDeskId:'focus',transitionId:'t',deadlineUtc:'2030-01-01T00:00:00Z'}));await f.advance(50);
 const version=f.host.readDiagnostics().inputVersion,scope={runtimeGeneration:1,sessionId:'session',revision:2};
 const sample=f.host.beginNativeInputSample(scope,version,'tab');assert.ok(sample.buttons.some(e=>e.entryId==='icon.home/source'));f.host.endNativeInputSample('tab');
 assert.equal(f.host.handleNativeInput({...scope,geometryVersion:version,kind:'focus',consumer:'official',button:'next',entryId:'icon.home/source'}),true);
 const ring=f.container.children[0].children.find(n=>n.className==='dext-v3-focus'),before=ring.children.map(n=>n.attrs.points).join('|'),count=f.calls.filter(v=>v.method==='geometry').length;
 await f.advance(100);assert.notEqual(ring.children.map(n=>n.attrs.points).join('|'),before);assert.equal(f.calls.filter(v=>v.method==='geometry').length,count);
 await f.advance(300);assert.equal(ring.hidden,true);assert.equal(f.host.readDiagnostics().focus.entryId,'icon.home/source');f.host.dispose();
});
test('sampled target focus follows animation to its final visible polygons',async()=>{
 const f=fixture({room:{desks:[{id:'home',name:'Home',icons:[],components:[]},{id:'focus',name:'Focus',icons:[{id:'target',buttonId:'next',x:0,y:0}],components:[]}]}});
 await f.host.ready;await f.host.acceptSnapshot(f.snap(2,{targetDeskId:'focus',transitionId:'t',deadlineUtc:'2030-01-01T00:00:00Z'}));await f.advance(225);
 const version=f.host.readDiagnostics().inputVersion,scope={runtimeGeneration:1,sessionId:'session',revision:2};
 f.host.beginNativeInputSample(scope,version,'tab');f.host.endNativeInputSample('tab');
 assert.equal(f.host.handleNativeInput({...scope,geometryVersion:version,kind:'focus',consumer:'official',button:'next',entryId:'icon.focus/target'}),true);
 const ring=f.container.children[0].children.find(n=>n.className==='dext-v3-focus'),before=ring.children[0].attrs.points;
 await f.advance(225);assert.notEqual(ring.children[0].attrs.points,before);assert.equal(ring.hidden,false);f.host.dispose();
});

test('continuous author visual frames move icons widget and focus locally with one structural version',async()=>{
 const f=fixture({room:{transition:{type:'author',durationMs:450}}});await f.host.ready;
 const nodes=[...f.frames.values()].map(v=>v.node),scope={runtimeGeneration:1,sessionId:'session',revision:1};
 const version=f.host.readDiagnostics().inputVersion,structural=f.host.readDiagnostics().geometryVersion,count=f.calls.filter(v=>v.method==='geometry').length;
 f.host.beginNativeInputSample(scope,version,'tab');f.host.endNativeInputSample('tab');
 assert.equal(f.host.handleNativeInput({...scope,geometryVersion:version,kind:'focus',consumer:'official',button:'next',entryId:'icon.home/icon'}),true);
 const ring=f.container.children[0].children.find(n=>n.className==='dext-v3-focus'),before=ring.children[0].attrs.points;
 for(const y of [100,200]){
  assert.equal(await f.host.publishGeometry('scene',{sessionId:'session',revision:1,transitionId:null,geometryVersion:structural,groups:{source:{matrix:[1,0,0,1,0,y],opacity:1},shared:{matrix:[1,0,0,1,0,y],opacity:1}}}),true);
  assert.equal(f.host.readDiagnostics().inputReady,true);assert.equal(f.host.readDiagnostics().inputVersion,version);
 }
 assert.equal(f.calls.filter(v=>v.method==='geometry').length,count);assert.deepEqual([...f.frames.values()].map(v=>v.node),nodes);
 const widget=f.container.children[0].children.find(n=>n.dataset.consumer==='component.shared'),icon=f.container.children[0].children.find(n=>n.className==='dext-v3-icon');
 assert.equal(widget.style.transform,'matrix(1,0,0,1,0,200)');assert.equal(icon.style.transform,'matrix(1,0,0,1,0,200)');
 assert.notEqual(ring.children[0].attrs.points,before);assert.equal(f.host.readDiagnostics().focus.entryId,'icon.home/icon');
 assert.equal(f.host.readInputSample(scope,version).buttons.find(b=>b.entryId==='icon.home/icon').y,232/1080);f.host.dispose();
});
test('author visual frames wait behind a native sample and latest frame paints once after release',async()=>{
 const f=fixture({room:{transition:{type:'author',durationMs:450}}});await f.host.ready;
 const scope={runtimeGeneration:1,sessionId:'session',revision:1},version=f.host.readDiagnostics().inputVersion,structural=f.host.readDiagnostics().geometryVersion;
 const held=f.host.beginNativeInputSample(scope,version,'held');assert.ok(held);
 for(const y of [100,200])assert.equal(await f.host.publishGeometry('scene',{sessionId:'session',revision:1,transitionId:null,geometryVersion:structural,groups:{source:{matrix:[1,0,0,1,0,y],opacity:1},shared:{matrix:[1,0,0,1,0,y],opacity:1}}}),true);
 assert.equal(f.host.readInputSample(scope,version).buttons.find(b=>b.entryId==='icon.home/icon').y,32/1080);
 assert.equal(f.host.endNativeInputSample('other'),false);assert.equal(f.host.endNativeInputSample('held'),true);
 assert.equal(f.host.readInputSample(scope,version).buttons.find(b=>b.entryId==='icon.home/icon').y,232/1080);
 f.host.beginNativeInputSample(scope,version,'old');await f.host.publishGeometry('scene',{sessionId:'session',revision:1,transitionId:null,geometryVersion:structural,groups:{source:{matrix:[1,0,0,1,0,300],opacity:1},shared:{matrix:[1,0,0,1,0,300],opacity:1}}});
 await f.host.acceptSnapshot(f.snap(2,{lifecycle:{stage:'desktop',playbackPaused:false,locked:false,revision:2}}));assert.equal(f.host.endNativeInputSample('old'),false);
 assert.equal(f.host.readInputSample({...scope,revision:2},f.host.readDiagnostics().inputVersion).buttons.find(b=>b.entryId==='icon.home/icon').y,32/1080);f.host.dispose();
});

test('committed Desk icons use source groups while a persistent widget uses shared groups',async()=>{
 const f=fixture({room:{transition:{type:'author',durationMs:450}}});await f.host.ready;
 await f.host.publishGeometry('scene',{sessionId:'session',revision:1,transitionId:null,geometryVersion:f.host.readDiagnostics().geometryVersion,
  groups:{source:{matrix:[1,0,0,1,50,0],opacity:1},shared:{matrix:[1,0,0,1,0,200],opacity:1}}});
 const icon=f.container.children[0].children.find(n=>n.className==='dext-v3-icon'),widget=f.container.children[0].children.find(n=>n.dataset.consumer==='component.shared');
 assert.equal(icon.style.transform,'matrix(1,0,0,1,50,0)');assert.equal(widget.style.transform,'matrix(1,0,0,1,0,200)');
 const entry=f.host.readInputSample({runtimeGeneration:1,sessionId:'session',revision:1},f.host.readDiagnostics().inputVersion).buttons.find(b=>b.entryId==='icon.home/icon');
 assert.equal(entry.x,82/1920);assert.equal(entry.y,32/1080);f.host.dispose();
});

test('author geometry exposes effective pre-group component rectangles through shrink and restore',async()=>{
 let viewport={width:1920,height:1080,dpr:1};
 const f=fixture({getViewport:()=>viewport,room:{transition:{type:'author',durationMs:700}}});await f.host.ready;
 const projected=()=>f.calls.findLast(v=>v.method==='frameGeometry').value.placements;
 const initial=projected();assert.deepEqual(initial,{'component.shared':{x:400,y:50,width:200,height:100}});
 const node=[...f.frames.values()].find(v=>v.def.consumerId==='component.shared').node;
 viewport={width:427,height:320,dpr:1.5};await f.host.resize();
 const item=f.host.readDiagnostics().layout.items.find(v=>v.key==='widget:shared');
 assert.deepEqual(projected()['component.shared'],item.effectiveRect);assert.notDeepEqual(projected(),initial);
 assert.equal(JSON.stringify(projected()).includes('savedRect'),false);
 const frameCount=f.calls.filter(v=>v.method==='frameGeometry').length,version=f.host.readDiagnostics().geometryVersion;
 await f.host.publishGeometry('scene',{sessionId:'session',revision:1,transitionId:null,geometryVersion:version,groups:{shared:{matrix:[1,0,0,1,0,100],opacity:1}}});
 assert.equal(f.calls.filter(v=>v.method==='frameGeometry').length,frameCount);
 viewport={width:1920,height:1080,dpr:1};await f.host.resize();
 assert.deepEqual(projected(),initial);assert.equal([...f.frames.values()].find(v=>v.def.consumerId==='component.shared').node,node);f.host.dispose();
});

test('referenced Dock reserves its placement for icons and widgets and unreferenced Desk restores saved positions',async()=>{
 const dock={id:'dock',role:'dock',entry:'dock.html',placement:{x:0,y:800,width:1920,height:280},capabilities:[]};
 const widget={id:'shared',role:'widget',entry:'widget.html',placement:{x:400,y:840,width:200,height:100},capabilities:[]};
 const f=fixture({room:{resources:['scene.html','widget.html','dock.html'],components:[widget,dock],dockComponentId:'dock',
  desks:[{id:'home',name:'Home',icons:[{id:'bottom',buttonId:'next',x:0,y:7}],components:['shared','dock']},
    {id:'focus',name:'Focus',icons:[],components:['shared']}]}});
 await f.host.ready;
 for(const item of f.host.readDiagnostics().layout.items)assert.ok(item.effectiveRect.y+item.effectiveRect.height<=800,'items must avoid Dock placement');
 await f.host.acceptSnapshot(f.snap(2,{currentDeskId:'focus'}));
 const restored=f.host.readDiagnostics().layout.items.find(item=>item.key==='widget:shared');
 assert.equal(restored.effectiveRect.y,840);assert.equal(f.calls.filter(call=>call.method==='layoutSave').length,0);f.host.dispose();
});


test('personal skins update ordinary presentations without replacing frames or changing geometry',async()=>{
 const timers=new Map();let timerId=0,skin='glass';
 const f=fixture({setTimeout:(cb,ms)=>{timers.set(++timerId,{cb,ms});return timerId;},clearTimeout:id=>timers.delete(id),
  request:method=>method==='presentationRead'?Promise.resolve({status:'accepted',presentation:{revision:1,skins:{next:skin},locator:null}}):undefined});
 await f.host.ready;await flush();
 const canvas=f.container.children[0],icon=canvas.children.find(n=>n.tag==='button'),nodes=[...f.frames.values()].map(v=>v.node),version=f.host.readDiagnostics().inputVersion,rect={...icon.style};
 assert.equal(icon.dataset.skin,'glass');skin='outline';
 const task=[...timers].find(([,v])=>v.ms===750);timers.delete(task[0]);await task[1].cb();await flush();
 assert.equal(icon.dataset.skin,'outline');assert.deepEqual([...f.frames.values()].map(v=>v.node),nodes);assert.equal(f.host.readDiagnostics().inputVersion,version);assert.deepEqual(icon.style,rect);
 f.host.dispose();assert.equal(timers.size,0);
});
test('private button locator outlines visible author and icon regions without activation and expires',async()=>{
 const timers=new Map();let timerId=0;
 const f=fixture({initialSnapshot:{protocolVersion:1,sessionId:"session",roomId:"room",installationStamp:"stamp",revision:1,currentDeskId:"home",targetDeskId:null,queuedDeskId:null,transitionId:null,deadlineUtc:null,active:true,operable:false,lifecycle:{stage:"desktop",playbackPaused:false,locked:false,revision:1}},setTimeout:(cb,ms)=>{timers.set(++timerId,{cb,ms});return timerId;},clearTimeout:id=>timers.delete(id),
  request:method=>method==='presentationRead'?Promise.resolve({status:'accepted',presentation:{revision:1,skins:{},locator:{requestId:'request',buttonId:'next'}}}):undefined});
 await f.host.ready;await flush();
 assert.equal(f.host.readDiagnostics().presentation.locator,'next');
 assert.equal(f.calls.filter(c=>c.method==='activate').length,0);
 assert.deepEqual(f.host.readInputSample({runtimeGeneration:1,sessionId:'session',revision:1},f.host.readDiagnostics().inputVersion).buttons,[]);
 const layer=f.container.children[0].children.find(n=>n.attrs.class==='dext-v3-locator');assert.ok(layer.children.length>0);
 const task=[...timers].find(([,v])=>v.ms===2500);timers.delete(task[0]);task[1].cb();
 assert.equal(f.host.readDiagnostics().presentation.locator,null);assert.equal(f.container.children[0].children.includes(layer),false);
 f.host.dispose();assert.equal(timers.size,0);
});

test('unbound native button shows a visible explanation',async()=>{
 const f=fixture({request:method=>method==='activate'?Promise.resolve({status:'missingBinding'}):undefined});
 await f.host.ready;
 f.host.handleNativeInput({kind:'activate',runtimeGeneration:1,sessionId:'session',revision:1,geometryVersion:f.host.readDiagnostics().inputVersion,inputSequence:1,consumer:'official',button:'next'});
 await flush();
 assert.ok(f.container.children.some(node=>node.className==='dext-v3-action-notice'&&node.textContent.includes('绑定')));
 f.host.dispose();
});
test('three Desk wraparound keeps next and previous slide directions',async()=>{
 for(const [from,to,direction] of [['last','home',1],['home','last',-1],['home','middle',1],['middle','last',1]]){
  const desks=['home','middle','last'].map(id=>({id,name:id,icons:[],components:[],background:{type:'image',src:'bg.svg'}}));
  const initialSnapshot={protocolVersion:1,sessionId:'session',roomId:'room',installationStamp:'stamp',revision:1,currentDeskId:from,targetDeskId:null,queuedDeskId:null,transitionId:null,deadlineUtc:null,active:true,operable:true,lifecycle:{stage:'desktop',playbackPaused:false,locked:false,revision:1}};
  const f=fixture({room:{desks},initialSnapshot});await f.host.ready;
  await f.host.acceptSnapshot(f.snap(2,{currentDeskId:from,targetDeskId:to,transitionId:'wrap',deadlineUtc:'2030-01-01T00:00:00Z'}));
  await f.advance(225);
  const source=f.container.children[0].children.find(n=>n.dataset.consumer==='slot.background.'+from);
  assert.equal(source.style.transform,'matrix(1,0,0,1,'+(-direction*960)+',0)');
  f.host.dispose();
 }
});


test('official task area is excluded from author boundary and sampled hits and clears without remount',async()=>{
 const component={id:'shared',role:'dock',entry:'widget.html',placement:{x:0,y:900,width:1000,height:120},capabilities:[],buttonIds:['next']};
 const f=fixture({viewKind:'dock',room:{dockComponentId:'shared',components:[component]}});
 try{
  await f.host.ready;const node=[...f.frames.values()][0].node;
  await f.host.publishGeometry('component.shared',{sessionId:'session',revision:1,transitionId:null,geometryVersion:f.host.readDiagnostics().geometryVersion,buttons:[{buttonId:'next',x:0,y:0,width:1000,height:120}]});
  const covered=entry=>entry.polygons.some(p=>geometry.containsPoint(p,{x:500/1920,y:500/1080},{includeBoundary:false}));
  assert.equal(covered(f.calls.filter(v=>v.method==='geometry').at(-1).params.buttons[0]),true);
  assert.equal(await f.host.setTaskAreaOcclusion({x:192,y:180,width:1536,height:720}),true);
  const last=f.calls.filter(v=>v.method==='geometry').at(-1);assert.equal(last.params.buttons.some(covered),false);
  const sampled=f.host.readInputSample({runtimeGeneration:1,sessionId:'session',revision:1},f.host.readDiagnostics().inputVersion);assert.equal(sampled.buttons.some(covered),false);
  const count=f.calls.filter(v=>v.method==='geometry').length;
  assert.equal(await f.host.setTaskAreaOcclusion({x:192,y:180,width:1536,height:720}),true);assert.equal(f.calls.filter(v=>v.method==='geometry').length,count);
  assert.equal(await f.host.setTaskAreaOcclusion(null),true);assert.equal(covered(f.calls.filter(v=>v.method==='geometry').at(-1).params.buttons[0]),true);
  assert.equal([...f.frames.values()][0].node,node);
 }finally{f.host.dispose();}
});
test('task occlusion rejects desktop host and malformed regions',async()=>{
 const f=fixture();try{await f.host.ready;assert.equal(await f.host.setTaskAreaOcclusion({x:0,y:0,width:50,height:50}),false);}finally{f.host.dispose();}
 const d=fixture({viewKind:'dock'});try{await d.host.ready;for(const r of [{x:-1,y:0,width:10,height:10},{x:0,y:0,width:Infinity,height:10},{x:0,y:0,width:2000,height:10}])assert.equal(await d.host.setTaskAreaOcclusion(r),false);}finally{d.host.dispose();}
});
test('fractional task area touching viewport edge is acknowledged and excludes underlying author hits',async()=>{
 const component={id:'shared',role:'dock',entry:'widget.html',placement:{x:0,y:900,width:1000,height:120},config:{dextTaskArea:{version:1,rect:{x:70,y:0,width:930,height:120}}},capabilities:[],buttonIds:['next']};
 const f=fixture({viewKind:'dock',room:{dockComponentId:'shared',components:[component]}});
 try{
  await f.host.ready;
  await f.host.publishGeometry('component.shared',{sessionId:'session',revision:1,transitionId:null,geometryVersion:f.host.readDiagnostics().geometryVersion,buttons:[{buttonId:'next',x:0,y:0,width:1000,height:120}]});
  const {resolveTaskArea}=require('./task-area-model.js');const region=resolveTaskArea(component,{width:1000,height:120}).occlusion;
  assert.equal(await f.host.setTaskAreaOcclusion(region),true);
  const sample=f.host.readInputSample({runtimeGeneration:1,sessionId:'session',revision:1},f.host.readDiagnostics().inputVersion);
  assert.equal(sample.buttons.some(entry=>entry.polygons.some(p=>geometry.containsPoint(p,{x:.5,y:.5},{includeBoundary:false}))),false);
 }finally{f.host.dispose();}
});

test('task occlusion waits for a superseding render of the same region',async()=>{
 let block=false;const waits=[];
 const f=fixture({viewKind:'dock',request:method=>block&&method==='invalidateGeometry'?new Promise(resolve=>waits.push(resolve)):undefined});
 try{
  await f.host.ready;block=true;
  const confirm=f.host.setTaskAreaOcclusion({x:300,y:100,width:1000,height:800});await flush();
  const newer=f.host.refreshGeometry();waits.shift()({status:'accepted'});await flush();
  waits.shift()({status:'accepted'});assert.equal(await newer,true);
  assert.equal(await confirm,true);assert.equal(f.host.readDiagnostics().inputReady,true);
 }finally{f.host.dispose();}
});
test('superseding geometry rejection cannot acknowledge task occlusion',async()=>{
 let block=false,reject=false;const waits=[];
 const f=fixture({viewKind:'dock',request:method=>block&&method==='invalidateGeometry'?new Promise(resolve=>waits.push(resolve)):reject&&method==='geometry'?Promise.resolve({status:'denied'}):undefined});
 try{
  await f.host.ready;block=true;
  const confirm=f.host.setTaskAreaOcclusion({x:300,y:100,width:1000,height:800});await flush();
  reject=true;const newer=f.host.refreshGeometry();waits.shift()({status:'accepted'});await flush();waits.shift()({status:'accepted'});
  assert.equal(await newer,false);assert.equal(await confirm,false);
 }finally{f.host.dispose();}
});
test('replacement task region never acknowledges the retired region',async()=>{
 let block=false;const waits=[];
 const f=fixture({viewKind:'dock',request:method=>block&&method==='invalidateGeometry'?new Promise(resolve=>waits.push(resolve)):undefined});
 try{
  await f.host.ready;block=true;
  const old=f.host.setTaskAreaOcclusion({x:300,y:100,width:1000,height:800});await flush();
  const next=f.host.setTaskAreaOcclusion(null);waits.shift()({status:'accepted'});await flush();waits.shift()({status:'accepted'});
  assert.equal(await next,true);assert.equal(await old,false);
 }finally{f.host.dispose();}
});

test('official task region enables event samples and removing it restores direct author input',async()=>{
 const f=fixture({viewKind:'dock'});
 try{
  await f.host.ready;
  const latest=()=>f.calls.filter(v=>v.method==='geometry').at(-1).params.eventSamples;
  assert.equal(latest(),false);
  await f.host.setTaskAreaOcclusion({x:300,y:100,width:1000,height:800});
  assert.equal(latest(),true);
  await f.host.refreshGeometry();assert.equal(latest(),true);
  await f.host.setTaskAreaOcclusion(null);assert.equal(latest(),false);
 }finally{f.host.dispose();}
});

test('official desktop snapshot is cached across polls and cleared on disable',async()=>{
 const timers=new Map();let timer=0,reads=0;
 const desktop={contextId:'scan1',deskId:'home',items:[{id:'desktop-'+'a'.repeat(64),name:'File.txt',kind:'file',slot:0,iconPng:null}],issueCount:0,truncated:false};
 const f=fixture({setTimeout:(cb,ms)=>{timers.set(++timer,{cb,ms});return timer;},clearTimeout:id=>timers.delete(id),request:(method)=>{
  if(method==='presentationRead')return Promise.resolve({status:'accepted',presentation:{revision:1,skins:{},locator:null,desktop:++reads===1?desktop:reads===2?{...desktop,items:null}:null}});
 }});
 const poll=async()=>{const found=[...timers].find(([,t])=>t.ms===750);assert.ok(found);timers.delete(found[0]);found[1].cb();await flush();};
 try{
  await f.host.ready;await flush();assert.equal(f.host.readDiagnostics().presentation.desktop.count,1);
  await poll();assert.equal(f.calls.filter(c=>c.method==='presentationRead').at(-1).params.desktopContextId,'scan1');
  assert.equal(f.host.readDiagnostics().presentation.desktop.count,1);
  await poll();assert.equal(f.host.readDiagnostics().presentation.desktop,null);
 }finally{f.host.dispose();}
});

test('desktop files render as official native targets and DOM clicks cannot open them',async()=>{
 const id='desktop-'+'c'.repeat(64),desktop={contextId:'scan1',deskId:'home',items:[{id,name:'Original file.txt',kind:'file',slot:0,iconPng:null}],issueCount:0,truncated:false};
 const f=fixture({request:method=>method==='presentationRead'?Promise.resolve({status:'accepted',presentation:{revision:1,skins:{},locator:null,desktop}}):undefined});
 try{
  await f.host.ready;await flush();
  const icon=f.container.children[0].children.find(n=>n.attrs['aria-label']==='Original file.txt');assert.ok(icon);assert.equal(icon.hidden,false);
  const q=f.calls.filter(c=>c.method==='geometry').at(-1);const entry=q.params.buttons.find(b=>b.consumer==='official.desktop');
  assert.equal(entry.button,id);assert.equal(entry.entryId,'desktop.scan1/'+id);assert.equal(icon.handlers.click,undefined);
  const event={kind:'activate',...q.scope,geometryVersion:q.params.geometryVersion,consumer:'official.desktop',button:id,entryId:entry.entryId,inputSequence:1,desktopInput:{key:0,modifiers:0,x:0,y:0,at:0,doubleClickTime:500,doubleClickWidth:4,doubleClickHeight:4}};
  f.host.handleNativeInput(event);f.host.handleNativeInput({...event,inputSequence:2,desktopInput:{...event.desktopInput,key:13}});await flush();
  assert.deepEqual(f.calls.filter(c=>c.method==='desktopOpen').at(-1).params.selectedIds,[id]);
  await f.host.acceptSnapshot(f.snap(2,{currentDeskId:'focus'}));assert.equal(icon.hidden,true);
 }finally{f.host.dispose();}
});

test('desktop overflow pages retain saved slots and use native page activation',async()=>{
 const items=[0,130].map(slot=>({id:'desktop-'+(slot?'b':'a').repeat(64),name:'Slot '+slot,kind:'file',slot,iconPng:null}));
 const desktop={contextId:'paged',deskId:'home',items,issueCount:0,truncated:false};
 const f=fixture({request:method=>method==='presentationRead'?Promise.resolve({status:'accepted',presentation:{revision:1,skins:{},locator:null,desktop}}):undefined});
 try{
  await f.host.ready;await flush();const children=()=>f.container.children[0].children;
  assert.ok(children().find(n=>n.attrs['aria-label']==='Slot 0'));assert.equal(children().some(n=>n.attrs['aria-label']==='Slot 130'),false);
  const q=f.calls.filter(c=>c.method==='geometry').at(-1),entry=q.params.buttons.find(b=>b.button==='desktop.page.next');assert.ok(entry);
  f.host.handleNativeInput({kind:'activate',...q.scope,geometryVersion:q.params.geometryVersion,consumer:entry.consumer,button:entry.button,entryId:entry.entryId,inputSequence:1});await flush();
  assert.ok(children().find(n=>n.attrs['aria-label']==='Slot 130'));assert.equal(children().some(n=>n.attrs['aria-label']==='Slot 0'),false);
 }finally{f.host.dispose();}
});

test('desktop drop sends real file objects while paused and retires listeners on dispose',async()=>{
 const sent=[],desktop={contextId:'scan1',deskId:'home',items:[],issueCount:0,truncated:false};
 const f=fixture({request:method=>method==='presentationRead'?Promise.resolve({status:'accepted',presentation:{revision:1,skins:{},locator:null,desktop}}):undefined,
  dropFiles:(params,files,scope)=>{sent.push({params,files,scope});return Promise.resolve({status:'accepted',data:{items:[{status:'completed'}]}});}});
 try{
  await f.host.ready;await flush();f.host.setPlaybackSuspended(true);
  const file={name:'example.txt'},dataTransfer={types:['Files'],effectAllowed:'all',dropEffect:'move',files:[file]};let prevented=0;
  const event={isTrusted:true,clientX:960,clientY:540,ctrlKey:true,dataTransfer,preventDefault(){prevented++;},stopPropagation(){}};
  f.container.handlers.dragover(event);assert.equal(dataTransfer.dropEffect,'copy');
  f.container.handlers.drop(event);await flush();assert.equal(sent.length,1);assert.equal(sent[0].files[0],file);
  assert.deepEqual(sent[0].params,{desktopContextId:'scan1',deskId:'home',x:.5,y:.5,page:0,modifiers:1,allowedEffects:'all'});
  assert.equal(dataTransfer.dropEffect,'none');assert.equal(prevented,2);
  await f.host.acceptSnapshot(f.snap(2,{currentDeskId:'focus'}));f.container.handlers.drop(event);assert.equal(sent.length,1);
 }finally{f.host.dispose();}
 assert.equal(f.container.handlers.drop,undefined);assert.equal(f.container.handlers.dragover,undefined);
});

test('desktop native single click selects, double click opens, Ctrl extends selection',async()=>{
 const ids=['a','b'].map(c=>'desktop-'+c.repeat(64));
 const desktop={contextId:'scan1',deskId:'home',items:ids.map((id,slot)=>({id,name:'File '+slot,kind:'file',slot,iconPng:null})),issueCount:0,truncated:false};
 const f=fixture({request:method=>method==='presentationRead'?Promise.resolve({status:'accepted',presentation:{revision:1,skins:{},locator:null,desktop}}):undefined});
 try{
  await f.host.ready;await flush();let sequence=0;
  function click(index,at,modifiers=0,key=0){
   const q=f.calls.filter(c=>c.method==='geometry').at(-1),entry=q.params.buttons.find(b=>b.button===ids[index]);
   return f.host.handleNativeInput({kind:'activate',...q.scope,geometryVersion:q.params.geometryVersion,consumer:'official.desktop',button:entry.button,entryId:entry.entryId,inputSequence:++sequence,
    desktopInput:{key,modifiers,x:100,y:100,at,doubleClickTime:500,doubleClickWidth:4,doubleClickHeight:4}});
  }
  click(0,100);await flush();assert.equal(f.calls.filter(c=>c.method==='activate').length,0);
  let icon=f.container.children[0].children.find(n=>n.attrs['aria-label']==='File 0');assert.equal(icon.attrs['aria-pressed'],'true');
  click(0,250);await flush();assert.equal(f.calls.filter(c=>c.method==='activate').length,1);
  click(1,800,1);await flush();assert.deepEqual(f.host.readDiagnostics().desktopSelection.selectedIds,ids);
  assert.equal(f.calls.filter(c=>c.method==='activate').length,1);
  const beforeF2=f.host.readDiagnostics().desktopSelection;
  click(1,900,0,114);await flush();
  assert.deepEqual(f.host.readDiagnostics().desktopSelection,beforeF2,'F2 must preserve multi-selection');
  assert.equal(f.calls.filter(c=>c.method==='activate').length,1,'F2 must not open a file');
  click(1,1000,0,13);await flush();
  assert.deepEqual(f.host.readDiagnostics().desktopSelection.selectedIds,ids);
  assert.deepEqual(f.calls.filter(c=>c.method==='desktopOpen').at(-1).params.selectedIds,ids);
  assert.equal(f.calls.filter(c=>c.method==='activate').length,1);
  click(1,1050);await flush();
  click(1,1100,0,114);await flush();
  assert.equal(f.calls.filter(c=>c.method==='desktopRename').length,1);
  await f.host.acceptSnapshot(f.snap(2,{currentDeskId:'focus'}));assert.deepEqual(f.host.readDiagnostics().desktopSelection.selectedIds,[]);
 }finally{f.host.dispose();}
});
test('desktop double click requires native time and position and resets after pause',async()=>{
 const id='desktop-'+'a'.repeat(64),desktop={contextId:'scan1',deskId:'home',items:[{id,name:'File',kind:'file',slot:0,iconPng:null}],issueCount:0,truncated:false};
 const f=fixture({request:method=>method==='presentationRead'?Promise.resolve({status:'accepted',presentation:{revision:1,skins:{},locator:null,desktop}}):undefined});
 try{
  await f.host.ready;await flush();let sequence=0;
  function click(at,x=100){const q=f.calls.filter(c=>c.method==='geometry').at(-1),entry=q.params.buttons.find(b=>b.button===id);
   f.host.handleNativeInput({kind:'activate',...q.scope,geometryVersion:q.params.geometryVersion,consumer:'official.desktop',button:id,entryId:entry.entryId,inputSequence:++sequence,
    desktopInput:{key:0,modifiers:0,x,y:100,at,doubleClickTime:500,doubleClickWidth:4,doubleClickHeight:4}});}
  click(0);click(600);click(700,110);await flush();assert.equal(f.calls.filter(c=>c.method==='activate').length,0);
  f.host.setPlaybackSuspended(true);f.host.setPlaybackSuspended(false);await flush();click(800,110);await flush();assert.equal(f.calls.filter(c=>c.method==='activate').length,0);
  click(900,111);await flush();assert.equal(f.calls.filter(c=>c.method==='activate').length,1);
  click(1000,111);await flush();assert.equal(f.calls.filter(c=>c.method==='activate').length,1);
 }finally{f.host.dispose();}
});
test('Ctrl copy and cut preserve selection and cut styling follows clipboard sequence',async()=>{
 const ids=['a','b'].map(c=>'desktop-'+c.repeat(64)),timers=new Map();let timer=0,clipboardSequence=10;
 const desktop={contextId:'scan1',deskId:'home',items:ids.map((id,slot)=>({id,name:'Clipboard '+slot,kind:'file',slot,iconPng:null})),issueCount:0,truncated:false};
 const f=fixture({setTimeout:(cb,ms)=>{timers.set(++timer,{cb,ms});return timer;},clearTimeout:id=>timers.delete(id),
  request:method=>method==='presentationRead'?Promise.resolve({status:'accepted',data:{clipboardSequence},presentation:{revision:1,skins:{},locator:null,desktop}}):
   ['desktopCopy','desktopCut'].includes(method)?Promise.resolve({status:'accepted',data:{clipboardSequence:++clipboardSequence}}):method==='desktopPaste'?Promise.resolve({status:'accepted',data:{clipboardSequence:++clipboardSequence,items:[{status:'unchanged'}]}}):undefined});
 try{
  await f.host.ready;await flush();let sequence=0;
  function press(index,key,modifiers){const q=f.calls.filter(c=>c.method==='geometry').at(-1),entry=q.params.buttons.find(b=>b.button===ids[index]);
   f.host.handleNativeInput({kind:'activate',...q.scope,geometryVersion:q.params.geometryVersion,consumer:'official.desktop',button:entry.button,entryId:entry.entryId,inputSequence:++sequence,
    desktopInput:{key,modifiers,x:100,y:100,at:sequence*1000,doubleClickTime:500,doubleClickWidth:4,doubleClickHeight:4}});}
  press(0,0,0);press(1,0,1);press(1,67,1);await flush();
  assert.deepEqual(f.calls.filter(c=>c.method==='desktopCopy').at(-1)?.params.selectedIds,ids);
  press(1,88,1);await flush();assert.deepEqual(f.host.readDiagnostics().desktopSelection.selectedIds,ids);
  const icons=()=>f.container.children[0].children.filter(n=>n.attrs['aria-label']?.startsWith('Clipboard '));
  assert.ok(icons().every(n=>n.dataset.cut==='true'));
  press(1,86,1);await flush();
  assert.equal(f.calls.filter(c=>c.method==='desktopPaste').length,1);
  assert.equal(f.calls.filter(c=>c.method==='desktopPaste')[0].params.selectedIds,undefined);
  assert.deepEqual(f.host.readDiagnostics().desktopSelection.selectedIds,ids);
  assert.ok(icons().every(n=>n.dataset.cut==='false'));
  press(1,88,1);await flush();assert.ok(icons().every(n=>n.dataset.cut==='true'));
  clipboardSequence++;for(const t of [...timers.values()].filter(t=>t.ms===750))t.cb();await flush();
  assert.ok(icons().every(n=>n.dataset.cut==='false'));
 }finally{f.host.dispose();}
});


test('empty synced desktop exposes native paste without a file selection',async()=>{
 const desktop={contextId:'empty',deskId:'home',items:[],issueCount:0,truncated:false};
 const f=fixture({request:method=>method==='presentationRead'?Promise.resolve({status:'accepted',presentation:{revision:1,skins:{},locator:null,desktop}}):undefined});
 try{
  await f.host.ready;await flush();
  const button=f.container.children[0].children.find(n=>n.attrs['aria-label']==='粘贴到桌面');assert.ok(button);
  assert.equal(button.handlers.click,undefined);assert.equal(button.style.height,'24px');assert.equal(button.style.width,'136px');
  const q=f.calls.filter(c=>c.method==='geometry').at(-1),entry=q.params.buttons.find(b=>b.button==='desktop.paste');assert.ok(entry);
  for(const [i,key]of [0,13,32,86].entries()){
   f.host.handleNativeInput({kind:'activate',...q.scope,geometryVersion:q.params.geometryVersion,consumer:entry.consumer,button:entry.button,entryId:entry.entryId,inputSequence:i+1,desktopInput:{key,modifiers:key===86?1:0,x:0,y:0,at:i*1000,doubleClickTime:500,doubleClickWidth:4,doubleClickHeight:4}});await flush();
   assert.equal(f.calls.filter(c=>c.method==='desktopPaste').length,i+1);
   assert.deepEqual(f.host.readDiagnostics().desktopSelection.selectedIds,[]);
  }
  assert.equal(f.calls.filter(c=>c.method==='activate'||c.method==='desktopOpen').length,0);
  await f.host.acceptSnapshot(f.snap(2,{currentDeskId:'focus'}));assert.equal(button.hidden,true);
 }finally{f.host.dispose();}
});


test('Delete preserves selected IDs and Shift Delete cannot send a file command',async()=>{
 const ids=['a','b'].map(c=>'desktop-'+c.repeat(64));
 const desktop={contextId:'delete',deskId:'home',items:ids.map((id,slot)=>({id,name:'File'+slot,kind:'file',slot,iconPng:null})),issueCount:0,truncated:false};
 const f=fixture({request:method=>method==='presentationRead'?Promise.resolve({status:'accepted',presentation:{revision:1,skins:{},locator:null,desktop}}):undefined});
 try{
  await f.host.ready;await flush();const q=f.calls.filter(c=>c.method==='geometry').at(-1);
  const send=(id,key,mods,sequence)=>f.host.handleNativeInput({kind:'activate',...q.scope,geometryVersion:q.params.geometryVersion,consumer:'official.desktop',button:id,entryId:'desktop.delete/'+id,inputSequence:sequence,desktopInput:{key,modifiers:mods,x:0,y:0,at:sequence*1000,doubleClickTime:500,doubleClickWidth:4,doubleClickHeight:4}});
  send(ids[0],0,0,1);send(ids[1],0,1,2);await flush();
  send(ids[1],46,2,3);await flush();assert.equal(f.calls.filter(c=>c.method==='desktopDelete').length,0);
  assert.deepEqual(f.host.readDiagnostics().desktopSelection.selectedIds,ids);
  send(ids[1],46,0,4);await flush();assert.deepEqual(f.calls.filter(c=>c.method==='desktopDelete').at(-1)?.params.selectedIds,ids);
  assert.deepEqual(f.host.readDiagnostics().desktopSelection.selectedIds,ids);
 }finally{f.host.dispose();}
});


test('native menu keys preserve multi-selection and cannot launch files',async()=>{
 const ids=['a','b'].map(c=>'desktop-'+c.repeat(64));
 const desktop={contextId:'menu',deskId:'home',items:ids.map((id,slot)=>({id,name:'File'+slot,kind:'file',slot,iconPng:null})),issueCount:0,truncated:false};
 const f=fixture({request:method=>method==='presentationRead'?Promise.resolve({status:'accepted',presentation:{revision:1,skins:{},locator:null,desktop}}):undefined});
 try{
  await f.host.ready;await flush();const q=f.calls.filter(c=>c.method==='geometry').at(-1);
  const send=(id,key,mods,sequence)=>f.host.handleNativeInput({kind:'activate',...q.scope,geometryVersion:q.params.geometryVersion,consumer:'official.desktop',button:id,entryId:'desktop.menu/'+id,inputSequence:sequence,desktopInput:{key,modifiers:mods,x:0,y:0,at:sequence*1000,doubleClickTime:500,doubleClickWidth:4,doubleClickHeight:4}});
  send(ids[0],0,0,1);send(ids[1],0,1,2);await flush();
  send(ids[1],121,0,3);await flush();assert.equal(f.calls.filter(c=>c.method==='desktopMenu').length,0);
  send(ids[1],121,2,4);await flush();assert.deepEqual(f.calls.filter(c=>c.method==='desktopMenu').at(-1)?.params.selectedIds,ids);
  send(ids[1],93,0,5);await flush();assert.equal(f.calls.filter(c=>c.method==='desktopMenu').length,2);
  assert.deepEqual(f.host.readDiagnostics().desktopSelection.selectedIds,ids);
  assert.equal(f.calls.filter(c=>c.method==='activate'||c.method==='desktopOpen').length,0);
 }finally{f.host.dispose();}
});

test('native right click retains selected files and selects an unselected target without launch',async()=>{
 const ids=['a','b','c'].map(c=>'desktop-'+c.repeat(64));
 const desktop={contextId:'right',deskId:'home',items:ids.map((id,slot)=>({id,name:'File'+slot,kind:'file',slot,iconPng:null})),issueCount:0,truncated:false};
 const f=fixture({request:method=>method==='presentationRead'?Promise.resolve({status:'accepted',presentation:{revision:1,skins:{},locator:null,desktop}}):undefined});
 try{
  await f.host.ready;await flush();const q=f.calls.filter(c=>c.method==='geometry').at(-1);
  const send=(id,sequence,ctrl=false,contextMenu=false)=>f.host.handleNativeInput({kind:'activate',...q.scope,geometryVersion:q.params.geometryVersion,consumer:'official.desktop',button:id,entryId:'desktop.right/'+id,inputSequence:sequence,desktopInput:{key:0,contextMenu,modifiers:ctrl?1:0,x:0,y:0,at:sequence*1000,doubleClickTime:500,doubleClickWidth:4,doubleClickHeight:4}});
  send(ids[0],1);send(ids[1],2,true);await flush();send(ids[1],3,false,true);await flush();
  assert.deepEqual(f.calls.filter(c=>c.method==='desktopMenu').at(-1)?.params.selectedIds,ids.slice(0,2));
  send(ids[2],4,false,true);await flush();assert.deepEqual(f.calls.filter(c=>c.method==='desktopMenu').at(-1)?.params.selectedIds,[ids[2]]);
  assert.deepEqual(f.host.readDiagnostics().desktopSelection.selectedIds,[ids[2]]);
  assert.equal(f.calls.filter(c=>c.method==='activate'||c.method==='desktopOpen').length,0);
 }finally{f.host.dispose();}
});

test('background desktop still publishes only visible file regions for the first right click',async()=>{
 const id='desktop-'+'f'.repeat(64),desktop={contextId:'background',deskId:'home',items:[{id,name:'File',kind:'file',slot:3,iconPng:null}],issueCount:0,truncated:false};
 const f=fixture({request:method=>method==='presentationRead'?Promise.resolve({status:'accepted',presentation:{revision:1,skins:{},locator:null,desktop}}):undefined});
 try{
  await f.host.ready;await flush();await f.host.acceptSnapshot(f.snap(2,{operable:false}));await flush();
  const q=f.calls.filter(c=>c.method==='geometry').at(-1);
  assert.deepEqual(q.params.buttons.map(b=>[b.consumer,b.button]),[['official.desktop',id]]);
  const entry=q.params.buttons[0];
  assert.equal(f.host.handleNativeInput({kind:'activate',...q.scope,geometryVersion:q.params.geometryVersion,consumer:entry.consumer,button:id,entryId:entry.entryId,inputSequence:1,desktopInput:{key:0,contextMenu:true,modifiers:0,x:0,y:0,at:1000,doubleClickTime:500,doubleClickWidth:4,doubleClickHeight:4}}),true);
  await flush();assert.deepEqual(f.calls.filter(c=>c.method==='desktopMenu').at(-1)?.params.selectedIds,[id]);
  await f.host.acceptSnapshot(f.snap(3,{operable:false,lifecycle:{stage:'desktop',playbackPaused:false,locked:true,revision:2}}));await flush();
  assert.deepEqual(f.calls.filter(c=>c.method==='geometry').at(-1).params.buttons,[]);
 }finally{f.host.dispose();}
});
