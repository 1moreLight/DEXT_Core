const test=require('node:test'),assert=require('node:assert/strict');
const {install}=require('../lively-core-separation/src/Lively/Lively.Common/Helpers/native-media-policy.js');
function fixture(nonce='document-one',options={}){
 const media=[],observers=[],handlers=new Map(),shadowHandlers=new Map();
 class Target{addEventListener(name,cb){const bag=this.listeners||handlers;if(!bag.has(name))bag.set(name,new Set());bag.get(name).add(cb);}removeEventListener(name,cb){(this.listeners||handlers).get(name)?.delete(cb);}}
 class Element extends Target{attachShadow(){const shadow=new Shadow();return shadow;}}
 class Shadow extends Target{constructor(){super();this.media=[];this.listeners=new Map();}querySelectorAll(){return this.media;}}
 class Document extends Target{querySelectorAll(){return media;}}
 class Media extends Element{constructor(){super();this.running=false;this.plays=0;this.pauses=0;this.isConnected=true;this.currentTime=9;this.parent=null;}play(){this.running=true;this.plays++;return Promise.resolve();}pause(){this.running=false;this.pauses++;}get paused(){return !this.running;}}
 class Observer{constructor(cb){this.cb=cb;this.closed=false;observers.push(this);}observe(){}disconnect(){this.closed=true;}}
 const pauses=[],resumes=[];
 class Param{constructor(){this.level=1;}get value(){return this.level;}set value(v){this.level=v;}}
 class AudioNode extends Target{constructor(context){super();this.owner=context;this.connections=[];}connect(target){this.connections.push(target);return target;}disconnect(target){this.connections=this.connections.filter(v=>v!==target);}}
 class Destination extends AudioNode{constructor(context){super(context);this.isDestination=true;}get maxChannelCount(){if(!this.isDestination)throw TypeError('destination receiver');return 2;}}
 class Gain extends AudioNode{constructor(context){super(context);this.level=new Param();}get gain(){return this.level;}}
 class Base extends Target{get state(){return this.nativeState;}get destination(){return this.output;}createGain(){return new Gain(this);}}
 class Audio extends Base{constructor(){super();this.nativeState='running';this.output=new Destination(this);this.nativeResumes=0;}
  resume(){this.nativeResumes++;if(options.deferResume)return new Promise(resolve=>resumes.push(()=>{this.nativeState='running';resolve();}));this.nativeState='running';return Promise.resolve();}
  suspend(){if(options.deferPause)return new Promise(resolve=>pauses.push(()=>{this.nativeState='suspended';resolve();}));this.nativeState='suspended';return Promise.resolve();}
  close(){this.nativeState='closed';return Promise.resolve();}}
 const document=new Document(),root=new Target();Object.assign(root,{top:{},document,crypto:{randomUUID:()=>nonce},Document,ShadowRoot:Shadow,Element,HTMLMediaElement:Media,EventTarget:Target,MutationObserver:Observer,
  AudioContext:Audio,webkitAudioContext:Audio,BaseAudioContext:Base,AudioNode,AudioDestinationNode:Destination,GainNode:Gain,AudioParam:Param,DOMException});
 install(root,'private-secret');const hook=root.__dextNativeMediaPolicyV1;
 const native=(seq,active,change={})=>hook({token:'private-secret',documentNonce:nonce,sequence:seq,active,...change});
 const node=()=>{const value=new Media();media.push(value);return value;};
 const event=(target,type='play',bag=handlers)=>{for(const cb of bag.get(type)||[])cb({target});};
 return{root,hook,native,node,media,observers,event,Media,Element,Shadow,options,AudioNode,Audio,pauses,resumes};
}
test('private native policy is installed before authors and defaults to paused',()=>{
 const f=fixture();const result=f.hook({token:'private-secret',kind:'describe'});assert.equal(result.documentNonce,'document-one');assert.equal(result.active,false);
 assert.equal(Object.getOwnPropertyDescriptor(f.root,'__dextNativeMediaPolicyV1').writable,false);assert.throws(()=>Object.defineProperty(f.root,'__dextNativeMediaPolicyV1',{value:()=>true}));
});
test('SDK or arbitrary tokens, wrong document and old sequences cannot release media',()=>{
 const f=fixture(),node=f.node();node.running=true;f.event(node);for(const extra of [{token:'sdk-token'},{documentNonce:'old-document'},{sequence:0}])assert.equal(f.native(1,true,extra),null);
 assert.equal(node.running,false);f.native(2,true);assert.equal(node.running,true);assert.equal(f.native(1,false),null);assert.equal(node.running,true);
});
test('attempted autoplay while inactive is paused and preserves authored playback intent',async()=>{
 const f=fixture(),node=f.node();await node.play().catch(()=>{});assert.equal(node.running,false);f.native(1,true);await Promise.resolve();assert.equal(node.running,true);assert.equal(node.currentTime,9);
 f.native(2,false);assert.equal(node.running,false);f.native(3,true);assert.equal(node.running,true);
});
test('native control uses captured methods after authors change prototypes and instance methods',()=>{
 const f=fixture(),node=f.node();node.running=true;
 node.pause=()=>{throw Error('authored pause');};node.play=()=>{throw Error('authored play');};
 f.native(1,false);assert.equal(node.running,false);f.native(2,true);assert.equal(node.running,true);
});
test('authored pause cancels saved intent and repeated active policies do not restart playback',async()=>{
 const f=fixture(),node=f.node();await node.play().catch(()=>{});node.pause();f.native(1,true);assert.equal(node.running,false);
 await node.play();const plays=node.plays;f.native(2,true);assert.equal(node.plays,plays);f.native(3,false);f.native(4,true);assert.equal(node.plays,plays+1);
});
test('native media discovery includes captured closed shadow roots',()=>{
 const f=fixture();const host=new f.Element(),shadow=host.attachShadow({mode:'closed'}),node=new f.Media();shadow.media.push(node);node.running=true;
 for(const observer of f.observers)observer.cb([]);assert.equal(node.running,false);f.native(1,true);assert.equal(node.running,true);
});
test('removed media cannot be resumed after a stage change',()=>{
 const f=fixture(),node=f.node();node.running=true;f.native(1,false);node.isConnected=false;f.native(2,true);assert.equal(node.running,false);
});
test('pagehide stops media and old policy cannot revive a retired document',()=>{
 const f=fixture(),node=f.node();node.running=true;f.native(1,true);f.event(null,'pagehide');assert.equal(node.running,false);assert.equal(f.native(2,true),null);assert.equal(f.observers.every(o=>o.closed),true);
});
test('policy nonce belongs to the actual document and installing again cannot replace it',()=>{
 const f=fixture();assert.equal(install(f.root,'author-secret'),false);assert.equal(f.hook({token:'author-secret',kind:'describe'}),null);
 const next=fixture('document-two');assert.equal(next.native(1,true,{documentNonce:'document-one'}),null);assert.equal(next.native(1,true).documentNonce,'document-two');
});


test('a queued native play event cannot undo an authored pause intent',async()=>{
 const f=fixture(),node=f.node();f.native(1,true);await node.play();node.pause();f.event(node,'play');
 f.native(2,false);f.native(3,true);assert.equal(node.running,false);
});

const flushAudio=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
test('AudioContext output defaults muted without exposing its private gate through connect',async()=>{
 const f=fixture(),ctx=new f.root.AudioContext(),source=new f.AudioNode(ctx);assert.equal(source.connect(ctx.destination),ctx.destination);
 assert.notEqual(source.connections[0],ctx.destination);assert.equal(source.connections[0].gain.value,0);await flushAudio();assert.equal(ctx.state,'suspended');
 f.native(1,true);await flushAudio();assert.equal(ctx.state,'running');assert.equal(source.connections[0].gain.value,1);
 source.disconnect(ctx.destination);assert.equal(source.connections.length,0);
});
test('native pause mutes WebAudio immediately and receipt waits for asynchronous suspension',async()=>{
 const f=fixture(),ctx=new f.root.AudioContext(),source=new f.AudioNode(ctx);source.connect(ctx.destination);await flushAudio();f.native(1,true);await flushAudio();
 f.options.deferPause=true;const receipt=f.native(2,false);assert.equal(source.connections[0].gain.value,0);assert.equal(receipt.settled,false);assert.equal(ctx.state,'running');
 for(const settle of f.pauses.splice(0))settle();await flushAudio();assert.equal(f.hook({token:'private-secret',kind:'describe'}).settled,true);assert.equal(ctx.state,'suspended');
});
test('authored suspend survives native restore while an inactive authored resume retains intent',async()=>{
 const f=fixture(),ctx=new f.root.AudioContext();await flushAudio();f.native(1,true);await flushAudio();await ctx.suspend();f.native(2,false);f.native(3,true);await flushAudio();assert.equal(ctx.state,'suspended');
 f.native(4,false);await ctx.resume();assert.equal(ctx.state,'suspended');f.native(5,true);await flushAudio();assert.equal(ctx.state,'running');
});
test('late native resume is re-suspended and cannot reopen an inactive WebAudio output',async()=>{
 const f=fixture('document-one',{deferResume:true}),ctx=new f.root.AudioContext(),source=new f.AudioNode(ctx);source.connect(ctx.destination);await flushAudio();
 f.native(1,true);f.native(2,false);for(const settle of f.resumes.splice(0))settle();await flushAudio();assert.equal(ctx.state,'suspended');assert.equal(source.connections[0].gain.value,0);
});
test('captured AudioContext control ignores authored instance overrides and constructor aliases are protected',async()=>{
 const f=fixture(),ctx=new f.root.webkitAudioContext();await flushAudio();ctx.resume=ctx.suspend=()=>{throw Error('authored override');};f.native(1,true);await flushAudio();assert.equal(ctx.state,'running');f.native(2,false);await flushAudio();assert.equal(ctx.state,'suspended');
 assert.equal(Object.getOwnPropertyDescriptor(f.root,'AudioContext').writable,false);assert.equal(f.root.AudioContext,f.root.webkitAudioContext);assert.equal(ctx.constructor,f.root.AudioContext);
 assert.throws(()=>Object.defineProperty(f.root.AudioNode.prototype,'connect',{value:()=>{}}));
});
test('closed and retired AudioContexts cannot be revived by a later policy or authored resume',async()=>{
 const f=fixture(),ctx=new f.root.AudioContext(),source=new f.AudioNode(ctx);source.connect(ctx.destination);await flushAudio();f.native(1,true);await flushAudio();await ctx.close();f.native(2,false);f.native(3,true);await flushAudio();assert.equal(ctx.state,'closed');assert.equal(source.connections[0].gain.value,0);
 const live=new f.root.AudioContext();await flushAudio();f.event(null,'pagehide');await flushAudio();assert.equal(live.state,'closed');assert.equal(f.native(4,true),null);
});

test('a foreign document method cannot route an untracked AudioContext directly to hardware',()=>{
 const f=fixture(),foreign=new f.Audio(),source=new f.AudioNode(foreign);assert.throws(()=>source.connect(foreign.destination),e=>e.name==='InvalidAccessError');assert.equal(source.connections.length,0);
});
test('a foreign document AudioContext method cannot bypass context ownership',()=>{
 const f=fixture(),foreign=new f.Audio();foreign.nativeState='suspended';assert.throws(()=>f.root.AudioContext.prototype.resume.call(foreign),e=>e.name==='InvalidAccessError');assert.equal(foreign.state,'suspended');
});

test('authored numeric Array prototype setters cannot reveal private WebAudio control records',()=>{
 const f=fixture();let leaked=null;const previous=Object.getOwnPropertyDescriptor(Array.prototype,'0');
 try{
  Object.defineProperty(Array.prototype,'0',{configurable:true,set(value){Object.defineProperty(this,'0',{value,writable:true,configurable:true,enumerable:true});if(value&&Object.hasOwn(value,'gate')&&Object.hasOwn(value,'param'))leaked=value;}});
  new f.root.AudioContext();
 }finally{if(previous)Object.defineProperty(Array.prototype,'0',previous);else delete Array.prototype[0];}
 assert.equal(leaked,null);
});

test('authored Array species cannot observe removed private WebAudio records',async()=>{
 const f=fixture(),ctx=new f.root.AudioContext();await flushAudio();let leaked=null;
 const previous=Object.getOwnPropertyDescriptor(Array.prototype,'constructor');
 try{
  Object.defineProperty(Array.prototype,'constructor',{configurable:true,writable:true,value:{[Symbol.species]:function(){return new Proxy([],{defineProperty(target,key,desc){if(desc.value&&Object.hasOwn(desc.value,'gate')&&Object.hasOwn(desc.value,'param'))leaked=desc.value;return Reflect.defineProperty(target,key,desc);}});}}});
  await ctx.close();
 }finally{Object.defineProperty(Array.prototype,'constructor',previous);}
 assert.equal(leaked,null);
});

test('authored Object toJSON cannot turn an unsettled private pause receipt into settled',async()=>{
 const f=fixture(),ctx=new f.root.AudioContext();await flushAudio();f.native(1,true);await flushAudio();f.options.deferPause=true;f.native(2,false);
 const previous=Object.getOwnPropertyDescriptor(Object.prototype,'toJSON');let observed=0,reply;
 try{
  Object.defineProperty(Object.prototype,'toJSON',{configurable:true,value:function(){if(Object.hasOwn(this,'documentNonce')){observed++;return{documentNonce:this.documentNonce,active:this.active,sequence:this.sequence,settled:true};}return this;}});
  reply=JSON.parse(JSON.stringify(f.hook({token:'private-secret',kind:'describe'})));
 }finally{if(previous)Object.defineProperty(Object.prototype,'toJSON',previous);else delete Object.prototype.toJSON;}
 for(const settle of f.pauses.splice(0))settle();await flushAudio();assert.equal(observed,0);assert.equal(reply.settled,false);
});
