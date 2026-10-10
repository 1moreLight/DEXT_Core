using System;
using System.Runtime.InteropServices;

namespace Lively.Services.DesktopSync;

// COM order/signatures follow Windows SDK shobjidl_core.h.
[ComImport, Guid("43826d1e-e718-42ee-bc55-a1e261c37bfe"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IDesktopShellItem
{
    void BindToHandler(IntPtr context, ref Guid handler, ref Guid iid, out IntPtr result);
    void GetParent(out IDesktopShellItem parent);
    void GetDisplayName(uint kind, out IntPtr name);
    void GetAttributes(uint mask, out uint attributes);
    void Compare(IDesktopShellItem other, uint hint, out int order);
}
[ComImport, Guid("947AAB5F-0A5C-4C13-B4D6-4BF7836FC9F8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IDesktopFileOperation
{
    void Advise(IDesktopTransferProgress sink, out uint cookie);
    void Unadvise(uint cookie);
    void SetOperationFlags(uint flags);
    void SetProgressMessage([MarshalAs(UnmanagedType.LPWStr)] string text);
    void SetProgressDialog([MarshalAs(UnmanagedType.Interface)] object dialog);
    void SetProperties([MarshalAs(UnmanagedType.Interface)] object properties);
    void SetOwnerWindow(IntPtr owner);
    void ApplyPropertiesToItem(IDesktopShellItem item);
    void ApplyPropertiesToItems([MarshalAs(UnmanagedType.Interface)] object items);
    void RenameItem(IDesktopShellItem item, [MarshalAs(UnmanagedType.LPWStr)] string name, IDesktopTransferProgress sink);
    void RenameItems([MarshalAs(UnmanagedType.Interface)] object items, [MarshalAs(UnmanagedType.LPWStr)] string name);
    void MoveItem(IDesktopShellItem item, IDesktopShellItem destination, [MarshalAs(UnmanagedType.LPWStr)] string? name, IDesktopTransferProgress sink);
    void MoveItems([MarshalAs(UnmanagedType.Interface)] object items, IDesktopShellItem destination);
    void CopyItem(IDesktopShellItem item, IDesktopShellItem destination, [MarshalAs(UnmanagedType.LPWStr)] string? name, IDesktopTransferProgress sink);
    void CopyItems([MarshalAs(UnmanagedType.Interface)] object items, IDesktopShellItem destination);
    void DeleteItem(IDesktopShellItem item, IDesktopTransferProgress sink);
    void DeleteItems([MarshalAs(UnmanagedType.Interface)] object items);
    void NewItem(IDesktopShellItem destination, uint attributes, [MarshalAs(UnmanagedType.LPWStr)] string name, [MarshalAs(UnmanagedType.LPWStr)] string template, IDesktopTransferProgress sink);
    [PreserveSig] int PerformOperations();
    void GetAnyOperationsAborted([MarshalAs(UnmanagedType.Bool)] out bool aborted);
}
[ComVisible(true), Guid("04b0f1a7-9490-44bc-96e1-4296a31252e2"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IDesktopTransferProgress
{
    [PreserveSig] int StartOperations();
    [PreserveSig] int FinishOperations(int result);
    [PreserveSig] int PreRenameItem(uint flags, IDesktopShellItem item, [MarshalAs(UnmanagedType.LPWStr)] string name);
    [PreserveSig] int PostRenameItem(uint flags, IDesktopShellItem item, [MarshalAs(UnmanagedType.LPWStr)] string name, int result, IDesktopShellItem? created);
    [PreserveSig] int PreMoveItem(uint flags, IDesktopShellItem item, IDesktopShellItem destination, [MarshalAs(UnmanagedType.LPWStr)] string name);
    [PreserveSig] int PostMoveItem(uint flags, IDesktopShellItem item, IDesktopShellItem destination, [MarshalAs(UnmanagedType.LPWStr)] string name, int result, IDesktopShellItem? created);
    [PreserveSig] int PreCopyItem(uint flags, IDesktopShellItem item, IDesktopShellItem destination, [MarshalAs(UnmanagedType.LPWStr)] string name);
    [PreserveSig] int PostCopyItem(uint flags, IDesktopShellItem item, IDesktopShellItem destination, [MarshalAs(UnmanagedType.LPWStr)] string name, int result, IDesktopShellItem? created);
    [PreserveSig] int PreDeleteItem(uint flags, IDesktopShellItem item);
    [PreserveSig] int PostDeleteItem(uint flags, IDesktopShellItem item, int result, IDesktopShellItem? created);
    [PreserveSig] int PreNewItem(uint flags, IDesktopShellItem destination, [MarshalAs(UnmanagedType.LPWStr)] string name);
    [PreserveSig] int PostNewItem(uint flags, IDesktopShellItem destination, [MarshalAs(UnmanagedType.LPWStr)] string name, [MarshalAs(UnmanagedType.LPWStr)] string template, uint attributes, int result, IDesktopShellItem? created);
    [PreserveSig] int UpdateProgress(uint total, uint completed);
    [PreserveSig] int ResetTimer();
    [PreserveSig] int PauseTimer();
    [PreserveSig] int ResumeTimer();
}