(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DextRuntimeModel = api;
})(globalThis, function () {
  'use strict';
  const clone = value => JSON.parse(JSON.stringify(value));
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const finite = (value, minimum, maximum) => typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum;
  const identifier = value => typeof value === 'string' && /^[A-Za-z0-9_.-]{1,80}$/.test(value);
  function merge(shared, override) {
    if (!object(shared) || !object(override)) return clone(override);
    return Object.fromEntries([...new Set([...Object.keys(shared), ...Object.keys(override)])].map(key =>
      [key, Object.hasOwn(override, key) ? (object(shared[key]) && object(override[key]) ? merge(shared[key], override[key]) : clone(override[key])) : clone(shared[key])]));
  }
  const identityGroups = () => Object.fromEntries(['source', 'target', 'shared'].map(name => [name, { matrix: [1, 0, 0, 1, 0, 0], opacity: 1 }]));
  function createRuntime(verifiedManifest) {
    if (!object(verifiedManifest) || verifiedManifest.version !== 3 || verifiedManifest.apiVersion !== 1 ||
      !Array.isArray(verifiedManifest.desks) || verifiedManifest.desks.length === 0) throw new TypeError('Verified native v3 manifest required');
    const room = clone(verifiedManifest);
    const desks = new Map(room.desks.map(desk => [desk.id, desk]));
    const components = new Map((room.components || []).map(component => [component.id, component]));
    const buttons = new Map((room.buttons || []).map(button => [button.id, button]));
    const instances = new Map(), retiredSessions = new Set(), buttonRegions = new Map();
    let current = null, disposed = false, nextInstance = 0, geometryVersion = 0;
    let completedTransition = null, groups = identityGroups(), occupied = [], lastRejected = null;
    let viewport = { width: 1920, height: 1080, dpr: 1 };

    function result(effects = []) { return { accepted: true, status: 'accepted', effects }; }
    function reject(status) { lastRejected = status; return { accepted: false, status, effects: [] }; }
    function invalidateGeometry(effects, reason) {
      geometryVersion++; groups = identityGroups(); occupied = []; buttonRegions.clear();
      effects.push({ type: 'invalidateInput', geometryVersion, reason }, { type: 'layoutNeeded', geometryVersion, viewport: clone(viewport) });
    }
    function validSnapshot(value) {
      if (!object(value) || value.protocolVersion !== 1 || value.roomId !== room.id ||
        typeof value.installationStamp !== 'string' || value.installationStamp.length < 1 || value.installationStamp.length > 128 ||
        typeof value.sessionId !== 'string' || value.sessionId.length < 1 || value.sessionId.length > 128 ||
        !Number.isSafeInteger(value.revision) || value.revision < 1 || !desks.has(value.currentDeskId) ||
        ![value.targetDeskId, value.queuedDeskId].every(id => id === null || desks.has(id)) ||
        typeof value.active !== 'boolean' || typeof value.operable !== 'boolean' || !object(value.lifecycle)) return false;
      const life = value.lifecycle;
      if (!['starting', 'desktop', 'idle'].includes(life.stage) || typeof life.playbackPaused !== 'boolean' ||
        typeof life.locked !== 'boolean' || !Number.isSafeInteger(life.revision) || life.revision < 0) return false;
      return value.targetDeskId === null
        ? value.transitionId === null && value.deadlineUtc === null
        : typeof value.transitionId === 'string' && value.transitionId.length > 0 && value.transitionId.length <= 128 &&
          typeof value.deadlineUtc === 'string' && Number.isFinite(Date.parse(value.deadlineUtc));
    }
    function ensure(key, definition, config, active, desired, effects) {
      desired.add(key);
      const state = active ? 'active' : 'suspended';
      let instance = instances.get(key);
      if (!instance) {
        instance = { ...clone(definition), key, instanceId: current.sessionId + ':' + (++nextInstance), state, config: clone(config || {}) };
        instances.set(key, instance);
        effects.push({ type: 'mountInstance', ...clone(instance) });
      } else {
        if (JSON.stringify(instance.config) !== JSON.stringify(config || {})) {
          instance.config = clone(config || {});
          effects.push({ type: 'updateInstance', instanceId: instance.instanceId, key, config: clone(instance.config) });
        }
        if (instance.state !== state) {
          instance.state = state;
          effects.push({ type: 'setInstanceState', instanceId: instance.instanceId, key, state, lifecycle: clone(current.lifecycle) });
        }
      }
    }
    function ensureSlot(key, content, active, desired, effects) {
      if (!content) return;
      ensure(key, { consumerId: key, kind: content.type === 'html' ? 'html' : 'media', content: clone(content),
        entry: content.src, capabilities: content.capabilities || [], buttonIds: content.buttonIds || [] }, {}, active, desired, effects);
    }
    function reconcile(effects) {
      const desired = new Set();
      const life = current.lifecycle;
      const playing = current.active && !life.playbackPaused && !life.locked;
      const desktopActive = playing && life.stage === 'desktop';
      if (room.roomScene) ensure('scene', { consumerId: 'scene', kind: 'scene', entry: room.roomScene.entry,
        capabilities: room.roomScene.capabilities || [], buttonIds: [...buttons.keys()] }, room.roomScene.config || {}, desktopActive, desired, effects);
      const visibleDesks = [current.currentDeskId, current.targetDeskId].filter(Boolean);
      const effective = desks.get(current.targetDeskId || current.currentDeskId);
      for (const deskId of visibleDesks) {
        const desk = desks.get(deskId);
        ensureSlot('slot.background.' + deskId, desk.background, desktopActive, desired, effects);
        for (const id of desk.components) {
          const component = components.get(id);
          if (!component) continue; // Core installation validation remains the manifest authority.
          const override = effective.componentOverrides && effective.componentOverrides[id];
          const config = override ? merge(component.config || {}, override) : component.config || {};
          ensure('component.' + id, { consumerId: 'component.' + id, kind: component.role, entry: component.entry,
            capabilities: component.capabilities || [], buttonIds: component.buttonIds || [], placement: component.placement }, config, desktopActive, desired, effects);
        }
      }
      if (life.stage === 'starting') ensureSlot('slot.start', room.start, playing, desired, effects);
      if (life.stage === 'idle') ensureSlot('slot.idle', room.idle, playing, desired, effects);
      for (const instance of instances.values()) {
        if (!desired.has(instance.key) && instance.state !== 'suspended') {
          instance.state = 'suspended';
          effects.push({ type: 'setInstanceState', instanceId: instance.instanceId, key: instance.key, state: 'suspended', lifecycle: clone(life) });
        }
      }
      effects.push({ type: 'notifySnapshot', snapshot: clone(current), geometryVersion });
    }
    function disposeInstances(effects, reason) {
      for (const instance of instances.values()) effects.push({ type: 'disposeInstance', instanceId: instance.instanceId, key: instance.key, reason });
      instances.clear(); buttonRegions.clear();
    }
    function rect(value) {
      return object(value) && finite(value.x, 0, 1920) && finite(value.y, 0, 1080) && finite(value.width, 0.001, 1920) &&
        finite(value.height, 0.001, 1080) && value.x + value.width <= 1920 && value.y + value.height <= 1080;
    }
    function validGroups(value) {
      return object(value) && Object.entries(value).every(([key, group]) => ['source', 'target', 'shared'].includes(key) && object(group) &&
        Object.keys(group).every(field => ['matrix', 'opacity'].includes(field)) && Array.isArray(group.matrix) && group.matrix.length === 6 &&
        group.matrix.every((number, index) => finite(number, index < 4 ? -4 : -(index === 4 ? 3840 : 2160), index < 4 ? 4 : (index === 4 ? 3840 : 2160))) &&
        Math.abs(group.matrix[0] * group.matrix[3] - group.matrix[1] * group.matrix[2]) >= 0.001 && finite(group.opacity, 0, 1));
    }
    const api = {
      acceptSnapshot(value) {
        if (disposed) return reject('disposed');
        if (!validSnapshot(value)) return reject('invalidSnapshot');
        if (retiredSessions.has(value.sessionId)) return reject('staleSession');
        if (current && current.sessionId === value.sessionId && (value.revision <= current.revision ||
          value.installationStamp !== current.installationStamp || value.lifecycle.revision < current.lifecycle.revision)) return reject('staleSnapshot');
        const effects = [], previous = current;
        const replaced = previous && previous.sessionId !== value.sessionId;
        if (replaced) {
          if (retiredSessions.size >= 128) return reject('reloadRequired');
          retiredSessions.add(previous.sessionId);
          disposeInstances(effects, 'sessionChanged');
        }
        const transitionChanged = replaced || !previous || previous.transitionId !== value.transitionId;
        const layoutChanged = transitionChanged || previous.currentDeskId !== value.currentDeskId || previous.operable !== value.operable ||
          JSON.stringify(previous.lifecycle) !== JSON.stringify(value.lifecycle);
        if (transitionChanged && previous && previous.transitionId) effects.push({ type: 'cancelTransition', sessionId: previous.sessionId, transitionId: previous.transitionId });
        current = clone(value);
        if (layoutChanged) invalidateGeometry(effects, replaced ? 'sessionChanged' : 'snapshotChanged');
        if (transitionChanged) completedTransition = null;
        reconcile(effects);
        if (transitionChanged && current.transitionId) effects.push({ type: 'beginTransition', sessionId: current.sessionId,
          transitionId: current.transitionId, revision: current.revision, fromDeskId: current.currentDeskId, targetDeskId: current.targetDeskId,
          deadlineUtc: current.deadlineUtc, transition: clone(room.transition || { type: 'slide', durationMs: 450 }) });
        return result(effects);
      },
      animationFinished(sessionId, transitionId) {
        if (disposed || !current || !current.active || current.sessionId !== sessionId || current.transitionId !== transitionId ||
          transitionId === null || completedTransition === transitionId) return reject('staleTransition');
        completedTransition = transitionId;
        return result([{ type: 'completeTransition', sessionId, transitionId }]);
      },
      setViewport(value) {
        if (disposed) return reject('disposed');
        if (!object(value) || !finite(value.width, 64, 16384) || !finite(value.height, 64, 16384) || !finite(value.dpr, 0.5, 8)) return reject('invalidViewport');
        if (JSON.stringify(viewport) === JSON.stringify(value)) return result();
        viewport = { width: value.width, height: value.height, dpr: value.dpr };
        const effects = []; invalidateGeometry(effects, 'viewportChanged');
        if (current) effects.push({ type: 'notifySnapshot', snapshot: clone(current), geometryVersion });
        return result(effects);
      },
      acceptGeometry(consumer, report) {
        if (disposed || !current || !current.active) return reject('staleSession');
        const owner = instances.get(consumer);
        if (!owner || owner.state !== 'active') return reject('inactiveConsumer');
        if (!object(report) || report.sessionId !== current.sessionId || report.revision !== current.revision ||
          report.transitionId !== current.transitionId || report.geometryVersion !== geometryVersion) return reject('staleGeometry');
        if (consumer !== 'scene' && (report.groups !== undefined || report.occupied !== undefined)) return reject('forbiddenGeometry');
        if (report.groups !== undefined && !validGroups(report.groups)) return reject('invalidGeometry');
        if (report.occupied !== undefined && (!Array.isArray(report.occupied) || report.occupied.length > 256 ||
          new Set(report.occupied.map(area => area.id)).size !== report.occupied.length ||
          !report.occupied.every(area => identifier(area.id) && rect(area) && (area.deskId === undefined || desks.has(area.deskId))))) return reject('invalidGeometry');
        if (report.buttons !== undefined && (!Array.isArray(report.buttons) || report.buttons.length > 1024 ||
          new Set(report.buttons.map(button => button.buttonId)).size !== report.buttons.length ||
          !report.buttons.every(button => rect(button) && buttons.has(button.buttonId) && owner.buttonIds.includes(button.buttonId) &&
            (buttons.get(button.buttonId).scope === 'room' || buttons.get(button.buttonId).scope === (current.targetDeskId || current.currentDeskId))))) return reject('invalidGeometry');
        const nextGroups = report.groups === undefined ? groups : { ...groups, ...Object.fromEntries(Object.entries(report.groups).map(([key, value]) =>
          [key, { matrix: [...value.matrix], opacity: value.opacity }])) };
        const nextOccupied = report.occupied === undefined ? occupied : report.occupied.map(area => ({ id: area.id, x: area.x, y: area.y,
          width: area.width, height: area.height, ...(area.deskId === undefined ? {} : { deskId: area.deskId }) }));
        const nextButtons = report.buttons === undefined ? buttonRegions.get(consumer) || [] : report.buttons.map(button => ({ buttonId: button.buttonId,
          x: button.x, y: button.y, width: button.width, height: button.height }));
        if (JSON.stringify(groups) === JSON.stringify(nextGroups) && JSON.stringify(occupied) === JSON.stringify(nextOccupied) &&
          JSON.stringify(buttonRegions.get(consumer) || []) === JSON.stringify(nextButtons)) return result();
        groups = nextGroups; occupied = nextOccupied;
        if (report.buttons !== undefined) buttonRegions.set(consumer, nextButtons);
        geometryVersion++;
        return result([{ type: 'invalidateInput', reason: 'geometryChanged', geometryVersion }, { type: 'applyGeometry', geometryVersion,
          groups: clone(groups), occupied: clone(occupied), buttonRegions: Object.fromEntries([...buttonRegions].map(([key, value]) => [key, clone(value)])) },
          { type: 'notifyGeometry', geometryVersion, viewport: clone(viewport) }]);
      },
      dispose(reason = 'disposed') {
        if (disposed) return result();
        const effects = []; disposeInstances(effects, String(reason).slice(0, 80));
        if (current && current.transitionId) effects.push({ type: 'cancelTransition', sessionId: current.sessionId, transitionId: current.transitionId });
        disposed = true; occupied = []; groups = identityGroups(); geometryVersion++;
        effects.push({ type: 'invalidateInput', reason: 'disposed', geometryVersion }); return result(effects);
      },
      readDiagnostics() {
        return clone({ roomId: room.id, sessionId: current && current.sessionId, revision: current && current.revision,
          currentDeskId: current && current.currentDeskId, targetDeskId: current && current.targetDeskId,
          queuedDeskId: current && current.queuedDeskId, transitionId: current && current.transitionId,
          lifecycle: current && current.lifecycle, geometryVersion, viewport, disposed, lastRejected,
          instances: [...instances.values()], occupied, groups, buttonRegions: Object.fromEntries(buttonRegions), buttonRegionCount: [...buttonRegions.values()].reduce((sum, values) => sum + values.length, 0) });
      },
    };
    return Object.freeze(api);
  }
  return Object.freeze({ createRuntime });
});
