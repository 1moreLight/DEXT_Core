(function(root,factory){
 'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;else root.DextDesktopSelection=api;
})(globalThis,function(){
 'use strict';
 function createDesktopSelection(){
  let scope=null,ordered=[],available=new Set(),selected=new Set(),focusedId=null,anchorId=null;
  function clear(){selected.clear();focusedId=null;anchorId=null;}
  function update(nextScope,ids){
   if(nextScope!==scope){clear();scope=nextScope;}
   ordered=[...new Set(ids)];available=new Set(ordered);
   selected=new Set([...selected].filter(id=>available.has(id)));
   if(!available.has(focusedId))focusedId=null;
   if(!available.has(anchorId))anchorId=null;
  }
  function select(id,{ctrl=false,shift=false}={}){
   if(!available.has(id))return false;
   if(shift&&anchorId!==null){
    const start=ordered.indexOf(anchorId),end=ordered.indexOf(id);
    const range=ordered.slice(Math.min(start,end),Math.max(start,end)+1);
    selected=new Set(ctrl?[...selected,...range]:range);
   }else if(ctrl){
    if(selected.has(id))selected.delete(id);else selected.add(id);
    anchorId=id;
   }else{selected=new Set([id]);anchorId=id;}
   focusedId=id;return true;
  }
  function read(){return{selectedIds:ordered.filter(id=>selected.has(id)),focusedId,anchorId};}
  return{update,select,clear,read};
 }
 return{createDesktopSelection};
});