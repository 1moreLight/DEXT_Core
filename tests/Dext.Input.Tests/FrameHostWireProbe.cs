using System.Collections.Concurrent;
using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;
using Dext.Core.Rooms;
using Lively.Models.Message;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

internal static class FrameHostWireProbe
{
    // Real production JS + SDK + WindowProxy/Player IPC. The private Core reply
    // and data provider are fixtures; this does not replace installed-Room gates.
    public static async Task Run(string player,string frameHostFile,string sdkFile,string? mediaHostFile=null,string? playbackHostFile=null)
    {
        var root=Directory.CreateTempSubdirectory("Dext-v3-frame-wire-");
        try
        {
            var content=Directory.CreateDirectory(Path.Combine(root.FullName,"content","scene"));
            File.Copy(Path.GetFullPath(frameHostFile),Path.Combine(root.FullName,"frame-host.js"));
            File.Copy(Path.GetFullPath(sdkFile),Path.Combine(content.FullName,"sdk.js"));
            var testPlayback=mediaHostFile!=null&&playbackHostFile!=null;
            if(testPlayback){File.Copy(Path.GetFullPath(mediaHostFile!),Path.Combine(root.FullName,"media-host.js"));File.Copy(Path.GetFullPath(playbackHostFile!),Path.Combine(root.FullName,"playback-host.js"));
                File.WriteAllText(Path.Combine(content.FullName,"clock.svg"),"<svg xmlns='http://www.w3.org/2000/svg' width='8' height='8'><rect width='8' height='8' fill='blue'/></svg>");}
            File.WriteAllText(Path.Combine(root.FullName,"index.html"),"<!doctype html><script src=frame-host.js defer></script>"+(testPlayback?"<script src=media-host.js defer></script><script src=playback-host.js defer></script>":"")+"<script src=main.js defer></script>");
            File.WriteAllText(Path.Combine(content.FullName,"index.html"),"""
                <!doctype html><div id=static>Static frame</div><span id=time></span><span id=hardware></span>
                <script>let readyCount=0;addEventListener('dext:ready',()=>readyCount++);</script><script src=sdk.js></script><script>
                const report=phase=>parent.postMessage({authorReport:true,phase,readyCount,staticFrame:!!document.getElementById('static'),timeHidden:document.getElementById('time').hidden,hardwareHidden:document.getElementById('hardware').hidden,capabilities:Dext.capabilities.get()},'*');
                Dext.ready().then(()=>{Dext.data.bindReadout('time.read',document.getElementById('time'),value=>document.getElementById('time').textContent=value.tick);Dext.data.bindReadout('hardware.read',document.getElementById('hardware'),()=>{});report('ready');});
                addEventListener('message',async e=>{if(e.source!==parent)return;const d=e.data;
                  if(d.command==='report')report('report');
                  if(d.command==='activate')parent.postMessage({authorReport:true,phase:'activation',result:await Dext.actions.activate('open')},'*');
                  if(d.command==='forge'){parent.postMessage(d.packet,'*');try{chrome.webview.postMessage(JSON.stringify({type:'saveRoom',room:{nativeLeak:true}}));}catch{}report('forged');}
                  if(d.command==='reload')location.reload();
                });
                </script>
                """);
            File.WriteAllText(Path.Combine(root.FullName,"main.js"),"""
                let context,snapshot,host,frame,other,media,playback,requests=0,opened=0,closed=0,firstToken,completed=0,resumeAt=0,clockStartedAt=0,lastSourceRevision=0;const pending=new Map();
                const send=value=>chrome.webview.postMessage(JSON.stringify({type:'saveRoom',room:value}));
                const native=(method,extra,identity)=>new Promise(resolve=>{const requestId='native-'+(++requests);pending.set(requestId,resolve);chrome.webview.postMessage(JSON.stringify({type:'dext:v3-native-request',protocolVersion:1,requestId,method,runtimeGeneration:identity.runtimeGeneration,sessionId:identity.sessionId,revision:identity.revision,...extra}));});
                const mount=()=>{
                  if(host||!context||!snapshot)return;
                  host=DextFrameHost.createFrameHost({window,document,randomToken:()=>{const token=crypto.randomUUID();firstToken??=token;return token;},initialSnapshot:snapshot,runtimeGeneration:context.runtimeGeneration,initialGeometry:{geometryVersion:1,viewport:{width:Math.max(64,innerWidth),height:Math.max(64,innerHeight),dpr:devicePixelRatio}},
                    resolveResource:path=>{if(!context.resources.some(r=>r.path===path))throw Error('not declared');return context.resourceBasePath+path;},
                    readCapabilities:value=>native('capabilities',{consumer:value.consumerId},value.identity),implementedCapabilities:['desk.read','binding.launch','time.read'],
                    invoke:async value=>{if(value.method==='desk.get')return snapshot;if(value.method!=='actions.activate')throw Object.assign(Error(),{code:'unsupported'});const reply=await native('activate',{consumer:value.consumerId,button:value.params.buttonId,geometryVersion:1},value.identity);return {status:reply.status};},
                    subscribeData:(value,emit)=>{opened++;lastSourceRevision=value.identity.revision;emit({status:'available',value:{tick:opened}});return()=>closed++;},applyState:(frame,value)=>{frame.inert=value.state!=='active';}});
                  if(typeof DextPlaybackHost==='object'){
                    media=DextMediaHost.createMediaHost({document,getSnapshot:()=>snapshot,resolveResource:path=>context.resourceBasePath+path,
                      onStartupComplete:value=>{completed++;send({clockComplete:true,completed,revision:value.revision,afterResume:performance.now()-resumeAt,opened,closed,lastSourceRevision});return {status:'accepted'};}});
                    playback=DextPlaybackHost.createPlaybackHost({matchesRuntime:generation=>generation===context.runtimeGeneration,
                      setSuspended:value=>{media.setPlaybackSuspended(value);host.setPlaybackSuspended(value);},
                      onRuntimeMessage:value=>{if(value.type==='dext:v3-runtime')context=value;
                        if(value.type==='dext:v3-session'){snapshot=value;host.acceptSnapshot(value);media.refresh();}
                        if(value.type==='dext:v3-runtime-revoked'){host.dispose();media.dispose();}}});
                    window.dextNativePlaybackChanged=value=>{const accepted=playback.handle(value);if(accepted){if(!value.paused)resumeAt=performance.now();send({playback:value.paused,sequence:value.sequence,revision:snapshot.revision,completed,corePaused:snapshot.lifecycle.playbackPaused,clockElapsed:performance.now()-clockStartedAt});}return accepted;};
                  }
                  frame=host.mount({instanceId:'start-frame',consumerId:'slot.start',kind:'html',state:'active',entry:'scene/index.html',capabilities:['desk.read','binding.launch','time.read','hardware.read'],buttonIds:['open'],config:{style:'static'}},document.body);
                };
                addEventListener('message',e=>{if(e.data?.authorReport&&(e.source===frame?.contentWindow||e.source===other?.contentWindow))send({author:e.data,which:e.source===frame?.contentWindow?'start':'other',opened,closed,diagnostics:host.readDiagnostics()});});
                chrome.webview.addEventListener('message',e=>{const d=e.data;
                  if(d.type==='dext:v3-runtime'){context=d;mount();}if(d.type==='dext:v3-session'){snapshot=d;mount();}
                  if(d.type==='dext:v3-native-response'){const resolve=pending.get(d.requestId);pending.delete(d.requestId);resolve?.(d);}
                  if(d.type==='dext:system-control-result'){
                    const command=d.permissions?.command;
                    if(command==='clockStart'){clockStartedAt=performance.now();media.mount({instanceId:'clock',consumerId:'slot.start',state:'active',content:{type:'image',src:'scene/clock.svg'}},document.body);}
                    if(command==='pause')host.setState('start-frame','suspended');
                    if(command==='resume')host.setState('start-frame','active');
                    if(command==='report'||command==='activate'||command==='reload')frame.contentWindow.postMessage({command},'*');
                    if(command==='other')other=host.mount({instanceId:'other-frame',consumerId:'component.other',kind:'widget',state:'suspended',entry:'scene/index.html',capabilities:['desk.read','binding.launch','time.read','hardware.read'],buttonIds:['open'],config:{}},document.body);
                    if(command==='forge')other.contentWindow.postMessage({command,packet:{type:'dext:runtime:request',apiVersion:1,instanceId:'start-frame',sessionId:snapshot.sessionId,token:firstToken,requestId:'r100',method:'actions.activate',params:{buttonId:'open'}}},'*');
                    if(command==='oldToken')frame.contentWindow.postMessage({command:'forge',packet:{type:'dext:runtime:request',apiVersion:1,instanceId:'start-frame',sessionId:snapshot.sessionId,token:firstToken,requestId:'r100',method:'actions.activate',params:{buttonId:'open'}}},'*');
                    send({barrier:command});
                  }
                });send({ready:true});
                """);
            var info=new ProcessStartInfo(Path.GetFullPath(player)){UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden,RedirectStandardInput=true,RedirectStandardOutput=true,RedirectStandardError=true,StandardInputEncoding=Encoding.UTF8,WorkingDirectory=Path.GetDirectoryName(Path.GetFullPath(player))!};
            foreach(var arg in new[]{"--wallpaper-url",Path.Combine(root.FullName,"index.html"),"--wallpaper-type","local","--wallpaper-geometry","640x480","--wallpaper-user-data",Path.Combine(root.FullName,"user-data"),"--dext-trusted-host","--dext-native-runtime"})info.ArgumentList.Add(arg);
            using var process=Process.Start(info)??throw new Exception("Player did not start");var queue=new ConcurrentQueue<JObject>();var log=new ConcurrentQueue<string>();var activations=0;
            var reader=Task.Run(async()=>{while(await process.StandardOutput.ReadLineAsync() is{} line){log.Enqueue(line);try{var value=JObject.Parse(line);
                if(value["RoomJson"] is{} room)queue.Enqueue(JObject.Parse((string)room!));if((int?)value["Type"]==(int)MessageType.msg_room_native_request)queue.Enqueue(new JObject{["native"]=value});
            }catch(JsonException){}}});var errors=process.StandardError.ReadToEndAsync();
            try
            {
                var f=RuntimeMessageChecks.Fixture();var context=RuntimeMessageChecks.ContextMessage(f.Context,f.Snapshot,1);Require((bool?)(await Next())["ready"]==true,"official ready");
                context.Resources=Directory.GetFiles(content.FullName).Select(path=>{var bytes=File.ReadAllBytes(path);return new LivelyRoomRuntimeResource{Path="scene/"+Path.GetFileName(path),Size=bytes.Length,Sha256=Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant()};}).ToArray();
                var manifest=JObject.Parse(context.ManifestJson);manifest["resources"]=new JArray(context.Resources.Select(resource=>resource.Path));context.ManifestJson=manifest.ToString(Formatting.None);
                await Send(context);var snapshot=RoomSessionPlayerMessage.Create(f.Snapshot with{Lifecycle=new(RoomLifecycleStage.Starting,false,false,1)},["home","focus"]);snapshot.RuntimeGeneration=1;await Send(snapshot);
                var ready=await Next();Require((string?)ready["author"]?["phase"]=="ready"&&(int?)ready["author"]?["readyCount"]==1,"real SDK initializes once");
                Require((string?)ready["author"]?["capabilities"]?["hardware.read"]=="denied"&&(bool?)ready["author"]?["hardwareHidden"]==true&&(bool?)ready["author"]?["staticFrame"]==true,"denied readout only");
                await Command("report");await Barrier("report");var active=await Next();Require((bool?)active["author"]?["timeHidden"]==false&&(int?)active["opened"]==1,"one real SDK source");
                await Command("pause");await Barrier("pause");await Command("report");await Barrier("report");var paused=await Next();Require((bool?)paused["author"]?["timeHidden"]==true&&(int?)paused["closed"]==1&&(bool?)paused["author"]?["staticFrame"]==true,"suspend without destroying static frame");
                await Command("resume");await Barrier("resume");await Command("report");await Barrier("report");Require((bool?)(await Next())["author"]?["timeHidden"]==false,"new authorized scope resumes data");
                await Command("activate");await Barrier("activate");var activation=await Next();Require((string?)activation["author"]?["result"]?["status"]=="inputRequired"&&activations==1,"SDK activation routes owned consumer without native proof");
                await Command("other");await Barrier("other");Require((string?)(await Next())["which"]=="other","second opaque source ready");await Command("forge");await Barrier("forge");Require((string?)(await Next())["author"]?["phase"]=="forged"&&activations==1,"foreign iframe and direct native access rejected");
                await Command("reload");await Barrier("reload");var reloaded=await Next();Require((int?)reloaded["author"]?["readyCount"]==1&&(int?)reloaded["diagnostics"]?["count"]==2,"same retained frame reloads new SDK document");
                await Command("oldToken");await Barrier("oldToken");Require((string?)(await Next())["author"]?["phase"]=="forged"&&activations==1,"old routing token rejected in new document");
                if(testPlayback){
                    await Command("clockStart");await Barrier("clockStart");await Task.Delay(100);await Send(new LivelySuspendCmd());
                    var suspended=await Next();Require((bool?)suspended["playback"]==true&&(int?)suspended["completed"]==0&&(bool?)suspended["corePaused"]==false,"native pause synchronously cancels production clocks without inventing Core facts");
                    var remaining=Math.Max(0,500-(double)suspended["clockElapsed"]!);
                    await Task.Delay(1200);
                    var pausedSnapshot=RoomSessionPlayerMessage.Create(f.Snapshot with{Revision=2,Lifecycle=new(RoomLifecycleStage.Starting,true,false,2)},["home","focus"]);pausedSnapshot.RuntimeGeneration=1;await Send(pausedSnapshot);
                    var lastSnapshot=RoomSessionPlayerMessage.Create(f.Snapshot with{Revision=3,Lifecycle=new(RoomLifecycleStage.Starting,false,false,3)},["home","focus"]);lastSnapshot.RuntimeGeneration=1;await Send(lastSnapshot);
                    await Send(new LivelyResumeCmd());await Send(new LivelyResumeCmd());
                    var resumed=await Next();Require((bool?)resumed["playback"]==false&&(long?)resumed["revision"]==3&&(int?)resumed["completed"]==0,"last Core snapshot before releasing clocks");
                    var completion=await Next();Require((bool?)completion["clockComplete"]==true&&(int?)completion["completed"]==1&&(long?)completion["revision"]==3&&(double?)completion["afterResume"]>=remaining-50,"startup preserves remaining active-time budget and current revision");
                    Require((long?)completion["lastSourceRevision"]==3&&(int?)completion["opened"]>=4&&(int?)completion["closed"]>=3,"iframe source resumes only after fresh current-scope private capability response");
                    Console.WriteLine("PASS production playback-host/media/frame in native ReleasePlayer: synchronous pause, cached Core facts untouched, last snapshot before resume, remaining500ms startup budget, fresh iframe authorization");
                }
                Console.WriteLine("PASS production frame-host.js + real SDK in ReleasePlayer: current private capability IPC, fixed opaque WindowProxy, readout-only denial, one source/suspend/resume, owned activation without proof, foreign/direct native rejection, retained iframe reload");
                async Task Command(string command)=>await Send(new LivelyMessageSystemControlResponse{RequestId=command,PermissionsJson=JsonConvert.SerializeObject(new{command})});
                async Task Barrier(string command)=>Require((string?)(await Next())["barrier"]==command,"barrier "+command);
                async Task<JObject> Next(){var stop=DateTime.UtcNow.AddSeconds(20);while(DateTime.UtcNow<stop){if(queue.TryDequeue(out var value)){
                    if(value["native"] is{} request){var method=(string?)request["Method"];var consumer=(string?)request["Consumer"];Require(consumer=="slot.start"||consumer=="component.other","fixed consumer query");
                        if(method=="activate"){Require(consumer=="slot.start"&&(string?)request["Button"]=="open","owned activation");activations++;}
                        Require(method=="capabilities"||method=="activate","only declared native methods");
                        await Send(new LivelyMessageRoomNativeResponse{RuntimeGeneration=1,SessionId=context.SessionId,PayloadJson=JsonConvert.SerializeObject(new{type="dext:v3-native-response",requestId=(string?)request["RequestId"],runtimeGeneration=1,sessionId=context.SessionId,revision=(long?)request["Revision"],status=method=="activate"?"inputRequired":consumer=="slot.start"?"accepted":"unknownConsumer",capabilities=new Dictionary<string,string>{{"desk.read","accepted"},{"binding.launch","accepted"},{"time.read","accepted"},{"hardware.read","missingPermission"}}})});continue;}
                    if((bool?)value["nativeLeak"]==true)throw new Exception("sandbox reached native IPC");return value;
                }if(process.HasExited)throw new Exception("Player exit: "+await errors);await Task.Delay(20);}throw new TimeoutException("frame wire: "+string.Join("\n",log.TakeLast(8)));}
            }
            finally{if(!process.HasExited){await Send(new LivelyCloseCmd());process.StandardInput.Close();try{await process.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(5));}catch(TimeoutException){process.Kill(true);await process.WaitForExitAsync();}}await reader;}
            async Task Send(IpcMessage value){await process.StandardInput.WriteLineAsync(JsonConvert.SerializeObject(value));await process.StandardInput.FlushAsync();}
            void Require(bool ok,string message){if(!ok)throw new Exception(message+"; "+string.Join("\n",log.TakeLast(5)));}
        }
        finally{var temp=Path.GetFullPath(Path.GetTempPath()).TrimEnd('\\')+"\\";if(!root.FullName.StartsWith(temp,StringComparison.OrdinalIgnoreCase))throw new Exception("fixture outside temp");
            for(var i=0;i<20&&Directory.Exists(root.FullName);i++){try{root.Delete(true);}catch(Exception e)when(e is IOException or UnauthorizedAccessException){if(i==19)Console.Error.WriteLine("frame fixture cleanup pending: "+root.FullName);else await Task.Delay(500);}}}
    }
}
