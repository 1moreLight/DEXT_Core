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
    const model=(options.createRuntime||root.DextRuntimeModel.createRuntime)(room),layoutModel=options.layoutModel||root.DextLayoutModel,geometry=options.geometry||root.DextGeometry;
    if(!layoutModel)throw failure('layoutUnavailable');if(!geometry)throw failure('geometryUnavailable');
    const raf=options.requestAnimationFrame||root.requestAnimationFrame.bind(root),cancel=options.cancelAnimationFrame||root.cancelAnimationFrame.bind(root),now=options.now||(()=>root.performance.now());
    const inventory=new Set(context.resources.map(r=>r.path)),desks=new Map(room.desks.map(d=>[d.id,d])),records=new Map(),icons=new Map();
    const later=options.setTimeout||root.setTimeout.bind(root),cancelTimer=options.clearTimeout||root.clearTimeout.bind(root),waits=new Set();
    function cancelWaits(){for(const wait of waits){cancelTimer(wait.id);wait.resolve();}waits.clear();}
    function yieldRetry(){return new Promise(resolve=>{const wait={id:null,resolve};wait.id=later(()=>{waits.delete(wait);resolve();},50);waits.add(wait);});}
    let snapshot=copy(options.initialSnapshot),disposed=false,epoch=0,inputVersion=0,inputReady=false,rootNode=null,animation=null,frameId=null,privatePaused=options.initialPlaybackSuspended===true,lastError=null,serial=Promise.resolve(),visualGroups=groups();
    let completion=null,pendingDefault=null,defaultTimer=null,lastEventSequence=0,consumedSequence=0;
    const actionFlights=new Set(),localButtons=new Map();
    let inputEntries=[],focus=null,focusNode=null,nativeHold=null,pendingVisualGroups=null;
    let personalLayout={revision:0,icons:{},components:{}},layoutReadEpoch=0,layoutReady=false,layoutError=null,effectiveLayouts=new Map(),layoutOccupied=[];
    const scope=()=>({runtimeGeneration:context.runtimeGeneration,sessionId:snapshot.sessionId,revision:snapshot.revision});
    const diagnose=code=>{lastError={code};};
    function resolveResource(path){
      if(disposed||typeof path!=='string'||!inventory.has(path)||path.startsWith('/')||path.includes('\\')||path.split('/').some(s=>!s||s==='.'||s==='..')||/[\u0000-\u001f:%#]/.test(path))throw failure('resourceUnavailable');
      return context.resourceBasePath+path.split('/').map(encodeURIComponent).join('/');
    }
    const frames=(options.createFrameHost||root.DextFrameHost.createFrameHost)({window:options.window||root,document,initialSnapshot:snapshot,runtimeGeneration:context.runtimeGeneration,
      initialGeometry:{geometryVersion:0,viewport:options.getViewport()},initialPlaybackSuspended:privatePaused,resolveResource,readCapabilities:q=>native.readCapabilities(q),
      implementedCapabilities:['desk.read','desk.navigate','binding.launch','time.read','hardware.read','media.read','audio.read','storage.read','storage.write','media.control','audio.control','dext.exit'],subscribeData:(q,emit)=>native.subscribeData(q,emit),
      applyState:options.applyFrameState,invoke:async value=>{
        if(['actions.activate','desk.navigate','media.control','audio.control'].includes(value.method))return authorAction(value);
        if(value.method==='actions.list'){const reply=await native.request('buttons',{consumer:value.consumerId},value.identity);if(reply.status!=='accepted')throw failure(reply.status);return reply.buttons;}
        if(value.method==='desk.get'){const reply=await native.readCapabilities({consumerId:value.consumerId,identity:value.identity});if(reply.status!=='accepted'||reply.capabilities?.['desk.read']!=='accepted')throw failure('denied');return copy(snapshot);}
        if(value.method==='storage.get'||value.method==='storage.set'){
          const params={consumer:value.consumerId,key:value.params.key};if(value.method==='storage.set')params.value=value.params.value;
          const reply=await native.request(value.method==='storage.get'?'storageGet':'storageSet',params,value.identity);
          if(reply.status!=='accepted')throw failure(reply.status);
          if(value.method==='storage.set')return{status:'accepted'};
          if(!Object.hasOwn(reply,'value'))throw failure('storageUnavailable');return copy(reply.value);
        }
        if(value.method==='scene.publishGeometry'){if(!await publishGeometry(value.consumerId,value.params.report))throw failure('staleInput');return{status:'accepted'};}
        if(value.method==='scene.completeTransition'){const result=model.animationFinished(value.identity.sessionId,value.params.transitionId);if(!result.accepted)throw failure('staleInput');complete(value.params.transitionId);return{status:'requested'};}
        if(value.method==='scene.done')return{status:media.completeHTML(value.instanceId)?'requested':'notOperable'};
        // Navigation/control get their own consumer authority adapters;
        // the legacy trusted top-level Desk endpoint is never used for authors.
        throw failure('unsupported');
      }});
    const media=(options.createMediaHost||root.DextMediaHost.createMediaHost)({document,getSnapshot:()=>snapshot,resolveResource,initialPlaybackSuspended:privatePaused,
      mountHTML:(definition,parent)=>frames.mount(definition,parent),setHTMLState:(id,state)=>frames.setState(id,state),disposeHTML:id=>frames.disposeInstance(id),
      onStartupComplete:value=>native.request('startupComplete',{lifecycleRevision:value.lifecycleRevision},{...scope(),sessionId:value.sessionId,revision:value.revision})});
    function activeDesk(){return snapshot.targetDeskId||snapshot.currentDeskId;}
    function inputDesks(sampled){return sampled&&snapshot.targetDeskId?[snapshot.currentDeskId,snapshot.targetDeskId]:[activeDesk()];}
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
    function recomputeLayouts(state){
      const next=new Map();
      for(const deskId of [snapshot.currentDeskId,snapshot.targetDeskId].filter(Boolean)){
        const items=layoutModel.projectDeskItems({manifest:room,layout:personalLayout,deskId});
        for(const item of layoutModel.resolveDeskLayout({items,viewport:state.viewport,occupied:layoutOccupied,deskId}))next.set(item.key,item);
      }
      effectiveLayouts=next;
    }
    function recordPlacement(record){
      const definition=record.definition,author=definition.placement||{x:0,y:0,width:1920,height:1080};
      if(definition.kind!=='widget')return author;
      const item=effectiveLayouts.get('widget:'+definition.consumerId.slice(10));
      return item?(item.placeable?item.effectiveRect:null):author;
    }
    function layout(record){
      const definition=record.definition,logical=definition.placement||{x:0,y:0,width:1920,height:1080},effective=recordPlacement(record),placement=effective||logical,group=visualGroups[classification(definition)];
      record.wrapper.hidden=!visible(definition)||!effective;
      record.wrapper.style.left=placement.x+'px';record.wrapper.style.top=placement.y+'px';
      // Keep the author iframe viewport and parent stable. Presentation scale
      // compensates the root canvas without resizing the document itself.
      record.wrapper.style.width=logical.width+'px';record.wrapper.style.height=logical.height+'px';
      transform(record.wrapper,placement.x,placement.y,group.matrix,placement.width/logical.width,placement.height/logical.height);
      record.wrapper.style.opacity=String(group.opacity);record.wrapper.style.pointerEvents=group.opacity<=0?'none':'';
    }
    function layoutIcon(record,group){
      const item=effectiveLayouts.get('icon:'+record.deskId+'/'+record.icon.id);
      record.rect=item?(item.placeable?item.effectiveRect:null):{x:32+record.icon.x*112,y:32+record.icon.y*120,width:96,height:104};
      const rect=record.rect;
      record.element.hidden=!rect||![snapshot.currentDeskId,snapshot.targetDeskId].includes(record.deskId)||(snapshot.lifecycle.stage!=='desktop'&&(snapshot.lifecycle.stage!=='idle'||!!room.idle));
      if(rect){record.element.style.left=rect.x+'px';record.element.style.top=rect.y+'px';transform(record.element,rect.x,rect.y,group.matrix,rect.width/96,rect.height/104);}
      record.element.style.opacity=String(group.opacity);record.element.style.pointerEvents=group.opacity<=0?'none':'';
    }
    function svg(tag){return document.createElementNS?document.createElementNS('http://www.w3.org/2000/svg',tag):document.createElement(tag);}
    function clearFocus(){focus=null;paintFocus(null);}
    function paintFocus(entry){
      if(!entry){if(focusNode){focusNode.hidden=true;focusNode.setAttribute('hidden','');for(const child of [...focusNode.children])child.remove();}return;}
      if(!focusNode){focusNode=svg('svg');focusNode.classList?.add('dext-v3-focus');if(!focusNode.classList)focusNode.className='dext-v3-focus';
        focusNode.setAttribute('viewBox','0 0 1920 1080');focusNode.setAttribute('aria-hidden','true');rootNode.append(focusNode);}
      for(const child of [...focusNode.children])child.remove();
      for(const polygon of entry.polygons||[geometry.rectPolygon({x:entry.x,y:entry.y,width:entry.width,height:entry.height})]){
        const path=svg('polygon');path.setAttribute('points',polygon.map(p=>p.x*1920+','+p.y*1080).join(' '));focusNode.append(path);
      }focusNode.hidden=false;focusNode.removeAttribute('hidden');
    }
    function showFocus(entry){focus=entry?{consumer:entry.consumer,button:entry.button,entryId:entry.entryId??null}:null;paintFocus(entry);}
    function refreshFocus(){
      if(!focus)return;
      const matches=buttonGeometry(true).filter(e=>e.consumer===focus.consumer&&e.button===focus.button&&(focus.entryId==null||e.entryId===focus.entryId));
      paintFocus(matches.length===1?matches[0]:null);
    }
    function eventEntry(value){
      const matches=inputEntries.filter(e=>e.consumer===value.consumer&&e.button===value.button&&(value.entryId==null||e.entryId===value.entryId));
      return matches.length===1?matches[0]:null;
    }
    function ensureRoot(){if(rootNode)return;rootNode=document.createElement('div');rootNode.className='dext-v3-canvas';container.append(rootNode);}
    function reconcile(){
      ensureRoot();const state=model.readDiagnostics();const viewport=state.viewport;
      rootNode.style.transform='scale('+(viewport.width/1920)+','+(viewport.height/1080)+')';recomputeLayouts(state);
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
          // Core native completion owns official activation; DOM click alone has no authority.
          rootNode.append(element);record={deskId:desk.id,icon,element};icons.set(key,record);}
        const group=visualGroups[snapshot.targetDeskId?(desk.id===snapshot.targetDeskId?'target':'source'):'source'];layoutIcon(record,group);
      }
      media.refresh();frames.setGeometry({geometryVersion:state.geometryVersion,viewport:state.viewport});
    }
    function inputLayer(record){
      const consumer=record.definition?.consumerId;
      return record.icon?40:consumer==='slot.start'||consumer==='slot.idle'?80:record.definition.kind==='dock'?50:
        record.definition.kind==='widget'?30:consumer==='scene'?20:0;
    }
    function paintNodes(){
      const nodes=[];let order=0;
      for(const record of records.values()){
        const group=visualGroups[classification(record.definition)],rect=recordPlacement(record);
        if(!record.wrapper.hidden&&group.opacity>0&&rect)nodes.push({record,order:order++,layer:inputLayer(record),group,polygon:geometry.rectPolygon(rect,group.matrix),moving:defaultMoving()&&classification(record.definition)!=='shared'});
      }
      for(const record of icons.values()){
        const group=visualGroups[snapshot.targetDeskId?(record.deskId===snapshot.targetDeskId?'target':'source'):'source'];
        if(!record.element.hidden&&group.opacity>0&&record.rect)nodes.push({record,order:order++,layer:40,group,polygon:geometry.rectPolygon(record.rect,group.matrix),moving:defaultMoving()});
      }return nodes;
    }
    function preciseEntry(consumer,button,entryId,rect,node,nodes,tabIndex,sampled=false){
      const front=nodes.filter(other=>other!==node&&(other.layer>node.layer||other.layer===node.layer&&other.order>node.order));
      // A boundary publication cannot track a moving foreground cover. Such
      // entries wait for the separate physical-event sampling mechanism.
      if(!sampled&&(node.moving||front.some(other=>other.moving)))return null;
      const pieces=geometry.visiblePolygons(geometry.rectPolygon(rect,node.group.matrix),{bounds:{x:0,y:0,width:1920,height:1080},occluders:front.map(other=>other.polygon)});
      if(!pieces.length)return null;
      if(pieces.length>64||pieces.some(p=>p.length>32))throw failure('geometryBudget');
      const polygons=pieces.map(p=>p.map(v=>({x:v.x/1920,y:v.y/1080}))),points=polygons.flat();
      const x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y)),right=Math.max(...points.map(p=>p.x)),bottom=Math.max(...points.map(p=>p.y));
      return{consumer,button,entryId,x,y,width:right-x,height:bottom-y,tabIndex,polygons};
    }
    function buttonGeometry(sampled=false){
      if(privatePaused||!snapshot.active||snapshot.lifecycle.stage==='desktop'&&!snapshot.operable||snapshot.lifecycle.playbackPaused||snapshot.lifecycle.locked)return[];
      const state=model.readDiagnostics(),buttons=[],nodes=paintNodes();let vertices=0;
      const add=button=>{if(!button)return;vertices+=button.polygons.reduce((n,p)=>n+p.length,0);if(buttons.length>=4096||vertices>65536)throw failure('geometryBudget');buttons.push(button);};
      for(const [consumer,regions]of Object.entries(state.buttonRegions)){
        const node=nodes.find(n=>n.record.definition?.consumerId===consumer);if(!node)continue;
        const record=node.record;
        const allowedDesks=inputDesks(sampled);
        if(consumer.startsWith('component.')&&!allowedDesks.some(id=>desks.get(id).components.includes(consumer.slice(10)))||consumer.startsWith('slot.background.')&&!allowedDesks.includes(consumer.slice(16)))continue;
        for(const region of regions){
          const authored=room.buttons?.find(button=>button.id===region.buttonId);if(!authored||authored.scope!=='room'&&!allowedDesks.includes(authored.scope))continue;
          const local=localButtons.get(consumer)?.find(b=>b.buttonId===region.buttonId),placement=recordPlacement(record);
          const rect=local&&record.definition.placement?layoutModel.mapLocalRect({localRect:local,logicalSize:record.definition.placement,effectiveRect:placement}):region;
          add(preciseEntry(consumer,region.buttonId,'button.'+region.buttonId,rect,node,nodes,buttons.length,sampled));
        }
      }
      for(const record of icons.values())if(snapshot.lifecycle.stage==='desktop'&&inputDesks(sampled).includes(record.deskId)){
        const node=nodes.find(n=>n.record===record);if(node)add(preciseEntry('official',record.icon.buttonId,'icon.'+record.deskId+'/'+record.icon.id,record.rect,node,nodes,buttons.length,sampled));
      }
      return buttons.sort((a,b)=>inputLayer(nodes.find(n=>n.record.definition?.consumerId===b.consumer||b.consumer==='official'&&n.record.icon).record)-inputLayer(nodes.find(n=>n.record.definition?.consumerId===a.consumer||a.consumer==='official'&&n.record.icon).record));
    }
    async function render(){
      const ownEpoch=++epoch;releaseNativeHold(false);cancelWaits();clearDefault();clearFocus();inputEntries=[];completion=null;inputReady=false;const ownScope=scope();native.acceptIdentity(ownScope);
      const job=async()=>{
        if(disposed||ownEpoch!==epoch)return false;
        try{
          const invalidated=await native.request('invalidateGeometry',{},ownScope);if(invalidated.status!=='accepted'||disposed||ownEpoch!==epoch)return false;
          syncAnimation();reconcile();const state=model.readDiagnostics(),entries=buttonGeometry();let published;
          for(let attempt=0;attempt<8;attempt++){
            if(disposed||ownEpoch!==epoch)return false;
            published=await native.request('geometry',{geometryVersion:++inputVersion,viewport:state.viewport,buttons:entries,eventSamples:true},ownScope);
            if(published.status!=='staleInput'||attempt===7)break;await yieldRetry();
          }
          if(disposed||ownEpoch!==epoch)return false;inputReady=published.status==='accepted';if(inputReady)inputEntries=copy(entries);if(!inputReady)diagnose('geometryUnavailable');return inputReady;
        }catch(error){if(!disposed&&ownEpoch===epoch)diagnose(error.code||'geometryUnavailable');return false;}
      };
      serial=serial.then(job,job);return serial;
    }
    function complete(transitionId){options.sendControl({type:'dext:v3-transition-complete',sessionId:snapshot.sessionId,transitionId});}
    function schedule(){if(!nativeHold&&frameId===null&&!disposed&&!privatePaused&&animation&&!animation.finished)frameId=raf(step);}
    function syncAnimation(){
      if(!snapshot.transitionId){if(frameId!==null)cancel(frameId);frameId=null;animation=null;return;}
      if(!animation||animation.id!==snapshot.transitionId){if(frameId!==null)cancel(frameId);frameId=null;animation={id:snapshot.transitionId,session:snapshot.sessionId,elapsed:0,last:now(),finished:false};}
      updateDefaultGroups();schedule();
    }
    function defaultMoving(){return !!snapshot.transitionId&&(room.transition?.type||'slide')!=='author'&&!animation?.finished;}
    function transform(element,x,y,m,sx=1,sy=1){element.style.transform='matrix('+[m[0]*sx,m[1]*sx,m[2]*sy,m[3]*sy,m[4]+(m[0]-1)*x+m[2]*y,m[5]+m[1]*x+(m[3]-1)*y].join(',')+')';}
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
      paintVisuals();
      // Boundary geometry excludes moving rows; physical edges sample painted rows.
      if(p>=1){animation.finished=true;const result=model.animationFinished(animation.session,animation.id);if(result.accepted)complete(animation.id);}else schedule();
    }
    function paintVisuals(){
      for(const record of records.values())layout(record);
      for(const record of icons.values())layoutIcon(record,visualGroups[snapshot.targetDeskId?(record.deskId===snapshot.targetDeskId?'target':'source'):'source']);
      refreshFocus();
    }
    function applyVisualGroups(next){
      if(nativeHold){pendingVisualGroups=next;return;}
      visualGroups=next;paintVisuals();
    }
    function releaseNativeHold(apply=true){
      if(!nativeHold)return false;nativeHold=null;
      const pending=pendingVisualGroups;pendingVisualGroups=null;
      if(apply&&pending){visualGroups=pending;paintVisuals();}
      schedule();return true;
    }
    function sameActionScope(identity,geometry){
      return !disposed&&inputReady&&!privatePaused&&identity.runtimeGeneration===context.runtimeGeneration&&
        identity.sessionId===snapshot.sessionId&&identity.revision===snapshot.revision&&geometry===inputVersion;
    }
    function clearDefault(){if(defaultTimer!==null)cancelTimer(defaultTimer);defaultTimer=null;pendingDefault=null;}
    function consumeReceipt(reply){
      if(reply.inputConsumed!==true||!Number.isSafeInteger(reply.inputSequence)||reply.inputSequence<=0)return;
      consumedSequence=Math.max(consumedSequence,reply.inputSequence);
      if(pendingDefault&&pendingDefault.inputSequence<=consumedSequence)clearDefault();
    }
    function runDefault(){
      defaultTimer=null;const own=pendingDefault;
      if(!own||!own.due)return;
      if(!sameActionScope(own.identity,own.geometryVersion)){clearDefault();return;}
      if([...actionFlights].some(f=>f.consumer===own.consumer&&f.geometry===own.geometryVersion&&
        f.identity.sessionId===own.identity.sessionId&&f.identity.revision===own.identity.revision))return;
      pendingDefault=null;
      native.request('activate',{consumer:own.consumer,button:own.button,geometryVersion:own.geometryVersion,inputSequence:own.inputSequence},own.identity)
        .then(reply=>{if(sameActionScope(own.identity,own.geometryVersion))consumeReceipt(reply);},()=>diagnose('activationUnavailable'));
    }
    async function authorAction(value){
      const {consumerId:consumer,identity,instanceId,requestJson,method}=value;
      if(!sameActionScope(identity,inputVersion))throw failure('staleInput');
      if(typeof instanceId!=='string'||typeof requestJson!=='string')throw failure('inputRequired');
      if(actionFlights.size>=64)throw failure('requestLimit');
      const geometry=inputVersion,flight={consumer,identity:copy(identity),geometry};actionFlights.add(flight);
      try{
        const reply=await native.request('authorInput',{consumer,instanceId,requestJson,geometryVersion:geometry},identity);
        if(sameActionScope(identity,geometry))consumeReceipt(reply);
        if(method!=='actions.activate'&&!['accepted','queued'].includes(reply.status))throw failure(reply.status);
        return{status:reply.status};
      }finally{actionFlights.delete(flight);runDefault();}
    }
    function sameLayoutScope(identity,deskId,token){
      return !disposed&&token===layoutReadEpoch&&identity.runtimeGeneration===context.runtimeGeneration&&identity.sessionId===snapshot.sessionId&&identity.revision===snapshot.revision&&deskId===activeDesk();
    }
    function renderWithLayout(){
      const token=++layoutReadEpoch,identity=scope(),deskId=activeDesk();
      layoutReady=false;inputReady=false;clearDefault();clearFocus();inputEntries=[];completion=null;epoch++;cancelWaits();
      const read=async()=>{
        try{
          const reply=await native.request('layoutRead',{},identity);
          if(!sameLayoutScope(identity,deskId,token))return false;
          if(reply.status==='accepted'&&reply.layout){personalLayout=copy(reply.layout);layoutReady=true;layoutError=null;}
          else layoutError=reply.status==='accepted'?'invalidPayload':reply.status;
        }catch(error){if(!sameLayoutScope(identity,deskId,token))return false;layoutError=error.code||'storageUnavailable';}
        return sameLayoutScope(identity,deskId,token)?render():false;
      };
      return read();
    }
    function acceptSnapshot(next){
      if(disposed)return Promise.resolve(false);const accepted=model.acceptSnapshot(next);if(!accepted.accepted)return Promise.resolve(false);
      snapshot=copy(next);visualGroups=model.readDiagnostics().groups;
      native.acceptIdentity(scope());frames.acceptSnapshot(snapshot);return renderWithLayout();
    }
    function publishGeometry(consumer,report){
      if(disposed)return Promise.resolve(false);let value=copy(report);const definition=model.readDiagnostics().instances.find(d=>d.consumerId===consumer);
      if(!definition)return Promise.resolve(false);
      if(definition.placement&&value.buttons){const p=definition.placement;if(value.buttons.some(b=>b.x<0||b.y<0||b.x+b.width>p.width||b.y+b.height>p.height))return Promise.resolve(false);value.buttons=value.buttons.map(b=>({...b,x:b.x+p.x,y:b.y+p.y}));}
      const result=model.acceptGeometry(consumer,value);if(!result.accepted)return Promise.resolve(false);
      if(definition.placement&&report.buttons!==undefined)localButtons.set(consumer,copy(report.buttons));
      if(consumer==='scene'&&report.occupied!==undefined)layoutOccupied=copy(report.occupied);
      if(result.effects.length===0)return Promise.resolve(true);
      const nextGroups=model.readDiagnostics().groups;
      if(result.effects.every(effect=>effect.type==='applyVisualGroups')){applyVisualGroups(nextGroups);return Promise.resolve(true);}
      visualGroups=nextGroups;return render();
    }
    model.setViewport(options.getViewport());
    const ready=acceptSnapshot(snapshot);
    return Object.freeze({ready,acceptSnapshot,publishGeometry,resolveResource,
      readInputSample(identity,version){
        if(!identity||!sameActionScope(identity,version))return null;
        return copy({geometryVersion:inputVersion,viewport:model.readDiagnostics().viewport,buttons:buttonGeometry(true)});
      },
      beginNativeInputSample(identity,version,sampleId){
        if(nativeHold||typeof sampleId!=='string'||!sampleId.length||sampleId.length>128||!identity||!sameActionScope(identity,version))return null;
        const sample=copy({sampleId,geometryVersion:inputVersion,viewport:model.readDiagnostics().viewport,buttons:buttonGeometry(true)});
        nativeHold={sampleId};if(frameId!==null)cancel(frameId);frameId=null;inputEntries=copy(sample.buttons);return sample;
      },
      endNativeInputSample(sampleId){return nativeHold?.sampleId===sampleId?releaseNativeHold():false;},
      resize(){if(disposed)return Promise.resolve(false);const result=model.setViewport(options.getViewport());return result.accepted&&result.effects.length?render():Promise.resolve(result.accepted);},
      refreshPermissions(consumer){for(const record of records.values())if(record.definition.consumerId===consumer)frames.refreshPermissions(record.definition.instanceId);},
      setPlaybackSuspended(value){
        if(disposed||typeof value!=='boolean')return false;if(value===privatePaused)return true;
        if(value){layoutReadEpoch++;layoutReady=false;clearDefault();clearFocus();inputEntries=[];completion=null;privatePaused=true;releaseNativeHold(false);inputReady=false;if(frameId!==null)cancel(frameId);frameId=null;media.setPlaybackSuspended(true);frames.setPlaybackSuspended(true);native.setSuspended(true);for(const record of records.values())if(record.watch){record.watch();record.watch=null;}}
        else{native.setSuspended(false);privatePaused=false;if(animation)animation.last=now();media.setPlaybackSuspended(false);frames.setPlaybackSuspended(false);renderWithLayout();}return true;
      },
      handleNativeInput(value){if(disposed||!inputReady||value.runtimeGeneration!==context.runtimeGeneration||value.sessionId!==snapshot.sessionId||value.revision!==snapshot.revision||value.geometryVersion!==inputVersion)return false;
        if(value.kind==='focus'){
          if(value.consumer===null&&value.button===null&&value.entryId==null){clearFocus();return true;}
          const entry=eventEntry(value);if(!entry)return false;showFocus(entry);return true;
        }
        if(value.kind==='activate'){
          if(value.entryId!=null&&!eventEntry(value))return false;
          if(!Number.isSafeInteger(value.inputSequence)||value.inputSequence<=Math.max(lastEventSequence,consumedSequence)||typeof value.consumer!=='string'||typeof value.button!=='string')return false;
          lastEventSequence=value.inputSequence;clearDefault();completion=copy(value);
          const own={...completion,identity:scope(),due:value.consumer==='official'};pendingDefault=own;
          if(own.due)runDefault();else defaultTimer=later(()=>{if(pendingDefault===own){own.due=true;runDefault();}},100);
          return true;
        }return false;},
      dispose(){if(disposed)return;disposed=true;releaseNativeHold(false);epoch++;layoutReadEpoch++;cancelWaits();clearDefault();clearFocus();inputEntries=[];completion=null;inputReady=false;if(frameId!==null)cancel(frameId);frameId=null;for(const record of records.values())record.watch?.();frames.dispose();media.dispose();native.dispose();model.dispose();records.clear();icons.clear();localButtons.clear();effectiveLayouts.clear();rootNode?.remove();},
      readDiagnostics(){const state=model.readDiagnostics();return{...state,inputReady,inputVersion,disposed,focus:focus&&{...focus},layout:{revision:personalLayout.revision,ready:layoutReady,error:layoutError,items:copy([...effectiveLayouts.values()])},lastError:lastError&&{...lastError},transition:animation&&{id:animation.id,elapsed:animation.elapsed,finished:animation.finished},frames:frames.readDiagnostics(),media:media.readDiagnostics()};}
    });
  }
  return Object.freeze({createDomHost});
});
