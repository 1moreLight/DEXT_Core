using System.Collections.Concurrent;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using Dext.Core.Rooms;
using Lively.Common.Extensions;
using Lively.Common.Helpers;
using Lively.Common.Helpers.Pinvoke;
using Lively.Models.Message;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

internal static class AuthorVisualWireProbe
{
    [DllImport("user32.dll")] private static extern bool SetProcessDpiAwarenessContext(IntPtr context);
    internal static async Task Run(string player,string hostDirectory,string sampleDirectory)
    {
        if(!SetProcessDpiAwarenessContext(new IntPtr(-4)))throw new Exception("Author probe requires PerMonitorV2");
        var root=Directory.CreateTempSubdirectory("Dext-v3-author-visual-");
        try
        {
            foreach(var file in new[]{"index.html","main.js","style.css","geometry.js","layout-model.js","runtime-model.js","native-host.js","frame-host.js","media-host.js","playback-host.js","dom-host.js"})
                File.Copy(Path.Combine(Path.GetFullPath(hostDirectory),file),Path.Combine(root.FullName,file));
            var manifest=JObject.Parse(File.ReadAllText(Path.Combine(sampleDirectory,"room.json")));
            var content=Directory.CreateDirectory(Path.Combine(root.FullName,"content"));
            foreach(var resource in manifest["resources"]!.Values<string>()){
                var target=Path.Combine(content.FullName,resource!);Directory.CreateDirectory(Path.GetDirectoryName(target)!);
                File.Copy(Path.Combine(sampleDirectory,resource!),target);
            }
            // Appended observations only; the sample's production scripts remain.
            File.AppendAllText(Path.Combine(content.FullName,"widget","main.js"),"""
                ;Dext.ready().then(()=>{
                  const report=()=>parent.postMessage({probeWidget:true,instanceId:document.documentElement.dataset.instanceId,reads:Number(document.documentElement.dataset.readoutCount||0),width:innerWidth,height:innerHeight},'*');
                  Dext.desk.subscribe(report);Dext.data.subscribe('time.read',report);
                });
                """);
            File.AppendAllText(Path.Combine(root.FullName,"main.js"),"""
                ;(()=>{
                  let widget=null;const send=v=>chrome.webview.postMessage(JSON.stringify({type:'saveRoom',room:v}));
                  addEventListener('message',e=>{if(!e.data?.probeWidget)return;const frame=document.querySelector('[data-consumer="component.instrument"] iframe');if(frame?.contentWindow===e.source)widget=e.data;});
                  chrome.webview.addEventListener('message',e=>{
                    const p=e.data?.permissions;if(e.data.type!=='dext:system-control-result'||!p?.command)return;
                    const stop=performance.now()+8000,poll=()=>{
                      const d=dextRuntimeDiagnostics(),g=d.runtime?.groups?.shared?.matrix,y=g?.[5];
                      const ready=d.revision===p.revision&&d.runtime?.inputReady&&d.runtime?.buttonRegionCount===1&&widget?.reads>0;
                      const position=p.position==='moving'?y>200&&y<650:p.position==='top'?Math.abs(y)<.001:p.position==='bottom'?Math.abs(y-800)<.001:true;
                      if(ready&&position||performance.now()>stop){
                        const r=document.querySelector('[data-consumer="component.instrument"]').getBoundingClientRect();
                        send({report:p.command,diagnostics:d,widget,rect:{x:r.left/innerWidth,y:r.top/innerHeight,width:r.width/innerWidth,height:r.height/innerHeight},iconRects:[...document.querySelectorAll('.dext-v3-icon')].map(n=>{const b=n.getBoundingClientRect();return{x:b.left/innerWidth,y:b.top/innerHeight};}),focusVisible:!!document.querySelector('.dext-v3-focus:not([hidden])'),focusPoints:[...document.querySelectorAll('.dext-v3-focus>polygon')].map(n=>n.getAttribute('points'))});
                      }else setTimeout(poll,10);
                    };poll();
                  });
                })();
                """);
            var info=new ProcessStartInfo(Path.GetFullPath(player)){UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden,RedirectStandardInput=true,RedirectStandardOutput=true,RedirectStandardError=true,StandardInputEncoding=Encoding.UTF8,WorkingDirectory=Path.GetDirectoryName(Path.GetFullPath(player))!};
            foreach(var arg in new[]{"--wallpaper-url",Path.Combine(root.FullName,"index.html"),"--wallpaper-type","local","--wallpaper-geometry","1920x1080","--wallpaper-user-data",Path.Combine(root.FullName,"user-data"),"--dext-trusted-host","--dext-native-runtime","--wallpaper-scale","1"})info.ArgumentList.Add(arg);
            using var process=Process.Start(info)??throw new Exception("Player did not start");
            var queue=new ConcurrentQueue<JObject>();var log=new ConcurrentQueue<string>();var geometries=0;var data=0;var actions=0;IntPtr anchor=IntPtr.Zero;
            var reader=Task.Run(async()=>{while(await process.StandardOutput.ReadLineAsync() is{} line){log.Enqueue(line);try{
                var v=JObject.Parse(line);var type=(int?)v["Type"];
                if(type==(int)MessageType.msg_hwnd)anchor=new((long)v["Hwnd"]!);
                if(type==(int)MessageType.msg_room_session_ready)queue.Enqueue(new(){["ready"]=true});
                if(type==(int)MessageType.msg_room_native_request)queue.Enqueue(new(){["native"]=v});
                if(type==(int)MessageType.msg_room_native_sample)queue.Enqueue(new(){["sample"]=v});
                if(type==(int)MessageType.msg_room_transition_complete)queue.Enqueue(new(){["complete"]=v});
                if(v["RoomJson"] is{} room)queue.Enqueue(JObject.Parse((string)room!));
            }catch(JsonException){}}});
            var errors=process.StandardError.ReadToEndAsync();
            var f=RuntimeMessageChecks.Fixture();var context=RuntimeMessageChecks.ContextMessage(f.Context,f.Snapshot,1);manifest["id"]=context.RoomId;
            context.ManifestJson=manifest.ToString(Formatting.None);
            context.Resources=manifest["resources"]!.Values<string>().Select(path=>{
                var bytes=File.ReadAllBytes(Path.Combine(content.FullName,path!));
                return new LivelyRoomRuntimeResource{Path=path,Size=bytes.Length,Sha256=Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant()};
            }).ToArray();
            try
            {
                Require((bool?)(await Next())["ready"]==true,"actual author host ready");
                var window=process.GetProcessWindow(true);NativeMethods.ShowWindow(window,4);NativeMethods.SetWindowPos(window,0,120,120,1920,1080,0x14);await Task.Delay(200);
                var foreground=NativeMethods.GetForegroundWindow();
                await Send(context);await Snapshot(1,"overview");var initial=await Report("initial",1,"bottom");
                var document=(string)initial["widget"]!["instanceId"]!;var dimensions=initial["widget"]!.DeepClone();
                Require(Math.Abs((double)initial["rect"]!["y"]!-800d/1080)<.001&&Math.Abs((double)initial["rect"]!["height"]!-280d/1080)<.001,"initial bottom dashboard");
                Require((int?)dimensions["width"]==1600&&(int?)dimensions["height"]==280,"stable authored logical viewport");
                var transition=Guid.NewGuid();await Snapshot(2,"overview","detail",transition);
                var moving=await Report("moving",2,"moving");var geometryCount=geometries;var version=(long)moving["diagnostics"]!["runtime"]!["inputVersion"]!;
                var middle=NativeMethods.FindWindowEx(anchor,IntPtr.Zero,"Chrome_WidgetWin_0",null);
                var input=NativeMethods.FindWindowEx(middle,IntPtr.Zero,"Chrome_WidgetWin_1",null);
                Require(DextNativeInputWindow.TryMeasure(window,anchor,input,process.Id,out var bounds,out var dpi),"owned actual input viewport");
                await Send(new LivelyMessageRoomNativePointer{RuntimeGeneration=1,SessionId=context.SessionId,Revision=2,GeometryVersion=version,GestureId=7,IssuedAt=Stopwatch.GetTimestamp(),InputHandle=input.ToInt64(),Kind="focus",OriginX=bounds.X,OriginY=bounds.Y,PixelWidth=bounds.Width,PixelHeight=bounds.Height,Dpi=dpi,X=bounds.X,Y=bounds.Y,Key=9});
                var sample=(await Next())["sample"]!.ToObject<LivelyMessageRoomNativeSample>()!;
                var entry=sample.Buttons.Single(e=>e.Consumer=="component.instrument"&&e.EntryId=="button.navigate");
                Require(entry.Polygons.Length>0,"author moving shared widget has actual painted sample");
                await Send(new LivelyMessageRoomNativeResponse{RuntimeGeneration=1,SessionId=context.SessionId,PayloadJson=JsonConvert.SerializeObject(new{type="dext:v3-native-event",runtimeGeneration=1,sessionId=context.SessionId,revision=2,geometryVersion=version,kind="focus",consumer=entry.Consumer,button=entry.Button,entryId=entry.EntryId})});
                var focused=await Report("focused",2);await Task.Delay(80);var later=await Report("later",2);
                Require((bool?)focused["focusVisible"]==true&&(bool?)later["focusVisible"]==true&&!JToken.DeepEquals(focused["focusPoints"],later["focusPoints"]),"author matrix keeps shared widget focus moving");
                Require(geometries==geometryCount&&(long?)later["diagnostics"]?["runtime"]?["inputVersion"]==version&&actions==0,"author visual frames do not republish Core geometry or activate");
                Require((string?)later["widget"]?["instanceId"]==document,"shared widget document retained during motion");
                Require(!JToken.DeepEquals(moving["iconRects"],later["iconRects"])&&(double?)moving["rect"]?["y"]!=(double?)later["rect"]?["y"],"actual ordinary icons and instrument move with authored groups");
                Console.WriteLine("PASS actual ReleasePlayer/production SDK author matrices: moving dashboard/icons and SVG focus, actual current sample, stable structural version, zero frame Core geometry/action traffic");
                var finished=await Next();Require((string?)finished["complete"]?["TransitionId"]==transition.ToString(),"author reports completion for Core commit");
                await Snapshot(3,"detail");var full=await Report("full",3,"top");
                Require(Math.Abs((double)full["rect"]!["height"]!-1)<.001,"same dashboard becomes full page");
                var backId=Guid.NewGuid();await Snapshot(4,"detail","overview",backId);var back=await Next();Require((string?)back["complete"]?["TransitionId"]==backId.ToString(),"return reports one completion");
                await Snapshot(5,"overview");var returned=await Report("returned",5,"bottom");
                foreach(var report in new[]{full,returned})Require((string?)report["widget"]?["instanceId"]==document&&(int?)report["widget"]?["width"]==1600&&(int?)report["widget"]?["height"]==280,"same document and logical viewport after commits");
                Require(data>=1&&NativeMethods.GetForegroundWindow()==foreground,"live readout and unchanged foreground");
                Console.WriteLine("PASS actual continuous sample: same instrument document/logical viewport bottom -> full page -> bottom, two author completions, Core-only commits, live data, unchanged foreground; Core packets/replies/raw OS keys remain fixture");
            }
            finally{if(!process.HasExited){await Send(new LivelyCloseCmd());process.StandardInput.Close();try{await process.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(5));}catch(TimeoutException){process.Kill(true);await process.WaitForExitAsync();}}await reader;}
            async Task Send(IpcMessage value){await process.StandardInput.WriteLineAsync(JsonConvert.SerializeObject(value));await process.StandardInput.FlushAsync();}
            async Task Snapshot(long revision,string current,string? target=null,Guid? transition=null){
                var snapshot=f.Snapshot with{Revision=revision,CurrentDeskId=current,TargetDeskId=target,TransitionId=transition,DeadlineUtc=transition!=null?DateTimeOffset.UtcNow.AddSeconds(5):null};
                var value=RoomSessionPlayerMessage.Create(snapshot,["overview","detail"]);value.RuntimeGeneration=1;await Send(value);
            }
            async Task<JObject> Report(string command,long revision,string? position=null){
                await Send(new LivelyMessageSystemControlResponse{RequestId=command,PermissionsJson=JsonConvert.SerializeObject(new{command,revision,position})});
                var value=await Next();Require((string?)value["report"]==command,"report "+command);return value;
            }
            async Task<JObject> Next(){
                var stop=DateTime.UtcNow.AddSeconds(20);
                while(DateTime.UtcNow<stop){
                    if(queue.TryDequeue(out var value)){
                        if(value["native"] is{} request){
                            var method=(string?)request["Method"];if(method=="geometry")geometries++;if(method=="data")data++;if(method is "activate" or "authorInput")actions++;
                            await Send(new LivelyMessageRoomNativeResponse{Method=method,RuntimeGeneration=1,SessionId=context.SessionId,PayloadJson=JsonConvert.SerializeObject(new{
                                type="dext:v3-native-response",requestId=(string?)request["RequestId"],runtimeGeneration=1,sessionId=context.SessionId,revision=(long?)request["Revision"],status="accepted",
                                capabilities=new Dictionary<string,string>{{"desk.read","accepted"},{"time.read","accepted"}},
                                data=method=="data"?new{status="available",value=new{tick=data}}:null,
                                layout=method=="layoutRead"?new{revision=0,icons=new{},components=new{}}:null})});continue;
                        }return value;
                    }
                    if(process.HasExited)throw new Exception("Player exit: "+await errors);await Task.Delay(10);
                }throw new TimeoutException("author visual: "+string.Join("\n",log.TakeLast(8)));
            }
            void Require(bool ok,string message){if(!ok)throw new Exception(message+"; "+string.Join("\n",log.TakeLast(5)));}
        }
        finally{
            var temp=Path.GetFullPath(Path.GetTempPath()).TrimEnd('\\')+"\\";
            if(!root.FullName.StartsWith(temp,StringComparison.OrdinalIgnoreCase))throw new Exception("fixture outside temp");
            for(var i=0;i<20&&Directory.Exists(root.FullName);i++){try{root.Delete(true);}catch(Exception e)when(e is IOException or UnauthorizedAccessException){if(i==19)Console.Error.WriteLine("author visual cleanup pending: "+root.FullName);else await Task.Delay(500);}}
        }
    }
}
