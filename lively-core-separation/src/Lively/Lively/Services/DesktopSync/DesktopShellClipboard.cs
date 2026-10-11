using System;
using System.ComponentModel;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace Lively.Services.DesktopSync;

// Called only by native file commands. Clipboard ownership and sequence checks
// stay within one OpenClipboard/CloseClipboard transaction on a dedicated STA.
internal static class DesktopShellClipboard
{
    private const uint FileDrop=15;
    internal static uint CurrentSequence => GetClipboardSequenceNumber();
    internal static Task<DesktopClipboardSnapshot?> ReadAsync(CancellationToken cancellation=default)
        => Run(() => WithClipboard(IntPtr.Zero,()=>
        {
            var handle=GetClipboardData(FileDrop);
            if(handle==IntPtr.Zero)return null;
            var count=DragQueryFile(handle,uint.MaxValue,null,0);
            if(count is 0 or >256)throw new InvalidDataException("Unsupported clipboard file count.");
            var files=new string[count];
            for(uint i=0;i<count;i++)
            {
                var length=DragQueryFile(handle,i,null,0);
                if(length is 0 or >32767)throw new InvalidDataException("Invalid clipboard path.");
                var text=new StringBuilder((int)length+1);
                if(DragQueryFile(handle,i,text,(uint)text.Capacity)!=length)throw new InvalidDataException("Clipboard path changed.");
                var path=text.ToString();
                if(!Path.IsPathFullyQualified(path))throw new InvalidDataException("Clipboard path is not absolute.");
                files[i]=Path.GetFullPath(path);
            }
            var preferred=GetClipboardData(EffectFormat());byte[]? bytes=null;
            if(preferred!=IntPtr.Zero)
            {
                if(GlobalSize(preferred)<4)throw new InvalidDataException("Invalid clipboard effect.");
                var pointer=GlobalLock(preferred);
                if(pointer==IntPtr.Zero)throw new Win32Exception(Marshal.GetLastWin32Error());
                try{bytes=new byte[4];Marshal.Copy(pointer,bytes,0,4);}finally{GlobalUnlock(preferred);}
            }
            return new DesktopClipboardSnapshot(GetClipboardSequenceNumber(),Array.AsReadOnly(files),DesktopShellClipboardData.DecodeEffect(bytes));
        },cancellation),cancellation);

    internal static Task<DesktopClipboardSnapshot> PublishAsync(string[] paths,bool cut,
        CancellationToken cancellation=default,Func<bool>? permitted=null)
    {
        _=DesktopShellClipboardData.EncodeFiles(paths); // Validate before resolving relative names.
        var files=paths.Select(Path.GetFullPath).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        var encoded=DesktopShellClipboardData.EncodeFiles(files);
        return Run(()=>WithOwner(owner=>WithClipboard(owner,()=>
        {
            cancellation.ThrowIfCancellationRequested();
            if(permitted?.Invoke()==false)throw new OperationCanceledException(cancellation);
            var sequence=WriteLocked(encoded,cut);
            return new DesktopClipboardSnapshot(sequence,Array.AsReadOnly(files),cut?DesktopDropEffect.Move:DesktopDropEffect.Copy);
        },cancellation)),cancellation);
    }

    internal static Task<bool> CompleteMoveAsync(DesktopClipboardSnapshot original,DesktopTransferResult result,
        CancellationToken cancellation=default)
    {
        var remaining=DesktopShellClipboardData.RemainingAfterMove(original,result);
        if(original.Sequence==0||original.Effect!=DesktopDropEffect.Move||remaining.Length==original.Files.Count)return Task.FromResult(false);
        var encoded=remaining.Length==0?null:DesktopShellClipboardData.EncodeFiles(remaining);
        return Run(()=>WithOwner(owner=>WithClipboard(owner,()=>
        {
            // A later user copy wins, including while Shell was showing a dialog.
            if(GetClipboardSequenceNumber()!=original.Sequence)return false;
            cancellation.ThrowIfCancellationRequested();
            WriteLocked(encoded,true);return true;
        },cancellation)),cancellation);
    }

    private static uint WriteLocked(byte[]? files,bool cut)
    {
        var format=EffectFormat();
        using var drop=files is null?null:new GlobalBuffer(files);
        using var effect=files is null?null:new GlobalBuffer(DesktopShellClipboardData.EncodeEffect(cut));
        if(!EmptyClipboard())throw new Win32Exception(Marshal.GetLastWin32Error());
        if(drop is not null){drop.Publish(FileDrop);effect!.Publish(format);}
        return GetClipboardSequenceNumber();
    }
    private static uint EffectFormat()
    {
        var format=RegisterClipboardFormat("Preferred DropEffect");
        if(format==0)throw new Win32Exception(Marshal.GetLastWin32Error());
        return format;
    }
    private static T WithClipboard<T>(IntPtr owner,Func<T> action,CancellationToken token)
    {
        for(var attempt=0;;attempt++)
        {
            token.ThrowIfCancellationRequested();
            if(OpenClipboard(owner))break;
            if(attempt==4)throw new Win32Exception(Marshal.GetLastWin32Error(),"Clipboard is busy.");
            if(token.WaitHandle.WaitOne(20))token.ThrowIfCancellationRequested();
        }
        try{return action();}finally{CloseClipboard();}
    }
    private static T WithOwner<T>(Func<IntPtr,T> action)
    {
        // A real owner is required: EmptyClipboard after OpenClipboard(NULL)
        // makes SetClipboardData fail. This message-only window is never shown.
        var owner=CreateWindowEx(0,"STATIC","Dext clipboard",0,0,0,0,0,new IntPtr(-3),IntPtr.Zero,IntPtr.Zero,IntPtr.Zero);
        if(owner==IntPtr.Zero)throw new Win32Exception(Marshal.GetLastWin32Error());
        try{return action(owner);}finally{DestroyWindow(owner);}
    }
    private static Task<T> Run<T>(Func<T> action,CancellationToken token)
    {
        var completion=new TaskCompletionSource<T>(TaskCreationOptions.RunContinuationsAsynchronously);
        var thread=new Thread(()=>
        {
            try{token.ThrowIfCancellationRequested();completion.TrySetResult(action());}
            catch(OperationCanceledException){completion.TrySetCanceled(token);}
            catch(Exception error){completion.TrySetException(error);}
        }){IsBackground=true,Name="Dext file clipboard"};
        thread.SetApartmentState(ApartmentState.STA);thread.Start();return completion.Task;
    }
    private sealed class GlobalBuffer:IDisposable
    {
        private IntPtr handle;
        internal GlobalBuffer(byte[] bytes)
        {
            handle=GlobalAlloc(0x42,(nuint)bytes.Length);
            if(handle==IntPtr.Zero)throw new OutOfMemoryException();
            var pointer=GlobalLock(handle);
            if(pointer==IntPtr.Zero){Dispose();throw new Win32Exception(Marshal.GetLastWin32Error());}
            try{Marshal.Copy(bytes,0,pointer,bytes.Length);}
            catch{GlobalUnlock(handle);Dispose();throw;}
            GlobalUnlock(handle);
        }
        internal void Publish(uint format)
        {
            if(SetClipboardData(format,handle)==IntPtr.Zero)throw new Win32Exception(Marshal.GetLastWin32Error());
            handle=IntPtr.Zero; // Windows owns the immediate-rendered memory now.
        }
        public void Dispose(){if(handle!=IntPtr.Zero){GlobalFree(handle);handle=IntPtr.Zero;}}
    }
    [DllImport("user32.dll",SetLastError=true)] private static extern bool OpenClipboard(IntPtr owner);
    [DllImport("user32.dll",SetLastError=true)] private static extern bool CloseClipboard();
    [DllImport("user32.dll",SetLastError=true)] private static extern bool EmptyClipboard();
    [DllImport("user32.dll",SetLastError=true)] private static extern IntPtr GetClipboardData(uint format);
    [DllImport("user32.dll",SetLastError=true)] private static extern IntPtr SetClipboardData(uint format,IntPtr memory);
    [DllImport("user32.dll")] private static extern uint GetClipboardSequenceNumber();
    [DllImport("user32.dll",CharSet=CharSet.Unicode,SetLastError=true)] private static extern uint RegisterClipboardFormat(string name);
    [DllImport("user32.dll",CharSet=CharSet.Unicode,SetLastError=true)] private static extern IntPtr CreateWindowEx(uint style,string className,string title,uint windowStyle,int x,int y,int width,int height,IntPtr parent,IntPtr menu,IntPtr instance,IntPtr parameter);
    [DllImport("user32.dll")] private static extern bool DestroyWindow(IntPtr window);
    [DllImport("kernel32.dll",SetLastError=true)] private static extern IntPtr GlobalAlloc(uint flags,nuint bytes);
    [DllImport("kernel32.dll",SetLastError=true)] private static extern IntPtr GlobalLock(IntPtr memory);
    [DllImport("kernel32.dll")] private static extern bool GlobalUnlock(IntPtr memory);
    [DllImport("kernel32.dll")] private static extern IntPtr GlobalFree(IntPtr memory);
    [DllImport("kernel32.dll")] private static extern nuint GlobalSize(IntPtr memory);
    [DllImport("shell32.dll",CharSet=CharSet.Unicode)] private static extern uint DragQueryFile(IntPtr memory,uint index,StringBuilder? text,uint length);
}
