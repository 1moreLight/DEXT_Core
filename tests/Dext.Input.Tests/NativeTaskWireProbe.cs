using System.Collections.Concurrent;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using Dext.Core.Rooms;
using Lively.Common.Helpers;
using Lively.Common.Helpers.Pinvoke;
using Lively.Models.Message;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

// Actual Release Player and unchanged official runtime; Core replies/physical edges
// are explicit fixtures. Never launches an app or claims full desktop acceptance.
internal static class NativeTaskWireProbe
{
    [DllImport("user32.dll")] private static extern bool SetProcessDpiAwarenessContext(IntPtr value);
    [DllImport("user32.dll")] private static extern bool SetCursorPos(int x,int y);
    [DllImport("user32.dll")] private static extern IntPtr WindowFromPoint(NativeMethods.POINT point);
    public static async Task Run(string player,string hostDirectory,string sampleDirectory)
    {
        if(!SetProcessDpiAwarenessContext(new IntPtr(-4)))throw new Exception("Task probe requires PerMonitorV2");
        var root=Directory.CreateTempSubdirectory("Dext-v3-task-wire-");
        NativeMethods.GetCursorPos(out NativeMethods.POINT originalCursor);
        var foreground=NativeMethods.GetForegroundWindow();var cursorMoved=false;
        try
        {
            foreach(var file in Directory.GetFiles(Path.GetFullPath(hostDirectory)).Where(p=>Path.GetExtension(p) is ".html" or ".css" or ".js").Where(p=>!p.EndsWith(".test.js")))
                File.Copy(file,Path.Combine(root.FullName,Path.GetFileName(file)));
            var manifest=JObject.Parse(File.ReadAllText(Path.Combine(sampleDirectory,"room.json")));
            var content=Directory.CreateDirectory(Path.Combine(root.FullName,"content"));
            var resources=manifest["resources"]!.Values<string>().Select(p=>{
                var bytes=File.ReadAllBytes(Path.Combine(sampleDirectory,p!));var dest=Path.Combine(content.FullName,p!);
                Directory.CreateDirectory(Path.GetDirectoryName(dest)!);File.WriteAllBytes(dest,bytes);
                return new LivelyRoomRuntimeResource{Path=p!,Size=bytes.Length,Sha256=Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant()};
            }).ToArray();
            File.AppendAllText(Path.Combine(root.FullName,"main.js"),"""
                ;chrome.webview.addEventListener('message',event=>{
                  const command=event.data?.permissions?.command;if(event.data.type!=='dext:system-control-result'||!command)return;
                  const area=document.querySelector('.dext-task-area'),menu=area?.querySelector('.dext-task-menu');
                  chrome.webview.postMessage(JSON.stringify({type:'saveRoom',room:{report:command,diagnostics:dextRuntimeDiagnostics(),
                    taskCount:area?.querySelectorAll('.dext-task-item').length||0,enabled:!!area?.querySelector('.dext-task-item:not(:disabled)'),
                    menuVisible:!!menu&&!menu.hidden,focused:document.activeElement?.getAttribute('aria-label')}}));
                });
                """);
            var session=Guid.NewGuid();var stamp="isolated-task-wire";
            var snapshot=new RoomSessionSnapshot(1,session,(string)manifest["id"]!,"home",null,null,null,1,true,null)
                {InstallationStamp=stamp,Lifecycle=new(RoomLifecycleStage.Desktop,false,false,1)};
            var context=new LivelyMessageRoomRuntime{RuntimeGeneration=1,SessionId=session,RoomId=snapshot.RoomId,
                InstallationStamp=stamp,ViewKind="dock",ManifestJson=manifest.ToString(Formatting.None),Resources=resources};
            var info=new ProcessStartInfo(Path.GetFullPath(player)){UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden,
                RedirectStandardInput=true,RedirectStandardOutput=true,RedirectStandardError=true,StandardInputEncoding=Encoding.UTF8,
                WorkingDirectory=Path.GetDirectoryName(Path.GetFullPath(player))!};
            foreach(var arg in new[]{"--wallpaper-url",Path.Combine(root.FullName,"index.html"),"--wallpaper-type","local","--wallpaper-geometry","1440x120",
                "--wallpaper-user-data",Path.Combine(root.FullName,"user-data"),"--dext-trusted-host","--dext-native-runtime","--dext-dock","--dext-dock-height","96","--dext-dock-mode","autohide"})info.ArgumentList.Add(arg);
            using var process=Process.Start(info)??throw new Exception("Player start failed");
            var queue=new ConcurrentQueue<JObject>();var log=new ConcurrentQueue<string>();
            var reader=Task.Run(async()=>{while(await process.StandardOutput.ReadLineAsync() is{} line){log.Enqueue(line);try{queue.Enqueue(JObject.Parse(line));}catch(JsonException){}}});
            var errors=process.StandardError.ReadToEndAsync();IntPtr anchor=IntPtr.Zero;long inputVersion=0;
            try
            {
                await Next(v=>(int?)v["Type"]==(int)MessageType.msg_room_session_ready);
                await Send(context);var message=RoomSessionPlayerMessage.Create(snapshot,["home","focus","quiet"]);message.RuntimeGeneration=1;await Send(message);
                await Send(new LivelyMessageRoomDockPolicy{RuntimeGeneration=1,SessionId=session,Revision=1,InputConnected=true});
                var state=await Next(v=>(int?)v["Type"]==(int)MessageType.msg_room_dock_state&&(bool?)v["WindowReady"]==true);
                var taskContext=Guid.NewGuid().ToString("N");var item=Guid.NewGuid().ToString("N");var first=Guid.NewGuid().ToString("N");var second=Guid.NewGuid().ToString("N");
                string TaskJson(long sequence)=>JsonConvert.SerializeObject(new{contextId=taskContext,sequence,items=new[]{new{id=item,name="任务链检查",pinned=true,active=false,windows=new[]{new{id=first,title="测试窗口一",active=false},new{id=second,title="测试窗口二",active=false}}}}});
                await Send(new LivelyMessageRoomDockTasks{RuntimeGeneration=1,SessionId=session,Revision=1,ActionsEnabled=false,SnapshotJson=TaskJson(1)});
                var received=await InspectUntil(r=>(string?)r["diagnostics"]?["taskArea"]?["snapshot"]?["contextId"]==taskContext);
                Require((string?)received["diagnostics"]?["taskArea"]?["snapshot"]?["items"]?[0]?["id"]==item,"private snapshot arrived with opaque identity");
                Console.WriteLine("PASS actual Release Player receives task snapshot through private stdin and unchanged official main/controller/DOM");
                if((bool?)state["Fullscreen"]==true)
                {
                    Require((bool?)received["diagnostics"]?["taskArea"]?["available"]==false&&(bool?)received["enabled"]==false,"fullscreen keeps tasks unavailable");
                    Console.WriteLine("PASS fullscreen keeps official tasks unavailable; SKIP visible mouse/keyboard checks while foreground is fullscreen");
                    return;
                }
                var window=new IntPtr((long)state["WindowHwnd"]!);
                Require(DextNativeInputWindow.TryReadWorkArea(window,out var work),"current work area");
                Require(SetCursorPos(work.Left+work.Width/2,work.Bottom-1),"reveal probe Dock");cursorMoved=true;
                await Next(v=>(int?)v["Type"]==(int)MessageType.msg_room_dock_state&&(bool?)v["WindowReady"]==true&&(bool?)v["Visible"]==true);
                await InspectUntil(r=>(string?)r["diagnostics"]?["taskArea"]?["phase"]=="displayReady");
                await Send(new LivelyMessageRoomDockTasks{RuntimeGeneration=1,SessionId=session,Revision=1,ActionsEnabled=true,SnapshotJson=TaskJson(2)});
                var shown=await InspectUntil(r=>(bool?)r["enabled"]==true&&(int?)r["taskCount"]==1);
                inputVersion=(long)shown["diagnostics"]!["runtime"]!["inputVersion"]!;
                var middle=NativeMethods.FindWindowEx(anchor,IntPtr.Zero,"Chrome_WidgetWin_0",null);
                var input=NativeMethods.FindWindowEx(middle,IntPtr.Zero,"Chrome_WidgetWin_1",null);
                Require(DextNativeInputWindow.TryMeasure(window,anchor,input,process.Id,out var bounds,out var dpi),"owned native input viewport");
                Console.WriteLine("PASS actual Player builds official fusion DOM from Core private task snapshot");
                Require(NativeMethods.IsWindowVisible(input),"visible Dock must expose its actual Chromium input window");
                Console.WriteLine("PASS visible Dock exposes its actual Chromium input window");
                long sequence=1;
                LivelyMessageRoomNativePointer Packet(string kind,long issued,int key=0,LivelyRoomNativeTaskHit? hit=null)=>new(){RuntimeGeneration=1,SessionId=session,Revision=1,GeometryVersion=inputVersion,
                    GestureId=sequence,IssuedAt=issued,InputHandle=input.ToInt64(),Kind=kind,OriginX=bounds.X,OriginY=bounds.Y,PixelWidth=bounds.Width,PixelHeight=bounds.Height,Dpi=dpi,
                    X=bounds.X+(int)((hit?.X+hit?.Width/2??.5)*bounds.Width),Y=bounds.Y+(int)((hit?.Y+hit?.Height/2??.5)*bounds.Height),
                    SampleMouse=key==0,SampleKeyboard=key==13,Key=key,ScanCode=key==13?28:0,Consumer=key==13?DextNativeTaskSample.Consumer:null,
                    Button=key==13?hit?.ItemId:null,EntryId=key==13&&hit!=null?DextNativeTaskSample.EntryId(hit):null};
                async Task<LivelyMessageRoomNativeSample> Sample(LivelyMessageRoomNativePointer packet){await Send(packet);return(await Next(v=>(int?)v["Type"]==(int)MessageType.msg_room_native_sample)).ToObject<LivelyMessageRoomNativeSample>()!;}
                var focus=await Sample(Packet("focus",Stopwatch.GetTimestamp(),9));
                Require(focus.TaskTargets?.Length==1&&focus.TaskTargets[0].Action=="openWindows"&&focus.Buttons.Length>=5,"Tab samples real official targets beside author navigation");
                var target=focus.TaskTargets![0];
                async Task InputEvent(string kind,LivelyRoomNativeTaskHit hit){
                    var payload=JObject.FromObject(new{type="dext:v3-native-event",runtimeGeneration=1,sessionId=session,revision=1,geometryVersion=inputVersion,
                        kind,consumer=DextNativeTaskSample.Consumer,button=hit.ItemId,entryId=DextNativeTaskSample.EntryId(hit)});
                    if(kind=="activate")payload["inputSequence"]=sequence;
                    await Send(new LivelyMessageRoomNativeResponse{RuntimeGeneration=1,SessionId=session,PayloadJson=payload.ToString(Formatting.None)});
                }
                await InputEvent("focus",target);sequence++;var issued=Stopwatch.GetTimestamp();
                var down=await Sample(Packet("down",issued,13,target));var up=await Sample(Packet("up",issued,13,target));
                Require(down.Input.IssuedAt==issued&&up.Input.GestureId==sequence&&down.TaskTargets!.Single().ItemId==item&&up.TaskTargets!.Single().ItemId==item,"Enter keeps both native samples and target identity");
                await InputEvent("activate",target);await InspectUntil(r=>(bool?)r["menuVisible"]==true);
                Console.WriteLine("PASS actual Player Tab and Enter return task targets; private completion opens official window menu");
                sequence++;var menu=await Sample(Packet("focus",Stopwatch.GetTimestamp(),9));
                var choice=menu.TaskTargets!.Single(t=>t.WindowId==first);
                sequence++;issued=Stopwatch.GetTimestamp();
                var mouseDown=Packet("down",issued,0,choice);
                Require(SetCursorPos(mouseDown.X,mouseDown.Y),"move within probe to sampled menu target");await Task.Delay(100);
                Require(!InputUtil.IsPrimaryMouseButtonDown&&NativeMethods.GetAncestor(WindowFromPoint(new NativeMethods.POINT{X=mouseDown.X,Y=mouseDown.Y}),NativeMethods.GetAncestorFlags.GetRoot)==window,"OS mouse target belongs to this probe and no user drag is held");
                issued=Stopwatch.GetTimestamp();
                down=await Sample(Packet("down",issued,0,choice));
                up=await Sample(Packet("up",issued,0,choice));
                Require(down.TaskHit?.WindowId==first&&up.TaskHit?.WindowId==first&&up.Input.GestureId==sequence,"mouse receipt samples same clipped window choice");
                Console.WriteLine("PASS actual Player mouse DOWN/UP receipts return the same official window choice");
                await Send(new LivelyMessageRoomDockPolicy{RuntimeGeneration=1,SessionId=session,Revision=1,InputConnected=false});
                await InspectUntil(r=>(bool?)r["diagnostics"]?["taskArea"]?["available"]==false);
                Require(!NativeMethods.IsWindowVisible(input),"hidden Dock hides actual Chromium input");
                await Send(new LivelyMessageRoomDockPolicy{RuntimeGeneration=1,SessionId=session,Revision=1,InputConnected=true});
                Require(SetCursorPos(work.Left+work.Width/2,work.Bottom-1),"reveal probe Dock again");
                await Next(v=>(int?)v["Type"]==(int)MessageType.msg_room_dock_state&&(bool?)v["WindowReady"]==true&&(bool?)v["Visible"]==true);
                await InspectUntil(r=>(string?)r["diagnostics"]?["taskArea"]?["phase"]=="displayReady");
                await Send(new LivelyMessageRoomDockTasks{RuntimeGeneration=1,SessionId=session,Revision=1,ActionsEnabled=true,SnapshotJson=TaskJson(3)});
                await InspectUntil(r=>(bool?)r["enabled"]==true);
                Require(NativeMethods.IsWindowVisible(input),"revealed Dock restores actual Chromium input");
                Console.WriteLine("PASS hide/reveal keeps actual Chromium visibility in sync with Dock readiness");
                Require(NativeMethods.GetForegroundWindow()==foreground,"probe did not steal foreground");
                Console.WriteLine("PASS native hide disables official area; no OS app action or real RawInput proof claimed");
            }
            finally
            {
                if(cursorMoved)SetCursorPos(originalCursor.X,originalCursor.Y);
                if(!process.HasExited){await Send(new LivelyCloseCmd());process.StandardInput.Close();try{await process.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(5));}catch(TimeoutException){process.Kill(true);await process.WaitForExitAsync();}}
                await reader;
            }
            async Task Send(IpcMessage value){await process.StandardInput.WriteLineAsync(JsonConvert.SerializeObject(value));await process.StandardInput.FlushAsync();}
            async Task<JObject> InspectUntil(Func<JObject,bool> predicate){var stop=DateTime.UtcNow.AddSeconds(12);JObject? report=null;do{
                await Send(new LivelyMessageSystemControlResponse{RequestId="inspect",PermissionsJson="{\"command\":\"inspect\"}"});
                var wire=await Next(v=>v["RoomJson"]!=null);report=JObject.Parse((string)wire["RoomJson"]!);if(predicate(report))return report;await Task.Delay(60);
            }while(DateTime.UtcNow<stop);throw new Exception("Task report did not converge: "+report);}
            async Task<JObject> Next(Func<JObject,bool> predicate){var stop=DateTime.UtcNow.AddSeconds(15);while(DateTime.UtcNow<stop){if(queue.TryDequeue(out var value)){
                var type=(int?)value["Type"];if(type==(int)MessageType.msg_hwnd)anchor=new IntPtr((long)value["Hwnd"]!);
                if(type==(int)MessageType.msg_room_native_request){var method=(string?)value["Method"];if(method=="activate")throw new Exception("Task generated author activation unexpectedly");
                    await Send(new LivelyMessageRoomNativeResponse{Method=method,RuntimeGeneration=1,SessionId=session,PayloadJson=JsonConvert.SerializeObject(new{
                        type="dext:v3-native-response",requestId=(string?)value["RequestId"],runtimeGeneration=1,sessionId=session,revision=1,status="accepted",inputSequence=0,inputConsumed=false,
                        capabilities=new Dictionary<string,string>{{"desk.read","accepted"},{"desk.navigate","accepted"}},layout=method=="layoutRead"?new{revision=0,icons=new{},components=new{}}:null})});continue;}
                if(predicate(value))return value;continue;}
                if(process.HasExited)throw new Exception("Player exited: "+await errors+"; "+string.Join("\n",log.Where(line=>line.Contains("Native input delivery failed")).Concat(log.TakeLast(2))));await Task.Delay(15);
            }throw new TimeoutException("Task wire: "+string.Join("\n",log.TakeLast(8)));}
            void Require(bool condition,string detail){if(!condition)throw new Exception(detail);}
        }
        finally
        {
            if(cursorMoved)SetCursorPos(originalCursor.X,originalCursor.Y);
            var temporary=Path.GetFullPath(Path.GetTempPath()).TrimEnd(Path.DirectorySeparatorChar)+Path.DirectorySeparatorChar;
            if(!Path.GetFullPath(root.FullName).StartsWith(temporary,StringComparison.OrdinalIgnoreCase))throw new Exception("Task fixture outside temp root");
            for(var i=0;i<60&&Directory.Exists(root.FullName);i++){try{root.Delete(true);}catch(Exception e)when(e is IOException or UnauthorizedAccessException){await Task.Delay(250);}}
            if(Directory.Exists(root.FullName))throw new IOException("Owned task fixture cleanup incomplete: "+root.FullName);
        }
    }
}
