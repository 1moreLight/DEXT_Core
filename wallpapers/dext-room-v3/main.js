(() => {
  'use strict';
  const transport=globalThis.chrome?.webview,container=document.getElementById('runtime');
  if(!transport||!container)return;
  let context=null,snapshot=null,host=null,retired=0,disposed=false,paused=false,lastError=null,candidate=0;
  const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  const text=v=>typeof v==='string'&&v.length>0&&v.length<=128&&!/[\u0000-\u001f]/.test(v);
  const positive=v=>Number.isSafeInteger(v)&&v>0;
  const copy=v=>JSON.parse(JSON.stringify(v));
  const viewport=()=>({width:Math.max(64,Math.min(16384,innerWidth)),height:Math.max(64,Math.min(16384,innerHeight)),dpr:devicePixelRatio});
  const sendControl=v=>transport.postMessage(JSON.stringify(v));
  function validContext(value){
    return object(value)&&value.type==='dext:v3-runtime'&&value.protocolVersion===1&&positive(value.runtimeGeneration)&&text(value.sessionId)&&text(value.roomId)&&text(value.installationStamp)&&
      object(value.manifest)&&value.manifest.version===3&&value.manifest.apiVersion===1&&value.manifest.id===value.roomId&&Array.isArray(value.manifest.desks)&&value.manifest.desks.length>0&&value.manifest.desks.length<=64&&
      value.manifest.desks.every(d=>object(d)&&text(d.id))&&Array.isArray(value.resources)&&value.resources.length<=4096&&Array.isArray(value.manifest.resources)&&value.resources.length===value.manifest.resources.length&&
      new Set(value.resources.map(r=>r.path)).size===value.resources.length&&value.resources.every(r=>object(r)&&typeof r.path==='string'&&value.manifest.resources.includes(r.path))&&
      value.resourceBasePath==='/content/'+value.runtimeGeneration+'/';
  }
  function validSnapshot(value){
    const life=value?.lifecycle;return context&&object(value)&&value.type==='dext:v3-session'&&value.protocolVersion===1&&value.runtimeGeneration===context.runtimeGeneration&&
      value.sessionId===context.sessionId&&value.roomId===context.roomId&&value.installationStamp===context.installationStamp&&positive(value.revision)&&(!snapshot||value.revision>snapshot.revision)&&
      Array.isArray(value.deskIds)&&JSON.stringify(value.deskIds)===JSON.stringify(context.manifest.desks.map(d=>d.id))&&value.deskIds.includes(value.currentDeskId)&&
      [value.targetDeskId,value.queuedDeskId].every(id=>id===null||value.deskIds.includes(id))&&
      (value.targetDeskId===null?value.transitionId===null&&value.deadlineUtc===null:text(value.transitionId)&&typeof value.deadlineUtc==='string'&&Number.isFinite(Date.parse(value.deadlineUtc)))&&typeof value.active==='boolean'&&typeof value.operable==='boolean'&&object(life)&&
      ['starting','desktop','idle'].includes(life.stage)&&typeof life.playbackPaused==='boolean'&&typeof life.locked==='boolean'&&Number.isSafeInteger(life.revision)&&life.revision>=0&&(!snapshot||life.revision>=snapshot.lifecycle.revision);
  }
  function disposeHost(){host?.dispose();host=null;snapshot=null;}
  function mount(){
    if(host||!context||!snapshot)return;
    let native;
    try{
      native=DextNativeHost.createNativeHost({transport,initialIdentity:{runtimeGeneration:context.runtimeGeneration,sessionId:snapshot.sessionId,revision:snapshot.revision},initialSuspended:paused,
        onInput:value=>host?.handleNativeInput(value),onPermissionChanged:consumer=>host?.refreshPermissions(consumer)});
      host=DextDomHost.createDomHost({context,initialSnapshot:snapshot,document,container,native,getViewport:viewport,sendControl,initialPlaybackSuspended:paused});
      host.ready.catch(()=>{lastError={code:'renderUnavailable'};});
    }catch(_){native?.dispose();lastError={code:'renderUnavailable'};}
  }
  function runtimeMessage(value){
    if(disposed||!object(value))return;
    if(value.type==='dext:v3-runtime'){
      if(!validContext(value)||value.runtimeGeneration<=retired||context&&value.runtimeGeneration<=context.runtimeGeneration)return;
      if(context)retired=Math.max(retired,context.runtimeGeneration);disposeHost();context=copy(value);return;
    }
    if(value.type==='dext:v3-runtime-revoked'){
      if(!context||value.runtimeGeneration!==context.runtimeGeneration||value.sessionId!==context.sessionId)return;
      retired=Math.max(retired,context.runtimeGeneration);disposeHost();context=null;return;
    }
    if(value.type==='dext:v3-session'){
      if(!validSnapshot(value))return;snapshot=copy(value);if(!snapshot.active){retired=Math.max(retired,context.runtimeGeneration);disposeHost();context=null;return;}
      if(host)host.acceptSnapshot(snapshot).catch(()=>{lastError={code:'renderUnavailable'};});else mount();
    }
  }
  const playback=DextPlaybackHost.createPlaybackHost({matchesRuntime:generation=>generation===context?.runtimeGeneration||generation===candidate,
    setSuspended:value=>{paused=value;host?.setPlaybackSuspended(value);},onRuntimeMessage:runtimeMessage});
  // The Player invokes this function only on the fixed official document.
  // A cached new context can legitimately replace the current generation.
  globalThis.dextNativePlaybackChanged=value=>{
    if(disposed||!object(value)||!positive(value.runtimeGeneration))return false;
    const next=Array.isArray(value.messages)&&value.messages.find(message=>message?.type==='dext:v3-runtime');
    const allowed=value.runtimeGeneration===context?.runtimeGeneration||!context&&value.runtimeGeneration>retired||
      next&&validContext(next)&&next.runtimeGeneration===value.runtimeGeneration&&next.runtimeGeneration>Math.max(retired,context?.runtimeGeneration||0);
    if(!allowed)return false;candidate=value.runtimeGeneration;try{return playback.handle(value);}finally{candidate=0;}
  };
  const receive=event=>runtimeMessage(event.data);
  transport.addEventListener('message',receive);
  const resize=()=>{host?.resize().catch(()=>{lastError={code:'viewportUnavailable'};});};
  addEventListener('resize',resize);
  function dispose(){if(disposed)return;disposed=true;playback.dispose();disposeHost();context=null;transport.removeEventListener('message',receive);removeEventListener('resize',resize);}
  addEventListener('pagehide',dispose,{once:true});
  globalThis.dextRuntimeDiagnostics=()=>({disposed,paused,runtimeGeneration:context?.runtimeGeneration||retired,sessionId:context?.sessionId||null,revision:snapshot?.revision||0,lastError:lastError&&{...lastError},runtime:host?.readDiagnostics()||null});
  sendControl({type:'dext:v3-page-ready'});
})();
