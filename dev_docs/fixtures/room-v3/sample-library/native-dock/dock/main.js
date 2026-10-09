// The same self-contained author code is shipped with both templates.
(() => {
  'use strict';
  const dock = document.getElementById('dock');
  const reads = ['time.read','hardware.read','media.read','audio.read'];
  let generation = 0, subscriptions = [], elements = [], frame = null, lastGeometry = '', lastConfig = '';
  const glyphs = {previous:'←',application:'◇',next:'→'};
  function readPath(value,path) {
    for (const key of path || []) { if (value === null || typeof value !== 'object' || !(key in value)) return undefined; value=value[key]; }
    return value;
  }
  function format(source,value) {
    const selected = readPath(value,source.path);
    if (selected === undefined || selected === null) throw new Error('missing');
    if (source.format === 'number') { if (typeof selected !== 'number' || !Number.isFinite(selected)) throw new Error('invalid number'); return selected.toLocaleString(undefined,{maximumFractionDigits:1}); }
    if (source.format === 'clock') { const date=new Date(selected); if (!Number.isFinite(date.getTime())) throw new Error('invalid clock'); return date.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit',second:'2-digit'}); }
    if (source.format === 'countdown') {
      const deadline=Date.parse(source.deadline),now=new Date(selected).getTime();
      if (!Number.isFinite(deadline) || !Number.isFinite(now)) throw new Error('invalid countdown');
      let seconds=Math.max(0,Math.floor((deadline-now)/1000));
      const days=Math.floor(seconds/86400);seconds%=86400;
      return days+'天 '+String(Math.floor(seconds/3600)).padStart(2,'0')+':'+String(Math.floor(seconds%3600/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
    }
    return (typeof selected === 'object' ? JSON.stringify(selected) : String(selected)).slice(0,160);
  }
  function queueGeometry() {
    if (frame !== null) return;
    frame=requestAnimationFrame(() => { frame=null; publishGeometry(); });
  }
  async function publishGeometry() {
    if (!Dext.session) return;
    const buttons=elements.filter(item=>item.buttonId).map(item=>{
      const rect=item.node.getBoundingClientRect();
      return {buttonId:item.buttonId,x:rect.x,y:rect.y,width:rect.width,height:rect.height};
    }).filter(rect=>rect.width>0&&rect.height>0);
    const signature=JSON.stringify(buttons);
    if(signature===lastGeometry)return;
    lastGeometry=signature;
    try { const result=await Dext.scene.publishGeometry({buttons}); if(result.status!=='accepted'){lastGeometry='';dock.dataset.geometry=result.status;}else dock.dataset.geometry='accepted'; }
    catch {lastGeometry='';dock.dataset.geometry='error';}
  }
  function render(config) {
    const signature=JSON.stringify(config);if(signature===lastConfig)return;lastConfig=signature;
    const current=++generation;
    for(const unsubscribe of subscriptions)unsubscribe();subscriptions=[];elements=[];
    const descriptor=config.template,enabled=new Set(config.enabledRegions||[]);
    if(!descriptor || !Array.isArray(descriptor.regions) || !descriptor.regions.every(region=>region&&typeof region.id==='string'&&['data','button'].includes(region.kind))){
      for(const readout of dock.querySelectorAll('.readout'))readout.hidden=true;
      dock.dataset.status='missing-template';return;
    }
    dock.dataset.template=descriptor.id;dock.dataset.theme=config.appearance?.theme||'midnight';
    const height=Number(config.appearance?.height),roundness=Number(config.appearance?.roundness);
    dock.style.setProperty('--height',(Number.isFinite(height)?Math.max(100,Math.min(280,height)):180)+'px');
    dock.style.setProperty('--roundness',(Number.isFinite(roundness)?Math.max(0,Math.min(40,roundness)):24)+'px');
    dock.replaceChildren();
    for(const region of descriptor.regions) {
      if(!enabled.has(region.id))continue;
      const node=document.createElement(region.kind==='button'?'button':'section');node.className='panel';node.dataset.region=region.id;
      if(region.kind==='button') {
        node.type='button';
        const glyph=document.createElement('span');glyph.className='button-glyph';glyph.textContent=glyphs[region.id]||'◇';node.append(glyph);
        const label=document.createElement('span');label.className='button-label';label.textContent=region.name;node.append(label);
        const buttonId=config.buttonSlots?.[region.id];node.disabled=typeof buttonId!=='string';
        node.addEventListener('click',()=>{if(buttonId)Dext.actions.activate(buttonId).then(result=>{node.dataset.action=result.status;}).catch(()=>{node.dataset.action='error';});});
        elements.push({node,buttonId});
      } else {
        const label=document.createElement('span');label.className='panel-label';label.textContent=region.name;node.append(label);
        const readout=document.createElement('span');readout.className='readout';readout.hidden=true;node.append(readout);
        const source=config.slots?.[region.id];
        if(!source || !reads.includes(source.capability))node.dataset.status='missing';
        else subscriptions.push(Dext.data.subscribe(source.capability,state=>{
          if(current!==generation)return;readout.hidden=true;node.dataset.status=state.status;
          if(state.status!=='available')return;
          try {readout.textContent=format(source,state.value);readout.hidden=false;}
          catch {node.dataset.status='error';}
        }));
        elements.push({node});
      }
      dock.append(node);
    }
    Dext.actions.list().then(result=>{
      if(current!==generation)return;
      for(const item of elements.filter(item=>item.buttonId)) {const button=result.buttons?.find(button=>button.id===item.buttonId);item.node.dataset.bound=String(button?.isBound===true);}
    }).catch(()=>{});
    dock.dataset.status='ready';lastGeometry='';queueGeometry();
  }
  const resize=new ResizeObserver(queueGeometry);resize.observe(dock);
  Dext.ready().then(()=>{
    render(Dext.config.get());
    Dext.config.subscribe(render);
    Dext.scene.subscribeGeometry(queueGeometry);
    Dext.desk.subscribe(queueGeometry);
  }).catch(()=>{dock.dataset.status='error';});
  window.addEventListener('pagehide',()=>{
    generation++;for(const unsubscribe of subscriptions)unsubscribe();resize.disconnect();
    if(frame!==null)cancelAnimationFrame(frame);Dext.dispose();
  },{once:true});
})();
