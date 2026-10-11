using Lively.Common.Helpers.Pinvoke;
using Lively.Core.Wallpapers;
using Lively.Models.Enums;
using Lively.Services.DesktopSync;
using System;
using System.Diagnostics;
using System.Linq;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows;
using System.Windows.Threading;
namespace Lively.Core;

public partial class WinDesktopCore
{
    private DesktopFileContextHook desktopFileContext;
    private int desktopContextQueue;
    private void StartDesktopContext()
    {
        desktopFileContext=new DesktopFileContextHook((offer,edge)=>{
            var dispatcher=Application.Current?.Dispatcher;
            if(disposedValue||dispatcher is null||dispatcher.HasShutdownStarted||edge.Down&&Volatile.Read(ref desktopContextQueue)>=32)return false;
            Interlocked.Increment(ref desktopContextQueue);
            try{
                dispatcher.BeginInvoke(DispatcherPriority.Input,new Action(()=>{
                    try{if(!disposedValue)offer.Deliver(edge);}
                    catch(Exception error){Logger.Error(error,"Desktop context delivery failed");}
                    finally{Interlocked.Decrement(ref desktopContextQueue);}
                }));return true;
            }catch{Interlocked.Decrement(ref desktopContextQueue);return false;}
        },error=>Logger.Error(error,"Desktop context mouse hook unavailable"));
    }
    private bool ContextPointIsDesktop(int x,int y)
    {
        if(disposedValue||screenSaver.IsRunning||userSettings.Settings.InputForward==InputForwardMode.off)return false;
        var root=ContextRootAt(new NativeMethods.POINT{X=x,Y=y});
        return root!=IntPtr.Zero&&(root==progman||root==original_WorkerW||root==workerW);
    }
    private void RefreshDesktopContextOffer()
    {
        if(disposedValue||desktopFileContext is null)return;
        DesktopFileContextOffer offer=null;
        try{
            if(desktopFileContext.Active&&!screenSaver.IsRunning&&userSettings.Settings.InputForward!=InputForwardMode.off&&NativeMethods.GetCursorPos(out var point)){
                var roots=new[]{progman,original_WorkerW,workerW}.Where(value=>value!=IntPtr.Zero).Distinct().ToArray();
                var expires=Stopwatch.GetTimestamp()+Stopwatch.Frequency/2;
                foreach(var player in Wallpapers.OfType<WebWebView2>()){
                    player.NativeContextIsDesktop=ContextPointIsDesktop;
                    var candidate=player.CaptureDesktopContextOffer(roots,expires);
                    // Publish while another app is foreground too; the hook checks
                    // the actual window at DOWN so covered desktop never captures.
                    if(candidate is not null&&point.X>=candidate.X&&point.Y>=candidate.Y&&
                        (long)point.X<(long)candidate.X+candidate.Width&&(long)point.Y<(long)candidate.Y+candidate.Height){offer=candidate;break;}
                }
            }
        }catch(Exception error){Logger.Debug(error,"Desktop context offer unavailable");}
        desktopFileContext.Publish(offer);
    }
    private void StopDesktopContext()
    {
        desktopFileContext?.Dispose();desktopFileContext=null;
        foreach(var player in Wallpapers.OfType<WebWebView2>())player.NativeContextIsDesktop=null;
    }
    private static IntPtr ContextRootAt(NativeMethods.POINT point)=>ContextGetAncestor(ContextWindowFromPoint(point),2);
    [DllImport("user32.dll",EntryPoint="WindowFromPoint")] private static extern IntPtr ContextWindowFromPoint(NativeMethods.POINT point);
    [DllImport("user32.dll",EntryPoint="GetAncestor")] private static extern IntPtr ContextGetAncestor(IntPtr window,uint flags);
}
