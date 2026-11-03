using System;
using Dext.Core.Rooms;
namespace Lively.Services.ApplicationDock;

internal sealed partial class ApplicationDockService
{
    private readonly DockPresentationPolicy presentationPolicy=new();
    private DockPresentationState presentationState;
    private long presentationAttempt;
    private DateTime presentationStarted;

    private void UpdatePresentation()
    {
        var theme=rooms.ReadThemeTaskCandidate();
        var owner=ownership.Owner;
        var actual=owner==DockHost.Application?"native":owner==DockHost.Theme?"theme":"none";
        var ready=actual=="native"?window?.NativeReady==true:
            actual=="theme"&&theme.Ready&&(theme.TaskAreaStatus is "ready" or "hidden");
        var eligible=theme.UnavailableReason==null;
        DockPresentationState Observe()=>presentationPolicy.Observe(preferences,theme.ContextKey,eligible,actual,ready,disposed);
        var state=Observe();
        if(state.Target=="theme"&&actual=="theme"&&theme.HostAttempt!=state.Attempt){ready=false;state=Observe();}
        if(state.Attempt!=presentationAttempt){presentationAttempt=state.Attempt;presentationStarted=DateTime.UtcNow;}
        if(theme.Blocked||actual==state.Target&&ready)presentationStarted=DateTime.UtcNow;
        if(state.Target=="theme")
        {
            var failure=theme.FailedAttempt==state.Attempt?"themeHostFailed":
                theme.Attached&&theme.HostAttempt==state.Attempt&&theme.TaskAreaStatus=="unavailable"?"taskAreaUnavailable":
                !theme.Blocked&&!ready&&DateTime.UtcNow-presentationStarted>TimeSpan.FromSeconds(35)?"themeReadyTimeout":null;
            if(failure!=null&&presentationPolicy.Fail(state.Attempt,failure))state=Observe();
        }
        if(state.Reason=="themeUnavailable"&&theme.UnavailableReason!=null)
            state=state with {Reason=theme.UnavailableReason};
        presentationState=state;
        rooms.ConfigureApplicationTheme(state.Target=="theme"?theme.ContextKey:null,state.Attempt,
            state.Target=="theme"?state.Mode:null);
        // Native is the only system Dock. The wallpaper must drop its theme dock
        // component so the 01/02/03 strip is not a second bar. Theme stays opt-in.
        rooms.PublishSystemDock(!preferences.Enabled ? "none" : state.Target == "theme" ? "theme" : "native");
        // Disabled application features restore the independently saved theme setting.
        ownership.Request(state.Target=="native"?DockHost.Application:DockHost.Theme);
    }
}
