(() => {
 'use strict';
 const buttons=[...document.querySelectorAll('[data-dext-button]')],releases=[];
 let connected=false,frame=0,lastGeometry='';
 function select(id){document.body.dataset.desk=id;for(const button of buttons){if(button.dataset.desk===id)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');}}
 function geometry(){if(frame||!connected)return;frame=requestAnimationFrame(async()=>{frame=0;const regions=buttons.map(button=>{const r=button.getBoundingClientRect();return {buttonId:button.dataset.dextButton,x:r.x,y:r.y,width:r.width,height:r.height};}),signature=JSON.stringify(regions);if(signature===lastGeometry)return;try{const reply=await Dext.scene.publishGeometry({buttons:regions});if(reply.status==='accepted')lastGeometry=signature;}catch{lastGeometry='';}});}
 for(const button of buttons)button.addEventListener('click',()=>{if(connected)Dext.actions.activate(button.dataset.dextButton).catch(()=>{});});
 function connect(){if(connected||!Dext.session)return;connected=true;releases.push(Dext.desk.subscribe(value=>{select(value.targetDeskId||value.currentDeskId);geometry();}));releases.push(Dext.scene.subscribeGeometry(()=>{lastGeometry='';geometry();}));geometry();}
 const observer=new ResizeObserver(geometry);observer.observe(document.querySelector('nav'));
 addEventListener('dext:ready',connect,{once:true});addEventListener('resize',geometry);
 addEventListener('pagehide',()=>{if(frame)cancelAnimationFrame(frame);observer.disconnect();releases.forEach(dispose=>dispose());Dext.dispose();},{once:true});select('home');connect();
})();
