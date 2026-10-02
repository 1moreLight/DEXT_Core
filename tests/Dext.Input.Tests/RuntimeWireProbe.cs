using System.Collections.Concurrent;
using System.Diagnostics;
using Dext.Core.Rooms;
using Lively.Models.Message;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

internal static class RuntimeWireProbe
{
    public static async Task Run(string player)
    {
        var fixture=Directory.CreateTempSubdirectory("Dext-v3-runtime-wire-");
        try
        {
            var index=Path.Combine(fixture.FullName,"index.html");
            File.WriteAllText(index,"""
                <!doctype html><title>native v3 runtime IPC probe</title><script>
                const originalQuery = document.querySelectorAll.bind(document);
                document.querySelectorAll = selector => {
                  if(selector === 'video, audio') { const until = performance.now()+120; while(performance.now()<until){} }
                  return originalQuery(selector);
                };
                chrome.webview.addEventListener('message', event => {
                  chrome.webview.postMessage(JSON.stringify({type:'saveRoom',room:{wire:event.data}}));
                  if(event.data.type==='dext:system-control-result' && event.data.permissions?.command==='unknown')
                    chrome.webview.postMessage(JSON.stringify({type:'dext:v3-unknown',target:'must-not-launch'}));
                  if(event.data.type==='dext:system-control-result' && event.data.permissions?.command==='reload') location.reload();
                });
                addEventListener('DOMContentLoaded',()=>chrome.webview.postMessage(JSON.stringify({type:'saveRoom',room:{ready:true}})));
                </script>
                """);
            var info=new ProcessStartInfo(Path.GetFullPath(player)){UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden,
                RedirectStandardInput=true,RedirectStandardOutput=true,RedirectStandardError=true,StandardInputEncoding=System.Text.Encoding.UTF8,WorkingDirectory=Path.GetDirectoryName(Path.GetFullPath(player))!};
            foreach(var arg in new[]{"--wallpaper-url",index,"--wallpaper-type","local","--wallpaper-geometry","640x480",
                "--wallpaper-user-data",Path.Combine(fixture.FullName,"user-data"),"--dext-trusted-host","--wallpaper-pause-media"})info.ArgumentList.Add(arg);
            using var process=Process.Start(info)??throw new Exception("runtime wire Player did not start");
            var messages=new ConcurrentQueue<JObject>();
            var reader=Task.Run(async()=>{while(await process.StandardOutput.ReadLineAsync() is {} line){try{
                var value=JObject.Parse(line);if(value["RoomJson"] is {} payload)messages.Enqueue(JObject.Parse((string)payload!));
                else if((int?)value["Type"]==(int)MessageType.msg_launch)messages.Enqueue(new JObject{["nativeLaunch"]=value});
            }catch(JsonReaderException){}}});
            var errors=process.StandardError.ReadToEndAsync();
            try
            {
                await Until(v=>(bool?)v["ready"]==true);
                var f=RuntimeMessageChecks.Fixture();
                var context=RuntimeMessageChecks.ContextMessage(f.Context,f.Snapshot,1);
                await Send(context);await Expect("dext:v3-runtime",1);
                await Snapshot(1,1);await Expect("dext:v3-session",1,1);
                await Snapshot(99,2);await Barrier();
                Console.WriteLine("PASS ReleasePlayer production Json.NET context precedes matching snapshot; wrong generation rejected");

                await Send(new LivelySuspendCmd());await Snapshot(1,2);await Snapshot(1,3);await Send(new LivelyResumeCmd());await Send(new LivelyResumeCmd());
                await Expect("dext:v3-runtime",1);await Expect("dext:v3-session",1,3);await Barrier();
                Console.WriteLine("PASS ReleasePlayer resume replays context and only the latest suspended snapshot");

                var revoke=new LivelyMessageRoomRuntimeRevoke{RuntimeGeneration=1,SessionId=f.Snapshot.SessionId,RoomId=f.Snapshot.RoomId,InstallationStamp=f.Context.InstallationStamp};
                await Send(new LivelySuspendCmd());await Send(revoke);await Send(new LivelyResumeCmd());
                await Expect("dext:v3-runtime-revoked",1);
                await Send(context);await Snapshot(1,4);await Barrier();
                Console.WriteLine("PASS ReleasePlayer pending revoke survives suspension; retired context and snapshot never revive");

                context=RuntimeMessageChecks.ContextMessage(f.Context,f.Snapshot,2);
                await Send(context);await Expect("dext:v3-runtime",2);await Snapshot(2,4);await Expect("dext:v3-session",2,4);
                await Send(revoke);await Barrier();
                await Send(new LivelyMessageSystemControlResponse{RequestId="reload",PermissionsJson="{\"command\":\"reload\"}"});await Until(v=>(bool?)v["ready"]==true);
                await Send(context);await Snapshot(2,5);await Barrier();
                context=RuntimeMessageChecks.ContextMessage(f.Context,f.Snapshot,3);await Send(context);await Expect("dext:v3-runtime",3);
                await Snapshot(3,5);await Expect("dext:v3-session",3,5);
                Console.WriteLine("PASS ReleasePlayer navigation clears runtime and retains generation tombstone; refreshed generation works");

                await Send(new LivelyMessageSystemControlResponse{RequestId="unknown",PermissionsJson="{\"command\":\"unknown\"}"});
                await Until(v=>(string?)v["wire"]?["requestId"]=="unknown");await Barrier();
                Console.WriteLine("PASS ReleasePlayer unknown v3 command cannot fall through to legacy launch");
                async Task Snapshot(long generation,long revision)
                {var message=RoomSessionPlayerMessage.Create(f.Snapshot with{Revision=revision},["home","focus"]);message.RuntimeGeneration=generation;await Send(message);}
            }
            finally
            {
                if(!process.HasExited){await Send(new LivelyCloseCmd());process.StandardInput.Close();
                    try{await process.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(5));}
                    catch(TimeoutException){process.Kill(entireProcessTree:true);await process.WaitForExitAsync();}}
                await reader;
            }
            async Task Send(IpcMessage message){await process.StandardInput.WriteLineAsync(JsonConvert.SerializeObject(message));await process.StandardInput.FlushAsync();}
            async Task<JObject> Next()
            {
                var stop=DateTime.UtcNow.AddSeconds(15);
                while(DateTime.UtcNow<stop){if(messages.TryDequeue(out var value))return value;if(process.HasExited)throw new Exception("Player exited: "+await errors);await Task.Delay(20);}
                throw new TimeoutException("Player did not deliver runtime IPC message");
            }
            async Task<JObject> Until(Func<JObject,bool> accept){for(var i=0;i<32;i++){var value=await Next();if(value["nativeLaunch"]!=null)throw new Exception("unknown v3 message reached legacy launch");if(accept(value))return value;}throw new Exception("too many unrelated probe replies");}
            async Task Expect(string type,long generation,long? revision=null)
            {
                var value=(await Next())["wire"];
                if((string?)value?["type"]!=type||(long?)value?["runtimeGeneration"]!=generation||revision!=null&&(long?)value?["revision"]!=revision)
                    throw new Exception("unexpected runtime delivery: "+value+" expected "+type+" generation="+generation+" revision="+revision);
                if(type=="dext:v3-runtime" && ((int?)value?["manifest"]?["version"]!=3 || (string?)value?["manifest"]?["name"]!="日期2026-10-03T01:02:03Z" ||
                    (string?)value?["resources"]?[0]?["path"]!="scene/index.html" || (long?)value?["resources"]?[0]?["size"]!=12))
                    throw new Exception("actual Player lost manifest or inventory across Json.NET: " + value);
            }
            async Task Barrier()
            {
                var id=Guid.NewGuid().ToString();await Send(new LivelyMessageSystemControlResponse{RequestId=id});
                var value=await Next();if((string?)value["wire"]?["requestId"]!=id)throw new Exception("rejected or stale traffic reached the page: "+value);
            }
        }
        finally
        {
            var temp=Path.GetFullPath(Path.GetTempPath()).TrimEnd(Path.DirectorySeparatorChar)+Path.DirectorySeparatorChar;
            if(!fixture.FullName.StartsWith(temp,StringComparison.OrdinalIgnoreCase))throw new Exception("fixture outside temp");
            for(var i=0;i<20&&Directory.Exists(fixture.FullName);i++){try{fixture.Delete(true);}catch(Exception e)when(e is IOException or UnauthorizedAccessException){if(i==19)Console.Error.WriteLine("runtime wire fixture cleanup pending: "+fixture.FullName);else await Task.Delay(500);}}
        }
    }
}
