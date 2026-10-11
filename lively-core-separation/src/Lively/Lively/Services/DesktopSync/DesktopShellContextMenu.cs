using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Threading;

namespace Lively.Services.DesktopSync;

// A menu and its COM handlers belong to one STA. The native owner forwards menu
// messages for lazy submenus; callers must dispose on the creating thread.
internal sealed partial class DesktopShellContextMenu : IDisposable
{
    private const uint FirstCommand = 1, LastCommand = 0x7fff;
    private readonly int thread = Environment.CurrentManagedThreadId;
    private readonly List<IntPtr> pidls = new();
    private IntPtr desktop, folder, children, menu;
    private IDesktopContextMenu? handler;
    private uint commandCount;

    private DesktopShellContextMenu() { }
    internal IntPtr Handle { get { CheckThread(); return menu; } }
    internal IReadOnlyList<string> Verbs => Commands().Select(command => command.Verb).Where(verb => verb.Length != 0).ToArray();

    internal static DesktopShellContextMenu Create(IReadOnlyList<string> paths, IntPtr owner = default)
    {
        if (Thread.CurrentThread.GetApartmentState() != ApartmentState.STA)
            throw new InvalidOperationException("Shell menus require STA ownership.");
        if (paths is null || paths.Count is 0 or > 256) throw new ArgumentException("Select between 1 and 256 files.", nameof(paths));
        var files = paths.Select(path =>
        {
            if (string.IsNullOrWhiteSpace(path) || !Path.IsPathFullyQualified(path)) throw new ArgumentException("Paths must be absolute.", nameof(paths));
            var full = Path.GetFullPath(path);
            if (!File.Exists(full) && !Directory.Exists(full)) throw new FileNotFoundException("Selected item no longer exists.", full);
            return full;
        }).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        var result = new DesktopShellContextMenu();
        try
        {
            Marshal.ThrowExceptionForHR(SHGetDesktopFolder(out result.desktop));
            // Absolute PIDLs are relative to the Shell desktop namespace root.
            // Unlike binding an IShellItemArray to SFUIObject, this common root
            // also represents selections spanning user and public directories.
            result.folder = Marshal.AllocCoTaskMem(2);
            Marshal.WriteInt16(result.folder, 0);
            result.children = Marshal.AllocCoTaskMem(IntPtr.Size * files.Length);
            for (var i = 0; i < files.Length; i++)
            {
                Marshal.ThrowExceptionForHR(SHParseDisplayName(files[i], IntPtr.Zero, out var pidl, 0, out _));
                result.pidls.Add(pidl);
                Marshal.WriteIntPtr(result.children, i * IntPtr.Size, pidl);
            }
            var definition = new DefaultMenu { Owner = owner, Folder = result.folder, ShellFolder = result.desktop,
                Count = (uint)files.Length, Children = result.children };
            var iid = typeof(IDesktopContextMenu).GUID;
            Marshal.ThrowExceptionForHR(SHCreateDefaultContextMenu(ref definition, ref iid, out result.handler));
            result.menu = CreatePopupMenu();
            if (result.menu == IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error());
            var hr = result.handler.QueryContextMenu(result.menu, 0, FirstCommand, LastCommand, 0x90);
            Marshal.ThrowExceptionForHR(hr);
            result.commandCount = (uint)(hr & 0xffff);
            return result;
        }
        catch { result.Dispose(); throw; }
    }

    internal IReadOnlyList<DesktopShellMenuCommand> Commands()
    {
        CheckThread();
        var commands = new List<DesktopShellMenuCommand>();
        void Visit(IntPtr current, int depth)
        {
            if (depth > 16) return;
            var count = GetMenuItemCount(current);
            for (var i = 0; i < count; i++)
            {
                var child = GetSubMenu(current, i);
                if (child != IntPtr.Zero) Visit(child, depth + 1);
                var id = GetMenuItemID(current, i);
                if (!(background && id == BackgroundPasteCommand) && (id < FirstCommand || id > LastCommand || id - FirstCommand >= commandCount)) continue;
                var state = GetMenuState(current, (uint)i, 0x400); // MF_BYPOSITION
                commands.Add(new(id, Verb(id), (state & 3) == 0));
            }
        }
        Visit(menu, 0);
        return commands;
    }

    internal string Verb(uint command)
    {
        CheckThread();
        if (background && command == BackgroundPasteCommand) return "dext.paste";
        if (command < FirstCommand || command > LastCommand || command - FirstCommand >= commandCount) return string.Empty;
        var buffer = Marshal.AllocCoTaskMem(1024);
        try
        {
            for (var i = 0; i < 1024; i++) Marshal.WriteByte(buffer, i, 0);
            var hr = handler!.GetCommandString((UIntPtr)(command - FirstCommand), 4, IntPtr.Zero, buffer, 512); // GCS_VERBW
            Marshal.WriteInt16(buffer, 1022, 0);
            return hr >= 0 ? Marshal.PtrToStringUni(buffer) ?? string.Empty : string.Empty;
        }
        finally { Marshal.FreeCoTaskMem(buffer); }
    }

    // The caller supplies an owner on this STA and forwards its menu messages to
    // HandleMessage. Scope retirement ends the modal popup, even without input.
    internal uint Track(IntPtr owner, int screenX, int screenY, Func<bool> permitted)
    {
        CheckThread();
        if (!IsWindow(owner) || GetWindowThreadProcessId(owner, out _) != GetCurrentThreadId())
            throw new ArgumentException("Menu owner must belong to this thread.", nameof(owner));
        if (!permitted()) throw new OperationCanceledException("Desktop menu scope retired.");
        var retired = false;
        Exception? callbackError = null;
        TimerCallback timerCallback = (_, _, _, _) =>
        {
            try { if (!permitted()) { retired = true; EndMenu(); } }
            catch (Exception error) { callbackError = error; retired = true; EndMenu(); }
        };
        var timer = SetTimer(IntPtr.Zero, UIntPtr.Zero, 50, timerCallback);
        if (timer == UIntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error());
        try
        {
            var command = TrackPopupMenuEx(menu, 0x182, screenX, screenY, owner, IntPtr.Zero);
            if (callbackError is not null) throw new InvalidOperationException("Desktop menu scope check failed.", callbackError);
            if (retired || !permitted()) throw new OperationCanceledException("Desktop menu scope retired.");
            return command; // Zero is user cancellation; never dispatch it.
        }
        finally { KillTimer(IntPtr.Zero, timer); GC.KeepAlive(timerCallback); }
    }

    // Common file commands return to the existing Dext operations with their
    // already captured selection. In particular Shell delete must not bypass
    // recycle-only policy, and Shell rename expects an Explorer view we lack.
    internal string Dispatch(uint command, IntPtr owner, int x, int y, Func<bool> permitted)
    {
        CheckThread();
        if (!permitted()) throw new OperationCanceledException("Desktop menu scope retired.");
        var selected = Commands().FirstOrDefault(item => item.Id == command && item.Enabled);
        if (selected is null) throw new ArgumentOutOfRangeException(nameof(command), "Command is absent or disabled.");
        var verb = selected.Verb.ToLowerInvariant();
        if (background && verb == "dext.paste") return verb;
        if (!background && verb is ("delete" or "rename" or "cut" or "copy")) return verb;
        if (!IsWindow(owner)) throw new ArgumentException("A live native owner is required.", nameof(owner));
        var offset = (IntPtr)(command - FirstCommand);
        var info = new InvokeInfo
        {
            Size = (uint)Marshal.SizeOf<InvokeInfo>(), Mask = 0x00004000 | 0x20000000 | 0x00000100,
            Owner = owner, Verb = offset, VerbUnicode = offset, Show = 1, X = x, Y = y
        }; // UNICODE | PTINVOKE | NOASYNC. No SHIFT_DOWN / extended deletion.
        var pointer = Marshal.AllocCoTaskMem(Marshal.SizeOf<InvokeInfo>());
        try
        {
            Marshal.StructureToPtr(info, pointer, false);
            if (!permitted()) throw new OperationCanceledException("Desktop menu scope retired.");
            Marshal.ThrowExceptionForHR(handler!.InvokeCommand(pointer));
            return "invoked";
        }
        finally { Marshal.FreeCoTaskMem(pointer); }
    }

    internal bool HandleMessage(uint message, UIntPtr wParam, IntPtr lParam, out IntPtr result)
    {
        CheckThread(); result = IntPtr.Zero;
        if (message is not (0x117 or 0x2b or 0x2c or 0x120)) return false;
        if (handler is IDesktopContextMenu3 third)
        {
            var hr = third.HandleMenuMsg2(message, wParam, lParam, out result);
            if (hr == 0) return true;
        }
        if (message != 0x120 && handler is IDesktopContextMenu2 second && second.HandleMenuMsg(message, wParam, lParam) == 0)
        {
            result = message is 0x2b or 0x2c ? new IntPtr(1) : IntPtr.Zero;
            return true;
        }
        return false;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct InvokeInfo
    {
        internal uint Size, Mask;
        internal IntPtr Owner, Verb, Parameters, Directory;
        internal int Show;
        internal uint HotKey;
        internal IntPtr Icon, Title, VerbUnicode, ParametersUnicode, DirectoryUnicode, TitleUnicode;
        internal int X, Y;
    }
    private delegate void TimerCallback(IntPtr window, uint message, UIntPtr timer, uint time);
    [DllImport("user32.dll")] private static extern uint TrackPopupMenuEx(IntPtr menu, uint flags, int x, int y, IntPtr owner, IntPtr parameters);
    [DllImport("user32.dll")] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool EndMenu();
    [DllImport("user32.dll", SetLastError = true)] private static extern UIntPtr SetTimer(IntPtr window, UIntPtr timer, uint interval, TimerCallback callback);
    [DllImport("user32.dll")] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool KillTimer(IntPtr window, UIntPtr timer);
    [DllImport("user32.dll")] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool IsWindow(IntPtr window);
    [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr window, out uint process);
    [DllImport("kernel32.dll")] private static extern uint GetCurrentThreadId();

    private void CheckThread()
    {
        if (thread != Environment.CurrentManagedThreadId) throw new InvalidOperationException("Shell menu used from another thread.");
        ObjectDisposedException.ThrowIf(handler is null, this);
    }
    public void Dispose()
    {
        if (thread != Environment.CurrentManagedThreadId) throw new InvalidOperationException("Shell menu disposed from another thread.");
        if (menu != IntPtr.Zero) { DestroyMenu(menu); menu = IntPtr.Zero; }
        if (handler is not null) { Marshal.ReleaseComObject(handler); handler = null; }
        foreach (var pidl in pidls) Marshal.FreeCoTaskMem(pidl);
        pidls.Clear();
        if (children != IntPtr.Zero) { Marshal.FreeCoTaskMem(children); children = IntPtr.Zero; }
        if (folder != IntPtr.Zero) { Marshal.FreeCoTaskMem(folder); folder = IntPtr.Zero; }
        if (desktop != IntPtr.Zero) { Marshal.Release(desktop); desktop = IntPtr.Zero; }
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct DefaultMenu
    {
        internal IntPtr Owner, Callback, Folder, ShellFolder;
        internal uint Count;
        internal IntPtr Children, Associations;
        internal uint KeyCount;
        internal IntPtr Keys;
    }
    [DllImport("shell32.dll")] private static extern int SHGetDesktopFolder(out IntPtr folder);
    [DllImport("shell32.dll", CharSet = CharSet.Unicode)] private static extern int SHParseDisplayName(string name, IntPtr context, out IntPtr pidl, uint attributes, out uint actualAttributes);
    [DllImport("shell32.dll")] private static extern int SHCreateDefaultContextMenu(ref DefaultMenu definition, ref Guid iid, [MarshalAs(UnmanagedType.Interface)] out IDesktopContextMenu menu);
    [DllImport("user32.dll", SetLastError = true)] private static extern IntPtr CreatePopupMenu();
    [DllImport("user32.dll")] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool DestroyMenu(IntPtr menu);
    [DllImport("user32.dll")] private static extern int GetMenuItemCount(IntPtr menu);
    [DllImport("user32.dll")] private static extern uint GetMenuItemID(IntPtr menu, int position);
    [DllImport("user32.dll")] private static extern IntPtr GetSubMenu(IntPtr menu, int position);
    [DllImport("user32.dll")] private static extern uint GetMenuState(IntPtr menu, uint id, uint flags);
}

internal sealed record DesktopShellMenuCommand(uint Id, string Verb, bool Enabled);

[ComImport, Guid("000214e4-0000-0000-c000-000000000046"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IDesktopContextMenu
{
    [PreserveSig] int QueryContextMenu(IntPtr menu, uint position, uint first, uint last, uint flags);
    [PreserveSig] int InvokeCommand(IntPtr info);
    [PreserveSig] int GetCommandString(UIntPtr command, uint flags, IntPtr reserved, IntPtr name, uint count);
}


// Redeclare the inherited slots explicitly: COM interface inheritance does not
// automatically provide the required vtable order for these interop contracts.
[ComImport, Guid("000214f4-0000-0000-c000-000000000046"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IDesktopContextMenu2
{
    [PreserveSig] int QueryContextMenu(IntPtr menu, uint position, uint first, uint last, uint flags);
    [PreserveSig] int InvokeCommand(IntPtr info);
    [PreserveSig] int GetCommandString(UIntPtr command, uint flags, IntPtr reserved, IntPtr name, uint count);
    [PreserveSig] int HandleMenuMsg(uint message, UIntPtr wParam, IntPtr lParam);
}
[ComImport, Guid("bcfce0a0-ec17-11d0-8d10-00a0c90f2719"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IDesktopContextMenu3
{
    [PreserveSig] int QueryContextMenu(IntPtr menu, uint position, uint first, uint last, uint flags);
    [PreserveSig] int InvokeCommand(IntPtr info);
    [PreserveSig] int GetCommandString(UIntPtr command, uint flags, IntPtr reserved, IntPtr name, uint count);
    [PreserveSig] int HandleMenuMsg(uint message, UIntPtr wParam, IntPtr lParam);
    [PreserveSig] int HandleMenuMsg2(uint message, UIntPtr wParam, IntPtr lParam, out IntPtr result);
}
