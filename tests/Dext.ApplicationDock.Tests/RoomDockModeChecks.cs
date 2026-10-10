using Dext.Core.Rooms;
internal static class RoomDockModeChecks
{
    internal static void Run()
    {
        var directory = Path.Combine(Path.GetTempPath(), "dext-mode-" + Guid.NewGuid().ToString("N"));
        try
        {
            var path = Path.Combine(directory, "dock.json");
            var store = new RoomDockPreferenceStore(path);
            foreach (var mode in new[] { "overlay", "autohide", "reserve" })
            {
                var result = store.Patch("{\"mode\":\"" + mode + "\"}");
                if (result.Status != "accepted" || new RoomDockPreferenceStore(path).Read().Preferences?.Mode != mode)
                    throw new Exception("Mode must survive preference roundtrip: " + mode);
                Console.WriteLine("PASS room Dock mode: " + mode);
            }
        }
        finally { if (Directory.Exists(directory)) Directory.Delete(directory, true); }
    }
}
