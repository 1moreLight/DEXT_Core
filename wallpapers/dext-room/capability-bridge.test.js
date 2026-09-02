const assert = require("node:assert/strict");
const bridge = require("./capability-bridge.js");

assert.deepEqual(bridge.cleanPermissions(["time.read", "time.read", "network.proxy"]), ["time.read"]);
assert.deepEqual(bridge.validateAction({ id: "system.media.next" }), { id: "system.media.next" });
assert.equal(bridge.validateAction({ id: "system.media.next", value: 1 }), null);
assert.deepEqual(bridge.validateAction({ id: "system.volume.set", value: 0.35 }), { id: "system.volume.set", value: 0.35 });
assert.equal(bridge.validateAction({ id: "system.volume.set", value: 2 }), null);
assert.equal(bridge.validateAction({ id: "shell", value: "calc.exe" }), null);

const hardware = bridge.sanitizeHardware({ CurrentCpu: 150, CurrentGpu3D: -1, CurrentRamAvail: 2048, TotalRam: 8192 });
assert.equal(hardware.cpu.usage, 100);
assert.equal(hardware.gpu.usage, 0);
assert.equal(hardware.memory.usedPercent, 75);
assert.equal("NameCpu" in hardware.cpu, false);

const messages = [];
const host = bridge.createHost({
  viewport: () => ({ width: 1920, height: 1080 }),
  desk: () => ({ index: 0, name: "Desk" }),
});
const unregister = host.register({
  instanceId: "instance", token: "token", permissions: ["hardware.cpu.read", "now-playing.read"],
  post: (message) => messages.push(message),
});
host.updateHardware({ CurrentCpu: 42 });
host.updateMedia({ Title: "Song", Artist: "Artist", Thumbnail: "secret-art" });
assert(messages.some((message) => message.capability === "hardware.cpu.read" && message.data.usage === 42));
assert(messages.some((message) => message.capability === "now-playing.read" && message.data.title === "Song" && message.data.artwork === null));
assert.equal(messages.some((message) => message.capability === "now-playing.artwork.read"), false);
unregister();
const count = messages.length;
host.updateHardware({ CurrentCpu: 2 });
assert.equal(messages.length, count);

console.log("capability bridge tests passed");
