(function(root,factory){
  'use strict';const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;else root.DextPlaybackHost=api;
})(globalThis,function(){
  'use strict';
  const TYPES=new Set(['dext:v3-runtime','dext:v3-session','dext:v3-runtime-revoked']);
  // Called only by the fixed official page's native ExecuteScript hook. This is
  // a playback gate, never a public author message or a change to Core facts.
  function createPlaybackHost(options){
    if(typeof options.setSuspended!=='function'||typeof options.onRuntimeMessage!=='function')throw new TypeError('Playback bridge required');
    let sequence=0,paused=options.initialPaused===true,disposed=false,lastError=null;
    function valid(value){return value&&typeof value==='object'&&!Array.isArray(value)&&
      Object.keys(value).length===6&&['type','protocolVersion','sequence','paused','messages','runtimeGeneration'].every(key=>Object.hasOwn(value,key))&&
      value.type==='dext:v3-playback'&&value.protocolVersion===1&&Number.isSafeInteger(value.sequence)&&value.sequence>sequence&&
      Number.isSafeInteger(value.runtimeGeneration)&&value.runtimeGeneration>0&&typeof value.paused==='boolean'&&Array.isArray(value.messages)&&value.messages.length<=3&&
      (!value.paused||value.messages.length===0)&&value.messages.every(message=>message&&typeof message==='object'&&!Array.isArray(message)&&TYPES.has(message.type));}
    return Object.freeze({
      handle(value){
        if(disposed||!valid(value)||options.matchesRuntime?.(value.runtimeGeneration)===false)return false;
        sequence=value.sequence;const ownSequence=sequence;paused=true;
        try{
          options.setSuspended(true);
          if(!value.paused){
            for(const message of value.messages){if(disposed||sequence!==ownSequence)return false;options.onRuntimeMessage(message);}
            if(disposed||sequence!==ownSequence)return false;
            options.setSuspended(false);paused=false;
          }
          return true;
        }catch(_){lastError={code:'playbackUnavailable'};return false;}
      },
      dispose(){if(disposed)return;disposed=true;paused=true;try{options.setSuspended(true);}catch(_){lastError={code:'playbackUnavailable'};}},
      readState(){return{disposed,paused,sequence,lastError:lastError&&{...lastError}};}
    });
  }
  return Object.freeze({createPlaybackHost});
});
