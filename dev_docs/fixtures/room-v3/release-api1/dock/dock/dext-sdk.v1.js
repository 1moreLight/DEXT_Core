(function (root) {
  'use strict';
  // Tokens identify an iframe connection. They never prove native input or permission.
  const parentWindow = root.parent;
  const nativeInputRequest = typeof root.__dextNativeInputRequestV1 === "function" ? root.__dextNativeInputRequestV1 : null;
  const VERSION = 1, MAX_BYTES = 32768, MAX_PENDING = 64, REQUEST_TIMEOUT = 5000;
  const CAPABILITIES = new Set(['desk.read', 'desk.navigate', 'time.read', 'hardware.read', 'media.read', 'media.control',
    'audio.read', 'audio.control', 'storage.read', 'storage.write', 'binding.launch', 'dext.exit']);
  const DATA_CAPABILITIES = new Set(['time.read', 'hardware.read', 'media.read', 'audio.read']);
  const CAPABILITY_STATUS = new Set(['available', 'denied', 'unsupported']);
  const DATA_STATUS = new Set(['available', 'missing', 'denied', 'unsupported', 'error']);
  const channels = new Map(), latest = new Map(), sequences = new Map(), pending = new Map();
  let session = null, disposed = false, nextRequest = 0, lastError = null;
  let resolveReady, rejectReady;
  const readyPromise = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  // A document may dispose before anyone asks for ready; that must not leak a rejection.
  readyPromise.catch(() => {});
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const id = value => typeof value === 'string' && /^[A-Za-z0-9_.-]{1,80}$/.test(value);
  const text = (value, maximum = 160) => typeof value === 'string' && value.length > 0 && value.length <= maximum;
  const revision = value => Number.isSafeInteger(value) && value >= 0;
  function failure(code) { const error = new Error('Dext: ' + code); error.name = 'DextError'; error.code = code; return error; }
  function diagnose(code, scope) { lastError = { code, ...(scope ? { scope } : {}) }; }
  function wire(value) {
    const seen = new Set();
    function inspect(part, depth) {
      if (depth > 24) throw failure('payloadTooDeep');
      if (part === null || typeof part === 'string' || typeof part === 'boolean') return;
      if (typeof part === 'number' && Number.isFinite(part)) return;
      if (typeof part !== 'object' || seen.has(part)) throw failure('invalidPayload');
      seen.add(part);
      const values = Array.isArray(part) ? part : Object.values(part);
      if (values.length > 4096) throw failure('payloadTooLarge');
      for (const item of values) inspect(item, depth + 1);
      seen.delete(part);
    }
    inspect(value, 0);
    const json = JSON.stringify(value);
    // UTF-8 is at most three bytes per UTF-16 code unit; avoid browser-specific encoders.
    let bytes = 0;
    for (let index = 0; index < json.length; index++) {
      const code = json.charCodeAt(index);
      if (code < 128) bytes++;
      else if (code < 2048) bytes += 2;
      else if (code >= 0xd800 && code <= 0xdbff && index + 1 < json.length && json.charCodeAt(index + 1) >= 0xdc00 && json.charCodeAt(index + 1) <= 0xdfff) { bytes += 4; index++; }
      else bytes += 3;
      if (bytes > MAX_BYTES) throw failure('payloadTooLarge');
    }
    return JSON.parse(json);
  }
  function immutable(value) {
    const copy = wire(value);
    function freeze(part) { if (part && typeof part === 'object') { for (const child of Object.values(part)) freeze(child); Object.freeze(part); } }
    freeze(copy); return copy;
  }
  function lifeValid(value) {
    return object(value) && ['starting', 'desktop', 'idle'].includes(value.stage) &&
      typeof value.playbackPaused === 'boolean' && typeof value.locked === 'boolean' && revision(value.revision);
  }
  function snapshotValid(value, expectedSession) {
    return object(value) && value.protocolVersion === VERSION && value.sessionId === expectedSession && text(value.roomId, 128) &&
      text(value.installationStamp, 128) && revision(value.revision) && value.revision > 0 && id(value.currentDeskId) &&
      [value.targetDeskId, value.queuedDeskId].every(value => value === null || id(value)) &&
      (value.targetDeskId === null ? value.transitionId === null && value.deadlineUtc === null :
        text(value.transitionId, 128) && typeof value.deadlineUtc === 'string' && Number.isFinite(Date.parse(value.deadlineUtc))) &&
      typeof value.active === 'boolean' && typeof value.operable === 'boolean' && lifeValid(value.lifecycle);
  }
  function capsValid(value) { return object(value) && Object.entries(value).every(([key, status]) => CAPABILITIES.has(key) && CAPABILITY_STATUS.has(status)); }
  function viewportValid(value) {
    return object(value) && Number.isFinite(value.width) && value.width >= 64 && value.width <= 16384 &&
      Number.isFinite(value.height) && value.height >= 64 && value.height <= 16384 &&
      Number.isFinite(value.dpr) && value.dpr >= 0.5 && value.dpr <= 8;
  }
  function placementsValid(value) {
    return object(value) && Object.keys(value).length <= 128 && Object.entries(value).every(([key, rect]) =>
      key.startsWith('component.') && id(key.slice(10)) && (rect === null || object(rect) &&
        Object.keys(rect).length === 4 && ['x', 'y', 'width', 'height'].every(field =>
          Number.isFinite(rect[field]) && rect[field] >= 0 && rect[field] <= 16384) && rect.width > 0 && rect.height > 0));
  }
  function initValid(value) {
    return value.apiVersion === VERSION && text(value.instanceId) && text(value.sessionId, 128) && text(value.token, 256) &&
      text(value.consumerId, 100) && ['scene', 'widget', 'dock', 'html', 'media'].includes(value.kind) && capsValid(value.capabilities) &&
      object(value.config) && viewportValid(value.viewport) && revision(value.geometryVersion) &&
      (value.placements === undefined || placementsValid(value.placements)) &&
      snapshotValid(value.snapshot, value.sessionId);
  }
  function publicSession() {
    if (!session) return null;
    return immutable({ apiVersion: VERSION, instanceId: session.instanceId, sessionId: session.sessionId, consumerId: session.consumerId,
      kind: session.kind, capabilities: session.capabilities, config: session.config, viewport: session.viewport,
      geometryVersion: session.geometryVersion, placements: session.placements, snapshot: session.snapshot });
  }
  function identity(type) { return { type, apiVersion: VERSION, instanceId: session.instanceId, sessionId: session.sessionId, token: session.token }; }
  function notify(method, params = {}) {
    if (!session || disposed) return;
    try { parentWindow.postMessage(wire({ ...identity('dext:runtime:notify'), method, params }), '*'); }
    catch (_) { diagnose('transportUnavailable', method); }
  }
  function request(method, params = {}) {
    if (disposed) return Promise.reject(failure('disposed'));
    if (!session) return Promise.reject(failure('notReady'));
    if (pending.size >= MAX_PENDING) return Promise.reject(failure('requestLimit'));
    if (nextRequest >= Number.MAX_SAFE_INTEGER) return Promise.reject(failure('requestLimit'));
    let message;
    const requestId = 'r' + (++nextRequest);
    try { message = wire({ ...identity('dext:runtime:request'), requestId, method, params }); }
    catch (error) { return Promise.reject(error); }
    return new Promise((resolve, reject) => {
      if(nativeInputRequest && ['actions.activate','desk.navigate','media.control','audio.control'].includes(method)){
        try{if(nativeInputRequest(JSON.stringify(message))!==true){reject(failure('inputRequired'));return;}}
        catch(_){reject(failure('inputRequired'));return;}
      }
      const timer = root.setTimeout(() => { pending.delete(requestId); diagnose('timeout', method); reject(failure('timeout')); }, REQUEST_TIMEOUT);
      pending.set(requestId, { resolve, reject, timer });
      try { parentWindow.postMessage(message, '*'); }
      catch (_) { root.clearTimeout(timer); pending.delete(requestId); diagnose('transportUnavailable', method); reject(failure('transportUnavailable')); }
    });
  }
  function deliver(key, payload) {
    if (disposed) return;
    latest.set(key, immutable(payload));
    for (const callback of [...(channels.get(key) || [])]) {
      if (disposed) return;
      try { callback(immutable(payload)); } catch (_) { diagnose('subscriberError', key); }
    }
  }
  function subscriptionMethod(key, suffix) {
    if (key.startsWith('data:')) notify('data.' + suffix, { capability: key.slice(5) });
    else notify(key + '.' + suffix);
  }
  function subscribe(key, callback) {
    if (disposed) throw failure('disposed');
    if (typeof callback !== 'function') throw new TypeError('listener must be a function');
    const listeners = channels.get(key) || new Set();
    if (listeners.size >= 128) throw failure('subscriptionLimit');
    const first = listeners.size === 0;
    // Separate registrations have independent disposal even for the same function.
    const registered = value => callback(value);
    listeners.add(registered); channels.set(key, listeners);
    if (first && session) subscriptionMethod(key, 'subscribe');
    if (latest.has(key)) {
      try { callback(immutable(latest.get(key))); } catch (_) { diagnose('subscriberError', key); }
    }
    let removed = false;
    return () => {
      if (removed) return; removed = true;
      listeners.delete(registered);
      if (listeners.size === 0) { channels.delete(key); subscriptionMethod(key, 'unsubscribe'); }
    };
  }
  function dataInitial(capability) { return { status: session.capabilities[capability] === 'available' ? 'missing' : session.capabilities[capability] || 'unsupported' }; }
  function dispose() {
    if (disposed) return;
    for (const key of channels.keys()) subscriptionMethod(key, 'unsubscribe');
    notify('dispose'); disposed = true;
    root.removeEventListener('message', receive);
    for (const item of pending.values()) { root.clearTimeout(item.timer); item.reject(failure('disposed')); }
    pending.clear(); channels.clear(); latest.clear(); sequences.clear(); session = null;
    rejectReady(failure('disposed'));
  }
  function receive(event) {
    if (disposed || event.source !== parentWindow || !object(event.data)) return;
    let value;
    try { value = wire(event.data); } catch (_) { diagnose('invalidMessage'); return; }
    if (value.type === 'dext:runtime:init') {
      if (session || !initValid(value)) return;
      session = { ...value, placements: value.placements || {} };
      latest.set('desk', immutable(value.snapshot)); latest.set('lifecycle', immutable(value.snapshot.lifecycle));
      latest.set('config', immutable(value.config)); latest.set('capabilities', immutable(value.capabilities));
      latest.set('geometry', immutable({ geometryVersion: value.geometryVersion, viewport: value.viewport, placements: session.placements }));
      for (const capability of Object.keys(value.capabilities)) if (DATA_CAPABILITIES.has(capability)) latest.set('data:' + capability, immutable(dataInitial(capability)));
      notify('ready');
      for (const key of channels.keys()) {
        if (disposed) return;
        subscriptionMethod(key, 'subscribe');
        if (latest.has(key)) deliver(key, latest.get(key));
      }
      if (disposed) return;
      const info = publicSession(); resolveReady(info);
      root.dispatchEvent(new root.CustomEvent('dext:ready', { detail: info }));
      return;
    }
    if (!session || value.apiVersion !== VERSION || value.instanceId !== session.instanceId ||
      value.sessionId !== session.sessionId || value.token !== session.token) return;
    if (value.type === 'dext:runtime:dispose') { dispose(); return; }
    if (value.type === 'dext:runtime:response') {
      const item = pending.get(value.requestId);
      if (!item || typeof value.ok !== 'boolean' || (value.ok && !Object.hasOwn(value, 'result')) ||
        (!value.ok && (!object(value.error) || !id(value.error.code)))) return;
      pending.delete(value.requestId); root.clearTimeout(item.timer);
      if (value.ok) item.resolve(immutable(value.result));
      else { diagnose(value.error.code); item.reject(failure(value.error.code)); }
      return;
    }
    if (value.type !== 'dext:runtime:event' || !revision(value.sequence) || value.sequence < 1 || !text(value.event, 40)) return;
    const payload = value.payload;
    const key = value.event === 'data' && object(payload) ? 'data:' + payload.capability : value.event;
    if (value.sequence <= (sequences.get(key) || 0)) return;
    if (value.event === 'desk') {
      if (!snapshotValid(payload, session.sessionId) || payload.revision <= session.snapshot.revision ||
        payload.roomId !== session.snapshot.roomId || payload.installationStamp !== session.snapshot.installationStamp ||
        payload.lifecycle.revision < session.snapshot.lifecycle.revision) return;
      session.snapshot = payload; deliver('desk', payload); deliver('lifecycle', payload.lifecycle);
    } else if (value.event === 'lifecycle') {
      if (!lifeValid(payload) || payload.revision <= session.snapshot.lifecycle.revision) return;
      session.snapshot = { ...session.snapshot, lifecycle: payload }; deliver('lifecycle', payload);
    } else if (value.event === 'geometry') {
      if (!object(payload) || !revision(payload.geometryVersion) || payload.geometryVersion < session.geometryVersion ||
        (payload.viewport !== undefined && !viewportValid(payload.viewport)) ||
        (payload.placements !== undefined && !placementsValid(payload.placements))) return;
      const viewport = payload.viewport || session.viewport, placements = payload.placements || session.placements;
      if (payload.geometryVersion === session.geometryVersion && JSON.stringify(viewport) === JSON.stringify(session.viewport) &&
        JSON.stringify(placements) === JSON.stringify(session.placements)) { sequences.set(key, value.sequence); return; }
      session.geometryVersion = payload.geometryVersion; session.viewport = viewport; session.placements = placements;
      deliver('geometry', { geometryVersion: session.geometryVersion, viewport, placements });
    } else if (value.event === 'config') {
      if (!object(payload)) return; session.config = payload; deliver('config', payload);
    } else if (value.event === 'capabilities') {
      if (!capsValid(payload) || Object.keys(payload).length !== Object.keys(session.capabilities).length ||
        Object.keys(payload).some(key => !Object.hasOwn(session.capabilities, key))) return;
      const previous = session.capabilities; session.capabilities = payload;
      for (const capability of Object.keys(payload)) if (DATA_CAPABILITIES.has(capability) && previous[capability] !== payload[capability]) deliver('data:' + capability, dataInitial(capability));
      deliver('capabilities', payload);
    } else if (value.event === 'data') {
      if (!object(payload) || !DATA_CAPABILITIES.has(payload.capability) || !Object.hasOwn(session.capabilities, payload.capability) ||
        session.capabilities[payload.capability] !== 'available' || !object(payload.state) || !DATA_STATUS.has(payload.state.status) ||
        (payload.state.status === 'available' && !Object.hasOwn(payload.state, 'value'))) return;
      deliver(key, payload.state.status === 'available' ? { status: 'available', value: payload.state.value } : { status: payload.state.status });
    } else return;
    if (!disposed) sequences.set(key, value.sequence);
  }
  function buttonRequest(buttonId) { return id(buttonId) ? request('actions.activate', { buttonId }) : Promise.reject(failure('invalidArgument')); }
  root.addEventListener('message', receive);
  root.Dext = Object.freeze({
    apiVersion: VERSION,
    get session() { return publicSession(); },
    ready: () => disposed ? Promise.reject(failure('disposed')) : readyPromise,
    dispose,
    diagnostics: () => immutable({ disposed, ready: !!session, pendingRequests: pending.size, subscriptions: [...channels].reduce((count, [, values]) => count + values.size, 0), lastError }),
    desk: Object.freeze({ get: () => request('desk.get'), subscribe: callback => subscribe('desk', callback),
      navigate: action => object(action) && ['desk.next', 'desk.previous', 'desk.go'].includes(action.type) &&
        (action.type === 'desk.go' ? id(action.deskId) : action.deskId === undefined)
        ? request('desk.navigate', { action }) : Promise.reject(failure('invalidArgument')) }),
    lifecycle: Object.freeze({ subscribe: callback => subscribe('lifecycle', callback) }),
    config: Object.freeze({ get: () => immutable(session ? session.config : {}), subscribe: callback => subscribe('config', callback) }),
    capabilities: Object.freeze({ get: () => immutable(session ? session.capabilities : {}), subscribe: callback => subscribe('capabilities', callback) }),
    data: Object.freeze({
      subscribe(capability, callback) {
        if (!DATA_CAPABILITIES.has(capability) || (session && !Object.hasOwn(session.capabilities, capability))) throw failure('undeclaredCapability');
        return subscribe('data:' + capability, callback);
      },
      bindReadout(capability, element, render) {
        if (!element || typeof render !== 'function') throw new TypeError('readout element and renderer required');
        element.hidden = true;
        return this.subscribe(capability, state => {
          element.hidden = true;
          if (state.status !== 'available') return;
          try { render(state.value, element); element.hidden = false; }
          catch (_) { diagnose('renderError', capability); }
        });
      },
    }),
    actions: Object.freeze({ list: () => request('actions.list'), activate: buttonRequest }),
    storage: Object.freeze({ get: key => id(key) ? request('storage.get', { key }) : Promise.reject(failure('invalidArgument')),
      set: (key, value) => id(key) ? request('storage.set', { key, value }) : Promise.reject(failure('invalidArgument')) }),
    media: Object.freeze({ control: action => ['play', 'pause', 'toggle', 'next', 'previous'].includes(action) ? request('media.control', { action }) : Promise.reject(failure('invalidArgument')) }),
    audio: Object.freeze({ control: settings => object(settings) && Object.keys(settings).every(key => ['volume', 'muted'].includes(key)) &&
      Object.keys(settings).length > 0 && (settings.volume === undefined || (typeof settings.volume === 'number' && settings.volume >= 0 && settings.volume <= 1)) &&
      (settings.muted === undefined || typeof settings.muted === 'boolean') ? request('audio.control', { settings }) : Promise.reject(failure('invalidArgument')) }),
    scene: Object.freeze({
      subscribeGeometry: callback => subscribe('geometry', callback),
      publishGeometry(report) {
        if (!session) return Promise.reject(failure(disposed ? 'disposed' : 'notReady'));
        if (!object(report) || Object.keys(report).some(key => !['groups', 'occupied', 'buttons'].includes(key))) return Promise.reject(failure('invalidArgument'));
        return request('scene.publishGeometry', { report: { ...report, sessionId: session.sessionId, revision: session.snapshot.revision,
          transitionId: session.snapshot.transitionId, geometryVersion: session.geometryVersion } });
      },
      completeTransition(transitionId) {
        if (!session) return Promise.reject(failure(disposed ? 'disposed' : 'notReady'));
        if (session.consumerId !== 'scene') return Promise.reject(failure('forbidden'));
        if (!text(transitionId, 128) || transitionId !== session.snapshot.transitionId) return Promise.reject(failure('staleTransition'));
        return request('scene.completeTransition', { transitionId });
      },
      done() {
        if (!session) return Promise.reject(failure(disposed ? 'disposed' : 'notReady'));
        if (session.consumerId !== 'slot.start' || session.snapshot.lifecycle.stage !== 'starting') return Promise.reject(failure('forbidden'));
        return request('scene.done');
      },
    }),
  });
})(globalThis);
