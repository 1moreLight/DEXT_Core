using System;
using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading;
namespace Lively.Services.DesktopSync;

// No window, focus changes, mouse hook, file access or IPC on this message thread.
internal sealed class DesktopFileKeyboardHook : IDisposable
{
    private readonly DesktopFileKeyboardOwnership ownership=new();
    private readonly Func<DesktopFileKeyboardOffer,DesktopFileKeyEdge,bool> enqueue;
    private readonly Action<Exception> report;
    private readonly HookProc callback;
    private readonly Thread thread;
    private DesktopFileKeyboardOffer? offer;
    private IntPtr hook;
    private uint threadId;
    private int stopped;
    private volatile bool active;
    internal bool Active=>active;
    internal DesktopFileKeyboardHook(Func<DesktopFileKeyboardOffer,DesktopFileKeyEdge,bool> enqueue,Action<Exception> report)
    {
        this.enqueue=enqueue;this.report=report;callback=OnKey;
        thread=new Thread(Run){IsBackground=true,Name="Dext desktop file keys"};thread.Start();
    }
    internal void Publish(DesktopFileKeyboardOffer? next)=>Volatile.Write(ref offer,next);
    private void Run()
    {
        try{
            PeekMessage(out _,IntPtr.Zero,0,0,0);threadId=GetCurrentThreadId();
            if(Volatile.Read(ref stopped)!=0)return;
            hook=SetWindowsHookEx(13,callback,GetModuleHandle(null),0);
            if(hook==IntPtr.Zero)throw new Win32Exception(Marshal.GetLastWin32Error());
            foreach(var key in new[]{13,32,46,67,88,86,114,93,121})if(Held(key))ownership.IgnoreHeld(key);
            active=true;
            while(Volatile.Read(ref stopped)==0){
                var result=GetMessage(out var message,IntPtr.Zero,0,0);
                if(result==0)break;if(result<0)throw new Win32Exception(Marshal.GetLastWin32Error());
                TranslateMessage(ref message);DispatchMessage(ref message);
            }
        }catch(Exception error){report(error);}
        finally{active=false;Publish(null);if(hook!=IntPtr.Zero){UnhookWindowsHookEx(hook);hook=IntPtr.Zero;}}
    }
    private IntPtr OnKey(int code,IntPtr message,IntPtr data)
    {
        if(code==0&&Volatile.Read(ref stopped)==0){
            try{
                var input=Marshal.PtrToStructure<Keyboard>(data);var key=(int)input.Key;
                var kind=message.ToInt64();
                if(DesktopFileKeyboardOwnership.IsCommandKey(key)&&kind is 0x100 or 0x101 or 0x104 or 0x105){
                    // Only command keys reach here; modifier keys have already updated
                    // their asynchronous states before this different key's callback.
                    var modifiers=(Held(0x11)?1:0)|(Held(0x10)?2:0)|(Held(0x12)?4:0)|((Held(0x5b)||Held(0x5c))?8:0);
                    var current=Volatile.Read(ref offer);if(!GetCursorPos(out var point))point=new Point{X=int.MinValue,Y=int.MinValue};
                    var edge=new DesktopFileKeyEdge(key,kind is 0x100 or 0x104,modifiers,(int)input.Scan,(input.Flags&1)!=0);
                    if(ownership.Process(edge,(input.Flags&0x12)!=0,Stopwatch.GetTimestamp(),GetForegroundWindow(),point.X,point.Y,current,enqueue))return (IntPtr)1;
                }
            }catch(Exception error){ThreadPool.QueueUserWorkItem(_=>report(error));}
        }
        return CallNextHookEx(hook,code,message,data);
    }
    private static bool Held(int key)=>(GetAsyncKeyState(key)&0x8000)!=0;
    public void Dispose()
    {
        if(Interlocked.Exchange(ref stopped,1)!=0)return;
        Publish(null);var id=threadId;if(id!=0)PostThreadMessage(id,0x12,IntPtr.Zero,IntPtr.Zero);
        if(Thread.CurrentThread!=thread)thread.Join(500);
    }
    private delegate IntPtr HookProc(int code,IntPtr message,IntPtr data);
    [StructLayout(LayoutKind.Sequential)] private struct Point{internal int X,Y;}
    [StructLayout(LayoutKind.Sequential)] private struct Keyboard{internal uint Key,Scan,Flags,Time;internal UIntPtr Extra;}
    [StructLayout(LayoutKind.Sequential)] private struct Message{internal IntPtr Window;internal uint Id;internal UIntPtr WParam;internal IntPtr LParam;internal uint Time;internal Point Position;internal uint Private;}
    [DllImport("user32.dll",SetLastError=true)] private static extern IntPtr SetWindowsHookEx(int id,HookProc callback,IntPtr module,uint thread);
    [DllImport("user32.dll")] private static extern bool UnhookWindowsHookEx(IntPtr hook);
    [DllImport("user32.dll")] private static extern IntPtr CallNextHookEx(IntPtr hook,int code,IntPtr message,IntPtr data);
    [DllImport("user32.dll")] private static extern short GetAsyncKeyState(int key);
    [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] private static extern bool GetCursorPos(out Point point);
    [DllImport("user32.dll")] private static extern bool PeekMessage(out Message message,IntPtr window,uint first,uint last,uint remove);
    [DllImport("user32.dll",SetLastError=true)] private static extern int GetMessage(out Message message,IntPtr window,uint first,uint last);
    [DllImport("user32.dll")] private static extern bool TranslateMessage(ref Message message);
    [DllImport("user32.dll")] private static extern IntPtr DispatchMessage(ref Message message);
    [DllImport("user32.dll")] private static extern bool PostThreadMessage(uint thread,uint message,IntPtr wparam,IntPtr lparam);
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode)] private static extern IntPtr GetModuleHandle(string? name);
    [DllImport("kernel32.dll")] private static extern uint GetCurrentThreadId();
}
