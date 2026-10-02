using System.Collections.Concurrent;
using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;
using Lively.Models.Message;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

internal static class ResourceWireProbe
{
    public static async Task Run(string player,string mediaDirectory,bool policyUnavailable=false)
    {
        var root=Directory.CreateTempSubdirectory("Dext-v3-resource-wire-");
        try
        {
            var content=Directory.CreateDirectory(Path.Combine(root.FullName,"content","scene"));
            File.WriteAllText(Path.Combine(root.FullName,"index.html"),"<!doctype html><title>native resource probe</title><script src=main.js defer></script>");
            File.WriteAllText(Path.Combine(root.FullName,"main.js"),"""
                const rtcBlocked = (scope=window) => {
                  const observer=new scope.ReportingObserver(()=>{}, {types:['connection-allowlist']});let peer;
                  try{observer.observe();peer=new scope.RTCPeerConnection({iceServers:[]});return observer.takeRecords().some(r=>r.type==='connection-allowlist'&&r.body.connection==='webrtc'&&r.body.disposition==='enforce');}
                  finally{peer?.close();observer.disconnect();}
                };
                const send = value => chrome.webview.postMessage(JSON.stringify({type:'saveRoom',room:value}));
                const guard = promise => Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(Error('browser probe timeout')),10000))]);
                const result = async (path,options) => {const r=await fetch(path,options);return {status:r.status,text:await r.text(),range:r.headers.get('Content-Range')};};
                const blockedWorker = async url => {try{const w=new Worker(url);try{return await guard(new Promise(resolve=>{w.onmessage=()=>resolve(false);w.onerror=e=>{e.preventDefault();resolve(true);};}));}finally{w.terminate();}}catch(error){if(error?.message==='browser probe timeout')throw error;return true;}};
                async function media(url,kind){
                  const element=document.createElement(kind);document.body.append(element);
                  if(kind==='img'){const loaded=new Promise((resolve,reject)=>{element.onload=resolve;element.onerror=reject;});element.src=url;await guard(loaded);return element.naturalWidth;}
                  element.muted=true;const ready=new Promise((resolve,reject)=>{element.onloadedmetadata=resolve;element.onerror=reject;});element.src=url;await guard(ready);
                  await guard(element.play());const moved=new Promise(resolve=>{element.ontimeupdate=()=>{if(element.currentTime>0.1)resolve();};});await guard(moved);
                  const seeked=new Promise((resolve,reject)=>{element.onseeked=resolve;element.onerror=reject;});element.currentTime=1.7;await guard(seeked);
                  const value={duration:element.duration,time:element.currentTime};element.pause();element.remove();return value;
                }
                async function run(runtime){
                  send({trace:"runtime entered"}); const base=runtime.resourceBasePath;
                  if(runtime.runtimeGeneration!==1){send({refresh:{old:await result('/content/1/scene/data.json'),current:await result(base+'scene/data.json')}});return;}
                  const report={normal:await result(base+'scene/data.json'),range:await result(base+'scene/data.json',{headers:{Range:'bytes=2-5'}}),denied:[]};
                  for(const path of ['secret.json','content/1/room.json','content/1/installation.json','content/1/scene/undeclared.json','content/1/scene/bad.json'])report.denied.push(await result('/'+path));
                  try{await fetch('https://example.invalid/blocked');report.external=false;}catch{report.external=true;}
                  report.worker=await blockedWorker(base+'scene/worker.js');send({trace:'worker done'});
                  report.webrtc=rtcBlocked();
                  report.long=await result(base+'scene/'+'a'.repeat(229)+'.json');
                  report.unicode=await result(base+'scene/'+encodeURIComponent('汉字.json'));
                  const frame=document.createElement('iframe');frame.sandbox='allow-scripts';
                  const received=new Promise(resolve=>addEventListener('message',function receive(e){if(e.source===frame.contentWindow&&e.data?.probeFrame){if(e.data.trace){send({trace:e.data.trace});return;}removeEventListener('message',receive);resolve(e.data);}}));
                  frame.src=base+'scene/frame.html';document.body.append(frame);report.frame=await guard(received);
                  report.gif=await media(base+'scene/animation.gif','img');report.mp4=await media(base+'scene/clip.mp4','video');report.webm=await media(base+'scene/clip.webm','video');
                  const font=new FontFace('ProbeIcons','url('+base+'scene/icons.ttf)');await guard(font.load());report.font=font.status;
                  send({resources:report});
                }
                chrome.webview.addEventListener('message',e=>{
                  if(e.data.type==='dext:v3-runtime')run(e.data).catch(error=>send({failure:String(error)}));
                  if(e.data.type==='dext:system-control-result'&&e.data.permissions?.command==='reload')location.reload();
                  if(e.data.type==='dext:system-control-result'&&e.data.permissions?.command==='revoked')result('/content/1/scene/data.json').then(value=>send({revoked:value}));
                });
                send({ready:true});
                """);
            if(policyUnavailable) {
                var script=Path.Combine(root.FullName,"main.js");
                File.WriteAllText(script,"globalThis.ReportingObserver=undefined;\n"+File.ReadAllText(script));
            }
            File.WriteAllText(Path.Combine(content.FullName,"data.json"),"0123456789");File.WriteAllText(Path.Combine(content.FullName,"bad.json"),"trusted");
            File.WriteAllText(Path.Combine(content.FullName,new string('a',229)+".json"),"长路径");
            File.WriteAllText(Path.Combine(content.FullName,"汉字.json"),"中文内容");
            File.WriteAllText(Path.Combine(content.FullName,"worker.js"),"postMessage('worker-ran');");
            File.WriteAllText(Path.Combine(content.FullName,"frame.html"),"""
                <!doctype html><script>
                const rtcBlocked = (scope=window) => {
                  const observer=new scope.ReportingObserver(()=>{}, {types:['connection-allowlist']});let peer;
                  try{observer.observe();peer=new scope.RTCPeerConnection({iceServers:[]});return observer.takeRecords().some(r=>r.type==='connection-allowlist'&&r.body.connection==='webrtc'&&r.body.disposition==='enforce');}
                  finally{peer?.close();observer.disconnect();}
                };
                (async()=>{
                  parent.postMessage({probeFrame:true,trace:'frame script entered'},'*');const report={probeFrame:true};report.allowed=await (await fetch('data.json')).text();
                  try{await fetch('https://example.invalid/frame');report.external=false;}catch{report.external=true;}
                  try{const w=new Worker('worker.js');w.terminate();report.worker=false;}catch{report.worker=true;}
                  try{const w=new SharedWorker('worker.js');w.port.close();report.shared=false;}catch{report.shared=true;}
                  try{await navigator.serviceWorker.register('worker.js');report.service=false;}catch{report.service=true;}
                  parent.postMessage({probeFrame:true,trace:'frame before RTC'},'*');report.webrtc=rtcBlocked();
                  try{chrome.webview.postMessage(JSON.stringify({type:'saveRoom',room:{nativeLeak:true}}));}catch{}
                  parent.postMessage(report,'*');
                })().catch(error=>parent.postMessage({probeFrame:true,error:String(error)},'*'));
                </script>
                """);
            foreach(var name in new[]{"clip.mp4","clip.webm","animation.gif","icons.ttf"})File.Copy(Path.Combine(mediaDirectory,name),Path.Combine(content.FullName,name));
            var paths=Directory.GetFiles(Path.Combine(root.FullName,"content"),"*",SearchOption.AllDirectories);
            var inventory=paths.Select(path=>new LivelyRoomRuntimeResource{Path=Path.GetRelativePath(Path.Combine(root.FullName,"content"),path).Replace('\\','/'),Size=new FileInfo(path).Length,Sha256=Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(path))).ToLowerInvariant()}).ToArray();
            File.WriteAllText(Path.Combine(content.FullName,"bad.json"),"changed");File.WriteAllText(Path.Combine(content.FullName,"undeclared.json"),"not-declared");
            File.WriteAllText(Path.Combine(root.FullName,"secret.json"),"private");File.WriteAllText(Path.Combine(root.FullName,"content","room.json"),"private");File.WriteAllText(Path.Combine(root.FullName,"content","installation.json"),"private");
            var info=new ProcessStartInfo(Path.GetFullPath(player)){UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden,RedirectStandardInput=true,RedirectStandardOutput=true,RedirectStandardError=true,StandardInputEncoding=Encoding.UTF8,WorkingDirectory=Path.GetDirectoryName(Path.GetFullPath(player))!};
            foreach(var arg in new[]{"--wallpaper-url",Path.Combine(root.FullName,"index.html"),"--wallpaper-type","local","--wallpaper-geometry","640x480","--wallpaper-user-data",Path.Combine(root.FullName,"user-data"),"--dext-trusted-host","--dext-native-runtime"})info.ArgumentList.Add(arg);
            using var process=Process.Start(info)??throw new Exception("Player did not start");var queue=new ConcurrentQueue<JObject>();var nativeLog=new ConcurrentQueue<string>();
            var reader=Task.Run(async()=>{while(await process.StandardOutput.ReadLineAsync() is{} line){try{nativeLog.Enqueue(line);var value=JObject.Parse(line);if(((string?)value["Message"])?.Contains("process failed")==true)queue.Enqueue(new JObject{["failure"]=line});if(value["RoomJson"] is{} room){var payload=JObject.Parse((string)room!);if(payload["trace"]==null)queue.Enqueue(payload);}}catch(JsonException){}}});var errors=process.StandardError.ReadToEndAsync();
            try
            {
                if(policyUnavailable) {
                    await process.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(15));await reader;
                    var messages=nativeLog.Select(JObject.Parse).ToArray();
                    if(!messages.Any(v=>(int?)v["Type"]==2&&(bool?)v["Success"]==false) ||
                        !messages.Any(v=>((string?)v["Message"])?.Contains("enforcing Connection-Allowlist")==true))
                        throw new Exception("unsupported policy did not fail closed: "+string.Join("\n",nativeLog));
                    Console.WriteLine("PASS native ReleasePlayer exits with a diagnostic when browser policy cannot be verified");return;
                }
                var ready=await Next();if((bool?)ready["ready"]!=true)throw new Exception("page not ready: "+ready);
                var f=RuntimeMessageChecks.Fixture();var context=RuntimeMessageChecks.ContextMessage(f.Context,f.Snapshot,1);var manifest=JObject.Parse(context.ManifestJson);manifest["resources"]=new JArray(inventory.Select(i=>i.Path));context.ManifestJson=manifest.ToString(Formatting.None);context.Resources=inventory;
                await Send(context);var report=(await Next())["resources"]??throw new Exception("no resource report");
                if((int?)report["normal"]?["status"]!=200||(string?)report["normal"]?["text"]!="0123456789"||(int?)report["range"]?["status"]!=206||(string?)report["range"]?["text"]!="2345")throw new Exception("resource or Range: "+report);
                if(report["denied"]!.Any(v=>(int?)v["status"]!=403||(string?)v["text"]!="")||(bool?)report["external"]!=true||(bool?)report["worker"]!=true||(bool?)report["webrtc"]!=true)throw new Exception("top boundary: "+report);
                if((int?)report["long"]?["status"]!=200||(string?)report["long"]?["text"]!="长路径"||(string?)report["unicode"]?["text"]!="中文内容")throw new Exception("path encoding: "+report);
                var frame=report["frame"]!;if((string?)frame["allowed"]!="0123456789"||new[]{"external","worker","shared","service","webrtc"}.Any(key=>(bool?)frame[key]!=true))throw new Exception("frame boundary: "+report);
                if((int?)report["gif"]!=320||new[]{"mp4","webm"}.Any(key=>report[key]?["time"]?.Type!=JTokenType.Float || (double)report[key]!["time"]!<1.6 || (double?)report[key]?["duration"]!=3)||(string?)report["font"]!="loaded")throw new Exception("media: "+report);
                Console.WriteLine("PASS native ReleasePlayer declared fetch/Range/GIF/font and MP4/WebM playback+seek; undeclared/tampered/private/external/worker/frame-native access rejected; browser-enforced WebRTC policy in top and sandbox frame");
                await Send(new LivelyMessageRoomRuntimeRevoke{RuntimeGeneration=1,SessionId=context.SessionId,RoomId=context.RoomId,InstallationStamp=context.InstallationStamp});
                await Send(new LivelyMessageSystemControlResponse{RequestId="revoked",PermissionsJson="{\"command\":\"revoked\"}"});var revoked=await Next();if((int?)revoked["revoked"]?["status"]!=403)throw new Exception("revoked read: "+revoked);
                context.RuntimeGeneration=2;await Send(context);var refresh=(await Next())["refresh"];if((int?)refresh?["old"]?["status"]!=403||(int?)refresh?["current"]?["status"]!=200)throw new Exception("generation: "+refresh);
                Console.WriteLine("PASS native ReleasePlayer revoke invalidates cached content; old generation cannot read refreshed installation");
                await Send(new LivelyMessageSystemControlResponse{RequestId="reload",PermissionsJson="{\"command\":\"reload\"}"});
                if((bool?)(await Next())["ready"]!=true)throw new Exception("native reload not ready");
                await Send(context);await Send(new LivelyMessageSystemControlResponse{RequestId="revoked",PermissionsJson="{\"command\":\"revoked\"}"});
                if((int?)(await Next())["revoked"]?["status"]!=403)throw new Exception("navigation revived old context");
                context.RuntimeGeneration=3;await Send(context);var afterReload=(await Next())["refresh"];
                if((int?)afterReload?["old"]?["status"]!=403||(int?)afterReload?["current"]?["status"]!=200)throw new Exception("reload generation: "+afterReload);
                Console.WriteLine("PASS native ReleasePlayer reload retires resource generation until a newly authorized context arrives");
            }
            finally{if(!process.HasExited){await Send(new LivelyCloseCmd());process.StandardInput.Close();try{await process.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(5));}catch(TimeoutException){process.Kill(true);await process.WaitForExitAsync();}}await reader;}
            async Task Send(IpcMessage value){await process.StandardInput.WriteLineAsync(JsonConvert.SerializeObject(value));await process.StandardInput.FlushAsync();}
            async Task<JObject> Next(){var deadline=DateTime.UtcNow.AddSeconds(50);while(DateTime.UtcNow<deadline){if(queue.TryDequeue(out var value)){if(value["failure"]!=null||value["nativeLeak"]!=null)throw new Exception("browser boundary failed: "+value);return value;}if(process.HasExited)throw new Exception("Player exited: "+await errors+" native="+string.Join("\n",nativeLog.TakeLast(8)));await Task.Delay(20);}throw new TimeoutException("resource probe reply missing; native="+string.Join("\n",nativeLog.TakeLast(12)));}
        }
        finally
        {
            var temp=Path.GetFullPath(Path.GetTempPath()).TrimEnd('\\')+"\\";if(!root.FullName.StartsWith(temp,StringComparison.OrdinalIgnoreCase))throw new Exception("fixture outside temp");
            for(var i=0;i<20&&Directory.Exists(root.FullName);i++){try{root.Delete(true);}catch(Exception e)when(e is IOException or UnauthorizedAccessException){if(i==19)Console.Error.WriteLine("resource fixture cleanup pending: "+root.FullName);else await Task.Delay(500);}}
        }
    }
}
