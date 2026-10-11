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
    const dockView=context.viewKind==="dock";
    const model=(options.createRuntime||root.DextRuntimeModel.createRuntime)(room,{viewKind:context.viewKind}),layoutModel=options.layoutModel||root.DextLayoutModel,geometry=options.geometry||root.DextGeometry;
    if(!layoutModel)throw failure('layoutUnavailable');if(!geometry)throw failure('geometryUnavailable');
    const raf=options.requestAnimationFrame||root.requestAnimationFrame.bind(root),cancel=options.cancelAnimationFrame||root.cancelAnimationFrame.bind(root),now=options.now||(()=>root.performance.now());
    const inventory=new Set(context.resources.map(r=>r.path)),desks=new Map(room.desks.map(d=>[d.id,d])),records=new Map(),icons=new Map();
    const later=options.setTimeout||root.setTimeout.bind(root),cancelTimer=options.clearTimeout||root.clearTimeout.bind(root),waits=new Set();
    function cancelWaits(){for(const wait of waits){cancelTimer(wait.id);wait.resolve();}waits.clear();}
    function yieldRetry(){return new Promise(resolve=>{const wait={id:null,resolve};wait.id=later(()=>{waits.delete(wait);resolve();},50);waits.add(wait);});}
    let snapshot=copy(options.initialSnapshot),disposed=false,epoch=0,inputVersion=0,inputReady=false,rootNode=null,animation=null,frameId=null,privatePaused=options.initialPlaybackSuspended===true,lastError=null,serial=Promise.resolve(),visualGroups=groups();
    let completion=null,pendingDefault=null,defaultTimer=null,lastEventSequence=0,consumedSequence=0;
    const actionFlights=new Set(),localButtons=new Map();
    let taskAreaOcclusion=null;
    let inputEntries=[],focus=null,focusNode=null,nativeHold=null,pendingVisualGroups=null;
    let desktopView=null,desktopPage=0,desktopPages=1,desktopSignature=null;
    let presentationSkins={},presentationTimer=null,presentationRunning=false,locatorRequest=null,locatorButton=null,locatorNode=null,locatorTimer=null;
    let personalLayout={revision:0,icons:{},components:{}},layoutReadEpoch=0,layoutReady=false,layoutError=null,effectiveLayouts=new Map(),layoutOccupied=[];
    const scope=()=>({runtimeGeneration:context.runtimeGeneration,sessionId:snapshot.sessionId,revision:snapshot.revision});
    const diagnose=code=>{lastError={code};};
    function resolveResource(path){
      if(disposed||typeof path!=='string'||!inventory.has(path)||path.startsWith('/')||path.includes('\\')||path.split('/').some(s=>!s||s==='.'||s==='..')||/[\u0000-\u001f:%#]/.test(path))throw failure('resourceUnavailable');
      return context.resourceBasePath+path.split('/').map(encodeURIComponent).join('/');
    }
    const frames=(options.createFrameHost||root.DextFrameHost.createFrameHost)({window:options.window||root,document,initialSnapshot:snapshot,runtimeGeneration:context.runtimeGeneration,
      initialGeometry:{geometryVersion:0,viewport:options.getViewport()},initialPlaybackSuspended:privatePaused,viewKind:context.viewKind,resolveResource,readCapabilities:q=>native.readCapabilities(q),
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
      if(dockView)return stage==="desktop"&&definition.consumerId==="component."+room.dockComponentId&&desks.get(activeDesk()).components.includes(room.dockComponentId);
      if(definition.consumerId==='slot.start')return stage==='starting';if(definition.consumerId==='slot.idle')return stage==='idle';
      if(stage==='starting'&&room.start||stage==='idle'&&room.idle)return false;
      if(definition.consumerId==='scene')return true;
      if(definition.consumerId.startsWith('slot.background.'))return [snapshot.currentDeskId,snapshot.targetDeskId].includes(definition.consumerId.slice(16));
      const component=definition.consumerId.slice(10);return [snapshot.currentDeskId,snapshot.targetDeskId].filter(Boolean).some(id=>desks.get(id).components.includes(component));
    }
    function classification(definition){
      if(dockView||!snapshot.targetDeskId)return'shared';
      if(definition.consumerId.startsWith('slot.background.'))return definition.consumerId.slice(16)===snapshot.targetDeskId?'target':'source';
      if(!definition.consumerId.startsWith('component.'))return'shared';
      const id=definition.consumerId.slice(10),source=desks.get(snapshot.currentDeskId).components.includes(id),target=desks.get(snapshot.targetDeskId).components.includes(id);
      return source&&target?'shared':target?'target':'source';
    }
    function recomputeLayouts(state){
      const next=new Map();
      if(dockView){effectiveLayouts=next;return;}
      for(const deskId of [snapshot.currentDeskId,snapshot.targetDeskId].filter(Boolean)){
        const items=layoutModel.projectDeskItems({manifest:room,layout:personalLayout,deskId});
        for(const record of icons.values())if(record.desktop&&record.deskId===deskId)items.push({key:'icon:'+deskId+'/'+record.icon.id,kind:'icon',id:record.icon.id,
          savedRect:record.desktopRect,logicalSize:{width:96,height:104}});
        // Dock geometry belongs to the official host. A component author can
        // publish its buttons, while only roomScene can publish occupied areas.
        const referenced=new Set(desks.get(deskId).components);
        const dockAreas=(room.components||[]).filter(component=>component.role==='dock'&&referenced.has(component.id))
          .map(component=>({id:'dock.'+component.id,deskId,...component.placement}));
        for(const item of layoutModel.resolveDeskLayout({items,viewport:state.viewport,occupied:[...layoutOccupied,...dockAreas],deskId}))next.set(item.key,item);
      }
      effectiveLayouts=next;
    }
    function recordPlacement(record){
      const definition=record.definition,author=definition.placement||{x:0,y:0,width:1920,height:1080};
      if(dockView&&definition.kind==="dock")return{x:0,y:0,width:1920,height:1080};
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
    function reconcileDesktop(viewport){
      if(dockView)return;
      const columns=Math.max(1,Math.floor((viewport.width-64)/112)),rows=Math.max(1,Math.floor((viewport.height-64)/120)),capacity=Math.max(1,columns*rows-2);
      desktopPages=Math.max(1,Math.ceil(((desktopView?.items.reduce((max,item)=>Math.max(max,item.slot),-1)??-1)+1)/capacity));desktopPage=Math.min(desktopPage,desktopPages-1);
      const signature=desktopView?[desktopView.contextId,desktopPage,viewport.width,viewport.height].join('/'):'none';
      if(signature===desktopSignature)return;desktopSignature=signature;
      for(const [key,record]of [...icons])if(record.desktop){record.element.remove();icons.delete(key);}
      if(!desktopView||!desks.has(desktopView.deskId))return;
      const items=desktopView.items.filter(item=>Math.floor(item.slot/capacity)===desktopPage).sort((a,b)=>a.slot-b.slot).map(item=>({...item,cell:item.slot%capacity}));
      if(desktopPages>1)items.push({id:'desktop.page.previous',name:'上一组 '+(desktopPage+1)+'/'+desktopPages,iconPng:null,cell:capacity},{id:'desktop.page.next',name:'下一组',iconPng:null,cell:capacity+1});
      items.forEach(item=>{
        const index=item.cell;
        const element=document.createElement('button');element.type='button';element.className='dext-v3-icon dext-v3-desktop-icon';element.setAttribute('aria-label',item.name);
        if(item.iconPng){const image=document.createElement('img');image.src='data:image/png;base64,'+item.iconPng;image.alt='';image.draggable=false;element.append(image);}
        else{const glyph=document.createElement('span');glyph.className='dext-v3-desktop-glyph';glyph.textContent=item.id==='desktop.page.previous'?'←':item.id==='desktop.page.next'?'→':item.kind==='folder'?'▣':'◇';element.append(glyph);}
        const label=document.createElement('span');label.className='dext-v3-desktop-label';label.textContent=item.name;element.append(label);rootNode.append(element);
        const icon={id:item.id,buttonId:item.id},deskId=desktopView.deskId;
        icons.set('desktop/'+item.id,{deskId,icon,element,desktop:true,contextId:desktopView.contextId,
          desktopRect:{x:(32+(index%columns)*112)*1920/viewport.width,y:(32+Math.floor(index/columns)*120)*1080/viewport.height,width:96,height:104}});
      });
    }
    function reconcile(){
      ensureRoot();const state=model.readDiagnostics();const viewport=state.viewport;
      rootNode.style.transform='scale('+(viewport.width/1920)+','+(viewport.height/1080)+')';reconcileDesktop(viewport);recomputeLayouts(state);
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
      if(!dockView)for(const desk of room.desks)for(const icon of desk.icons){
        const key=desk.id+'\0'+icon.id;let record=icons.get(key);
        if(!record){const element=document.createElement('button');element.className='dext-v3-icon';element.type='button';element.textContent=(icon.glyph||'◇')+'\n'+(icon.label||icon.id);element.setAttribute('aria-label',icon.label||icon.id);
          // Core native completion owns official activation; DOM click alone has no authority.
          rootNode.append(element);record={deskId:desk.id,icon,element};icons.set(key,record);}
        record.element.dataset.skin=presentationSkins[icon.buttonId]||'classic';
        const group=visualGroups[snapshot.targetDeskId?(desk.id===snapshot.targetDeskId?'target':'source'):'source'];layoutIcon(record,group);
      }
      for(const record of icons.values())if(record.desktop)layoutIcon(record,visualGroups[snapshot.targetDeskId?(record.deskId===snapshot.targetDeskId?'target':'source'):'source']);
      const placements=Object.fromEntries([...records.values()].filter(record=>
        record.definition.consumerId.startsWith('component.')&&visible(record.definition)).map(record=>[record.definition.consumerId,copy(recordPlacement(record))]));
      media.refresh();frames.setGeometry({geometryVersion:state.geometryVersion,viewport:state.viewport,placements});
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
      const pieces=geometry.visiblePolygons(geometry.rectPolygon(rect,node.group.matrix),{bounds:{x:0,y:0,width:1920,height:1080},occluders:[...front.map(other=>other.polygon),...(dockView&&taskAreaOcclusion?[geometry.rectPolygon(taskAreaOcclusion)]:[]),...(dockView?[geometry.rectPolygon({x:1920-36/model.readDiagnostics().viewport.width*1920,y:0,width:36/model.readDiagnostics().viewport.width*1920,height:32/model.readDiagnostics().viewport.height*1080})]:[])]});
      if(!pieces.length)return null;
      if(pieces.length>64||pieces.some(p=>p.length>32))throw failure('geometryBudget');
      const polygons=pieces.map(p=>p.map(v=>({x:v.x/1920,y:v.y/1080}))),points=polygons.flat();
      const x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y)),right=Math.max(...points.map(p=>p.x)),bottom=Math.max(...points.map(p=>p.y));
      return{consumer,button,entryId,x,y,width:right-x,height:bottom-y,tabIndex,polygons};
    }
    function buttonGeometry(sampled=false){
      if(privatePaused||!snapshot.active||snapshot.lifecycle.locked||dockView&&snapshot.lifecycle.stage!=="desktop"||
        !dockView&&(snapshot.lifecycle.stage==="desktop"&&!snapshot.operable||snapshot.lifecycle.playbackPaused))return[];
      return visibleButtonGeometry(sampled);
    }
    function visibleButtonGeometry(sampled=false){
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
        if(record.desktop&&snapshot.transitionId)continue;
        const node=nodes.find(n=>n.record===record);if(node)add(preciseEntry(record.desktop?'official.desktop':'official',record.icon.buttonId,record.desktop?'desktop.'+record.contextId+'/'+record.icon.id:'icon.'+record.deskId+'/'+record.icon.id,record.rect,node,nodes,buttons.length,sampled));
      }
      return buttons.sort((a,b)=>inputLayer(nodes.find(n=>n.record.definition?.consumerId===b.consumer||['official','official.desktop'].includes(b.consumer)&&n.record.icon).record)-inputLayer(nodes.find(n=>n.record.definition?.consumerId===a.consumer||['official','official.desktop'].includes(a.consumer)&&n.record.icon).record));
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
            published=await native.request('geometry',{geometryVersion:++inputVersion,viewport:state.viewport,buttons:entries,eventSamples:dockView&&taskAreaOcclusion!==null},ownScope);
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
      if(dockView){if(frameId!==null)cancel(frameId);frameId=null;animation=null;visualGroups=groups();return;}
      if(!snapshot.transitionId){if(frameId!==null)cancel(frameId);frameId=null;animation=null;return;}
      if(!animation||animation.id!==snapshot.transitionId){if(frameId!==null)cancel(frameId);frameId=null;animation={id:snapshot.transitionId,session:snapshot.sessionId,elapsed:0,last:now(),finished:false};}
      updateDefaultGroups();schedule();
    }
    function defaultMoving(){return !!snapshot.transitionId&&(room.transition?.type||'slide')!=='author'&&!animation?.finished;}
    function transform(element,x,y,m,sx=1,sy=1){element.style.transform='matrix('+[m[0]*sx,m[1]*sx,m[2]*sy,m[3]*sy,m[4]+(m[0]-1)*x+m[2]*y,m[5]+m[1]*x+(m[3]-1)*y].join(',')+')';}
    function updateDefaultGroups(){
      const transition=room.transition||{type:'slide',durationMs:450};if(!animation||transition.type==='author')return null;
      const p=transition.durationMs===0?1:Math.min(1,animation.elapsed/transition.durationMs);visualGroups=groups();
      if(transition.type==='slide'){const from=room.desks.findIndex(d=>d.id===snapshot.currentDeskId),to=room.desks.findIndex(d=>d.id===snapshot.targetDeskId),count=room.desks.length;const direction=count>2&&from===count-1&&to===0?1:count>2&&from===0&&to===count-1?-1:to>from?1:-1;visualGroups.source.matrix[4]=-direction*1920*p;visualGroups.target.matrix[4]=direction*1920*(1-p);}
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
    let actionNotice=null,actionNoticeTimer=null;
    function clearActionNotice(){
      if(actionNoticeTimer!==null)cancelTimer(actionNoticeTimer);actionNoticeTimer=null;
      actionNotice?.remove();actionNotice=null;
    }
    function showActionResult(status){
      const messages={missingBinding:'这个按钮还未绑定应用，请在配置器的“本机按钮”中选择目标。',
        missingPermission:'这个按钮尚未启用，请重新应用 Room 或在配置器中保存本机动作。',
        launchFailed:'应用启动失败，请检查本机绑定目标。',storageUnavailable:'本机按钮配置暂时无法读取，请检查配置器诊断。'};
      if(status==='accepted'||status==='queued'){clearActionNotice();return;}
      if(!messages[status])return;
      clearActionNotice();actionNotice=document.createElement('div');actionNotice.className='dext-v3-action-notice';
      actionNotice.setAttribute('role','status');actionNotice.textContent=messages[status];container.append(actionNotice);
      actionNoticeTimer=later(clearActionNotice,5000);
    }
    let dropRunning=false;
    function dropEligible(event){
      return !disposed&&!dockView&&!dropRunning&&event.isTrusted===true&&typeof native.dropFiles==='function'&&
        snapshot.active&&snapshot.lifecycle?.stage==='desktop'&&!snapshot.lifecycle?.locked&&!snapshot.transitionId&&
        desktopView?.deskId===snapshot.currentDeskId&&Array.from(event.dataTransfer?.types||[]).includes('Files');
    }
    function dropIntent(event){
      const allowed={all:['copy','move','link'],uninitialized:['copy','move','link'],copy:['copy'],move:['move'],link:['link'],copyMove:['copy','move'],copyLink:['copy','link'],linkMove:['link','move']}[event.dataTransfer.effectAllowed]||[];
      const requested=event.altKey||event.ctrlKey&&event.shiftKey?'link':event.ctrlKey?'copy':event.shiftKey?'move':null;
      return requested?(allowed.includes(requested)?requested:'none'):
        allowed.includes(event.dataTransfer.dropEffect)?event.dataTransfer.dropEffect:allowed[0]||'none';
    }
    function desktopDragOver(event){
      if(!Array.from(event.dataTransfer?.types||[]).includes('Files'))return;
      event.preventDefault();event.stopPropagation();event.dataTransfer.dropEffect=dropEligible(event)?dropIntent(event):'none';
    }
    function dropNotice(message){
      clearActionNotice();actionNotice=document.createElement('div');actionNotice.className='dext-v3-action-notice';
      actionNotice.setAttribute('role','status');actionNotice.textContent=message;container.append(actionNotice);
      actionNoticeTimer=later(clearActionNotice,7000);
    }
    function desktopDrop(event){
      if(!Array.from(event.dataTransfer?.types||[]).includes('Files'))return;
      event.preventDefault();event.stopPropagation();
      if(!dropEligible(event)){event.dataTransfer.dropEffect='none';return;}
      const transfer=event.dataTransfer,effect=dropIntent(event),files=Array.from(transfer.files||[]),rect=container.getBoundingClientRect();
      // Core owns file movement. Never tell the source to delete files merely
      // because an asynchronous request was posted. Actual OLE return is a probe gate.
      transfer.dropEffect='none';
      if(effect==='none'||files.length===0||files.length>256||rect.width<=0||rect.height<=0)return;
      const x=(event.clientX-rect.left)/rect.width,y=(event.clientY-rect.top)/rect.height;
      if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>1||y<0||y>1)return;
      const identity=scope(),params={desktopContextId:desktopView.contextId,deskId:desktopView.deskId,x,y,page:desktopPage,
        modifiers:(event.ctrlKey?1:0)|(event.shiftKey?2:0)|(event.altKey?4:0),allowedEffects:transfer.effectAllowed};
      dropRunning=true;dropNotice('正在处理拖入的文件…');
      let operation;
      try{operation=native.dropFiles(params,files,identity);}catch(error){operation=Promise.reject(error);}
      Promise.resolve(operation).then(reply=>{
        if(disposed||identity.sessionId!==snapshot.sessionId)return;
        const items=Array.isArray(reply?.data?.items)?reply.data.items:[],completed=items.filter(item=>item.status==='completed').length;
        dropNotice(reply?.status==='accepted'?`已完成 ${completed} 项，未处理 ${items.length-completed} 项。${reply.data?.placementStatus&&reply.data.placementStatus!=='accepted'?'文件已处理，图标位置未保存。':''}`:
          reply?.status==='cancelled'?`操作已取消，已完成 ${completed} 项。`:'未能完成拖入，请检查目标桌面或稍后重试。');
      },()=>{if(!disposed)dropNotice('未收到操作结果，请先检查桌面文件，避免重复拖入。');}).finally(()=>{dropRunning=false;});
    }
    if(!dockView){container.addEventListener('dragover',desktopDragOver);container.addEventListener('drop',desktopDrop);}
    function consumeReceipt(reply){
      showActionResult(reply.status);
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
        .then(reply=>{if(sameActionScope(own.identity,own.geometryVersion)){
          consumeReceipt(reply);
          if(reply.status==='accepted'&&own.consumer==='official.desktop'&&['desktop.page.previous','desktop.page.next'].includes(own.button)){
            desktopPage=(desktopPage+(own.button==='desktop.page.next'?1:-1)+desktopPages)%desktopPages;render();
          }
        }},()=>diagnose('activationUnavailable'));
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
      if(dockView){layoutReady=true;layoutError=null;return render();}
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

    function clearLocator(){
      if(locatorTimer!==null)cancelTimer(locatorTimer);locatorTimer=null;locatorButton=null;
      locatorNode?.remove();locatorNode=null;
    }
    function paintLocator(button){
      clearLocator();if(privatePaused||snapshot.lifecycle.stage!=='desktop')return;
      const entries=visibleButtonGeometry(true).filter(entry=>entry.button===button);
      if(!entries.length)return;
      locatorButton=button;locatorNode=document.createElementNS('http://www.w3.org/2000/svg','svg');locatorNode.setAttribute('class','dext-v3-locator');locatorNode.setAttribute('viewBox','0 0 1920 1080');rootNode.append(locatorNode);
      for(const entry of entries)for(const polygon of entry.polygons){const path=document.createElementNS('http://www.w3.org/2000/svg','polygon');path.setAttribute('points',polygon.map(p=>p.x*1920+','+p.y*1080).join(' '));locatorNode.append(path);}
      locatorTimer=later(clearLocator,2500);
    }
    async function refreshPresentation(){
      if(disposed||presentationRunning)return;presentationRunning=true;
      const identity=scope();
      try{
        const reply=await native.request('presentationRead',desktopView?{desktopContextId:desktopView.contextId}:{},identity);
        if(disposed||identity.sessionId!==snapshot.sessionId||identity.revision!==snapshot.revision)return;
        if(reply.status==='accepted'&&reply.presentation){
          presentationSkins=copy(reply.presentation.skins);
          const before=desktopView?.contextId,beforeDesk=desktopView?.deskId,desktop=reply.presentation.desktop;
          if(!desktop)desktopView=null;
          else if(desktop.items!==null)desktopView=copy(desktop);
          else if(desktopView?.contextId!==desktop.contextId||desktopView?.deskId!==desktop.deskId)desktopView=null;
          if(before!==desktopView?.contextId){if(beforeDesk!==desktopView?.deskId)desktopPage=0;await render();}
          for(const record of icons.values())record.element.dataset.skin=presentationSkins[record.icon.buttonId]||'classic';
          const locator=reply.presentation.locator;
          if(locator&&locator.requestId!==locatorRequest){locatorRequest=locator.requestId;paintLocator(locator.buttonId);}
          if(!locator&&locatorButton)clearLocator();
        }
      }catch(_){/* Optional presentation metadata never delays layout or input. */}
      finally{presentationRunning=false;if(!disposed)presentationTimer=later(refreshPresentation,750);}
    }

    function acceptSnapshot(next){
      if(disposed)return Promise.resolve(false);const accepted=model.acceptSnapshot(next);if(!accepted.accepted)return Promise.resolve(false);
      clearLocator();snapshot=copy(next);visualGroups=model.readDiagnostics().groups;
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
    if(!dockView)ready.then(()=>refreshPresentation());
    return Object.freeze({ready,acceptSnapshot,publishGeometry,resolveResource,
      async setTaskAreaOcclusion(value){
        if(disposed||!dockView)return false;
        if(value!==null&&(!value||![value.x,value.y,value.width,value.height].every(Number.isFinite)||value.x<0||value.y<0||value.width<=0||value.height<=0||value.x+value.width>1920||value.y+value.height>1080))return false;
        const next=value===null?null:{x:value.x,y:value.y,width:value.width,height:value.height};
        const requested=JSON.stringify(next),revision=snapshot.revision;
        if(requested===JSON.stringify(taskAreaOcclusion)&&inputReady)return true;
        taskAreaOcclusion=next;let pending=render();
        // Resume layout and author geometry can supersede this render. Their
        // publication still includes this exact region; wait for its real ack.
        for(;;){
          const confirmed=await pending;
          if(disposed||privatePaused||snapshot.revision!==revision||requested!==JSON.stringify(taskAreaOcclusion))return false;
          if(pending===serial)return confirmed&&inputReady;
          pending=serial;
        }
      },
      refreshGeometry(){return disposed?Promise.resolve(false):render();},
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
        if(value){clearLocator();layoutReadEpoch++;layoutReady=false;clearDefault();clearFocus();inputEntries=[];completion=null;privatePaused=true;releaseNativeHold(false);inputReady=false;if(frameId!==null)cancel(frameId);frameId=null;media.setPlaybackSuspended(true);frames.setPlaybackSuspended(true);native.setSuspended(true);for(const record of records.values())if(record.watch){record.watch();record.watch=null;}}
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
          const own={...completion,identity:scope(),due:['official','official.desktop'].includes(value.consumer)};pendingDefault=own;
          if(own.due)runDefault();else defaultTimer=later(()=>{if(pendingDefault===own){own.due=true;runDefault();}},100);
          return true;
        }return false;},
      dispose(){if(disposed)return;disposed=true;container.removeEventListener('dragover',desktopDragOver);container.removeEventListener('drop',desktopDrop);clearActionNotice();if(presentationTimer!==null)cancelTimer(presentationTimer);clearLocator();releaseNativeHold(false);epoch++;layoutReadEpoch++;cancelWaits();clearDefault();clearFocus();inputEntries=[];completion=null;inputReady=false;if(frameId!==null)cancel(frameId);frameId=null;for(const record of records.values())record.watch?.();frames.dispose();media.dispose();native.dispose();model.dispose();records.clear();icons.clear();localButtons.clear();effectiveLayouts.clear();rootNode?.remove();},
      readDiagnostics(){const state=model.readDiagnostics();return{...state,inputReady,inputVersion,disposed,presentation:{skins:copy(presentationSkins),locator:locatorButton,desktop:desktopView?{contextId:desktopView.contextId,deskId:desktopView.deskId,count:desktopView.items.length}:null},focus:focus&&{...focus},layout:{revision:personalLayout.revision,ready:layoutReady,error:layoutError,items:copy([...effectiveLayouts.values()])},lastError:lastError&&{...lastError},transition:animation&&{id:animation.id,elapsed:animation.elapsed,finished:animation.finished},frames:frames.readDiagnostics(),media:media.readDiagnostics()};}
    });
  }
  return Object.freeze({createDomHost});
});
