/* Private Player bootstrap. Installed before authors; this file is not an author capability. */
(function () {
  'use strict';
  function install(root, secret) {
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
    for(const name of ['mousedown','mouseup','click','keydown','keyup'])if(!known(eventNames,name))append(eventNames,name);
    let reportDispatch=false,armed=false,closed=false,gestureId=0,structuralVersion=0,highestGesture=0,dispatchSequence=0,lastRequest=0,current=null;
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
      if(this===root&&reportDispatch&&armed&&!closed&&eligible(event,root)&&(kind==='mousedown'||kind==='mouseup')){
        const receipt=create(null);receipt.type='dext:v3-input-dispatched';receipt.protocolVersion=1;receipt.token=secret;
        receipt.documentNonce=nonce;receipt.gestureId=gestureId;receipt.structuralVersion=structuralVersion;receipt.kind=kind==='mousedown'?'down':'up';
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
        if(kind==='revoke'&&shape(value,['token','kind','documentNonce'])){armed=false;gestureId=0;structuralVersion=0;current=null;return receipt();}
        if(kind==='arm'&&(shape(value,['token','kind','documentNonce','gestureId','structuralVersion'])||shape(value,['token','kind','documentNonce','gestureId','structuralVersion','reportDispatch'])&&typeof data(value,'reportDispatch')==='boolean')){
          const next=data(value,'gestureId'),version=data(value,'structuralVersion');
          if(!integer(next)||next<=highestGesture||!integer(version)||version<=0)return null;
          highestGesture=next;gestureId=next;structuralVersion=version;reportDispatch=data(value,'reportDispatch')===true;armed=true;current=null;return receipt();
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
    function retire(){closed=true;armed=false;gestureId=0;structuralVersion=0;current=null;}
    apply(add,root,['pagehide',retire,true]);
    define(root,'__dextNativeInputGuardianV1',{configurable:false,writable:false,value:hook});
    define(root,'__dextNativeInputRequestV1',{configurable:false,writable:false,value:send});
    return true;
  }
  function installOfficial(root,secret){
    if(root!==root.top||!root.chrome?.webview||typeof secret!=='string')return false;
    const define=Object.defineProperty,apply=Reflect.apply,add=root.EventTarget.prototype.addEventListener;
    const get=Object.getOwnPropertyDescriptor(new root.Event('dext-native'),'isTrusted')?.get,post=root.chrome.webview.postMessage;
    const button=Object.getOwnPropertyDescriptor(root.MouseEvent.prototype,'button')?.get;
    const stringify=JSON.stringify,nonce=root.crypto.randomUUID();let expected=null;
    if(!get||!button)return false;
    define(root,'__dextNativeOfficialInputDispatchV1',{configurable:false,writable:false,value:value=>{
      if(!value||value.token!==secret)return null;
      if(value.kind==='revoke'){expected=null;return{documentNonce:nonce,armed:false};}
      if(value.kind!=='arm'||!Number.isSafeInteger(value.gestureId)||value.gestureId<=0||
        !Number.isSafeInteger(value.structuralVersion)||value.structuralVersion<=0||!['down','up'].includes(value.edge))return null;
      expected={gestureId:value.gestureId,structuralVersion:value.structuralVersion,edge:value.edge};return{documentNonce:nonce,armed:true};
    }});
    function dispatch(event){
      if(!expected||!apply(get,event,[])||apply(button,event,[])!==0)return;
      const edge=event.type==='mousedown'?'down':'up';if(edge!==expected.edge)return;
      const value={type:'dext:v3-input-dispatched',protocolVersion:1,token:secret,documentNonce:nonce,
        gestureId:expected.gestureId,structuralVersion:expected.structuralVersion,kind:edge};
      expected=null;apply(post,root.chrome.webview,[apply(stringify,JSON,[value])]);
    }
    apply(add,root,['mousedown',dispatch,true]);apply(add,root,['mouseup',dispatch,true]);
    apply(add,root,['pagehide',()=>{expected=null;},true]);return true;
  }
  if(typeof module==='object'&&module.exports)module.exports=Object.freeze({install,installOfficial});
  else if(this===this.top)installOfficial(this,'__DEXT_INPUT_GUARDIAN_TOKEN__');else install(this,'__DEXT_INPUT_GUARDIAN_TOKEN__');
}).call(this);
