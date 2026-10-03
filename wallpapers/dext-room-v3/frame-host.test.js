"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createFrameHost}=require('./frame-host.js');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(overrides={}){
  const listeners=new Set(),timers=new Map(),calls=[],opens=[],closes=[],states=[],frames=[],outbound=[];
  let serial=0,timerId=0;
  const snapshot=(revision=1,change={})=>({protocolVersion:1,sessionId:'session',roomId:'room',installationStamp:'install',revision,currentDeskId:'home',targetDeskId:null,queuedDeskId:null,transitionId:null,deadlineUtc:null,active:true,operable:true,lifecycle:{stage:'desktop',playbackPaused:false,locked:false,revision:1},...change});
  const capabilities={status:'accepted',capabilities:{'desk.read':'accepted','binding.launch':'missingPermission','time.read':'accepted','hardware.read':'accepted'}};
  const window={addEventListener:(_,callback)=>listeners.add(callback),removeEventListener:(_,callback)=>listeners.delete(callback)};
  const receive=(frame,message,source=frame.contentWindow)=>{for(const callback of [...listeners])callback({source,data:message});};
  const clock={setTimeout:callback=>{timers.set(++timerId,callback);return timerId;},clearTimeout:id=>timers.delete(id)};
  const document={createElement:()=>{
    const frame={style:{},attrs:{},sent:[],handlers:new Map(),removed:false,inert:false,setAttribute(name,value){this.attrs[name]=value;},addEventListener(name,callback){this.handlers.set(name,callback);},removeEventListener(name){this.handlers.delete(name);},remove(){this.removed=true;},load(){this.handlers.get('load')?.();}};
    frame.contentWindow={postMessage:message=>{frame.sent.push(JSON.parse(JSON.stringify(message)));for(const callback of [...(frame.sdkListeners||[])])callback({source:frame.parent,data:message});}};
    frame.parent={postMessage:message=>{outbound.push(message);receive(frame,message);}};frames.push(frame);return frame;
  }};
  const host=createFrameHost({window,document,initialSnapshot:snapshot(),runtimeGeneration:1,initialGeometry:{geometryVersion:1,viewport:{width:1920,height:1080,dpr:1}},
    randomToken:()=> 'document-token-'+(++serial),resolveResource:path=>{if(path!=='safe.html')throw Error('C:/private');return '/content/1/'+path;},
    readCapabilities:async()=>capabilities,implementedCapabilities:['desk.read','binding.launch','time.read'],
    invoke:async value=>{calls.push(value);return {status:'inputRequired'};},subscribeData:(value,emit)=>{opens.push({...value,emit});return()=>closes.push(value.capability);},
    applyState:(frame,value)=>states.push([frame,value]),...clock,...overrides});
  const parent={children:[],append(frame){this.children.push(frame);}};
  const mount=definition=>host.mount({instanceId:'instance',consumerId:'scene',kind:'scene',state:'active',entry:'safe.html',capabilities:Object.keys(capabilities.capabilities),buttonIds:['open'],config:{theme:'blue'},...definition},parent);
  const bind=frame=>{frame.sdkListeners=new Set();const context={parent:frame.parent,console,JSON,Map,Set,Promise,Object,Array,Number,String,Error,TypeError,...clock,
      addEventListener:(name,callback)=>{if(name==='message')frame.sdkListeners.add(callback);},removeEventListener:(_,callback)=>frame.sdkListeners.delete(callback),
      CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},dispatchEvent(){}};
    vm.runInNewContext(fs.readFileSync(__dirname+'/../../creator-kit/v3/sdk/dext-sdk.v1.js','utf8'),context);return context.Dext;};
  const start=async definition=>{const frame=mount(definition),sdk=bind(frame);frame.load();await flush();return{frame,sdk};};
  const request=(frame,extra={})=>{const init=frame.sent.findLast(v=>v.type==='dext:runtime:init');return{type:'dext:runtime:request',apiVersion:1,instanceId:init.instanceId,sessionId:init.sessionId,token:init.token,requestId:'r100',method:'actions.activate',params:{buttonId:'open'},...extra};};
  return{host,start,mount,bind,receive,request,snapshot,capabilities,frames,calls,opens,closes,states,parent,timers,listeners,outbound};
}
test('real SDK initializes once from Core capability states without private route token in its public view',async()=>{
  const f=fixture(),{frame,sdk}=await f.start();const session=await sdk.ready();assert.equal(frame.sandbox,'allow-scripts');assert.equal(frame.src,'/content/1/safe.html');
  assert.deepEqual(JSON.parse(JSON.stringify(sdk.capabilities.get())),{'desk.read':'available','binding.launch':'denied','time.read':'available','hardware.read':'unsupported'});
  assert.equal('token' in session,false);assert.equal(f.host.readDiagnostics().instances[0].ready,true);assert.equal(JSON.stringify(f.host.readDiagnostics()).includes('document-token'),false);
  assert.equal(f.mount(),frame);assert.equal(f.parent.children.length,1);f.host.dispose();
});
test('SDK activation has fixed consumer identity and no input proof is minted by the host',async()=>{
  const f=fixture(),{sdk}=await f.start();assert.equal((await sdk.actions.activate('open')).status,'inputRequired');assert.equal(f.calls.length,1);
  assert.equal(f.calls[0].consumerId,'scene');assert.deepEqual(f.calls[0].params,{buttonId:'open'});assert.equal(f.calls[0].identity.revision,1);assert.equal('ticket' in f.calls[0],false);
  await assert.rejects(sdk.actions.activate('unknown'),{code:'invalidButton'});await assert.rejects(sdk.storage.get('key'),{code:'undeclaredCapability'});f.host.dispose();
});
test('spoofed source/token/session/version/shape never reaches the trusted operation adapter',async()=>{
  const f=fixture(),{frame}=await f.start();const valid=f.request(frame);
  f.receive(frame,valid,{});
  for(const change of [{token:'old'},{sessionId:'other'},{apiVersion:2},{consumerId:'official'},{params:{buttonId:'open',ticket:'fake'}},{method:'native.launch'}])f.receive(frame,{...valid,...change});
  await flush();assert.equal(f.calls.length,0);f.host.dispose();
});
test('host independently rejects oversized/deep/nonfinite packets and duplicate request replay',async()=>{
  const f=fixture(),{frame}=await f.start();let nested={};for(let i=0;i<26;i++)nested={nested};
  for(const params of [{buttonId:'open',pad:'x'.repeat(33000)},{buttonId:'open',nested},{buttonId:'open',value:Infinity}])f.receive(frame,f.request(frame,{params}));
  const valid=f.request(frame,{requestId:'r101'});f.receive(frame,valid);f.receive(frame,valid);await flush();assert.equal(f.calls.length,1);f.host.dispose();
});
test('SDK readout subscription is shared once, suspended in place and restored with fresh Core scope',async()=>{
  const f=fixture(),{frame,sdk}=await f.start(),readout={hidden:false},outer={present:true};let value;
  const a=sdk.data.bindReadout('time.read',readout,data=>{value=data;});const b=sdk.data.subscribe('time.read',()=>{});await flush();assert.equal(f.opens.length,1);
  f.opens[0].emit({status:'available',value:{ticks:1}});assert.equal(readout.hidden,false);assert.deepEqual(JSON.parse(JSON.stringify(value)),{ticks:1});
  f.host.setState('instance','suspended');await flush();assert.equal(readout.hidden,true);assert.equal(outer.present,true);assert.equal(f.closes.length,1);assert.equal(frame.removed,false);
  f.opens[0].emit({status:'available',value:{ticks:99}});assert.equal(readout.hidden,true);
  f.host.setState('instance','active');await flush();assert.equal(f.opens.length,2);f.opens[1].emit({status:'available',value:2});assert.equal(readout.hidden,false);
  a();b();await flush();assert.equal(f.closes.length,2);f.host.dispose();
});
test('Core revision changes stop old data callbacks and reject late read replies',async()=>{
  let resolve;const f=fixture({invoke:value=>new Promise(done=>{resolve=done;})}),{sdk}=await f.start();sdk.data.subscribe('time.read',()=>{});await flush();const old=f.opens[0];
  const read=sdk.desk.get(),denied=assert.rejects(read,{code:'staleInput'});f.host.acceptSnapshot(f.snapshot(2));await flush();resolve({secret:'stale'});await denied;
  let delivered;const off=sdk.data.subscribe('time.read',value=>{delivered=value;});old.emit({status:'available',value:'stale'});assert.notEqual(delivered?.value,'stale');off();f.host.dispose();
});
test('reload rotates routing token, cancels old sources and keeps the iframe node',async()=>{
  const f=fixture(),{frame,sdk}=await f.start();sdk.data.subscribe('time.read',()=>{});await flush();const old=f.request(frame);const nextSDK=f.bind(frame);frame.load();await flush();await nextSDK.ready();
  assert.notEqual(old.token,f.request(frame).token);f.receive(frame,old);await flush();assert.equal(f.calls.length,0);assert.equal(f.closes.length,1);assert.equal(f.frames.length,1);f.host.dispose();
});
test('late permission response cannot initialize a superseded revision',async()=>{
  const permissions=[];const f=fixture({readCapabilities:()=>new Promise(resolve=>permissions.push(resolve))});const frame=f.mount(),sdk=f.bind(frame);frame.load();
  f.host.acceptSnapshot(f.snapshot(2));permissions[0](f.capabilities);await flush();assert.equal(sdk.session,null);
  permissions[1](f.capabilities);await flush();assert.equal((await sdk.ready()).snapshot.revision,2);f.host.dispose();
});
test('config and geometry events update the real SDK without remounting or leaking another consumer config',async()=>{
  const f=fixture(),{frame,sdk}=await f.start();let config,geometry;sdk.config.subscribe(value=>config=value);sdk.scene.subscribeGeometry(value=>geometry=value);
  f.host.updateConfig('instance',{theme:'red'});f.host.setGeometry({geometryVersion:2,viewport:{width:1280,height:720,dpr:1.5}});
  assert.equal(config.theme,'red');assert.equal(geometry.geometryVersion,2);assert.equal(geometry.viewport.dpr,1.5);assert.equal(f.frames.length,1);assert.equal(frame.removed,false);f.host.dispose();
});
test('64 pending host requests are bounded and operation errors never expose private exceptions',async()=>{
  const f=fixture({invoke:()=>new Promise(()=>{})}),{frame}=await f.start();for(let i=1;i<=65;i++)f.receive(frame,f.request(frame,{requestId:'r'+i}));await flush();
  assert.equal(f.host.readDiagnostics().instances[0].pendingRequests,64);assert.equal(frame.sent.findLast(v=>v.requestId==='r65').error.code,'requestLimit');f.host.dispose();assert.equal(f.timers.size,0);
  const g=fixture({invoke:()=>{throw Error('C:/private/target.exe');}}),{sdk}=await g.start();await assert.rejects(sdk.actions.activate('open'),error=>error.code==='operationFailed'&&!error.message.includes('private'));g.host.dispose();
});
test('scene completion and startup done are limited to current declared role and phase',async()=>{
  const f=fixture(),{frame,sdk}=await f.start({consumerId:'component.widget',kind:'widget'});
  f.receive(frame,f.request(frame,{method:'scene.done',params:{}}));f.receive(frame,f.request(frame,{requestId:'r101',method:'scene.completeTransition',params:{transitionId:'fake'}}));await flush();assert.equal(f.calls.length,0);
  f.host.dispose();assert.equal(sdk.diagnostics().disposed,true);assert.equal(f.listeners.size,0);assert.equal(frame.removed,true);
});
test('missing/invalid resource and disposed host cannot create unverified frames',()=>{
  const f=fixture();assert.throws(()=>f.mount({entry:'C:/private'}),{code:'resourceUnavailable'});assert.equal(f.parent.children.length,0);f.host.dispose();assert.throws(()=>f.mount(),{code:'disposed'});
});

test('subscription adapter failure delivers error state and releases the source',async()=>{
  const f=fixture({subscribeData:()=>Promise.reject(Error('C:/private'))}),{sdk}=await f.start();let status;
  sdk.data.subscribe('time.read',state=>{status=state.status;});await flush();assert.equal(status,'error');assert.equal(f.host.readDiagnostics().instances[0].dataSources,0);f.host.dispose();
});

test('private Player suspension preserves iframe but cancels old sources until fresh Core snapshot authorization',async()=>{
  const f=fixture(),{frame,sdk}=await f.start();let delivered;
  sdk.data.subscribe('time.read',value=>delivered=value);await flush();const source=f.opens[0];
  assert.equal(f.host.setPlaybackSuspended(true),true);assert.equal(f.closes.length,1);assert.equal(frame.removed,false);
  source.emit({status:'available',value:'old'});assert.notEqual(delivered?.value,'old');
  f.host.acceptSnapshot(f.snapshot(2));await flush();assert.equal(f.opens.length,1);
  assert.equal(f.host.setPlaybackSuspended('false'),false);assert.equal(f.host.setPlaybackSuspended(false),true);await flush();
  assert.equal(f.opens.length,2);assert.equal(f.opens[1].identity.revision,2);assert.equal(frame.sent.filter(value=>value.type==='dext:runtime:init').length,1);
  f.host.dispose();
});


test('cancelled permission query from an old Core revision cannot poison current diagnostics',async()=>{
 const queries=[];const f=fixture({readCapabilities:()=>new Promise((resolve,reject)=>queries.push({resolve,reject}))});
 const frame=f.mount(),sdk=f.bind(frame);frame.load();f.host.acceptSnapshot(f.snapshot(2));
 queries[0].reject(Object.assign(Error('scope cancelled'),{code:'staleInput'}));await flush();assert.equal(f.host.readDiagnostics().lastError,null);
 queries[1].resolve(f.capabilities);await flush();assert.equal((await sdk.ready()).snapshot.revision,2);assert.equal(f.host.readDiagnostics().lastError,null);f.host.dispose();
});

test('permission rejection after document disposal cannot add a late diagnostic',async()=>{
 let reject;const f=fixture({readCapabilities:()=>new Promise((_,fail)=>reject=fail)});const frame=f.mount();frame.load();f.host.dispose();reject(Error('disposed'));await flush();assert.equal(f.host.readDiagnostics().lastError,null);
});

test('real SDK storage keeps current consumer identity and independently rejects withdrawn write consent',async()=>{
 let writable=true;const values=new Map(),calls=[];const f=fixture({implementedCapabilities:['storage.read','storage.write'],readCapabilities:async()=>({status:'accepted',capabilities:{'storage.read':'accepted','storage.write':writable?'accepted':'missingPermission'}}),invoke:async value=>{calls.push(value);if(value.method==='storage.set'){values.set(value.params.key,value.params.value);return{status:'accepted'};}return values.get(value.params.key)??null;}});
 const {sdk}=await f.start({capabilities:['storage.read','storage.write']});assert.equal(await sdk.storage.get('missing'),null);await sdk.storage.set('notes',{label:'\u65e5\u671f',items:[1,true,null]});assert.deepEqual(JSON.parse(JSON.stringify(await sdk.storage.get('notes'))),{label:'\u65e5\u671f',items:[1,true,null]});
 assert.equal(calls.every(v=>v.consumerId==='scene'&&v.identity.revision===1),true);writable=false;f.host.refreshPermissions();await flush();await assert.rejects(sdk.storage.set('notes',null),{code:'denied'});assert.deepEqual(JSON.parse(JSON.stringify(await sdk.storage.get('notes'))),{label:'\u65e5\u671f',items:[1,true,null]});f.host.dispose();
});

test('real SDK control errors preserve bounded safe status and current consumer',async()=>{
 for(const code of ['controlUnavailable','rateLimited']){
   const f=fixture({implementedCapabilities:['media.control','audio.control'],readCapabilities:async()=>({status:'accepted',capabilities:{'media.control':'accepted','audio.control':'accepted'}}),invoke:async value=>{f.calls.push(value);throw Object.assign(Error('private native details'),{code});}});
   const {sdk}=await f.start({capabilities:['media.control','audio.control']});await assert.rejects(sdk.media.control('pause'),{code});await assert.rejects(sdk.audio.control({muted:true}),{code});
   assert.equal(f.calls.every(v=>v.consumerId==='scene'&&v.identity.revision===1),true);f.host.dispose();
 }
});
