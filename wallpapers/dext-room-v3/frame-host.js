(function(root,factory){
  'use strict';const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.DextFrameHost=api;
})(globalThis,function(root){
  'use strict';
  const CAPS=new Set(['desk.read','desk.navigate','time.read','hardware.read','media.read','media.control','audio.read','audio.control','storage.read','storage.write','binding.launch','dext.exit']);
  const DATA=new Set(['time.read','hardware.read','media.read','audio.read']);
  const CHANNELS=new Set(['desk','lifecycle','config','capabilities','geometry']);
  const ERRORS=new Set(['denied','expiredInput','unsupported','notOperable','staleSession','staleInput','storageUnavailable','inputRequired','invalidArgument','unknownConsumer','forbidden','missingPermission','invalidButton','missingBinding','launchFailed','requiresConfirmation','timeout','controlUnavailable','rateLimited']);
  const READS=new Set(['desk.get','storage.get']);
  const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
  const text=(value,limit=160)=>typeof value==='string'&&value.length>0&&value.length<=limit&&!/[\u0000-\u001f]/.test(value);
  const id=value=>typeof value==='string'&&/^[A-Za-z0-9_.-]{1,80}$/.test(value);
  const shape=(value,fields)=>object(value)&&Object.keys(value).length===fields.length&&fields.every(key=>Object.hasOwn(value,key));
  function failure(code){const error=new Error('Dext frame: '+code);error.code=code;return error;}
  function wire(value){
    const seen=new Set();
    function inspect(part,depth){
      if(depth>24)throw failure('payloadTooDeep');
      if(part===null||typeof part==='string'||typeof part==='boolean')return;
      if(typeof part==='number'&&Number.isFinite(part))return;
      if(!object(part)&&!Array.isArray(part))throw failure('invalidPayload');
      if(seen.has(part))throw failure('invalidPayload');seen.add(part);
      const values=Object.values(part);if(values.length>4096)throw failure('payloadTooLarge');
      for(const child of values)inspect(child,depth+1);seen.delete(part);
    }
    inspect(value,0);const json=JSON.stringify(value);
    if(new root.TextEncoder().encode(json).length>32768)throw failure('payloadTooLarge');return JSON.parse(json);
  }
  function snapshotValid(value){
    const life=value?.lifecycle;
    return object(value)&&value.protocolVersion===1&&text(value.sessionId,128)&&text(value.roomId,128)&&text(value.installationStamp,128)&&
      Number.isSafeInteger(value.revision)&&value.revision>0&&id(value.currentDeskId)&&[value.targetDeskId,value.queuedDeskId].every(v=>v===null||id(v))&&
      (value.targetDeskId===null?value.transitionId===null&&value.deadlineUtc===null:text(value.transitionId,128)&&typeof value.deadlineUtc==='string'&&Number.isFinite(Date.parse(value.deadlineUtc)))&&
      typeof value.active==='boolean'&&typeof value.operable==='boolean'&&object(life)&&['starting','desktop','idle'].includes(life.stage)&&
      typeof life.playbackPaused==='boolean'&&typeof life.locked==='boolean'&&Number.isSafeInteger(life.revision)&&life.revision>=0;
  }
  function geometryValid(value){return object(value)&&Number.isSafeInteger(value.geometryVersion)&&value.geometryVersion>=0&&object(value.viewport)&&
    ['width','height'].every(key=>Number.isFinite(value.viewport[key])&&value.viewport[key]>=64&&value.viewport[key]<=16384)&&
    Number.isFinite(value.viewport.dpr)&&value.viewport.dpr>=.5&&value.viewport.dpr<=8;}
  function createFrameHost(options){
    if(!snapshotValid(options.initialSnapshot)||!geometryValid(options.initialGeometry)||!Number.isSafeInteger(options.runtimeGeneration)||options.runtimeGeneration<1||
      typeof options.readCapabilities!=='function'||typeof options.resolveResource!=='function')throw failure('missingBridge');
    const window=options.window||root,document=options.document||root.document;
    const later=options.setTimeout||root.setTimeout.bind(root),cancel=options.clearTimeout||root.clearTimeout.bind(root);
    const token=options.randomToken||(()=>root.crypto.randomUUID());
    const implemented=new Set((options.implementedCapabilities||[]).filter(capability=>CAPS.has(capability)));
    let snapshot=wire(options.initialSnapshot),geometry=wire(options.initialGeometry),generation=options.runtimeGeneration,disposed=false,lastError=null,playbackSuspended=options.initialPlaybackSuspended===true;
    const records=new Map();
    const diagnose=code=>{lastError={code};};
    const alive=record=>!disposed&&!record.disposed&&records.get(record.instanceId)===record;
    const identity=()=>Object.freeze({sessionId:snapshot.sessionId,revision:snapshot.revision,runtimeGeneration:generation});
    const sameScope=scope=>scope.sessionId===snapshot.sessionId&&scope.revision===snapshot.revision&&scope.runtimeGeneration===generation;
    function active(record){
      const stage=record.consumerId==='slot.start'?'starting':record.consumerId==='slot.idle'?'idle':'desktop';
      return alive(record)&&!playbackSuspended&&!record.docDisposed&&record.state==='active'&&snapshot.active&&snapshot.lifecycle.stage===stage&&!snapshot.lifecycle.playbackPaused&&!snapshot.lifecycle.locked;
    }
    function envelope(record,type){return{type,apiVersion:1,instanceId:record.instanceId,sessionId:snapshot.sessionId,token:record.token};}
    function send(record,value){
      if(!alive(record)||!record.token)return false;
      try{record.frame.contentWindow.postMessage(wire(value),'*');return true;}catch(error){diagnose(error.code||'transportUnavailable');return false;}
    }
    function event(record,name,payload){
      if(!record.initialized||record.docDisposed)return;
      const channel=name==='data'?'data:'+payload.capability:name;
      const sequence=(record.sequences.get(channel)||0)+1;record.sequences.set(channel,sequence);
      send(record,{...envelope(record,'dext:runtime:event'),event:name,payload,sequence});
    }
    function closeProvider(record,capability){
      const provider=record.providers.get(capability);if(!provider)return;record.providers.delete(capability);
      try{provider.unsubscribe?.();}catch(_){diagnose('subscriptionUnavailable');}
    }
    function stopSources(record){for(const capability of [...record.providers.keys()])closeProvider(record,capability);}
    function startSources(record){
      if(!active(record)||!record.initialized)return;
      for(const channel of record.channels){
        if(!channel.startsWith('data:'))continue;const capability=channel.slice(5);
        if(record.capabilities[capability]!=='available'||record.providers.has(capability)||typeof options.subscribeData!=='function')continue;
        const provider={epoch:record.epoch,scope:identity(),unsubscribe:null};record.providers.set(capability,provider);
        // The Core adapter reauthorizes every value. Capability metadata is not
        // authority to forward cached privileged data after a private grant edit.
        const emit=state=>{
          if(!alive(record)||record.providers.get(capability)!==provider||provider.epoch!==record.epoch||!sameScope(provider.scope)||!active(record)||record.capabilities[capability]!=='available')return;
          try{
            if(!object(state)||!['available','missing','denied','unsupported','error'].includes(state.status)||state.status==='available'&&!Object.hasOwn(state,'value'))return;
            event(record,'data',{capability,state:wire(state.status==='available'?{status:state.status,value:state.value}:{status:state.status})});
          }catch(error){diagnose(error.code||'invalidPayload');event(record,'data',{capability,state:{status:'error'}});}
        };
        try{
          Promise.resolve(options.subscribeData({consumerId:record.consumerId,capability,identity:provider.scope},emit)).then(unsubscribe=>{
            if(typeof unsubscribe!=='function')return;
            if(record.providers.get(capability)!==provider){try{unsubscribe();}catch(_){diagnose('subscriptionUnavailable');}}
            else provider.unsubscribe=unsubscribe;
          },()=>{if(record.providers.get(capability)===provider){emit({status:'error'});closeProvider(record,capability);}});
        }catch(_){emit({status:'error'});closeProvider(record,capability);}
      }
    }
    function setCapabilities(record,value){
      const changed=JSON.stringify(record.capabilities)!==JSON.stringify(value);record.capabilities=value;
      for(const capability of [...record.providers.keys()])if(value[capability]!=='available')closeProvider(record,capability);
      if(changed)event(record,'capabilities',value);startSources(record);
    }
    function permissionView(record,reply){return Object.fromEntries(record.declared.map(capability=>[capability,
      active(record)&&reply?.status==='accepted'&&reply.capabilities?.[capability]==='accepted'
        ?implemented.has(capability)&&(!DATA.has(capability)||typeof options.subscribeData==='function')?'available':'unsupported':'denied']));}
    function initialize(record){
      if(!alive(record)||record.docDisposed||record.initialized)return;
      record.initialized=true;
      if(!send(record,{...envelope(record,'dext:runtime:init'),consumerId:record.consumerId,kind:record.kind,capabilities:record.capabilities,
          config:record.config,viewport:geometry.viewport,geometryVersion:geometry.geometryVersion,snapshot})){record.initialized=false;return;}
      startSources(record);
    }
    function refreshPermissions(record){
      if(!alive(record)||!record.token||record.docDisposed)return;
      const epoch=record.epoch,query=++record.query,scope=identity();
      if(record.permissionTimer!==null)cancel(record.permissionTimer);
      let completed=false;
      const current=()=>!completed&&alive(record)&&record.epoch===epoch&&record.query===query&&!record.docDisposed&&sameScope(scope);
      const finish=reply=>{
        if(!current())return;
        completed=true;cancel(record.permissionTimer);record.permissionTimer=null;
        setCapabilities(record,permissionView(record,reply));initialize(record);
      };
      if(playbackSuspended){finish(null);return;}
      const fail=()=>{if(!current())return;diagnose('permissionsUnavailable');finish(null);};
      record.permissionTimer=later(fail,5000);
      try{Promise.resolve(options.readCapabilities({consumerId:record.consumerId,identity:scope})).then(finish,fail);}
      catch(_){fail();}
    }
    function applyState(record){
      const state=active(record)?'active':'suspended';record.frame.inert=state!=='active';record.frame.setAttribute('aria-hidden',state==='active'?'false':'true');
      try{options.applyState?.(record.frame,{consumerId:record.consumerId,instanceId:record.instanceId,state,identity:identity()});}catch(_){diagnose('frameStateUnavailable');}
      if(state==='suspended'){stopSources(record);setCapabilities(record,permissionView(record,null));}
    }
    function reply(record,requestId,ok,value){send(record,{...envelope(record,'dext:runtime:response'),requestId,ok,...(ok?{result:value??null}:{error:{code:value}})});}
    function endRequest(record,item,ok,value){
      if(!alive(record)||record.epoch!==item.epoch||record.pending.get(item.requestId)!==item)return;
      record.pending.delete(item.requestId);cancel(item.timer);
      if(ok&&READS.has(item.method)&&!sameScope(item.scope)){ok=false;value='staleInput';}
      if(ok){try{value=wire(value??null);}catch(error){ok=false;value=error.code||'invalidPayload';}}
      reply(record,item.requestId,ok,value);
    }
    function clearRequests(record,code){for(const item of [...record.pending.values()]){cancel(item.timer);if(!record.disposed)reply(record,item.requestId,false,code);}record.pending.clear();}
    function closeDocument(record,notify=false){
      stopSources(record);clearRequests(record,'disposed');record.query++;
      if(record.permissionTimer!==null){cancel(record.permissionTimer);record.permissionTimer=null;}
      if(notify&&record.initialized)send(record,envelope(record,'dext:runtime:dispose'));
      record.channels.clear();record.docDisposed=true;record.initialized=false;record.ready=false;applyState(record);
    }
    function parameters(record,method,params){
      switch(method){
        case'desk.get':case'actions.list':case'scene.done':return shape(params,[]);
        case'actions.activate':return shape(params,['buttonId'])&&id(params.buttonId);
        case'desk.navigate':return shape(params,['action'])&&object(params.action)&&
          (['desk.next','desk.previous'].includes(params.action.type)?shape(params.action,['type']):params.action.type==='desk.go'&&shape(params.action,['type','deskId'])&&id(params.action.deskId));
        case'storage.get':return shape(params,['key'])&&id(params.key);
        case'storage.set':return shape(params,['key','value'])&&id(params.key);
        case'media.control':return shape(params,['action'])&&['play','pause','toggle','next','previous'].includes(params.action);
        case'audio.control':return shape(params,['settings'])&&object(params.settings)&&Object.keys(params.settings).length>0&&Object.keys(params.settings).every(key=>['volume','muted'].includes(key))&&
          (params.settings.volume===undefined||typeof params.settings.volume==='number'&&Number.isFinite(params.settings.volume)&&params.settings.volume>=0&&params.settings.volume<=1)&&
          (params.settings.muted===undefined||typeof params.settings.muted==='boolean');
        case'scene.completeTransition':return shape(params,['transitionId'])&&text(params.transitionId,128);
        case'scene.publishGeometry':return shape(params,['report'])&&object(params.report)&&Object.keys(params.report).every(key=>['sessionId','revision','transitionId','geometryVersion','groups','occupied','buttons'].includes(key))&&
          ['sessionId','revision','transitionId','geometryVersion'].every(key=>Object.hasOwn(params.report,key));
        default:return null;
      }
    }
    function request(record,message){
      if(!/^r[1-9][0-9]{0,15}$/.test(message.requestId))return;const number=Number(message.requestId.slice(1));
      if(!Number.isSafeInteger(number)||number<=record.lastRequest)return;record.lastRequest=number;
      const valid=parameters(record,message.method,message.params);
      if(valid===null){reply(record,message.requestId,false,'unsupported');return;}if(!valid){reply(record,message.requestId,false,'invalidArgument');return;}
      if(!active(record)){reply(record,message.requestId,false,'notOperable');return;}
      if(message.method==='actions.activate'&&!record.buttons.has(message.params.buttonId)){reply(record,message.requestId,false,'invalidButton');return;}
      const needed={'desk.get':'desk.read','desk.navigate':'desk.navigate','storage.get':'storage.read','storage.set':'storage.write','media.control':'media.control','audio.control':'audio.control'}[message.method];
      if(needed&&!record.declared.includes(needed)){reply(record,message.requestId,false,'undeclaredCapability');return;}
      if(needed&&record.capabilities[needed]!=='available'){reply(record,message.requestId,false,record.capabilities[needed]==='unsupported'?'unsupported':'denied');return;}
      if(message.method==='scene.done'&&(record.consumerId!=='slot.start'||snapshot.lifecycle.stage!=='starting')){reply(record,message.requestId,false,'forbidden');return;}
      if(message.method==='scene.completeTransition'&&(record.consumerId!=='scene'||message.params.transitionId!==snapshot.transitionId)){reply(record,message.requestId,false,'staleInput');return;}
      if(message.method==='scene.publishGeometry'){
        const report=message.params.report;
        if(report.sessionId!==snapshot.sessionId||report.revision!==snapshot.revision||report.transitionId!==snapshot.transitionId||report.geometryVersion!==geometry.geometryVersion){reply(record,message.requestId,false,'staleInput');return;}
        if(record.consumerId!=='scene'&&(Object.hasOwn(report,'groups')||Object.hasOwn(report,'occupied'))){reply(record,message.requestId,false,'forbidden');return;}
      }
      if(record.pending.size>=64){reply(record,message.requestId,false,'requestLimit');return;}
      if(typeof options.invoke!=='function'){reply(record,message.requestId,false,'unsupported');return;}
      const item={requestId:message.requestId,method:message.method,epoch:record.epoch,scope:identity(),timer:null};record.pending.set(item.requestId,item);
      item.timer=later(()=>endRequest(record,item,false,'timeout'),5000);
      try{Promise.resolve(options.invoke({consumerId:record.consumerId,instanceId:record.instanceId,requestId:message.requestId,requestJson:JSON.stringify(message),method:message.method,params:wire(message.params),identity:item.scope})).then(
        value=>endRequest(record,item,true,value),error=>endRequest(record,item,false,ERRORS.has(error?.code)?error.code:'operationFailed'));
      }catch(error){endRequest(record,item,false,ERRORS.has(error?.code)?error.code:'operationFailed');}
    }
    function notify(record,message){
      const params=message.params;
      if(message.method==='ready'&&shape(params,[])){if(!record.ready){record.ready=true;options.onReady?.(record.instanceId);}return;}
      if(message.method==='dispose'&&shape(params,[])){closeDocument(record);return;}
      const match=/^(desk|lifecycle|config|capabilities|geometry|data)\.(subscribe|unsubscribe)$/.exec(message.method);if(!match)return;
      let channel=match[1];
      if(channel==='data'){if(!shape(params,['capability'])||!DATA.has(params.capability)||!record.declared.includes(params.capability))return;channel+=':'+params.capability;}
      else if(!CHANNELS.has(channel)||!shape(params,[]))return;
      if(match[2]==='unsubscribe'){record.channels.delete(channel);if(channel.startsWith('data:'))closeProvider(record,channel.slice(5));return;}
      if(record.channels.has(channel))return;record.channels.add(channel);
      if(channel.startsWith('data:'))startSources(record);
      else event(record,channel,{desk:snapshot,lifecycle:snapshot.lifecycle,config:record.config,capabilities:record.capabilities,geometry}[channel]);
    }
    function receive(event){
      if(disposed)return;
      const record=[...records.values()].find(record=>record.frame.contentWindow===event.source);
      if(!record||!record.initialized||record.docDisposed)return;
      try{
        const message=wire(event.data),fields=['type','apiVersion','instanceId','sessionId','token','method','params'];
        if(message.type==='dext:runtime:request')fields.push('requestId');else if(message.type!=='dext:runtime:notify')return;
        if(!shape(message,fields)||message.apiVersion!==1||message.instanceId!==record.instanceId||message.sessionId!==snapshot.sessionId||message.token!==record.token||!text(message.method,80)||!object(message.params))return;
        if(message.type==='dext:runtime:request')request(record,message);else notify(record,message);
      }catch(error){diagnose(error.code||'invalidPayload');}
    }
    window.addEventListener('message',receive);
    function mount(definition,parent){
      if(disposed)throw failure('disposed');if(!text(definition.instanceId)||!text(definition.consumerId,100)||!['scene','widget','dock','html','media'].includes(definition.kind))throw failure('invalidInstance');
      const old=records.get(definition.instanceId);if(old){if(old.consumerId!==definition.consumerId||old.entry!==definition.entry)throw failure('identityConflict');return old.frame;}
      if(records.size>=196)throw failure('instanceLimit');let url;try{url=options.resolveResource(definition.entry);if(!text(url,4096))throw failure('resourceUnavailable');}catch(_){diagnose('resourceUnavailable');throw failure('resourceUnavailable');}
      const declared=[...new Set(definition.capabilities||[])];if(declared.some(capability=>!CAPS.has(capability)))throw failure('invalidInstance');
      const frame=document.createElement('iframe'),record={instanceId:definition.instanceId,consumerId:definition.consumerId,kind:definition.kind,entry:definition.entry,state:definition.state,
        frame,declared,buttons:new Set(definition.buttonIds||[]),config:wire(definition.config||{}),capabilities:{},sequences:new Map(),channels:new Set(),providers:new Map(),pending:new Map(),
        token:null,epoch:0,query:0,permissionTimer:null,lastRequest:0,disposed:false,docDisposed:false,initialized:false,ready:false};
      frame.name='dext-native-'+root.crypto.randomUUID();
      frame.sandbox='allow-scripts';frame.referrerPolicy='no-referrer';frame.tabIndex=-1;frame.title=definition.consumerId;
      record.load=()=>{
        if(!alive(record))return;closeDocument(record);record.epoch++;record.docDisposed=false;record.sequences.clear();record.lastRequest=0;record.token=token();
        if(!text(record.token,256)){record.docDisposed=true;diagnose('transportUnavailable');return;}applyState(record);refreshPermissions(record);
      };
      frame.addEventListener('load',record.load);records.set(record.instanceId,record);applyState(record);frame.src=url;parent.append(frame);return frame;
    }
    function disposeInstance(instanceId){const record=records.get(instanceId);if(!record)return;closeDocument(record,true);record.disposed=true;records.delete(instanceId);record.frame.removeEventListener('load',record.load);record.frame.remove();}
    return Object.freeze({mount,
      setState(instanceId,state){const record=records.get(instanceId);if(!record||!['active','suspended'].includes(state))return false;record.state=state;applyState(record);refreshPermissions(record);return true;},
      setPlaybackSuspended(value){
        if(disposed||typeof value!=='boolean')return false;
        if(value===playbackSuspended)return true;playbackSuspended=value;
        for(const record of records.values()){if(value)clearRequests(record,'notOperable');stopSources(record);applyState(record);refreshPermissions(record);}return true;
      },
      updateConfig(instanceId,config){const record=records.get(instanceId);if(!record||!object(config))return false;try{record.config=wire(config);event(record,'config',record.config);return true;}catch(error){diagnose(error.code||'invalidPayload');return false;}},
      acceptSnapshot(next){
        if(disposed||!snapshotValid(next)||next.sessionId!==snapshot.sessionId||next.roomId!==snapshot.roomId||next.installationStamp!==snapshot.installationStamp||next.revision<=snapshot.revision||next.lifecycle.revision<snapshot.lifecycle.revision)return false;
        try{snapshot=wire(next);}catch(error){diagnose(error.code||'invalidPayload');return false;}
        for(const record of records.values()){stopSources(record);event(record,'desk',snapshot);applyState(record);refreshPermissions(record);}return true;
      },
      setGeometry(next){if(disposed||!geometryValid(next)||next.geometryVersion<=geometry.geometryVersion)return false;geometry=wire(next);for(const record of records.values())event(record,'geometry',geometry);return true;},
      setRuntimeGeneration(next){if(disposed||!Number.isSafeInteger(next)||next<=generation)return false;generation=next;for(const record of records.values()){clearRequests(record,'staleInput');stopSources(record);refreshPermissions(record);}return true;},
      refreshPermissions(instanceId){if(instanceId){const record=records.get(instanceId);if(record)refreshPermissions(record);}else for(const record of records.values())refreshPermissions(record);},
      disposeInstance,
      dispose(){if(disposed)return;for(const id of [...records.keys()])disposeInstance(id);disposed=true;window.removeEventListener('message',receive);},
      readDiagnostics(){return{disposed,count:records.size,lastError:lastError&&{...lastError},instances:[...records.values()].map(record=>({instanceId:record.instanceId,consumerId:record.consumerId,kind:record.kind,state:record.state,
        ready:record.ready,initialized:record.initialized,pendingRequests:record.pending.size,subscriptions:record.channels.size,dataSources:record.providers.size}))};}
    });
  }
  return Object.freeze({createFrameHost});
});
