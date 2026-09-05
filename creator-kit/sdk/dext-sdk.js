(function (root) {
  "use strict";

  const PROTOCOL = 1;
  const subscriptions = new Map();
  const latest = new Map();
  let session = null;
  let readySent = false;

  function post(event, detail) {
    if (!session) return false;
    parent.postMessage({
      type: session.kind === "widget" ? "dext:widget" : "dext:scene",
      protocol: PROTOCOL,
      instanceId: session.instanceId,
      token: session.token,
      event,
      ...(detail === undefined ? {} : { detail }),
    }, "*");
    return true;
  }

  function emit(capability, data) {
    latest.set(capability, data);
    for (const listener of subscriptions.get(capability) || []) {
      try { listener(data); } catch (error) { console.error("Dext subscriber failed", error); }
    }
  }

  addEventListener("message", (event) => {
    if (event.source !== parent || !event.data || typeof event.data !== "object") return;
    const data = event.data;
    if ((data.type === "dext:scene:init" || data.type === "dext:widget:init") && data.protocol === PROTOCOL) {
      session = Object.freeze({
        kind: data.type === "dext:widget:init" ? "widget" : "scene",
        instanceId: data.instanceId,
        token: data.token,
        permissions: Object.freeze(Array.isArray(data.permissions) ? [...data.permissions] : []),
        viewport: Object.freeze({ ...(data.viewport || {}) }),
        config: Object.freeze({ ...(data.config || {}) }),
      });
      if (!readySent) { readySent = true; post("ready"); }
      dispatchEvent(new CustomEvent("dextready", { detail: session }));
      return;
    }
    if (!session || data.type !== "dext:capability" || data.protocol !== PROTOCOL ||
        data.instanceId !== session.instanceId || data.token !== session.token) return;
    if (!session.permissions.includes(data.capability)) return;
    emit(data.capability, data.data);
  });

  root.dext = Object.freeze({
    protocol: PROTOCOL,
    get session() { return session; },
    get(capability) { return latest.get(capability); },
    subscribe(capability, listener) {
      if (typeof listener !== "function") throw new TypeError("listener must be a function");
      const listeners = subscriptions.get(capability) || new Set();
      listeners.add(listener);
      subscriptions.set(capability, listeners);
      if (latest.has(capability)) listener(latest.get(capability));
      return () => listeners.delete(listener);
    },
    ready() { readySent = true; return post("ready"); },
    done(detail) { return post("done", detail); },
    error(message) { return post("error", String(message).slice(0, 512)); },
  });
})(globalThis);
