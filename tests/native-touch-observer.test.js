const test=require('node:test'),assert=require('node:assert/strict');
const {observeOfficialTouch}=require('../lively-core-separation/src/Lively/Lively.Common/Helpers/native-input-guardian.js');
function setup(){
 const listeners=new Map(),data=new WeakMap(),sent=[];
 class Event {constructor(type,fields={}){data.set(this,{type,trusted:true,pointerType:'touch',pointerId:1,isPrimary:true,clientX:20,clientY:30,...fields});Object.defineProperty(this,'isTrusted',{get(){return data.get(this).trusted;}});}}
 for(const key of ['type','pointerType','pointerId','isPrimary','clientX','clientY'])Object.defineProperty(Event.prototype,key,{get(){return data.get(this)[key];}});
 class Target{addEventListener(type,fn){const list=listeners.get(type)||[];list.push(fn);listeners.set(type,list);}}
 const root=new Target();Object.assign(root,{Event,PointerEvent:Event,MouseEvent:Event,EventTarget:Target,innerWidth:200,innerHeight:100});
 const controls=observeOfficialTouch(root,value=>sent.push(value));
 const fire=(type,fields)=>{const e=new Event(type,fields);for(const fn of listeners.get(type)||[])fn(e);return e;};
 return{controls,fire,sent,root};
}
test('touch needs private enable; trusted primary down/up emits one ordered pair',()=>{
 const f=setup();f.fire('pointerdown');f.fire('pointerup');assert.equal(f.sent.length,0);
 f.controls.enable();f.fire('pointerdown');f.fire('pointerup');
 assert.deepEqual(f.sent.map(v=>[v.kind,v.pointerId,v.sequence]),[['down',1,1],['up',1,2]]);
 assert.equal(f.sent[0].x,20);assert.equal(f.sent[0].width,200);
});
test('synthetic touch and mouse do not enter touch stream',()=>{
 const f=setup();f.controls.enable();f.fire('pointerdown',{trusted:false});f.fire('pointerdown',{pointerType:'mouse'});assert.equal(f.sent.length,0);
});
test('small contact jitter remains a tap; drag cancels and cannot revive',()=>{
 const f=setup();f.controls.enable();f.fire('pointerdown');f.fire('pointermove',{clientX:23});f.fire('pointerup',{clientX:23});assert.deepEqual(f.sent.map(v=>v.kind),['down','up']);
 f.fire('pointerdown');f.fire('pointermove',{clientX:40});f.fire('pointermove');f.fire('pointerup');assert.deepEqual(f.sent.map(v=>v.kind),['down','up','down','cancel']);
});
test('second contact cancels and requires all contacts released before next tap',()=>{
 const f=setup();f.controls.enable();f.fire('pointerdown');f.fire('pointerdown',{pointerId:2,isPrimary:false});f.fire('pointerup');f.fire('pointerup',{pointerId:2,isPrimary:false});
 assert.deepEqual(f.sent.map(v=>v.kind),['down','cancel']);f.fire('pointerdown');f.fire('pointerup');assert.deepEqual(f.sent.map(v=>v.kind),['down','cancel','down','up']);
});
test('cancel, page exit and private disable never produce an up action',()=>{
 for(const end of ['pointercancel','pagehide','disable']){const f=setup();f.controls.enable();f.fire('pointerdown');if(end==='disable')f.controls.disable();else f.fire(end);f.fire('pointerup');assert.deepEqual(f.sent.map(v=>v.kind),['down','cancel']);}
});
test('release outside or changed viewport cancels',()=>{
 const f=setup();f.controls.enable();f.fire('pointerdown');f.fire('pointerup',{clientX:300});assert.deepEqual(f.sent.map(v=>v.kind),['down','cancel']);
});

test('viewport changes cancel the contact',()=>{const f=setup();f.controls.enable();f.fire('pointerdown');f.root.innerWidth=400;f.fire('pointerup');assert.deepEqual(f.sent.map(v=>v.kind),['down','cancel']);});
