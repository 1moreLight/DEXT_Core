const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const samples = ["v3-basic", "v3-continuous", "v3-fusion-lab", "v3-orbit-lab", "v3test"];

function deskSwitchActions(room) {
  return new Set(
    (room.buttons || [])
      .filter((button) => button.action && ["desk.next", "desk.previous", "desk.go"].includes(button.action.type))
      .map((button) => button.id)
  );
}

test("sample Rooms keep a desktop Desk-switch icon on every Desk", () => {
  for (const name of samples) {
    const room = JSON.parse(fs.readFileSync(path.join(root, "rooms", name, "room.json"), "utf8"));
    const switchIds = deskSwitchActions(room);
    assert.ok(switchIds.size > 0, `${name} must declare desk-switch buttons`);
    for (const desk of room.desks) {
      const icons = desk.icons.filter((icon) => switchIds.has(icon.buttonId));
      assert.ok(icons.length > 0, `${name}/${desk.id} must keep a desktop Desk-switch icon after the Dock cut`);
    }
  }
});
