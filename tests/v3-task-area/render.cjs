// Real browser DOM check with an in-memory official transport sink; never reaches Core.
const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require('../../tauri-ui/node_modules/playwright');
(async()=>{
 const root=path.resolve(__dirname,'../..');const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1000,height:240}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.setContent('<!doctype html><div id="area" style="position:relative;width:1000px;height:120px"></div>');
  await page.addStyleTag({path:path.join(root,'wallpapers/dext-room-v3/task-area.css')});
  await page.addScriptTag({path:path.join(root,'wallpapers/dext-room-v3/task-area-model.js')});
  await page.addScriptTag({path:path.join(root,'wallpapers/dext-room-v3/task-area-host.js')});
  await page.evaluate(()=>{
   const id=n=>n.toString(16).padStart(32,'0');window.id=id;window.actions=[];
   window.sample=(sequence=1,contextId=id(1),count=1)=>({sequence,contextId,items:Array.from({length:count},(_,i)=>({id:id(i+2),name:'App '+i,pinned:true,active:i===0,windows:[{id:id(i+100),title:'Window '+i,active:i===0}]}))});
   window.component={placement:{width:1000,height:120},config:{dextTaskArea:{version:1,rect:{x:50,y:20,width:800,height:80}}}};
   window.host=DextTaskAreaHost.createTaskAreaHost({document,container:document.getElementById('area'),onAction:value=>actions.push(value)});
   window.host.configure(component,{width:1000,height:120});window.host.accept(sample());window.host.setAvailable(true);
  });
  const button=page.getByRole('button',{name:'App 0',exact:true});await button.waitFor({timeout:1500});
  await button.click();assert.equal(await page.evaluate(()=>actions.length),1);
  await page.evaluate(()=>{actions=[];window.oldButton=document.querySelector('[data-item-id]');});
  const bounds=await button.boundingBox();await page.mouse.move(bounds.x+20,bounds.y+20);await page.mouse.down();
  await page.evaluate(()=>host.accept(sample(2,id(1),4)));
  assert.equal(await page.evaluate(()=>oldButton===document.querySelector('[data-item-id]')),true);
  await page.mouse.up();assert.equal(await page.evaluate(()=>actions.length),1);
  assert.equal(await page.getByRole('button',{name:/^App /}).count(),4);
  console.log('PASS trusted browser click and pointer-down refresh preserve one action and the node');
  await page.evaluate(()=>{actions=[];});await button.hover();await page.mouse.down();await page.evaluate(()=>host.accept(sample(3,id(9),4)));await page.mouse.up();
  assert.equal(await page.evaluate(()=>actions.length),0);console.log('PASS context switch between down/up cancels old action');
  await button.click({button:'right'});const back=page.getByRole('button',{name:'返回应用'});const backBounds=await back.boundingBox();
  await page.mouse.move(backBounds.x+10,backBounds.y+10);await page.mouse.down();await page.evaluate(()=>host.accept(sample(4,id(9),4)));await page.mouse.up();
  assert.equal(await back.isVisible(),false);console.log('PASS return button survives refresh between down and up');
  await button.focus();await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>actions.length),1);
  await page.evaluate(()=>{actions=[];host.setAvailable(false);});assert.equal(await button.isVisible(),false);
  await page.evaluate(()=>host.setAvailable(true));
  await button.click({button:'right'});await page.getByRole('menuitem',{name:'取消固定'}).click();
  assert.equal(await page.evaluate(()=>actions.at(-1).action),'togglePin');console.log('PASS keyboard, visibility and context-scoped pin menu');
  await page.evaluate(()=>{const s=sample(5,id(9),2);s.items[0].windows.push({id:id(900),title:'Second window',active:false});host.accept(s);});
  await button.click();await page.getByRole('menuitem',{name:'Second window'}).click();
  assert.equal(await page.evaluate(()=>actions.at(-1).windowId),await page.evaluate(()=>id(900)));
  await page.evaluate(()=>host.accept(sample(6,id(9),40)));
  assert.equal(await page.evaluate(()=>{const e=document.querySelector('.dext-task-items');return e.scrollWidth>e.clientWidth;}),true);
  await page.getByRole('button',{name:'App 39',exact:true}).click();assert.equal(await page.evaluate(()=>actions.at(-1).itemId),await page.evaluate(()=>id(41)));
  console.log('PASS multi-window choice and overflow scrolling');
  await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=2;const c=canvas.getContext('2d');c.fillStyle='red';c.fillRect(0,0,2,2);const s=sample(7,id(9),1);s.items[0].iconPng=canvas.toDataURL('image/png').split(',')[1];window.iconSample=s;host.accept(s);});
  await page.waitForFunction(()=>document.querySelector('.dext-task-item img')?.naturalWidth===2);
  await page.evaluate(()=>{window.oldImage=document.querySelector('.dext-task-item img');host.accept({...iconSample,sequence:8});});
  assert.equal(await page.evaluate(()=>oldImage===document.querySelector('.dext-task-item img')),true);
  await button.click();assert.equal(await page.evaluate(()=>actions.at(-1).itemId),await page.evaluate(()=>id(2)));
  console.log('PASS actual PNG renders, retains its node on refresh and does not intercept clicks');
  await page.addScriptTag({path:path.join(root,'wallpapers/dext-room-v3/task-area-controller.js')});
  await page.evaluate(()=>{
   host.dispose();window.controllerVisible=true;window.barriers=[];
   const dom={readDiagnostics:()=>({instances:[{...component,consumerId:'component.dock',kind:'dock',state:'active'}]}),setTaskAreaOcclusion:rect=>new Promise(resolve=>barriers.push({rect,resolve})),refreshGeometry:async()=>true};
   window.controller=DextTaskAreaController.createTaskAreaController({createArea:()=>{window.host=DextTaskAreaHost.createTaskAreaHost({document,container:document.getElementById('area'),onAction:value=>actions.push(value)});return host;},getState:()=>({dom,context:{viewKind:'dock',manifest:{dockComponentId:'dock'}},snapshot:{active:true,operable:true,lifecycle:{stage:'desktop',locked:false}},viewport:{width:1000,height:120},visible:controllerVisible})});
   window.pending=controller.refresh();controller.accept(sample(1,id(10),1),false);
  });
  await page.waitForFunction(()=>barriers.length===1);assert.equal(await button.isVisible(),false);
  await page.evaluate(async()=>{barriers.shift().resolve(true);await pending;});assert.equal(await button.isVisible(),true);assert.equal(await button.isDisabled(),true);
  await page.evaluate(()=>controller.accept(sample(2,id(10),1),true));assert.equal(await button.isEnabled(),true);
  await button.click();assert.equal(await page.evaluate(()=>actions.at(-1).contextId),await page.evaluate(()=>id(10)));
  await page.evaluate(()=>{window.pending=controller.refresh();});await page.waitForFunction(()=>barriers.length===1);
  await page.evaluate(()=>{controllerVisible=false;window.hide=controller.refresh();barriers.shift().resolve(true);});
  await page.waitForFunction(()=>barriers.length===1);await page.evaluate(async()=>{barriers.shift().resolve(true);await hide;});assert.equal(await button.isVisible(),false);
  await page.evaluate(()=>controller.dispose());
  console.log('PASS production controller waits for geometry, gates native actions and rejects stale re-show');assert.equal(await page.getByRole('button',{name:/^App /}).count(),0);assert.deepEqual(errors,[]);
  console.log('Task-area DOM checks passed; this is not native Player/physical-input evidence.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
