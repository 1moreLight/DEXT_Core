/* Embedded in Player and installed before authored scripts, never served as a content capability. */
(function () {
  'use strict';
  function install(root, secret) {
    const define=Object.defineProperty, descriptor=Object.getOwnPropertyDescriptor, create=Object.create, apply=Reflect.apply;
    if(!root||root===root.top||typeof secret!=='string'||!secret||descriptor(root,'__dextNativeMediaPolicyV1'))return false;
    const mediaProto=root.HTMLMediaElement?.prototype, eventProto=root.EventTarget?.prototype;
    if(!mediaProto||!eventProto||!root.crypto?.randomUUID)return false;
    const play=mediaProto.play,pause=mediaProto.pause,paused=descriptor(mediaProto,'paused')?.get;
    const connected=root.Node&&descriptor(root.Node.prototype,'isConnected')?.get;
    const add=eventProto.addEventListener,remove=eventProto.removeEventListener;
    const documentQuery=root.Document.prototype.querySelectorAll,shadowQuery=root.ShadowRoot?.prototype.querySelectorAll;
    const attach=root.Element.prototype.attachShadow,Observer=root.MutationObserver;
    const observeNative=Observer.prototype.observe,disconnectNative=Observer.prototype.disconnect;
    const then=Promise.prototype.then,resolve=Promise.resolve.bind(Promise),integer=Number.isSafeInteger;
    // Capturing push/splice is insufficient: inherited index setters and
    // Array species can still observe their values. Keep dense own properties.
    function append(list,value){define(list,list.length,{value,writable:true,enumerable:true,configurable:true});}
    function removeAt(list,index){for(let i=index;i<list.length-1;i++)define(list,i,{value:list[i+1],writable:true,enumerable:true,configurable:true});list.length--; }
    const nonce=apply(root.crypto.randomUUID,root.crypto,[]),nodes=[],roots=[];
    let active=false,closed=false,sequence=0;
    const audioContexts=[],audioCtor=root.AudioContext||root.webkitAudioContext;
    const audioItems=new WeakMap(),destinations=new WeakMap(),getItem=WeakMap.prototype.get,setItem=WeakMap.prototype.set;
    const construct=Reflect.construct,AudioError=root.DOMException||Error;
    let audioState,audioResume,audioSuspend,audioClose,audioGain,audioConnect,audioDisconnect,gainParam,paramValue,destinationChannels;
    const lookup=context=>apply(getItem,audioItems,[context]);
    function contextState(item){try{return apply(audioState,item.context,[]);}catch(_){return 'unknown';}}
    function output(item,enabled){apply(paramValue,item.param,[enabled?1:0]);}
    function forgetAudio(item){for(let i=0;i<audioContexts.length;i++)if(audioContexts[i]===item){removeAt(audioContexts,i);break;}}
    function pauseAudio(item){
      output(item,false);if(contextState(item)==='closed')return resolve();
      if(item.pausing)return item.pausing;
      if(contextState(item)==='suspended'&&!item.resuming)return resolve();
      let promise;try{promise=apply(audioSuspend,item.context,[]);}catch(_){item.failed=true;return resolve();}
      item.pausing=promise;
      apply(then,promise,[()=>{if(item.pausing!==promise)return;item.pausing=null;
        if(closed||!active||!item.wanted||item.closed){if(contextState(item)==='running')pauseAudio(item);}
        else if(contextState(item)==='suspended')resumeAudio(item);
      },()=>{if(item.pausing===promise){item.pausing=null;if(contextState(item)!=='closed')item.failed=true;}}]);
      return promise;
    }
    function resumeAudio(item){
      if(closed||!active||!item.wanted||item.closed){pauseAudio(item);return resolve();}
      if(contextState(item)==='closed'){output(item,false);return resolve();}
      output(item,true);if(item.resuming)return item.resuming;if(contextState(item)==='running')return resolve();
      let promise;try{promise=apply(audioResume,item.context,[]);}catch(_){return resolve();}item.resuming=promise;
      apply(then,promise,[()=>{if(item.resuming===promise)item.resuming=null;if(closed||!active||!item.wanted||item.closed)pauseAudio(item);},()=>{if(item.resuming===promise)item.resuming=null;}]);
      return promise;
    }
    function closeAudio(item){
      item.closed=true;item.wanted=false;output(item,false);
      const promise=apply(audioClose,item.context,[]);apply(then,promise,[()=>forgetAudio(item),()=>{}]);return promise;
    }
    function settled(){
      if(active)return true;
      for(let i=0;i<audioContexts.length;i++){const item=audioContexts[i],state=contextState(item);if(item.failed||item.pausing||state!=='suspended'&&state!=='closed')return false;}
      return true;
    }
    if(audioCtor){
      const proto=audioCtor.prototype,base=root.BaseAudioContext?.prototype,node=root.AudioNode?.prototype;
      audioState=descriptor(base,'state')?.get;audioResume=proto.resume;audioSuspend=proto.suspend;audioClose=proto.close;audioGain=proto.createGain;
      audioConnect=node?.connect;audioDisconnect=node?.disconnect;destinationChannels=descriptor(root.AudioDestinationNode?.prototype,'maxChannelCount')?.get;gainParam=descriptor(root.GainNode?.prototype,'gain')?.get;paramValue=descriptor(root.AudioParam?.prototype,'value')?.set;
      if(!audioState||!audioResume||!audioSuspend||!audioClose||!audioGain||!audioConnect||!audioDisconnect||!destinationChannels||!gainParam||!paramValue)return false;
      const destination=descriptor(base,'destination')?.get;if(!destination)return false;
      function ControlledAudioContext(){
        if(!new.target)throw new TypeError('AudioContext requires new');
        if(audioContexts.length>=128)throw new AudioError('Dext audio context limit','QuotaExceededError');
        const context=construct(audioCtor,arguments,new.target),gate=apply(audioGain,context,[]),target=apply(destination,context,[]),param=apply(gainParam,gate,[]);
        const item={context,gate,destination:target,param,wanted:true,closed:false,pausing:null,resuming:null,failed:false};
        output(item,false);apply(audioConnect,gate,[target]);apply(setItem,audioItems,[context,item]);apply(setItem,destinations,[target,item]);append(audioContexts,item);
        apply(add,context,['statechange',()=>{if(contextState(item)==='running'&&(closed||!active||!item.wanted||item.closed))pauseAudio(item);}]);
        if(closed)closeAudio(item);else if(active)resumeAudio(item);else pauseAudio(item);return context;
      }
      define(ControlledAudioContext,'name',{value:'AudioContext',configurable:false});
      define(ControlledAudioContext,'prototype',{value:proto,writable:false});
      define(proto,'constructor',{value:ControlledAudioContext,configurable:false,writable:false});
      function owned(context){const item=lookup(context);if(!item)throw new AudioError('AudioContext belongs to another document','InvalidAccessError');return item;}
      define(proto,'resume',{configurable:false,writable:false,value:function(){const item=owned(this);
        if(item.closed||contextState(item)==='closed')return apply(audioResume,this,arguments);item.wanted=true;return resumeAudio(item);}});
      define(proto,'suspend',{configurable:false,writable:false,value:function(){const item=owned(this);if(contextState(item)==='closed')return apply(audioSuspend,this,arguments);item.wanted=false;return pauseAudio(item);}});
      define(proto,'close',{configurable:false,writable:false,value:function(){return closeAudio(owned(this));}});
      // Preserve the public destination and connect/disconnect overloads. The
      // private gain is never returned to the author and cannot be automated.
      for(const method of ['connect','disconnect']){
        const original=method==='connect'?audioConnect:audioDisconnect;
        define(node,method,{configurable:false,writable:false,value:function(){const item=apply(getItem,destinations,[arguments[0]]);
          if(!item){
            let hardware=false;try{apply(destinationChannels,arguments[0],[]);hardware=true;}catch(_){}
            if(hardware)throw new AudioError('Audio destination belongs to another document','InvalidAccessError');
            return apply(original,this,arguments);
          }
          const args=[];for(let i=0;i<arguments.length;i++)append(args,arguments[i]);args[0]=item.gate;
          const result=apply(original,this,args);return method==='connect'?arguments[0]:result;
        }});
      }
      define(root,'AudioContext',{value:ControlledAudioContext,configurable:false,writable:false});
      if(root.webkitAudioContext)define(root,'webkitAudioContext',{value:ControlledAudioContext,configurable:false,writable:false});
    }
    function isPaused(node){try{return apply(paused,node,[]);}catch(_){return true;}}
    function isConnected(node){try{return connected?apply(connected,node,[]):node.isConnected===true;}catch(_){return false;}}
    function remember(node){for(let i=0;i<nodes.length;i++)if(nodes[i].node===node)return nodes[i];
      const item={node,wanted:!isPaused(node)};append(nodes,item);return item;}
    function stop(item){try{apply(pause,item.node,[]);}catch(_){} }
    function start(item){
      if(closed||!active||!item.wanted||!isConnected(item.node)||!isPaused(item.node))return;
      try{const promise=apply(play,item.node,[]);if(promise)apply(then,promise,[()=>{if(closed||!active||!item.wanted)stop(item);},()=>{}]);}catch(_){}
    }
    function discover(){for(let i=0;i<roots.length;i++){
      let found;try{found=apply(roots[i].query,roots[i].scope,['audio,video']);}catch(_){continue;}
      for(let j=0;j<found.length;j++){const item=remember(found[j]);if(!active||closed)stop(item);else start(item);}
    }}
    function onPlay(event){const item=remember(event.target);if(!closed&&!isPaused(item.node))item.wanted=true;if(closed||!active)stop(item);}
    function observe(scope,query){
      if(!query)return;const observer=new Observer(discover);append(roots,{scope,query,observer});
      apply(observeNative,observer,[scope,{childList:true,subtree:true}]);apply(add,scope,['play',onPlay,true]);apply(add,scope,['playing',onPlay,true]);
    }
    define(mediaProto,'play',{configurable:false,writable:false,value:function(){
      const item=remember(this);if(closed){stop(item);return resolve();}item.wanted=true;
      if(!active){stop(item);return resolve();}
      const promise=apply(play,this,[]);if(promise)apply(then,promise,[()=>{if(closed||!active||!item.wanted)stop(item);},()=>{}]);return promise;
    }});
    define(mediaProto,'pause',{configurable:false,writable:false,value:function(){const item=remember(this);item.wanted=false;return apply(pause,this,[]);}});
    if(attach&&shadowQuery)define(root.Element.prototype,'attachShadow',{configurable:false,writable:false,value:function(options){
      const shadow=apply(attach,this,[options]);observe(shadow,shadowQuery);return shadow;
    }});
    observe(root.document,documentQuery);
    function retire(){
      if(closed)return;discover();closed=true;active=false;
      for(let i=0;i<nodes.length;i++)stop(nodes[i]);
      for(let i=0;i<audioContexts.length;i++)try{closeAudio(audioContexts[i]);}catch(_){}
      for(let i=0;i<roots.length;i++){const value=roots[i];apply(disconnectNative,value.observer,[]);apply(remove,value.scope,['play',onPlay,true]);apply(remove,value.scope,['playing',onPlay,true]);}
      apply(remove,root,['pagehide',retire,true]);
    }
    apply(add,root,['pagehide',retire,true]);
    function receipt(){
      const value=create(null);value.documentNonce=nonce;value.active=active;value.sequence=sequence;value.settled=settled();return value;
    }
    function hook(value){
      if(closed||!value||value.token!==secret)return null;
      if(value.kind==='describe')return receipt();
      if(value.documentNonce!==nonce||!integer(value.sequence)||value.sequence<=sequence||typeof value.active!=='boolean')return null;
      sequence=value.sequence;discover();active=value.active;
      for(let i=nodes.length-1;i>=0;i--){const item=nodes[i];if(!isConnected(item.node)){item.wanted=false;stop(item);removeAt(nodes,i);continue;}
        if(!active){if(!isPaused(item.node))item.wanted=true;stop(item);}else start(item);
      }
      for(let i=0;i<audioContexts.length;i++){const item=audioContexts[i];if(active)resumeAudio(item);else pauseAudio(item);}
      return receipt();
    }
    define(root,'__dextNativeMediaPolicyV1',{configurable:false,writable:false,value:hook});
    return true;
  }
  if(typeof module==='object'&&module.exports)module.exports=Object.freeze({install});
  else install(this,'__DEXT_MEDIA_POLICY_TOKEN__');
}).call(this);
