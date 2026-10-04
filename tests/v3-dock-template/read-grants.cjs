// Isolated configurator UI transport fixture; no Core/author permission API is mocked as live.
const {chromium}=require(require('node:path').join(__dirname,'../../tauri-ui/node_modules/playwright'));
const assert=require('node:assert/strict'),path=require('node:path');
const html='<!doctype html><html><head><meta charset="utf-8"></head><body><div id="fixture"></div><script type="module">'+
'import RefreshRuntime from "/@react-refresh";RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(type)=>type;window.__vite_plugin_react_preamble_installed__=true;'+
'</script><script type="module">import React from "/node_modules/.vite/deps/react.js";import ReactDOM from"/node_modules/.vite/deps/react-dom_client.js";import{V3ReadGrantPanel}from"/src/features/room-editor/V3ReadGrantPanel.tsx";import"/src/index.css";ReactDOM.createRoot(document.getElementById("fixture")).render(React.createElement(V3ReadGrantPanel,{roomId:"fixture-room",consumerId:"component.dock",isTauri:true,canApply:true,disabled:false}));</script></body></html>';
(async()=>{const browser=await chromium.launch({headless:true});try{
 const page=await browser.newPage({viewport:{width:1000,height:600}});
 page.on('pageerror',error=>console.error('Fixture page error:',error.message));
 await page.addInitScript(()=>{
  const state={stamp:'current-installation',active:true,fail:false,capabilities:{'time.read':false,'hardware.read':true,'media.read':false,'audio.read':false},calls:[]};
  window.__grantFixture=state;
  const reply=()=>({status:'accepted',roomId:'fixture-room',installationStamp:state.stamp,consumers:[{consumerId:'component.dock',capabilities:Object.entries(state.capabilities).map(([capability,allowed])=>({capability,allowed}))}]});
  window.__TAURI_INTERNALS__={invoke:async(command,args)=>{
   state.calls.push({command,args});
   if(command==='v3_session_status')return{active:state.active,room_id:'fixture-room',installation_stamp:state.stamp,player_pid:7,operable:false,lifecycle:{stage:'desktop',playback_paused:true,locked:false}};
   if(command==='get_v3_read_grants')return reply();
   if(command==='set_v3_read_grant'){
    if(args.installationStamp!==state.stamp)return{status:'staleSession',consumers:[]};
    if(state.fail)return{status:'storageUnavailable',consumers:[]};
    for(const capability of args.capabilities)state.capabilities[capability]=args.allow;return reply();
   }
   throw new Error('Unexpected fixture command '+command);
  }};
 });
 await page.route('**/read-grant-fixture',route=>route.fulfill({status:200,contentType:'text/html',body:html}));
 await page.goto('http://127.0.0.1:1620/read-grant-fixture');
 const panel=page.getByRole('region',{name:'本机数据授权'});await panel.waitFor();
 await panel.getByRole('checkbox',{name:'允许 时间数据'}).waitFor();
 assert.equal(await panel.getByRole('checkbox',{name:'允许 时间数据'}).count(),1,'time grant control must be rendered');
 const time=panel.getByRole('checkbox',{name:'允许 时间数据'}),hardware=panel.getByRole('checkbox',{name:'允许 硬件数据'});
 await time.check();await page.waitForFunction(()=>window.__grantFixture.capabilities['time.read']===true);
 assert.equal(await hardware.isChecked(),true);
 let calls=await page.evaluate(()=>window.__grantFixture.calls.filter(call=>call.command==='set_v3_read_grant'));
 assert.deepEqual(calls.at(-1).args.capabilities,['time.read']);assert.equal(calls.at(-1).args.installationStamp,'current-installation');
 await time.uncheck();await page.waitForFunction(()=>window.__grantFixture.capabilities['time.read']===false);
 await page.evaluate(()=>window.__grantFixture.fail=true);await time.click();
 await panel.getByText(/授权保存失败/).waitFor();assert.equal(await time.isChecked(),false);assert.equal(await hardware.isChecked(),true);
 await page.evaluate(()=>{window.__grantFixture.fail=false;window.__grantFixture.stamp='updated-installation';window.__grantFixture.capabilities['hardware.read']=false;});
 await time.click();await panel.getByText(/运行副本已变化/).waitFor();
 assert.equal(await panel.getByRole('checkbox',{name:'允许 时间数据'}).count(),0);
 await time.waitFor();assert.equal(await time.isChecked(),false);assert.equal(await hardware.isChecked(),false);
 if(process.env.DEXT_EVIDENCE_DIR)await page.screenshot({path:path.join(process.env.DEXT_EVIDENCE_DIR,'p6-read-grants-ui.png')});
 console.log('PASS read grant UI explicit allow/revoke, independent capability state, publish failure rollback, stale installation refresh while paused; transport is a fixture.');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
