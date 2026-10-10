/* Isolated preview adapter around the production DOM/Frame/Layout/Media hosts. */
(() => {
  'use strict';
  let owner=null, host=null, room=null, snapshot=null, geometry=[], settings={}, overlay=null, transitionTimer=null;
  const providers=new Set(), watches=new Map(), storage=new Map(), events=[];
  const copy=value=>JSON.parse(JSON.stringify(value));
  const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('');
  const post=(type,value)=>{if(owner)parent.postMessage({type,token:owner,...value},'*');};
  const issue=(code,detail)=>{events.push({code,detail,time:new Date().toISOString()});if(events.length>30)events.shift();};
  const consumers=()=>[
    {id:'official',capabilities:['desk.read','desk.navigate','binding.launch','dext.exit'],buttonIds:(room.buttons||[]).map(b=>b.id)},
    ...(room.roomScene?[{id:'scene',...room.roomScene,buttonIds:(room.buttons||[]).map(b=>b.id)}]:[]),
    ...['start','idle'].filter(id=>room[id]).map(id=>({id:'slot.'+id,...room[id]})),
    ...room.desks.filter(d=>d.background).map(d=>({id:'slot.background.'+d.id,...d.background})),
    ...(room.components||[]).map(c=>({...c,id:'component.'+c.id}))
  ];
  function capabilities(id) {
    const consumer=consumers().find(c=>c.id===id);
    return {status:consumer?'accepted':'unknownConsumer',capabilities:Object.fromEntries((consumer?.capabilities||[]).map(cap=>[cap,
      settings.data[cap]==='denied'?'denied':['media.control','audio.control','binding.launch','dext.exit'].includes(cap)?'denied':'accepted']))};
  }
  function source(capability) {
    const status=settings.data[capability]||'available';
    if(status!=='available')return {status};
    if(Object.hasOwn(settings.samples||{},capability))return{status:'available',value:copy(settings.samples[capability])};
    const now=Date.now(),iso=new Date(now).toISOString();
    const defaults=globalThis.DextWorkbenchSamples;
    const values={
      ...defaults,
      'time.read':{...defaults['time.read'],unixMilliseconds:now,utc:iso},
      'hardware.read':{...defaults['hardware.read'],cpuPercent:settings.cpuPercent,gpuPercent:settings.gpuPercent},
      'audio.read':{...defaults['audio.read'],level:settings.audioLevel}
    };
    return Object.hasOwn(values,capability)?{status:'available',value:values[capability]}:{status:'unsupported'};
  }
  const emit=()=>{for(const p of providers){const state=source(p.capability);p.emit(state);}};
  function commit(target) {
    if(!snapshot?.targetDeskId||target!==snapshot.targetDeskId)return;
    clearTimeout(transitionTimer);transitionTimer=null;
    snapshot={...snapshot,revision:snapshot.revision+1,currentDeskId:target,targetDeskId:null,transitionId:null,deadlineUtc:null};
    void host.acceptSnapshot(snapshot);
    if(snapshot.queuedDeskId){const queued=snapshot.queuedDeskId;snapshot.queuedDeskId=null;void navigate(queued);}
  }
  function navigate(id) {
    if(!room.desks.some(d=>d.id===id)||snapshot.lifecycle.stage!=='desktop'||snapshot.lifecycle.playbackPaused)return false;
    if(snapshot.targetDeskId){snapshot={...snapshot,revision:snapshot.revision+1,queuedDeskId:id};void host.acceptSnapshot(snapshot);return true;}
    if(snapshot.currentDeskId===id)return true;
    snapshot={...snapshot,revision:snapshot.revision+1,targetDeskId:id,queuedDeskId:null,transitionId:token(),
      deadlineUtc:new Date(Date.now()+Math.max(1000,(room.transition?.durationMs||0)+1000)).toISOString()};
    void host.acceptSnapshot(snapshot);
    transitionTimer=setTimeout(()=>commit(id),Math.max(1000,(room.transition?.durationMs||0)+1000));
    return true;
  }
  function simulateAction(action) {
    if(!action)return false;
    let id=action.deskId,index=room.desks.findIndex(d=>d.id===snapshot.currentDeskId);
    if(action.type==='desk.next')id=room.desks[(index+1)%room.desks.length].id;
    if(action.type==='desk.previous')id=room.desks[(index+room.desks.length-1)%room.desks.length].id;
    if(!['desk.next','desk.previous','desk.go'].includes(action.type))return false;
    setTimeout(()=>navigate(id),0);return true;
  }
  const native={
    acceptIdentity(){},setSuspended(){},dispose(){providers.clear();watches.clear();},
    readCapabilities:q=>Promise.resolve(capabilities(q.consumerId)),
    watchCapabilities(consumer,callback){const callbacks=watches.get(consumer)||new Set();callbacks.add(callback);watches.set(consumer,callbacks);return()=>callbacks.delete(callback);},
    subscribeData(q,emitValue){const provider={...q,emit:emitValue};providers.add(provider);emitValue(source(q.capability));return()=>providers.delete(provider);},
    async request(operation,params){
      if(operation==='invalidateGeometry'){geometry=[];return{status:'accepted'};}
      if(operation==='geometry'){geometry=copy(params.buttons);return{status:'accepted'};}
      if(operation==='layoutRead')return{status:'accepted',layout:{revision:0,icons:{},components:{}}};
      if(operation==='presentationRead')return{status:'accepted',presentation:{revision:0,skins:{},locator:null}};
      if(operation==='buttons')return{status:'accepted',buttons:(room.buttons||[]).filter(b=>consumers().find(c=>c.id===params.consumer)?.buttonIds?.includes(b.id)).map(b=>({id:b.id,name:b.name,scope:b.scope,action:b.action?.type||null,isBound:false}))};
      if(operation==='startupComplete'){
        if(snapshot.lifecycle.stage==='starting'){snapshot={...snapshot,revision:snapshot.revision+1,lifecycle:{...snapshot.lifecycle,stage:'desktop',revision:snapshot.lifecycle.revision+1}};void host.acceptSnapshot(snapshot);}
        return{status:'accepted'};
      }
      if(operation==='storageGet')return{status:'accepted',value:copy(storage.get(params.consumer+'\0'+params.key)??null)};
      if(operation==='storageSet'){storage.set(params.consumer+'\0'+params.key,copy(params.value));return{status:'accepted'};}
      if(operation==='activate'){const button=room.buttons?.find(b=>b.id===params.button);return{status:simulateAction(button?.action)?'accepted':'notOperable'};}
      if(operation==='authorInput'){
        let request;try{request=JSON.parse(params.requestJson);}catch{return{status:'invalidArgument'};}
        const button=room.buttons?.find(b=>b.id===(request.params?.buttonId||request.params?.button));
        const action=request.method==='desk.navigate'?request.params?.action:request.method==='actions.activate'?button?.action:null;
        const allowed=simulateAction(action);if(!allowed)issue('previewActionDisabled',request.method);
        return{status:allowed?'accepted':'notOperable'};
      }
      issue('unsupported',operation);return{status:'unsupported'};
    }
  };
  function paint(diagnostics) {
    overlay?.remove();overlay=null;
    if(!settings.showButtons&&!settings.showOccupied&&!settings.showComponents)return;
    const width=innerWidth,height=innerHeight,ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
    svg.setAttribute('viewBox','0 0 '+width+' '+height);
    Object.assign(svg.style,{position:'absolute',inset:'0',width:'100%',height:'100%',pointerEvents:'none',zIndex:'1000'});
    const polygon=(points,color,label)=>{
      const node=document.createElementNS(ns,'polygon');node.setAttribute('points',points.map(p=>p.x*width+','+p.y*height).join(' '));
      node.setAttribute('fill',color+'22');node.setAttribute('stroke',color);node.setAttribute('stroke-width','2');svg.append(node);
      const title=document.createElementNS(ns,'title');title.textContent=label;node.append(title);
    };
    const rect=(r,color,label)=>polygon([{x:r.x/1920,y:r.y/1080},{x:(r.x+r.width)/1920,y:r.y/1080},{x:(r.x+r.width)/1920,y:(r.y+r.height)/1080},{x:r.x/1920,y:(r.y+r.height)/1080}],color,label);
    if(settings.showButtons)for(const entry of geometry)if(!settings.buttonId||entry.button===settings.buttonId)for(const points of entry.polygons)polygon(points,'#22d3ee',entry.button);
    if(settings.showOccupied)for(const area of diagnostics.occupied||[])if(!area.deskId||area.deskId===(snapshot.targetDeskId||snapshot.currentDeskId))rect(area,'#fb7185',area.id||'occupied');
    if(settings.showComponents)for(const item of diagnostics.layout?.items||[])if(item.kind==='widget'&&item.placeable)rect(item.effectiveRect,'#a78bfa',item.id);
    if(settings.showComponents){const active=room.desks.find(d=>d.id===(snapshot.targetDeskId||snapshot.currentDeskId));for(const component of room.components||[])if(component.role==='dock'&&active.components.includes(component.id))rect(component.placement,'#a78bfa',component.id);}
    document.getElementById('runtime').append(svg);overlay=svg;
  }
  function report() {
    if(!host)return;
    const runtime=host.readDiagnostics();
    const sampled=host.readInputSample({runtimeGeneration:1,sessionId:snapshot.sessionId,revision:snapshot.revision},runtime.inputVersion);
    if(sampled)geometry=sampled.buttons;
    paint(runtime);
    post('dext:workbench:diagnostics',{diagnostics:{snapshot:copy(snapshot),runtime,buttons:copy(geometry),
      data:Object.fromEntries(['time.read','hardware.read','media.read','audio.read'].map(cap=>[cap,source(cap).status])),events:copy(events)}});
  }
  function controls(value) {
    settings={...settings,...value,data:{...settings.data,...value.data}};
    if(value.deskId)navigate(value.deskId);
    if(value.stage&&['starting','desktop','idle'].includes(value.stage)){
      clearTimeout(transitionTimer);transitionTimer=null;snapshot={...snapshot,revision:snapshot.revision+1,targetDeskId:null,queuedDeskId:null,transitionId:null,deadlineUtc:null,lifecycle:{...snapshot.lifecycle,stage:value.stage,revision:snapshot.lifecycle.revision+1}};void host.acceptSnapshot(snapshot);
    }
    if(typeof value.paused==='boolean'){
      if(snapshot.targetDeskId&&value.paused)commit(snapshot.targetDeskId);
      snapshot={...snapshot,revision:snapshot.revision+1,lifecycle:{...snapshot.lifecycle,playbackPaused:value.paused,revision:snapshot.lifecycle.revision+1}};
      host.setPlaybackSuspended(value.paused);void host.acceptSnapshot(snapshot);
    }
    if(value.data){for(const callbacks of watches.values())for(const callback of callbacks)callback();emit();}
    if(value.samples)emit();
    report();
  }
  addEventListener('message',async event=>{
    if(event.source!==parent||!event.data||typeof event.data.token!=='string')return;
    const value=event.data;
    if(value.type==='dext:workbench:init'&&!host){
      owner=value.token;room=copy(value.room);settings={data:{},samples:{},cpuPercent:32,gpuPercent:19,audioLevel:.5,showButtons:true,showOccupied:true,showComponents:false,buttonId:'',...value.settings};
      snapshot={protocolVersion:1,runtimeGeneration:1,roomId:room.id,sessionId:'preview-'+token(),installationStamp:'preview-'+owner,revision:1,
        deskIds:room.desks.map(d=>d.id),currentDeskId:value.deskId||room.startDesk,targetDeskId:null,queuedDeskId:null,transitionId:null,deadlineUtc:null,active:true,operable:true,
        lifecycle:{stage:'desktop',playbackPaused:false,locked:false,revision:0}};
      try{
        host=DextDomHost.createDomHost({context:{runtimeGeneration:1,manifest:room,resources:room.resources.map(path=>({path})),resourceBasePath:value.baseUrl},
          initialSnapshot:snapshot,document,container:document.getElementById('runtime'),native,getViewport:()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio}),
          createFrameHost:options=>DextFrameHost.createFrameHost({...options,randomToken:token}),
          sendControl:message=>{if(message.type==='dext:v3-transition-complete'&&message.transitionId===snapshot.transitionId)commit(snapshot.targetDeskId);}});
        await host.ready;post('dext:workbench:ready',{});report();
      }catch(error){issue(error.code||'renderUnavailable',String(error));post('dext:workbench:error',{message:String(error)});}
    }else if(value.token===owner&&value.type==='dext:workbench:control'&&host)controls(value.settings||{});
  });
  addEventListener('resize',()=>{if(host)void host.resize().then(report);});
  addEventListener('error',event=>{issue('scriptError',event.message);report();});
  addEventListener('unhandledrejection',event=>{issue('requestError',String(event.reason));report();});
  const dataTimer=setInterval(emit,1000),diagnosticTimer=setInterval(report,500);
  addEventListener('pagehide',()=>{clearInterval(dataTimer);clearInterval(diagnosticTimer);clearTimeout(transitionTimer);host?.dispose();overlay?.remove();},{once:true});
})();
