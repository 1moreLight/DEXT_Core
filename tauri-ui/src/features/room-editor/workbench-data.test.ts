import {describe,it,expect} from "vitest";
import vm from "node:vm";
import {webcrypto} from "node:crypto";
import adapter from "./workbench-host.js?raw";
import {workbenchDocument} from "./workbench-document";

async function preview(){
 const listeners=new Map<string,(event:unknown)=>unknown>();let native:any;
 const parent={postMessage(){}};
 const context=vm.createContext({parent,crypto:webcrypto,Date,Uint8Array,console,
  addEventListener:(name:string,fn:(event:unknown)=>unknown)=>listeners.set(name,fn),
  setInterval:()=>1,clearInterval(){},setTimeout:()=>1,clearTimeout(){},
  document:{getElementById:()=>({})},
  DextDomHost:{createDomHost:(options:any)=>{native=options.native;return{
   ready:Promise.resolve(),readDiagnostics:()=>({inputVersion:1}),readInputSample:()=>null,
   acceptSnapshot:()=>Promise.resolve(),setPlaybackSuspended(){},dispose(){},
  };}}
 });
 const setup=Array.from(workbenchDocument.matchAll(/<script>([\s\S]*?)<\/script>/g),m=>m[1]).find(s=>s.startsWith('globalThis.DextWorkbenchSamples='));
 if(setup)vm.runInContext(setup,context);
 vm.runInContext(adapter,context);
 await listeners.get('message')!({source:parent,data:{type:'dext:workbench:init',token:'test',baseUrl:'http://v3preview.localhost/test/',
  room:{id:'test',startDesk:'one',desks:[{id:'one',components:[]}],resources:[]},
  settings:{showButtons:false,showOccupied:false,showComponents:false,cpuPercent:23,gpuPercent:7,audioLevel:.6}}});
 const samples:Record<string,any>={};
 for(const capability of ['time.read','hardware.read','media.read','audio.read'])native.subscribeData({capability},(value:unknown)=>samples[capability]=value);
 return {samples,control:async(settings:unknown)=>listeners.get('message')!({source:parent,data:{type:'dext:workbench:control',token:'test',settings}})};
}

describe('preview data uses production read shapes',()=>{
 it('renders clock, memory, volume and media with the Core field names',async()=>{
  const {samples}=await preview();
  expect(samples['time.read'].value).toMatchObject({localOffsetMinutes:0});
  expect(Number.isFinite(Date.parse(samples['time.read'].value.utc))).toBe(true);
  expect(samples['hardware.read'].value).toMatchObject({cpuPercent:23,gpuPercent:7,totalMemoryMB:32768,availableMemoryMB:16384});
  expect(samples['audio.read'].value).toEqual({level:.6,muted:false});
  expect(samples['media.read'].value).toMatchObject({albumTitle:'预览',positionMs:30000,durationMs:180000,canPause:true});
 });
 it('clears unavailable samples and restores the built-in source after a custom override',async()=>{
  const {samples,control}=await preview();
  await control({data:{'hardware.read':'missing','audio.read':'denied'}});
  expect(samples['hardware.read']).toEqual({status:'missing'});expect(samples['audio.read']).toEqual({status:'denied'});
  await control({data:{'hardware.read':'available','audio.read':'available'},samples:{'audio.read':{level:.2,muted:true}}});
  expect(samples['audio.read'].value).toEqual({level:.2,muted:true});
  await control({samples:{}});expect(samples['audio.read'].value).toEqual({level:.6,muted:false});
 });
});
