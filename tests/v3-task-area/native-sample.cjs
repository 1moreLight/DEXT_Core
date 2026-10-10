// Runs against a real DOM with no Core connection or OS application actions.
const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require('../../tauri-ui/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1000,height:240}});
  await page.setContent('<div id="area" style="position:relative;width:1000px;height:120px"></div>');
  const root=path.resolve(__dirname,'../..');
  await page.addStyleTag({path:path.join(root,'wallpapers/dext-room-v3/task-area.css')});
  for(const name of ['model','host'])await page.addScriptTag({path:path.join(root,`wallpapers/dext-room-v3/task-area-${name}.js`)});
  await page.evaluate(()=>{
   const id=n=>n.toString(16).padStart(32,'0');window.id=id;
   window.sample={contextId:id(1),sequence:1,items:[{id:id(2),name:'Editor',active:true,pinned:true,windows:[{id:id(3),title:'First',active:true}]}]};
   window.host=DextTaskAreaHost.createTaskAreaHost({document,container:document.getElementById('area')});
   host.configure({placement:{width:1000,height:120},config:{dextTaskArea:{version:1,rect:{x:50,y:20,width:800,height:80}}}},{width:1000,height:120});host.accept(sample);host.setAvailable(true);
   window.point=element=>{const r=element.getBoundingClientRect();return{x:(r.left+r.width/2)/innerWidth,y:(r.top+r.height/2)/innerHeight};};
  });
  const get=()=>page.evaluate(()=>host.samplePointer(point(document.querySelector('.dext-task-item'))));
  const first=await get();assert.equal(first.action,'activate');assert.equal(first.contextId,'1'.padStart(32,'0'));assert.equal(first.itemId,'2'.padStart(32,'0'));
  assert.equal(first.windowId,null);assert.ok(first.width>0&&first.x+first.width<=1);
  await page.evaluate(()=>host.accept({...sample,sequence:2}));assert.deepEqual(await get(),first);
  console.log('PASS native target sample keeps identity across display refresh');
  await page.evaluate(()=>host.setInputEnabled(false));assert.equal(await get(),null);await page.evaluate(()=>host.setInputEnabled(true));
  await page.evaluate(()=>{const e=document.createElement('div');e.id='cover';Object.assign(e.style,{position:'fixed',inset:'0',zIndex:'10000'});document.body.append(e);});assert.equal(await get(),null);
  await page.evaluate(()=>document.getElementById('cover').remove());
  assert.equal(await page.evaluate(()=>host.samplePointer({x:-.1,y:.2})),null);
  console.log('PASS readonly, topmost occlusion and outside points have no task hit');
  await page.getByRole('button',{name:'Editor',exact:true}).click({button:'right'});
  const pin=await page.evaluate(()=>host.samplePointer(point(document.querySelector('[role="menuitem"]'))));assert.equal(pin.action,'togglePin');assert.equal(pin.itemId,first.itemId);
  assert.equal(await page.evaluate(()=>host.samplePointer(point(document.querySelector('[aria-label="返回应用"]')))),null);
  await page.getByRole('button',{name:'返回应用'}).click();
  await page.evaluate(()=>{sample={...sample,sequence:3,items:[{...sample.items[0],windows:[...sample.items[0].windows,{id:id(4),title:'Second',active:false}]}]};host.accept(sample);});
  assert.equal((await get()).action,'openWindows');await page.getByRole('button',{name:'Editor',exact:true}).click();
  const selected=await page.evaluate(()=>host.samplePointer(point([...document.querySelectorAll('[role="menuitem"]')].find(e=>e.textContent==='Second'))));assert.equal(selected.action,'chooseWindow');assert.equal(selected.windowId,'4'.padStart(32,'0'));
  console.log('PASS menu samples identify pin/window choice; open-menu and return stay local');
  await page.getByRole('button',{name:'返回应用'}).click();
  await page.evaluate(()=>{host.accept({...sample,sequence:4,items:Array.from({length:30},(_,i)=>({...sample.items[0],id:id(20+i),name:'App '+i,windows:[]}))});const row=document.querySelector('.dext-task-items');row.scrollLeft=25;});
  const clipped=await page.evaluate(()=>{const b=document.querySelector('.dext-task-item'),r=b.getBoundingClientRect(),row=document.querySelector('.dext-task-items').getBoundingClientRect();const x=(Math.max(r.left,row.left)+Math.min(r.right,row.right))/2,y=r.top+r.height/2;return{hit:host.samplePointer({x:x/innerWidth,y:y/innerHeight}),min:row.left/innerWidth,full:r.width/innerWidth};});
  assert.ok(clipped.hit.x>=clipped.min);assert.ok(clipped.hit.width<clipped.full);
  await page.evaluate(()=>host.setAvailable(false));assert.equal(await get(),null);await page.evaluate(()=>host.dispose());
  console.log('PASS scroll clipping and hidden cancellation; no native actions executed');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
