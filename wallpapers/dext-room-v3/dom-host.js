(function(root,factory){
  'use strict';const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.DextDomHost=api;
})(globalThis,function(root){
  'use strict';
  const copy=v=>JSON.parse(JSON.stringify(v));
  const neutral=()=>({matrix:[1,0,0,1,0,0],opacity:1});
  const groups=()=>Object.fromEntries(['source','target','shared'].map(key=>[key,neutral()]));
  function failure(code){const e=new Error('Dext DOM: '+code);e.code=code;return e;}
  function createDomHost(options){
    const context=copy(options.context),room=context.manifest,document=options.document||root.document,container=options.container,native=options.native;
    const model=(options.createRuntime||root.DextRuntimeModel.createRuntime)(room);
    const raf=options.requestAnimationFrame||root.requestAnimationFrame.bind(root),cancel=options.cancelAnimationFrame||root.cancelAnimationFrame.bind(root),now=options.now||(()=>root.performance.now());
    const inventory=new Set(context.resources.map(r=>r.path)),desks=new Map(room.desks.map(d=>[d.id,d])),records=new Map(),icons=new Map();
    const later=options.setTimeout||root.setTimeout.bind(root),cancelTimer=options.clearTimeout||root.clearTimeout.bind(root),waits=new Set();
    function cancelWaits(){for(const wait of waits){cancelTimer(wait.id);wait.resolve();}waits.clear();}
    function yieldRetry(){return new Promise(resolve=>{const wait={id:null,resolve};wait.id=later(()=>{waits.delete(wait);resolve();},50);waits.add(wait);});}
    let snapshot=copy(options.initialSnapshot),disposed=false,epoch=0,inputVersion=0,inputReady=false,rootNode=null,animation=null,frameId=null,privatePaused=options.initialPlaybackSuspended===true,lastError=null,serial=Promise.resolve(),visualGroups=groups();
    const scope=()=>({runtimeGeneration:context.runtimeGeneration,sessionId:snapshot.sessionId,revision:snapshot.revision});
    const diagnose=code=>{lastError={code};};
    function resolveResource(path){
      if(disposed||typeof path!=='string'||!inventory.has(path)||path.startsWith('/')||path.includes('\\')||path.split('/').some(s=>!s||s==='.'||s==='..')||/[\u0000-\u001f:%#]/.test(path))throw failure('resourceUnavailable');
      return context.resourceBasePath+path.split('/').map(encodeURIComponent).join('/');
    }
    const frames=(options.createFrameHost||root.DextFrameHost.createFrameHost)({window:options.window||root,document,initialSnapshot:snapshot,runtimeGeneration:context.runtimeGeneration,
      initialGeometry:{geometryVersion:0,viewport:options.getViewport()},initialPlaybackSuspended:privatePaused,resolveResource,readCapabilities:q=>native.readCapabilities(q),
      implementedCapabilities:['desk.read','binding.launch','time.read','hardware.read','media.read','audio.read'],subscribeData:(q,emit)=>native.subscribeData(q,emit),
      applyState:options.applyFrameState,invoke:async value=>{
        if(value.method==='actions.activate')return activate(value.consumerId,value.params.buttonId,value.identity);
        if(value.method==='actions.list'){const reply=await native.request('buttons',{consumer:value.consumerId},value.identity);if(reply.status!=='accepted')throw failure(reply.status);return reply.buttons;}
        if(value.method==='desk.get'){const reply=await native.readCapabilities({consumerId:value.consumerId,identity:value.identity});if(reply.status!=='accepted'||reply.capabilities?.['desk.read']!=='accepted')throw failure('denied');return copy(snapshot);}
        if(value.method==='scene.publishGeometry'){if(!await publishGeometry(value.consumerId,value.params.report))throw failure('staleInput');return{status:'accepted'};}
        if(value.method==='scene.completeTransition'){const result=model.animationFinished(value.identity.sessionId,value.params.transitionId);if(!result.accepted)throw failure('staleInput');complete(value.params.transitionId);return{status:'requested'};}
        if(value.method==='scene.done')return{status:media.completeHTML(value.instanceId)?'requested':'notOperable'};
        // Navigation/control/storage get their own consumer authority adapters;
        // the legacy trusted top-level Desk endpoint is never used for authors.
        throw failure('unsupported');
      }});
    const media=(options.createMediaHost||root.DextMediaHost.createMediaHost)({document,getSnapshot:()=>snapshot,resolveResource,initialPlaybackSuspended:privatePaused,
      mountHTML:(definition,parent)=>frames.mount(definition,parent),setHTMLState:(id,state)=>frames.setState(id,state),disposeHTML:id=>frames.disposeInstance(id),
      onStartupComplete:value=>native.request('startupComplete',{lifecycleRevision:value.lifecycleRevision},{...scope(),sessionId:value.sessionId,revision:value.revision})});
    function activeDesk(){return snapshot.targetDeskId||snapshot.currentDeskId;}
    function visible(definition){
      const stage=snapshot.lifecycle.stage;
      if(definition.consumerId==='slot.start')return stage==='starting';if(definition.consumerId==='slot.idle')return stage==='idle';
      if(stage==='starting'&&room.start||stage==='idle'&&room.idle)return false;
      if(definition.consumerId==='scene')return true;
      if(definition.consumerId.startsWith('slot.background.'))return [snapshot.currentDeskId,snapshot.targetDeskId].includes(definition.consumerId.slice(16));
      const component=definition.consumerId.slice(10);return [snapshot.currentDeskId,snapshot.targetDeskId].filter(Boolean).some(id=>desks.get(id).components.includes(component));
    }
    function classification(definition){
      if(!snapshot.targetDeskId)return'shared';
      if(definition.consumerId.startsWith('slot.background.'))return definition.consumerId.slice(16)===snapshot.targetDeskId?'target':'source';
      if(!definition.consumerId.startsWith('component.'))return'shared';
      const id=definition.consumerId.slice(10),source=desks.get(snapshot.currentDeskId).components.includes(id),target=desks.get(snapshot.targetDeskId).components.includes(id);
      return source&&target?'shared':target?'target':'source';
    }
    function layout(record){
      const definition=record.definition,placement=definition.placement||{x:0,y:0,width:1920,height:1080},group=visualGroups[classification(definition)];
      record.wrapper.hidden=!visible(definition);record.wrapper.style.left=placement.x+'px';record.wrapper.style.top=placement.y+'px';record.wrapper.style.width=placement.width+'px';record.wrapper.style.height=placement.height+'px';
      // Every wrapper remains under one fixed parent. Reparenting an iframe
      // during a transition would reload its document and lose shared state.
      transform(record.wrapper,placement.x,placement.y,group.matrix);record.wrapper.style.opacity=String(group.opacity);
    }
    function ensureRoot(){if(rootNode)return;rootNode=document.createElement('div');rootNode.className='dext-v3-canvas';container.append(rootNode);}
    function reconcile(){
      ensureRoot();const state=model.readDiagnostics();const viewport=state.viewport;
      rootNode.style.transform='scale('+(viewport.width/1920)+','+(viewport.height/1080)+')';
      for(const definition of state.instances){
        let record=records.get(definition.instanceId);
        if(!record){
          const wrapper=document.createElement('div');wrapper.className='dext-v3-instance dext-v3-'+definition.kind;wrapper.dataset.consumer=definition.consumerId;rootNode.append(wrapper);
          const element=definition.content?media.mount(definition,wrapper):frames.mount(definition,wrapper);
          record={definition,wrapper,element,watch:null};records.set(definition.instanceId,record);
        }else record.definition=definition;
        if(definition.content)media.setState(definition.instanceId,definition.state);else{frames.setState(definition.instanceId,definition.state);frames.updateConfig(definition.instanceId,definition.config);}
        const html=!definition.content||definition.content.type==='html';
        if(html&&definition.state==='active'&&!privatePaused&&!record.watch)record.watch=native.watchCapabilities(definition.consumerId,()=>frames.refreshPermissions(definition.instanceId));
        if((!html||definition.state!=='active'||privatePaused)&&record.watch){record.watch();record.watch=null;}
        layout(record);
      }
      for(const desk of room.desks)for(const icon of desk.icons){
        const key=desk.id+'\0'+icon.id;let record=icons.get(key);
        if(!record){const element=document.createElement('button');element.className='dext-v3-icon';element.type='button';element.textContent=(icon.glyph||'◇')+'\n'+(icon.label||icon.id);element.setAttribute('aria-label',icon.label||icon.id);
          const click=()=>{activate('official',icon.buttonId).catch(()=>diagnose('activationUnavailable'));};element.addEventListener('click',click);rootNode.append(element);record={deskId:desk.id,icon,element,click};icons.set(key,record);}
        const group=visualGroups[snapshot.targetDeskId?(desk.id===snapshot.targetDeskId?'target':'source'):'shared'];record.element.hidden=![snapshot.currentDeskId,snapshot.targetDeskId].includes(desk.id)||snapshot.lifecycle.stage!=='desktop';
        record.element.style.left=(32+icon.x*112)+'px';record.element.style.top=(32+icon.y*120)+'px';transform(record.element,32+icon.x*112,32+icon.y*120,group.matrix);record.element.style.opacity=String(group.opacity);
      }
      media.refresh();frames.setGeometry({geometryVersion:state.geometryVersion,viewport:state.viewport});
    }
    function normalized(consumer,button,rect,group,tabIndex){
      if(group.opacity<=0)return null;const m=group.matrix;
      if(Math.abs(m[1])>.000001||Math.abs(m[2])>.000001){diagnose('nonRectangularInput');return null;}
      const points=[[rect.x,rect.y],[rect.x+rect.width,rect.y],[rect.x,rect.y+rect.height],[rect.x+rect.width,rect.y+rect.height]].map(([x,y])=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]]);
      const left=Math.max(0,Math.min(...points.map(p=>p[0]))),right=Math.min(1920,Math.max(...points.map(p=>p[0]))),top=Math.max(0,Math.min(...points.map(p=>p[1]))),bottom=Math.min(1080,Math.max(...points.map(p=>p[1])));
      if(right<=left||bottom<=top)return null;return{consumer,button,x:left/1920,y:top/1080,width:(right-left)/1920,height:(bottom-top)/1080,tabIndex};
    }
    function buttonGeometry(){
      if(privatePaused||!snapshot.active||snapshot.lifecycle.stage==='desktop'&&!snapshot.operable||snapshot.lifecycle.playbackPaused||snapshot.lifecycle.locked)return[];
      const state=model.readDiagnostics(),buttons=[];let index=0;
      for(const [consumer,regions]of Object.entries(state.buttonRegions)){
        const record=[...records.values()].find(r=>r.definition.consumerId===consumer);if(!record||record.wrapper.hidden||defaultMoving()&&classification(record.definition)!=='shared')continue;
        if(consumer.startsWith('component.')&&!desks.get(activeDesk()).components.includes(consumer.slice(10))||consumer.startsWith('slot.background.')&&consumer.slice(16)!==activeDesk())continue;
        for(const region of regions){const button=normalized(consumer,region.buttonId,region,visualGroups[classification(record.definition)],index++);if(button)buttons.push(button);}
      }
      for(const record of icons.values())if(record.deskId===activeDesk()&&!record.element.hidden&&!defaultMoving()){const b=normalized('official',record.icon.buttonId,{x:32+record.icon.x*112,y:32+record.icon.y*120,width:96,height:104},visualGroups[snapshot.targetDeskId?'target':'shared'],index++);if(b&&!buttons.some(v=>v.consumer===b.consumer&&v.button===b.button))buttons.push(b);}
      const layer=consumer=>consumer==='official'?40:consumer.startsWith('slot.start')||consumer.startsWith('slot.idle')?80:
        consumer==='scene'?20:records.size&&[...records.values()].find(r=>r.definition.consumerId===consumer)?.definition.kind==='dock'?50:consumer.startsWith('component.')?30:0;
      return buttons.sort((a,b)=>layer(b.consumer)-layer(a.consumer));
    }
    async function render(){
      const ownEpoch=++epoch;cancelWaits();inputReady=false;const ownScope=scope();native.acceptIdentity(ownScope);
      const job=async()=>{
        if(disposed||ownEpoch!==epoch)return false;
        try{
          const invalidated=await native.request('invalidateGeometry',{},ownScope);if(invalidated.status!=='accepted'||disposed||ownEpoch!==epoch)return false;
          syncAnimation();reconcile();const state=model.readDiagnostics();let published;
          for(let attempt=0;attempt<8;attempt++){
            if(disposed||ownEpoch!==epoch)return false;
            published=await native.request('geometry',{geometryVersion:++inputVersion,viewport:state.viewport,buttons:buttonGeometry()},ownScope);
            if(published.status!=='staleInput'||attempt===7)break;await yieldRetry();
          }
          if(disposed||ownEpoch!==epoch)return false;inputReady=published.status==='accepted';if(!inputReady)diagnose('geometryUnavailable');return inputReady;
        }catch(error){if(!disposed&&ownEpoch===epoch)diagnose(error.code||'geometryUnavailable');return false;}
      };
      serial=serial.then(job,job);return serial;
    }
    function complete(transitionId){options.sendControl({type:'dext:v3-transition-complete',sessionId:snapshot.sessionId,transitionId});}
    function schedule(){if(frameId===null&&!disposed&&!privatePaused&&animation&&!animation.finished)frameId=raf(step);}
    function syncAnimation(){
      if(!snapshot.transitionId){if(frameId!==null)cancel(frameId);frameId=null;animation=null;return;}
      if(!animation||animation.id!==snapshot.transitionId){if(frameId!==null)cancel(frameId);frameId=null;animation={id:snapshot.transitionId,session:snapshot.sessionId,elapsed:0,last:now(),finished:false};}
      updateDefaultGroups();schedule();
    }
    function defaultMoving(){return !!snapshot.transitionId&&(room.transition?.type||'slide')!=='author'&&!animation?.finished;}
    function transform(element,x,y,m){element.style.transform='matrix('+[m[0],m[1],m[2],m[3],m[4]+(m[0]-1)*x+m[2]*y,m[5]+m[1]*x+(m[3]-1)*y].join(',')+')';}
    function updateDefaultGroups(){
      const transition=room.transition||{type:'slide',durationMs:450};if(!animation||transition.type==='author')return null;
      const p=transition.durationMs===0?1:Math.min(1,animation.elapsed/transition.durationMs);visualGroups=groups();
      if(transition.type==='slide'){const direction=room.desks.findIndex(d=>d.id===snapshot.targetDeskId)>room.desks.findIndex(d=>d.id===snapshot.currentDeskId)?1:-1;visualGroups.source.matrix[4]=-direction*1920*p;visualGroups.target.matrix[4]=direction*1920*(1-p);}
      else if(transition.type==='fade'){visualGroups.source.opacity=1-p;visualGroups.target.opacity=p;}return p;
    }
    function step(){
      frameId=null;if(disposed||privatePaused||!animation||animation.id!==snapshot.transitionId)return;
      animation.elapsed+=Math.max(0,now()-animation.last);animation.last=now();const transition=room.transition||{type:'slide',durationMs:450};
      if(transition.type==='author')return;
      const p=updateDefaultGroups();
      for(const record of records.values())layout(record);for(const record of icons.values()){const group=visualGroups[record.deskId===snapshot.targetDeskId?'target':'source'];transform(record.element,32+record.icon.x*112,32+record.icon.y*120,group.matrix);record.element.style.opacity=String(group.opacity);}
      // Moving hit regions are invalid until a stationary layout is published.
      if(p>=1){animation.finished=true;const result=model.animationFinished(animation.session,animation.id);if(result.accepted)complete(animation.id);}else schedule();
    }
    async function activate(consumer,button,identity=scope()){
      if(disposed||!inputReady||privatePaused)return{status:'staleInput'};
      const reply=await native.request('activate',{consumer,button,geometryVersion:inputVersion},identity);return{status:reply.status};
    }
    function acceptSnapshot(next){
      if(disposed)return Promise.resolve(false);const accepted=model.acceptSnapshot(next);if(!accepted.accepted)return Promise.resolve(false);
      snapshot=copy(next);visualGroups=model.readDiagnostics().groups;
      // Frame updates start authorization reads synchronously. Advance the
      // native scope first so those reads do not target the previous revision.
      native.acceptIdentity(scope());frames.acceptSnapshot(snapshot);return render();
    }
    function publishGeometry(consumer,report){
      if(disposed)return Promise.resolve(false);let value=copy(report);const definition=model.readDiagnostics().instances.find(d=>d.consumerId===consumer);
      if(!definition)return Promise.resolve(false);
      if(definition.placement&&value.buttons){const p=definition.placement;if(value.buttons.some(b=>b.x<0||b.y<0||b.x+b.width>p.width||b.y+b.height>p.height))return Promise.resolve(false);value.buttons=value.buttons.map(b=>({...b,x:b.x+p.x,y:b.y+p.y}));}
      const result=model.acceptGeometry(consumer,value);if(!result.accepted)return Promise.resolve(false);if(result.effects.length===0)return Promise.resolve(true);
      visualGroups=model.readDiagnostics().groups;return render();
    }
    model.setViewport(options.getViewport());
    const ready=acceptSnapshot(snapshot);
    return Object.freeze({ready,acceptSnapshot,publishGeometry,resolveResource,
      resize(){if(disposed)return Promise.resolve(false);const result=model.setViewport(options.getViewport());return result.accepted&&result.effects.length?render():Promise.resolve(result.accepted);},
      refreshPermissions(consumer){for(const record of records.values())if(record.definition.consumerId===consumer)frames.refreshPermissions(record.definition.instanceId);},
      setPlaybackSuspended(value){
        if(disposed||typeof value!=='boolean')return false;if(value===privatePaused)return true;
        if(value){privatePaused=true;inputReady=false;if(frameId!==null)cancel(frameId);frameId=null;media.setPlaybackSuspended(true);frames.setPlaybackSuspended(true);native.setSuspended(true);for(const record of records.values())if(record.watch){record.watch();record.watch=null;}}
        else{native.setSuspended(false);privatePaused=false;if(animation)animation.last=now();media.setPlaybackSuspended(false);frames.setPlaybackSuspended(false);render();}return true;
      },
      handleNativeInput(value){if(disposed||!inputReady||value.runtimeGeneration!==context.runtimeGeneration||value.sessionId!==snapshot.sessionId||value.revision!==snapshot.revision||value.geometryVersion!==inputVersion)return false;
        if(value.kind==='activate'){activate(value.consumer,value.button).catch(()=>diagnose('activationUnavailable'));return true;}return value.kind==='focus';},
      dispose(){if(disposed)return;disposed=true;epoch++;cancelWaits();inputReady=false;if(frameId!==null)cancel(frameId);frameId=null;for(const record of records.values())record.watch?.();for(const record of icons.values())record.element.removeEventListener('click',record.click);frames.dispose();media.dispose();native.dispose();model.dispose();records.clear();icons.clear();rootNode?.remove();},
      readDiagnostics(){const state=model.readDiagnostics();return{...state,inputReady,inputVersion,disposed,lastError:lastError&&{...lastError},transition:animation&&{id:animation.id,elapsed:animation.elapsed,finished:animation.finished},frames:frames.readDiagnostics(),media:media.readDiagnostics()};}
    });
  }
  return Object.freeze({createDomHost});
});
