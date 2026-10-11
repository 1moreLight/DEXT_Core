using Lively.Common.Helpers.Pinvoke;
using Lively.Core.Wallpapers;
using Lively.Models.Enums;
using Lively.Services.DesktopSync;
using System;
using System.Diagnostics;
using System.Linq;
using System.Threading;
using System.Windows;
using System.Windows.Threading;
namespace Lively.Core;

public partial class WinDesktopCore
{
    private DesktopFileKeyboardHook desktopFileKeyboard;
    private DispatcherTimer desktopFileKeyboardTimer;
    private int desktopFileKeyQueue;
    private void StartDesktopFileKeyboard()
    {
        desktopFileKeyboard=new DesktopFileKeyboardHook((offer,edge)=>{
            var dispatcher=Application.Current?.Dispatcher;
            if(disposedValue||dispatcher is null||dispatcher.HasShutdownStarted||edge.Down&&Volatile.Read(ref desktopFileKeyQueue)>=32)return false;
            Interlocked.Increment(ref desktopFileKeyQueue);
            try{
                dispatcher.BeginInvoke(DispatcherPriority.Input,new Action(()=>{
                    try{if(!disposedValue)offer.Deliver(edge);}
                    catch(Exception error){Logger.Error(error,"Desktop file keyboard delivery failed");}
                    finally{Interlocked.Decrement(ref desktopFileKeyQueue);}
                }));return true;
            }catch{Interlocked.Decrement(ref desktopFileKeyQueue);return false;}
        },error=>Logger.Error(error,"Desktop file keyboard hook unavailable"));
        desktopFileKeyboardTimer=new DispatcherTimer(DispatcherPriority.Background,Application.Current.Dispatcher){Interval=TimeSpan.FromMilliseconds(50)};
        desktopFileKeyboardTimer.Tick+=DesktopFileKeyboardTick;desktopFileKeyboardTimer.Start();
    }
    private void DesktopFileKeyboardTick(object sender,EventArgs e)=>RefreshDesktopFileKeyboardOffer();
    private void RefreshDesktopFileKeyboardOffer()
    {
        if(disposedValue||desktopFileKeyboard is null)return;
        var dispatcher=Application.Current?.Dispatcher;if(dispatcher is null||dispatcher.HasShutdownStarted)return;
        if(!dispatcher.CheckAccess()){dispatcher.BeginInvoke(DispatcherPriority.Input,new Action(RefreshDesktopFileKeyboardOffer));return;}
        DesktopFileKeyboardOffer offer=null;
        try{
            if(desktopFileKeyboard.Active&&!screenSaver.IsRunning&&userSettings.Settings.InputForward!=InputForwardMode.off&&IsDesktop()&&
                NativeMethods.GetCursorPos(out var point)){
                var foreground=NativeMethods.GetForegroundWindow();
                var expires=Stopwatch.GetTimestamp()+Stopwatch.Frequency/2;
                foreach(var player in Wallpapers.OfType<WebWebView2>()){
                    var candidate=player.CaptureDesktopFileKeyboardOffer(foreground,expires);
                    if(candidate is not null&&point.X>=candidate.X&&point.Y>=candidate.Y&&
                        (long)point.X<(long)candidate.X+candidate.Width&&(long)point.Y<(long)candidate.Y+candidate.Height){offer=candidate;break;}
                }
            }
        }catch(Exception error){Logger.Debug(error,"Desktop file keyboard offer unavailable");}
        desktopFileKeyboard.Publish(offer);
    }
    private void StopDesktopFileKeyboard()
    {
        desktopFileKeyboardTimer?.Stop();
        if(desktopFileKeyboardTimer is not null)desktopFileKeyboardTimer.Tick-=DesktopFileKeyboardTick;
        foreach(var player in Wallpapers.OfType<WebWebView2>())player.NativeDesktopKeyboardChanged-=RefreshDesktopFileKeyboardOffer;
        desktopFileKeyboard?.Dispose();desktopFileKeyboard=null;
    }
}
