using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;

namespace Lively.Services.DesktopSync;

internal sealed record DesktopTransferItem(string Source, string? Destination, string Status, int HResult);
internal sealed record DesktopTransferResult(IReadOnlyList<DesktopTransferItem> Items, bool Aborted, int HResult);
internal static class DesktopShellTransfer
{
    internal static Task<DesktopTransferResult> RunAsync(IReadOnlyList<string> sources, string destination,
        string allowedEffects, int modifiers, CancellationToken cancellation = default, bool interactive = true, IntPtr owner = default, Func<bool>? permitted = null)
        => RunCoreAsync(sources, destination, source => DesktopDropPolicy.Select(allowedEffects, modifiers,
            modifiers == 0 && DesktopDropVolume.SameVolume(source, destination)), cancellation, interactive, owner, permitted);
    internal static Task<DesktopTransferResult> RunAsync(IReadOnlyList<string> sources, string destination,
        DesktopDropEffect effect, CancellationToken cancellation = default, bool interactive = true, IntPtr owner = default)
        => RunCoreAsync(sources, destination, _ => effect, cancellation, interactive, owner);
    internal static Task<DesktopTransferResult> RunAsync(IReadOnlyList<string> sources, string destination,
        bool move, CancellationToken cancellation = default, bool interactive = true, IntPtr owner = default)
        => RunCoreAsync(sources, destination, _ => move ? DesktopDropEffect.Move : DesktopDropEffect.Copy, cancellation, interactive, owner);
    private static Task<DesktopTransferResult> RunCoreAsync(IReadOnlyList<string> sources, string destination,
        Func<string, DesktopDropEffect> selectEffect, CancellationToken cancellation, bool interactive, IntPtr owner, Func<bool>? permitted = null)
    {
        if (sources.Count == 0 || sources.Count > 256) throw new ArgumentOutOfRangeException(nameof(sources));
        var copy = sources.ToArray();
        return RunStaAsync(() => Execute(copy, destination, selectEffect, cancellation, interactive, owner, permitted), cancellation, permitted);
    }
    internal static Task<DesktopTransferResult> RunStaAsync(Func<DesktopTransferResult> execute,
        CancellationToken cancellation, Func<bool>? permitted = null)
    {
        var completed = new TaskCompletionSource<DesktopTransferResult>(TaskCreationOptions.RunContinuationsAsynchronously);
        var thread = new Thread(() =>
        {
            var initialized = false;
            try
            {
                cancellation.ThrowIfCancellationRequested();
                if (permitted?.Invoke() == false) throw new OperationCanceledException("Desktop drop scope revoked.", cancellation);
                Marshal.ThrowExceptionForHR(CoInitializeEx(IntPtr.Zero, 2)); initialized = true;
                completed.TrySetResult(execute());
            }
            catch (OperationCanceledException) { completed.TrySetCanceled(cancellation); }
            catch (Exception error) { completed.TrySetException(error); }
            finally { if (initialized) CoUninitialize(); }
        }) { IsBackground = true, Name = "Dext desktop Shell transfer" };
        thread.SetApartmentState(ApartmentState.STA); thread.Start();
        return completed.Task;
    }
    private static DesktopTransferResult Execute(string[] sources, string destination, Func<string, DesktopDropEffect> selectEffect,
        CancellationToken cancellation, bool interactive, IntPtr owner, Func<bool>? permitted)
    {
        if (!Path.IsPathFullyQualified(destination) || !Directory.Exists(destination)) throw new DirectoryNotFoundException("Desktop destination unavailable.");
        destination = Path.TrimEndingDirectorySeparator(Path.GetFullPath(destination));
        var results = new List<DesktopTransferItem>();
        var resources = new List<object>();
        var pending = new List<TransferSink>();
        var staged = new List<(string Directory, string Path)>();
        try
        {
            var operation = (IDesktopFileOperation)Activator.CreateInstance(Type.GetTypeFromCLSID(new Guid("3ad05575-8857-4850-9277-11b85bdb8e09"), true)!)!;
            resources.Add(operation);
            // Native conflict/cancel UI stays enabled for user operations. Probe
            // mode suppresses progress/errors, not every conflict prompt.
            operation.SetOperationFlags(interactive ? 0x200u : 0x100604u);
            if (owner != IntPtr.Zero) operation.SetOwnerWindow(owner);
            var target = CreateItem(destination); resources.Add(target);
            foreach (var input in sources.Distinct(StringComparer.OrdinalIgnoreCase))
            {
                cancellation.ThrowIfCancellationRequested();
                if (permitted?.Invoke() == false) throw new OperationCanceledException("Desktop drop scope revoked.", cancellation);
                try
                {
                    var effect = selectEffect(input);
                    if (effect is not (DesktopDropEffect.Copy or DesktopDropEffect.Move or DesktopDropEffect.Link)) throw new ArgumentException("Requested drop effect is not allowed by the source.");
                    if (!Path.IsPathFullyQualified(input)) throw new ArgumentException("Source must be absolute.");
                    var source = Path.TrimEndingDirectorySeparator(Path.GetFullPath(input));
                    if (!File.Exists(source) && !Directory.Exists(source)) throw new FileNotFoundException("Dropped source no longer exists.", source);
                    if (effect != DesktopDropEffect.Link && string.Equals(Path.GetDirectoryName(source), destination, StringComparison.OrdinalIgnoreCase))
                    { results.Add(new(source, source, "unchanged", 0)); continue; }
                    if (effect != DesktopDropEffect.Link && (string.Equals(source, destination, StringComparison.OrdinalIgnoreCase) ||
                        Directory.Exists(source) && destination.StartsWith(source + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)))
                        throw new IOException("Cannot transfer a folder into itself.");
                    var transferPath = source;
                    if (effect == DesktopDropEffect.Link)
                    {
                        var directory = Directory.CreateTempSubdirectory("Dext-desktop-link-").FullName;
                        var name = Path.GetFileName(source);
                        if (string.IsNullOrEmpty(name)) name = "Drive";
                        transferPath = Path.Combine(directory, name + ".lnk");
                        staged.Add((directory, transferPath));
                        DesktopShellShortcut.Create(source, transferPath);
                    }
                    var item = CreateItem(transferPath); resources.Add(item);
                    var sink = new TransferSink(source, cancellation, transferPath, permitted);
                    if (effect == DesktopDropEffect.Move) operation.MoveItem(item, target, null, sink);
                    else operation.CopyItem(item, target, null, sink);
                    pending.Add(sink);
                }
                catch (Exception error) when (error is IOException or UnauthorizedAccessException or ArgumentException or COMException)
                { results.Add(new(input, null, "failed", error.HResult)); }
            }
            cancellation.ThrowIfCancellationRequested();
                if (permitted?.Invoke() == false) throw new OperationCanceledException("Desktop drop scope revoked.", cancellation);
            var result = pending.Count == 0 ? 0 : operation.PerformOperations();
            operation.GetAnyOperationsAborted(out var aborted);
            aborted = aborted || cancellation.IsCancellationRequested || result == unchecked((int)0x800704C7) || pending.Any(sink => sink.Cancelled);
            foreach (var sink in pending)
                results.Add(sink.Result ?? new(sink.Source, null, aborted || cancellation.IsCancellationRequested ? "cancelled" : "failed", result));
            return new(results.AsReadOnly(), aborted || cancellation.IsCancellationRequested, result);
        }
        finally
        {
            for (var index = resources.Count - 1; index >= 0; index--)
                if (Marshal.IsComObject(resources[index])) Marshal.ReleaseComObject(resources[index]);
            GC.KeepAlive(pending);
            foreach (var entry in staged)
            {
                // Remove only our generated file and its unique empty directory.
                try { File.Delete(entry.Path); Directory.Delete(entry.Directory); }
                catch (IOException) { }
                catch (UnauthorizedAccessException) { }
            }
        }
    }
    internal static IDesktopShellItem CreateItem(string path)
    {
        var iid = typeof(IDesktopShellItem).GUID;
        Marshal.ThrowExceptionForHR(SHCreateItemFromParsingName(path, IntPtr.Zero, ref iid, out var item));
        return item;
    }
    internal static string? ItemPath(IDesktopShellItem? item)
    {
        if (item is null) return null;
        IntPtr name = IntPtr.Zero;
        try { item.GetDisplayName(0x80058000, out name); return Marshal.PtrToStringUni(name); }
        catch (COMException) { return null; }
        finally { if (name != IntPtr.Zero) Marshal.FreeCoTaskMem(name); }
    }
    [DllImport("shell32.dll", CharSet = CharSet.Unicode)] private static extern int SHCreateItemFromParsingName(string path, IntPtr context, ref Guid iid, out IDesktopShellItem item);
    [DllImport("ole32.dll")] private static extern int CoInitializeEx(IntPtr reserved, uint flags);
    [DllImport("ole32.dll")] private static extern void CoUninitialize();
}

[ComVisible(true), ClassInterface(ClassInterfaceType.None)]
public sealed class TransferSink : IDesktopTransferProgress
{
    internal string Source { get; }
    internal DesktopTransferItem? Result { get; private set; }
    internal bool Cancelled { get; private set; }
    private readonly CancellationToken cancellation;
    private readonly string callbackSource;
    private readonly Func<bool>? permitted;
    internal TransferSink(string source, CancellationToken cancellation, string? callbackSource = null, Func<bool>? permitted = null)
    { Source = source; this.cancellation = cancellation; this.callbackSource = callbackSource ?? source; this.permitted = permitted; }
    private int Continue()
    {
        try { if (cancellation.IsCancellationRequested || permitted?.Invoke() == false) Cancelled = true; }
        catch { Cancelled = true; }
        return Cancelled ? unchecked((int)0x800704C7) : 0;
    }
    private int Complete(IDesktopShellItem item, IDesktopShellItem? created, int result)
    {
        // A folder operation can report children too. Only its top-level source
        // determines the result returned for this requested item.
        if (string.Equals(DesktopShellTransfer.ItemPath(item), callbackSource, StringComparison.OrdinalIgnoreCase))
        {
            var destination = DesktopShellTransfer.ItemPath(created);
            Result = new(Source, destination, result >= 0 && destination is not null ? "completed" : result >= 0 ? "skipped" : Cancelled || result == unchecked((int)0x800704C7) ? "cancelled" : "failed", result);
        }
        return 0;
    }
    public int StartOperations() => Continue();
    public int FinishOperations(int result) => 0;
    public int PreRenameItem(uint flags, IDesktopShellItem item, string name) => Continue();
    public int PostRenameItem(uint flags, IDesktopShellItem item, string name, int result, IDesktopShellItem? created) => Complete(item, created, result);
    public int PreMoveItem(uint flags, IDesktopShellItem item, IDesktopShellItem destination, string name) => Continue();
    public int PostMoveItem(uint flags, IDesktopShellItem item, IDesktopShellItem destination, string name, int result, IDesktopShellItem? created) => Complete(item, created, result);
    public int PreCopyItem(uint flags, IDesktopShellItem item, IDesktopShellItem destination, string name) => Continue();
    public int PostCopyItem(uint flags, IDesktopShellItem item, IDesktopShellItem destination, string name, int result, IDesktopShellItem? created) => Complete(item, created, result);
    public int PreDeleteItem(uint flags, IDesktopShellItem item) => Continue();
    public int PostDeleteItem(uint flags, IDesktopShellItem item, int result, IDesktopShellItem? created) => 0;
    public int PreNewItem(uint flags, IDesktopShellItem destination, string name) => Continue();
    public int PostNewItem(uint flags, IDesktopShellItem destination, string name, string template, uint attributes, int result, IDesktopShellItem? created) => 0;
    public int UpdateProgress(uint total, uint completed) => Continue();
    public int ResetTimer() => 0;
    public int PauseTimer() => 0;
    public int ResumeTimer() => 0;
}