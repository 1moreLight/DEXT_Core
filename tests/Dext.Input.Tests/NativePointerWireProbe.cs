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

internal static class NativePointerWireProbe
{
    [DllImport("user32.dll")] private static extern bool SetProcessDpiAwarenessContext(IntPtr context);
    public static async Task Run(string player)
    {
        if(!SetProcessDpiAwarenessContext(new IntPtr(-4)))throw new Exception("Pointer probe must use PerMonitorV2");
        var root=Directory.CreateTempSubdirectory("Dext-v3-pointer-wire-");
        try
        {
            Directory.CreateDirectory(Path.Combine(root.FullName,"content"));
            File.WriteAllText(Path.Combine(root.FullName,"index.html"),"<!doctype html><script src=main.js defer></script>");
            var author="""
                <!doctype html><style>html,body{margin:0;width:100%;height:100%;background:#163042}</style><script>
                let session=null,number=0;
                const report=v=>parent.postMessage({pointerReport:true,...v},'*');
                const request=()=>JSON.stringify({type:'dext:runtime:request',apiVersion:1,instanceId:'native-pointer:1',
                  sessionId:session,token:'fixture-sdk-token',requestId:'r'+(++number),method:'actions.activate',params:{buttonId:'open'}});
                addEventListener('message',e=>{if(e.source===parent&&e.data?.pointerSetup){
                  session=e.data.pointerSetup.sessionId;report({setup:true,closed:__dextNativeInputRequestV1(request())===false});
                }});
                for(const kind of ['mousedown','mouseup'])addEventListener(kind,e=>{
                  report({kind,trusted:e.isTrusted,button:e.button,admitted:__dextNativeInputRequestV1(request())});
                });
                </script>
                """;
            File.WriteAllText(Path.Combine(root.FullName,"content","author.html"),author);
            File.WriteAllText(Path.Combine(root.FullName,"main.js"),"""
                let context,snapshot,frame;
                const send=room=>chrome.webview.postMessage(JSON.stringify({type:'saveRoom',room}));
                addEventListener('message',e=>{if(frame&&e.source===frame.contentWindow&&e.data?.pointerReport)send(e.data);});
                chrome.webview.addEventListener('message',e=>{
                  if(e.data.type==='dext:v3-runtime')context=e.data;
                  if(e.data.type==='dext:v3-session'){snapshot=e.data;
                    if(!frame){
                      frame=document.createElement('iframe');frame.name='dext-native-'+crypto.randomUUID();frame.sandbox='allow-scripts';
                      frame.style.cssText='position:fixed;inset:0;width:100%;height:100%;border:0';
                      chrome.webview.postMessage(JSON.stringify({type:'dext:v3-frame-policy',protocolVersion:1,
                        runtimeGeneration:context.runtimeGeneration,sessionId:context.sessionId,revision:snapshot.revision,
                        frameName:frame.name,consumer:'scene',instanceId:'native-pointer:1',active:true}));
                      frame.onload=()=>frame.contentWindow.postMessage({pointerSetup:{sessionId:context.sessionId}},'*');
                      frame.src=context.resourceBasePath+'author.html';document.body.append(frame);
                    }else send({snapshot:snapshot.revision});
                  }
                });
                send({ready:true});
                """);
            var info=new ProcessStartInfo(Path.GetFullPath(player)){UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden,
                RedirectStandardInput=true,RedirectStandardOutput=true,RedirectStandardError=true,StandardInputEncoding=Encoding.UTF8,
                WorkingDirectory=Path.GetDirectoryName(Path.GetFullPath(player))!};
            foreach(var arg in new[]{"--wallpaper-url",Path.Combine(root.FullName,"index.html"),"--wallpaper-type","local","--wallpaper-geometry","640x480",
                "--wallpaper-user-data",Path.Combine(root.FullName,"user-data"),"--dext-trusted-host","--dext-native-runtime","--wallpaper-scale","1.5"})info.ArgumentList.Add(arg);
            using var process=Process.Start(info)??throw new Exception("Player did not start");var queue=new ConcurrentQueue<JObject>();var log=new ConcurrentQueue<string>();IntPtr anchor=IntPtr.Zero;
            var reader=Task.Run(async()=>{while(await process.StandardOutput.ReadLineAsync() is{} line){log.Enqueue(line);try{
                var value=JObject.Parse(line);if((int?)value["Type"]==(int)MessageType.msg_hwnd)anchor=new IntPtr((long)value["Hwnd"]!);
                if(value["RoomJson"] is{} room)queue.Enqueue(JObject.Parse((string)room!));
            }catch(JsonException){}}});var errors=process.StandardError.ReadToEndAsync();
            try
            {
                Require((bool?)(await Next())["ready"]==true,"official fixture ready");
                var window=process.GetProcessWindow(true);NativeMethods.ShowWindow(window,4);NativeMethods.SetWindowPos(window,0,120,120,640,480,0x14);await Task.Delay(250);
                var f=RuntimeMessageChecks.Fixture();var context=RuntimeMessageChecks.ContextMessage(f.Context,f.Snapshot,1);
                var bytes=Encoding.UTF8.GetBytes(author);context.Resources=[new(){Path="author.html",Size=bytes.Length,Sha256=Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant()}];
                context.ManifestJson=JsonConvert.SerializeObject(new{version=3,apiVersion=1,id=context.RoomId,name="Native pointer",startDesk="home",
                    resources=new[]{"author.html"},roomScene=new{entry="author.html"},buttons=new[]{new{id="open",name="Open",scope="room"}},
                    components=Array.Empty<object>(),desks=new[]{new{id="home"},new{id="focus"}}});
                await Send(context);
                var snapshot=RoomSessionPlayerMessage.Create(f.Snapshot,["home","focus"]);snapshot.RuntimeGeneration=1;await Send(snapshot);
                var setup=await Next();Require((bool?)setup["setup"]==true&&(bool?)setup["closed"]==true,"guardian closed before native DOWN");await Task.Delay(400);
                var middle=NativeMethods.FindWindowEx(anchor,IntPtr.Zero,"Chrome_WidgetWin_0",null);
                var input=NativeMethods.FindWindowEx(middle,IntPtr.Zero,"Chrome_WidgetWin_1",null);
                Require(DextNativeInputWindow.TryMeasure(window,anchor,input,process.Id,out var bounds,out var dpi),"owned Player input viewport");
                var x=bounds.X+bounds.Width/2;var y=bounds.Y+bounds.Height/2;
                LivelyMessageRoomNativePointer Packet(string kind,long gesture,long issued)=>new(){RuntimeGeneration=1,SessionId=context.SessionId,Revision=1,
                    GeometryVersion=1,GestureId=gesture,IssuedAt=issued,InputHandle=input.ToInt64(),Kind=kind,OriginX=bounds.X,OriginY=bounds.Y,
                    PixelWidth=bounds.Width,PixelHeight=bounds.Height,Dpi=dpi,X=x,Y=y};
                var first=Stopwatch.GetTimestamp();await Send(Packet("down",1,first));await Send(Packet("up",1,first));
                var down=await Next();var up=await Next();
                Require((string?)down["kind"]=="mousedown"&&(bool?)down["trusted"]==true&&(bool?)down["admitted"]==true,"native arm precedes trusted DOWN");
                Require((string?)up["kind"]=="mouseup"&&(bool?)up["trusted"]==true&&(bool?)up["admitted"]==true,"native UP follows the armed DOWN");
                Console.WriteLine("PASS actual ReleasePlayer private pointer IPC arms the registered author document before trusted DOWN/UP; Core packet is fixture");
                var second=Stopwatch.GetTimestamp();await Send(Packet("down",2,second));Require((bool?)(await Next())["admitted"]==true,"second fresh DOWN");
                await Task.Delay(1550);await Send(Packet("up",2,second));var expired=await Next();
                Require((string?)expired["kind"]=="mouseup"&&(bool?)expired["trusted"]==true&&(bool?)expired["admitted"]==false,"deadline revoke before owned release");
                Console.WriteLine("PASS actual owned Player long press revokes guardian before release; no Core action proof or network test inferred");
            }
            finally{
                if(!process.HasExited){await Send(new LivelyCloseCmd());process.StandardInput.Close();
                    try{await process.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(5));}catch(TimeoutException){process.Kill(true);await process.WaitForExitAsync();}}
                await reader;
            }
            async Task Send(IpcMessage value){await process.StandardInput.WriteLineAsync(JsonConvert.SerializeObject(value));await process.StandardInput.FlushAsync();}
            async Task<JObject> Next(){var stop=DateTime.UtcNow.AddSeconds(12);while(DateTime.UtcNow<stop){
                if(queue.TryDequeue(out var value))return value;if(process.HasExited)throw new Exception("Player exit "+process.ExitCode+": "+await errors+"; "+string.Join("\n",log.TakeLast(5)));await Task.Delay(10);}
                throw new TimeoutException("Pointer wire: "+string.Join("\n",log.TakeLast(5)));}
            void Require(bool ok,string message){if(!ok)throw new Exception(message+"; "+string.Join("\n",log.TakeLast(5)));}
        }
        finally{
            var absolute=Path.GetFullPath(root.FullName);var temporary=Path.GetFullPath(Path.GetTempPath());
            if(!absolute.StartsWith(temporary,StringComparison.OrdinalIgnoreCase))throw new Exception("Fixture cleanup outside temporary root");
            for(int i=0;i<20&&Directory.Exists(absolute);i++){try{Directory.Delete(absolute,true);}catch(IOException){await Task.Delay(100);}catch(UnauthorizedAccessException){await Task.Delay(100);}}
            if(Directory.Exists(absolute))throw new IOException("Owned pointer fixture cleanup incomplete");
        }
    }
}
