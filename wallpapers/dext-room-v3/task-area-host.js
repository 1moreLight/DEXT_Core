(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.DextTaskAreaHost=api;})(globalThis,root=>{
 'use strict';
 function createTaskAreaHost(options){
  const document=options.document||root.document,api=options.model||root.DextTaskAreaModel,state=api.createTaskAreaState();
  const area=document.createElement('section'),items=document.createElement('div'),menu=document.createElement('div');
  area.className='dext-task-area';area.setAttribute('aria-label','应用任务栏');area.hidden=true;
  items.className='dext-task-items';menu.className='dext-task-menu';menu.setAttribute('role','menu');menu.hidden=true;area.append(items,menu);options.container.append(area);
  const targets=new WeakMap(),nodes=new Map();let layout=null,available=false,inputEnabled=true,disposed=false,rendered=null,selection=null,press=null,nativeFocus=null,lastNativeSequence=0;
  state.setAvailable(false);
  const active=()=>!disposed&&available&&layout!==null;
  const interactive=()=>active()&&inputEnabled;
  function cancel(){press=null;state.cancel();}
  function clearNativeFocus(){nativeFocus=null;if(area.contains(document.activeElement))document.activeElement.blur();}
  function closeMenu(){clearNativeFocus();selection=null;menu.replaceChildren();menu.hidden=true;items.hidden=false;}
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
   targets.set(button,{itemId,windowId,action});
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
   targets.set(menu.firstElementChild,{itemId:item.id,windowId:null,action:'dismissMenu'});
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
   if(nativeFocus){const button=focusedButton();if(button)button.focus({preventScroll:true});else clearNativeFocus();}
  }
  const targetEntry=target=>target.contextId+'/'+target.action+'/'+(target.windowId||'-');
  function sampleButton(button,point=null){
   const target=targets.get(button),view=state.read();
   if(!interactive()||area.hidden||!target||button.disabled||!area.contains(button)||!view)return null;
   const item=view.items.find(item=>item.id===target.itemId);
   if(!item||target.windowId!==null&&!item.windows.some(window=>window.id===target.windowId))return null;
   const width=root.innerWidth,height=root.innerHeight,bounds=[button,button.parentElement,area].map(node=>node.getBoundingClientRect());
   const left=Math.max(0,...bounds.map(r=>r.left)),top=Math.max(0,...bounds.map(r=>r.top));
   const right=Math.min(width,...bounds.map(r=>r.right)),bottom=Math.min(height,...bounds.map(r=>r.bottom));
   const x=point?point.x*width:(left+right)/2,y=point?point.y*height:(top+bottom)/2;
   if(right<=left||bottom<=top||x<left||x>=right||y<top||y>=bottom||document.elementFromPoint(x,y)?.closest('button')!==button)return null;
   const nx=left/width,ny=top/height;
   return Object.freeze({contextId:view.contextId,...target,action:target.action==='activate'&&item.windows.length>1?'openWindows':target.action,
    x:nx,y:ny,width:Math.min(1-nx,(right-left)/width),height:Math.min(1-ny,(bottom-top)/height)});
  }
  // Private event-time samples; never published in the author button catalog.
  function samplePointer(point){
   if(!point||![point.x,point.y].every(Number.isFinite)||point.x<0||point.y<0||point.x>=1||point.y>=1)return null;
   const button=document.elementFromPoint(point.x*root.innerWidth,point.y*root.innerHeight)?.closest('button');
   const hit=button&&sampleButton(button,point);return hit?.action==='dismissMenu'?null:hit||null;
  }
  function sampleTargets(){return [...area.querySelectorAll('button')].map(button=>sampleButton(button)).filter(Boolean);}
  function focusedButton(){return [...area.querySelectorAll('button')].find(button=>{const t=sampleButton(button);return t&&t.itemId===nativeFocus?.button&&targetEntry(t)===nativeFocus.entryId;});}
  function nativeInput(value){
   if(value?.kind==='focus'&&value.consumer!=='official-task'){clearNativeFocus();return false;}
   if(!interactive()||value?.consumer!=='official-task')return false;
   const target=sampleTargets().find(t=>t.itemId===value.button&&targetEntry(t)===value.entryId);if(!target)return false;
   if(value.kind==='focus'){nativeFocus={button:value.button,entryId:value.entryId};focusedButton()?.focus({preventScroll:true});return true;}
   if(value.kind!=='activate'||!Number.isSafeInteger(value.inputSequence)||value.inputSequence<=lastNativeSequence)return false;
   lastNativeSequence=value.inputSequence;
   if(target.action==='openWindows')openMenu(target.itemId,'windows');else closeMenu();
   draw();return true;
  }
  function prepareNativeFocus(reverse){
   if(!interactive())return;
   // Author navigation may leave the task row scrolled to either end.
   // Entry must expose the actual first/last task before Core samples Tab order.
   if(!nativeFocus){const row=menu.hidden?items:menu;row.scrollLeft=reverse?row.scrollWidth:0;return;}
   const current=focusedButton();if(!current)return;
   const row=current.parentElement,buttons=[...row.children].filter(button=>targets.has(button));
   const next=buttons[buttons.indexOf(current)+(reverse?-1:1)];if(!next)return;
   const r=next.getBoundingClientRect(),clip=row.getBoundingClientRect();
   if(r.left<clip.left)row.scrollLeft-=clip.left-r.left;else if(r.right>clip.right)row.scrollLeft+=r.right-clip.right;
  }
  const escape=event=>{if(event.key==='Escape'){cancel();closeMenu();draw();}};
  const blur=()=>{cancel();closeMenu();draw();};area.addEventListener('keydown',escape);root.addEventListener('blur',blur);
  return Object.freeze({samplePointer,sampleTargets,nativeInput,prepareNativeFocus,
   exitKeyboard(){cancel();closeMenu();draw();},
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
