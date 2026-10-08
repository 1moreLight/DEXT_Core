(() => {
'use strict';
const releases=[],preview=new URLSearchParams(location.search).has('preview'),instance=crypto.randomUUID().slice(0,6);
let connected=false,count=0,frame=0,lastGeometry='',storageAvailable=false,loaded=false,loading=false,savePending=false,needsSave=false,disposed=false,snapshot=null;
const states={denied:'未授权',missing:'暂无数据',unsupported:'暂不支持',error:'读取失败'};
document.getElementById('document-id').textContent=instance;
const button=document.getElementById('cycle');
function paintCount(){document.getElementById('count').textContent=String(count).padStart(2,'0');}
function geometry(){if(frame||!connected)return;frame=requestAnimationFrame(async()=>{frame=0;const r=button.getBoundingClientRect(),buttons=[{buttonId:'next',x:r.x,y:r.y,width:r.width,height:r.height}],signature=JSON.stringify(buttons);if(signature===lastGeometry)return;try{const result=await Dext.scene.publishGeometry({buttons});if(result.status==='accepted')lastGeometry=signature;}catch{lastGeometry='';}});}
function applyConfig(config){document.getElementById('title').textContent=typeof config.title==='string'?config.title:'轨道观测台';document.getElementById('phase').textContent=typeof config.phase==='string'?config.phase:'01';geometry();}
function read(capability,render,unavailable){releases.push(Dext.data.subscribe(capability,state=>{if(state.status!=='available'){unavailable(states[state.status]||'等待数据');return;}try{render(state.value);}catch{unavailable('数据格式未知');}}));}
function memoryState(text){document.getElementById('memory-state').textContent='本机记忆 · '+text;}
async function loadMemory(){if(loaded||loading||disposed||!storageAvailable)return;loading=true;try{const value=await Dext.storage.get('orbit-clicks');if(Number.isSafeInteger(value)&&value>=0){count=Math.min(999999,count+value);paintCount();}loaded=true;memoryState('已读回');}catch{memoryState('暂不可读');}finally{loading=false;}}
async function saveMemory(){if(!storageAvailable||!loaded||!needsSave||savePending||disposed||!snapshot?.operable||snapshot.targetDeskId)return;savePending=true;const value=count;try{const result=await Dext.storage.set('orbit-clicks',value);if(result.status==='accepted'){needsSave=count!==value;memoryState('已保存');}else memoryState('保存未完成');}catch{memoryState('暂不可写');}finally{savePending=false;}}
button.addEventListener('click',()=>{count=Math.min(999999,count+1);needsSave=true;paintCount();if(connected)Dext.actions.activate('next').then(()=>saveMemory()).catch(()=>{});});
function connect(){
if(connected||!Dext.session)return;connected=true;releases.push(Dext.config.subscribe(applyConfig));releases.push(Dext.scene.subscribeGeometry(geometry));releases.push(Dext.desk.subscribe(s=>{snapshot=s;geometry();if(!s.targetDeskId)saveMemory();}));
releases.push(Dext.capabilities.subscribe(caps=>{storageAvailable=caps['storage.read']==='available'&&caps['storage.write']==='available';if(storageAvailable)loadMemory().then(saveMemory);else memoryState('待授权');}));
read('time.read',v=>{const date=new Date(v.utc);if(!Number.isFinite(date.getTime()))throw Error();document.getElementById('clock').textContent=date.toLocaleTimeString('zh-CN',{hour12:false});document.getElementById('time-state').textContent='系统时间 · 实时';},state=>{document.getElementById('clock').textContent='--:--:--';document.getElementById('time-state').textContent=state;});
read('hardware.read',v=>{if(!Number.isFinite(v.cpuPercent))throw Error();document.getElementById('cpu').textContent=v.cpuPercent.toFixed(1)+'%';const used=Number(v.totalMemoryMB)-Number(v.availableMemoryMB);document.getElementById('memory').textContent=Number.isFinite(used)&&v.totalMemoryMB>0?(Math.max(0,used)/1024).toFixed(1)+' / '+(v.totalMemoryMB/1024).toFixed(1)+' GB':'—';},()=>{document.getElementById('cpu').textContent='—';document.getElementById('memory').textContent='—';});
read('audio.read',v=>{if(!Number.isFinite(v.volume))throw Error();document.getElementById('volume').textContent=v.muted?'静音':Math.round(v.volume*100)+'%';},()=>{document.getElementById('volume').textContent='—';});
read('media.read',v=>{document.getElementById('track').textContent=v.hasSession?(String(v.title||'无标题')+(v.artist?' / '+String(v.artist):'')):'没有播放会话';},state=>{document.getElementById('track').textContent='媒体 · '+state;});
applyConfig(Dext.config.get());geometry();}
if(preview){document.getElementById('time-state').textContent='预览 · 真实读数需 Dext 授权';memoryState('预览不保存');}
addEventListener('dext:ready',connect,{once:true});addEventListener('resize',geometry);addEventListener('pagehide',()=>{disposed=true;if(frame)cancelAnimationFrame(frame);releases.forEach(fn=>fn());Dext.dispose();},{once:true});connect();paintCount();
})();