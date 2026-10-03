(function(root,factory){
  'use strict';const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.DextNativeHost=api;
})(globalThis,function(root){
  'use strict';
  const DATA=new Set(['time.read','hardware.read','media.read','audio.read']);
  const STATUS=new Set(['accepted','denied','forbidden','unknownConsumer','missingPermission','unsupported','notOperable','staleSession','staleInput','storageUnavailable','inputRequired','invalidButton','missingBinding','launchFailed','requiresConfirmation']);
  const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  const id=(v,max=128)=>typeof v==='string'&&v.length>0&&v.length<=max&&!/[\u0000-\u001f]/.test(v);
  const shape=(v,keys)=>object(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
  const integer=(v,min=1,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
  const finite=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
  const scopeValid=v=>shape(v,['runtimeGeneration','sessionId','revision'])&&integer(v.runtimeGeneration)&&integer(v.revision)&&id(v.sessionId);
  const same=(a,b)=>a.runtimeGeneration===b.runtimeGeneration&&a.sessionId===b.sessionId&&a.revision===b.revision;
  function failure(code){const e=new Error('Dext native: '+code);e.code=code;return e;}
  function copy(value,limit=1048576){
    const seen=new Set();function check(v,depth){
      if(depth>24)throw failure('invalidPayload');
      if(v===null||typeof v==='string'||typeof v==='boolean'||typeof v==='number'&&Number.isFinite(v))return;
      if(!object(v)&&!Array.isArray(v)||seen.has(v))throw failure('invalidPayload');
      seen.add(v);const values=Object.values(v);if(values.length>4096)throw failure('invalidPayload');for(const child of values)check(child,depth+1);seen.delete(v);
    }
    check(value,0);const json=JSON.stringify(value);if(new root.TextEncoder().encode(json).length>limit)throw failure('invalidPayload');return JSON.parse(json);
  }
  function paramsValid(method,p){
    switch(method){
      case'capabilities':case'buttons':return shape(p,['consumer'])&&id(p.consumer);
      case'data':return shape(p,['consumer','capability'])&&id(p.consumer)&&DATA.has(p.capability);
      case'invalidateGeometry':return shape(p,[]);
      case'startupComplete':return shape(p,['lifecycleRevision'])&&integer(p.lifecycleRevision);
      case'activate':return shape(p,['consumer','button','geometryVersion'])&&id(p.consumer)&&id(p.button,80)&&integer(p.geometryVersion);
      case'geometry':return shape(p,['geometryVersion','buttons','viewport'])&&integer(p.geometryVersion)&&shape(p.viewport,['width','height','dpr'])&&
        finite(p.viewport.width,64,16384)&&finite(p.viewport.height,64,16384)&&finite(p.viewport.dpr,.5,8)&&Array.isArray(p.buttons)&&p.buttons.length<=4096&&p.buttons.every(b=>
          shape(b,['consumer','button','x','y','width','height','tabIndex'])&&id(b.consumer)&&id(b.button,80)&&finite(b.x,0,1)&&finite(b.y,0,1)&&finite(b.width,Number.EPSILON,1)&&finite(b.height,Number.EPSILON,1)&&
          b.x+b.width<=1&&b.y+b.height<=1&&integer(b.tabIndex,-1,4095));
      default:return false;
    }
  }
  function createNativeHost(options){
    const transport=options.transport;if(!scopeValid(options.initialIdentity)||typeof transport?.postMessage!=='function'||typeof transport.addEventListener!=='function'||typeof transport.removeEventListener!=='function')throw failure('missingBridge');
    const later=options.setTimeout||root.setTimeout.bind(root),cancelTimer=options.clearTimeout||root.clearTimeout.bind(root);
    let identity=copy(options.initialIdentity),counter=0,disposed=false,suspended=options.initialSuspended===true,lastError=null;
    const pending=new Map(),capQueries=new Map(),sources=new Map(),watches=new Map();
    const diagnose=code=>{lastError={code};};
    function dispatch(method,params,scope=identity){
      let entry;
      const promise=new Promise((resolve,reject)=>{
        if(disposed){reject(failure('disposed'));return;}if(suspended){reject(failure('notOperable'));return;}
        if(!scopeValid(scope)||!same(scope,identity)){reject(failure('staleInput'));return;}
        if(!paramsValid(method,params)){reject(failure('invalidArgument'));return;}if(pending.size>=64){reject(failure('requestLimit'));return;}
        const requestId='n'+(++counter);entry={requestId,scope:copy(scope),resolve,reject,timer:null};pending.set(requestId,entry);
        entry.timer=later(()=>finish(entry,false,'timeout'),5000);
        try{transport.postMessage(JSON.stringify(copy({type:'dext:v3-native-request',protocolVersion:1,requestId,method,...scope,...params})));}
        catch(_){finish(entry,false,'transportUnavailable');}
      });
      return{promise,cancel(code='staleInput'){if(entry)finish(entry,false,code);}};
    }
    function finish(entry,ok,value){
      if(pending.get(entry.requestId)!==entry)return;pending.delete(entry.requestId);cancelTimer(entry.timer);
      if(ok)entry.resolve(value);else entry.reject(failure(value));
    }
    function receive(event){
      if(disposed)return;let reply;try{reply=copy(event.data);}catch(_){diagnose('invalidPayload');return;}
      if(reply?.type==='dext:v3-native-event'){
        if(!suspended&&same(reply,identity)&&integer(reply.geometryVersion)&&['focus','activate'].includes(reply.kind)&&
          (reply.consumer===null&&reply.button===null||id(reply.consumer)&&id(reply.button,80))){try{options.onInput?.(reply);}catch(_){diagnose('inputUnavailable');}}return;
      }
      if(reply?.type!=='dext:v3-native-response'||!id(reply.requestId))return;
      const entry=pending.get(reply.requestId);if(!entry||!same(reply,entry.scope)||!same(reply,identity)||!STATUS.has(reply.status))return;
      finish(entry,true,reply);
    }
    transport.addEventListener('message',receive);
    function readCapabilities(query){
      const scope=query.identity||identity,key=JSON.stringify([scope.runtimeGeneration,scope.sessionId,scope.revision,query.consumerId]);
      if(capQueries.has(key))return capQueries.get(key);
      const promise=dispatch('capabilities',{consumer:query.consumerId},scope).promise.finally(()=>{if(capQueries.get(key)===promise)capQueries.delete(key);});capQueries.set(key,promise);return promise;
    }
    function stopSource(source){
      if(!source.alive)return;source.alive=false;if(sources.get(source.key)===source)sources.delete(source.key);
      if(source.timer!==null)cancelTimer(source.timer);source.timer=null;source.flight?.cancel();source.flight=null;source.listeners.clear();
    }
    function dataState(reply){
      if(reply.status!=='accepted')return{status:reply.status==='unsupported'?'unsupported':'denied'};
      const state=reply.data;if(!object(state)||!['available','missing','unsupported','error'].includes(state.status)||state.status==='available'&&!Object.hasOwn(state,'value'))return{status:'error'};
      try{return copy(state.status==='available'?{status:'available',value:state.value}:{status:state.status},32768);}catch(_){return{status:'error'};}
    }
    function sample(source){
      if(!source.alive||disposed||suspended||!same(source.scope,identity))return;
      source.timer=null;source.flight=dispatch('data',{consumer:source.consumer,capability:source.capability},source.scope);
      source.flight.promise.then(reply=>publish(source,dataState(reply)),()=>publish(source,{status:'error'})).finally(()=>{
        source.flight=null;if(source.alive&&!disposed&&!suspended&&same(source.scope,identity))source.timer=later(()=>sample(source),1000);
      });
    }
    function publish(source,state){
      if(!source.alive||disposed||suspended||!same(source.scope,identity))return;
      for(const emit of [...source.listeners]){try{emit(copy(state,32768));}catch(_){diagnose('subscriberUnavailable');}}
      if(state.status==='denied'){try{options.onPermissionChanged?.(source.consumer);}catch(_){diagnose('permissionsUnavailable');}}
    }
    function subscribeData(query,emit){
      if(disposed)throw failure('disposed');if(suspended)throw failure('notOperable');
      if(!scopeValid(query.identity)||!same(query.identity,identity))throw failure('staleInput');if(!DATA.has(query.capability)||!id(query.consumerId)||typeof emit!=='function')throw failure('invalidArgument');
      const key=query.consumerId+'\0'+query.capability;let source=sources.get(key),created=false;
      if(!source){source={key,consumer:query.consumerId,capability:query.capability,scope:copy(query.identity),alive:true,listeners:new Set(),flight:null,timer:null};sources.set(key,source);created=true;}
      source.listeners.add(emit);if(created)sample(source);let released=false;
      return()=>{if(released)return;released=true;source.listeners.delete(emit);if(source.listeners.size===0)stopSource(source);};
    }
    function stopWatch(watch){
      watch.epoch++;if(watch.timer!==null)cancelTimer(watch.timer);watch.timer=null;
    }
    function refreshWatch(watch){
      if(disposed||suspended||watches.get(watch.consumer)!==watch||watch.running)return;
      watch.timer=null;watch.running=true;const epoch=watch.epoch,scope=copy(identity);
      readCapabilities({consumerId:watch.consumer,identity:scope}).then(reply=>updateWatch(watch,epoch,scope,reply),()=>updateWatch(watch,epoch,scope,{status:'denied'})).finally(()=>{
        watch.running=false;
        if(!disposed&&!suspended&&watches.get(watch.consumer)===watch){
          if(epoch!==watch.epoch)refreshWatch(watch);else watch.timer=later(()=>refreshWatch(watch),1000);
        }
      });
    }
    function updateWatch(watch,epoch,scope,reply){
      if(disposed||suspended||watch.epoch!==epoch||!same(scope,identity)||watches.get(watch.consumer)!==watch)return;
      const view={status:reply.status,capabilities:object(reply.capabilities)?reply.capabilities:null};const serialized=JSON.stringify(view);if(serialized===watch.last)return;watch.last=serialized;
      for(const listener of [...watch.listeners]){try{listener(copy(view,32768));}catch(_){diagnose('subscriberUnavailable');}}
    }
    function watchCapabilities(consumer,listener){
      if(disposed)throw failure('disposed');if(!id(consumer)||typeof listener!=='function')throw failure('invalidArgument');
      let watch=watches.get(consumer),created=false;if(!watch){watch={consumer,listeners:new Set(),timer:null,epoch:0,running:false,last:null};watches.set(consumer,watch);created=true;}
      watch.listeners.add(listener);if(created)refreshWatch(watch);let released=false;
      return()=>{if(released)return;released=true;watch.listeners.delete(listener);if(watch.listeners.size===0){stopWatch(watch);watches.delete(consumer);}};
    }
    function cancelPending(code){for(const entry of [...pending.values()])finish(entry,false,code);capQueries.clear();}
    return Object.freeze({
      request:(method,params,scope)=>dispatch(method,params,scope).promise,readCapabilities,subscribeData,watchCapabilities,
      acceptIdentity(next){
        if(disposed||!scopeValid(next)||next.runtimeGeneration<identity.runtimeGeneration||next.runtimeGeneration===identity.runtimeGeneration&&
          (next.sessionId!==identity.sessionId||next.revision<identity.revision))return false;
        if(same(next,identity))return true;identity=copy(next);cancelPending('staleInput');for(const source of [...sources.values()])stopSource(source);
        for(const watch of watches.values()){stopWatch(watch);watch.last=null;refreshWatch(watch);}return true;
      },
      setSuspended(value){
        if(disposed||typeof value!=='boolean')return false;if(value===suspended)return true;suspended=value;
        if(value){cancelPending('notOperable');for(const source of [...sources.values()])stopSource(source);for(const watch of watches.values())stopWatch(watch);}
        else for(const watch of watches.values())refreshWatch(watch);return true;
      },
      dispose(){if(disposed)return;disposed=true;cancelPending('disposed');for(const source of [...sources.values()])stopSource(source);for(const watch of watches.values())stopWatch(watch);watches.clear();transport.removeEventListener('message',receive);},
      readDiagnostics(){return{disposed,suspended,identity:copy(identity),pendingRequests:pending.size,dataSources:sources.size,permissionWatches:watches.size,lastError:lastError&&{...lastError}};}
    });
  }
  return Object.freeze({createNativeHost});
});
