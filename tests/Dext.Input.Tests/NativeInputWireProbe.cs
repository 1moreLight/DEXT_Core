using System.Collections.Concurrent;
using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;
using System.Runtime.InteropServices;
using Dext.Core.Rooms;
using Lively.Common.Helpers;
using Lively.Common.Helpers.Pinvoke;
using Lively.Common.Extensions;
using Lively.Models.Message;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

internal static class NativeInputWireProbe
{
    [DllImport("user32.dll")] private static extern bool SetProcessDpiAwarenessContext(IntPtr context);
    public static async Task Run(string player)
    {
        if(!SetProcessDpiAwarenessContext(new IntPtr(-4)))throw new Exception("Input probe must use the same PerMonitorV2 context as Core");
        var root=Directory.CreateTempSubdirectory("Dext-v3-input-wire-");
        try
        {
            Directory.CreateDirectory(Path.Combine(root.FullName,"content","scene"));
            var author="<!doctype html><script>parent.postMessage({type:'dext:v3-native-request',method:'activate'},'*')</script>";
            File.WriteAllText(Path.Combine(root.FullName,"content","scene","index.html"),author);
            File.WriteAllText(Path.Combine(root.FullName,"index.html"),"<!doctype html><script src=main.js defer></script>");
            File.WriteAllText(Path.Combine(root.FullName,"main.js"),"""
                let context,snapshot;
                const send=value=>chrome.webview.postMessage(JSON.stringify({type:'saveRoom',room:value}));
                const request=extra=>({type:'dext:v3-native-request',protocolVersion:1,requestId:'probe',runtimeGeneration:context.runtimeGeneration,sessionId:context.sessionId,revision:snapshot.revision,...extra});
                const native=value=>chrome.webview.postMessage(JSON.stringify(value));
                chrome.webview.addEventListener('message',event=>{
                  const d=event.data;
                  if(d.type==='dext:v3-runtime'){context=d;send({context:d.runtimeGeneration});}
                  if(d.type==='dext:v3-session'){snapshot=d;send({snapshot:d.revision});}
                  if(d.type==='dext:v3-native-response')send({reply:d.requestId,capabilities:d.capabilities,layout:d.layout});
                  if(d.type==='dext:system-control-result'){
                    const command=d.permissions?.command;
                    if(command==='geometry')send({metrics:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio}});
                    if(command==='geometry')native(request({method:'geometry',geometryVersion:1,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},buttons:[{consumer:'scene',button:'open',x:.1,y:.1,width:.2,height:.2,tabIndex:0}]}));
                    if(command==='startupComplete')native(request({method:'startupComplete',lifecycleRevision:snapshot.lifecycle.revision}));
                    if(command==='capabilities')native(request({method:'capabilities',consumer:'slot.start'}));
                    if(command==='invalidCapabilities')for(const extra of [{capabilities:['binding.launch']},{consumer:4},{consumer:'scene',revision:snapshot.revision+1}])native({...request({method:'capabilities',consumer:'slot.start'}),...extra});
                    if(command==='pageReady'){native({type:'dext:v3-page-ready'});native({type:'dext:v3-page-ready'});}
                    if(command==='layoutRead')native(request({method:'layoutRead'}));
                    if(command==='layoutSave')native(request({method:'layoutSave',layoutRevision:0,change:{kind:'icon',id:'icon-1',deskId:'home',x:240,y:360}}));
                    if(command==='invalidLayout')for(const change of [{kind:'icon',id:'icon-1',deskId:'home',x:1825,y:0},{kind:'widget',id:'w',x:0,y:0,width:0,height:100},{kind:'dock',id:'w',x:0,y:0,width:100,height:100}])native(request({method:'layoutSave',layoutRevision:0,change}));
                    if(command==='activate')native(request({method:'activate',geometryVersion:1,inputSequence:0,consumer:'scene',button:'open'}));
                    if(command==='invalid')for(const extra of [{runtimeGeneration:1.2},{revision:0},{ticket:'fake'},{consumer:4}])native({...request({method:'activate',geometryVersion:1,inputSequence:0,consumer:'scene',button:'open'}),...extra});
                    if(command==='frame'){const frame=document.createElement('iframe');frame.sandbox='allow-scripts';frame.src=context.resourceBasePath+'scene/index.html';frame.onload=()=>send({frame:true});document.body.append(frame);}
                    if(command==='reload'){location.reload();return;}
                    send({barrier:d.requestId});
                  }
                });
                send({ready:true});
                """);
            var info=new ProcessStartInfo(Path.GetFullPath(player)){UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden,RedirectStandardInput=true,RedirectStandardOutput=true,RedirectStandardError=true,StandardInputEncoding=Encoding.UTF8,WorkingDirectory=Path.GetDirectoryName(Path.GetFullPath(player))!};
            foreach(var arg in new[]{"--wallpaper-url",Path.Combine(root.FullName,"index.html"),"--wallpaper-type","local","--wallpaper-geometry","640x480","--wallpaper-user-data",Path.Combine(root.FullName,"user-data"),"--dext-trusted-host","--dext-native-runtime","--wallpaper-scale","1.5"})info.ArgumentList.Add(arg);
            using var process=Process.Start(info)??throw new Exception("Player did not start");
            var queue=new ConcurrentQueue<JObject>();var log=new ConcurrentQueue<string>();int pauseCompletions=0;IntPtr anchor=IntPtr.Zero;
            var reader=Task.Run(async()=>{while(await process.StandardOutput.ReadLineAsync() is{} line){try{log.Enqueue(line);var value=JObject.Parse(line);var type=(int?)value["Type"];
                if((string?)value["Message"]=="Native pause render complete")Interlocked.Increment(ref pauseCompletions);
                if(type==(int)MessageType.msg_hwnd)anchor=new IntPtr((long)value["Hwnd"]!);
                if(value["RoomJson"] is{} room)queue.Enqueue(JObject.Parse((string)room!));
                if(type==(int)MessageType.msg_room_session_ready)queue.Enqueue(new JObject{["pageReady"]=true});
                if(type==(int)MessageType.msg_room_native_request)queue.Enqueue(new JObject{["native"]=value});
                if(type==(int)MessageType.msg_room_native_invalidated)queue.Enqueue(new JObject{["invalidated"]=value["RuntimeGeneration"]});
            }catch(JsonException){}}});var errors=process.StandardError.ReadToEndAsync();
            try
            {
                Require((bool?)(await Next())["ready"]==true,"ready");
                var playerWindow=process.GetProcessWindow(true);NativeMethods.ShowWindow(playerWindow,4);NativeMethods.SetWindowPos(playerWindow,0,120,120,640,480,0x14);await Task.Delay(300);
                NativeIdleWindowChecks.RunPlayer(playerWindow,process.Id);
                var f=RuntimeMessageChecks.Fixture();var context=RuntimeMessageChecks.ContextMessage(f.Context,f.Snapshot,1);
                var bytes=File.ReadAllBytes(Path.Combine(root.FullName,"content","scene","index.html"));context.Resources=[new(){Path="scene/index.html",Size=bytes.Length,Sha256=Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant()}];
                await Send(context);Require((long?)(await Next())["context"]==1,"context");await Snapshot();Require((long?)(await Next())["snapshot"]==1,"snapshot");
                NativeMethods.GetClientRect(anchor,out var measuredClient);Console.WriteLine($"CLIENT {measuredClient.Left},{measuredClient.Top},{measuredClient.Right},{measuredClient.Bottom}; dpi={NativeMethods.GetDpiForWindow(anchor)}");
                await Command("geometry");Console.WriteLine("MEASURE "+await Next());var geometry=(await Next())["native"];Require((string?)geometry?["Method"]=="geometry","geometry request crossed");await Barrier("geometry");
                var middle=NativeMethods.FindWindowEx(anchor,IntPtr.Zero,"Chrome_WidgetWin_0",null);var input=NativeMethods.FindWindowEx(middle,IntPtr.Zero,"Chrome_WidgetWin_1",null);
                Require(DextNativeInputWindow.TryMeasure(process.GetProcessWindow(true),anchor,input,process.Id,out var bounds,out var dpi),"actual Player window mapping");
                Require((int?)geometry!["PixelWidth"]==bounds.Width && (int?)geometry["PixelHeight"]==bounds.Height,"Player and Core native viewport agree");
                Console.WriteLine($"PASS native ReleasePlayer geometry IPC and actual HWND mapping at explicit scale 1.5 ({bounds.Width}x{bounds.Height}, dpi {dpi})");
                await Command("pageReady");Require((bool?)(await Next())["pageReady"]==true,"ready once per document");await Barrier("pageReady");
                await Command("startupComplete");Require((long?)(await Next())["native"]?["LifecycleRevision"]==1,"exact startup completion phase reaches Core");await Barrier("startupComplete");
                Console.WriteLine("PASS native ReleasePlayer forwards current-phase startup completion and deduplicates document ready");
                await Command("capabilities");var capQuery=(await Next())["native"];
                Require((string?)capQuery?["Method"]=="capabilities" && (string?)capQuery?["Consumer"]=="slot.start","declared consumer query reaches Core");await Barrier("capabilities");
                await Command("invalidCapabilities");await Barrier("invalidCapabilities");
                await Send(new LivelyMessageRoomNativeResponse{RuntimeGeneration=1,SessionId=context.SessionId,PayloadJson=JsonConvert.SerializeObject(new{type="dext:v3-native-response",requestId="capabilities",capabilities=new Dictionary<string,string>{{"binding.launch","missingPermission"}}})});
                var capReply=await Next();Require((string?)capReply["reply"]=="capabilities" && (string?)capReply["capabilities"]?["binding.launch"]=="missingPermission","Core capability state reaches official host");
                Console.WriteLine("PASS native ReleasePlayer forwards exact consumer capability query and Core reply; rejects forged capability lists and stale identities");
                await Command("layoutRead");Require((string?)(await Next())["native"]?["Method"]=="layoutRead","private layout read reaches Core");await Barrier("layoutRead");
                await Command("layoutSave");var layoutSave=(await Next())["native"];Require((string?)layoutSave?["Method"]=="layoutSave" && (long?)layoutSave["LayoutRevision"]==0 &&
                    (string?)layoutSave["LayoutChange"]?["Id"]=="icon-1" && (double?)layoutSave["LayoutChange"]?["X"]==240,"closed saved layout crosses Player IPC");await Barrier("layoutSave");
                await Command("invalidLayout");await Barrier("invalidLayout");
                Console.WriteLine("PASS native ReleasePlayer private layout read/save and independent revision; invalid item shape and coordinates are rejected (Core replies are fixture)");
                await Command("activate");Require((string?)(await Next())["native"]?["Method"]=="activate","public activation request");await Barrier("activate");
                await Command("invalid");await Barrier("invalid");await Command("frame");await Barrier("frame");Require((bool?)(await Next())["frame"]==true,"sandbox frame loaded");
                await Reply(1,"current");Require((string?)(await Next())["reply"]=="current","authorized reply");
                await Reply(2,"stale");await Command("barrier");await Barrier("barrier");
                Console.WriteLine("PASS native ReleasePlayer rejects malformed/current-context mismatches and sandbox direct requests; only current replies reach top host");
                var pauseBefore=Volatile.Read(ref pauseCompletions);
                await Send(new LivelySuspendCmd());await WaitPauseComplete(pauseBefore);
                await Reply(1,"paused");
                await Send(new LivelyMessageRoomNativeResponse{Method="layoutRead",RuntimeGeneration=1,SessionId=context.SessionId,PayloadJson=JsonConvert.SerializeObject(new{type="dext:v3-native-response",requestId="paused-layout",layout=new{revision=4,icons=new{},components=new{}}})});
                await Send(new LivelyResumeCmd());
                var resumeContext=false;var resumeSnapshot=false;var deferredLayout=false;
                for(var i=0;i<3;i++){
                    var receipt=await Next();
                    if((long?)receipt["context"]==1){Require(!resumeContext,"duplicate resume context");resumeContext=true;}
                    else if((long?)receipt["snapshot"]==1){Require(!resumeSnapshot,"duplicate resume snapshot");resumeSnapshot=true;}
                    else if((string?)receipt["reply"]=="paused-layout" && (long?)receipt["layout"]?["revision"]==4){Require(!deferredLayout,"duplicate deferred layout");deferredLayout=true;}
                    else Require(false,"unexpected deferred receipt "+receipt);
                }
                Require(resumeContext && resumeSnapshot && deferredLayout,"resume replays current facts and deferred private layout");
                await Command("barrier");await Barrier("barrier");
                Console.WriteLine("PASS native suspend defers safe layout metadata until resume; ordinary paused replies remain suppressed");

                await Send(new LivelyMessageRoomRuntimeRevoke{RuntimeGeneration=1,SessionId=context.SessionId,RoomId=context.RoomId,InstallationStamp=context.InstallationStamp});
                await Reply(1,"revoked");await Command("activate");await Barrier("activate");
                Console.WriteLine("PASS native ReleasePlayer suspension/revoke suppress stale input responses and revoked activation requests");
                context.RuntimeGeneration=2;await Send(context);Require((long?)(await Next())["context"]==2,"new context");await Snapshot();Require((long?)(await Next())["snapshot"]==1,"new snapshot");
                await Command("reload");Require((long?)(await Next())["invalidated"]==2,"navigation revokes Core candidate");Require((bool?)(await Next())["ready"]==true,"reload ready");
                await Reply(2,"old-document");await Command("barrier");await Barrier("barrier");await Command("pageReady");Require((bool?)(await Next())["pageReady"]==true,"reload permits one fresh ready");await Barrier("pageReady");Console.WriteLine("PASS actual native navigation emits input invalidation and rejects old-document replies");
                async Task WaitPauseComplete(int before){
                    var until=DateTime.UtcNow.AddSeconds(10);
                    while(DateTime.UtcNow<until){
                        if(Volatile.Read(ref pauseCompletions)>before)return;
                        if(process.HasExited)throw new Exception("Player exited before native pause complete; "+string.Join("\n",log.TakeLast(15)));
                        await Task.Delay(20);
                    }
                    throw new TimeoutException("Native pause render completion; "+string.Join("\n",log.TakeLast(15)));
                }
                async Task Snapshot(){var s=RoomSessionPlayerMessage.Create(f.Snapshot with{Lifecycle=new(RoomLifecycleStage.Starting,false,false,1)},["home","focus"]);s.RuntimeGeneration=context.RuntimeGeneration;await Send(s);}
                async Task Reply(long generation,string id)=>await Send(new LivelyMessageRoomNativeResponse{RuntimeGeneration=generation,SessionId=context.SessionId,PayloadJson=JsonConvert.SerializeObject(new{type="dext:v3-native-response",requestId=id})});
            }
            finally{if(!process.HasExited){await Send(new LivelyCloseCmd());process.StandardInput.Close();try{await process.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(5));}catch(TimeoutException){process.Kill(true);await process.WaitForExitAsync();}}await reader;}
            async Task Send(IpcMessage value){await process.StandardInput.WriteLineAsync(JsonConvert.SerializeObject(value));await process.StandardInput.FlushAsync();}
            async Task Command(string command)=>await Send(new LivelyMessageSystemControlResponse{RequestId=command,PermissionsJson=JsonConvert.SerializeObject(new{command})});
            async Task Barrier(string id)=>Require((string?)(await Next())["barrier"]==id,"unexpected traffic before barrier "+id);
            async Task<JObject> Next(){var stop=DateTime.UtcNow.AddSeconds(20);while(DateTime.UtcNow<stop){if(queue.TryDequeue(out var v))return v;if(process.HasExited)throw new Exception("Player exit "+process.ExitCode+": "+await errors+"; "+string.Join("\n",log.TakeLast(15)));await Task.Delay(20);}throw new TimeoutException("native input wire: "+string.Join("\n",log.TakeLast(8)));}
            void Require(bool ok,string message){if(!ok)throw new Exception(message+"; "+string.Join("\n",log.TakeLast(8)));}
        }
        finally
        {
            var temp=Path.GetFullPath(Path.GetTempPath()).TrimEnd('\\')+"\\";if(!root.FullName.StartsWith(temp,StringComparison.OrdinalIgnoreCase))throw new Exception("fixture outside temp");
            for(var i=0;i<20&&Directory.Exists(root.FullName);i++){try{root.Delete(true);}catch(Exception e)when(e is IOException or UnauthorizedAccessException){if(i==19)Console.Error.WriteLine("input fixture cleanup pending: "+root.FullName);else await Task.Delay(500);}}
        }
    }
}
