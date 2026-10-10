(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.DextTaskAreaModel=api;})(globalThis,()=>{
 'use strict';
 const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
 const finite=Number.isFinite;
 const guid=v=>typeof v==='string'&&/^[a-f0-9]{32}$/i.test(v);
 const text=v=>typeof v==='string'&&v.length<=4096;
 function frozen(v){if(object(v)||Array.isArray(v)){for(const child of Object.values(v))frozen(child);Object.freeze(v);}return v;}
 function resolveTaskArea(component,viewport){
  const area=component?.config?.dextTaskArea,logical=component?.placement,r=area?.rect;
  if(!object(area)||area.version!==1||!object(r)||!object(logical)||!object(viewport))return null;
  if(![logical.width,logical.height,viewport.width,viewport.height].every(v=>finite(v)&&v>0)||![r.x,r.y,r.width,r.height].every(finite)||r.x<0||r.y<0||r.width<=0||r.height<=0||r.x+r.width>logical.width||r.y+r.height>logical.height)return null;
  const style={iconSizeDip:40,gapDip:8,radiusDip:16,surface:'#172031dd',accent:'#a5d8ff'};
  if(area.style!==undefined){
   if(!object(area.style))return null;
   for(const [key,value]of Object.entries(area.style)){
    if(!Object.hasOwn(style,key))return null;
    if(['surface','accent'].includes(key)){if(typeof value!=='string'||!/^#[a-f0-9]{6}([a-f0-9]{2})?$/i.test(value))return null;}
    else {const range={iconSizeDip:[24,64],gapDip:[0,24],radiusDip:[0,32]}[key];if(!finite(value)||value<range[0]||value>range[1])return null;}
    style[key]=value;
   }
  }
  const rect={x:r.x/logical.width*viewport.width,y:r.y/logical.height*viewport.height,width:r.width/logical.width*viewport.width,height:r.height/logical.height*viewport.height};
  if(rect.width<style.iconSizeDip+32||rect.height<style.iconSizeDip+16)return null;
  const x=r.x/logical.width*1920,y=r.y/logical.height*1080;
  // Edge-aligned logical rectangles must stay within the exact canvas bounds.
  return frozen({rect,style,occlusion:{x,y,width:Math.min(r.width/logical.width*1920,1920-x),height:Math.min(r.height/logical.height*1080,1080-y)}});
 }
 function snapshot(value){
  if(!object(value)||!guid(value.contextId)||!Number.isSafeInteger(value.sequence)||value.sequence<=0||!Array.isArray(value.items)||value.items.length>1024)return null;
  const items=[],ids=new Set(),windowIds=new Set();let iconBudget=512*1024;
  for(const item of value.items){
   if(!object(item)||!guid(item.id)||ids.has(item.id)||!text(item.name)||!item.name.trim()||typeof item.pinned!=='boolean'||typeof item.active!=='boolean'||!Array.isArray(item.windows))return null;
   ids.add(item.id);const windows=[];
   for(const window of item.windows){
    if(!object(window)||!guid(window.id)||windowIds.has(window.id)||!text(window.title)||typeof window.active!=='boolean'||windowIds.size>=4096)return null;
    windowIds.add(window.id);windows.push({id:window.id,title:window.title,active:window.active});
   }
   let iconPng=null;
   if(typeof item.iconPng==='string'&&item.iconPng.length<=87384&&item.iconPng.length<=iconBudget&&/^iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(item.iconPng)){iconPng=item.iconPng;iconBudget-=iconPng.length;}
   items.push({id:item.id,name:item.name,pinned:item.pinned,active:item.active,windows,iconPng});
  }
  return frozen({contextId:value.contextId,sequence:value.sequence,items});
 }
 function createTaskAreaState(){
  let current=null,display=null,pressed=null,available=true;
  const find=(itemId,windowId)=>{const item=current?.items.find(item=>item.id===itemId);return item&&(windowId===null||item.windows.some(window=>window.id===windowId))?item:null;};
  const cancel=()=>{pressed=null;display=current;};
  return Object.freeze({
   accept(value){const next=snapshot(value);if(!next||current&&next.sequence<=current.sequence)return false;current=next;
    if(pressed&&(pressed.contextId!==next.contextId||!find(pressed.itemId,pressed.windowId)))cancel();
    if(!pressed)display=current;return true;},
   read:()=>display,
   begin(itemId,windowId=null,action='activate'){
    // A second pointer/key cannot inherit or complete the first press.
    if(pressed){cancel();return false;}
    if(!available||!['activate','chooseWindow','togglePin'].includes(action)||action==='chooseWindow'&&windowId===null||action!=='chooseWindow'&&windowId!==null||!find(itemId,windowId))return false;
    pressed={contextId:current.contextId,itemId,windowId,action};return true;},
   finish(itemId,windowId=null,action='activate'){
    const own=pressed;cancel();
    if(!available||!own||own.contextId!==current?.contextId||own.itemId!==itemId||own.windowId!==windowId||own.action!==action||!find(itemId,windowId))return null;
    return frozen({...own});},
   cancel,
   setAvailable(value){available=value===true;if(!available)cancel();}
  });
 }
 return Object.freeze({resolveTaskArea,createTaskAreaState});
});
