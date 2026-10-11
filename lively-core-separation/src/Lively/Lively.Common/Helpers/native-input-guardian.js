/* Private Player bootstrap. Installed before authors; this file is not an author capability. */
(function () {
  'use strict';
  function install(root, secret, controlledDockInput=false) {
    const define=Object.defineProperty,describe=Object.getOwnPropertyDescriptor,names=Object.getOwnPropertyNames,
      symbols=Object.getOwnPropertySymbols,create=Object.create,apply=Reflect.apply,parse=JSON.parse,integer=Number.isSafeInteger;
    const getProto=Object.getPrototypeOf,mapGet=WeakMap.prototype.get,mapSet=WeakMap.prototype.set,mapHas=WeakMap.prototype.has;
    const execute=RegExp.prototype.exec,charCode=String.prototype.charCodeAt,substring=String.prototype.substring,finite=Number.isFinite,maxSafe=Number.MAX_SAFE_INTEGER;
    const matches=(pattern,value)=>apply(execute,pattern,[value])!==null;
    if(!root||root===root.top||typeof secret!=='string'||!matches(/^[a-f0-9]{64}$/,secret)||
      describe(root,'__dextNativeInputGuardianV1')||describe(root,'__dextNativeInputRequestV1'))return false;
    const eventProto=root.Event?.prototype,targetProto=root.EventTarget?.prototype,elementProto=root.Element?.prototype;
    const transport=root.chrome?.webview,post=transport?.postMessage,random=root.crypto?.randomUUID;
    if(!eventProto||!targetProto||!elementProto||typeof post!=='function'||typeof random!=='function')return false;
    const add=targetProto.addEventListener,remove=targetProto.removeEventListener,dispatch=targetProto.dispatchEvent;
    const type=describe(eventProto,'type')?.get,phase=describe(eventProto,'eventPhase')?.get,currentTarget=describe(eventProto,'currentTarget')?.get,path=eventProto.composedPath;
    const sample=new root.Event('dext-guardian'),trusted=describe(sample,'isTrusted')?.get;
    function accessor(proto,name){for(let p=proto;p;p=getProto(p)){const value=describe(p,name);if(value?.get)return value.get;}return null;}
    const key=accessor(root.KeyboardEvent?.prototype||eventProto,'key'),button=accessor(root.MouseEvent?.prototype||eventProto,'button');
    const pointerType=accessor(root.PointerEvent?.prototype,'pointerType');
    if(typeof add!=='function'||typeof remove!=='function'||!type||!phase||!currentTarget||!path||!trusted||!key||!button)return false;
    const document=root.document,ownerDocument=describe(root.Node?.prototype,'ownerDocument')?.get;
    const windowDocument=accessor(root.Window?.prototype,'document')||describe(root,'document')?.get;
    const windowSelf=accessor(root.Window?.prototype,'window')||describe(root,'window')?.get;
    const SecurityError=root.DOMException||Error,functionProto=root.Function?.prototype||Function.prototype;
    if(!document||!ownerDocument)return false;
    function owned(receiver,dom){
      // Native global EventTarget calls default undefined/null to this realm's
      // Window. Preserve that native convention; DOM accessors remain closed.
      if(receiver==null)return !dom;
      if(receiver===root||receiver===document)return true;
      try{return apply(ownerDocument,receiver,[])===document;}catch(_){}
      try{if(windowSelf&&apply(windowSelf,receiver,[]))return false;}catch(_){}
      try{if(windowDocument&&apply(windowDocument,receiver,[]))return false;}catch(_){}
      // Generic native EventTargets cannot return callbacks. Their captured
      // native methods validate the EventTarget brand; all callbacks still wrap.
      return !dom;
    }
    function requireOwned(receiver,dom){if(!owned(receiver,dom))throw new SecurityError('Input receiver belongs to another document','SecurityError');}
    const nativeFocus=root.focus;
    const nonce=apply(random,root.crypto,[]);
    if(typeof nonce!=='string'||!matches(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i,nonce))return false;
    const wrappers=new WeakMap(),originals=new WeakMap(),properties=[],eventNames=[];
    function append(list,value){define(list,list.length,{value,writable:true,enumerable:true,configurable:true});}
    function known(list,value){for(let i=0;i<list.length;i++)if(list[i]===value)return true;return false;}
    // All native on* callbacks need isolation, including nested non-input events.
    const prototypes=[root.HTMLElement?.prototype,root.SVGElement?.prototype,root.MathMLElement?.prototype,
      root.Document?.prototype,root.Window?.prototype,root];
    for(let i=0;i<prototypes.length;i++){
      const proto=prototypes[i];if(!proto)continue;const keys=names(proto);
      for(let j=0;j<keys.length;j++){const name=keys[j],descriptor=describe(proto,name);
        if(name.length<3||name[0]!=='o'||name[1]!=='n'||!descriptor?.get||!descriptor?.set||!descriptor.configurable)continue;
        append(properties,{proto,name,get:descriptor.get,set:descriptor.set,enumerable:descriptor.enumerable});
        const eventName=apply(substring,name,[2]);if(!known(eventNames,eventName))append(eventNames,eventName);
      }
    }
    for(const name of ['pointerdown','pointerup','mousedown','mouseup','click','keydown','keyup'])if(!known(eventNames,name))append(eventNames,name);
    let reportDispatch=false,armed=false,closed=false,gestureId=0,structuralVersion=0,highestGesture=0,dispatchSequence=0,lastRequest=0,current=null;
    const stop=eventProto.stopImmediatePropagation,prevent=eventProto.preventDefault;
    const now=root.performance?.now;
    const clock=()=>apply(now,root.performance,[]);
    let dockEdge=null,dockClick=null;
    function gateDock(event,kind,entries){
      if(!controlledDockInput||!apply(trusted,event,[]))return true;
      const mouse=kind==='pointerdown'||kind==='pointerup'||kind==='mousedown'||kind==='mouseup';
      const keyboard=kind==='keydown'||kind==='keyup';
      if(!mouse&&!keyboard&&kind!=='click')return true;
      if(mouse&&apply(button,event,[])!==0)return true;
      if(keyboard){const value=apply(key,event,[]);if(value!=='Enter'&&value!==' '&&value!=='Tab'&&value!=='Escape')return true;}
      let allowed=false;
      const time=clock();
      if(kind==='click'){
        allowed=!!dockClick&&time-dockClick.time<1500&&known(dockClick.targets,entries[0]);
        dockClick=null;
      }else if(dockEdge&&time-dockEdge.time<1500){
        const edge=kind==='mousedown'||kind==='pointerdown'||kind==='keydown'?'down':'up';
        const code=keyboard?(apply(key,event,[])==='Enter'?13:apply(key,event,[])===' '?32:-1):0;
        if(edge===dockEdge.edge&&code===dockEdge.key&&!dockEdge.seen[kind]){
          dockEdge.seen[kind]=true;allowed=true;
          if(kind==='mouseup'||kind==='keydown'&&code===13||kind==='keyup'&&code===32)
            dockClick={time,targets:entries};
        }
      }
      if(!allowed){
        // Cancelling a mouse pointerdown suppresses Chromium's compatibility
        // mousedown for the whole physical contact, including the armed replay.
        // Stop author delivery here; the separate mouse gate cancels defaults.
        if(!(kind==='pointerdown'&&pointerType&&apply(pointerType,event,[])==='mouse'))apply(prevent,event,[]);
        apply(stop,event,[]);
      }
      return allowed;
    }
    const lookup=(map,value)=>apply(mapGet,map,[value]),has=(map,value)=>apply(mapHas,map,[value]);
    const remember=(map,key,value)=>apply(mapSet,map,[key,value]);
    function eligible(event,receiver){
      try{
        if(!apply(trusted,event,[])||apply(phase,event,[])===0||!owned(receiver,true)||apply(currentTarget,event,[])!==receiver)return false;
        const kind=apply(type,event,[]);
        if(kind==='mousedown'||kind==='mouseup'||kind==='click')return apply(button,event,[])===0;
        if(kind==='keydown'||kind==='keyup'){const value=apply(key,event,[]);return value==='Enter'||value===' ';}
      }catch(_){}
      return false;
    }
    function wrap(callback){
      if(has(originals,callback))return callback;const previous=lookup(wrappers,callback);if(previous)return previous;
      const wrapped=function(event){
        const before=current;
        const state=create(null);state.event=event;state.receiver=this;state.gesture=gestureId;
        current=!closed&&armed&&eligible(event,this)?state:null;
        try{return typeof callback==='function'?apply(callback,this,arguments):apply(callback.handleEvent,callback,[event]);}
        finally{current=before;}
      };
      remember(wrappers,callback,wrapped);remember(originals,wrapped,callback);return wrapped;
    }
    function inline(node,name){
      if(!owned(node,true))return;
      for(let i=0;i<properties.length;i++){const entry=properties[i];if(name&&entry.name!==name)continue;
        try{const value=apply(entry.get,node,[]);if(typeof value==='function'&&!has(originals,value)&&getProto(value)===functionProto)apply(entry.set,node,[wrap(value)]);}catch(_){}
      }
    }
    function capture(event){
      let entries,kind;try{entries=apply(path,event,[]);kind=apply(type,event,[]);}catch(_){return;}
      if(this===root&&!gateDock(event,kind,entries))return;
      if(this===root&&reportDispatch&&armed&&!closed&&eligible(event,root)&&(kind==='mousedown'||kind==='mouseup'||kind==='keydown'||kind==='keyup')){
        const receipt=create(null);receipt.type='dext:v3-input-dispatched';receipt.protocolVersion=1;receipt.token=secret;
        receipt.documentNonce=nonce;receipt.gestureId=gestureId;receipt.structuralVersion=structuralVersion;receipt.kind=kind==='mousedown'||kind==='keydown'?'down':'up';
        apply(post,transport,[receipt]);
      }
      // Installing handlers does not open an input context across callback checkpoints.
      for(let i=0;i<entries.length;i++)inline(entries[i],'on'+kind);
    }
    function watch(scope){for(let i=0;i<eventNames.length;i++)apply(add,scope,[eventNames[i],capture,true]);}
    define(targetProto,'addEventListener',{configurable:false,writable:false,value:function(name,callback,options){
      requireOwned(this,false);return apply(add,this,[name,callback&&(typeof callback==='function'||typeof callback==='object')?wrap(callback):callback,options]);
    }});
    define(targetProto,'removeEventListener',{configurable:false,writable:false,value:function(name,callback,options){
      requireOwned(this,false);return apply(remove,this,[name,callback&&(typeof callback==='function'||typeof callback==='object')?lookup(wrappers,callback)||callback:callback,options]);
    }});
    // Explicit scripted dispatch cannot inherit a surrounding physical callback,
    // including currently unwrapped inline handlers in inaccessible shadow trees.
    function isolate(method){return function(){requireOwned(this,false);const before=current;current=null;try{return apply(method,this,arguments);}finally{current=before;}};}
    if(typeof dispatch==='function')define(targetProto,'dispatchEvent',{configurable:false,writable:false,value:isolate(dispatch)});
    const click=root.HTMLElement?.prototype?.click;
    if(typeof click==='function')define(root.HTMLElement.prototype,'click',{configurable:false,writable:false,value:isolate(click)});
    for(let i=0;i<properties.length;i++){const entry=properties[i];
      define(entry.proto,entry.name,{configurable:false,enumerable:entry.enumerable,get:function(){
        requireOwned(this,true);const value=apply(entry.get,this,[]);if(typeof value!=='function')return value;const original=lookup(originals,value);if(original)return original;if(getProto(value)!==functionProto)throw new SecurityError('Input callback belongs to another realm','SecurityError');return value;
      },set:function(value){requireOwned(this,true);return apply(entry.set,this,[typeof value==='function'?wrap(value):value]);}});
    }
    watch(root);
    const attach=elementProto.attachShadow;
    if(typeof attach==='function')define(elementProto,'attachShadow',{configurable:true,writable:true,value:function(){
      requireOwned(this,true);const shadow=apply(attach,this,arguments);watch(shadow);return shadow;
    }});
    for(const name of ['setAttribute','setAttributeNS','setAttributeNode','setAttributeNodeNS']){
      const method=elementProto[name];if(typeof method!=='function')continue;
      define(elementProto,name,{configurable:false,writable:false,value:function(){requireOwned(this,true);const result=apply(method,this,arguments);inline(this);return result;}});
    }
    // Attr and NamedNodeMap also mutate handler attributes without setAttribute.
    const owner=accessor(root.Attr?.prototype,'ownerElement');
    if(owner){
      for(const name of ['value','nodeValue','textContent']){
        let proto=root.Attr.prototype;while(proto&&!describe(proto,name))proto=getProto(proto);
        const descriptor=proto&&describe(proto,name);if(!descriptor?.set||!descriptor.configurable)continue;
        define(proto,name,{configurable:false,enumerable:descriptor.enumerable,get:descriptor.get,set:function(value){
          requireOwned(this,true);const result=apply(descriptor.set,this,[value]);let node;try{node=apply(owner,this,[]);}catch(_){}if(node)inline(node);return result;
        }});
      }
      const map=root.NamedNodeMap?.prototype;
      for(const name of ['setNamedItem','setNamedItemNS']){const method=map?.[name];if(typeof method!=='function')continue;
        define(map,name,{configurable:false,writable:false,value:function(attr){requireOwned(attr,true);const result=apply(method,this,arguments);let node;try{node=apply(owner,attr,[]);}catch(_){}if(node)inline(node);return result;}});
      }
    }
    function data(value,name){const descriptor=value&&describe(value,name);return descriptor&&'value'in descriptor?descriptor.value:undefined;}
    function shape(value,fields){
      if(!value||typeof value!=='object'||symbols(value).length)return false;const keys=names(value);if(keys.length!==fields.length)return false;
      for(let i=0;i<fields.length;i++){const descriptor=describe(value,fields[i]);if(!descriptor||!('value'in descriptor))return false;}return true;
    }
    function receipt(){const value=create(null);value.documentNonce=nonce;value.armed=armed;value.gestureId=gestureId;value.structuralVersion=structuralVersion;return value;}
    function hook(value){
      try{
        if(closed||data(value,'token')!==secret)return null;const kind=data(value,'kind');
        if(kind==='describe')return shape(value,['token','kind'])?receipt():null;
        if(data(value,'documentNonce')!==nonce)return null;
        if(kind==='focus'&&armed&&typeof nativeFocus==='function'&&shape(value,['token','kind','documentNonce'])){
          apply(nativeFocus,root,[]);return receipt();
        }
        if(kind==='revoke'&&shape(value,['token','kind','documentNonce'])){armed=false;gestureId=0;structuralVersion=0;current=null;dockEdge=null;dockClick=null;return receipt();}
        if(kind==='dockEdge'&&controlledDockInput&&armed&&shape(value,['token','kind','documentNonce','gestureId','structuralVersion','edge','key'])){
          const edge=data(value,'edge'),code=data(value,'key');
          if(data(value,'gestureId')!==gestureId||data(value,'structuralVersion')!==structuralVersion||
            edge!=='down'&&edge!=='up'||code!==0&&code!==13&&code!==32)return null;
          dockEdge={edge,key:code,time:clock(),seen:create(null)};
          if(edge==='down')dockClick=null;
          return receipt();
        }
        if(kind==='arm'&&(shape(value,['token','kind','documentNonce','gestureId','structuralVersion'])||shape(value,['token','kind','documentNonce','gestureId','structuralVersion','reportDispatch'])&&typeof data(value,'reportDispatch')==='boolean')){
          const next=data(value,'gestureId'),version=data(value,'structuralVersion');
          if(!integer(next)||next<=highestGesture||!integer(version)||version<=0)return null;
          dockEdge=null;dockClick=null;highestGesture=next;gestureId=next;structuralVersion=version;reportDispatch=data(value,'reportDispatch')===true;armed=true;current=null;return receipt();
        }
      }catch(_){}
      return null;
    }
    function bytes(value){
      let count=0;for(let i=0;i<value.length;i++){const code=apply(charCode,value,[i]);if(code<128)count++;else if(code<2048)count+=2;
        else if(code>=0xd800&&code<=0xdbff&&i+1<value.length){const next=apply(charCode,value,[i+1]);if(next>=0xdc00&&next<=0xdfff){count+=4;i++;}else count+=3;}
        else count+=3;if(count>32768)return false;}return true;
    }
    const id=value=>typeof value==='string'&&matches(/^[A-Za-z0-9_.-]{1,80}$/,value);
    function requestValid(message){
      if(!shape(message,['type','apiVersion','instanceId','sessionId','token','requestId','method','params'])||
        message.type!=='dext:runtime:request'||message.apiVersion!==1||typeof message.instanceId!=='string'||message.instanceId.length<1||message.instanceId.length>160||
        typeof message.sessionId!=='string'||message.sessionId.length>80||typeof message.token!=='string'||message.token.length<1||message.token.length>256||
        typeof message.requestId!=='string'||!matches(/^r[1-9][0-9]{0,15}$/,message.requestId))return false;
      const number=+apply(substring,message.requestId,[1]);if(!integer(number)||number<=lastRequest)return false;
      const params=message.params;
      if(message.method==='actions.activate')return shape(params,['buttonId'])&&id(params.buttonId);
      if(message.method==='desk.navigate'){
        if(!shape(params,['action']))return false;const action=params.action;
        return shape(action,['type'])&&(action.type==='desk.next'||action.type==='desk.previous')||
          shape(action,['type','deskId'])&&action.type==='desk.go'&&id(action.deskId);
      }
      if(message.method==='media.control')return shape(params,['action'])&&
        (params.action==='play'||params.action==='pause'||params.action==='toggle'||params.action==='next'||params.action==='previous');
      if(message.method==='audio.control'){
        if(!shape(params,['settings']))return false;const settings=params.settings;
        if(!settings||typeof settings!=='object')return false;const keys=names(settings);
        if(keys.length<1||keys.length>2||symbols(settings).length)return false;
        for(let i=0;i<keys.length;i++){const name=keys[i],value=data(settings,name);
          if(name==='volume'){if(typeof value!=='number'||!finite(value)||value<0||value>1)return false;}
          else if(name==='muted'){if(typeof value!=='boolean')return false;}else return false;
        }return true;
      }
      return false;
    }
    function send(requestJson){
      if(closed||!armed||!current||current.gesture!==gestureId||!eligible(current.event,current.receiver)||typeof requestJson!=='string'||
        requestJson.length>32768||!bytes(requestJson)||dispatchSequence>=maxSafe)return false;
      try{
        const message=parse(requestJson);if(!requestValid(message))return false;
        // Primitive request JSON is immutable. Neither the secret nor private
        // callback state is passed through author getters, serializers or hooks.
        const witness=create(null);witness.type='dext:v3-input-witness';witness.protocolVersion=1;witness.token=secret;
        witness.documentNonce=nonce;witness.gestureId=gestureId;witness.structuralVersion=structuralVersion;
        witness.dispatchSequence=++dispatchSequence;witness.requestJson=requestJson;
        lastRequest=+apply(substring,message.requestId,[1]);apply(post,transport,[witness]);return true;
      }catch(_){return false;}
    }
    function retire(){closed=true;armed=false;gestureId=0;structuralVersion=0;current=null;dockEdge=null;dockClick=null;}
    apply(add,root,['pagehide',retire,true]);
    define(root,'__dextNativeInputGuardianV1',{configurable:false,writable:false,value:hook});
    define(root,'__dextNativeInputRequestV1',{configurable:false,writable:false,value:send});
    return true;
  }
  // Own native pointer getters are captured before authored code. This observer
  // reports contacts only; Core still owns hit testing and action completion.
  function observeOfficialTouch(root,emit){
    if(!root.PointerEvent)return null;
    const apply=Reflect.apply,describe=Object.getOwnPropertyDescriptor,proto=Object.getPrototypeOf;
    function getter(type,name){for(let p=type.prototype;p;p=proto(p)){const d=describe(p,name);if(d?.get)return d.get;}return null;}
    const trust=describe(new root.Event('dext-touch'),'isTrusted')?.get;
    const type=getter(root.Event,'type'),pointerType=getter(root.PointerEvent,'pointerType'),id=getter(root.PointerEvent,'pointerId');
    const primary=getter(root.PointerEvent,'isPrimary'),cx=getter(root.MouseEvent,'clientX'),cy=getter(root.MouseEvent,'clientY');
    if(!trust||!type||!pointerType||!id||!primary||!cx||!cy)return null;
    const add=root.EventTarget.prototype.addEventListener;
    const contacts=new Set();let enabled=false,active=null,sequence=0;
    function send(kind,p){emit({kind,pointerId:p.id,x:p.x,y:p.y,width:p.width,height:p.height,sequence:++sequence});}
    function cancel(){if(active){const p=active;active=null;send('cancel',p);}}
    function disable(){cancel();enabled=false;contacts.clear();}
    function event(e){
      if(!enabled||!apply(trust,e,[])||apply(pointerType,e,[])!=='touch')return;
      const kind=apply(type,e,[]),key=apply(id,e,[]),x=apply(cx,e,[]),y=apply(cy,e,[]);
      if(kind==='pointerdown'){
        if(contacts.has(key)){cancel();return;}
        contacts.add(key);
        if(contacts.size!==1||!apply(primary,e,[])){cancel();return;}
        const width=root.innerWidth,height=root.innerHeight;
        if(!Number.isFinite(x)||!Number.isFinite(y)||!(width>0&&height>0)||x<0||y<0||x>=width||y>=height)return;
        active={id:key,x,y,width,height};send('down',active);return;
      }
      if(active?.id===key){
        if(kind==='pointercancel'||kind==='lostpointercapture'||!Number.isFinite(x)||!Number.isFinite(y)||
          root.innerWidth!==active.width||root.innerHeight!==active.height||
          (x-active.x)**2+(y-active.y)**2>36||x<0||y<0||x>=active.width||y>=active.height)cancel();
        else if(kind==='pointerup'){const p={...active,x,y};active=null;send('up',p);}
      }
      if(kind==='pointerup'||kind==='pointercancel'||kind==='lostpointercapture')contacts.delete(key);
    }
    for(const name of ['pointerdown','pointermove','pointerup','pointercancel','lostpointercapture'])apply(add,root,[name,event,true]);
    apply(add,root,['pagehide',disable,true]);
    return{enable(){enabled=true;},disable};
  }
  function installOfficial(root,secret,controlledDockInput=false){
    if(root!==root.top||!root.chrome?.webview||typeof secret!=='string')return false;
    const define=Object.defineProperty,apply=Reflect.apply,add=root.EventTarget.prototype.addEventListener;
    const get=Object.getOwnPropertyDescriptor(new root.Event('dext-native'),'isTrusted')?.get,post=root.chrome.webview.postMessage;
    const button=Object.getOwnPropertyDescriptor(root.MouseEvent.prototype,'button')?.get;
    const stringify=JSON.stringify,nonce=root.crypto.randomUUID();let expected=null,clickTarget=null;
    const stop=root.Event.prototype.stopImmediatePropagation,prevent=root.Event.prototype.preventDefault;
    const composedPath=root.Event.prototype.composedPath,now=root.performance?.now;
    let clickTime=0,touchDown=0,touchUp=0,touchBlocked=0;
    const touchAssign=Object.assign,touchCreate=Object.create;let touchScope=null;
    const touchObserver=controlledDockInput?observeOfficialTouch(root,value=>{
      if(!touchScope)return;
      const message=touchAssign(touchCreate(null),value,touchScope,{type:'dext:v3-official-touch',protocolVersion:1,token:secret,documentNonce:nonce});
      apply(post,root.chrome.webview,[apply(stringify,JSON,[message])]);
    }):null;
    function gate(event){
      if(!controlledDockInput||!apply(get,event,[]))return true;
      const entries=apply(composedPath,event,[]);
      if(entries.some(node=>node?.id==='dext-dock-keyboard'))return true;
      const type=event.type;
      const touch=event.pointerType==='touch';
      if(touch&&type==='pointerdown')touchDown++;
      if(touch&&type==='pointerup')touchUp++;
      if(type==='keydown'||type==='keyup'){
        if(!['Tab','Enter',' ','Escape'].includes(event.key))return true;
        apply(prevent,event,[]);apply(stop,event,[]);return false;
      }else if(apply(button,event,[])!==0)return true;
      let allowed=false;
      if(type==='click'){
        allowed=clickTarget===entries[0]&&apply(now,root.performance,[])-clickTime<1500;
        clickTarget=null;
      }else if(expected){
        const edge=type==='pointerdown'||type==='mousedown'?'down':'up';
        if(edge===expected.edge&&!expected.seen[type]){
          expected.seen[type]=true;allowed=true;
          if(type==='mouseup'){clickTarget=entries[0];clickTime=apply(now,root.performance,[]);}
        }
      }
      if(!allowed){if(touch)touchBlocked++;apply(prevent,event,[]);apply(stop,event,[]);}
      return allowed;
    }
    if(!get||!button)return false;
    define(root,'__dextNativeOfficialInputDispatchV1',{configurable:false,writable:false,value:value=>{
      if(!value||value.token!==secret)return null;
      if(value.kind==='diagnostics')return{touchDown,touchUp,touchBlocked};
      if(value.kind==='touchEnable'){
        if(!Number.isSafeInteger(value.runtimeGeneration)||value.runtimeGeneration<=0||!Number.isSafeInteger(value.revision)||value.revision<=0||typeof value.sessionId!=='string')return null;
        touchObserver?.disable();touchScope={runtimeGeneration:value.runtimeGeneration,sessionId:value.sessionId,revision:value.revision};
        touchObserver?.enable();return{documentNonce:nonce,available:!!touchObserver};
      }
      if(value.kind==='touchDisable'){touchObserver?.disable();touchScope=null;return{documentNonce:nonce,available:!!touchObserver};}
      if(value.kind==='revoke'){expected=null;clickTarget=null;return{documentNonce:nonce,armed:false};}
      if(value.kind!=='arm'||!Number.isSafeInteger(value.gestureId)||value.gestureId<=0||
        !Number.isSafeInteger(value.structuralVersion)||value.structuralVersion<=0||!['down','up'].includes(value.edge))return null;
      expected={gestureId:value.gestureId,structuralVersion:value.structuralVersion,edge:value.edge,seen:Object.create(null)};
      if(value.edge==='down')clickTarget=null;return{documentNonce:nonce,armed:true};
    }});
    function dispatch(event){
      if(!expected||!apply(get,event,[])||apply(button,event,[])!==0)return;
      const edge=event.type==='mousedown'?'down':'up';if(edge!==expected.edge)return;
      const value={type:'dext:v3-input-dispatched',protocolVersion:1,token:secret,documentNonce:nonce,
        gestureId:expected.gestureId,structuralVersion:expected.structuralVersion,kind:edge};
      expected=null;apply(post,root.chrome.webview,[apply(stringify,JSON,[value])]);
    }
    if(controlledDockInput)for(const type of ['pointerdown','pointerup','mousedown','mouseup','click','keydown','keyup'])
      apply(add,root,[type,gate,true]);
    apply(add,root,['mousedown',dispatch,true]);apply(add,root,['mouseup',dispatch,true]);
    apply(add,root,['pagehide',()=>{expected=null;},true]);return true;
  }
  if(typeof module==='object'&&module.exports)module.exports=Object.freeze({install,installOfficial,observeOfficialTouch});
  else if(this===this.top)installOfficial(this,'__DEXT_INPUT_GUARDIAN_TOKEN__','__DEXT_DOCK_INPUT_GATE__'==='true');else install(this,'__DEXT_INPUT_GUARDIAN_TOKEN__','__DEXT_DOCK_INPUT_GATE__'==='true');
}).call(this);
