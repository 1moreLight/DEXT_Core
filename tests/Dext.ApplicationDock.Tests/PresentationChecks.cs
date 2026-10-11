using Lively.Services.ApplicationDock;
using System.Text.Json;
internal static class PresentationChecks
{
    internal static void Run()
    {
        void Check(bool value,string name){if(!value)throw new Exception(name);Console.WriteLine("PASS presentation: "+name);}
        var p=JsonSerializer.Deserialize<DockPreferences>("{\"Enabled\":true,\"Pins\":[]}")!;
        Check(p.Presentation=="native","old preferences keep native default");
        var directory=Path.Combine(Path.GetTempPath(),"dext-presentation-"+Guid.NewGuid().ToString("N"));
        try {
            var path=Path.Combine(directory,"preferences.json");
            DockPreferenceFile.Save(path,p with {Presentation="theme"});
            Check(DockPreferenceFile.Load(path).Presentation=="theme","theme selection survives preference round trip");
            File.WriteAllText(path,"{\"Enabled\":true,\"Pins\":[],\"Presentation\":\"unknown\"}");
            bool rejected=false;try{DockPreferenceFile.Load(path);}catch(JsonException){rejected=true;}
            Check(rejected,"unknown stored presentation rejected");
        } finally {if(Directory.Exists(directory))Directory.Delete(directory,true);}
        var policy=new DockPresentationPolicy();
        var state=policy.Observe(p,"room-a",true,"native",true,false);
        Check(state.Target=="native"&&state.Actual=="native"&&state.Phase=="ready"&&state.Mode=="overlay","native and overlay defaults");
        p=p with {Presentation="theme"};
        state=policy.Observe(p,"room-a",true,"native",true,false);
        var first=state.Attempt;
        Check(state.Target=="theme"&&state.Phase=="switching"&&state.Actual=="native","intent does not claim host ready");
        state=policy.Observe(p,"room-a",true,"theme",false,false);
        Check(state.Phase=="starting","attached host still awaits readiness");
        Check(policy.Fail(first,"themeLoadFailed"),"current attempt can fail");
        state=policy.Observe(p,"room-a",true,"native",true,false);
        Check(state.Target=="native"&&state.Requested=="theme"&&state.Phase=="fallback"&&state.Reason=="themeLoadFailed","failure retains intent and confirms fallback separately");
        Check(policy.Observe(p,"room-a",true,"native",true,false).Attempt==first,"polling cannot restart failed attempt");
        policy.Retry();state=policy.Observe(p,"room-a",true,"native",true,false);
        Check(state.Target=="theme"&&state.Attempt>first&&!policy.Fail(first,"lateFailure"),"retry retires old callback");
        Check(policy.Fail(state.Attempt,"missingArea"),"new failure recorded");
        state=policy.Observe(p,"room-b",true,"native",true,false);
        Check(state.Target=="theme"&&state.Reason==null,"new Room clears previous failure");
        state=policy.Observe(p with {ReserveSpace=true},"room-b",true,"theme",true,false);
        Check(state.Mode=="reserve"&&state.Phase=="ready","reserve mode");
        state=policy.Observe(p with {AutoHide=true},"room-b",true,"theme",true,false);
        Check(state.Mode=="autohide","auto-hide mode");
        state=policy.Observe(p,null,false,"native",true,false);
        Check(state.Target=="native"&&state.Reason=="themeUnavailable","missing Room uses native");
        state=policy.Observe(p with {Enabled=false},"room-b",true,"theme",true,false);
        Check(state.Target=="none"&&state.Phase=="disabled","disabled app function does not request a host");
        state=policy.Observe(p,"room-b",true,"theme",true,true);
        Check(state.Target=="none"&&state.Phase=="stopping"&&!policy.Fail(state.Attempt,"lateExit"),"shutdown cannot request fallback");
        policy.Retry();
        Check(policy.Observe(p,"room-c",true,"none",false,false).Target=="none","late refresh or retry cannot undo shutdown");
    }
}
