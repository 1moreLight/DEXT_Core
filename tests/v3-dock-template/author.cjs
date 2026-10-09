// Functional author HTML fixture. Dext is simulated; this is not a Core/SDK live check.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),{chromium}=require(path.join(root,'tauri-ui/node_modules/playwright'));
test('both author templates keep static frames, read configured data, and publish current DOM button rectangles',async()=>{
 const browser=await chromium.launch({headless:true});
 try {for(const id of ['three-panels','navigation-bar']){
  const dir=path.join(root,'creator-kit/v3/dock-templates',id),descriptor=JSON.parse(fs.readFileSync(path.join(dir,'template.json'),'utf8'));
  const config={template:descriptor,appearance:Object.fromEntries(descriptor.parameters.map(p=>[p.id,p.default])),
   enabledRegions:descriptor.regions.map(r=>r.id),slots:Object.fromEntries(descriptor.regions.filter(r=>r.kind==='data').map(r=>[r.id,r.defaultSource])),
   buttonSlots:Object.fromEntries(descriptor.regions.filter(r=>r.kind==='button').map(r=>[r.id,'button-'+r.id]))};
  const page=await browser.newPage({viewport:{width:1920,height:280}}),errors=[];page.on('pageerror',error=>errors.push(String(error)));
  await page.route('**/dock-fixture/**',async route=>{
   const file=new URL(route.request().url()).pathname.split('/').pop();
   if(file==='dext-sdk.v1.js')return route.fulfill({status:200,contentType:'text/javascript',body:'/* fixture Dext is supplied by addInitScript */'});
   const types={'index.html':'text/html','main.js':'text/javascript','style.css':'text/css'};
   await route.fulfill({status:200,contentType:types[file],body:fs.readFileSync(path.join(dir,file))});
  });
  await page.addInitScript(initial=>{
   let config=initial;const data=new Map(),configListeners=[],geometryListeners=[],deskListeners=[];
   const values={'time.read':{unixMilliseconds:Date.parse('2029-12-31T23:59:00Z')},'hardware.read':{cpuPercent:12.5,gpuPercent:42.25},
    'media.read':{title:'Local media'},'audio.read':{volume:45}};
   window.__dockFixture={reports:[],activations:[],push(capability,state){for(const callback of data.get(capability)||[])callback(state);},
    replace(next){config=next;for(const callback of configListeners)callback(next);},config:()=>structuredClone(config)};
   window.Dext={session:{},ready:async()=>({}),dispose(){},config:{get:()=>config,subscribe(callback){configListeners.push(callback);return()=>{};}},
    data:{subscribe(capability,callback){if(!data.has(capability))data.set(capability,new Set());data.get(capability).add(callback);
     callback({status:'available',value:values[capability]});return()=>data.get(capability).delete(callback);}},
    actions:{list:async()=>({status:'accepted',buttons:Object.values(config.buttonSlots).map(id=>({id,isBound:false}))}),
     activate:async id=>{window.__dockFixture.activations.push(id);return {status:'accepted'};}},
    scene:{subscribeGeometry(callback){geometryListeners.push(callback);callback({});return()=>{};},
     publishGeometry:async report=>{window.__dockFixture.reports.push(structuredClone(report));return{status:'accepted'};}},
    desk:{subscribe(callback){deskListeners.push(callback);return()=>{};}}};
  },config);
  await page.goto('http://127.0.0.1:1620/dock-fixture/'+id+'/index.html');
  await page.waitForFunction(()=>document.getElementById('dock').dataset.geometry==='accepted');
  const count=descriptor.regions.length;assert.equal(await page.locator('.panel').count(),count);
  const initialRect=await page.locator('#dock').boundingBox();
  if(id==='three-panels'){
   assert.match(await page.locator('[data-region=left] .readout').innerText(),/12[.,]5/);
   await page.evaluate(()=>window.__dockFixture.push('hardware.read',{status:'missing'}));
   assert.equal(await page.locator('[data-region=left] .readout').isVisible(),false);
   assert.equal(await page.locator('.panel').count(),count);
   assert.deepEqual(await page.locator('#dock').boundingBox(),initialRect);
   await page.evaluate(()=>window.__dockFixture.push('hardware.read',{status:'available',value:{cpuPercent:'bad',gpuPercent:33}}));
   assert.equal(await page.locator('[data-region=left]').getAttribute('data-status'),'error');
   await page.evaluate(()=>{const config=window.__dockFixture.config();config.slots.left={capability:'time.read',path:['unixMilliseconds'],format:'countdown',deadline:'2030-01-01T00:00:00Z'};window.__dockFixture.replace(config);});
   await page.waitForFunction(()=>document.querySelector('[data-region=left] .readout').textContent.includes('天'));
  }
  await page.locator('[data-region=next]').click();assert.deepEqual(await page.evaluate(()=>window.__dockFixture.activations),['button-next']);
  const before=await page.evaluate(()=>window.__dockFixture.reports.length);
  await page.setViewportSize({width:640,height:280});
  await page.waitForFunction(previous=>window.__dockFixture.reports.length>previous,before);
  const report=await page.evaluate(()=>window.__dockFixture.reports.at(-1));
  assert.equal(report.occupied,undefined);
  assert.equal(report.buttons.length,3);
  const measured=await page.locator('button.panel').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};}));
  for(let i=0;i<measured.length;i++){
   const expected=measured[i],actual=report.buttons[i];for(const key of ['x','y','width','height'])assert.equal(actual[key],expected[key]);
   assert.ok(actual.x>=0&&actual.y>=0&&actual.x+actual.width<=640&&actual.y+actual.height<=280);
  }
  assert.deepEqual(errors,[]);
  if(process.env.DEXT_EVIDENCE_DIR)await page.screenshot({path:path.join(process.env.DEXT_EVIDENCE_DIR,'p6-dock-author-'+id+'.png')});
  await page.close();
 }}finally{await browser.close();}
});
