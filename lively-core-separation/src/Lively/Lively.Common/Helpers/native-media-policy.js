/* Embedded in Player and installed before authored scripts, never served as a content capability. */
(function () {
  'use strict';
  function install(root, secret) {
    const define=Object.defineProperty, descriptor=Object.getOwnPropertyDescriptor, apply=Reflect.apply;
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
    const push=Array.prototype.push,splice=Array.prototype.splice;
    const nonce=apply(root.crypto.randomUUID,root.crypto,[]),nodes=[],roots=[];
    let active=false,closed=false,sequence=0;
    function isPaused(node){try{return apply(paused,node,[]);}catch(_){return true;}}
    function isConnected(node){try{return connected?apply(connected,node,[]):node.isConnected===true;}catch(_){return false;}}
    function remember(node){for(let i=0;i<nodes.length;i++)if(nodes[i].node===node)return nodes[i];
      const item={node,wanted:!isPaused(node)};apply(push,nodes,[item]);return item;}
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
      if(!query)return;const observer=new Observer(discover);apply(push,roots,[{scope,query,observer}]);
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
      for(let i=0;i<roots.length;i++){const value=roots[i];apply(disconnectNative,value.observer,[]);apply(remove,value.scope,['play',onPlay,true]);apply(remove,value.scope,['playing',onPlay,true]);}
      apply(remove,root,['pagehide',retire,true]);
    }
    apply(add,root,['pagehide',retire,true]);
    function hook(value){
      if(closed||!value||value.token!==secret)return null;
      if(value.kind==='describe')return {documentNonce:nonce,active,sequence};
      if(value.documentNonce!==nonce||!integer(value.sequence)||value.sequence<=sequence||typeof value.active!=='boolean')return null;
      sequence=value.sequence;discover();active=value.active;
      for(let i=nodes.length-1;i>=0;i--){const item=nodes[i];if(!isConnected(item.node)){item.wanted=false;stop(item);apply(splice,nodes,[i,1]);continue;}
        if(!active){if(!isPaused(item.node))item.wanted=true;stop(item);}else start(item);
      }
      return {documentNonce:nonce,active,sequence};
    }
    define(root,'__dextNativeMediaPolicyV1',{configurable:false,writable:false,value:hook});
    return true;
  }
  if(typeof module==='object'&&module.exports)module.exports=Object.freeze({install});
  else install(this,'__DEXT_MEDIA_POLICY_TOKEN__');
}).call(this);
