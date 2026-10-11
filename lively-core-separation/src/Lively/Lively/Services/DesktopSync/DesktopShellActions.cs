using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;

namespace Lively.Services.DesktopSync;

internal static partial class DesktopShellActions
{
    internal static Task<DesktopTransferResult> RenameAsync(string source, string newName, IntPtr owner = default,
        CancellationToken cancellation = default, bool interactive = true, Func<bool>? permitted = null)
    {
        if (string.IsNullOrWhiteSpace(newName) || newName.Length > 255 || newName is "." or ".." ||
            newName.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0 || newName.EndsWith('.') || newName.EndsWith(' '))
            throw new ArgumentException("Enter a file name without path separators or a trailing dot/space.", nameof(newName));
        if (!Path.IsPathFullyQualified(source)) throw new ArgumentException("Source must be absolute.", nameof(source));
        var path = Path.TrimEndingDirectorySeparator(Path.GetFullPath(source));
        return DesktopShellTransfer.RunStaAsync(() => Rename(path, newName, owner, cancellation, interactive, permitted), cancellation, permitted);
    }

    private static DesktopTransferResult Rename(string source, string name, IntPtr owner,
        CancellationToken cancellation, bool interactive, Func<bool>? permitted)
    {
        IDesktopFileOperation? operation = null;
        IDesktopShellItem? item = null;
        var sink = new TransferSink(source, cancellation, permitted: permitted);
        void CheckScope()
        {
            cancellation.ThrowIfCancellationRequested();
            if (permitted?.Invoke() == false) throw new OperationCanceledException("Desktop rename scope retired.", cancellation);
        }
        DesktopTransferResult Single(string status, string? destination, int error, bool aborted = false) =>
            new(new[] { new DesktopTransferItem(source, destination, status, error) }, aborted, error);
        try
        {
            CheckScope();
            if (!File.Exists(source) && !Directory.Exists(source)) throw new FileNotFoundException("Selected file no longer exists.", source);
            if (string.Equals(Path.GetFileName(source), name, StringComparison.Ordinal)) return Single("unchanged", source, 0);
            var parent = Path.GetDirectoryName(source) ?? throw new IOException("Cannot rename a volume root.");
            var target = Path.Combine(parent, name);
            // A known name collision is returned to the rename editor. Never
            // resolve it by automatically replacing an existing desktop item.
            if (!string.Equals(source, target, StringComparison.OrdinalIgnoreCase) && (File.Exists(target) || Directory.Exists(target)))
                return Single("conflict", null, unchecked((int)0x800700B7));
            operation = (IDesktopFileOperation)Activator.CreateInstance(Type.GetTypeFromCLSID(new Guid("3ad05575-8857-4850-9277-11b85bdb8e09"), true)!)!;
            // User operations retain Shell conflict/cancel UI and undo support.
            operation.SetOperationFlags(interactive ? 0x240u : 0x100604u);
            if (owner != IntPtr.Zero) operation.SetOwnerWindow(owner);
            item = DesktopShellTransfer.CreateItem(source);
            operation.RenameItem(item, name, sink);
            CheckScope();
            var result = operation.PerformOperations();
            operation.GetAnyOperationsAborted(out var aborted);
            aborted = aborted || cancellation.IsCancellationRequested || sink.Cancelled || result == unchecked((int)0x800704C7);
            var completed = sink.Result ?? new DesktopTransferItem(source, null, aborted ? "cancelled" : "failed", result);
            return new(new[] { completed }, aborted, result);
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException or COMException)
        {
            return Single("failed", null, error.HResult);
        }
        finally
        {
            if (item is not null) Marshal.ReleaseComObject(item);
            if (operation is not null) Marshal.ReleaseComObject(operation);
            GC.KeepAlive(sink);
        }
    }
}