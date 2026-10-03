const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRuntime } = require('./runtime-model.js');

const roomId = '231db51a-19db-4a3a-9c06-dbb9b3db86f9';
function room() {
  return { version: 3, apiVersion: 1, id: roomId, startDesk: 'home', name: 'Runtime fixture',
    resources: ['scene.html', 'clock.html', 'background.html', 'start.gif', 'idle.mp4'],
    roomScene: { entry: 'scene.html', capabilities: ['desk.read', 'desk.navigate'] },
    start: { type: 'gif', src: 'start.gif' }, idle: { type: 'video', src: 'idle.mp4' },
    transition: { type: 'author', durationMs: 700 },
    buttons: [{ id: 'next', name: 'Next', scope: 'room', action: { type: 'desk.next' } }],
    components: [{ id: 'clock', role: 'widget', entry: 'clock.html', placement: { x: 50, y: 60, width: 200, height: 150 },
      capabilities: ['desk.read'], buttonIds: ['next'], config: { theme: { color: 'blue', border: 2 }, labels: ['one'], detail: true } }],
    desks: [
      { id: 'home', name: 'Home', icons: [], components: ['clock'], background: { type: 'html', src: 'background.html' } },
      { id: 'focus', name: 'Focus', icons: [], components: ['clock'], componentOverrides: { clock: { theme: { color: 'red' }, labels: ['two'], detail: null } } },
      { id: 'empty', name: 'Empty', icons: [], components: [] },
    ] };
}
function snapshot(revision = 1, change = {}) {
  return { protocolVersion: 1, roomId, installationStamp: 'verified-installation', sessionId: 'session-one', revision,
    currentDeskId: 'home', targetDeskId: null, queuedDeskId: null, transitionId: null, deadlineUtc: null,
    active: true, operable: true, lifecycle: { stage: 'desktop', playbackPaused: false, locked: false, revision: 1 }, ...change };
}
function transitioning(revision = 2, change = {}) {
  return snapshot(revision, { targetDeskId: 'focus', transitionId: 'transition-one', deadlineUtc: '2026-10-03T00:00:03Z', ...change });
}
function instances(runtime) { return runtime.readDiagnostics().instances; }
function find(runtime, key) { return instances(runtime).find(instance => instance.key === key); }
function geometry(runtime, change = {}) {
  const state = runtime.readDiagnostics();
  return { sessionId: state.sessionId, revision: state.revision, transitionId: state.transitionId,
    geometryVersion: state.geometryVersion, ...change };
}

test('Core current and target remain distinct and animation completion only requests a commit', () => {
  const runtime = createRuntime(room()); runtime.acceptSnapshot(snapshot());
  const result = runtime.acceptSnapshot(transitioning());
  assert.equal(result.accepted, true); assert.equal(runtime.readDiagnostics().currentDeskId, 'home');
  assert.equal(result.effects.filter(effect => effect.type === 'beginTransition').length, 1);
  const finished = runtime.animationFinished('session-one', 'transition-one');
  assert.equal(finished.accepted, true); assert.deepEqual(finished.effects.map(effect => effect.type), ['completeTransition']);
  assert.equal(runtime.readDiagnostics().currentDeskId, 'home');
  assert.equal(runtime.animationFinished('session-one', 'transition-one').accepted, false);
  runtime.acceptSnapshot(snapshot(3, { currentDeskId: 'focus' }));
  assert.equal(runtime.readDiagnostics().currentDeskId, 'focus');
});

test('queued revisions update state without restarting or reversing the current animation', () => {
  const runtime = createRuntime(room()); runtime.acceptSnapshot(snapshot()); runtime.acceptSnapshot(transitioning());
  const result = runtime.acceptSnapshot(transitioning(3, { queuedDeskId: 'empty' }));
  assert.equal(runtime.readDiagnostics().queuedDeskId, 'empty');
  assert.equal(result.effects.some(effect => effect.type === 'beginTransition' || effect.type === 'cancelTransition'), false);
  assert.equal(runtime.animationFinished('session-one', 'transition-one').accepted, true);
});

test('shared scene and component preserve instance identities and nested configuration inheritance', () => {
  const runtime = createRuntime(room()); runtime.acceptSnapshot(snapshot());
  const scene = find(runtime, 'scene').instanceId, clock = find(runtime, 'component.clock').instanceId;
  const result = runtime.acceptSnapshot(transitioning());
  assert.equal(result.effects.some(effect => effect.type === 'mountInstance' && effect.key === 'component.clock'), false);
  assert.equal(find(runtime, 'scene').instanceId, scene); assert.equal(find(runtime, 'component.clock').instanceId, clock);
  assert.deepEqual(find(runtime, 'component.clock').config, { theme: { color: 'red', border: 2 }, labels: ['two'], detail: null });
  runtime.acceptSnapshot(snapshot(3, { currentDeskId: 'focus' })); runtime.acceptSnapshot(snapshot(4));
  assert.equal(find(runtime, 'component.clock').instanceId, clock);
  assert.deepEqual(find(runtime, 'component.clock').config.theme, { color: 'blue', border: 2 });
});

test('inactive components suspend and later resume without rebuilding their document', () => {
  const runtime = createRuntime(room()); runtime.acceptSnapshot(snapshot()); const clock = find(runtime, 'component.clock').instanceId;
  runtime.acceptSnapshot(snapshot(2, { currentDeskId: 'empty' })); assert.equal(find(runtime, 'component.clock').state, 'suspended');
  const resumed = runtime.acceptSnapshot(snapshot(3));
  assert.equal(find(runtime, 'component.clock').instanceId, clock); assert.equal(find(runtime, 'component.clock').state, 'active');
  assert.equal(resumed.effects.some(effect => effect.type === 'mountInstance' && effect.key === 'component.clock'), false);
});

test('session replacement disposes old instances and late snapshots cannot resurrect them', () => {
  const runtime = createRuntime(room()); runtime.acceptSnapshot(snapshot()); const old = find(runtime, 'scene').instanceId;
  const result = runtime.acceptSnapshot(snapshot(2, { sessionId: 'session-two' }));
  assert.ok(result.effects.some(effect => effect.type === 'disposeInstance' && effect.instanceId === old));
  assert.notEqual(find(runtime, 'scene').instanceId, old);
  assert.equal(runtime.acceptSnapshot(snapshot(999)).accepted, false); assert.equal(runtime.readDiagnostics().sessionId, 'session-two');
});

test('old revisions, malformed Desk references and foreign Room/install snapshots leave state intact', () => {
  const runtime = createRuntime(room()); runtime.acceptSnapshot(snapshot(3));
  for (const invalid of [snapshot(2), snapshot(3), snapshot(4, { currentDeskId: 'missing' }), snapshot(4, { roomId: 'foreign' }),
    snapshot(4, { installationStamp: 'changed' }), snapshot(4, { targetDeskId: 'focus', transitionId: null }),
    snapshot(4, { lifecycle: { stage: 'idle', playbackPaused: 'false', locked: false, revision: 2 } })]) {
    assert.equal(runtime.acceptSnapshot(invalid).accepted, false);
  }
  assert.equal(runtime.readDiagnostics().revision, 3);
});

test('forced commit cancels old animation and refuses late completion', () => {
  const runtime = createRuntime(room()); runtime.acceptSnapshot(snapshot()); runtime.acceptSnapshot(transitioning());
  const result = runtime.acceptSnapshot(snapshot(3, { currentDeskId: 'focus', operable: false }));
  assert.ok(result.effects.some(effect => effect.type === 'cancelTransition'));
  assert.equal(runtime.readDiagnostics().currentDeskId, 'focus');
  assert.equal(runtime.animationFinished('session-one', 'transition-one').accepted, false);
});

test('start, idle, paused and locked states preserve the underlying committed Desk and shared objects', () => {
  const runtime = createRuntime(room()); runtime.acceptSnapshot(snapshot(1, { lifecycle: { stage: 'starting', playbackPaused: false, locked: false, revision: 1 } }));
  const scene = find(runtime, 'scene').instanceId;
  assert.equal(find(runtime, 'slot.start').state, 'active');
  runtime.acceptSnapshot(snapshot(2, { lifecycle: { stage: 'desktop', playbackPaused: false, locked: false, revision: 2 } }));
  runtime.acceptSnapshot(snapshot(3, { operable: false, lifecycle: { stage: 'idle', playbackPaused: true, locked: true, revision: 3 } }));
  assert.equal(find(runtime, 'slot.idle').state, 'suspended'); assert.equal(find(runtime, 'scene').state, 'suspended');
  runtime.acceptSnapshot(snapshot(4, { operable: false, lifecycle: { stage: 'idle', playbackPaused: false, locked: false, revision: 4 } }));
  assert.equal(find(runtime, 'slot.idle').state, 'active');
  const woke = runtime.acceptSnapshot(snapshot(5, { lifecycle: { stage: 'desktop', playbackPaused: false, locked: false, revision: 5 } }));
  assert.equal(find(runtime, 'scene').instanceId, scene); assert.equal(find(runtime, 'scene').state, 'active');
  assert.equal(woke.effects.some(effect => effect.type === 'playSlot' && effect.slot === 'start'), false);
  assert.equal(runtime.readDiagnostics().currentDeskId, 'home');
});

test('viewport changes invalidate input geometry without disposing active frames', () => {
  const runtime = createRuntime(room()); runtime.acceptSnapshot(snapshot()); const before = runtime.readDiagnostics();
  const result = runtime.setViewport({ width: 1280, height: 720, dpr: 1.5 });
  assert.equal(result.accepted, true); assert.ok(runtime.readDiagnostics().geometryVersion > before.geometryVersion);
  assert.ok(result.effects.some(effect => effect.type === 'invalidateInput')); assert.equal(result.effects.some(effect => effect.type === 'disposeInstance'), false);
  assert.equal(find(runtime, 'scene').instanceId, before.instances.find(value => value.key === 'scene').instanceId);
  for (const viewport of [{ width: 0, height: 720, dpr: 1 }, { width: 1280, height: NaN, dpr: 1 }, { width: 1280, height: 720, dpr: 100 }])
    assert.equal(runtime.setViewport(viewport).accepted, false);
});

test('scene geometry accepts bounded groups and occupancy, rejecting stale or non-scene control', () => {
  const runtime = createRuntime(room()); runtime.acceptSnapshot(snapshot()); runtime.acceptSnapshot(transitioning());
  const report = geometry(runtime, { groups: { shared: { matrix: [1, 0, 0, 1, 10, 20], opacity: 0.8 } },
    occupied: [{ id: 'dashboard', x: 0, y: 800, width: 1920, height: 280 }] });
  assert.equal(runtime.acceptGeometry('component.clock', report).accepted, false);
  assert.equal(runtime.acceptGeometry('scene', report).accepted, true);
  assert.equal(runtime.acceptGeometry('scene', report).accepted, false);
  assert.equal(runtime.acceptGeometry('scene', geometry(runtime, { groups: { shared: { matrix: [0, 0, 0, 0, 0, 0], opacity: 1 } } })).accepted, false);
  assert.equal(runtime.acceptGeometry('scene', geometry(runtime, { occupied: [{ id: 'huge', x: 0, y: 0, width: 10000, height: 20 }] })).accepted, false);
});

test('component buttons work without roomScene and are limited to the declared active consumer', () => {
  const manifest = room(); delete manifest.roomScene; manifest.transition = { type: 'slide', durationMs: 450 };
  const runtime = createRuntime(manifest); runtime.acceptSnapshot(snapshot());
  assert.equal(runtime.acceptGeometry('component.clock', geometry(runtime, { buttons: [{ buttonId: 'next', x: 50, y: 60, width: 100, height: 40 }] })).accepted, true);
  assert.equal(runtime.acceptGeometry('component.clock', geometry(runtime, { buttons: [{ buttonId: 'invented', x: 50, y: 60, width: 100, height: 40 }] })).accepted, false);
  runtime.acceptSnapshot(snapshot(2, { currentDeskId: 'empty' }));
  assert.equal(runtime.acceptGeometry('component.clock', geometry(runtime, { buttons: [] })).accepted, false);
});

test('geometry version changes remove stale consumer regions and no private overrides mutate the authored manifest', () => {
  const manifest = room(), original = JSON.stringify(manifest); const runtime = createRuntime(manifest); runtime.acceptSnapshot(snapshot());
  runtime.acceptGeometry('component.clock', geometry(runtime, { buttons: [{ buttonId: 'next', x: 50, y: 60, width: 100, height: 40 }] }));
  runtime.setViewport({ width: 1024, height: 768, dpr: 2 });
  assert.equal(runtime.readDiagnostics().buttonRegionCount, 0); assert.equal(JSON.stringify(manifest), original);
  const detached = runtime.readDiagnostics(); detached.instances.length = 0;
  assert.ok(runtime.readDiagnostics().instances.length > 0);
});

test('disposal invalidates all instances and further messages cannot revive the runtime', () => {
  const runtime = createRuntime(room()); runtime.acceptSnapshot(snapshot()); const before = instances(runtime).length;
  assert.equal(runtime.dispose('playerClosed').effects.filter(effect => effect.type === 'disposeInstance').length, before);
  assert.equal(runtime.acceptSnapshot(snapshot(2)).accepted, false); assert.equal(runtime.setViewport({ width: 1280, height: 720, dpr: 1 }).accepted, false);
  assert.equal(instances(runtime).length, 0);
});

test('unchanged geometry does not advance versions or start a cross-consumer republishing loop', () => {
  const runtime = createRuntime(room()); runtime.acceptSnapshot(snapshot());
  const details = { buttons: [{ buttonId: 'next', x: 50, y: 60, width: 100, height: 40 }] };
  runtime.acceptGeometry('component.clock', geometry(runtime, details));
  const version = runtime.readDiagnostics().geometryVersion;
  for (let index = 0; index < 5; index++) {
    const reply = runtime.acceptGeometry('component.clock', geometry(runtime, details));
    assert.equal(reply.accepted, true); assert.deepEqual(reply.effects, []);
    assert.equal(runtime.readDiagnostics().geometryVersion, version);
  }
});


test('unpaused visuals remain active when Core disables input foreground',()=>{
  const runtime=createRuntime(room());runtime.acceptSnapshot(snapshot());const scene=find(runtime,'scene').instanceId,widget=find(runtime,'component.clock').instanceId;
  runtime.acceptSnapshot(snapshot(2,{operable:false}));
  for(const key of ['scene','component.clock','slot.background.home'])assert.equal(find(runtime,key).state,'active');
  assert.equal(find(runtime,'scene').instanceId,scene);assert.equal(find(runtime,'component.clock').instanceId,widget);
  assert.equal(runtime.acceptGeometry('scene',geometry(runtime,{groups:{shared:{matrix:[1,0,0,1,10,20],opacity:1}}})).accepted,true);
  runtime.acceptSnapshot(snapshot(3,{operable:false,lifecycle:{stage:'desktop',playbackPaused:true,locked:false,revision:2}}));
  for(const key of ['scene','component.clock','slot.background.home'])assert.equal(find(runtime,key).state,'suspended');
});

test('continuous author group frames preserve structural version and declared regions',()=>{
 const runtime=createRuntime(room());runtime.acceptSnapshot(snapshot());
 runtime.acceptGeometry('component.clock',geometry(runtime,{buttons:[{buttonId:'next',x:50,y:60,width:100,height:40}]}));
 const before=runtime.readDiagnostics();
 for(const y of [100,200,300]){
  const result=runtime.acceptGeometry('scene',geometry(runtime,{groups:{shared:{matrix:[1,0,0,1,0,y],opacity:1}}}));
  assert.equal(result.accepted,true);assert.deepEqual(result.effects.map(e=>e.type),['applyVisualGroups']);
  assert.equal(runtime.readDiagnostics().geometryVersion,before.geometryVersion);
  assert.deepEqual(runtime.readDiagnostics().buttonRegions,before.buttonRegions);
 }
 const changed=runtime.acceptGeometry('scene',geometry(runtime,{occupied:[{id:'panel',x:0,y:800,width:1920,height:280}]}));
 assert.ok(changed.effects.some(e=>e.type==='invalidateInput'));assert.equal(runtime.readDiagnostics().geometryVersion,before.geometryVersion+1);
});
