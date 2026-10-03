using System.Collections.Concurrent;
using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;
using System.Runtime.InteropServices;
using Lively.Common.Helpers;
using Lively.Common.Helpers.Pinvoke;
using Lively.Common.Extensions;
using Lively.Models.Message;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Dext.Core.Rooms;
internal static class NativeAuthorInputWireProbe
{
    [DllImport("user32.dll")] private static extern bool SetProcessDpiAwarenessContext(IntPtr context);
    public static async Task Run(string player,string sdk,int nativeKey=0)
    {
        if(!SetProcessDpiAwarenessContext(new IntPtr(-4)))throw new Exception("Author wire requires PerMonitorV2");
        var root=Directory.CreateTempSubdirectory("Dext-v3-author-input-wire-");
        try{
            var content=Directory.CreateDirectory(Path.Combine(root.FullName,"content"));File.Copy(Path.GetFullPath(sdk),Path.Combine(content.FullName,"sdk.js"));
            File.WriteAllText(Path.Combine(root.FullName,"index.html"),"<!doctype html><script src=main.js defer></script>");
            File.WriteAllText(Path.Combine(content.FullName,"author.html"),"""
                <!doctype html><style>html,body{margin:0;width:100%;height:100%;background:#163042}</style><script src=sdk.js></script><script>
                const report=value=>parent.postMessage({authorReport:true,...value},'*');
                Dext.ready().then(()=>{
                  addEventListener('mousedown',e=>{
                    const pending=Dext.actions.activate('open');
                    report({kind:'down',trusted:e.isTrusted,key:e.key});
                    pending.then(result=>report({kind:'result',result}),error=>report({kind:'error',code:error.code}));
                  });
                  addEventListener('mouseup',e=>report({kind:'up',trusted:e.isTrusted,key:e.key}));
                  report({kind:'setup'});
                });
                </script>
                """);
            if(nativeKey!=0){
                var authorPath=Path.Combine(content.FullName,"author.html");
                var author=File.ReadAllText(authorPath).Replace("'mousedown'","'keydown'").Replace("'mouseup'","'keyup'")
                    .Replace("const pending=Dext.actions.activate","e.preventDefault();const pending=Dext.actions.activate");
                File.WriteAllText(authorPath,author);
            }
            // This small official fixture preserves the SDK request verbatim.
            // Production DOM/FrameHost routing is covered separately; Core is simulated.
            File.WriteAllText(Path.Combine(root.FullName,"main.js"),"""
                let context,snapshot,frame,counter=0;
                const instance='native-author:1',token='fixture-sdk-token',pending=new Map();
                const send=room=>chrome.webview.postMessage(JSON.stringify({type:'saveRoom',room}));
                addEventListener('message',e=>{
                  if(!frame||e.source!==frame.contentWindow)return;
                  if(e.data?.authorReport){send(e.data);return;}
                  const value=e.data;
                  if(value?.type!=='dext:runtime:request')return;
                  const requestId='n'+(++counter);pending.set(requestId,value);
                  chrome.webview.postMessage(JSON.stringify({type:'dext:v3-native-request',protocolVersion:1,requestId,method:'authorInput',
                    runtimeGeneration:context.runtimeGeneration,sessionId:context.sessionId,revision:snapshot.revision,
                    geometryVersion:1,consumer:'scene',instanceId:instance,requestJson:JSON.stringify(value)}));
                });
                chrome.webview.addEventListener('message',e=>{
                  if(e.data.type==='dext:v3-runtime')context=e.data;
                  if(e.data.type==='dext:v3-native-response'){
                    const original=pending.get(e.data.requestId);if(!original)return;pending.delete(e.data.requestId);
                    frame.contentWindow.postMessage({type:'dext:runtime:response',apiVersion:1,instanceId:instance,sessionId:context.sessionId,
                      token,requestId:original.requestId,ok:true,result:{status:e.data.status}},'*');return;
                  }
                  if(e.data.type==='dext:v3-session'){
                    snapshot=e.data;if(frame)return;
                    frame=document.createElement('iframe');frame.name='dext-native-'+crypto.randomUUID();frame.sandbox='allow-scripts';
                    frame.style.cssText='position:fixed;inset:0;width:100%;height:100%;border:0';
                    chrome.webview.postMessage(JSON.stringify({type:'dext:v3-frame-policy',protocolVersion:1,
                      runtimeGeneration:context.runtimeGeneration,sessionId:context.sessionId,revision:snapshot.revision,
                      frameName:frame.name,consumer:'scene',instanceId:instance,active:true}));
                    frame.onload=()=>frame.contentWindow.postMessage({type:'dext:runtime:init',apiVersion:1,instanceId:instance,
                      sessionId:context.sessionId,token,consumerId:'scene',kind:'scene',capabilities:{},config:{},
                      viewport:{width:640,height:480,dpr:1.5},geometryVersion:1,snapshot},'*');
                    frame.src=context.resourceBasePath+'author.html';document.body.append(frame);
                  }
                });
                send({ready:true});
                """);
            var info=new ProcessStartInfo(Path.GetFullPath(player)){UseShellExecute=false,CreateNoWindow=true,RedirectStandardInput=true,
                RedirectStandardOutput=true,RedirectStandardError=true,StandardInputEncoding=Encoding.UTF8,WorkingDirectory=Path.GetDirectoryName(Path.GetFullPath(player))!};
            foreach(var arg in new[]{"--wallpaper-url",Path.Combine(root.FullName,"index.html"),"--wallpaper-type","local","--wallpaper-geometry","640x480",
                "--wallpaper-user-data",Path.Combine(root.FullName,"user-data"),"--dext-trusted-host","--dext-native-runtime","--wallpaper-scale","1.5"})info.ArgumentList.Add(arg);
            using var process=Process.Start(info)??throw new Exception("Player did not start");
            var reports=new ConcurrentQueue<JObject>();var requests=new ConcurrentQueue<LivelyMessageRoomNativeRequest>();var log=new ConcurrentQueue<string>();IntPtr anchor=IntPtr.Zero;
            var reader=Task.Run(async()=>{while(await process.StandardOutput.ReadLineAsync() is{} line){log.Enqueue(line);try{
                var value=JObject.Parse(line);if((int?)value["Type"]==(int)MessageType.msg_hwnd)anchor=new IntPtr((long)value["Hwnd"]!);
                if(value["RoomJson"] is{} room)reports.Enqueue(JObject.Parse((string)room!));
                if((int?)value["Type"]==(int)MessageType.msg_room_native_request)requests.Enqueue(value.ToObject<LivelyMessageRoomNativeRequest>()!);
            }catch(JsonException){}}});var errors=process.StandardError.ReadToEndAsync();
            try{
                Require((bool?)(await NextReport())["ready"]==true,"official fixture ready");
                var window=process.GetProcessWindow(true);NativeMethods.ShowWindow(window,4);NativeMethods.SetWindowPos(window,0,120,120,640,480,0x14);await Task.Delay(250);
                var f=RuntimeMessageChecks.Fixture();var context=RuntimeMessageChecks.ContextMessage(f.Context,f.Snapshot,1);
                context.Resources=Directory.GetFiles(content.FullName).Select(path=>{var bytes=File.ReadAllBytes(path);return new LivelyRoomRuntimeResource{
                    Path=Path.GetFileName(path),Size=bytes.Length,Sha256=Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant()};}).ToArray();
                context.ManifestJson=JsonConvert.SerializeObject(new{version=3,apiVersion=1,id=context.RoomId,name="Native author",startDesk="home",
                    resources=context.Resources.Select(r=>r.Path).ToArray(),roomScene=new{entry="author.html"},buttons=new[]{new{id="open",name="Open",scope="room"}},
                    components=Array.Empty<object>(),desks=new[]{new{id="home"},new{id="focus"}}});
                await Send(context);var snapshot=RoomSessionPlayerMessage.Create(f.Snapshot,["home","focus"]);snapshot.RuntimeGeneration=1;await Send(snapshot);
                Require((string?)(await NextReport())["kind"]=="setup","production SDK ready");await Task.Delay(300);
                var middle=NativeMethods.FindWindowEx(anchor,IntPtr.Zero,"Chrome_WidgetWin_0",null);
                var input=NativeMethods.FindWindowEx(middle,IntPtr.Zero,"Chrome_WidgetWin_1",null);
                Require(DextNativeInputWindow.TryMeasure(window,anchor,input,process.Id,out var bounds,out var dpi),"owned Player viewport");
                var issued=Stopwatch.GetTimestamp();
                LivelyMessageRoomNativePointer Pointer(string kind)=>new(){RuntimeGeneration=1,SessionId=context.SessionId,Revision=1,GeometryVersion=1,
                    GestureId=7,IssuedAt=issued,InputHandle=input.ToInt64(),Kind=kind,OriginX=bounds.X,OriginY=bounds.Y,PixelWidth=bounds.Width,
                    PixelHeight=bounds.Height,Dpi=dpi,X=bounds.X+bounds.Width/2,Y=bounds.Y+bounds.Height/2,
                    Key=nativeKey,ScanCode=nativeKey==13?28:nativeKey==32?57:0,Consumer=nativeKey==0?null:"scene",
                    Button=nativeKey==0?null:"open",EntryId=nativeKey==0?null:"button.open"};
                var foreground=NativeMethods.GetForegroundWindow();await Send(Pointer("down"));var down=await NextReport();Require((string?)down["kind"]=="down"&&(bool?)down["trusted"]==true,"trusted native DOWN");
                if(nativeKey!=0)Require((string?)down["key"]==(nativeKey==13?"Enter":" "),"wrong native key");
                Require(NativeMethods.GetForegroundWindow()==foreground,"native input changed foreground window");
                await Task.Delay(100);Require(requests.IsEmpty,"author DOWN executed before native UP");
                await Send(Pointer("up"));var stop=DateTime.UtcNow.AddSeconds(8);LivelyMessageRoomNativeRequest? action=null;
                while(action==null&&DateTime.UtcNow<stop){requests.TryDequeue(out action);if(action==null)await Task.Delay(10);}
                Require(action?.Method=="activate"&&action.InputSequence==7&&action.GeometryVersion==1&&action.Consumer=="scene"&&action.Button=="open"&&action.RequestId=="n1",
                    "native witness and original SDK request did not join exactly");
                await Send(new LivelyMessageRoomNativeResponse{Method="activate",RuntimeGeneration=1,SessionId=context.SessionId,PayloadJson=JsonConvert.SerializeObject(new{
                    type="dext:v3-native-response",requestId=action!.RequestId,runtimeGeneration=1,sessionId=context.SessionId,revision=1,status="accepted",
                    inputSequence=7,inputConsumed=true})});
                var up=await NextReport();var result=await NextReport();
                Require((string?)up["kind"]=="up"&&(bool?)up["trusted"]==true&&(string?)result["kind"]=="result"&&(string?)result["result"]?["status"]=="accepted",
                    "trusted UP and SDK result not delivered");
                await Task.Delay(100);Require(requests.IsEmpty,"duplicate native action");
                Console.WriteLine("PASS actual ReleasePlayer + production SDK native "+(nativeKey==0?"mouse":nativeKey==13?"Enter":"Space")+": trusted DOWN waits for same UP, exact root r1 becomes one Core n1/gesture7; Core response and official route are fixtures");
            }
            finally{
                if(!process.HasExited){await Send(new LivelyCloseCmd());process.StandardInput.Close();
                    try{await process.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(5));}catch(TimeoutException){process.Kill(true);await process.WaitForExitAsync();}}
                await reader;
            }
            async Task Send(IpcMessage value){await process.StandardInput.WriteLineAsync(JsonConvert.SerializeObject(value));await process.StandardInput.FlushAsync();}
            async Task<JObject> NextReport(){var stop=DateTime.UtcNow.AddSeconds(10);while(DateTime.UtcNow<stop){
                if(reports.TryDequeue(out var value))return value;if(process.HasExited)throw new Exception("Player exit "+process.ExitCode+": "+await errors+"; "+string.Join("\n",log.TakeLast(5)));await Task.Delay(10);}
                throw new TimeoutException("Author wire: "+string.Join("\n",log.TakeLast(5)));}
            void Require(bool ok,string message){if(!ok)throw new Exception(message+"; "+string.Join("\n",log.TakeLast(5)));}
        }
        finally{
            var absolute=Path.GetFullPath(root.FullName);var temporary=Path.GetFullPath(Path.GetTempPath());
            if(!absolute.StartsWith(temporary,StringComparison.OrdinalIgnoreCase))throw new Exception("Author fixture cleanup outside temporary root");
            for(int i=0;i<100&&Directory.Exists(absolute);i++){try{Directory.Delete(absolute,true);}catch(IOException){await Task.Delay(100);}catch(UnauthorizedAccessException){await Task.Delay(100);}}
            if(Directory.Exists(absolute))throw new IOException("Owned author fixture cleanup incomplete");
        }
    }
}