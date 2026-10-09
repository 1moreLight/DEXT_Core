using Lively.Models.Message;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;

namespace Lively.Common.Helpers
{
    // UI-thread owned state. It retains only immutable JSON projections; callers
    // receive clones. Resource byte authorization is a separate native boundary.
    public sealed class DextRoomRuntimeState
    {
        private long generation, revision;
        private Guid session;
        private string room, stamp;
        private string[] desks;
        private JObject contextPayload, snapshotPayload, revokePayload;

        public bool DockLocked => (bool?)snapshotPayload?["lifecycle"]?["locked"] != false;
        public bool DockCanPresent
        {
            get
            {
                if ((string)contextPayload?["viewKind"] != "dock" || snapshotPayload == null ||
                    (bool?)snapshotPayload["active"] != true || DockLocked ||
                    (string)snapshotPayload["lifecycle"]?["stage"] != "desktop") return false;
                var manifest = contextPayload["manifest"];
                var dock = (string)manifest["dockComponentId"];
                var deskId = (string)snapshotPayload["targetDeskId"] ?? (string)snapshotPayload["currentDeskId"];
                return dock != null && (manifest["desks"] as JArray)?.Any(d =>
                    (string)d["id"] == deskId && (d["components"] as JArray)?.Any(c => (string)c == dock) == true) == true;
            }
        }

        public long Generation => generation;
        public bool HasContext(long document, Guid sessionId) => contextPayload != null && generation == document && session == sessionId;
        public bool CanUseInput(long document, Guid sessionId, long snapshotRevision) => HasContext(document,sessionId) &&
            snapshotPayload != null && revision == snapshotRevision;
        public bool CanFinishStartup(long document, Guid sessionId, long snapshotRevision, long lifecycleRevision) =>
            CanUseInput(document, sessionId, snapshotRevision) && (string)snapshotPayload["lifecycle"]?["stage"] == "starting" &&
            (long?)snapshotPayload["lifecycle"]?["revision"] == lifecycleRevision;

        public bool HasMediaConsumer(string consumer)
        {
            var manifest = contextPayload?["manifest"] as JObject;
            if (manifest == null || consumer == null) return false;
            if (consumer == "scene") return manifest["roomScene"] is JObject;
            if (consumer == "slot.start" || consumer == "slot.idle") return (string)manifest[consumer == "slot.start" ? "start" : "idle"]?["type"] == "html";
            if (consumer.StartsWith("component.", StringComparison.Ordinal)) return (manifest["components"] as JArray)?.Any(c => (string)c["id"] == consumer.Substring(10)) == true;
            if (consumer.StartsWith("slot.background.", StringComparison.Ordinal)) return (manifest["desks"] as JArray)?.Any(d => (string)d["id"] == consumer.Substring(16) && (string)d["background"]?["type"] == "html") == true;
            return false;
        }

        // Rendering includes both source and target during a transition. This is
        // deliberately independent of the stricter input/data consumption gate.
        public bool CanRenderMedia(string consumer)
        {
            if ((string)contextPayload?["viewKind"] == "dock")
                return DockCanPresent && consumer == "component." + (string)contextPayload["manifest"]["dockComponentId"];
            if (!HasMediaConsumer(consumer) || snapshotPayload == null || (bool?)snapshotPayload["active"] != true ||
                (bool?)snapshotPayload["lifecycle"]?["playbackPaused"] != false || (bool?)snapshotPayload["lifecycle"]?["locked"] != false) return false;
            var stage = (string)snapshotPayload["lifecycle"]?["stage"];
            if (consumer == "slot.start") return stage == "starting";
            if (consumer == "slot.idle") return stage == "idle";
            if (stage != "desktop") return false;
            if (consumer == "scene") return true;
            var current = (string)snapshotPayload["currentDeskId"]; var target = (string)snapshotPayload["targetDeskId"];
            if (consumer.StartsWith("slot.background.", StringComparison.Ordinal)) return consumer.Substring(16) == current || consumer.Substring(16) == target;
            var component = consumer.Substring(10);
            return ((JArray)contextPayload["manifest"]["desks"]).Any(d => ((string)d["id"] == current || (string)d["id"] == target) && (d["components"] as JArray)?.Any(c => (string)c == component) == true);
        }

        public bool Initialize(LivelyMessageRoomRuntime value)
        {
            if (value == null || value.ProtocolVersion != 1 || value.RuntimeGeneration <= generation || value.SessionId == Guid.Empty ||
                !Guid.TryParse(value.RoomId, out var roomGuid) || roomGuid == Guid.Empty || string.IsNullOrWhiteSpace(value.InstallationStamp) ||
                value.InstallationStamp.Length > 128 || value.ManifestJson == null || Encoding.UTF8.GetByteCount(value.ManifestJson) > 1024 * 1024 ||
                value.Resources == null || value.Resources.Length > 4096 ||
                (value.ViewKind != "desktop" && value.ViewKind != "dock")) return false;
            try
            {
                JObject manifest;
                using (var text = new StringReader(value.ManifestJson))
                using (var reader = new JsonTextReader(text) { DateParseHandling = DateParseHandling.None, MaxDepth = 64 })
                {
                    manifest = JObject.Load(reader, new JsonLoadSettings { DuplicatePropertyNameHandling = DuplicatePropertyNameHandling.Error });
                    if (reader.Read()) return false;
                }
                if ((int?)manifest["version"] != 3 || (int?)manifest["apiVersion"] != 1 || (string)manifest["id"] != value.RoomId ||
                    !(manifest["desks"] is JArray declaredDesks) || !(manifest["resources"] is JArray declaredResources)) return false;
                if (declaredDesks.Any(d => !(d is JObject) || d["id"]?.Type != JTokenType.String) ||
                    declaredResources.Any(path => path.Type != JTokenType.String)) return false;
                var ids = declaredDesks.Select(d => (string)d["id"]).ToArray();
                if (ids.Length == 0 || ids.Length > 64 || ids.Any(string.IsNullOrWhiteSpace) || ids.Distinct(StringComparer.Ordinal).Count() != ids.Length) return false;
                var paths = new HashSet<string>(StringComparer.OrdinalIgnoreCase); long size = 0;
                foreach (var resource in value.Resources)
                {
                    if (resource == null || string.IsNullOrWhiteSpace(resource.Path) || !paths.Add(resource.Path) ||
                        resource.Size < 0 || resource.Size > 1024L * 1024 * 1024 || resource.Sha256 == null || resource.Sha256.Length != 64 ||
                        resource.Sha256.Any(c => !(c >= '0' && c <= '9' || c >= 'a' && c <= 'f'))) return false;
                    size += resource.Size;
                }
                if (size > 2L * 1024 * 1024 * 1024 || declaredResources.Count != paths.Count ||
                    !new HashSet<string>(declaredResources.Select(p => (string)p), StringComparer.Ordinal).SetEquals(value.Resources.Select(p => p.Path))) return false;
                var payload = new JObject
                {
                    ["type"] = "dext:v3-runtime", ["protocolVersion"] = 1, ["runtimeGeneration"] = value.RuntimeGeneration,
                    ["sessionId"] = value.SessionId.ToString(), ["roomId"] = value.RoomId, ["installationStamp"] = value.InstallationStamp,
                    ["manifest"] = manifest, ["viewKind"] = value.ViewKind,
                    ["resourceBasePath"] = "/content/" + value.RuntimeGeneration.ToString(System.Globalization.CultureInfo.InvariantCulture) + "/",
                    ["resources"] = new JArray(value.Resources.Select(p => new JObject { ["path"] = p.Path, ["sha256"] = p.Sha256, ["size"] = p.Size }))
                };
                generation = value.RuntimeGeneration; revision = 0; session = value.SessionId; room = value.RoomId; stamp = value.InstallationStamp;
                desks = ids; contextPayload = payload; snapshotPayload = null; revokePayload = null;
                return true;
            }
            catch (Exception error) when (error is JsonException || error is InvalidCastException || error is ArgumentException || error is FormatException || error is OverflowException)
            { return false; }
        }

        public bool AcceptSnapshot(LivelyMessageRoomSessionSnapshot value)
        {
            if (value == null || value.ProtocolVersion != 1 || value.SessionId == Guid.Empty || value.Revision <= 0 ||
                value.DeskIds == null || value.DeskIds.Length == 0 || value.DeskIds.Length > 64 || value.Lifecycle == null || value.Lifecycle.Revision < 0 ||
                (value.Lifecycle.Stage != "starting" && value.Lifecycle.Stage != "desktop" && value.Lifecycle.Stage != "idle")) return false;
            if (value.RuntimeGeneration != 0 || generation != 0)
            {
                if (contextPayload == null || value.RuntimeGeneration != generation || value.SessionId != session || value.RoomId != room ||
                    value.InstallationStamp != stamp || value.Revision <= revision || !value.DeskIds.SequenceEqual(desks, StringComparer.Ordinal) ||
                    !desks.Contains(value.CurrentDeskId) || value.TargetDeskId != null && !desks.Contains(value.TargetDeskId) ||
                    value.QueuedDeskId != null && !desks.Contains(value.QueuedDeskId)) return false;
                revision = value.Revision;
                if (!value.IsActive) { Invalidate("inactive"); return true; }
            }
            snapshotPayload = JObject.FromObject(new
            {
                type = "dext:v3-session", protocolVersion = value.ProtocolVersion, runtimeGeneration = value.RuntimeGeneration,
                sessionId = value.SessionId, roomId = value.RoomId, deskIds = value.DeskIds,
                currentDeskId = value.CurrentDeskId, targetDeskId = value.TargetDeskId, queuedDeskId = value.QueuedDeskId,
                transitionId = value.TransitionId, deadlineUtc = value.DeadlineUtc?.ToUniversalTime().ToString("O"),
                revision = value.Revision, operable = value.IsOperable, active = value.IsActive, installationStamp = value.InstallationStamp,
                lifecycle = new { stage = value.Lifecycle.Stage, playbackPaused = value.Lifecycle.PlaybackPaused, locked = value.Lifecycle.Locked, revision = value.Lifecycle.Revision }
            });
            return true;
        }

        public bool Revoke(LivelyMessageRoomRuntimeRevoke value) => value != null && value.ProtocolVersion == 1 && contextPayload != null &&
            value.RuntimeGeneration == generation && value.SessionId == session && value.RoomId == room && value.InstallationStamp == stamp && Invalidate("invalidated");

        public bool Invalidate(string reason)
        {
            snapshotPayload = null;
            if (contextPayload == null) return false;
            revokePayload = new JObject { ["type"] = "dext:v3-runtime-revoked", ["protocolVersion"] = 1, ["runtimeGeneration"] = generation,
                ["sessionId"] = session.ToString(), ["roomId"] = room, ["installationStamp"] = stamp,
                ["reason"] = new[] { "navigation", "inactive", "closed", "processFailed" }.Contains(reason) ? reason : "invalidated" };
            contextPayload = null; desks = null;
            return true;
        }

        public IReadOnlyList<JObject> Replay()
        {
            var messages = new List<JObject>();
            if (contextPayload != null) messages.Add((JObject)contextPayload.DeepClone());
            if (snapshotPayload != null) messages.Add((JObject)snapshotPayload.DeepClone());
            if (revokePayload != null) messages.Add((JObject)revokePayload.DeepClone());
            return messages;
        }
    }
}
