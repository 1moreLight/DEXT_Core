const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(__dirname+'/main.js','utf8');const {createPlaybackHost}=require('./playback-host.js');
function fixture(){
 const listeners=new Map(),transportListeners=new Set(),sent=[],hosts=[];const container={};
 const sandbox={console,TextEncoder,crypto,JSON,Object,Array,Number,String,Set,Map,Promise,Error,innerWidth:640,innerHeight:480,devicePixelRatio:1,
   document:{getElementById:()=>container},chrome:{webview:{postMessage:s=>sent.push(JSON.parse(s)),addEventListener:(_,cb)=>transportListeners.add(cb),removeEventListener:(_,cb)=>transportListeners.delete(cb)}},
   addEventListener:(name,cb)=>listeners.set(name,cb),removeEventListener:name=>listeners.delete(name),DextPlaybackHost:{createPlaybackHost},
   DextNativeHost:{createNativeHost:()=>({})},DextDomHost:{createDomHost:options=>{const host={options,disposed:false,pauses:[],snapshots:[],ready:Promise.resolve(),setPlaybackSuspended:v=>host.pauses.push(v),acceptSnapshot:async v=>{host.snapshots.push(v);return true;},resize:async()=>true,dispose(){host.disposed=true;},readDiagnostics:()=>({disposed:host.disposed})};hosts.push(host);return host;}}};
 vm.runInNewContext(source,sandbox);function send(data){for(const callback of transportListeners)callback({data});}
 const context=(generation=1)=>({type:'dext:v3-runtime',protocolVersion:1,runtimeGeneration:generation,sessionId:'session',roomId:'room',installationStamp:'stamp',resourceBasePath:'/content/'+generation+'/',
   resources:[{path:'bg.svg'}],manifest:{version:3,apiVersion:1,id:'room',resources:['bg.svg'],desks:[{id:'home',components:[],icons:[]}]}});
 const snapshot=(revision=1,generation=1)=>({type:'dext:v3-session',protocolVersion:1,runtimeGeneration:generation,sessionId:'session',roomId:'room',installationStamp:'stamp',revision,deskIds:['home'],currentDeskId:'home',targetDeskId:null,queuedDeskId:null,transitionId:null,deadlineUtc:null,active:true,operable:true,lifecycle:{stage:'desktop',playbackPaused:false,locked:false,revision:revision}});
 return{sandbox,send,context,snapshot,hosts,sent,listeners};
}
test('official page requests ready and mounts only matching context plus Core snapshot',()=>{
 const f=fixture();assert.deepEqual(f.sent,[{type:'dext:v3-page-ready'}]);f.send(f.context());assert.equal(f.hosts.length,0);
 f.send({...f.snapshot(),installationStamp:'other'});assert.equal(f.hosts.length,0);f.send(f.snapshot());assert.equal(f.hosts.length,1);
 f.send(f.snapshot());assert.equal(f.hosts[0].snapshots.length,0);f.send(f.snapshot(2));assert.equal(f.hosts[0].snapshots.length,1);
});
test('revoke leaves a generation tombstone and a new generation retires old DOM',()=>{
 const f=fixture();f.send(f.context());f.send(f.snapshot());f.send({type:'dext:v3-runtime-revoked',runtimeGeneration:1,sessionId:'session'});assert.equal(f.hosts[0].disposed,true);
 f.send(f.context());f.send(f.snapshot(2));assert.equal(f.hosts.length,1);f.send(f.context(2));f.send(f.snapshot(1,2));assert.equal(f.hosts.length,2);
 f.send({type:'dext:v3-runtime-revoked',runtimeGeneration:1,sessionId:'session'});assert.equal(f.hosts[1].disposed,false);
});
test('private resume applies latest snapshot before releasing retained host',()=>{
 const f=fixture();f.send(f.context());f.send(f.snapshot());const hook=f.sandbox.dextNativePlaybackChanged;
 assert.equal(hook({type:'dext:v3-playback',protocolVersion:1,sequence:1,runtimeGeneration:1,paused:true,messages:[]}),true);
 assert.equal(hook({type:'dext:v3-playback',protocolVersion:1,sequence:2,runtimeGeneration:1,paused:false,messages:[f.context(),f.snapshot(3)]}),true);
 assert.equal(f.hosts.length,1);assert.equal(f.hosts[0].snapshots.at(-1).revision,3);assert.deepEqual(f.hosts[0].pauses,[true,true,false]);
 assert.equal(hook({type:'dext:v3-playback',protocolVersion:1,sequence:1,runtimeGeneration:1,paused:false,messages:[]}),false);
});
test('resume may initialize a new valid context; old generation hooks cannot release it',()=>{
 const f=fixture();f.send(f.context());f.send(f.snapshot());const hook=f.sandbox.dextNativePlaybackChanged;
 assert.equal(hook({type:'dext:v3-playback',protocolVersion:1,sequence:1,runtimeGeneration:2,paused:false,messages:[f.context(2),f.snapshot(1,2)]}),true);
 assert.equal(f.hosts[0].disposed,true);assert.equal(f.hosts[1].options.initialPlaybackSuspended,true);assert.equal(f.hosts[1].pauses.at(-1),false);
 assert.equal(hook({type:'dext:v3-playback',protocolVersion:1,sequence:2,runtimeGeneration:1,paused:false,messages:[]}),false);
});
test('a native floor before first context is inherited and malformed resource scope never mounts',()=>{
 const f=fixture();f.sandbox.dextNativePlaybackChanged({type:'dext:v3-playback',protocolVersion:1,sequence:1,runtimeGeneration:1,paused:true,messages:[]});
 f.send({...f.context(),resourceBasePath:'https://outside.test/'});f.send(f.snapshot());assert.equal(f.hosts.length,0);
 f.send(f.context());f.send(f.snapshot());assert.equal(f.hosts[0].options.initialPlaybackSuspended,true);
});
test('page disposal unregisters private listeners and disposes the owned DOM',()=>{
 const f=fixture();f.send(f.context());f.send(f.snapshot());f.listeners.get('pagehide')();assert.equal(f.hosts[0].disposed,true);f.send(f.context(2));f.send(f.snapshot(1,2));assert.equal(f.hosts.length,1);
});

test('malformed transition cannot advance the official snapshot revision',()=>{
 const f=fixture();f.send(f.context());f.send(f.snapshot());f.send({...f.snapshot(5),transitionId:'unexpected',deadlineUtc:'not a date'});
 assert.equal(f.sandbox.dextRuntimeDiagnostics().revision,1);f.send(f.snapshot(2));assert.equal(f.hosts[0].snapshots.at(-1).revision,2);
});
