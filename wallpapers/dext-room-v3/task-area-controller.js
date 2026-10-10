(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.DextTaskAreaController=api;})(globalThis,()=>{
 'use strict';
 function createTaskAreaController(options){
  const area=options.createArea();let disposed=false,epoch=0,tail=Promise.resolve(),phase='waiting';
  area.setInputEnabled(false);
  function suspend(){epoch++;area.setAvailable(false);area.setInputEnabled(false);phase='suspended';}
  function refresh(){
   if(disposed)return Promise.resolve(false);
   suspend();const own=epoch,state=options.getState();
   const {context,snapshot,dom,viewport,visible}=state;
   // These instances already carry the runtime model's effective Desk overrides.
   const component=context?.viewKind==='dock'&&snapshot?.active&&snapshot.lifecycle?.stage==='desktop'&&!snapshot.lifecycle.locked
    ?dom.readDiagnostics().instances?.find(item=>item.consumerId==='component.'+context.manifest.dockComponentId&&item.kind==='dock'&&item.state==='active'):null;
   const configured=area.configure(component||null,viewport),region=configured?area.read().occlusion:null;
   const show=visible&&configured;phase=show?'awaitingGeometry':'hidden';
   const operation=tail.catch(()=>false).then(async()=>{
    if(disposed||own!==epoch)return false;
    let ready=await dom.setTaskAreaOcclusion(show?region:null);
    if(disposed||own!==epoch)return false;

    if(disposed||own!==epoch)return false;
    area.setAvailable(show&&ready===true);phase=show?(ready?'displayReady':'geometryUnavailable'):'hidden';
    return show&&ready===true;
   });
   tail=operation;return operation.catch(error=>{if(!disposed&&own===epoch){phase='geometryUnavailable';area.setAvailable(false);options.onError?.(error);}return false;});
  }
  return Object.freeze({refresh,suspend,
   samplePointer:point=>!disposed&&phase==='displayReady'?area.samplePointer(point):null,
   accept(snapshot,actionsEnabled){if(disposed)return false;const accepted=area.accept(snapshot);if(accepted)area.setInputEnabled(actionsEnabled===true&&phase==='displayReady');return accepted;},
   read:()=>({phase,...area.read()}),
   dispose(){if(disposed)return;suspend();disposed=true;area.dispose();phase='disposed';}
  });
 }
 return Object.freeze({createTaskAreaController});
});
