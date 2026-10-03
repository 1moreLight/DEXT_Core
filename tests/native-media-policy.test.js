const test=require('node:test'),assert=require('node:assert/strict');
const {install}=require('../lively-core-separation/src/Lively/Lively.Common/Helpers/native-media-policy.js');
function fixture(nonce='document-one'){
 const media=[],observers=[],handlers=new Map(),shadowHandlers=new Map();
 class Target{addEventListener(name,cb){const bag=this.listeners||handlers;if(!bag.has(name))bag.set(name,new Set());bag.get(name).add(cb);}removeEventListener(name,cb){(this.listeners||handlers).get(name)?.delete(cb);}}
 class Element extends Target{attachShadow(){const shadow=new Shadow();return shadow;}}
 class Shadow extends Target{constructor(){super();this.media=[];this.listeners=new Map();}querySelectorAll(){return this.media;}}
 class Document extends Target{querySelectorAll(){return media;}}
 class Media extends Element{constructor(){super();this.running=false;this.plays=0;this.pauses=0;this.isConnected=true;this.currentTime=9;this.parent=null;}play(){this.running=true;this.plays++;return Promise.resolve();}pause(){this.running=false;this.pauses++;}get paused(){return !this.running;}}
 class Observer{constructor(cb){this.cb=cb;this.closed=false;observers.push(this);}observe(){}disconnect(){this.closed=true;}}
 const document=new Document(),root=new Target();Object.assign(root,{top:{},document,crypto:{randomUUID:()=>nonce},Document,ShadowRoot:Shadow,Element,HTMLMediaElement:Media,EventTarget:Target,MutationObserver:Observer});
 install(root,'private-secret');const hook=root.__dextNativeMediaPolicyV1;
 const native=(seq,active,change={})=>hook({token:'private-secret',documentNonce:nonce,sequence:seq,active,...change});
 const node=()=>{const value=new Media();media.push(value);return value;};
 const event=(target,type='play',bag=handlers)=>{for(const cb of bag.get(type)||[])cb({target});};
 return{root,hook,native,node,media,observers,event,Media,Element,Shadow};
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
