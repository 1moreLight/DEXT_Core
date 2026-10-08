(() => {
'use strict';
const releases=[];let connected=false,frame=0,elapsed=0,last=0,life=null,finishing=false,disposed=false;
function resume(){if(!frame&&!disposed&&life?.stage==='starting'&&!life.playbackPaused&&!life.locked&&!finishing)frame=requestAnimationFrame(tick);}
function retry(){finishing=false;last=0;resume();}
function tick(now){frame=0;if(disposed||!life||life.stage!=='starting'||life.playbackPaused||life.locked)return;elapsed+=last?Math.min(100,Math.max(0,now-last)):0;last=now;document.getElementById('progress').style.width=Math.min(100,elapsed/12)+'%';if(elapsed>=1200&&!finishing){finishing=true;Dext.scene.done().then(result=>{if(result.status!=='accepted')retry();}).catch(retry);}resume();}
function connect(){if(connected||!Dext.session)return;connected=true;releases.push(Dext.lifecycle.subscribe(next=>{life=next;document.body.dataset.stage=next.stage;document.getElementById('headline').textContent=next.stage==='idle'?'星轨仍在，暂且休息':'正在对齐星轨';document.getElementById('caption').textContent=next.stage==='idle'?'移动鼠标以返回桌面。':'一份星空，三个桌面。';if(frame){cancelAnimationFrame(frame);frame=0;}last=0;resume();}));}
addEventListener('dext:ready',connect,{once:true});addEventListener('pagehide',()=>{disposed=true;if(frame)cancelAnimationFrame(frame);releases.forEach(fn=>fn());Dext.dispose();},{once:true});connect();
})();