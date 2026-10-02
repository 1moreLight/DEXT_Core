'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function fixture() {
  const sent = [], events = [], listeners = new Set(), timers = new Map();
  let timerId = 0;
  const parent = { postMessage: message => sent.push(JSON.parse(JSON.stringify(message))) };
  const context = { parent, console, JSON, Map, Set, Promise, Object, Array, Number, String, Error, TypeError,
    setTimeout: callback => { timers.set(++timerId, callback); return timerId; },
    clearTimeout: id => timers.delete(id),
    addEventListener: (name, callback) => { if (name === 'message') listeners.add(callback); },
    removeEventListener: (name, callback) => { if (name === 'message') listeners.delete(callback); },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    dispatchEvent: event => events.push(event) };
  vm.runInNewContext(fs.readFileSync(__dirname + '/dext-sdk.v1.js', 'utf8'), context);
  const snapshot = (revision = 1) => ({ protocolVersion: 1, roomId: 'room', installationStamp: 'stamp', sessionId: 'session', revision,
    currentDeskId: 'a', targetDeskId: null, queuedDeskId: null, transitionId: null, deadlineUtc: null, active: true, operable: true,
    lifecycle: { stage: 'desktop', playbackPaused: false, locked: false, revision: 0 } });
  const envelope = extra => ({ apiVersion: 1, instanceId: 'instance', sessionId: 'session', token: 'routing-token', ...extra });
  const receive = (message, source = parent) => { for (const callback of [...listeners]) callback({ source, data: message }); };
  const init = extra => receive(envelope({ type: 'dext:runtime:init', consumerId: 'scene', kind: 'scene',
    capabilities: { 'desk.read': 'available', 'desk.navigate': 'available', 'time.read': 'available', 'hardware.read': 'denied' },
    config: { dial: { color: 'blue' } }, viewport: { width: 1920, height: 1080, dpr: 1 }, geometryVersion: 1, snapshot: snapshot(), ...extra }));
  const reply = (request, extra = {}) => receive(envelope({ type: 'dext:runtime:response', requestId: request.requestId, ok: true, result: {}, ...extra }));
  const event = (name, payload, sequence = 1, extra = {}) => receive(envelope({ type: 'dext:runtime:event', event: name, payload, sequence, ...extra }));
  return { api: context.Dext, sent, events, listeners, timers, envelope, receive, init, reply, event, snapshot,
    last: method => sent.findLast(message => message.method === method), timeout: () => { for (const [id, callback] of [...timers]) { timers.delete(id); callback(); } } };
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('only a bounded v1 init from the fixed parent makes the SDK ready once', async () => {
  const f = fixture();
  const ready = f.api.ready();
  f.receive(f.envelope({ type: 'dext:runtime:init' }), {});
  f.init({ apiVersion: 2 });
  f.init({ token: '' });
  assert.equal(f.api.session, null);
  f.init();
  assert.equal((await ready).consumerId, 'scene');
  assert.equal(f.events.filter(event => event.type === 'dext:ready').length, 1);
  assert.equal(f.sent.filter(message => message.method === 'ready').length, 1);
  assert.equal('token' in f.api.session, false);
  f.init({ token: 'replacement', sessionId: 'replacement' });
  assert.equal(f.api.session.sessionId, 'session');
  assert.equal(f.events.filter(event => event.type === 'dext:ready').length, 1);
});

test('requests reject before ready, carry routing identity and correlate only valid replies', async () => {
  const f = fixture();
  await assert.rejects(f.api.actions.activate('button'), { code: 'notReady' });
  f.init();
  const pending = f.api.actions.activate('button');
  const request = f.last('actions.activate');
  assert.equal(request.token, 'routing-token');
  assert.deepEqual(request.params, { buttonId: 'button' });
  f.reply(request, { token: 'forged', result: { status: 'launched' } });
  f.reply(request, { apiVersion: 2 });
  f.reply(request, { sessionId: 'old' });
  assert.equal(f.api.diagnostics().pendingRequests, 1);
  f.reply(request, { result: { status: 'inputRequired' } });
  assert.equal((await pending).status, 'inputRequired');
  assert.equal(f.api.diagnostics().pendingRequests, 0);
  assert.equal(f.sent.some(message => /ticket|issueHostInput/i.test(message.method)), false);
});

test('late response after timeout cannot resolve a different action', async () => {
  const f = fixture(); f.init();
  const first = f.api.actions.activate('one');
  const firstRequest = f.last('actions.activate');
  const rejected = assert.rejects(first, { code: 'timeout' });
  f.timeout(); await rejected;
  const second = f.api.actions.activate('two');
  const secondRequest = f.last('actions.activate');
  assert.notEqual(firstRequest.requestId, secondRequest.requestId);
  f.reply(firstRequest, { result: { status: 'launched' } });
  assert.equal(f.api.diagnostics().pendingRequests, 1);
  f.reply(secondRequest, { result: { status: 'inputRequired' } });
  assert.equal((await second).status, 'inputRequired');
});

test('shared subscriptions use one host channel, replay current snapshot and release last listener', () => {
  const f = fixture(), first = [], second = [];
  const off1 = f.api.desk.subscribe(value => first.push(value));
  f.init();
  const off2 = f.api.desk.subscribe(value => second.push(value));
  assert.equal(f.sent.filter(message => message.method === 'desk.subscribe').length, 1);
  assert.deepEqual(first.map(value => value.revision), [1]);
  assert.deepEqual(second.map(value => value.revision), [1]);
  f.event('desk', { ...f.snapshot(2), targetDeskId: 'b', transitionId: 'transition', deadlineUtc: '2026-10-03T12:00:00Z' });
  assert.deepEqual(first.map(value => value.revision), [1, 2]);
  f.event('desk', f.snapshot(1), 2);
  f.event('desk', f.snapshot(3), 3, { sessionId: 'retired' });
  assert.deepEqual(first.map(value => value.revision), [1, 2]);
  off1(); assert.equal(f.sent.filter(message => message.method === 'desk.unsubscribe').length, 0);
  off2(); off2();
  assert.equal(f.sent.filter(message => message.method === 'desk.unsubscribe').length, 1);
  f.api.dispose();
});

test('data failure and render errors hide only a bound readout, preserving its static frame', () => {
  const f = fixture(); f.init();
  const frame = { hidden: false }, readout = { hidden: false, textContent: '' };
  const off = f.api.data.bindReadout('time.read', readout, value => { if (value === 'bad') throw Error('private-path'); readout.textContent = value; });
  assert.equal(readout.hidden, true);
  f.event('data', { capability: 'time.read', state: { status: 'available', value: '12:30' } });
  assert.equal(readout.hidden, false); assert.equal(readout.textContent, '12:30');
  f.event('data', { capability: 'time.read', state: { status: 'missing' } }, 2);
  assert.equal(readout.hidden, true); assert.equal(frame.hidden, false);
  f.event('data', { capability: 'time.read', state: { status: 'available', value: 'bad' } }, 3);
  assert.equal(readout.hidden, true); assert.equal(frame.hidden, false);
  assert.equal(f.api.diagnostics().lastError.code, 'renderError');
  assert.equal(JSON.stringify(f.api.diagnostics()).includes('private-path'), false);
  off(); f.api.dispose();
});

test('undeclared data is refused and denied data cannot be made visible by a payload', () => {
  const f = fixture(); f.init();
  assert.throws(() => f.api.data.subscribe('audio.read', () => {}), { code: 'undeclaredCapability' });
  const seen = []; f.api.data.subscribe('hardware.read', value => seen.push(value.status));
  assert.deepEqual(seen, ['denied']);
  f.event('data', { capability: 'hardware.read', state: { status: 'available', value: { cpu: 20 } } });
  assert.deepEqual(seen, ['denied']);
  f.event('capabilities', { 'desk.read': 'available', 'desk.navigate': 'available', 'time.read': 'available', 'hardware.read': 'available' });
  f.event('data', { capability: 'hardware.read', state: { status: 'available', value: { cpu: 20 } } }, 2);
  assert.equal(seen.at(-1), 'available');
  f.api.dispose();
});

test('geometry uses latest trusted revision and only scene may complete the current transition', async () => {
  const f = fixture(); f.init();
  f.event('desk', { ...f.snapshot(2), targetDeskId: 'b', transitionId: 't', deadlineUtc: '2026-10-03T12:00:00Z' });
  f.event('geometry', { geometryVersion: 5 });
  const sent = f.api.scene.publishGeometry({ buttons: [{ buttonId: 'button', x: 0, y: 0, width: 10, height: 10 }] });
  const request = f.last('scene.publishGeometry');
  assert.equal(request.params.report.sessionId, 'session');
  assert.equal(request.params.report.revision, 2);
  assert.equal(request.params.report.transitionId, 't');
  assert.equal(request.params.report.geometryVersion, 5);
  f.reply(request); await sent;
  await assert.rejects(f.api.scene.completeTransition('old'), { code: 'staleTransition' });
  const completed = f.api.scene.completeTransition('t'); f.reply(f.last('scene.completeTransition')); await completed;
  const widget = fixture(); widget.init({ consumerId: 'component.widget', kind: 'widget' });
  await assert.rejects(widget.api.scene.completeTransition('t'), { code: 'forbidden' });
  await assert.rejects(widget.api.scene.done(), { code: 'forbidden' });
  f.api.dispose(); widget.api.dispose();
});

test('idle cannot exit itself; start done is a host request, not a local stage commit', async () => {
  const idle = fixture(); idle.init({ consumerId: 'slot.idle', kind: 'html' });
  await assert.rejects(idle.api.scene.done(), { code: 'forbidden' });
  const start = fixture(); start.init({ consumerId: 'slot.start', kind: 'html', snapshot: { ...start.snapshot(), lifecycle: { stage: 'starting', playbackPaused: false, locked: false, revision: 1 } } });
  const pending = start.api.scene.done(); start.reply(start.last('scene.done')); await pending;
  assert.equal(start.api.session.snapshot.lifecycle.stage, 'starting');
  idle.api.dispose(); start.api.dispose();
});

test('payloads and request count are bounded and malformed replies cannot finish pending requests', async () => {
  const f = fixture(); f.init();
  await assert.rejects(f.api.scene.publishGeometry({ buttons: 'x'.repeat(40000) }), { code: 'payloadTooLarge' });
  const requests = Array.from({ length: 64 }, () => f.api.actions.list());
  await assert.rejects(f.api.actions.list(), { code: 'requestLimit' });
  f.reply(f.last('actions.list'), { ok: 'true' });
  assert.equal(f.api.diagnostics().pendingRequests, 64);
  const rejecting = Promise.all(requests.map(request => assert.rejects(request, { code: 'disposed' })));
  f.api.dispose(); await rejecting;
});

test('dispose rejects pending work, releases channels and prevents revival by the old parent', async () => {
  const f = fixture(); f.init();
  let called = 0; f.api.lifecycle.subscribe(() => called++);
  const pending = f.api.desk.get();
  const rejected = assert.rejects(pending, { code: 'disposed' });
  f.receive(f.envelope({ type: 'dext:runtime:dispose' }));
  await rejected;
  assert.equal(f.listeners.size, 0); assert.equal(f.timers.size, 0);
  f.init(); f.event('lifecycle', { stage: 'idle', playbackPaused: true, locked: true, revision: 2 });
  assert.equal(called, 1); assert.equal(f.api.session, null);
  assert.equal(f.api.diagnostics().disposed, true);
  await assert.rejects(f.api.actions.activate('button'), { code: 'disposed' });
  await assert.rejects(f.api.ready(), { code: 'disposed' });
  await flush();
});

test('config and capability subscriptions replay initial public values without exposing the token', () => {
  const f = fixture(); f.init();
  const configs = [], caps = [];
  f.api.config.subscribe(value => configs.push(value));
  f.api.capabilities.subscribe(value => caps.push(value));
  assert.equal(configs[0].dial.color, 'blue');
  assert.equal(caps[0]['hardware.read'], 'denied');
  assert.throws(() => { configs[0].dial.color = 'changed'; }, TypeError);
  f.event('config', { dial: { color: 'green' } });
  assert.equal(f.api.config.get().dial.color, 'green');
  assert.equal('token' in f.api.session, false);
  f.api.dispose();
});

test('readout is hidden before ready; a subscriber disposing during init prevents a late ready event', async () => {
  const f = fixture(), readout = { hidden: false };
  f.api.data.bindReadout('time.read', readout, () => {});
  assert.equal(readout.hidden, true);
  const rejected = assert.rejects(f.api.ready(), { code: 'disposed' });
  f.api.desk.subscribe(() => f.api.dispose());
  f.init(); await rejected;
  assert.equal(f.events.filter(event => event.type === 'dext:ready').length, 0);
  assert.equal(f.api.session, null);
});

test('non-ASCII bytes, cyclic and deep data are bounded before crossing the parent bridge', async () => {
  const f = fixture(); f.init();
  await assert.rejects(f.api.storage.set('value', '中'.repeat(12000)), { code: 'payloadTooLarge' });
  const cyclic = {}; cyclic.self = cyclic;
  await assert.rejects(f.api.storage.set('value', cyclic), { code: 'invalidPayload' });
  let deep = {}; for (let index = 0; index < 30; index++) deep = { child: deep };
  await assert.rejects(f.api.storage.set('value', deep), { code: 'payloadTooDeep' });
  assert.equal(f.sent.some(message => message.method === 'storage.set'), false);
  f.api.dispose();
});

test('geometry listeners receive resize coordinates and the current version for republishing', () => {
  const f = fixture(); f.init();
  const seen = []; f.api.scene.subscribeGeometry(value => seen.push(value));
  assert.equal(seen[0].geometryVersion, 1);
  f.event('geometry', { geometryVersion: 2, viewport: { width: 1280, height: 720, dpr: 1.5 } });
  assert.equal(seen[1].viewport.width, 1280);
  assert.equal(f.api.session.viewport.dpr, 1.5);
  f.event('geometry', { geometryVersion: 3, viewport: { width: 0, height: 720, dpr: 1 } }, 2);
  assert.equal(f.api.session.geometryVersion, 2);
  f.api.dispose();
});
