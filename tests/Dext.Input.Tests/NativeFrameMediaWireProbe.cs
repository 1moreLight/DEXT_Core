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

internal static class NativeFrameMediaWireProbe
{
    [DllImport("user32.dll")] private static extern bool SetProcessDpiAwarenessContext(IntPtr context);
    public static async Task Run(string player,string hostDirectory,string sdk,string mediaDirectory)
    {
        if(!SetProcessDpiAwarenessContext(new IntPtr(-4)))throw new Exception("Official probe requires Core PerMonitorV2 DPI");
        var root=Directory.CreateTempSubdirectory("Dext-v3-official-wire-");
        try
        {
            foreach(var file in new[]{"index.html","main.js","style.css","layout-model.js","runtime-model.js","native-host.js","frame-host.js","media-host.js","playback-host.js","dom-host.js"})
                File.Copy(Path.Combine(Path.GetFullPath(hostDirectory),file),Path.Combine(root.FullName,file));
            var content=Directory.CreateDirectory(Path.Combine(root.FullName,"content"));File.Copy(Path.GetFullPath(sdk),Path.Combine(content.FullName,"sdk.js"));
            File.Copy(Path.Combine(Path.GetFullPath(mediaDirectory),"clip.mp4"),Path.Combine(content.FullName,"clip.mp4"));
            using(var wave=new BinaryWriter(File.Create(Path.Combine(content.FullName,"tone.wav"))))
            { const int samples=44100*8;wave.Write(Encoding.ASCII.GetBytes("RIFF"));wave.Write(36+samples*2);wave.Write(Encoding.ASCII.GetBytes("WAVEfmt "));wave.Write(16);wave.Write((short)1);wave.Write((short)1);wave.Write(44100);wave.Write(88200);wave.Write((short)2);wave.Write((short)16);wave.Write(Encoding.ASCII.GetBytes("data"));wave.Write(samples*2);for(var i=0;i<samples;i++)wave.Write((short)(200*Math.Sin(i*2*Math.PI*440/44100))); }
            File.WriteAllText(Path.Combine(content.FullName,"nested.html"),"""
                <!doctype html><audio src=tone.wav muted loop autoplay></audio><script>
                const media=document.querySelector('audio');media.muted=true;media.play();
                const context=new AudioContext(),oscillator=context.createOscillator(),gain=context.createGain();gain.gain.value=0;oscillator.connect(gain).connect(context.destination);oscillator.start();context.resume();
                const report=()=>parent.postMessage({nestedMedia:true,paused:media.paused,time:media.currentTime,webState:context.state,webTime:context.currentTime},'*');
                for(const name of ['play','pause','timeupdate'])media.addEventListener(name,report);context.addEventListener('statechange',report);setInterval(report,80);
                </script>
                """);
            File.WriteAllText(Path.Combine(content.FullName,"bg.svg"),"<svg xmlns='http://www.w3.org/2000/svg' width='1920' height='1080'><rect width='1920' height='1080' fill='#172235'/></svg>");
            File.WriteAllText(Path.Combine(content.FullName,"author.html"),"""
                <!doctype html><script>const early=document.createElement('audio');early.src='tone.wav';early.muted=true;early.loop=true;document.documentElement.append(early);early.play();const defaultPaused=early.paused;early.remove();</script><button id=next>Next</button><span id=time></span><script src=sdk.js></script><script>
                const documentId=crypto.randomUUID();let readyCount=0;
                Dext.ready().then(async()=>{
                  const audio=document.createElement('audio');audio.src='tone.wav';audio.muted=true;audio.loop=true;document.body.append(audio);audio.play();
                  let context,leakedControl=false;const slot=Object.getOwnPropertyDescriptor(Array.prototype,'0');
                  try{Object.defineProperty(Array.prototype,'0',{configurable:true,set(value){Object.defineProperty(this,'0',{value,writable:true,enumerable:true,configurable:true});if(value&&Object.hasOwn(value,'gate')&&Object.hasOwn(value,'param'))leakedControl=true;}});context=new AudioContext();}
                  finally{if(slot)Object.defineProperty(Array.prototype,'0',slot);else delete Array.prototype[0];}
                  const temporary=new AudioContext(),arrayConstructor=Object.getOwnPropertyDescriptor(Array.prototype,'constructor');
                  try{Object.defineProperty(Array.prototype,'constructor',{configurable:true,writable:true,value:{[Symbol.species]:function(){return new Proxy([],{defineProperty(target,key,desc){if(desc.value&&Object.hasOwn(desc.value,'gate')&&Object.hasOwn(desc.value,'param'))leakedControl=true;return Reflect.defineProperty(target,key,desc);}});}}});await temporary.close();}
                  finally{Object.defineProperty(Array.prototype,'constructor',arrayConstructor);}
                  const oscillator=context.createOscillator(),gain=context.createGain();gain.gain.value=0;oscillator.connect(gain).connect(context.destination);oscillator.start();context.resume();
                  const authorSuspend=context.suspend.bind(context);context.resume=context.suspend=()=>{throw Error('authored context override');};
                  const authorPause=audio.pause.bind(audio);audio.play=()=>{throw Error('authored play override');};audio.pause=()=>{throw Error('authored pause override');};
                  const shadow=document.body.appendChild(document.createElement('div')).attachShadow({mode:'closed'}),video=document.createElement('video');
                  video.src='clip.mp4';video.muted=true;video.loop=true;shadow.append(video);video.play();
                  const nested=document.createElement('iframe');nested.src='nested.html';document.body.append(nested);
                  let interceptions=0;Object.defineProperty(Object.prototype,'toJSON',{configurable:true,value:function(){if(Object.hasOwn(this,'documentNonce'))interceptions++;return this;}});
                  let nestedState=null;const sample=()=>parent.postMessage({authorMedia:true,consumer:Dext.session.consumerId,privateReceiptInterceptions:interceptions,web:{state:context.state,time:context.currentTime},parts:[{part:'audio',paused:audio.paused,time:audio.currentTime},{part:'shadow',paused:video.paused,time:video.currentTime},...(nestedState?[{part:'nested',...nestedState}]:[])]},'*');
                  addEventListener('message',e=>{if(e.source===nested.contentWindow&&e.data?.nestedMedia){nestedState={paused:e.data.paused,time:e.data.time,webState:e.data.webState,webTime:e.data.webTime};sample();}
                    if(e.source===parent&&e.data?.probe==='authoredPause'){authorPause();authorSuspend().then(sample);}
                    if(e.source===parent&&e.data?.probe==='rename'){window.name='authored-name';}});
                  for(const value of [audio,video])for(const name of ['play','pause','timeupdate'])value.addEventListener(name,sample);context.addEventListener('statechange',sample);
                  setInterval(sample,80);
                  const protectedHook=Object.getOwnPropertyDescriptor(window,'__dextNativeMediaPolicyV1');
                  parent.postMessage({nativeThreat:true,protected:protectedHook?.configurable===false&&protectedHook.writable===false,
                    privateRecordsSafe:!leakedControl,audioProtected:Object.getOwnPropertyDescriptor(window,'AudioContext').writable===false&&Object.getOwnPropertyDescriptor(AudioNode.prototype,'connect').configurable===false,defaultPaused,fakeDenied:__dextNativeMediaPolicyV1({token:'sdk-token',kind:'describe'})===null,prototypeProtected:Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype,'play').configurable===false},'*');
                  const cross=document.createElement('iframe');cross.addEventListener('load',()=>{
                    let denied=false,reason=null;try{cross.contentWindow.AudioNode.prototype.connect.call(gain,context.destination);}catch(error){reason=error.name;denied=reason==='SecurityError'||reason==='InvalidAccessError';}
                    parent.postMessage({nativeThreat:true,crossRealm:true,denied,reason,consumer:Dext.session.consumerId},'*');
                  });document.body.append(cross);
                  globalThis=new Proxy(window,{get:(target,key)=>{if(key==='__dextNativeMediaPolicyV1')throw Error('authored globalThis alias');return Reflect.get(target,key);}});
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
                  const documents=new Map(),values=new Map(),media=new Map(),threats=[];const send=v=>chrome.webview.postMessage(JSON.stringify({type:'saveRoom',room:v}));
                  const report=command=>send({report:command,diagnostics:dextRuntimeDiagnostics(),iframeCount:document.querySelectorAll('iframe').length,documents:[...documents.values()],values:[...values],media:[...media.values()],threats});
                  addEventListener('message',e=>{const owned=[...document.querySelectorAll('iframe')].some(f=>f.contentWindow===e.source);if(!owned)return;
                    if(e.data?.authorMedia)media.set(e.data.consumer,e.data);if(e.data?.nativeThreat)threats.push(e.data);if(e.data?.authorDocument)documents.set(e.data.consumer,e.data);if(e.data?.authorValue)values.set(e.data.consumer,e.data.tick);});
                  const original=dextNativePlaybackChanged;window.dextNativePlaybackChanged=value=>{const accepted=original(value);send({playback:value.paused,accepted,diagnostics:dextRuntimeDiagnostics(),media:[...media.values()]});return accepted;};
                  chrome.webview.addEventListener('message',e=>{const command=e.data?.permissions?.command,expectedRevision=e.data?.permissions?.revision;if(e.data.type!=='dext:system-control-result'||!command)return;
                    if(command==='authoredPause'||command==='renamed')for(const frame of document.querySelectorAll('iframe'))frame.contentWindow.postMessage({probe:command==='authoredPause'?'authoredPause':'rename'},'*');
                    const stop=performance.now()+8000;const poll=()=>{const d=dextRuntimeDiagnostics(),ready=command==='revoked'?d.runtime===null:d.revision===expectedRevision&&d.runtime?.inputReady&&documents.size===2&&values.size===2&&media.size===2&&[...media.values()].every(v=>v.parts.length===3&&v.parts.every(p=>command==='idle'||command==='renamed'?p.paused:command==='authoredPause'||command==='restoredPause'?p.part==='audio'?p.paused:!p.paused:!p.paused&&p.time>0.05));
                      const webReady=command==='revoked'||media.size===2&&[...media.values()].every(v=>v.web.state===(command==='idle'||command==='renamed'||command==='authoredPause'||command==='restoredPause'?'suspended':'running')&&v.parts.find(p=>p.part==='nested')?.webState===(command==='idle'||command==='renamed'?'suspended':'running'));
                      if(ready&&webReady&&(command!=='initial'||threats.filter(t=>t.crossRealm).length===2)||performance.now()>stop)report(command);else setTimeout(poll,20);};poll();});
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
                var initialMedia=(JArray)initial["media"]!;Require(initialMedia.Count==2&&initialMedia.All(v=>((JArray)v["parts"]!).Count==3&&((JArray)v["parts"]!).All(p=>(bool?)p["paused"]==false&&(double?)p["time"]>0.05)),"native root audio/closed-shadow video/nested audio actually advance");
                var threats=((JArray)initial["threats"]!).Where(v=>(bool?)v["crossRealm"]!=true).ToList();
                Require(threats.Count==2&&threats.All(v=>(bool?)v["protected"]==true&&(bool?)v["fakeDenied"]==true&&(bool?)v["prototypeProtected"]==true&&(bool?)v["defaultPaused"]==true),"pre-author protected hook and original methods, SDK fake token rejected");
                var foreign=((JArray)initial["threats"]!).Where(v=>(bool?)v["crossRealm"]==true).ToList();
                Require(foreign.Count==2&&foreign.All(v=>(bool?)v["denied"]==true),"actual authored blank child cannot lend a cross-realm native output method");
                Require(((JArray)initial["media"]!).All(v=>(string?)v["web"]?["state"]=="running"&&(double?)v["web"]?["time"]>0.05&&((JArray)v["parts"]!).Any(p=>(string?)p["part"]=="nested"&&(string?)p["webState"]=="running"&&(double?)p["webTime"]>0.05)),"actual root and nested AudioContext clocks advance");
                Require(threats.All(v=>(bool?)v["audioProtected"]==true),"actual protected AudioContext constructor and destination routing");
                Require(threats.All(v=>(bool?)v["privateRecordsSafe"]==true),"actual authored Array index setters and species do not reveal private control records");
                Console.WriteLine("PASS actual blank-child realm borrow denied: "+string.Join(",",foreign.Select(v=>(string?)v["reason"]))+"; authored Array index/species private record protection");
                var transition=Guid.NewGuid();await Snapshot(2,"home","focus",transition);var completion=await Next();Require((string?)completion["complete"]?["TransitionId"]==transition.ToString(),"default DOM transition reports current completion");
                await Command("beforeCommit");var before=await NextReport("beforeCommit");Require((string?)before["diagnostics"]?["runtime"]?["currentDeskId"]=="home","host never commits Desk itself");
                await Snapshot(3,"focus");await Command("committed");var committed=await NextReport("committed");Require((string?)committed["diagnostics"]?["runtime"]?["currentDeskId"]=="focus"&&JToken.DeepEquals(documents,committed["documents"]),"Core commit retains actual iframe documents");
                var queuedTransition=Guid.NewGuid();await Snapshot(4,"focus","home",queuedTransition);await Snapshot(5,"focus","home",queuedTransition,"focus");await Task.Delay(100);await Send(new LivelySuspendCmd());var paused=await Next();
                Require((bool?)paused["playback"]==true&&(bool?)paused["accepted"]==true,"official native pause accepted");Require(((JArray)paused["media"]!).All(v=>((JArray)v["parts"]!).All(p=>(bool?)p["paused"]==true)),"native pause barrier stops all root/shadow/nested media before renderer suspension");
                Require(((JArray)paused["media"]!).All(v=>(string?)v["web"]?["state"]=="suspended"&&((JArray)v["parts"]!).Any(p=>(string?)p["part"]=="nested"&&(string?)p["webState"]=="suspended")),"native pause receipt stops root and nested AudioContexts before renderer suspension");await Task.Delay(1100);Require(!queue.Any(q=>q["complete"]!=null),"paused default animation cannot finish");
                await Snapshot(6,"focus","home",queuedTransition,"focus");var resumeClock=Stopwatch.StartNew();await Send(new LivelyResumeCmd());var resumed=await Next();Require((bool?)resumed["playback"]==false&&(bool?)resumed["accepted"]==true&&(long?)resumed["diagnostics"]?["revision"]==6,"last Core revision before releasing default animation");
                var resumedCompletion=await Next();Require((string?)resumedCompletion["complete"]?["TransitionId"]==queuedTransition.ToString(),"same queued transition finishes once after resume");await Snapshot(7,"home");await Command("resumed");var restored=await NextReport("resumed");Require(JToken.DeepEquals(documents,restored["documents"]),"queue and private suspend do not rebuild shared documents");
                Require(((JArray)restored["media"]!).All(v=>(string?)v["web"]?["state"]=="running"&&((JArray)paused["media"]!).Any(p=>(string?)p["consumer"]==(string?)v["consumer"]&&(double?)v["web"]?["time"]>(double?)p["web"]?["time"])),"actual same-context WebAudio clocks advance after native resume");
                var resumedSeconds=resumeClock.Elapsed.TotalSeconds;
                Require(((JArray)restored["media"]!).All(v=>((JArray)paused["media"]!).Any(p=>(string?)p["consumer"]==(string?)v["consumer"]&&
                    (double?)v["web"]?["time"]-(double?)p["web"]?["time"]<=resumedSeconds+0.25&&
                    (double?)((JArray)v["parts"]!).First(q=>(string?)q["part"]=="nested")["webTime"]-(double?)((JArray)p["parts"]!).First(q=>(string?)q["part"]=="nested")["webTime"]<=resumedSeconds+0.25)),"root and nested WebAudio clocks exclude the 1.1s suspended interval");
                Console.WriteLine("PASS actual WebAudio held1.1s then resumed active wall time "+resumedSeconds.ToString("F3",System.Globalization.CultureInfo.InvariantCulture)+"s; "+JsonConvert.SerializeObject(restored["media"]));
                await Snapshot(8,"home",stage:"idle");await Command("idle");var idle=await NextReport("idle");Require(((JArray)idle["media"]!).All(v=>((JArray)v["parts"]!).All(p=>(bool?)p["paused"]==true)),"trusted phase stops retained desktop media");
                Require(((JArray)idle["media"]!).All(v=>(string?)v["web"]?["state"]=="suspended"&&((JArray)v["parts"]!).Any(p=>(string?)p["part"]=="nested"&&(string?)p["webState"]=="suspended")),"trusted idle phase suspends root and nested AudioContexts");
                await Snapshot(9,"home");await Command("phaseRestored");var phaseRestored=await NextReport("phaseRestored");Require(JToken.DeepEquals(documents,phaseRestored["documents"]),"phase restores same authored documents");
                await Command("authoredPause");var authoredPause=await NextReport("authoredPause");Require(((JArray)authoredPause["media"]!).All(v=>((JArray)v["parts"]!).Any(p=>(string?)p["part"]=="audio"&&(bool?)p["paused"]==true)),"authored pause clears intent");
                await Send(new LivelySuspendCmd());Require((bool?)(await Next())["playback"]==true,"second private pause");await Task.Delay(150);await Send(new LivelyResumeCmd());Require((bool?)(await Next())["playback"]==false,"second private resume");
                await Command("restoredPause");var wanted=await NextReport("restoredPause");Require(((JArray)wanted["media"]!).All(v=>((JArray)v["parts"]!).All(p=>(string?)p["part"]=="audio"?(bool?)p["paused"]==true:(bool?)p["paused"]==false)),"resume preserves user-authored pause while other media resume");
                Require(((JArray)wanted["media"]!).All(v=>(string?)v["web"]?["state"]=="suspended"&&((JArray)v["parts"]!).Any(p=>(string?)p["part"]=="nested"&&(string?)p["webState"]=="running")),"authored AudioContext suspension survives private pause/resume while nested context resumes");
                await Command("renamed");var renamed=await NextReport("renamed");Require(((JArray)renamed["media"]!).All(v=>((JArray)v["parts"]!).All(p=>(bool?)p["paused"]==true)),"authored root rename retires native ownership and pauses descendants");
                Require(((JArray)renamed["media"]!).All(v=>(int?)v["privateReceiptInterceptions"]==0),"authored Object.toJSON cannot observe private native suspension receipts");
                Console.WriteLine("PASS actual authored Object.toJSON cannot intercept private native policy receipts");
                await Send(new LivelyMessageRoomRuntimeRevoke{RuntimeGeneration=1,SessionId=context.SessionId,RoomId=context.RoomId,InstallationStamp=context.InstallationStamp});await Command("revoked");var revoked=await NextReport("revoked");Require((int?)revoked["iframeCount"]==0&&revoked["diagnostics"]?["runtime"]?.Type==JTokenType.Null,"revoke disposes all official DOM frames");
                Console.WriteLine("PASS actual native root/nested AudioContext clocks, private suspension barrier and authored suspension intent; root audio/closed-shadow video/nested audio, captured original methods, fake token/globalThis alias rejection, phase/private pause/resume/rename plus official index/main/dom/native/frame/media/SDK in ReleasePlayer: geometry ack, continuous readouts, two retained documents, Core-only commit, queue without restart, native pause/latest revision, revoke disposal (Core replies are fixture)");
                async Task Snapshot(long revision,string current,string? target=null,Guid? transitionId=null,string? queued=null,string stage="desktop"){var message=RoomSessionPlayerMessage.Create(f.Snapshot with{Revision=revision,CurrentDeskId=current,TargetDeskId=target,TransitionId=transitionId,QueuedDeskId=queued,DeadlineUtc=transitionId!=null?DateTimeOffset.UtcNow.AddSeconds(5):null},["home","focus"]);expectedRevision=revision;message.RuntimeGeneration=1;message.Lifecycle.Stage=stage;await Send(message);}
                async Task Command(string command)=>await Send(new LivelyMessageSystemControlResponse{RequestId=command,PermissionsJson=JsonConvert.SerializeObject(new{command,revision=expectedRevision})});
                async Task<JObject> NextReport(string command){var value=await Next();Require((string?)value["report"]==command,"report "+command);return value;}
                async Task<JObject> Next(){var stop=DateTime.UtcNow.AddSeconds(25);while(DateTime.UtcNow<stop){if(queue.TryDequeue(out var value)){
                    if(value["native"] is{} request){var method=(string?)request["Method"];var consumer=(string?)request["Consumer"];Require(method is "invalidateGeometry" or "geometry" or "capabilities" or "data" or "layoutRead","official permitted native request");if(method=="geometry")geometries++;
                        if(method=="capabilities"||method=="data")Require(consumer is "scene" or "component.shared","fixed actual consumer");
                        if(method=="data"){Require((string?)request["Capability"]=="time.read","declared actual data");ticks++;}
                        await Send(new LivelyMessageRoomNativeResponse{Method=method,RuntimeGeneration=1,SessionId=context.SessionId,PayloadJson=JsonConvert.SerializeObject(new{type="dext:v3-native-response",requestId=(string?)request["RequestId"],runtimeGeneration=1,sessionId=context.SessionId,revision=(long?)request["Revision"],status="accepted",capabilities=new Dictionary<string,string>{{"desk.read","accepted"},{"time.read","accepted"}},data=method=="data"?new{status="available",value=new{tick=ticks}}:null,layout=method=="layoutRead"?new{revision=0,icons=new{},components=new{}}:null})});continue;}
                    return value;
                }if(process.HasExited){await reader;throw new Exception("Player exit: "+process.ExitCode+"; "+await errors+"; "+string.Join("\n",log.TakeLast(10)));};await Task.Delay(20);}throw new TimeoutException("official wire: "+string.Join("\n",log.TakeLast(8)));}
            }
            finally{if(!process.HasExited){await Send(new LivelyCloseCmd());process.StandardInput.Close();try{await process.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(5));}catch(TimeoutException){process.Kill(true);await process.WaitForExitAsync();}}await reader;}
            async Task Send(IpcMessage value){await process.StandardInput.WriteLineAsync(JsonConvert.SerializeObject(value));await process.StandardInput.FlushAsync();}
            void Require(bool ok,string message){if(!ok)throw new Exception(message+"; "+string.Join("\n",log.TakeLast(6)));}
        }
        finally{var temp=Path.GetFullPath(Path.GetTempPath()).TrimEnd('\\')+"\\";if(!root.FullName.StartsWith(temp,StringComparison.OrdinalIgnoreCase))throw new Exception("fixture outside temp");
            for(var i=0;i<20&&Directory.Exists(root.FullName);i++){try{root.Delete(true);}catch(Exception e)when(e is IOException or UnauthorizedAccessException){if(i==19)Console.Error.WriteLine("official fixture cleanup pending: "+root.FullName);else await Task.Delay(500);}}}
    }
}
