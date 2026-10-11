using System;
namespace Lively.Services.ApplicationDock;

internal sealed record DockPresentationState(string Requested,string Target,string Actual,
    string Mode,string Phase,string Reason,long Attempt);

// Called on the service Dispatcher. This selects a desired host, never acquires
// ownership or claims a window is ready. The lifecycle adapter supplies actual state.
internal sealed class DockPresentationPolicy
{
    private string context, failure;
    private long attempt;
    private bool stopped, canFail;
    internal DockPresentationState Observe(DockPreferences preferences,string roomKey,
        bool themeAvailable,string actual,bool ready,bool stopping)
    {
        if(preferences.Presentation is not ("native" or "theme") ||
            preferences.AutoHide&&preferences.ReserveSpace || actual is not ("none" or "native" or "theme"))
            throw new ArgumentException("Invalid Dock presentation state.");
        stopped |= stopping;
        var mode=preferences.ReserveSpace?"reserve":preferences.AutoHide?"autohide":"overlay";
        // Length-prefix Room identity so arbitrary names cannot alias separators.
        var key=$"{preferences.Enabled}/{preferences.Presentation}/{mode}/{roomKey?.Length??-1}:{roomKey}";
        if(context!=key){context=key;failure=null;attempt++;}
        var requested=preferences.Presentation;
        canFail=false;
        if(stopped)return new(requested,"none",actual,mode,"stopping",null,attempt);
        if(!preferences.Enabled)return new(requested,"none",actual,mode,"disabled",null,attempt);
        var reason=requested=="theme"?(failure??(!themeAvailable||string.IsNullOrEmpty(roomKey)?"themeUnavailable":null)):null;
        var target=requested=="theme"&&reason==null?"theme":"native";
        canFail=target=="theme";
        var phase=actual!=target?"switching":!ready?"starting":reason!=null?"fallback":"ready";
        return new(requested,target,actual,mode,phase,reason,attempt);
    }
    internal bool Fail(long expectedAttempt,string reason)
    {
        if(stopped||!canFail||expectedAttempt!=attempt||string.IsNullOrWhiteSpace(reason))return false;
        failure=reason;canFail=false;return true;
    }
    internal void Retry()
    {
        if(stopped)return;
        failure=null;canFail=false;attempt++;
    }
}
