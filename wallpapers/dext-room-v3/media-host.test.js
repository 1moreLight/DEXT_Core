"use strict";
const test = require('node:test');
const assert = require('node:assert/strict');
const { createMediaHost } = require('./media-host.js');
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture() {
  let time=0, next=0;
  const timers=new Map(), completed=[], frames=[], disposed=[], htmlStates=[];
  const element=type => ({ type, style:{}, listeners:new Map(), currentTime:0, ended:false, playCount:0, pauseCount:0, removed:false,
    addEventListener(name, callback){this.listeners.set(name,callback);}, removeEventListener(name){this.listeners.delete(name);},
    fire(name){this.listeners.get(name)?.();}, play(){this.playCount++;return Promise.resolve();}, pause(){this.pauseCount++;}, remove(){this.removed=true;} });
  const snapshot={sessionId:'session',revision:1,active:true,lifecycle:{stage:'starting',playbackPaused:false,locked:false,revision:1}};
  const root={children:[],append(value){this.children.push(value);}};
  const host=createMediaHost({document:{createElement:element}, resolveResource:path=>{if(!path.startsWith('safe/'))throw new Error('C:/private');return '/content/1/'+path;},
    getSnapshot:()=>snapshot, now:()=>time, setTimeout:(callback,delay)=>{timers.set(++next,{callback,at:time+delay});return next;}, clearTimeout:id=>timers.delete(id),
    mountHTML:(definition,parent)=>{const frame=element('iframe');frames.push(frame);parent.append(frame);return frame;},
    setHTMLState:(id,state)=>htmlStates.push([id,state]), disposeHTML:id=>disposed.push(id),
    onStartupComplete:value=>{completed.push(value);return {status:'accepted'};}
  });
  const mount=(type='image',consumerId='slot.start',state='active')=>host.mount({instanceId:consumerId,consumerId,state,content:{type,src:'safe/'+type},config:{}},root);
  const advance=milliseconds=>{const target=time+milliseconds;for(let guard=0;guard<1000;guard++){
    const due=[...timers].sort((a,b)=>a[1].at-b[1].at).find(([,timer])=>timer.at<=target);if(!due){time=target;return;}
    time=due[1].at;timers.delete(due[0]);due[1].callback();}throw new Error('timer loop');};
  return {host,mount,advance,snapshot,completed,root,frames,disposed,htmlStates,timers};
}
for (const type of ['image','gif']) test(type+' start waits500ms and only requests Core completion',async()=>{
  const f=fixture(),node=f.mount(type);f.advance(499);assert.equal(f.completed.length,0);f.advance(1);await tick();
  assert.equal(f.completed.length,1);assert.equal(f.snapshot.lifecycle.stage,'starting');assert.equal(f.completed[0].lifecycleRevision,1);
  assert.equal(node.src,'/content/1/safe/'+type);f.advance(60000);assert.equal(f.completed.length,1);f.host.dispose();
});
test('video start runs past60s when progress continues and completes on ended',async()=>{
  const f=fixture(),video=f.mount('video');assert.equal(video.muted,true);assert.equal(video.loop,false);
  for(let i=1;i<=8;i++){f.advance(20000);video.currentTime=i*20;video.fire('timeupdate');}
  assert.equal(f.completed.length,0);video.ended=true;video.fire('ended');await tick();assert.equal(f.completed[0].reason,'videoEnded');f.host.dispose();
});
test('video load and playback stalls have separate30s progress budgets',async()=>{
  const f=fixture(),video=f.mount('video');f.advance(29000);video.fire('loadeddata');f.advance(29000);assert.equal(f.completed.length,0);
  video.currentTime=1;video.fire('timeupdate');f.advance(29999);assert.equal(f.completed.length,0);f.advance(1);await tick();assert.equal(f.completed[0].reason,'videoStalled');f.host.dispose();
  const g=fixture();g.mount('video');g.advance(30000);await tick();assert.equal(g.completed[0].reason,'videoUnavailable');g.host.dispose();
});
test('pause and lock preserve remaining image/HTML/video startup budgets',async()=>{
  for(const [type,budget] of [['image',500],['html',60000],['video',30000]]){
    const f=fixture();f.mount(type);f.advance(budget/2);f.snapshot.lifecycle.playbackPaused=true;f.host.refresh();f.advance(budget*10);assert.equal(f.completed.length,0);
    f.snapshot.lifecycle.playbackPaused=false;f.snapshot.lifecycle.locked=true;f.host.refresh();f.advance(budget*10);assert.equal(f.completed.length,0);
    f.snapshot.lifecycle.locked=false;f.snapshot.revision=4;f.snapshot.lifecycle.revision=4;f.host.refresh();f.advance(budget/2-1);assert.equal(f.completed.length,0);
    f.advance(1);await tick();assert.equal(f.completed.length,1);assert.equal(f.completed[0].revision,4);assert.equal(f.completed[0].lifecycleRevision,4);f.host.dispose();
  }
});
test('HTML done and60s fallback complete start once, never idle',async()=>{
  const f=fixture();f.mount('html');assert.equal(f.host.completeHTML('slot.start'),true);await tick();f.advance(60000);assert.equal(f.completed.length,1);assert.equal(f.completed[0].reason,'htmlDone');f.host.dispose();
  const g=fixture();g.mount('html');g.advance(60000);await tick();assert.equal(g.completed[0].reason,'htmlTimeout');g.host.dispose();
  const h=fixture();h.snapshot.lifecycle.stage='idle';h.mount('html','slot.idle');assert.equal(h.host.completeHTML('slot.idle'),false);h.advance(3600000);assert.equal(h.completed.length,0);h.host.dispose();
});
test('background and idle media retain one muted looping node with no startup timeout',async()=>{
  for(const consumer of ['slot.background.home','slot.idle']){
    const f=fixture();f.snapshot.lifecycle.stage=consumer==='slot.idle'?'idle':'desktop';const node=f.mount('video',consumer);
    assert.equal(node.loop,true);assert.equal(node.muted,true);assert.equal(f.mount('video',consumer),node);assert.equal(f.root.children.length,1);
    f.host.setState(consumer,'suspended');assert.ok(node.pauseCount>0);f.advance(3600000);assert.equal(f.completed.length,0);
    f.host.setState(consumer,'active');await tick();assert.equal(node.removed,false);f.host.dispose();assert.equal(node.removed,true);
  }
});
test('HTML nodes are delegated once, suspended in place and disposed once',()=>{
  const f=fixture(),node=f.mount('html');assert.equal(f.mount('html'),node);f.host.setState('slot.start','suspended');assert.equal(f.frames.length,1);
  assert.deepEqual(f.htmlStates.at(-1),['slot.start','suspended']);f.host.setState('slot.start','active');assert.equal(f.frames.length,1);
  f.host.disposeInstance('slot.start');f.host.dispose();assert.deepEqual(f.disposed,['slot.start']);assert.equal(f.host.completeHTML('slot.start'),false);
});
test('revoked/stale phase and disposed nodes cannot finish a current start',async()=>{
  const f=fixture(),video=f.mount('video');f.snapshot.active=false;video.fire('ended');f.advance(30000);assert.equal(f.completed.length,0);
  f.snapshot.active=true;f.snapshot.lifecycle.stage='idle';f.host.refresh();video.fire('ended');assert.equal(f.completed.length,0);f.host.dispose();
  const g=fixture(),old=g.mount('video');g.host.disposeInstance('slot.start');old.fire('ended');g.advance(60000);await tick();assert.equal(g.completed.length,0);assert.equal(old.listeners.size,0);
});
test('unverified paths fail before any node is mounted and no diagnostics expose the path',()=>{
  const f=fixture();assert.throws(()=>f.host.mount({instanceId:'bad',consumerId:'slot.start',state:'active',content:{type:'image',src:'C:/private'}},f.root),{code:'resourceUnavailable'});
  assert.equal(f.root.children.length,0);assert.equal(JSON.stringify(f.host.readDiagnostics()).includes('private'),false);f.host.dispose();
});
test('startup completion retries failed Core request without consuming the phase twice',async()=>{
  let time=0,callback, attempts=0;const snapshot={sessionId:'s',revision:1,active:true,lifecycle:{stage:'starting',revision:1,playbackPaused:false,locked:false}};
  const host=createMediaHost({document:{createElement:()=>({style:{},addEventListener(){},removeEventListener(){},remove(){}})},resolveResource:()=>'/safe',getSnapshot:()=>snapshot,
    now:()=>time,setTimeout:(run)=>{callback=run;return 1;},clearTimeout:()=>{callback=null;},onStartupComplete:()=>({status:++attempts===1?'storageUnavailable':'accepted'})});
  host.mount({instanceId:'start',consumerId:'slot.start',state:'active',content:{type:'image',src:'image'}},{append(){}});
  time=500;callback();await tick();assert.equal(attempts,1);assert.equal(host.readDiagnostics().instances[0].startupComplete,false);
  time=1500;callback();await tick();assert.equal(attempts,2);assert.equal(host.readDiagnostics().instances[0].startupComplete,true);host.dispose();
});

test('late play promises do not pause a newer active playback intent',async()=>{
  const f=fixture(),video=f.mount('video');await tick();const release=[];
  video.play=()=>new Promise(resolve=>release.push(resolve));
  f.host.setState('slot.start','suspended');f.host.setState('slot.start','active');
  f.host.setState('slot.start','suspended');f.host.setState('slot.start','active');const pauses=video.pauseCount;
  release[0]();await tick();assert.equal(video.pauseCount,pauses);release[1]();await tick();assert.equal(video.pauseCount,pauses);f.host.dispose();
});
