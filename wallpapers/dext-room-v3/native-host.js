(function(root,factory){
  'use strict';const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.DextNativeHost=api;
})(globalThis,function(root){
  'use strict';
  const DATA=new Set(['time.read','hardware.read','media.read','audio.read']);
  const STATUS=new Set(['accepted','queued','expiredInput','denied','forbidden','unknownConsumer','missingPermission','unsupported','notOperable','staleSession','staleInput','storageUnavailable','inputRequired','invalidButton','missingBinding','launchFailed','requiresConfirmation','controlUnavailable','rateLimited']);
  const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  const id=(v,max=128)=>typeof v==='string'&&v.length>0&&v.length<=max&&!/[\u0000-\u001f\u007f-\u009f]/.test(v);
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
  const stableKey=v=>typeof v==='string'&&/^[A-Za-z0-9_.-]{1,80}$/.test(v);
  function storageValue(v){try{copy(v,32768);return true;}catch(_){return false;}}
  function layoutChange(p){
    if(!object(p)||!stableKey(p.id))return false;
    return p.kind==='icon'?shape(p,['kind','id','deskId','x','y'])&&stableKey(p.deskId)&&finite(p.x,0,1824)&&finite(p.y,0,976):
      p.kind==='widget'&&shape(p,['kind','id','x','y','width','height'])&&finite(p.x,0,1920)&&finite(p.y,0,1080)&&finite(p.width,Number.EPSILON,1920)&&finite(p.height,Number.EPSILON,1080)&&p.x+p.width<=1920&&p.y+p.height<=1080;
  }
  function layoutValid(p){
    if(!shape(p,['revision','icons','components'])||!integer(p.revision,0)||!object(p.icons)||!object(p.components)||Object.keys(p.icons).length>64||Object.keys(p.components).length>128)return false;
    let count=0;for(const [desk,icons]of Object.entries(p.icons)){
      if(!stableKey(desk)||!object(icons)||Object.keys(icons).length>1024)return false;
      for(const [id,position]of Object.entries(icons))if(++count>4096||!stableKey(id)||!shape(position,['x','y'])||!finite(position.x,0,1824)||!finite(position.y,0,976))return false;
    }
    return Object.entries(p.components).every(([id,r])=>stableKey(id)&&shape(r,['x','y','width','height'])&&finite(r.x,0,1920)&&finite(r.y,0,1080)&&finite(r.width,Number.EPSILON,1920)&&finite(r.height,Number.EPSILON,1080)&&r.x+r.width<=1920&&r.y+r.height<=1080);
  }

  function crossSide(a,b,p){
    const dx=b.x-a.x,dy=b.y-a.y,px=p.x-a.x,py=p.y-a.y,left=dx*py,right=dy*px,value=left-right;
    const tolerance=32*Number.EPSILON*(Math.abs(left)+Math.abs(right)+Math.abs(dx)*(Math.abs(p.y)+Math.abs(a.y))+Math.abs(py)*(Math.abs(b.x)+Math.abs(a.x))+Math.abs(dy)*(Math.abs(p.x)+Math.abs(a.x))+Math.abs(px)*(Math.abs(b.y)+Math.abs(a.y)));
    return value>tolerance?1:value<-tolerance?-1:0;
  }
  function preciseButtons(buttons){
    if(!Array.isArray(buttons)||buttons.length>4096)return false;
    const entries=new Set(),actions=new Map();let vertices=0;
    for(const b of buttons){
      if(!object(b)||Object.keys(b).some(k=>!['consumer','button','x','y','width','height','tabIndex','entryId','polygons'].includes(k))||
        !['consumer','button','x','y','width','height','tabIndex'].every(k=>Object.hasOwn(b,k))||!id(b.consumer)||!id(b.button,80)||
        !finite(b.x,0,1)||!finite(b.y,0,1)||!finite(b.width,Number.EPSILON,1)||!finite(b.height,Number.EPSILON,1)||b.x+b.width>1||b.y+b.height>1||!integer(b.tabIndex,-1,4095))return false;
      const explicit=Object.hasOwn(b,'entryId'),action=JSON.stringify([b.consumer,b.button]),entry=JSON.stringify([b.consumer,explicit?b.entryId:b.button]);
      if(explicit&&!id(b.entryId,192)||entries.has(entry)||actions.has(action)&&(!explicit||actions.get(action)===false))return false;
      entries.add(entry);actions.set(action,explicit);
      if(!Object.hasOwn(b,'polygons')){vertices+=4;if(vertices>65536)return false;continue;}
      if(!explicit||!Array.isArray(b.polygons)||b.polygons.length<1||b.polygons.length>64)return false;
      let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
      for(const poly of b.polygons){
        if(!Array.isArray(poly)||poly.length<3||poly.length>32||(vertices+=poly.length)>65536||!poly.every(p=>shape(p,['x','y'])&&finite(p.x,0,1)&&finite(p.y,0,1)))return false;
        const sign=crossSide(poly[0],poly[1],poly[2]);if(!sign)return false;
        for(let i=0;i<poly.length;i++){
          const a=poly[i],end=poly[(i+1)%poly.length];
          for(let j=0;j<poly.length;j++)if(j!==i&&j!==(i+1)%poly.length&&crossSide(a,end,poly[j])!==sign)return false;
          minX=Math.min(minX,a.x);minY=Math.min(minY,a.y);maxX=Math.max(maxX,a.x);maxY=Math.max(maxY,a.y);
        }
      }
      const same=(a,c)=>Math.abs(a-c)<=32*Number.EPSILON*Math.max(1,Math.abs(a),Math.abs(c));
      if(!same(b.x,minX)||!same(b.y,minY)||!same(b.width,maxX-minX)||!same(b.height,maxY-minY))return false;
    }return true;
  }
  function inputEventValid(v){
    const keys=['type','runtimeGeneration','sessionId','revision','geometryVersion','kind','consumer','button'];
    if(!object(v)||Object.keys(v).some(k=>!keys.includes(k)&&k!=='entryId'&&k!=='inputSequence')||!keys.every(k=>Object.hasOwn(v,k))||
      !integer(v.runtimeGeneration)||!id(v.sessionId)||!integer(v.revision)||!integer(v.geometryVersion)||!['focus','activate'].includes(v.kind))return false;
    const entry=Object.hasOwn(v,'entryId')?v.entryId:null;
    if(v.kind==='focus'&&Object.hasOwn(v,'inputSequence')||v.kind==='activate'&&!integer(v.inputSequence))return false;
    if(v.consumer===null||v.button===null)return v.kind==='focus'&&v.consumer===null&&v.button===null&&entry===null;
    return id(v.consumer)&&id(v.button,80)&&(entry===null||id(entry,192));
  }
  function paramsValid(method,p){
    switch(method){
      case'capabilities':case'buttons':return shape(p,['consumer'])&&id(p.consumer);
      case'data':return shape(p,['consumer','capability'])&&id(p.consumer)&&DATA.has(p.capability);
      case'storageGet':return shape(p,['consumer','key'])&&id(p.consumer)&&stableKey(p.key);
      case'storageSet':return shape(p,['consumer','key','value'])&&id(p.consumer)&&stableKey(p.key)&&storageValue(p.value);
      case'invalidateGeometry':case'layoutRead':return shape(p,[]);
      case'layoutSave':return shape(p,['layoutRevision','change'])&&integer(p.layoutRevision,0)&&layoutChange(p.change);
      case'startupComplete':return shape(p,['lifecycleRevision'])&&integer(p.lifecycleRevision);
      case'authorInput':return shape(p,['consumer','instanceId','requestJson','geometryVersion'])&&id(p.consumer)&&id(p.instanceId,160)&&typeof p.requestJson==='string'&&new root.TextEncoder().encode(p.requestJson).length<=32768&&integer(p.geometryVersion);
      case'activate':return shape(p,['consumer','button','geometryVersion','inputSequence'])&&id(p.consumer)&&id(p.button,80)&&integer(p.geometryVersion)&&integer(p.inputSequence,0);
      case'navigate':return shape(p,['consumer','action','geometryVersion','inputSequence'])&&id(p.consumer)&&integer(p.geometryVersion)&&integer(p.inputSequence,0)&&object(p.action)&&
        (['desk.next','desk.previous'].includes(p.action.type)?shape(p.action,['type']):p.action.type==='desk.go'&&shape(p.action,['type','deskId'])&&id(p.action.deskId,80));
      case'mediaControl':return shape(p,['consumer','action','geometryVersion','inputSequence'])&&id(p.consumer)&&integer(p.geometryVersion)&&integer(p.inputSequence,0)&&['play','pause','toggle','next','previous'].includes(p.action);
      case'audioControl':return shape(p,['consumer','settings','geometryVersion','inputSequence'])&&id(p.consumer)&&integer(p.geometryVersion)&&integer(p.inputSequence,0)&&object(p.settings)&&
        Object.keys(p.settings).length>0&&Object.keys(p.settings).every(k=>['volume','muted'].includes(k))&&
        (!Object.hasOwn(p.settings,'volume')||finite(p.settings.volume,0,1))&&(!Object.hasOwn(p.settings,'muted')||typeof p.settings.muted==='boolean');
      case'geometry':return shape(p,['geometryVersion','buttons','viewport'])&&integer(p.geometryVersion)&&shape(p.viewport,['width','height','dpr'])&&
        finite(p.viewport.width,64,16384)&&finite(p.viewport.height,64,16384)&&finite(p.viewport.dpr,.5,8)&&preciseButtons(p.buttons);
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
        if(disposed){reject(failure('disposed'));return;}if(suspended&&method!=='layoutRead'){reject(failure('notOperable'));return;}
        if(!scopeValid(scope)||!same(scope,identity)){reject(failure('staleInput'));return;}
        if(!paramsValid(method,params)){reject(failure('invalidArgument'));return;}if(pending.size>=64){reject(failure('requestLimit'));return;}
        const requestId='n'+(++counter);entry={requestId,method,scope:copy(scope),resolve,reject,timer:null};pending.set(requestId,entry);
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
        if(!suspended&&same(reply,identity)&&inputEventValid(reply)){try{options.onInput?.(reply);}catch(_){diagnose('inputUnavailable');}}return;
      }
      if(reply?.type!=='dext:v3-native-response'||!id(reply.requestId))return;
      const entry=pending.get(reply.requestId);if(!entry||!same(reply,entry.scope)||!STATUS.has(reply.status))return;
      // An authoritative action may synchronously publish its new revision
      // before its receipt. Deliver that existing result in this same document;
      // generation/session replacement and pause still cancel all requests.
      const action=['activate','navigate','mediaControl','audioControl','authorInput'].includes(entry.method);
      if(action?reply.runtimeGeneration!==identity.runtimeGeneration||reply.sessionId!==identity.sessionId:!same(reply,identity))return;
      if(['activate','navigate','mediaControl','audioControl','authorInput'].includes(entry.method)&&(!integer(reply.inputSequence,0)||typeof reply.inputConsumed!=='boolean'||reply.inputConsumed&&reply.inputSequence===0))return;
      if(['layoutRead','layoutSave'].includes(entry.method)&&reply.status==='accepted'&&!layoutValid(reply.layout)){finish(entry,false,'invalidPayload');return;}
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
    function cancelPending(code,retainActions=false){for(const entry of [...pending.values()])if(!retainActions||!['activate','navigate','mediaControl','audioControl','authorInput'].includes(entry.method))finish(entry,false,code);capQueries.clear();}
    return Object.freeze({
      request:(method,params,scope)=>dispatch(method,params,scope).promise,readCapabilities,subscribeData,watchCapabilities,
      acceptIdentity(next){
        if(disposed||!scopeValid(next)||next.runtimeGeneration<identity.runtimeGeneration||next.runtimeGeneration===identity.runtimeGeneration&&
          (next.sessionId!==identity.sessionId||next.revision<identity.revision))return false;
        if(same(next,identity))return true;const retainActions=next.runtimeGeneration===identity.runtimeGeneration&&next.sessionId===identity.sessionId;identity=copy(next);cancelPending('staleInput',retainActions);for(const source of [...sources.values()])stopSource(source);
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
