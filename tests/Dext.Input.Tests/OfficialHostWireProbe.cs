using System.Collections.Concurrent;
using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;
using System.Runtime.InteropServices;
using Lively.Common.Extensions;
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
            foreach(var file in new[]{"index.html","main.js","style.css","runtime-model.js","native-host.js","frame-host.js","media-host.js","playback-host.js","dom-host.js"})
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
                  const report=command=>send({report:command,diagnostics:dextRuntimeDiagnostics(),iframeCount:document.querySelectorAll('iframe').length,documents:[...documents.values()],values:[...values]});
                  addEventListener('message',e=>{const owned=[...document.querySelectorAll('iframe')].some(f=>f.contentWindow===e.source);if(!owned)return;
                    if(e.data?.authorDocument)documents.set(e.data.consumer,e.data);if(e.data?.authorValue)values.set(e.data.consumer,e.data.tick);});
                  const original=dextNativePlaybackChanged;window.dextNativePlaybackChanged=value=>{const accepted=original(value);send({playback:value.paused,accepted,diagnostics:dextRuntimeDiagnostics()});return accepted;};
                  chrome.webview.addEventListener('message',e=>{const command=e.data?.permissions?.command,expectedRevision=e.data?.permissions?.revision;if(e.data.type!=='dext:system-control-result'||!command)return;
                    const stop=performance.now()+8000;const poll=()=>{const d=dextRuntimeDiagnostics(),ready=command==='revoked'?d.runtime===null:d.revision===expectedRevision&&d.runtime?.inputReady&&documents.size===2&&values.size===2;
                      if(ready||performance.now()>stop)report(command);else setTimeout(poll,20);};poll();});
                })();
                """);
            var info=new ProcessStartInfo(Path.GetFullPath(player)){UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden,RedirectStandardInput=true,RedirectStandardOutput=true,RedirectStandardError=true,StandardInputEncoding=Encoding.UTF8,WorkingDirectory=Path.GetDirectoryName(Path.GetFullPath(player))!};
            foreach(var arg in new[]{"--wallpaper-url",Path.Combine(root.FullName,"index.html"),"--wallpaper-type","local","--wallpaper-geometry","640x480","--wallpaper-user-data",Path.Combine(root.FullName,"user-data"),"--dext-trusted-host","--dext-native-runtime","--wallpaper-scale","1.5"})info.ArgumentList.Add(arg);
            using var process=Process.Start(info)??throw new Exception("Player did not start");var queue=new ConcurrentQueue<JObject>();var log=new ConcurrentQueue<string>();var geometries=0;var ticks=0;long expectedRevision=0;
            var reader=Task.Run(async()=>{while(await process.StandardOutput.ReadLineAsync() is{} line){log.Enqueue(line);try{var value=JObject.Parse(line);var type=(int?)value["Type"];
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
                    roomScene=new{entry="author.html",capabilities=new[]{"desk.read","time.read"}},transition=new{type="slide",durationMs=450},
                    buttons=new[]{new{id="next",name="Next",scope="room",action=new{type="desk.next"}}},
                    components=new[]{new{id="shared",role="widget",entry="author.html",placement=new{x=400,y=50,width=200,height=100},capabilities=new[]{"desk.read","time.read"},buttonIds=new[]{"next"}}},
                    desks=new[]{new{id="home",name="Home",icons=Array.Empty<object>(),components=new[]{"shared"},background=new{type="image",src="bg.svg"}},new{id="focus",name="Focus",icons=Array.Empty<object>(),components=new[]{"shared"},background=new{type="image",src="bg.svg"}}}};
                context.ManifestJson=JsonConvert.SerializeObject(manifest);await Send(context);await Snapshot(1,"home");await Command("initial");var initial=await NextReport("initial");
                Require((int?)initial["iframeCount"]==2&&(int?)initial["diagnostics"]?["runtime"]?["frames"]?["count"]==2&&geometries>=1,"actual official DOM mounts scene and shared widget after geometry ack");
                var documents=(JArray)initial["documents"]!;Require(documents.Count==2&&documents.All(d=>(int?)d["readyCount"]==1),"two SDK documents initialize once");
                var transition=Guid.NewGuid();await Snapshot(2,"home","focus",transition);var completion=await Next();Require((string?)completion["complete"]?["TransitionId"]==transition.ToString(),"default DOM transition reports current completion");
                await Command("beforeCommit");var before=await NextReport("beforeCommit");Require((string?)before["diagnostics"]?["runtime"]?["currentDeskId"]=="home","host never commits Desk itself");
                await Snapshot(3,"focus");await Command("committed");var committed=await NextReport("committed");Require((string?)committed["diagnostics"]?["runtime"]?["currentDeskId"]=="focus"&&JToken.DeepEquals(documents,committed["documents"]),"Core commit retains actual iframe documents");
                var queuedTransition=Guid.NewGuid();await Snapshot(4,"focus","home",queuedTransition);await Snapshot(5,"focus","home",queuedTransition,"focus");await Task.Delay(100);await Send(new LivelySuspendCmd());var paused=await Next();
                Require((bool?)paused["playback"]==true&&(bool?)paused["accepted"]==true,"official native pause accepted");await Task.Delay(1100);Require(!queue.Any(q=>q["complete"]!=null),"paused default animation cannot finish");
                await Snapshot(6,"focus","home",queuedTransition,"focus");await Send(new LivelyResumeCmd());var resumed=await Next();Require((bool?)resumed["playback"]==false&&(bool?)resumed["accepted"]==true&&(long?)resumed["diagnostics"]?["revision"]==6,"last Core revision before releasing default animation");
                var resumedCompletion=await Next();Require((string?)resumedCompletion["complete"]?["TransitionId"]==queuedTransition.ToString(),"same queued transition finishes once after resume");await Snapshot(7,"home");await Command("resumed");var restored=await NextReport("resumed");Require(JToken.DeepEquals(documents,restored["documents"]),"queue and private suspend do not rebuild shared documents");
                await Send(new LivelyMessageRoomRuntimeRevoke{RuntimeGeneration=1,SessionId=context.SessionId,RoomId=context.RoomId,InstallationStamp=context.InstallationStamp});await Command("revoked");var revoked=await NextReport("revoked");Require((int?)revoked["iframeCount"]==0&&revoked["diagnostics"]?["runtime"]?.Type==JTokenType.Null,"revoke disposes all official DOM frames");
                Console.WriteLine("PASS actual official index/main/dom/native/frame/media/SDK in ReleasePlayer: geometry ack, continuous readouts, two retained documents, Core-only commit, queue without restart, native pause/latest revision, revoke disposal (Core replies are fixture)");
                async Task Snapshot(long revision,string current,string? target=null,Guid? transitionId=null,string? queued=null){var message=RoomSessionPlayerMessage.Create(f.Snapshot with{Revision=revision,CurrentDeskId=current,TargetDeskId=target,TransitionId=transitionId,QueuedDeskId=queued,DeadlineUtc=transitionId!=null?DateTimeOffset.UtcNow.AddSeconds(5):null},["home","focus"]);expectedRevision=revision;message.RuntimeGeneration=1;await Send(message);}
                async Task Command(string command)=>await Send(new LivelyMessageSystemControlResponse{RequestId=command,PermissionsJson=JsonConvert.SerializeObject(new{command,revision=expectedRevision})});
                async Task<JObject> NextReport(string command){var value=await Next();Require((string?)value["report"]==command,"report "+command);return value;}
                async Task<JObject> Next(){var stop=DateTime.UtcNow.AddSeconds(25);while(DateTime.UtcNow<stop){if(queue.TryDequeue(out var value)){
                    if(value["native"] is{} request){var method=(string?)request["Method"];var consumer=(string?)request["Consumer"];Require(method is "invalidateGeometry" or "geometry" or "capabilities" or "data","official permitted native request");if(method=="geometry")geometries++;
                        if(method=="capabilities"||method=="data")Require(consumer is "scene" or "component.shared","fixed actual consumer");
                        if(method=="data"){Require((string?)request["Capability"]=="time.read","declared actual data");ticks++;}
                        await Send(new LivelyMessageRoomNativeResponse{RuntimeGeneration=1,SessionId=context.SessionId,PayloadJson=JsonConvert.SerializeObject(new{type="dext:v3-native-response",requestId=(string?)request["RequestId"],runtimeGeneration=1,sessionId=context.SessionId,revision=(long?)request["Revision"],status="accepted",capabilities=new Dictionary<string,string>{{"desk.read","accepted"},{"time.read","accepted"}},data=method=="data"?new{status="available",value=new{tick=ticks}}:null})});continue;}
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
