using Google.Protobuf.WellKnownTypes;
using Lively.Grpc.Common.Proto.Desktop;
using System.Text.Json;
using System.Runtime.InteropServices;
using System.Windows.Automation;

internal static class DesktopSyncLiveProbe
{
    // Run only through StorageGrantLiveProbe, which owns the temporary Room and cleanup.
    internal static async Task Run(DesktopService.DesktopServiceClient client, bool automatic = false)
    {
        var session=client.GetRoomSession(new Empty(),deadline:DateTime.UtcNow.AddSeconds(5));
        var name="! Dext Sync Probe "+Guid.NewGuid().ToString("N");
        var desktop=Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
        if(!Path.IsPathFullyQualified(desktop)||!Directory.Exists(desktop))throw new Exception("User desktop unavailable");
        var folder=Path.GetFullPath(Path.Combine(desktop,name));
        if(Path.GetDirectoryName(folder)!=Path.GetFullPath(desktop).TrimEnd(Path.DirectorySeparatorChar))throw new Exception("Unexpected probe path");
        JsonElement Read(){
            var reply=client.GetRoomPersonalEditor(new(){RoomId=session.RoomId,InstallationStamp=session.InstallationStamp},deadline:DateTime.UtcNow.AddSeconds(5));
            return JsonDocument.Parse(reply.ReplyJson).RootElement.Clone();
        }
        void Edit(object edit){
            var reply=client.EditRoomPersonal(new(){RoomId=session.RoomId,InstallationStamp=session.InstallationStamp,EditJson=JsonSerializer.Serialize(edit)},deadline:DateTime.UtcNow.AddSeconds(5));
            var value=JsonDocument.Parse(reply.ReplyJson).RootElement;
            if(value.GetProperty("status").GetString()!="accepted")throw new Exception("Desktop edit rejected: "+value);
        }
        JsonElement Settings()=>Read().GetProperty("editor").GetProperty("desktopSync");
        bool Displayed(string target){
            IntPtr playerWindow=IntPtr.Zero;long area=0;
            EnumChildWindows(GetDesktopWindow(),(window,_)=>{
                GetWindowThreadProcessId(window,out var pid);
                if(pid==session.PlayerPid&&GetWindowRect(window,out var bounds)){
                    var size=(long)(bounds.Right-bounds.Left)*(bounds.Bottom-bounds.Top);
                    if(size>area){area=size;playerWindow=window;}
                }
                return true;
            },IntPtr.Zero);
            if(playerWindow==IntPtr.Zero)return false;
            // WebView accessibility descendants belong to browser processes, not the Player PID.
            var button=AutomationElement.FromHandle(playerWindow).FindFirst(TreeScope.Descendants,new AndCondition(
                new PropertyCondition(AutomationElement.ControlTypeProperty,ControlType.Button),new PropertyCondition(AutomationElement.NameProperty,target)));
            return button is not null&&!button.Current.IsOffscreen;
        }
        bool BoundedDisplayed(string target)=>Task.Run(()=>Displayed(target)).WaitAsync(TimeSpan.FromSeconds(5)).GetAwaiter().GetResult();
        async Task Wait(Func<bool> condition,string label){
            var until=DateTime.UtcNow.AddSeconds(35);
            while(DateTime.UtcNow<until){if(condition()){Console.WriteLine("PASS "+label);return;}await Task.Delay(250);}
            throw new Exception(label+" timed out; "+Read());
        }
        var renamedFolder=folder+" renamed";
        Directory.CreateDirectory(folder);
        try
        {
            Edit(new{operation="setDesktopSync",deskId=session.CurrentDeskId,enabled=true});
            await Wait(()=>Settings().GetProperty("scanState").GetString()=="ready","actual Core desktop scan completes");
            var count=Settings().GetProperty("itemCount").GetInt32();if(count<1)throw new Exception("Empty desktop import");
            await Wait(()=>BoundedDisplayed(name),"actual Player exposes temporary folder icon by native accessibility");
            Edit(new{operation="refreshDesktopSync"});
            await Wait(()=>Settings().GetProperty("scanState").GetString()=="ready","explicit desktop refresh completes");
            if(Settings().GetProperty("itemCount").GetInt32()!=count)throw new Exception("Unchanged desktop refresh changed item count");
            Console.WriteLine("PASS repeat refresh retains item count="+count);
            if(automatic)
            {
                Directory.Delete(folder,false);
                await Wait(()=>Settings().GetProperty("itemCount").GetInt32()==count-1&&!BoundedDisplayed(name),"deletion updates Core and Player without refresh");
                Directory.CreateDirectory(folder);
                await Wait(()=>Settings().GetProperty("itemCount").GetInt32()==count&&BoundedDisplayed(name),"new folder appears automatically without refresh");
                Directory.Move(folder,renamedFolder);
                await Wait(()=>BoundedDisplayed(name+" renamed")&&!BoundedDisplayed(name),"rename replaces the actual Player icon without refresh");
                if(Settings().GetProperty("itemCount").GetInt32()!=count)throw new Exception("Rename duplicated a desktop item");
                Directory.Move(renamedFolder,folder);
                await Wait(()=>BoundedDisplayed(name)&&!BoundedDisplayed(name+" renamed"),"second rename returns to original identity");
            }
            Edit(new{operation="setDesktopSync",deskId=session.CurrentDeskId,enabled=false});
            await Wait(()=>!BoundedDisplayed(name),"disabling sync removes actual Player icon");
            if(!Directory.Exists(folder))throw new Exception("Disabling sync removed source folder");
            Console.WriteLine("PASS source folder survives disable; no user file was opened");
            if(automatic)
            {
                Directory.Move(folder,renamedFolder);
                await Task.Delay(1000);
                if(BoundedDisplayed(name+" renamed"))throw new Exception("Disabled watcher published a new icon");
                Edit(new{operation="setDesktopSync",deskId=session.CurrentDeskId,enabled=true});
                await Wait(()=>BoundedDisplayed(name+" renamed"),"re-enable reconciles files changed while sync was disabled");
                Edit(new{operation="setDesktopSync",deskId=session.CurrentDeskId,enabled=false});
                await Wait(()=>!BoundedDisplayed(name+" renamed"),"second disable clears reconnected desktop");
            }
        }
        finally
        {
            // Non-recursive: only our uniquely named empty directory may be removed.
            if(Directory.Exists(folder))Directory.Delete(folder,false);
            if(Directory.Exists(renamedFolder))Directory.Delete(renamedFolder,false);
        }
    }
    private delegate bool Callback(IntPtr window,IntPtr parameter);
    [StructLayout(LayoutKind.Sequential)]private struct Rect{public int Left,Top,Right,Bottom;}
    [DllImport("user32.dll")]private static extern IntPtr GetDesktopWindow();
    [DllImport("user32.dll")]private static extern bool EnumChildWindows(IntPtr parent,Callback callback,IntPtr parameter);
    [DllImport("user32.dll")]private static extern uint GetWindowThreadProcessId(IntPtr window,out uint pid);
    [DllImport("user32.dll")]private static extern bool GetWindowRect(IntPtr window,out Rect rect);
}
