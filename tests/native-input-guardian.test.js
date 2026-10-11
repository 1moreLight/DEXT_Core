const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const target='../lively-core-separation/src/Lively/Lively.Common/Helpers/native-input-guardian.js';
const install=fs.existsSync(require('node:path').resolve(__dirname,target))?require(target).install:()=>false;
const OWNERS=new WeakMap(),EVENT_STATES=new WeakMap(),NATIVE_HANDLERS=new WeakMap();
const SECRET='a'.repeat(64),NONCE='11111111-1111-4111-8111-111111111111';
const request=(number=1,method='actions.activate',params={buttonId:'open'})=>JSON.stringify({type:'dext:runtime:request',apiVersion:1,instanceId:'widget.one',sessionId:NONCE,token:'route-token',requestId:'r'+number,method,params});
function fixture(controlledDock=false){
 const events=EVENT_STATES,bags=new WeakMap(),attributes=new WeakMap(),handlers=NATIVE_HANDLERS,owners=OWNERS,sent=[];let document=null;
 class Evt{constructor(type,{trusted=false,key='',path=[],button=0,pointerType='mouse'}={}){events.set(this,{type,trusted,key,path,button,pointerType,phase:0,currentTarget:null});Object.defineProperty(this,'isTrusted',{get(){const s=events.get(this);if(!s)throw TypeError('Event brand');return s.trusted;}});}
  preventDefault(){events.get(this).prevented=true;}stopImmediatePropagation(){events.get(this).stopped=true;}get pointerType(){return events.get(this).pointerType;}
  get type(){const s=events.get(this);if(!s)throw TypeError('Event brand');return s.type;}get eventPhase(){const s=events.get(this);if(!s)throw TypeError('Event brand');return s.phase;}
  get currentTarget(){const s=events.get(this);if(!s)throw TypeError('Event brand');return s.currentTarget;}get key(){const s=events.get(this);if(!s)throw TypeError('Event brand');return s.key;}get button(){const s=events.get(this);if(!s)throw TypeError('Event brand');return s.button;}composedPath(){return events.get(this).path.slice();}}
 class Target{addEventListener(name,callback,options){if(!callback)return;const receiver=this==null?root:this;const capture=typeof options==='boolean'?options:!!options?.capture;
  let bag=bags.get(receiver);if(!bag){bag=[];bags.set(receiver,bag);}if(bag.some(v=>v.name===name&&v.callback===callback&&v.capture===capture&&!v.removed))return;
  const item={name,callback,capture,once:!!options?.once,removed:false};if(options?.signal?.aborted)return;bag.push(item);options?.signal?.addEventListener('abort',()=>{item.removed=true;},{once:true});}
  removeEventListener(name,callback,options){const receiver=this==null?root:this;const capture=typeof options==='boolean'?options:!!options?.capture;for(const item of bags.get(receiver)||[])if(item.name===name&&item.callback===callback&&item.capture===capture)item.removed=true;}dispatchEvent(ev){const receiver=this==null?root:this;const data=events.get(ev);if(!data)throw TypeError('Event brand');data.trusted=false;data.path=[receiver];invoke(receiver,ev,true,2);invoke(receiver,ev,false,2);data.phase=0;return true;}}
 class Node extends Target{constructor(){super();owners.set(this,document);}get ownerDocument(){if(!owners.has(this))throw TypeError('Node brand');return owners.get(this);}}
 class Element extends Node{attachShadow(){return new Shadow();}setAttribute(name,value){let a=attributes.get(this);if(!a){a={};attributes.set(this,a);}a[name]=String(value);if(/^on/.test(name)){this._setInline(name,new Function('event',String(value)));}}
  setAttributeNS(ns,name,value){return this.setAttribute(name,value);}getAttribute(name){return attributes.get(this)?.[name]??null;}
  _setInline(name,callback){let h=handlers.get(this);if(!h){h={};handlers.set(this,h);}h[name]=callback;}
 }
 let focusCalls=0;class Html extends Element{} class Svg extends Element{} class Document extends Node{} class Window extends Target{focus(){focusCalls++;}} class Shadow extends Node{}
 for(const proto of [Html.prototype,Svg.prototype,Document.prototype,Window.prototype])for(const name of ['onclick','onmousedown','onmouseup','onkeydown','onkeyup','onerror'])Object.defineProperty(proto,name,{configurable:true,enumerable:true,get(){return handlers.get(this)?.[name]??null;},set(value){let h=handlers.get(this);if(!h){h={};handlers.set(this,h);}h[name]=typeof value==='function'?value:null;}});
 const root=new Window();document=new Document();
 Object.defineProperty(Window.prototype,'window',{configurable:true,get(){'use strict';if(this==null)return root;if(this instanceof Window)return this;throw TypeError('Window brand');}});Object.assign(root,{top:{},document,Window,Document,Node,DOMException,Function,Event:Evt,EventTarget:Target,Element,HTMLElement:Html,SVGElement:Svg,ShadowRoot:Shadow,KeyboardEvent:Evt,MouseEvent:Evt,PointerEvent:Evt,performance:{now:()=>0},crypto:{randomUUID:()=>NONCE},chrome:{webview:{postMessage(payload){Object.defineProperty(sent,sent.length,{value:JSON.parse(JSON.stringify(payload)),writable:true,configurable:true,enumerable:true});}}}});
 const node=new Html();let activeEvent=null;
 function invoke(target,ev,capture,phase){events.get(ev).phase=phase;events.get(ev).currentTarget=target;activeEvent=ev;for(const item of [...(bags.get(target)||[])]){if(events.get(ev).stopped)break;if(item.removed||item.name!==ev.type||item.capture!==capture)continue;if(item.once)item.removed=true;typeof item.callback==='function'?item.callback.call(target,ev):item.callback.handleEvent.call(item.callback,ev);}
  if(!capture&&!events.get(ev).stopped){const cb=handlers.get(target)?.['on'+ev.type];if(cb)cb.call(target,ev);}}
 function fire(target=node,type='click',options={}){const path=options.path||(target===root?[root]:target===document?[document,root]:[target,document,root]);const ev=new Evt(type,{trusted:true,...options,path});for(let i=path.length-1;i>0;i--)invoke(path[i],ev,true,1);invoke(path[0],ev,true,2);invoke(path[0],ev,false,2);for(let i=1;i<path.length;i++)invoke(path[i],ev,false,3);events.get(ev).phase=0;events.get(ev).currentTarget=null;activeEvent=null;return ev;}
 const installed=install(root,SECRET,controlledDock);assert.equal(installed,true,'input guardian must install into the controlled native realm');
 const hook=root.__dextNativeInputGuardianV1,send=root.__dextNativeInputRequestV1;
 const arm=(gestureId=1,structuralVersion=1)=>hook({token:SECRET,kind:'arm',documentNonce:NONCE,gestureId,structuralVersion});
 const nativeProperty=(target,name,...args)=>Reflect.apply(handlers.get(target)?.[name],target,args);return{root,node,document,Html,Svg,Shadow,hook,send,arm,fire,sent,events,nativeProperty,focusCalls:()=>focusCalls};
}
test('defaults closed and author tokens cannot arm a document',()=>{const f=fixture();assert.equal(f.send(request()),false);assert.equal(f.hook({token:'author',kind:'describe'}),null);assert.equal(f.hook({token:SECRET,kind:'arm',documentNonce:'old',gestureId:1,structuralVersion:1}),null);assert.equal(f.hook({token:SECRET,kind:'describe'}).armed,false);});
test('one synchronous real handler sends only captured private witness and immutable request JSON',()=>{const f=fixture();f.arm(7,9);const json=request();f.node.addEventListener('click',function(){assert.equal(this,f.node);assert.equal(f.send(json),true);});f.fire();assert.deepEqual(f.sent,[{type:'dext:v3-input-witness',protocolVersion:1,token:SECRET,documentNonce:NONCE,gestureId:7,structuralVersion:9,dispatchSequence:1,requestJson:json}]);assert.equal(f.send(request(2)),false);});
test('synthetic nested callbacks are denied and outer real callback resumes',()=>{const f=fixture();f.arm();const rows=[];f.node.addEventListener('click',ev=>{if(!ev.isTrusted){rows.push(f.send(request(2)));return;}rows.push(f.send(request(1)));f.fire(f.node,'click',{trusted:false});rows.push(f.send(request(3)));});f.fire();assert.deepEqual(rows,[true,false,true]);});
test('promise and queueMicrotask do not inherit synchronous authority',async()=>{const f=fixture();f.arm();const rows=[];f.node.addEventListener('click',()=>{Promise.resolve().then(()=>rows.push(f.send(request(1))));queueMicrotask(()=>rows.push(f.send(request(2))));});f.fire();await Promise.resolve();await Promise.resolve();assert.deepEqual(rows,[false,false]);assert.equal(f.sent.length,0);});
test('onclick getter preserves callback identity and timer cannot invoke cached real Event for permission',async()=>{const f=fixture();f.arm();let ev;const rows=[],callback=e=>rows.push(f.send(request(rows.length+1)));f.node.onclick=callback;assert.equal(f.node.onclick,callback);f.node.addEventListener('click',e=>{ev=e;});f.fire();await new Promise(resolve=>setTimeout(()=>{f.node.onclick(ev);resolve();},0));assert.deepEqual(rows,[true,false]);});
test('original callback removal, object handleEvent identity, once and AbortSignal remain effective',()=>{const f=fixture();f.arm();let calls=0;const callback=()=>{calls++;},object={handleEvent(){assert.equal(this,object);calls++;}};f.node.addEventListener('click',callback);f.node.removeEventListener('click',callback);f.node.addEventListener('click',object,{once:true});const c=new AbortController();f.node.addEventListener('click',callback,{signal:c.signal});c.abort();f.fire();f.fire();assert.equal(calls,1);});
test('arm and revoke cannot revive the current callback or replay an old gesture',()=>{const f=fixture();f.arm(3);const rows=[];f.node.onclick=()=>{f.arm(4);rows.push(f.send(request(1)));};f.fire();assert.deepEqual(rows,[false]);f.hook({token:SECRET,kind:'revoke',documentNonce:NONCE});assert.equal(f.arm(4),null);assert.equal(f.arm(3),null);assert.equal(f.hook({token:SECRET,kind:'describe'}).armed,false);});
test('only primary mouse or Enter and Space key handlers can witness requests',()=>{const f=fixture();f.arm();const rows=[];let n=0;for(const name of ['click','mousedown','mouseup','keydown','keyup','message'])f.node.addEventListener(name,()=>rows.push(f.send(request(++n))));for(const [type,extra] of [['click',{button:2}],['mousedown',{}],['mouseup',{}],['keydown',{key:'Enter'}],['keyup',{key:' '}],['keydown',{key:'a'}],['message',{}]])f.fire(f.node,type,extra);assert.deepEqual(rows,[false,true,true,true,true,false,false]);});
test('inline handlers from initial capture and synchronous ancestor attribute mutation are guarded',()=>{const f=fixture();f.arm();const ancestor=new f.Html(),results=[];f.root.__record=label=>results.push([label,f.send(request(results.length+1))]);f.node.setAttribute('onclick','this.owner.__record("initial")');f.node.owner=f.root;ancestor.owner=f.root;ancestor.setAttribute('onclick','this.owner.__record("before")');f.node.addEventListener('click',()=>{ancestor.setAttribute('onclick','this.owner.__record("changed")');});f.fire(f.node,'click',{path:[f.node,ancestor,f.document,f.root]});assert.deepEqual(results,[['initial',true],['changed',true]]);});
test('SVG, Document and Window property handlers and discovered closed shadows preserve callbacks',()=>{const f=fixture();f.arm();const rows=[];let n=0;for(const node of [new f.Svg(),f.document,f.root]){const callback=()=>rows.push(f.send(request(++n)));node.onclick=callback;assert.equal(node.onclick,callback);f.fire(node);}const host=new f.Html(),shadow=host.attachShadow({mode:'closed'});assert.ok(shadow);assert.equal(Object.getOwnPropertyDescriptor(f.root.Element.prototype,'attachShadow').configurable,true);assert.deepEqual(rows,[true,true,true]);});
test('malformed request and unsupported methods cannot produce witnesses',()=>{const f=fixture();f.arm();const rows=[];f.node.onclick=()=>{for(const value of [null,{},'{}','x',request(1,'storage.set',{key:'x',value:1}),request(2,'actions.activate',{buttonId:'bad/id'})])rows.push(f.send(value));};f.fire();assert.deepEqual(rows,[false,false,false,false,false,false]);assert.equal(f.sent.length,0);});
test('captured native transport ignores authored replacement and accessor request arguments',()=>{const f=fixture();f.arm();let attacked=0;f.root.chrome.webview.postMessage=()=>{attacked++;};f.node.onclick=()=>assert.equal(f.send(request()),true);f.fire();assert.equal(attacked,0);assert.equal(f.sent.length,1);const value={kind:'describe'};Object.defineProperty(value,'token',{get(){attacked++;return SECRET;}});assert.equal(f.hook(value),null);assert.equal(attacked,0);});
test('inherited toJSON and numeric setters cannot observe secret witnesses or private callback state',()=>{const f=fixture();f.arm();let observed=0;const json=request(),previous=Object.getOwnPropertyDescriptor(Object.prototype,'toJSON');try{Object.defineProperty(Object.prototype,'toJSON',{configurable:true,value(){observed++;return this;}});f.node.onclick=()=>assert.equal(f.send(json),true);f.fire();assert.equal(f.hook({token:SECRET,kind:'describe'}).armed,true);}finally{if(previous)Object.defineProperty(Object.prototype,'toJSON',previous);else delete Object.prototype.toJSON;}assert.equal(observed,0);});
test('pagehide closes the actual document and a second installation cannot replace policy',()=>{const f=fixture();f.arm();assert.equal(install(f.root,'b'.repeat(64)),false);f.fire(f.root,'pagehide');assert.equal(f.hook({token:SECRET,kind:'describe'}),null);assert.equal(f.arm(9),null);});


test('nested custom or trusted non-input callbacks cannot borrow an outer click',()=>{const f=fixture();f.arm();const rows=[];f.node.addEventListener('custom',()=>rows.push(f.send(request(1))));f.node.addEventListener('message',()=>rows.push(f.send(request(2))));f.node.onclick=()=>{f.fire(f.node,'custom',{trusted:false});f.fire(f.node,'message',{trusted:true});rows.push(f.send(request(3)));};f.fire();assert.deepEqual(rows,[false,false,true]);});

test('parsing and validators never invoke authored RegExp, String or Number hooks',()=>{
 const f=fixture();f.arm();const json=request(),malformed=request(2,'actions.activate',{buttonId:'bad/id'}),huge=request(3,'audio.control',{settings:{volume:1}}).replace('"volume":1','"volume":1e999');
 const oldExec=RegExp.prototype.exec,oldSubstring=String.prototype.substring,oldFinite=Number.isFinite;let called=0;const rows=[];
 f.node.onclick=()=>{rows.push(f.send(json),f.send(malformed),f.send(huge));};
 try{RegExp.prototype.exec=function(){called++;return ['forged'];};String.prototype.substring=function(){called++;return Reflect.apply(oldSubstring,this,arguments);};Number.isFinite=()=>{called++;return true;};f.fire();}
 finally{RegExp.prototype.exec=oldExec;String.prototype.substring=oldSubstring;Number.isFinite=oldFinite;}
 assert.equal(called,0);assert.deepEqual(rows,[true,false,false]);assert.equal(f.sent.length,1);
});
test('all four declared privileged methods accept their exact SDK parameters only',()=>{
 const f=fixture();f.arm();const rows=[];f.node.onclick=()=>{for(const [n,method,params] of [[1,'desk.navigate',{action:{type:'desk.next'}}],[2,'desk.navigate',{action:{type:'desk.go',deskId:'focus'}}],[3,'media.control',{action:'toggle'}],[4,'audio.control',{settings:{volume:0.4,muted:true}}],[5,'desk.navigate',{action:{type:'desk.next',deskId:'focus'}}],[6,'media.control',{action:'launch'}],[7,'audio.control',{settings:{volume:-1}}]])rows.push(f.send(request(n,method,params)));};f.fire();assert.deepEqual(rows,[true,true,true,true,false,false,false]);
});
test('a request cannot be replayed within another real callback of the same document',()=>{const f=fixture();f.arm();const rows=[];f.node.onclick=()=>rows.push(f.send(request()));f.fire();f.fire();assert.deepEqual(rows,[true,false]);assert.equal(f.sent.length,1);});
test('inherited array index setters and species cannot observe secret records',()=>{
 const f=fixture();f.arm();const json=request(),index=Object.getOwnPropertyDescriptor(Array.prototype,'0'),ctor=Object.getOwnPropertyDescriptor(Array.prototype,'constructor');let leaked=false;
 const inspect=value=>{if(value&&typeof value==='object'&&(Object.hasOwn(value,'token')&&value.token===SECRET||Object.hasOwn(value,'gesture')))leaked=true;};
 try{Object.defineProperty(Array.prototype,'0',{configurable:true,set(value){inspect(value);Object.defineProperty(this,'0',{value,writable:true,configurable:true,enumerable:true});}});Object.defineProperty(Array.prototype,'constructor',{configurable:true,value:{[Symbol.species]:function(){return new Proxy([],{defineProperty(target,key,descriptor){inspect(descriptor.value);return Reflect.defineProperty(target,key,descriptor);}});}}});f.node.onclick=()=>assert.equal(f.send(json),true);f.fire();}
 finally{if(index)Object.defineProperty(Array.prototype,'0',index);else delete Array.prototype[0];Object.defineProperty(Array.prototype,'constructor',ctor);}
 assert.equal(leaked,false);assert.equal(f.sent.length,1);
});


test('borrowed DOM methods and property accessors reject foreign documents before exposing hidden wrappers',()=>{
 const f=fixture(),other=fixture();const callback=()=>{};f.node.onclick=callback;other.node.onclick=()=>{};
 const descriptor=Object.getOwnPropertyDescriptor(other.Html.prototype,'onclick');
 for(const call of [()=>descriptor.get.call(f.node),()=>descriptor.set.call(f.node,callback),
   ()=>other.root.EventTarget.prototype.addEventListener.call(f.node,'click',callback),
   ()=>other.root.EventTarget.prototype.removeEventListener.call(f.node,'click',callback),
   ()=>other.root.Element.prototype.setAttribute.call(f.node,'onclick',''),
   ()=>other.root.Element.prototype.attachShadow.call(f.node,{mode:'closed'})]){
  assert.throws(call,error=>error.name==='SecurityError');
 }
 assert.equal(f.node.onclick,callback);
});


test('bare and null-receiver global EventTarget calls preserve native Window semantics',()=>{
 const f=fixture();f.arm();let n=0;const rows=[],handler=function(){assert.equal(this,f.root);rows.push(f.send(request(++n)));};
 const add=f.root.addEventListener,remove=f.root.removeEventListener,dispatch=f.root.dispatchEvent;
 add('click',handler);f.fire(f.root);remove('click',handler);f.fire(f.root);
 add.call(null,'click',handler);f.fire(f.root);remove.call(null,'click',handler);f.fire(f.root);
 const nonInput=()=>rows.push(f.send(request(++n)));add('custom',nonInput);
 assert.equal(dispatch(new f.root.Event('custom')),true);remove('custom',nonInput);
 assert.deepEqual(rows,[true,true,false]);
});



test('native Window.onerror retains all five arguments and cannot borrow an outer input handler',()=>{
 const f=fixture();f.arm();const error=new Error('author failure'),expected=['author failure','widget.js',7,9,error],rows=[];
 f.root.onerror=function(){assert.equal(this,f.root);assert.deepEqual([...arguments],expected);rows.push(f.send(request(1)));return true;};
 f.node.onclick=()=>{assert.equal(f.nativeProperty(f.root,'onerror',...expected),true);rows.push(f.send(request(2)));};f.fire();assert.deepEqual(rows,[false,true]);
});
test('adopted Nodes keep author callbacks while former document wrappers cannot witness the new document input',()=>{
 const parent=fixture(),child=fixture();parent.arm();child.arm();let calls=0;const rows=[];
 parent.node.onclick=function(){calls++;assert.equal(this,parent.node);rows.push(parent.send(request()));};
 OWNERS.set(parent.node,child.document);child.fire(parent.node);assert.equal(calls,1);assert.deepEqual(rows,[false]);assert.equal(parent.sent.length,0);
});
test('unknown foreign-realm native property functions are not returned or rewrapped by inline discovery',()=>{
 const f=fixture();f.arm();const foreign=require('node:vm').runInNewContext('(function(){})');
 f.node._setInline('onclick',foreign);const descriptor=Object.getOwnPropertyDescriptor(f.Html.prototype,'onclick');
 assert.throws(()=>descriptor.get.call(f.node),error=>error.name==='SecurityError');
 f.fire();assert.throws(()=>descriptor.get.call(f.node),error=>error.name==='SecurityError');assert.equal(f.sent.length,0);
});

test('private Core focus routes keyboard into the selected actual frame with captured Window.focus',()=>{
 const f=fixture();f.arm(7,3);f.root.focus=()=>{throw Error('authored focus override');};
 const reply=f.hook({token:SECRET,kind:'focus',documentNonce:NONCE});
 assert.equal(reply?.armed,true);assert.equal(f.focusCalls(),1);
});
test('native sampled mouse dispatch receipts are independent from authored action callbacks',()=>{
 const f=fixture();assert.ok(f.hook({token:SECRET,kind:'arm',documentNonce:NONCE,gestureId:1,structuralVersion:2,reportDispatch:true}));
 f.fire(f.node,'mousedown');f.fire(f.node,'mouseup');
 assert.deepEqual(f.sent.map(v=>[v.type,v.kind,v.gestureId]),[['dext:v3-input-dispatched','down',1],['dext:v3-input-dispatched','up',1]]);
});

test('official trusted dispatch receipt uses the string transport consumed by Player',()=>{
 const f=fixture();f.root.top=f.root;
 assert.equal(require(target).installOfficial(f.root,SECRET),true);
 const hook=f.root.__dextNativeOfficialInputDispatchV1;
 assert.equal(hook({token:SECRET,kind:'arm',gestureId:7,structuralVersion:2,edge:'down'}).armed,true);
 f.fire(f.node,'mousedown');
 assert.equal(f.sent.length,1);assert.equal(typeof f.sent[0],'string');
 assert.deepEqual(JSON.parse(f.sent[0]),{type:'dext:v3-input-dispatched',protocolVersion:1,token:SECRET,documentNonce:NONCE,gestureId:7,structuralVersion:2,kind:'down'});
});

test('native sampled Enter/Space receipts precede authored key callbacks',()=>{
 for(const key of ['Enter',' ']){
  const f=fixture();assert.ok(f.hook({token:SECRET,kind:'arm',documentNonce:NONCE,gestureId:1,structuralVersion:2,reportDispatch:true}));
  f.fire(f.node,'keydown',{key});f.fire(f.node,'keyup',{key});
  assert.deepEqual(f.sent.map(v=>[v.type,v.kind]),[['dext:v3-input-dispatched','down'],['dext:v3-input-dispatched','up']]);
 }
});

test('official diagnostics observe unpaired touch without authorizing an action',()=>{
 const f=fixture();f.root.top=f.root;
 let stopped=0;f.root.Event.prototype.stopImmediatePropagation=function(){stopped++;};
 f.root.Event.prototype.preventDefault=function(){};
 Object.defineProperty(f.root.Event.prototype,'pointerType',{get(){return 'touch';}});
 assert.equal(require(target).installOfficial(f.root,SECRET,true),true);
 const hook=f.root.__dextNativeOfficialInputDispatchV1;
 f.fire(f.node,'pointerdown',{pointerType:'touch'});
 f.fire(f.node,'pointerup',{pointerType:'touch'});
 assert.deepEqual(hook({token:SECRET,kind:'diagnostics'}),{touchDown:1,touchUp:1,touchBlocked:2});
 assert.equal(stopped,2);
 assert.equal(f.sent.length,0);
});

test('unarmed mouse pointerdown blocks author handlers without suppressing compatibility mouse; touch still cancels',()=>{
 const f=fixture(true);let calls=0;
 f.node.addEventListener('pointerdown',()=>calls++);
 const mouse=f.fire(f.node,'pointerdown',{pointerType:'mouse'});
 assert.equal(calls,0);assert.equal(f.events.get(mouse).stopped,true);assert.notEqual(f.events.get(mouse).prevented,true);
 const touch=f.fire(f.node,'pointerdown',{pointerType:'touch'});
 assert.equal(calls,0);assert.equal(f.events.get(touch).prevented,true);
 const compatibility=f.fire(f.node,'mousedown');assert.equal(f.events.get(compatibility).prevented,true);
});
