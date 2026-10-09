(function (root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DextMediaHost = api;
})(typeof globalThis === 'object' ? globalThis : this, function (root) {
  'use strict';
  const TYPES = new Set(['image', 'gif', 'video', 'html']);
  function failure(code) { const error = new Error('Dext media: ' + code); error.code = code; return error; }
  function createMediaHost(options) {
    const document = options.document || root.document;
    const now = options.now || (() => root.performance.now());
    const later = options.setTimeout || root.setTimeout.bind(root);
    const cancel = options.clearTimeout || root.clearTimeout.bind(root);
    const records = new Map();
    let disposed = false, lastError = null, playbackSuspended = options.initialPlaybackSuspended === true;
    function diagnose(code) { lastError = { code }; }
    function current(record) {
      const snapshot = options.getSnapshot();
      return !disposed && !record.disposed && records.get(record.instanceId) === record &&
        snapshot && snapshot.sessionId === record.sessionId ? snapshot : null;
    }
    function playing(record) {
      const snapshot = current(record);
      if (playbackSuspended || !snapshot || !snapshot.active || snapshot.lifecycle.playbackPaused || snapshot.lifecycle.locked || record.state !== 'active') return false;
      const stage = record.consumerId === 'slot.start' ? 'starting' : record.consumerId === 'slot.idle' ? 'idle' : 'desktop';
      return snapshot.lifecycle.stage === stage;
    }
    function clearTimer(record) {
      record.timerEpoch++;
      if (record.timer !== null) {
        cancel(record.timer); record.timer = null;
        record.remaining = Math.max(0, record.remaining - Math.max(0, now() - record.timerStarted));
      }
    }
    function timeoutReason(record) {
      if (record.reason) return record.reason;
      return record.type === 'video' ? (record.loaded ? 'videoStalled' : 'videoUnavailable') :
        record.type === 'html' ? 'htmlTimeout' : record.type + 'Elapsed';
    }
    function schedule(record) {
      if (record.timer !== null || record.finished || record.completing || record.consumerId !== 'slot.start' || !playing(record)) return;
      const epoch = ++record.timerEpoch;
      record.timerStarted = now();
      record.timer = later(() => {
        if (record.timerEpoch !== epoch || !current(record)) return;
        record.timer = null; record.remaining = 0;
        if (playing(record)) complete(record, timeoutReason(record));
      }, record.remaining);
    }
    function completionResult(record, accepted) {
      if (!current(record)) return;
      record.completing = false;
      if (accepted || current(record).lifecycle.stage !== 'starting') {
        record.finished = true; clearTimer(record); return;
      }
      // One request at a time. Storage/transient failure does not silently finish
      // a Core phase, and an active-time retry never burns a pause/lock budget.
      diagnose('completionUnavailable'); record.remaining = 1000; schedule(record);
    }
    function complete(record, reason) {
      const snapshot = current(record);
      if (!snapshot || record.consumerId !== 'slot.start' || snapshot.lifecycle.stage !== 'starting' || !playing(record) || record.finished || record.completing) return false;
      clearTimer(record); record.reason = reason; record.remaining = 0; record.completing = true;
      const request = Object.freeze({ instanceId: record.instanceId, consumerId: record.consumerId, sessionId: snapshot.sessionId,
        revision: snapshot.revision, lifecycleRevision: snapshot.lifecycle.revision, reason });
      try {
        Promise.resolve(options.onStartupComplete(request)).then(reply => completionResult(record, reply?.status === 'accepted'),
          () => completionResult(record, false));
      } catch (_) { completionResult(record, false); }
      return true;
    }
    function sync(record) {
      const active = playing(record);
      if (!active) clearTimer(record);
      if (record.type === 'html') {
        const state = active ? 'active' : 'suspended';
        if (record.htmlState !== state) { record.htmlState = state; options.setHTMLState?.(record.instanceId, state); }
      }
      if (record.type === 'video' && active !== record.lastPlaying) {
        record.lastPlaying = active; const epoch = ++record.playEpoch;
        if (!active) record.element.pause();
        else {
          try {
            Promise.resolve(record.element.play()).then(() => {
              if (!playing(record)) record.element.pause();
            }, () => { if (record.playEpoch === epoch && current(record)) diagnose('playbackUnavailable'); });
          } catch (_) { diagnose('playbackUnavailable'); }
        }
      }
      if (active) schedule(record);
    }
    function progress(record, loaded = false) {
      if (!current(record)) return;
      if (loaded) { if (record.loaded) return; record.loaded = true; }
      else {
        const position = record.element.currentTime;
        if (!playing(record) || !Number.isFinite(position) || position <= record.position + .001) return;
        record.position = position;
      }
      if (record.consumerId === 'slot.start' && !record.finished && !record.completing && !record.reason) {
        clearTimer(record); record.remaining = 30000; schedule(record);
      }
    }
    function mount(definition, parent) {
      if (disposed) throw failure('disposed');
      const content = definition.content;
      if (!content || !TYPES.has(content.type) || typeof definition.instanceId !== 'string' || !definition.instanceId ||
          typeof definition.consumerId !== 'string' || !definition.consumerId) throw failure('invalidMedia');
      const previous = records.get(definition.instanceId);
      if (previous) {
        if (previous.consumerId !== definition.consumerId || previous.type !== content.type || previous.src !== content.src) throw failure('identityConflict');
        return previous.element;
      }
      if (records.size >= 196) throw failure('instanceLimit');
      let url;
      try { url = options.resolveResource(content.src); if (typeof url !== 'string' || !url) throw failure('resourceUnavailable'); }
      catch (_) { diagnose('resourceUnavailable'); throw failure('resourceUnavailable'); }
      const snapshot = options.getSnapshot();
      if (!snapshot) throw failure('missingContext');
      const record = { instanceId: definition.instanceId, consumerId: definition.consumerId, sessionId: snapshot.sessionId,
        type: content.type, src: content.src, state: definition.state, disposed: false, finished: false, completing: false,
        remaining: content.type === 'video' ? 30000 : content.type === 'html' ? 60000 : 500,
        timer: null, timerEpoch: 0, playEpoch: 0, lastPlaying: false, loaded: false, position: 0, handlers: [] };
      if (record.type === 'html') {
        if (typeof options.mountHTML !== 'function') throw failure('unsupported');
        record.element = options.mountHTML({ ...definition, resourceUrl: url }, parent);
      } else {
        record.element = document.createElement(record.type === 'video' ? 'video' : 'img');
        const node = record.element;
        if (record.type === 'video') { node.muted = true; node.defaultMuted = true; node.loop = record.consumerId !== 'slot.start';
          node.playsInline = true; node.controls = false; node.preload = 'auto'; }
        else { node.alt = ''; node.draggable = false; }
        node.src = url; parent.append(node);
      }
      records.set(record.instanceId, record);
      function listen(name, callback) { record.element.addEventListener(name, callback); record.handlers.push([name, callback]); }
      if (record.type === 'video') {
        listen('loadeddata', () => progress(record, true)); listen('timeupdate', () => progress(record));
        listen('ended', () => {
          if (record.consumerId !== 'slot.start' || current(record)?.lifecycle.stage !== 'starting') return;
          record.reason = 'videoEnded'; record.remaining = 0;
          if (playing(record)) complete(record, record.reason);
        });
      }
      if (record.type !== 'html') listen('error', () => {
        if (!current(record)) return; diagnose('mediaUnavailable');
        if (record.consumerId === 'slot.start') { clearTimer(record); record.reason = 'mediaError'; record.remaining = 0;
          if (playing(record)) complete(record, record.reason); }
      });
      sync(record); return record.element;
    }
    function disposeInstance(instanceId) {
      const record = records.get(instanceId); if (!record) return;
      record.disposed = true; records.delete(instanceId); clearTimer(record); record.playEpoch++;
      for (const [name, callback] of record.handlers) record.element.removeEventListener(name, callback);
      if (record.type === 'video') record.element.pause();
      if (record.type === 'html') options.disposeHTML?.(instanceId);
      else record.element.remove();
    }
    return Object.freeze({ mount,
      setState(instanceId, state) {
        const record = records.get(instanceId); if (!record || !['active', 'suspended'].includes(state)) return false;
        record.state = state; sync(record); return true;
      },
      setPlaybackSuspended(value) {
        if (disposed || typeof value !== 'boolean') return false;
        playbackSuspended = value; for (const record of records.values()) sync(record); return true;
      },
      refresh() { for (const record of records.values()) sync(record); },
      completeHTML(instanceId) { const record = records.get(instanceId); return !!record && record.type === 'html' && complete(record, 'htmlDone'); },
      disposeInstance,
      dispose() { if (disposed) return; for (const id of [...records.keys()]) disposeInstance(id); disposed = true; },
      readDiagnostics() { return { disposed, count: records.size, lastError: lastError && { ...lastError },
        instances: [...records.values()].map(record => ({ instanceId: record.instanceId, consumerId: record.consumerId, type: record.type,
          state: record.state, startupComplete: record.finished, completionPending: record.completing })) }; }
    });
  }
  return Object.freeze({ createMediaHost });
});
