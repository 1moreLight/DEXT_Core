using Lively.Services.ApplicationDock;
using System.Text.Json;
internal static class TaskDisplayChecks
{
    public static void Run()
    {
        var calls=0;
        byte[] png=[137,80,78,71,13,10,26,10];
        var display=new DockTaskDisplay(_=>{calls++;return png;});
        var group=new DockGroup("private-key","Editor",new DockPin("Editor","C:/private.exe","secret-arg","C:/private"),Array.Empty<DockTask>());
        var first=display.Update("host/desk/pins-1",new[]{group},0);
        if(first.Items[0].IconPng!=Convert.ToBase64String(png))throw new Exception("PNG missing");
        var next=display.Update("host/desk/pins-1",new[]{group},0);
        if(calls!=1||next.Items[0].Id!=first.Items[0].Id)throw new Exception("refresh re-extracts icons or changes IDs");
        var json=JsonSerializer.Serialize(next);
        if(json.Contains("private")||json.Contains("secret-arg"))throw new Exception("display leaked private fields");
        var changed=display.Update("host/desk/pins-2",new[]{group},0);
        if(changed.ContextId==first.ContextId)throw new Exception("pin revision did not revoke context");
        display.Clear();display.Update("host/desk/pins-2",new[]{group},0);
        if(calls!=2)throw new Exception("clear retained icon cache");
        var invalid=new DockTaskDisplay(_=>new byte[65537]).Update("a",new[]{group},0);
        if(invalid.Items[0].IconPng!=null)throw new Exception("oversize icon accepted");
        var failed=new DockTaskDisplay(_=>throw new IOException()).Update("a",new[]{group},0);
        if(failed.Items[0].IconPng!=null)throw new Exception("missing icon did not fall back");
        Console.WriteLine("PASS task display: cached PNG, private fields, context and fallback");
    }
}
