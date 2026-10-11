using Lively.Services.DesktopSync;

internal static class CrossVolumeChecks
{
    internal static async Task Run(string firstParent, string secondParent)
    {
        if (!Path.IsPathFullyQualified(firstParent) || !Path.IsPathFullyQualified(secondParent) ||
            !Directory.Exists(firstParent) || !Directory.Exists(secondParent))
            throw new ArgumentException("Provide two existing absolute directories on different volumes.");
        var name = "Dext-cross-volume-" + Guid.NewGuid().ToString("N");
        var source = Path.Combine(Path.GetFullPath(firstParent), name);
        var destination = Path.Combine(Path.GetFullPath(secondParent), name);
        if (Directory.Exists(source) || Directory.Exists(destination)) throw new IOException("Fixture already exists.");
        var files = new List<string>();
        try
        {
            Directory.CreateDirectory(source);
            Directory.CreateDirectory(destination);
            Check(DesktopDropVolume.SameVolume(source, source) && DesktopDropVolume.SameVolume(destination, destination) &&
                !DesktopDropVolume.SameVolume(source, destination), "both native volume identities resolve and differ");
            foreach (var item in new[] { (Name: "default-copy.txt", Modifiers: 0, Move: false), (Name: "shift-move.txt", Modifiers: 2, Move: true) })
            {
                var original = Path.Combine(source, item.Name);
                var target = Path.Combine(destination, item.Name);
                files.Add(original); files.Add(target);
                var content = "cross-volume fixture " + Guid.NewGuid();
                File.WriteAllText(original, content);
                var result = await DesktopShellTransfer.RunAsync(new[] { original }, destination, "all", item.Modifiers, default, false);
                var transferred = result.Items.Single();
                Check(!result.Aborted && result.HResult >= 0 && transferred.Status == "completed" &&
                    string.Equals(transferred.Destination, target, StringComparison.OrdinalIgnoreCase) &&
                    File.ReadAllText(target) == content &&
                    (item.Move ? !File.Exists(original) : File.ReadAllText(original) == content),
                    item.Move ? "actual cross-volume Shift move completes destination before removing source" :
                    "actual cross-volume default copies and preserves source bytes");
            }
        }
        finally
        {
            // Only the exact files created by this run; an unexpected file makes
            // the nonrecursive directory removal fail instead of deleting it.
            foreach (var file in files) File.Delete(file);
            if (Directory.Exists(source)) Directory.Delete(source);
            if (Directory.Exists(destination)) Directory.Delete(destination);
        }
    }
    private static void Check(bool success, string description)
    {
        if (!success) throw new Exception(description);
        Console.WriteLine("PASS " + description);
    }
}