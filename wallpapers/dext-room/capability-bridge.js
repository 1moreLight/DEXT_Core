(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DextCapabilityBridge = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const PROTOCOL = 1;
  const PERMISSIONS = new Set([
    "time.read", "locale.read", "viewport.read", "desk.read", "playback.read",
    "audio.spectrum", "hardware.cpu.read", "hardware.gpu.read", "hardware.memory.read",
    "now-playing.read", "now-playing.artwork.read", "system.volume.read", "hardware.network.read", "action.invoke",
  ]);
  const ACTIONS = new Set([
    "system.media.play", "system.media.pause", "system.media.toggle-play-pause",
    "system.media.next", "system.media.previous", "system.volume.set",
    "system.volume.mute", "system.volume.toggle-mute",
  ]);

  function finite(value, fallback = 0) {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  }

  function percent(value) {
    return Math.min(100, Math.max(0, finite(value)));
  }

  function cleanPermissions(value) {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter((item) => PERMISSIONS.has(item)))];
  }

  function validateAction(action) {
    if (!action || typeof action !== "object" || !ACTIONS.has(action.id)) return null;
    if (action.id === "system.volume.set") {
      return typeof action.value === "number" && Number.isFinite(action.value) && action.value >= 0 && action.value <= 1
        ? { id: action.id, value: action.value }
        : null;
    }
    if (action.id === "system.volume.mute") {
      return typeof action.value === "boolean" ? { id: action.id, value: action.value } : null;
    }
    return action.value === undefined ? { id: action.id } : null;
  }

  function sanitizeHardware(value) {
    const data = value && typeof value === "object" ? value : {};
    const totalMb = Math.max(0, finite(data.TotalRam ?? data.totalRam));
    const availableMb = Math.max(0, finite(data.CurrentRamAvail ?? data.currentRamAvail));
    return {
      cpu: { usage: percent(data.CurrentCpu ?? data.currentCpu) },
      gpu: { usage: percent(data.CurrentGpu3D ?? data.currentGpu3D) },
      memory: {
        totalMb,
        availableMb: Math.min(totalMb || availableMb, availableMb),
        usedPercent: totalMb > 0 ? percent((totalMb - availableMb) / totalMb * 100) : 0,
      },
      network: {
        downBytesPerSecond: Math.max(0, finite(data.CurrentNetDown ?? data.currentNetDown)),
        upBytesPerSecond: Math.max(0, finite(data.CurrentNetUp ?? data.currentNetUp)),
      },
    };
  }

  function cleanText(value, maximum = 512) {
    return typeof value === "string" ? value.slice(0, maximum) : "";
  }

  function sanitizeMedia(value, includeArtwork) {
    const data = value && typeof value === "object" ? value : {};
    const artwork = cleanText(data.Thumbnail ?? data.thumbnail ?? data.thumbnailBase64, 2 * 1024 * 1024);
    return {
      hasSession: Boolean(data.hasSession ?? data.Title ?? data.title),
      title: cleanText(data.Title ?? data.title),
      artist: cleanText(data.Artist ?? data.artist),
      album: cleanText(data.AlbumTitle ?? data.albumTitle),
      playbackStatus: cleanText(data.PlaybackStatus ?? data.playbackStatus ?? data.PlaybackType ?? data.playbackType, 64),
      positionSeconds: Math.max(0, finite(data.positionSeconds)),
      durationSeconds: Math.max(0, finite(data.durationSeconds)),
      artwork: includeArtwork && artwork ? artwork : null,
    };
  }

  function sanitizeSpectrum(value) {
    if (!Array.isArray(value) && !ArrayBuffer.isView(value)) return [];
    return Array.from(value).slice(0, 256).map((item) => Math.min(1, Math.max(0, finite(Number(item)))));
  }

  function createHost(options) {
    const instances = new Set();
    let hardware = sanitizeHardware(null);
    let media = sanitizeMedia(null, false);
    let volume = { level: 0, muted: false, available: false };
    let spectrum = [];
    let playback = { paused: false };

    function post(instance, capability, data) {
      if (instance.disposed || !instance.permissions.has(capability)) return;
      instance.post({
        type: "dext:capability",
        protocol: PROTOCOL,
        instanceId: instance.instanceId,
        token: instance.token,
        capability,
        data,
      });
    }

    function pushSnapshot(instance) {
      const now = new Date();
      post(instance, "time.read", { epochMs: now.getTime(), iso: now.toISOString() });
      post(instance, "locale.read", {
        language: typeof navigator === "object" ? navigator.language : "en-US",
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      });
      post(instance, "viewport.read", options.viewport());
      post(instance, "desk.read", options.desk());
      post(instance, "playback.read", playback);
      post(instance, "hardware.cpu.read", hardware.cpu);
      post(instance, "hardware.gpu.read", hardware.gpu);
      post(instance, "hardware.memory.read", hardware.memory);
      post(instance, "hardware.network.read", hardware.network);
      post(instance, "audio.spectrum", spectrum);
      post(instance, "now-playing.read", sanitizeMedia(media, false));
      post(instance, "now-playing.artwork.read", sanitizeMedia(media, true));
      post(instance, "system.volume.read", volume);
    }

    function register(value) {
      const instance = {
        ...value,
        permissions: new Set(cleanPermissions(value.permissions)),
        disposed: false,
      };
      instances.add(instance);
      pushSnapshot(instance);
      return () => {
        instance.disposed = true;
        instances.delete(instance);
      };
    }

    function publish(capability, data) {
      for (const instance of instances) post(instance, capability, data);
    }

    function updateHardware(value) {
      hardware = sanitizeHardware(value);
      publish("hardware.cpu.read", hardware.cpu);
      publish("hardware.gpu.read", hardware.gpu);
      publish("hardware.memory.read", hardware.memory);
      publish("hardware.network.read", hardware.network);
    }

    function updateMedia(value) {
      media = sanitizeMedia(value, true);
      for (const instance of instances) {
        post(instance, "now-playing.read", sanitizeMedia(media, false));
        post(instance, "now-playing.artwork.read", sanitizeMedia(media, true));
      }
    }

    function updateVolume(value) {
      const data = value && typeof value === "object" ? value : {};
      volume = {
        level: Math.min(1, Math.max(0, finite(data.level))),
        muted: Boolean(data.muted),
        available: data.available !== false,
      };
      publish("system.volume.read", volume);
    }

    function updateSpectrum(value) {
      spectrum = sanitizeSpectrum(value);
      publish("audio.spectrum", spectrum);
    }

    function updatePlayback(value) {
      playback = { paused: Boolean(value?.isPaused ?? value?.IsPaused ?? value?.paused) };
      publish("playback.read", playback);
    }

    function tick() {
      const now = new Date();
      publish("time.read", { epochMs: now.getTime(), iso: now.toISOString() });
    }

    function deskChanged() {
      publish("desk.read", options.desk());
    }

    return {
      register, updateHardware, updateMedia, updateVolume, updateSpectrum,
      updatePlayback, tick, deskChanged, pushSnapshot,
      dispose() {
        for (const instance of instances) instance.disposed = true;
        instances.clear();
      },
    };
  }

  return {
    PROTOCOL,
    cleanPermissions,
    validateAction,
    sanitizeHardware,
    sanitizeMedia,
    sanitizeSpectrum,
    createHost,
  };
});
