using System;
using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading;
namespace Lively.Services.DesktopSync;

// Dedicated message loop: no Shell, IPC, UI waits, file reads or focus changes
// in the hook callback. enqueue must only post a bounded asynchronous delivery.
internal sealed class DesktopFileContextHook : IDisposable
{
    private readonly DesktopFileContextOwnership ownership=new(Stopwatch.Frequency);
    private readonly Func<DesktopFileContextOffer,DesktopFileContextEdge,bool> enqueue;
    private readonly Action<Exception> report;
    private readonly HookProc callback;
    private readonly Thread thread;
    private DesktopFileContextOffer? offer;
    private IntPtr hook;
    private uint threadId;
    private int stopped;
    private volatile bool active;
    internal bool Active=>active;
    internal DesktopFileContextHook(Func<DesktopFileContextOffer,DesktopFileContextEdge,bool> enqueue,Action<Exception> report)
    {
        this.enqueue=enqueue;this.report=report;callback=OnMouse;
        thread=new Thread(Run){IsBackground=true,Name="Dext desktop file context input"};thread.Start();
    }
    internal void Publish(DesktopFileContextOffer? next)=>Volatile.Write(ref offer,next);
    private void Run()
    {
        try{
            PeekMessage(out _,IntPtr.Zero,0,0,0);threadId=GetCurrentThreadId();
            if(Volatile.Read(ref stopped)!=0)return;
            hook=SetWindowsHookEx(14,callback,GetModuleHandle(null),0);
            if(hook==IntPtr.Zero)throw new Win32Exception(Marshal.GetLastWin32Error());
            if((GetAsyncKeyState(0x02)&0x8000)!=0)ownership.IgnoreHeld();
            active=true;
            while(Volatile.Read(ref stopped)==0){
                var result=GetMessage(out var message,IntPtr.Zero,0,0);
                if(result==0)break;if(result<0)throw new Win32Exception(Marshal.GetLastWin32Error());
                TranslateMessage(ref message);DispatchMessage(ref message);
            }
        }catch(Exception error){report(error);}
        finally{active=false;Publish(null);if(hook!=IntPtr.Zero){UnhookWindowsHookEx(hook);hook=IntPtr.Zero;}}
    }
    private IntPtr OnMouse(int code,IntPtr message,IntPtr data)
    {
        if(code==0&&Volatile.Read(ref stopped)==0){
            var kind=message.ToInt64();
            if(kind is 0x204 or 0x205 || ownership.IsTracking&&kind is 0x200 or 0x201 or 0x207 or 0x20b){
                try{
                    var input=Marshal.PtrToStructure<Mouse>(data);
                    var synthetic=(input.Flags&3)!=0||(input.Extra.ToUInt64()&0xffffff00UL)==0xff515700UL;
                    var current=Volatile.Read(ref offer);
                    var root=synthetic?IntPtr.Zero:GetAncestor(WindowFromPoint(input.Position),2);
                    var chord=kind==0x204&&((GetAsyncKeyState(1)&0x8000)!=0||(GetAsyncKeyState(4)&0x8000)!=0||
                        (GetAsyncKeyState(5)&0x8000)!=0||(GetAsyncKeyState(6)&0x8000)!=0);
                    if(ownership.Process((int)kind,input.Position.X,input.Position.Y,Stopwatch.GetTimestamp(),root,synthetic,current,enqueue,chord))return (IntPtr)1;
                }catch(Exception error){ThreadPool.QueueUserWorkItem(_=>report(error));}
            }
        }
        return CallNextHookEx(hook,code,message,data);
    }
    public void Dispose()
    {
        if(Interlocked.Exchange(ref stopped,1)!=0)return;
        Publish(null);var id=threadId;if(id!=0)PostThreadMessage(id,0x12,IntPtr.Zero,IntPtr.Zero);
        if(Thread.CurrentThread!=thread)thread.Join(500);
    }
    private delegate IntPtr HookProc(int code,IntPtr message,IntPtr data);
    [StructLayout(LayoutKind.Sequential)] private struct Point{internal int X,Y;}
    [StructLayout(LayoutKind.Sequential)] private struct Mouse{internal Point Position;internal uint Data,Flags,Time;internal UIntPtr Extra;}
    [StructLayout(LayoutKind.Sequential)] private struct Message{internal IntPtr Window;internal uint Id;internal UIntPtr WParam;internal IntPtr LParam;internal uint Time;internal Point Position;internal uint Private;}
    [DllImport("user32.dll",SetLastError=true)] private static extern IntPtr SetWindowsHookEx(int id,HookProc callback,IntPtr module,uint thread);
    [DllImport("user32.dll")] private static extern bool UnhookWindowsHookEx(IntPtr hook);
    [DllImport("user32.dll")] private static extern IntPtr CallNextHookEx(IntPtr hook,int code,IntPtr message,IntPtr data);
    [DllImport("user32.dll")] private static extern short GetAsyncKeyState(int key);
    [DllImport("user32.dll")] private static extern IntPtr WindowFromPoint(Point point);
    [DllImport("user32.dll")] private static extern IntPtr GetAncestor(IntPtr window,uint flags);
    [DllImport("user32.dll")] private static extern bool PeekMessage(out Message message,IntPtr window,uint first,uint last,uint remove);
    [DllImport("user32.dll",SetLastError=true)] private static extern int GetMessage(out Message message,IntPtr window,uint first,uint last);
    [DllImport("user32.dll")] private static extern bool TranslateMessage(ref Message message);
    [DllImport("user32.dll")] private static extern IntPtr DispatchMessage(ref Message message);
    [DllImport("user32.dll")] private static extern bool PostThreadMessage(uint thread,uint message,IntPtr wparam,IntPtr lparam);
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode)] private static extern IntPtr GetModuleHandle(string? name);
    [DllImport("kernel32.dll")] private static extern uint GetCurrentThreadId();
}
