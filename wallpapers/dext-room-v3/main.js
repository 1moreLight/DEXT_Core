(() => {
  'use strict';
  const transport=globalThis.chrome?.webview,container=document.getElementById('runtime');
  if(!transport||!container)return;
  let context=null,snapshot=null,host=null,tasks=null,retired=0,disposed=false,paused=false,lastError=null,candidate=0;
  const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  const text=v=>typeof v==='string'&&v.length>0&&v.length<=128&&!/[\u0000-\u001f]/.test(v);
  const positive=v=>Number.isSafeInteger(v)&&v>0;
  const copy=v=>JSON.parse(JSON.stringify(v));
  const viewport=()=>({width:Math.max(64,Math.min(16384,innerWidth)),height:Math.max(context?.viewKind==="dock"?48:64,Math.min(16384,innerHeight)),dpr:devicePixelRatio});
  const sendControl=v=>transport.postMessage(JSON.stringify(v));
  function validContext(value){
    return object(value)&&value.type==='dext:v3-runtime'&&value.protocolVersion===1&&positive(value.runtimeGeneration)&&text(value.sessionId)&&text(value.roomId)&&text(value.installationStamp)&&
      (value.viewKind===undefined||value.viewKind==='desktop'||value.viewKind==='dock')&&object(value.manifest)&&value.manifest.version===3&&value.manifest.apiVersion===1&&value.manifest.id===value.roomId&&Array.isArray(value.manifest.desks)&&value.manifest.desks.length>0&&value.manifest.desks.length<=64&&
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
  function disposeHost(){tasks?.dispose();tasks=null;host?.dispose();host=null;snapshot=null;}
  function mount(){
    if(host||!context||!snapshot)return;
    let native;
    try{
      native=DextNativeHost.createNativeHost({transport,initialIdentity:{runtimeGeneration:context.runtimeGeneration,sessionId:snapshot.sessionId,revision:snapshot.revision},initialSuspended:paused,
        onInput:value=>host?.handleNativeInput(value),onPermissionChanged:consumer=>host?.refreshPermissions(consumer)});
      host=DextDomHost.createDomHost({context,initialSnapshot:snapshot,document,container,native,getViewport:viewport,sendControl,initialPlaybackSuspended:paused,
        applyFrameState:(frame,value)=>sendControl({type:'dext:v3-frame-policy',protocolVersion:1,runtimeGeneration:value.identity.runtimeGeneration,
          sessionId:value.identity.sessionId,revision:value.identity.revision,frameName:frame.name,consumer:value.consumerId,instanceId:value.instanceId,active:value.state==='active'})});
      if(context.viewKind==='dock')tasks=DextTaskAreaController.createTaskAreaController({
        createArea:()=>DextTaskAreaHost.createTaskAreaHost({document,container}),
        getState:()=>({context,snapshot,dom:host,viewport:viewport(),visible:!paused}),
        onError:()=>{lastError={code:'taskAreaUnavailable'};}
      });
      host.ready.then(ready=>{tasks?.refresh();announceDockReady(ready);},()=>{lastError={code:'renderUnavailable'};});
    }catch(_){native?.dispose();lastError={code:'renderUnavailable'};}
  }
  function runtimeMessage(value){
    if(disposed||!object(value))return;
    if(value.type==='dext:v3-runtime'){
      if(!validContext(value)||value.runtimeGeneration<=retired||context&&value.runtimeGeneration<=context.runtimeGeneration)return;
      if(context)retired=Math.max(retired,context.runtimeGeneration);disposeHost();context=copy(value);if(context.viewKind==="dock")paused=false;
      document.documentElement.classList.toggle("dext-v3-native-dock",context.viewKind==="dock");
      if(context.viewKind==="dock")ensureDockKeyboard();else document.getElementById("dext-dock-keyboard")?.remove();return;
    }
    if(value.type==='dext:v3-runtime-revoked'){
      if(!context||value.runtimeGeneration!==context.runtimeGeneration||value.sessionId!==context.sessionId)return;
      retired=Math.max(retired,context.runtimeGeneration);disposeHost();context=null;return;
    }
    if(value.type==='dext:v3-session'){
      if(!validSnapshot(value))return;snapshot=copy(value);if(!snapshot.active){retired=Math.max(retired,context.runtimeGeneration);disposeHost();context=null;return;}
      tasks?.suspend();if(host)host.acceptSnapshot(snapshot).then(ready=>{tasks?.refresh();announceDockReady(ready);},()=>{lastError={code:'renderUnavailable'};});else mount();
    }
  }
  const playback=DextPlaybackHost.createPlaybackHost({matchesRuntime:generation=>generation===context?.runtimeGeneration||generation===candidate,
    setSuspended:value=>{paused=value;tasks?.suspend();host?.setPlaybackSuspended(value);if(!value)tasks?.refresh();},onRuntimeMessage:runtimeMessage});
  // The Player invokes this function only on the fixed official document.
  // A cached new context can legitimately replace the current generation.
  globalThis.dextNativePlaybackChanged=value=>{
    if(disposed||!object(value)||!positive(value.runtimeGeneration))return false;
    const next=Array.isArray(value.messages)&&value.messages.find(message=>message?.type==='dext:v3-runtime');
    const allowed=value.runtimeGeneration===context?.runtimeGeneration||!context&&value.runtimeGeneration>retired||
      next&&validContext(next)&&next.runtimeGeneration===value.runtimeGeneration&&next.runtimeGeneration>Math.max(retired,context?.runtimeGeneration||0);
    if(!allowed)return false;candidate=value.runtimeGeneration;try{return playback.handle(value);}finally{candidate=0;}
  };
  function announceDockReady(ready){if(ready&&context?.viewKind==='dock'&&host&&snapshot)sendControl({type:'dext:v3-dock-ready',runtimeGeneration:context.runtimeGeneration,sessionId:snapshot.sessionId,revision:snapshot.revision});}
  function ensureDockKeyboard(){
    if(document.getElementById('dext-dock-keyboard'))return;
    const button=document.createElement('button');button.id='dext-dock-keyboard';button.type='button';button.textContent='⌨';
    button.title='启用 Dock 键盘操作；Esc 返回原窗口';button.setAttribute('aria-label',button.title);
    button.addEventListener('click',event=>{if(event.isTrusted&&context&&snapshot)sendControl({type:'dext:v3-dock-keyboard',
      runtimeGeneration:context.runtimeGeneration,sessionId:snapshot.sessionId,revision:snapshot.revision});});
    document.body.append(button);
  }
  // Private native calls on the fixed official top document; neither call is
  // included in the author SDK or forwarded from an author frame.
  globalThis.dextNativeDockVisibility=value=>{
    if(disposed||context?.viewKind!=='dock'||!object(value)||!scopeForInput(value)||typeof value.visible!=='boolean')return false;
    paused=!value.visible;tasks?.suspend();host?.setPlaybackSuspended(paused);tasks?.refresh();return true;
  };
  globalThis.dextNativeTaskSnapshot=value=>{
    if(disposed||context?.viewKind!=='dock'||!object(value)||!scopeForInput(value)||!tasks)return false;
    return tasks.accept(value.snapshot,value.actionsEnabled===true);
  };
  globalThis.dextNativeDockRefresh=()=>context?.viewKind==='dock'&&host?host.refreshGeometry():Promise.resolve(false);
  const receive=event=>runtimeMessage(event.data);
  transport.addEventListener('message',receive);
  const resize=()=>{tasks?.suspend();host?.resize().then(()=>tasks?.refresh()).catch(()=>{lastError={code:'viewportUnavailable'};});};
  addEventListener('resize',resize);
  function dispose(){if(disposed)return;disposed=true;playback.dispose();disposeHost();context=null;transport.removeEventListener('message',receive);removeEventListener('resize',resize);}
  addEventListener('pagehide',dispose,{once:true});
  // Called by the owning native Player on this fixed official document only.
  globalThis.dextNativeInputSample=value=>{
    if(disposed||!host||!object(value)||typeof value.sampleId!=='string')return null;
    if(value.operation==='end')return host.endNativeInputSample(value.sampleId);
    if(value.operation!=='begin'||!scopeForInput(value)||!positive(value.geometryVersion))return null;
    const sample=host.beginNativeInputSample({runtimeGeneration:value.runtimeGeneration,sessionId:value.sessionId,revision:value.revision},value.geometryVersion,value.sampleId);
    if(sample&&context.viewKind==='dock')sample.taskHit=tasks?.samplePointer(value.taskPoint)||null;
    return sample;
  };
  function scopeForInput(value){return context&&snapshot&&value.runtimeGeneration===context.runtimeGeneration&&value.sessionId===snapshot.sessionId&&value.revision===snapshot.revision;}
  globalThis.dextRuntimeDiagnostics=()=>({disposed,paused,runtimeGeneration:context?.runtimeGeneration||retired,sessionId:context?.sessionId||null,revision:snapshot?.revision||0,lastError:lastError&&{...lastError},runtime:host?.readDiagnostics()||null,taskArea:tasks?.read()||null});
  sendControl({type:'dext:v3-page-ready'});
})();
