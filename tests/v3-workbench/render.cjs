// Headless adapter smoke: real production DOM/SDK, fixture transport for Tauri's resource URL.
// Does not connect to Core, change user Rooms, or open a desktop window.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {chromium}=require('../../tauri-ui/node_modules/playwright');
(async()=>{
 const root=path.resolve(__dirname,'../..'),ui=path.join(root,'tauri-ui'),roomRoot=path.join(root,'rooms/v3-orbit-lab');
 const room=JSON.parse(fs.readFileSync(path.join(roomRoot,'room.json'),'utf8'));
 const {createServer}=await import(pathToFileURL(path.join(ui,'node_modules/vite/dist/node/index.js')));
 const html='<!doctype html><body><iframe id="preview" sandbox="allow-scripts" style="width:1280px;height:720px"></iframe><script type="module">'+
  'import {workbenchDocument} from "/src/features/room-editor/workbench-document.ts";'+
  'window.control=settings=>preview.contentWindow.postMessage({type:"dext:workbench:control",token:"evidence",settings},"*");'+
  'window.addEventListener("message",e=>{if(e.source===preview.contentWindow){if(e.data.type==="dext:workbench:diagnostics")window.diagnostics=e.data.diagnostics;if(e.data.type==="dext:workbench:error")window.previewError=e.data.message;}});'+
  'preview.onload=()=>preview.contentWindow.postMessage({type:"dext:workbench:init",token:"evidence",room:'+JSON.stringify(room).replace(/</g,'\\u003c')+',deskId:"orbit",baseUrl:"http://v3preview.localhost/evidence/",settings:{cpuPercent:23,gpuPercent:7,audioLevel:.6,showButtons:false,showOccupied:false}},"*");preview.srcdoc=workbenchDocument;</script>';
 const server=await createServer({root:ui,server:{host:'127.0.0.1',port:18721,strictPort:true},plugins:[{name:'owned-evidence',configureServer(server){server.middlewares.use('/__workbench_evidence',(_req,res)=>{res.setHeader('Content-Type','text/html');res.end(html);});}}]});
 let browser;
 try{
  await server.listen();browser=await chromium.launch({channel:'msedge',headless:true});
  const page=await browser.newPage({viewport:{width:1400,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('console',msg=>{if(msg.type()==='error')console.log('BROWSER '+msg.text());});
  page.on('requestfailed',req=>console.log('RESOURCE '+req.url()+' '+req.failure()?.errorText));
  await page.route('http://v3preview.localhost/evidence/**',async route=>{
   const resource=decodeURIComponent(new URL(route.request().url()).pathname.slice('/evidence/'.length));
   if(!room.resources.includes(resource))return route.fulfill({status:404,body:'undeclared'});
   const type={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'}[path.extname(resource)]||'application/octet-stream';
   await route.fulfill({status:200,headers:{'access-control-allow-origin':'*'},contentType:type,body:fs.readFileSync(path.join(roomRoot,resource))});
  });
  await page.goto('http://127.0.0.1:18721/__workbench_evidence');
  try{await page.waitForFunction(()=>window.diagnostics?.runtime.frames.instances.filter(x=>x.ready).length>=3,{},{timeout:20000});}
  catch(error){console.log(JSON.stringify({errors,diagnostics:await page.evaluate(()=>({diag:window.diagnostics,error:window.previewError}))},null,2));throw error;}
  const widget=page.frames().find(f=>f.url().endsWith('/widget/index.html'));assert(widget,'real widget loaded');
  await widget.waitForFunction(()=>document.getElementById('memory').textContent==='16.0 / 32.0 GB');
  assert.equal(await widget.locator('#volume').textContent(),'60%');
  assert.match(await widget.locator('#clock').textContent(),/\d{2}:\d{2}:\d{2}/);
  assert.match(await widget.locator('#track').textContent(),/试验台示例歌曲/);
  console.log('PASS real SDK widget renders clock, memory, volume and media from preview samples');
  const instance=await widget.locator('#document-id').textContent();
  await page.evaluate(()=>{preview.style.width='640px';preview.style.height='480px';});
  await page.waitForFunction(()=>window.diagnostics?.runtime.viewport.width===640);
  assert.equal(await widget.locator('#document-id').textContent(),instance);
  console.log('PASS resize keeps the real shared widget document');
  await page.evaluate(()=>control({data:{'time.read':'missing','hardware.read':'missing','audio.read':'denied'}}));
  await widget.waitForFunction(()=>document.getElementById('clock').textContent==='--:--:--'&&document.getElementById('memory').textContent==='—'&&document.getElementById('volume').textContent==='—');
  await page.evaluate(()=>control({data:{'time.read':'available','hardware.read':'available','audio.read':'available'}}));
  await widget.waitForFunction(()=>document.getElementById('memory').textContent==='16.0 / 32.0 GB'&&document.getElementById('volume').textContent==='60%');
  console.log('PASS missing/denied clear data and available recovers it');
  await page.evaluate(()=>control({deskId:'spectrum'}));
  await page.waitForFunction(()=>window.diagnostics?.snapshot.currentDeskId==='spectrum'&&!window.diagnostics.snapshot.targetDeskId);
  assert.equal(await widget.locator('#document-id').textContent(),instance);
  await page.evaluate(()=>control({paused:true}));
  await page.waitForFunction(()=>window.diagnostics?.snapshot.lifecycle.playbackPaused===true);
  await page.evaluate(()=>control({paused:false}));
  await page.waitForFunction(()=>window.diagnostics?.snapshot.lifecycle.playbackPaused===false);
  console.log('PASS preview Desk navigation and pause/resume preserve the shared document');
  assert.deepEqual(errors,[]);
 }finally{if(browser)await browser.close();await server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
