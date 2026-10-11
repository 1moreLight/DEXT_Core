using Lively.Services.ApplicationDock;
using System.Text.Json;

internal static class TaskProjectionChecks
{
    private static DockGroup Group(string title = "Document") => new("PRIVATE-KEY", "Editor",
        new DockPin("Editor", @"C:\Private\Editor.exe", "PRIVATE-ARGS", "PRIVATE-WORKDIR"),
        new[] { new DockTask(4321, 8765, title, @"C:\Private\Editor.exe") }) { PinScope = "PRIVATE-SCOPE" };
    private static void Assert(bool value) { if (!value) throw new Exception("assertion failed"); }
    private static void Rejected(Action action) { try { action(); } catch (ArgumentException) { return; } throw new Exception("expected rejection"); }
    internal static void Run()
    {
        var failures = new List<string>();
        void Case(string name, Action action) { try { action(); Console.WriteLine("PASS projection: " + name); } catch (Exception e) { failures.Add(name + ": " + e.Message); } }
        Case("projection contains display fields only", () => {
            var view = new DockTaskProjection().Update("PRIVATE-CONTEXT", new[] { Group() }, 4321);
            Assert(view.Sequence == 1 && view.Items.Count == 1 && view.Items[0].Pinned && view.Items[0].Active && view.Items[0].Windows[0].Active);
            var json = JsonSerializer.Serialize(view);
            foreach (var text in new[] { "PRIVATE-", "Private", "Handle", "ProcessId", "Target", "Arguments", "WorkingDirectory", "PinScope" }) Assert(!json.Contains(text));
            Assert(Guid.TryParseExact(view.ContextId, "N", out _) && Guid.TryParseExact(view.Items[0].Id, "N", out _));
        });
        Case("polling title and foreground preserve IDs", () => {
            var p = new DockTaskProjection(); var a = p.Update("A", new[] { Group() }, 4321); var b = p.Update("A", new[] { Group("Renamed") }, 0);
            Assert(a.ContextId == b.ContextId && b.Sequence == 2 && a.Items[0].Id == b.Items[0].Id && a.Items[0].Windows[0].Id == b.Items[0].Windows[0].Id);
            Assert(b.Items[0].Windows[0].Title == "Renamed" && !b.Items[0].Active && a.Items[0].Windows[0].Title == "Document");
        });
        Case("reordering retains item identity", () => {
            var p = new DockTaskProjection(); var second = Group() with { Key = "OTHER", Windows = Array.Empty<DockTask>() };
            var a = p.Update("A", new[] { Group(), second }, 0); var b = p.Update("A", new[] { second, Group() }, 0);
            Assert(a.Items[0].Id == b.Items[1].Id && a.Items[1].Id == b.Items[0].Id);
        });
        Case("removed item never revives old ID", () => {
            var p = new DockTaskProjection(); var a = p.Update("A", new[] { Group() }, 0); p.Update("A", Array.Empty<DockGroup>(), 0); var b = p.Update("A", new[] { Group() }, 0);
            Assert(a.Items[0].Id != b.Items[0].Id && a.Items[0].Windows[0].Id != b.Items[0].Windows[0].Id);
        });
        Case("context change revokes all identities", () => {
            var p = new DockTaskProjection(); var a = p.Update("A", new[] { Group() }, 0); var b = p.Update("B", new[] { Group() }, 0);
            Assert(a.ContextId != b.ContextId && a.Items[0].Id != b.Items[0].Id && a.Items[0].Windows[0].Id != b.Items[0].Windows[0].Id);
        });
        Case("snapshot collections are immutable copies", () => {
            var input = new List<DockTask>(Group().Windows); var groups = new List<DockGroup> { Group() with { Windows = input } };
            var a = new DockTaskProjection().Update("A", groups, 0); input.Clear(); groups.Clear();
            Assert(a.Items.Count == 1 && a.Items[0].Windows.Count == 1);
            Assert(((IList<DockTaskViewItem>)a.Items).IsReadOnly && ((IList<DockTaskViewWindow>)a.Items[0].Windows).IsReadOnly);
        });
        Case("invalid update is atomic", () => {
            var p = new DockTaskProjection(); var a = p.Update("A", new[] { Group() }, 0);
            Rejected(() => p.Update("B", new[] { Group(), Group() }, 0));
            Rejected(() => p.Update("A", new[] { Group() with { Windows = new[] { Group().Windows[0], Group().Windows[0] } } }, 0));
            Rejected(() => p.Update("", new[] { Group() }, 0));
            var b = p.Update("A", new[] { Group() }, 0);
            Assert(b.Sequence == 2 && b.ContextId == a.ContextId && b.Items[0].Id == a.Items[0].Id);
        });
        Case("resolution uses current group without cancelling ordinary refresh", () => {
            var p = new DockTaskProjection(); var a = p.Update("A", new[] { Group() }, 0);
            var latest = Group("Latest") with { Windows = new[] { Group("Latest").Windows[0], new DockTask(999, 8765, "New", @"C:\Private\Editor.exe") } };
            p.Update("A", new[] { latest }, 0);
            Assert(p.TryResolve(a.ContextId, a.Items[0].Id, null, out var g, out var w) && w == null && g.Windows.Count == 2);
            Assert(((IList<DockTask>)g.Windows).IsReadOnly);
            Assert(p.TryResolve(a.ContextId, a.Items[0].Id, a.Items[0].Windows[0].Id, out _, out w) && w.Title == "Latest");
        });
        Case("missing IDs and unrelated window fail without output", () => {
            var p = new DockTaskProjection(); var other = Group() with { Key = "OTHER", Windows = new[] { new DockTask(999, 1, "Other", "other.exe") } };
            var a = p.Update("A", new[] { Group(), other }, 0);
            foreach (var id in new[] { "", "unknown", null }) Assert(!p.TryResolve(a.ContextId, id, null, out var g, out var w) && g == null && w == null);
            Assert(!p.TryResolve(a.ContextId, a.Items[0].Id, a.Items[1].Windows[0].Id, out var wrong, out var selected) && wrong == null && selected == null);
            Assert(p.TryResolve(a.ContextId, a.Items[1].Id, a.Items[1].Windows[0].Id, out _, out _));
        });
        Case("removing a window revokes only its selection", () => {
            var p = new DockTaskProjection(); var a = p.Update("A", new[] { Group() }, 0); p.Update("A", new[] { Group() with { Windows = Array.Empty<DockTask>() } }, 0);
            Assert(!p.TryResolve(a.ContextId, a.Items[0].Id, a.Items[0].Windows[0].Id, out _, out _));
            Assert(p.TryResolve(a.ContextId, a.Items[0].Id, null, out var g, out _) && g.Windows.Count == 0);
            p.Update("A", Array.Empty<DockGroup>(), 0);
            Assert(!p.TryResolve(a.ContextId, a.Items[0].Id, null, out _, out _));
        });
        Case("new process with same handle cannot reuse window selection", () => {
            var p = new DockTaskProjection(); var a = p.Update("A", new[] { Group() }, 0);
            var b = p.Update("A", new[] { Group() with { Windows = new[] { Group().Windows[0] with { ProcessId = 999 } } } }, 0);
            Assert(!p.TryResolve(a.ContextId, a.Items[0].Id, a.Items[0].Windows[0].Id, out _, out _));
            Assert(b.Items[0].Windows[0].Id != a.Items[0].Windows[0].Id && p.TryResolve(b.ContextId, b.Items[0].Id, b.Items[0].Windows[0].Id, out _, out _));
        });
        Case("Desk or pin revision change invalidates old menu", () => {
            var p = new DockTaskProjection(); var a = p.Update("room/desk/revision1", new[] { Group() }, 0);
            var b = p.Update("room/desk/revision2", new[] { Group() }, 0);
            Assert(!p.TryResolve(a.ContextId, a.Items[0].Id, null, out _, out _));
            Assert(p.TryResolve(b.ContextId, b.Items[0].Id, null, out _, out _));
        });
        Case("Clear immediately revokes and never resurrects same context", () => {
            var p = new DockTaskProjection(); var a = p.Update("A", new[] { Group() }, 0); p.Clear(); p.Clear();
            Assert(!p.TryResolve(a.ContextId, a.Items[0].Id, null, out _, out _));
            var b = p.Update("A", new[] { Group() }, 0);
            Assert(b.Sequence == 2 && b.ContextId != a.ContextId && b.Items[0].Id != a.Items[0].Id && p.TryResolve(b.ContextId, b.Items[0].Id, null, out _, out _));
        });
        if (failures.Count > 0) throw new Exception(string.Join(Environment.NewLine, failures));
        Console.WriteLine("Task projection checks: 13 passed");
    }
}
