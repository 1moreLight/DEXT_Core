using System.Collections.Concurrent;
using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;
using System.Runtime.InteropServices;
using Lively.Common.Extensions;
using Lively.Common.Helpers;
using Lively.Common.Helpers.Pinvoke;
using Lively.Models.Message;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Dext.Core.Rooms;

internal static class OfficialHostWireProbe
{
    [DllImport("user32.dll")] private static extern bool SetProcessDpiAwarenessContext(IntPtr context);
    public static async Task Run(string player,string hostDirectory,string sdk)
    {
        if(!SetProcessDpiAwarenessContext(new IntPtr(-4)))throw new Exception("Official probe requires Core PerMonitorV2 DPI");
        var root=Directory.CreateTempSubdirectory("Dext-v3-official-wire-");
        try
        {
            foreach(var file in new[]{"index.html","main.js","style.css","geometry.js", "layout-model.js","runtime-model.js","native-host.js","frame-host.js","media-host.js","playback-host.js","dom-host.js"})
                File.Copy(Path.Combine(Path.GetFullPath(hostDirectory),file),Path.Combine(root.FullName,file));
            var content=Directory.CreateDirectory(Path.Combine(root.FullName,"content"));File.Copy(Path.GetFullPath(sdk),Path.Combine(content.FullName,"sdk.js"));
            File.WriteAllText(Path.Combine(content.FullName,"bg.svg"),"<svg xmlns='http://www.w3.org/2000/svg' width='1920' height='1080'><rect width='1920' height='1080' fill='#172235'/></svg>");
            File.WriteAllText(Path.Combine(content.FullName,"author.html"),"""
                <!doctype html><button id=next>Next</button><span id=time></span><script src=sdk.js></script><script>
                const documentId=crypto.randomUUID();let readyCount=0;
                Dext.ready().then(()=>{
                  readyCount++;parent.postMessage({authorDocument:true,consumer:Dext.session.consumerId,documentId,readyCount},'*');
                  Dext.data.bindReadout('time.read',document.getElementById('time'),v=>{document.getElementById('time').textContent=v.tick;parent.postMessage({authorValue:true,consumer:Dext.session.consumerId,tick:v.tick},'*');});
                  const publish=()=>Dext.scene.publishGeometry({buttons:[{buttonId:'next',x:10,y:10,width:80,height:30}]}).catch(()=>{});
                  Dext.scene.subscribeGeometry(publish);Dext.desk.subscribe(publish);
                  document.getElementById('next').addEventListener('click',()=>Dext.actions.activate('next'));
                });
                </script>
                """);
            // Instrumentation is appended only in this isolated fixture. The
            // copied official main and all runtime modules are unchanged.
            File.AppendAllText(Path.Combine(root.FullName,"main.js"),"""
                ;(() => {
                  const documents=new Map(),values=new Map();const send=v=>chrome.webview.postMessage(JSON.stringify({type:'saveRoom',room:v}));
                  const report=command=>send({report:command,iconRects:[...document.querySelectorAll('.dext-v3-icon')].filter(n=>!n.hidden).map(n=>{const r=n.getBoundingClientRect();return{label:n.getAttribute('aria-label'),x:r.left/innerWidth,y:r.top/innerHeight,width:r.width/innerWidth,height:r.height/innerHeight};}),diagnostics:dextRuntimeDiagnostics(),focusVisible:!!document.querySelector('.dext-v3-focus:not([hidden])'),focusPieces:document.querySelectorAll('.dext-v3-focus>polygon').length,iframeCount:document.querySelectorAll('iframe').length,documents:[...documents.values()],values:[...values]});
                  addEventListener('message',e=>{const owned=[...document.querySelectorAll('iframe')].some(f=>f.contentWindow===e.source);if(!owned)return;
                    if(e.data?.authorDocument)documents.set(e.data.consumer,e.data);if(e.data?.authorValue)values.set(e.data.consumer,e.data.tick);});
                  const original=dextNativePlaybackChanged;window.dextNativePlaybackChanged=value=>{const accepted=original(value);send({playback:value.paused,accepted,diagnostics:dextRuntimeDiagnostics()});return accepted;};
                  chrome.webview.addEventListener('message',e=>{const command=e.data?.permissions?.command,expectedRevision=e.data?.permissions?.revision;if(e.data.type!=='dext:system-control-result'||!command)return;
                    const stop=performance.now()+8000;const poll=()=>{const d=dextRuntimeDiagnostics(),ready=command==='revoked'?d.runtime===null:d.revision===expectedRevision&&d.runtime?.inputReady&&documents.size===2&&values.size===2;
                      if((ready&&(command!=='movingSource'||d.runtime.transition?.elapsed>=1000&&!d.runtime.transition.finished))||performance.now()>stop)report(command);else setTimeout(poll,20);};poll();});
                })();
                """);
            var info=new ProcessStartInfo(Path.GetFullPath(player)){UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden,RedirectStandardInput=true,RedirectStandardOutput=true,RedirectStandardError=true,StandardInputEncoding=Encoding.UTF8,WorkingDirectory=Path.GetDirectoryName(Path.GetFullPath(player))!};
            foreach(var arg in new[]{"--wallpaper-url",Path.Combine(root.FullName,"index.html"),"--wallpaper-type","local","--wallpaper-geometry","640x480","--wallpaper-user-data",Path.Combine(root.FullName,"user-data"),"--dext-trusted-host","--dext-native-runtime","--wallpaper-scale","1.5"})info.ArgumentList.Add(arg);
            using var process=Process.Start(info)??throw new Exception("Player did not start");var queue=new ConcurrentQueue<JObject>();var log=new ConcurrentQueue<string>();var geometries=0;JObject? lastGeometry=null;var ticks=0;long expectedRevision=0;IntPtr anchor=IntPtr.Zero;var actions=0;
            var reader=Task.Run(async()=>{while(await process.StandardOutput.ReadLineAsync() is{} line){log.Enqueue(line);try{var value=JObject.Parse(line);var type=(int?)value["Type"];
                if(type==(int)MessageType.msg_hwnd)anchor=new IntPtr((long)value["Hwnd"]!);
                if(type==(int)MessageType.msg_room_native_sample)queue.Enqueue(new JObject{["sample"]=value});
                if(value["RoomJson"] is{} room)queue.Enqueue(JObject.Parse((string)room!));
                if(type==(int)MessageType.msg_room_session_ready)queue.Enqueue(new JObject{["ready"]=true});
                if(type==(int)MessageType.msg_room_native_request)queue.Enqueue(new JObject{["native"]=value});
                if(type==(int)MessageType.msg_room_transition_complete)queue.Enqueue(new JObject{["complete"]=value});
            }catch(JsonException){}}});var errors=process.StandardError.ReadToEndAsync();
            var f=RuntimeMessageChecks.Fixture();var context=RuntimeMessageChecks.ContextMessage(f.Context,f.Snapshot,1);
            try
            {
                Require((bool?)(await Next())["ready"]==true,"official page ready");
                var window=process.GetProcessWindow(true);NativeMethods.ShowWindow(window,4);NativeMethods.SetWindowPos(window,0,120,120,640,480,0x14);await Task.Delay(300);
                context.Resources=Directory.GetFiles(content.FullName).Select(path=>{var bytes=File.ReadAllBytes(path);return new LivelyRoomRuntimeResource{Path=Path.GetFileName(path),Size=bytes.Length,Sha256=Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant()};}).ToArray();
                var manifest=new {version=3,apiVersion=1,id=f.Snapshot.RoomId,name="Official host probe",startDesk="home",resources=context.Resources.Select(r=>r.Path).ToArray(),
                    roomScene=new{entry="author.html",capabilities=new[]{"desk.read","time.read"}},transition=new{type="slide",durationMs=4500},
                    buttons=new[]{new{id="next",name="Next",scope="room",action=new{type="desk.next"}}},
                    components=new[]{new{id="shared",role="widget",entry="author.html",placement=new{x=400,y=50,width=200,height=100},capabilities=new[]{"desk.read","time.read"},buttonIds=new[]{"next"}}},
                    desks=new[]{new{id="home",name="Home",icons=new object[]{new{id="first",buttonId="next",x=8,y=0},new{id="second",buttonId="next",x=9,y=0}},components=new[]{"shared"},background=new{type="image",src="bg.svg"}},new{id="focus",name="Focus",icons=Array.Empty<object>(),components=new[]{"shared"},background=new{type="image",src="bg.svg"}}}};
                context.ManifestJson=JsonConvert.SerializeObject(manifest);await Send(context);await Snapshot(1,"home");await Command("initial");var initial=await NextReport("initial");
                Require((int?)initial["iframeCount"]==2&&(int?)initial["diagnostics"]?["runtime"]?["frames"]?["count"]==2&&geometries>=1,"actual official DOM mounts scene and shared widget after geometry ack");
                var documents=(JArray)initial["documents"]!;Require(documents.Count==2&&documents.All(d=>(int?)d["readyCount"]==1),"two SDK documents initialize once");
                Require(lastGeometry?["Buttons"] is JArray nativeEntries&&nativeEntries.Count(e=>(string?)e["Consumer"]=="official"&&(string?)e["Button"]=="next"&&e["Polygons"] is JArray)==2,"actual strict Player preserves two polygon entries for one action");
                Require((bool?)lastGeometry?["SampleMouse"]==true,"production geometry enables event samples");
                var middle=NativeMethods.FindWindowEx(anchor,IntPtr.Zero,"Chrome_WidgetWin_0",null);
                var input=NativeMethods.FindWindowEx(middle,IntPtr.Zero,"Chrome_WidgetWin_1",null);
                Require(DextNativeInputWindow.TryMeasure(window,anchor,input,process.Id,out var bounds,out var dpi),"official owned input viewport");
                var first=((JArray)lastGeometry!["Buttons"]!).Single(e=>(string?)e["EntryId"]=="icon.home/first");
                var px=bounds.X+(int)(((double)first["X"]!+(double)first["Width"]!/2)*bounds.Width);
                var py=bounds.Y+(int)(((double)first["Y"]!+(double)first["Height"]!/2)*bounds.Height);
                var inputVersion=(long)initial["diagnostics"]!["runtime"]!["inputVersion"]!;
                var issued=Stopwatch.GetTimestamp();
                LivelyMessageRoomNativePointer Pointer(string kind)=>new(){RuntimeGeneration=1,SessionId=context.SessionId,Revision=1,GeometryVersion=inputVersion,
                    GestureId=7,IssuedAt=issued,InputHandle=input.ToInt64(),Kind=kind,OriginX=bounds.X,OriginY=bounds.Y,PixelWidth=bounds.Width,
                    PixelHeight=bounds.Height,Dpi=dpi,X=px,Y=py,SampleMouse=true};
                var foreground=NativeMethods.GetForegroundWindow();
                await Send(Pointer("down"));var downSample=(await Next())["sample"]?.ToObject<LivelyMessageRoomNativeSample>();
                Require(downSample?.Input.Kind=="down"&&downSample.Input.GestureId==7&&actions==0,"official trusted DOWN receipt sends sample before activation");
                await Send(Pointer("up"));var upSample=(await Next())["sample"]?.ToObject<LivelyMessageRoomNativeSample>();
                Require(upSample?.Input.Kind=="up"&&upSample.Input.IssuedAt==issued&&upSample.Input.GestureId==7&&actions==0,"official trusted UP receipt sends second sample before activation");
                Require(downSample!.Buttons.Any(e=>e.EntryId=="icon.home/first"&&e.Polygons.Length>0)&&upSample!.Buttons.Any(e=>e.EntryId=="icon.home/first"&&e.Polygons.Length>0),
                    "actual official DOM samples retain exact icon polygon identity");
                Require(NativeMethods.GetForegroundWindow()==foreground,"sampled official input changed foreground window");
                await Send(new LivelyMessageRoomNativeResponse{RuntimeGeneration=1,SessionId=context.SessionId,PayloadJson=JsonConvert.SerializeObject(new{
                    type="dext:v3-native-event",runtimeGeneration=1,sessionId=context.SessionId,revision=1,geometryVersion=inputVersion,
                    kind="activate",consumer="official",button="next",entryId="icon.home/first",inputSequence=7})});
                var activated=(await Next())["activated"];
                Require((string?)activated?["Consumer"]=="official"&&(string?)activated?["Button"]=="next"&&(long?)activated?["InputSequence"]==7&&actions==1,
                    "actual official host releases exactly the sampled icon default action");
                Console.WriteLine("PASS actual production DOM/top native receipt: DOWN/UP polygon samples, one official icon action, unchanged foreground; Core packets/replies are fixture");
                await Send(new LivelyMessageRoomNativeResponse{RuntimeGeneration=1,SessionId=context.SessionId,PayloadJson=JsonConvert.SerializeObject(new{type="dext:v3-native-event",runtimeGeneration=1,sessionId=context.SessionId,revision=1,geometryVersion=(long?)initial["diagnostics"]?["runtime"]?["inputVersion"],kind="focus",consumer="official",button="next",entryId="icon.home/second"})});
                await Command("focusSecond");var focused=await NextReport("focusSecond");
                Require((string?)focused["diagnostics"]?["runtime"]?["focus"]?["entryId"]=="icon.home/second"&&(bool?)focused["focusVisible"]==true&&(int?)focused["focusPieces"]==1,"actual official SVG focuses exact second icon without author DOM focus");
                var transition=Guid.NewGuid();await Snapshot(2,"home","focus",transition);
                await Command("movingSource");var moving=await NextReport("movingSource");
                Require((bool?)moving["diagnostics"]?["runtime"]?["transition"]?["finished"]==false,"source sample must occur during actual default animation");
                var movingRect=((JArray)moving["iconRects"]!).Single(row=>(string?)row["label"]=="first");
                var movingX=bounds.X+(int)(((double)movingRect["x"]!+(double)movingRect["width"]!/2)*bounds.Width);
                var movingY=bounds.Y+(int)(((double)movingRect["y"]!+(double)movingRect["height"]!/2)*bounds.Height);
                var movingVersion=(long)moving["diagnostics"]!["runtime"]!["inputVersion"]!;var movingIssued=Stopwatch.GetTimestamp();
                LivelyMessageRoomNativePointer MovingPointer(string kind)=>new(){RuntimeGeneration=1,SessionId=context.SessionId,Revision=2,GeometryVersion=movingVersion,
                    GestureId=8,IssuedAt=movingIssued,InputHandle=input.ToInt64(),Kind=kind,OriginX=bounds.X,OriginY=bounds.Y,
                    PixelWidth=bounds.Width,PixelHeight=bounds.Height,Dpi=dpi,X=movingX,Y=movingY,SampleMouse=true};
                await Send(MovingPointer("down"));var movingDown=(await Next())["sample"]?.ToObject<LivelyMessageRoomNativeSample>();
                await Send(MovingPointer("up"));var movingUp=(await Next())["sample"]?.ToObject<LivelyMessageRoomNativeSample>();
                Require(movingDown?.Input.Kind=="down"&&movingUp?.Input.Kind=="up"&&movingDown.Input.GestureId==8&&movingUp.Input.IssuedAt==movingIssued,
                    "actual moving source dispatch receipts must release both edge samples");
                Require(DextNativeGeometry.TryCreate(movingDown!.Buttons,out var downRegions),"actual moving DOWN sample remains exact convex regions");
                Require(DextNativeGeometry.TryCreate(movingUp!.Buttons,out var upRegions),"actual moving UP sample remains exact convex regions");
                var sourceDown=downRegions.Single(row=>row.EntryId=="icon.home/first");
                var sourceUp=upRegions.Single(row=>row.EntryId=="icon.home/first");
                Require(sourceDown.X!=sourceUp.X&&sourceDown.Contains(((double)movingX-bounds.X)/bounds.Width,((double)movingY-bounds.Y)/bounds.Height)&&
                    sourceUp.Contains(((double)movingX-bounds.X)/bounds.Width,((double)movingY-bounds.Y)/bounds.Height),"both true moving polygons hit the same physical point at their painted positions");
                Require(NativeMethods.GetForegroundWindow()==foreground,"moving native input changed foreground");
                await Send(new LivelyMessageRoomNativeResponse{RuntimeGeneration=1,SessionId=context.SessionId,PayloadJson=JsonConvert.SerializeObject(new{
                    type="dext:v3-native-event",runtimeGeneration=1,sessionId=context.SessionId,revision=2,geometryVersion=movingVersion,
                    kind="activate",consumer="official",button="next",entryId="icon.home/first",inputSequence=8})});
                var movingActivated=(await Next())["activated"];
                Require((long?)movingActivated?["InputSequence"]==8&&actions==2,"moving source releases one original sequence action");
                Console.WriteLine("PASS actual production animated source icon: different painted DOWN/UP polygons contain same native point, two trusted receipts and one original sequence action; Core packets/replies are fixture");
                var keyIssued=Stopwatch.GetTimestamp();
                LivelyMessageRoomNativePointer MovingKey(string kind)=>new(){RuntimeGeneration=1,SessionId=context.SessionId,Revision=2,GeometryVersion=movingVersion,
                    GestureId=9,IssuedAt=keyIssued,InputHandle=input.ToInt64(),Kind=kind,OriginX=bounds.X,OriginY=bounds.Y,
                    PixelWidth=bounds.Width,PixelHeight=bounds.Height,Dpi=dpi,X=bounds.X,Y=bounds.Y,SampleKeyboard=true,
                    Key=13,ScanCode=28,Consumer="official",Button="next",EntryId="icon.home/first"};
                await Send(MovingKey("down"));var keyDown=(await Next())["sample"]?.ToObject<LivelyMessageRoomNativeSample>();
                await Send(MovingKey("up"));var keyUp=(await Next())["sample"]?.ToObject<LivelyMessageRoomNativeSample>();
                Require(keyDown?.Input.SampleKeyboard==true&&keyUp?.Input.SampleKeyboard==true&&keyDown.Input.Key==13&&
                    keyUp.Input.GestureId==9&&keyUp.Input.IssuedAt==keyIssued&&actions==2,"official Core key samples precede default action");
                Require(DextNativeGeometry.TryCreate(keyDown!.Buttons,out var keyDownRegions),"moving key DOWN regions");
                Require(DextNativeGeometry.TryCreate(keyUp!.Buttons,out var keyUpRegions),"moving key UP regions");
                Require(keyDownRegions.Single(r=>r.EntryId=="icon.home/first").X!=keyUpRegions.Single(r=>r.EntryId=="icon.home/first").X,
                    "official key reads two different painted source positions");
                Require(NativeMethods.GetForegroundWindow()==foreground,"sampled official key changed foreground");
                await Send(new LivelyMessageRoomNativeResponse{RuntimeGeneration=1,SessionId=context.SessionId,PayloadJson=JsonConvert.SerializeObject(new{
                    type="dext:v3-native-event",runtimeGeneration=1,sessionId=context.SessionId,revision=2,geometryVersion=movingVersion,
                    kind="activate",consumer="official",button="next",entryId="icon.home/first",inputSequence=9})});
                Require((long?)(await Next())["activated"]?["InputSequence"]==9&&actions==3,"official sampled key releases one action");
                Console.WriteLine("PASS actual production moving source keyboard samples: both current painted entry polygons before one default action; Core physical key/packets/replies are fixture, no official DOM key is synthesized");
                var completion=await Next();Require((string?)completion["complete"]?["TransitionId"]==transition.ToString(),"default DOM transition reports current completion");
                await Command("beforeCommit");var before=await NextReport("beforeCommit");Require((string?)before["diagnostics"]?["runtime"]?["currentDeskId"]=="home","host never commits Desk itself");
                await Snapshot(3,"focus");await Command("committed");var committed=await NextReport("committed");Require((bool?)committed["focusVisible"]==false&&committed["diagnostics"]?["runtime"]?["focus"]?.Type==JTokenType.Null,"actual SVG focus cleared on input invalidation");Require((string?)committed["diagnostics"]?["runtime"]?["currentDeskId"]=="focus"&&JToken.DeepEquals(documents,committed["documents"]),"Core commit retains actual iframe documents");
                var queuedTransition=Guid.NewGuid();await Snapshot(4,"focus","home",queuedTransition);await Snapshot(5,"focus","home",queuedTransition,"focus");await Task.Delay(100);await Send(new LivelySuspendCmd());var paused=await Next();
                Require((bool?)paused["playback"]==true&&(bool?)paused["accepted"]==true,"official native pause accepted");await Task.Delay(1100);Require(!queue.Any(q=>q["complete"]!=null),"paused default animation cannot finish");
                await Snapshot(6,"focus","home",queuedTransition,"focus");await Send(new LivelyResumeCmd());var resumed=await Next();Require((bool?)resumed["playback"]==false&&(bool?)resumed["accepted"]==true&&(long?)resumed["diagnostics"]?["revision"]==6,"last Core revision before releasing default animation");
                var resumedCompletion=await Next();Require((string?)resumedCompletion["complete"]?["TransitionId"]==queuedTransition.ToString(),"same queued transition finishes once after resume");await Snapshot(7,"home");await Command("resumed");var restored=await NextReport("resumed");Require(JToken.DeepEquals(documents,restored["documents"]),"queue and private suspend do not rebuild shared documents");
                await Send(new LivelyMessageRoomRuntimeRevoke{RuntimeGeneration=1,SessionId=context.SessionId,RoomId=context.RoomId,InstallationStamp=context.InstallationStamp});await Command("revoked");var revoked=await NextReport("revoked");Require((int?)revoked["iframeCount"]==0&&revoked["diagnostics"]?["runtime"]?.Type==JTokenType.Null,"revoke disposes all official DOM frames");
                Console.WriteLine("PASS actual official index/main/dom/native/frame/media/SDK in ReleasePlayer: precise polygon/multiple icon identities, exact SVG focus and clearing, geometry ack, continuous readouts, two retained documents, Core-only commit, queue without restart, native pause/latest revision, revoke disposal (Core replies are fixture)");
                async Task Snapshot(long revision,string current,string? target=null,Guid? transitionId=null,string? queued=null){var message=RoomSessionPlayerMessage.Create(f.Snapshot with{Revision=revision,CurrentDeskId=current,TargetDeskId=target,TransitionId=transitionId,QueuedDeskId=queued,DeadlineUtc=transitionId!=null?DateTimeOffset.UtcNow.AddSeconds(5):null},["home","focus"]);expectedRevision=revision;message.RuntimeGeneration=1;await Send(message);}
                async Task Command(string command)=>await Send(new LivelyMessageSystemControlResponse{RequestId=command,PermissionsJson=JsonConvert.SerializeObject(new{command,revision=expectedRevision})});
                async Task<JObject> NextReport(string command){var value=await Next();Require((string?)value["report"]==command,"report "+command);return value;}
                async Task<JObject> Next(){var stop=DateTime.UtcNow.AddSeconds(25);while(DateTime.UtcNow<stop){if(queue.TryDequeue(out var value)){
                    if(value["native"] is{} request){var method=(string?)request["Method"];var consumer=(string?)request["Consumer"];Require(method is "invalidateGeometry" or "geometry" or "capabilities" or "data" or "layoutRead" or "activate","official permitted native request");if(method=="geometry"){geometries++;lastGeometry=(JObject)request;}
                        if(method=="capabilities"||method=="data")Require(consumer is "scene" or "component.shared","fixed actual consumer");
                        if(method=="activate")actions++;
                        if(method=="data"){Require((string?)request["Capability"]=="time.read","declared actual data");ticks++;}
                        await Send(new LivelyMessageRoomNativeResponse{Method=method,RuntimeGeneration=1,SessionId=context.SessionId,PayloadJson=JsonConvert.SerializeObject(new{type="dext:v3-native-response",requestId=(string?)request["RequestId"],runtimeGeneration=1,sessionId=context.SessionId,revision=(long?)request["Revision"],status="accepted",inputSequence=method=="activate"?(long?)request["InputSequence"]??0:0,inputConsumed=method=="activate",capabilities=new Dictionary<string,string>{{"desk.read","accepted"},{"time.read","accepted"}},data=method=="data"?new{status="available",value=new{tick=ticks}}:null,layout=method=="layoutRead"?new{revision=0,icons=new{},components=new{}}:null})});if(method=="activate")return new JObject{["activated"]=request};continue;}
                    return value;
                }if(process.HasExited)throw new Exception("Player exit: "+await errors);await Task.Delay(20);}throw new TimeoutException("official wire: "+string.Join("\n",log.TakeLast(8)));}
            }
            finally{if(!process.HasExited){await Send(new LivelyCloseCmd());process.StandardInput.Close();try{await process.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(5));}catch(TimeoutException){process.Kill(true);await process.WaitForExitAsync();}}await reader;}
            async Task Send(IpcMessage value){await process.StandardInput.WriteLineAsync(JsonConvert.SerializeObject(value));await process.StandardInput.FlushAsync();}
            void Require(bool ok,string message){if(!ok)throw new Exception(message+"; "+string.Join("\n",log.TakeLast(6)));}
        }
        finally{var temp=Path.GetFullPath(Path.GetTempPath()).TrimEnd('\\')+"\\";if(!root.FullName.StartsWith(temp,StringComparison.OrdinalIgnoreCase))throw new Exception("fixture outside temp");
            for(var i=0;i<20&&Directory.Exists(root.FullName);i++){try{root.Delete(true);}catch(Exception e)when(e is IOException or UnauthorizedAccessException){if(i==19)Console.Error.WriteLine("official fixture cleanup pending: "+root.FullName);else await Task.Delay(500);}}}
    }
}
