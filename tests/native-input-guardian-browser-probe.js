async (page) => {
  const isolated=await page.context().browser().newContext();page=await isolated.newPage();
  try {
  await page.route('http://guardian.localhost/**', route => route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Guardian fixture</title>'}));
  await page.goto('http://guardian.localhost/');
  const source=Buffer.from('__GUARD_SOURCE_BASE64__','base64').toString('utf8');
  const media=Buffer.from('__MEDIA_SOURCE_BASE64__','base64').toString('utf8');
  const secret='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  await page.context().addInitScript({
    content:"(()=>{if(this===this.top)return;const witnesses=[];Object.defineProperty(this,'__guardianWitnesses',{value:witnesses});Object.defineProperty(this,'chrome',{configurable:true,value:{webview:{postMessage(value){witnesses.push(value);}}}});}).call(this);\n"+
      source.replaceAll('__DEXT_INPUT_GUARDIAN_TOKEN__',secret)+"\n"+
      media.replaceAll('__DEXT_MEDIA_POLICY_TOKEN__',secret)
  });
  const html=String.raw`<!doctype html><style>button{width:150px;height:60px;margin:5px}</style>
    <div id=ancestor onclick="request('ancestor-old')"><button id=normal>listener</button></div>
    <button id=parser onclick="request('parser-inline')">parser</button><button id=property>property</button><button id=inline onclick="request('parser-inline')">inline</button>
    <button id=remove>removed</button><button id=once>once</button><button id=abort>abort</button><button id=object>object</button>
    <button id=keys>keys</button><div id=shadow></div>
    <svg width=180 height=80><rect id=svg x=5 y=5 width=160 height=65 onclick="request('svg-inline')"></rect></svg>
    <script>
    window.rows=[];window.requestIndex=0;window.heldEvent=null;
    window.request=label=>{
      const message={type:'dext:runtime:request',apiVersion:1,instanceId:'test-instance',sessionId:'00000000-0000-0000-0000-000000000001',token:'sdk-test-token',requestId:'r'+(++requestIndex),method:'actions.activate',params:{buttonId:'open'}};
      const accepted=window.__dextNativeInputRequestV1(JSON.stringify(message));rows.push({label,accepted});return accepted;
    };
    const normal=document.getElementById('normal'),property=document.getElementById('property');
    window.onclick=()=>request('window-property');document.onclick=()=>request('document-property');
    property.onclick=function(ev){request('property-'+ev.isTrusted);};
    normal.addEventListener('custom',()=>request('nested-custom'));
    normal.addEventListener('click',function(ev){
      request('listener-'+ev.isTrusted);if(!ev.isTrusted)return;
      heldEvent=ev;Promise.resolve().then(()=>request('promise'));queueMicrotask(()=>request('microtask'));setTimeout(()=>request('timer'),0);
      normal.dispatchEvent(new Event('custom'));normal.dispatchEvent(new MouseEvent('click',{bubbles:false}));
      request('outer-restored');document.getElementById('ancestor').setAttribute('onclick',"request('ancestor-updated')");
    });
    document.getElementById('inline').setAttribute('onclick',"request('dynamic-inline')");
    const removed=()=>request('removed');document.getElementById('remove').addEventListener('click',removed);document.getElementById('remove').removeEventListener('click',removed);
    document.getElementById('once').addEventListener('click',()=>request('once'),{once:true});
    const controller=new AbortController();document.getElementById('abort').addEventListener('click',()=>request('aborted'),{signal:controller.signal});controller.abort();
    const object={handleEvent(ev){rows.push({label:'object-this',accepted:this===object});request('object-'+ev.isTrusted);}};document.getElementById('object').addEventListener('click',object);
    const shadow=document.getElementById('shadow').attachShadow({mode:'closed'});shadow.innerHTML='<button id=shadowbutton onclick="request(\'closed-inline\')" style="width:150px;height:60px">closed</button>';window.closedButton=shadow.firstElementChild;
    document.getElementById('keys').addEventListener('keydown',ev=>request('keydown-'+ev.key));document.getElementById('keys').addEventListener('keyup',ev=>request('keyup-'+ev.key));
    window.addEventListener('message',()=>request('trusted-message'));
    const context=new AudioContext();context.addEventListener('statechange',()=>{});rows.push({label:'generic-audio',accepted:true});context.close();
    const bareRemoved=()=>request('bare-removed');addEventListener('click',bareRemoved);removeEventListener('click',bareRemoved);
    addEventListener('customGlobal',()=>request('nested-global-custom'));
    addEventListener('click',()=>{dispatchEvent(new Event('customGlobal'));request('bare-window-listener');});
    </script>`;
  await page.setContent('<iframe id=author style="width:900px;height:600px" srcdoc="'+html.replaceAll('&','&amp;').replaceAll('"','&quot;')+'"></iframe>');
  const frame=page.frames().find(f=>f!==page.mainFrame());
  if(!frame)throw Error('author frame not created');
  await frame.waitForFunction(()=>typeof window.__dextNativeInputGuardianV1==='function'&&typeof window.request==='function');
  const description=await frame.evaluate(secret=>window.__dextNativeInputGuardianV1({token:secret,kind:'describe'}),secret);
  if(description?.armed!==false)throw Error('guardian did not default closed');
  let gesture=0;
  async function arm(){return frame.evaluate(({secret,nonce,gesture})=>window.__dextNativeInputGuardianV1({token:secret,kind:'arm',documentNonce:nonce,gestureId:gesture,structuralVersion:1}),{secret,nonce:description.documentNonce,gesture:++gesture});}
  await frame.evaluate(()=>request('unarmed'));
  await arm();await frame.locator('#normal').click();await page.waitForTimeout(50);
  await frame.evaluate(()=>{document.getElementById('property').onclick(heldEvent);request('cached-outside');});
  for(const selector of ['#property','#parser','#inline','#remove','#once','#once','#abort','#object','#svg']){await arm();await frame.locator(selector).click();}
  await arm();await frame.evaluate(()=>closedButton.focus());await page.keyboard.press('Enter');
  await arm();await frame.locator('#keys').focus();await page.keyboard.press('Enter');
  await arm();await page.keyboard.press('Space');
  await arm();await frame.evaluate(()=>window.postMessage('from-author','*'));await page.waitForTimeout(30);
  const result=await frame.evaluate(()=>({rows,witnesses:__guardianWitnesses,hook:Object.getOwnPropertyDescriptor(window,'__dextNativeInputGuardianV1').writable,requestHook:Object.getOwnPropertyDescriptor(window,'__dextNativeInputRequestV1').writable,media:typeof window.__dextNativeMediaPolicyV1,shadowLocked:Object.getOwnPropertyDescriptor(Element.prototype,'attachShadow').configurable}));
  const required=['listener-true','generic-audio','bare-window-listener','window-property','document-property','outer-restored','ancestor-updated','property-true','parser-inline','dynamic-inline','once','object-true','svg-inline','closed-inline','keydown-Enter','keyup-Enter','keydown- ','keyup- '];
  for(const label of required)if(!result.rows.some(row=>row.label===label&&row.accepted===true))throw Error('missing trusted success '+label+' '+JSON.stringify(result.rows));
  const forbidden=['unarmed','bare-removed','nested-global-custom','nested-custom','listener-false','promise','microtask','timer','property-true','cached-outside','removed','aborted','trusted-message'];
  for(const row of result.rows)if(forbidden.includes(row.label)&&row.accepted&&(row.label!=='property-true'))throw Error('forbidden success '+JSON.stringify(row));
  if(result.rows.filter(r=>r.label==='property-true'&&r.accepted).length!==1)throw Error('cached event replay accepted');
  if(result.rows.filter(r=>r.label==='once').length!==1)throw Error('once semantics changed');
  if(result.hook!==false||result.requestHook!==false||result.shadowLocked!==false||result.media!=='function')throw Error('bootstrap protection/media combination changed');
  await frame.evaluate(async()=>{
    const child=document.createElement('iframe');child.id='borrowRealm';child.src='http://guardian.localhost/blank';document.body.append(child);
    await new Promise(resolve=>child.addEventListener('load',resolve,{once:true}));
    const property=document.getElementById('property');let borrowed=null;
    try{borrowed=Object.getOwnPropertyDescriptor(child.contentWindow.HTMLElement.prototype,'onclick').get.call(property);}
    catch(error){if(error.name!=='SecurityError'&&error.name!=='TypeError')throw error;}
    if(borrowed)property.addEventListener('click',ev=>queueMicrotask(()=>borrowed.call(property,ev)),{once:true});
  });
  await arm();await frame.locator('#property').click();await page.waitForTimeout(20);
  const replayRows=await frame.evaluate(()=>rows.filter(row=>row.label==='property-true'));
  if(replayRows.filter(row=>row.accepted).length!==2)throw Error('foreign realm getter exposed a hidden wrapper and revived microtask authority '+JSON.stringify(replayRows));
  await frame.evaluate(()=>{
    const child=document.getElementById('borrowRealm'),target=document.createElement('button');target.id='adoptedButton';target.textContent='adopted';
    target.onclick=()=>request('adopted-parent-handler');document.body.append(target);
    child.contentDocument.adoptNode(target);child.contentDocument.body.append(target);
    let borrowed=null;
    try{borrowed=Object.getOwnPropertyDescriptor(child.contentWindow.HTMLElement.prototype,'onclick').get.call(target);}
    catch(error){if(error.name!=='SecurityError'&&error.name!=='TypeError')throw error;}
    if(borrowed)document.getElementById('normal').addEventListener('click',ev=>queueMicrotask(()=>borrowed.call(document.getElementById('normal'),ev)),{once:true});
  });
  await arm();await frame.locator('#normal').click();await page.waitForTimeout(20);
  if(await frame.evaluate(()=>rows.some(r=>r.label==='adopted-parent-handler'&&r.accepted)))throw Error('adopting a DOM node exposed its former document hidden wrapper');
  const child=page.frames().find(f=>f.parentFrame()===frame&&f.url()==='http://guardian.localhost/blank');
  if(!child)throw Error('adopted child native document missing');
  await arm();await child.locator('#adoptedButton').click();
  if(await frame.evaluate(()=>rows.some(r=>r.label==='adopted-parent-handler'&&r.accepted)))throw Error('native click in a child document borrowed former parent input context');
  const nativeError=await frame.evaluate(()=>new Promise(resolve=>{
    window.onerror=function(message,source,line,column,error){window.onerror=null;resolve({argumentCount:arguments.length,hasError:error instanceof Error,accepted:request('onerror')});return true;};
    setTimeout(()=>{throw Error('Owned guardian onerror fixture');},0);
  }));
  if(nativeError.argumentCount!==5||nativeError.hasError!==true||nativeError.accepted!==false)throw Error('native Window.onerror arguments or non-input boundary changed '+JSON.stringify(nativeError));
  await frame.evaluate(({secret,nonce})=>window.__dextNativeInputGuardianV1({token:secret,kind:'revoke',documentNonce:nonce}),{secret,nonce:description.documentNonce});
  await frame.locator('#property').click();
  if(await frame.evaluate(()=>rows.at(-1).accepted)!==false)throw Error('revoked guardian accepted');
  return {browser:await page.evaluate(()=>navigator.userAgent),checks:required.length+forbidden.length+9,rows:result.rows,witnesses:result.witnesses.length,combinedMedia:true};
  }finally{await isolated.close();}
}
