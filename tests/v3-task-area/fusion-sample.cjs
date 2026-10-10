// Independent sample: actual author iframe plus the official task DOM, no Core actions.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require('../../tauri-ui/node_modules/playwright');
const {resolveTaskArea}=require('../../wallpapers/dext-room-v3/task-area-model');
(async()=>{
 const root=path.resolve(__dirname,'../..'),sample=path.join(root,'rooms/v3-fusion-lab');
 const raw=fs.readFileSync(path.join(sample,'room.json')),manifest=JSON.parse(raw);
 const component=manifest.components.find(c=>c.id===manifest.dockComponentId);
 const installed=path.join(root,'.build/fusion-sample-installed');fs.mkdirSync(installed,{recursive:true});
 const resources=manifest.resources.map(p=>{const data=fs.readFileSync(path.join(sample,p)),dest=path.join(installed,p);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,data);return {path:p,sha256:crypto.createHash('sha256').update(data).digest('hex'),size:data.length};}).sort((a,b)=>Buffer.compare(Buffer.from(a.path),Buffer.from(b.path)));
 fs.writeFileSync(path.join(installed,'room.json'),raw);fs.writeFileSync(path.join(installed,'installation.json'),JSON.stringify({formatVersion:1,roomId:manifest.id,manifestSha256:crypto.createHash('sha256').update(raw).digest('hex'),resources}));
 assert.equal(manifest.apiVersion,1);assert.equal(manifest.desks[2].components.length,0);
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(String(error)));
  await page.route('http://fusion.test/**',async route=>{const p=new URL(route.request().url()).pathname.slice(1);assert(manifest.resources.includes(p));const ext=path.extname(p);await route.fulfill({body:fs.readFileSync(path.join(sample,p)),contentType:{'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'}[ext]});});
  for(const size of [{width:1440,height:120},{width:960,height:88}]){
   await page.setViewportSize(size);await page.setContent('<style>body{margin:0}iframe{position:absolute;inset:0;width:100%;height:100%;border:0}</style><iframe src="http://fusion.test/dock/index.html"></iframe>');
   const frame=page.frameLocator('iframe');await frame.getByRole('button',{name:'下一页',exact:true}).waitFor();
   await page.addStyleTag({path:path.join(root,'wallpapers/dext-room-v3/task-area.css')});
   for(const name of ['model','host'])await page.addScriptTag({path:path.join(root,`wallpapers/dext-room-v3/task-area-${name}.js`)});
   for(const desk of manifest.desks.slice(0,2)){
    const effective={...component,config:{...component.config,...desk.componentOverrides?.[component.id]}};
    const layout=resolveTaskArea(effective,size);assert(layout,'sample layout must fit the native viewport');
    const rects=await frame.locator('button').evaluateAll(buttons=>buttons.map(b=>{const r=b.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};}));
    for(const r of rects)assert(r.x+r.width<=layout.rect.x||r.x>=layout.rect.x+layout.rect.width||r.y+r.height<=layout.rect.y||r.y>=layout.rect.y+layout.rect.height,'author navigation must leave task region clear');
    await page.evaluate(({component,size})=>{window.taskHost?.dispose();window.taskHost=DextTaskAreaHost.createTaskAreaHost({document,container:document.body});taskHost.configure(component,size);const id=n=>n.toString(16).padStart(32,'0');taskHost.accept({contextId:id(1),sequence:1,items:Array.from({length:24},(_,i)=>({id:id(i+2),name:'应用 '+i,pinned:true,active:i===0,windows:[{id:id(i+100),title:'窗口 '+i,active:i===0}]}))});taskHost.setAvailable(true);},{component:effective,size});
    assert(await page.evaluate(()=>{const row=document.querySelector('.dext-task-items');return row.scrollWidth>row.clientWidth;}));
    await page.evaluate(()=>taskHost.prepareNativeFocus(true));
    assert.equal(await page.evaluate(()=>taskHost.sampleTargets().at(-1).itemId),(25).toString(16).padStart(32,'0'));
    await page.evaluate(()=>taskHost.prepareNativeFocus(false));
    assert.equal(await page.evaluate(()=>taskHost.sampleTargets()[0].itemId),(2).toString(16).padStart(32,'0'));
    if(size.width===1440&&desk.id==='home')await page.screenshot({path:path.join(root,'.build/fusion-sample-dock.png')});
    console.log(`PASS fusion ${desk.id} ${size.width}x${size.height}: clear navigation and scrollable official tasks`);
   }
   await page.evaluate(()=>taskHost.configure(null,{width:innerWidth,height:innerHeight}));assert.equal(await page.locator('.dext-task-area').isVisible(),false);
  }
  assert.deepEqual(errors,[]);console.log('PASS absent Dock hides tasks; no browser errors; installation snapshot prepared for Core validation');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
