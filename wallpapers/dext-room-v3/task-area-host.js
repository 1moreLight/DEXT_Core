(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.DextTaskAreaHost=api;})(globalThis,root=>{
 'use strict';
 function createTaskAreaHost(options){
  const document=options.document||root.document,api=options.model||root.DextTaskAreaModel,state=api.createTaskAreaState();
  const area=document.createElement('section'),items=document.createElement('div'),menu=document.createElement('div');
  area.className='dext-task-area';area.setAttribute('aria-label','应用任务栏');area.hidden=true;
  items.className='dext-task-items';menu.className='dext-task-menu';menu.setAttribute('role','menu');menu.hidden=true;area.append(items,menu);options.container.append(area);
  const nodes=new Map();let layout=null,available=false,inputEnabled=true,disposed=false,rendered=null,selection=null,press=null;
  state.setAvailable(false);
  const active=()=>!disposed&&available&&layout!==null;
  const interactive=()=>active()&&inputEnabled;
  function cancel(){press=null;state.cancel();}
  function closeMenu(){selection=null;menu.replaceChildren();menu.hidden=true;items.hidden=false;}
  function dispatch(value){
   if(!value||!interactive())return;
   try{const reply=options.onAction?.(value);if(reply?.catch)reply.catch(error=>options.onError?.(error));}
   catch(error){options.onError?.(error);}
  }
  function openMenu(itemId,kind){cancel();const view=state.read();if(!active()||!view?.items.some(item=>item.id===itemId))return;selection={contextId:view.contextId,itemId,kind};drawMenu(view);}
  function complete(itemId,windowId,action){
   const result=state.finish(itemId,windowId,action);press=null;
   if(result){const item=state.read()?.items.find(value=>value.id===itemId);
    if(action==='activate'&&item?.windows.length>1)openMenu(itemId,'windows');
    else{closeMenu();dispatch(result);}
   }
   draw();
  }
  function wire(button,itemId,windowId=null,action='activate'){
   button.addEventListener('pointerdown',event=>{
    if(!event.isTrusted||event.button!==0||!interactive())return;
    if(press){cancel();draw();return;}
    if(!state.begin(itemId,windowId,action))return;
    press={kind:'pointer',id:event.pointerId,button};button.setPointerCapture(event.pointerId);
   });
   button.addEventListener('pointerup',event=>{
    if(!event.isTrusted||press?.kind!=='pointer'||press.id!==event.pointerId||press.button!==button)return;
    const r=button.getBoundingClientRect(),inside=event.clientX>=r.left&&event.clientX<r.right&&event.clientY>=r.top&&event.clientY<r.bottom;
    if(inside)complete(itemId,windowId,action);else{cancel();draw();}
   });
   button.addEventListener('pointercancel',()=>{cancel();draw();});
   button.addEventListener('lostpointercapture',()=>{if(press?.button===button){cancel();draw();}});
   button.addEventListener('keydown',event=>{
    if(!event.isTrusted||!['Enter',' '].includes(event.key)||event.repeat||!interactive())return;
    event.preventDefault();if(state.begin(itemId,windowId,action))press={kind:'key',key:event.key,button};
   });
   button.addEventListener('keyup',event=>{
    if(!event.isTrusted||press?.kind!=='key'||press.key!==event.key||press.button!==button)return;
    event.preventDefault();complete(itemId,windowId,action);
   });
   button.addEventListener('blur',()=>{if(press?.button===button){cancel();draw();}});
  }
  function drawMenu(view){
   if(!selection)return;
   const item=view.items.find(item=>item.id===selection.itemId);
   if(selection.contextId!==view.contextId||!item){closeMenu();return;}
   // While a menu button is pressed the state keeps the same display snapshot.
   menu.hidden=false;items.hidden=true;
   // The local return action must survive the same down/refresh/up as app actions.
   // Keep its node attached; replacing it between edges would lose the browser click.
   if(!menu.firstElementChild){const back=document.createElement('button');back.type='button';back.textContent='返回';back.setAttribute('aria-label','返回应用');back.addEventListener('click',event=>{if(event.isTrusted){cancel();closeMenu();}});menu.append(back);}
   for(const child of [...menu.children].slice(1))child.remove();
   const choices=selection.kind==='windows'?item.windows.map(window=>({label:window.title||item.name,windowId:window.id,action:'chooseWindow'})):[{label:item.pinned?'取消固定':'固定应用',windowId:null,action:'togglePin'}];
   for(const choice of choices){const button=document.createElement('button');button.type='button';button.setAttribute('role','menuitem');button.textContent=choice.label;wire(button,item.id,choice.windowId,choice.action);menu.append(button);}
  }
  function draw(){
   if(disposed)return;const view=state.read();area.hidden=!active()||!view;
   if(!active()||!view){closeMenu();return;}
   if(view===rendered)return;rendered=view;
   const wanted=new Set(view.items.map(item=>item.id));for(const [id,node]of nodes)if(!wanted.has(id)){node.remove();nodes.delete(id);}
   for(let index=0;index<view.items.length;index++){
    const item=view.items[index];let button=nodes.get(item.id);
    if(!button){button=document.createElement('button');button.type='button';button.className='dext-task-item';button.dataset.itemId=item.id;wire(button,item.id);
     button.addEventListener('contextmenu',event=>{if(event.isTrusted&&interactive()){event.preventDefault();openMenu(item.id,'pin');}});nodes.set(item.id,button);}
    button.disabled=!inputEnabled;button.setAttribute('aria-label',item.name);button.title=item.name;
    if(item.iconPng){let img=button.querySelector('img');if(!img){img=document.createElement('img');img.alt='';img.draggable=false;button.replaceChildren(img);img.addEventListener('error',()=>{if(img.parentNode===button)button.textContent=item.name.slice(0,1);});}
     const src='data:image/png;base64,'+item.iconPng;if(img.getAttribute('src')!==src)img.setAttribute('src',src);
    }else if(button.textContent!==item.name.slice(0,1)||button.querySelector('img'))button.textContent=item.name.slice(0,1);button.dataset.running=String(item.windows.length>0);button.dataset.active=String(item.active);button.dataset.pinned=String(item.pinned);
    if(items.children[index]!==button)items.insertBefore(button,items.children[index]||null);
   }
   if(selection)drawMenu(view);
  }
  const escape=event=>{if(event.key==='Escape'){cancel();closeMenu();draw();}};
  const blur=()=>{cancel();closeMenu();draw();};area.addEventListener('keydown',escape);root.addEventListener('blur',blur);
  return Object.freeze({
   configure(component,viewport){if(disposed)return false;const next=api.resolveTaskArea(component,viewport);if(JSON.stringify(next)===JSON.stringify(layout))return next!==null;
    cancel();closeMenu();layout=next;state.setAvailable(interactive());
    if(layout){const r=layout.rect;Object.assign(area.style,{left:r.x+'px',top:r.y+'px',width:r.width+'px',height:r.height+'px'});
     for(const [key,value]of Object.entries(layout.style))area.style.setProperty('--task-'+key,typeof value==='number'?value+'px':value);}
    options.onOccupied?.(layout?.occlusion||null);draw();return layout!==null;},
   accept(value){if(disposed||!state.accept(value))return false;draw();return true;},
   setAvailable(value){if(disposed)return;available=value===true;state.setAvailable(interactive());if(!active()){cancel();closeMenu();}draw();},
   setInputEnabled(value){if(disposed)return;inputEnabled=value===true;state.setAvailable(interactive());if(!inputEnabled){cancel();closeMenu();}for(const button of area.querySelectorAll('button'))button.disabled=!inputEnabled;draw();},
   read:()=>({available:active(),inputEnabled,snapshot:state.read(),occlusion:layout?.occlusion||null}),
   dispose(){if(disposed)return;disposed=true;cancel();closeMenu();state.setAvailable(false);root.removeEventListener('blur',blur);area.remove();nodes.clear();options.onOccupied?.(null);}
  });
 }
 return Object.freeze({createTaskAreaHost});
});
