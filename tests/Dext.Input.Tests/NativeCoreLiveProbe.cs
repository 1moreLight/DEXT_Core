using System.Diagnostics;
using Dext.Core.Rooms;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using Google.Protobuf.WellKnownTypes;
using Grpc.Core;
using GrpcDotNetNamedPipes;
using Lively.Common;
using Lively.Grpc.Common.Proto.Desktop;
using Lively.Grpc.Common.Proto.Commands;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

// Actual production Core + WorkerW + ReleasePlayer; only the temporary official
// observer and trusted top navigation driver are test instrumentation. No Core
// responses, Windows facts, input proofs or commits are fixture replies.
// A fixture administrator prepares consent only for the new temporary Room;
// production Core still reads/rechecks that real private snapshot on each call.
internal static class NativeCoreLiveProbe
{
    [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern IntPtr FindWindow(string name,string? title);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern IntPtr GetDC(IntPtr window);
    [DllImport("user32.dll")] static extern int ReleaseDC(IntPtr window,IntPtr dc);
    [DllImport("gdi32.dll")] static extern uint GetPixel(IntPtr dc,int x,int y);
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr window);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window,out uint pid);
    [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
    [DllImport("user32.dll")] static extern bool AttachThreadInput(uint from,uint to,bool attach);
    [DllImport("user32.dll")] static extern IntPtr GetParent(IntPtr window);
    [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr parent,Callback callback,IntPtr data);
    [DllImport("user32.dll")] static extern bool IsWindow(IntPtr window);
    [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr window,StringBuilder text,int count);
    [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr window,StringBuilder text,int count);
    [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr context);
    [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr window,out NativeRect rect);
    [DllImport("user32.dll")] static extern bool GetCursorPos(out NativePoint point);
    [DllImport("user32.dll")] static extern IntPtr WindowFromPoint(NativePoint point);
    [DllImport("user32.dll")] static extern IntPtr GetAncestor(IntPtr window,uint flags);
    [DllImport("user32.dll")] static extern bool EnumWindows(Callback callback,IntPtr data);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr window);
    [DllImport("user32.dll")] static extern bool IsIconic(IntPtr window);
    [DllImport("user32.dll")] static extern bool IsZoomed(IntPtr window);
    [DllImport("user32.dll")] static extern bool SetCursorPos(int x,int y);
    [DllImport("user32.dll",SetLastError=true)] static extern uint SendInput(uint count,NativeInput[] input,int size);
    [StructLayout(LayoutKind.Sequential)] struct NativePoint { public int X,Y; }
    [StructLayout(LayoutKind.Sequential)] struct NativeRect { public int Left,Top,Right,Bottom; }
    [StructLayout(LayoutKind.Sequential)] struct NativeMouse { public int X,Y;public uint Data,Flags,Time;public UIntPtr Extra; }
    [StructLayout(LayoutKind.Explicit)] struct NativeUnion { [FieldOffset(0)] public NativeMouse Mouse; }
    [StructLayout(LayoutKind.Sequential)] struct NativeInput { public uint Type;public NativeUnion Value; }
    delegate bool Callback(IntPtr window,IntPtr data);
    public static async Task Run(string corePath,string hostDirectory,string installer,string sdk,string mediaDirectory,string evidenceDirectory,bool authoredNavigation=false,bool systemControls=false,bool productExit=false,string? configuratorPath=null,bool playerRecovery=false,string? lifecycleMedia=null)
    {
        if(lifecycleMedia is not null && lifecycleMedia is not ("image" or "gif" or "video" or "html"))throw new ArgumentException("Unknown lifecycle media");
        var authoredInput=authoredNavigation||systemControls||productExit;
        if(authoredInput&&!SetProcessDpiAwarenessContext(new IntPtr(-4)))throw new Exception("Navigation probe requires Core PerMonitorV2 DPI");
        GetCursorPos(out var originalCursor);
        corePath=Path.GetFullPath(corePath);var coreDirectory=Path.GetDirectoryName(corePath)!;hostDirectory=Path.GetFullPath(hostDirectory);
        var evidence=Directory.CreateDirectory(Path.GetFullPath(evidenceDirectory));
        var data=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"Dext");
        var saved=new Dictionary<string,byte[]?>();
        foreach(var relative in new[]{"WallpaperLayout.json","Settings.json",Path.Combine("v3","room-session.json"),Path.Combine("v3","personal","personal.json")})
        {var path=Path.Combine(data,relative);saved[path]=File.Exists(path)?File.ReadAllBytes(path):null;
            if(saved[path] is{} bytes)File.WriteAllBytes(Path.Combine(evidence.FullName,relative.Replace(Path.DirectorySeparatorChar,'_')+".before"),bytes);}
        if(saved[Path.Combine(data,"WallpaperLayout.json")]==null)throw new Exception("Current layout backup is required");
        var personalPath=Path.Combine(data,"v3","personal");var absentDirectories=new[]{Path.Combine(data,"v3"),personalPath}.Where(path=>!Directory.Exists(path)).ToArray();
        RoomPersonalStore? personal=null;
        var userRooms=new Dictionary<string,string>(StringComparer.OrdinalIgnoreCase);
        foreach(var item in JArray.Parse(Encoding.UTF8.GetString(saved[Path.Combine(data,"WallpaperLayout.json")]!)))
        {var path=Path.GetFullPath(Path.Combine((string)item["LivelyInfoPath"]!,"room.json"));if(File.Exists(path))userRooms[path]=Hash(File.ReadAllBytes(path));}
        var root=Directory.CreateTempSubdirectory("Dext-v3-core-native-");
        var host=Directory.CreateDirectory(Path.Combine(root.FullName,"host"));var source=Directory.CreateDirectory(Path.Combine(root.FullName,"source"));
        var originalForeground=GetForegroundWindow();Process? core=null;DesktopService.DesktopServiceClient? client=null;List<GetWallpapersResponse>? original=null;bool applied=false,restored=false;
        var events=new List<string>();var roomId=Guid.NewGuid().ToString();object? desktopShell=null;bool minimizedForTest=false;var windowsBefore=new Dictionary<IntPtr,(bool Minimized,bool Maximized)>();
        Process? configurator=null;bool productExited=false;
        NativeControlProbeDevices? controlDevices=null;int clicksSent=0;bool changedVolumeObserved=false,restoredVolumeObserved=false;
        try
        {
            if(systemControls){controlDevices=new();controlDevices.StartMedia(Path.Combine(Path.GetFullPath(mediaDirectory),"clip.mp4"));}
            foreach(var file in new[]{"LivelyInfo.json","index.html","main.js","style.css","layout-model.js","runtime-model.js","native-host.js","frame-host.js","media-host.js","playback-host.js","dom-host.js"})File.Copy(Path.Combine(hostDirectory,file),Path.Combine(host.FullName,file));
            File.AppendAllText(Path.Combine(host.FullName,"main.js"),"""
                ;(()=>{const documents=new Map(),audio=new Map(),storage=new Map(),actions=new Map(),slots=new Map(),nativeEvents=[],stages=[];let nav=0,first=null;
                  chrome.webview.addEventListener('message',e=>{const v=e.data;if(v.type==='dext:v3-native-event'&&v.kind==='activate'||v.type==='dext:v3-native-response'&&v.inputSequence>0)nativeEvents.push({type:v.type,kind:v.kind,status:v.status,inputSequence:v.inputSequence,inputConsumed:v.inputConsumed});if(nativeEvents.length>16)nativeEvents.shift();});
                  addEventListener('message',e=>{if(![...document.querySelectorAll('iframe')].some(f=>f.contentWindow===e.source))return;if(e.data?.liveSlot){slots.set(e.data.consumer,e.data);return;}if(!e.data?.liveDocument)return;documents.set(e.data.consumer,e.data.documentId);audio.set(e.data.consumer,e.data.web);storage.set(e.data.consumer,{...e.data.storage,value:e.data.storage.value&&{owner:e.data.storage.value.owner},existing:e.data.storage.existing&&{owner:e.data.storage.existing.owner}});actions.set(e.data.consumer,e.data.actions);});
                  const report=()=>{const d=dextRuntimeDiagnostics(),r=d.runtime;if(!r)return;
                    if(stages.at(-1)?.stage!==r.lifecycle.stage)stages.push({stage:r.lifecycle.stage,at:performance.now(),gif:false,mounted:false});
                    if(r.lifecycle.stage==='starting'&&document.querySelector('img[src$="animation.gif"]'))stages.at(-1).gif=true;
                    if(r.lifecycle.stage==='starting'&&document.querySelector('[data-consumer="slot.start"]')?.firstChild)stages.at(-1).mounted=true;
                    if(!first&&r.inputReady&&r.lifecycle.stage==='desktop')first=performance.now();
                    if(!__AUTHOR_NAV__&&first&&performance.now()-first>700&&nav===0&&r.currentDeskId==='home'&&r.lifecycle.stage==='desktop'&&!d.paused){nav++;chrome.webview.postMessage(JSON.stringify({type:'dext:v3-request-desk',sessionId:d.sessionId,deskId:'focus'}));}
                    document.title='DEXT_V3_LIVE:'+JSON.stringify({generation:d.runtimeGeneration,session:d.sessionId,revision:d.revision,current:r.currentDeskId,target:r.targetDeskId,
                      inputReady:r.inputReady,inputVersion:r.inputVersion,layout:r.layout?{revision:r.layout.revision,ready:r.layout.ready,error:r.layout.error}:null,stage:r.lifecycle.stage,paused:d.paused,frames:r.frames.count,instances:r.instances.map(v=>v.instanceId),documents:[...documents],nav,
                      error:r.lastError,frameError:r.frames.lastError,stages,audio:[...audio],storage:[...storage],actions:[...actions],nativeEvents,slots:[...slots],images:[...document.querySelectorAll('img')].map(v=>({consumer:v.parentElement.dataset.consumer,width:v.naturalWidth,hidden:v.parentElement.hidden})),videos:[...document.querySelectorAll('video')].map(v=>({consumer:v.parentElement.dataset.consumer,hidden:v.parentElement.hidden,ready:v.readyState,time:v.currentTime,paused:v.paused,loop:v.loop,muted:v.muted}))});
                  };
                  const original=dextNativePlaybackChanged;window.dextNativePlaybackChanged=value=>{const accepted=original(value);report();return accepted;};
                  setInterval(report,80);
                })();
                """.Replace("__AUTHOR_NAV__",authoredInput?"true":"false"));
            File.Copy(Path.GetFullPath(sdk),Path.Combine(source.FullName,"sdk.js"));
            foreach(var name in new[]{"animation.gif","clip.mp4"})File.Copy(Path.Combine(Path.GetFullPath(mediaDirectory),name),Path.Combine(source.FullName,name));
            File.WriteAllText(Path.Combine(source.FullName,"background.svg"),"<svg xmlns='http://www.w3.org/2000/svg' width='1920' height='1080'><rect width='1920' height='1080' fill='#204056'/></svg>");
            File.WriteAllText(Path.Combine(source.FullName,"author.html"),"""
                <!doctype html><button id=next style='position:fixed;left:20px;top:20px;width:120px;height:44px'>Next</button><h2 style='margin-top:80px'>Native Core SDK</h2><span id=readout>pending</span><script src=sdk.js></script><script>
                const documentId=crypto.randomUUID();Dext.ready().then(()=>{
                  const actions={timerError:null,clicks:0,results:[],exitTimer:null,exitResults:[]};let attempted=false;
                  if(__AUTHOR_NAV__){
                    const publish=()=>Dext.scene.publishGeometry({buttons:[{buttonId:'next',x:20,y:20,width:120,height:44},...(__PRODUCT_EXIT__&&Dext.session.consumerId==='scene'?[{buttonId:'exit',x:180,y:20,width:120,height:44}]:[])]}).catch(()=>{});
                    Dext.scene.subscribeGeometry(publish);Dext.desk.subscribe(value=>{publish();if(value.lifecycle.stage==='desktop'&&!attempted){attempted=true;let retries=0;const test=()=>(__SYSTEM_CONTROLS__?Dext.audio.control({muted:__ORIGINAL_MUTED__}):Dext.desk.navigate({type:'desk.next'})).then(v=>{actions.timerError=v.status;report();},e=>{if(e.code==='controlUnavailable'&&retries++<3){setTimeout(test,180);return;}actions.timerError=e.code;report();});setTimeout(test,250);}});
                    document.getElementById('next').addEventListener('click',()=>{const step=actions.clicks++;const command=!__SYSTEM_CONTROLS__||step===7?Dext.desk.navigate({type:'desk.next'}):step===0?Dext.audio.control({volume:__TEST_LEVEL__,muted:__ORIGINAL_MUTED__}):step===1?Dext.audio.control({volume:__ORIGINAL_LEVEL__,muted:__ORIGINAL_MUTED__}):Dext.media.control(['pause','play','toggle','next','previous'][step-2]);command.then(v=>{actions.results.push(v);report();},e=>{actions.results.push({error:e.code});report();});});
                  }
                  if(__PRODUCT_EXIT__&&Dext.session.consumerId==='scene'){
                    const button=document.createElement('button');button.textContent='Exit Dext';button.style.cssText='position:fixed;left:180px;top:20px;width:120px;height:44px';document.body.append(button);
                    button.addEventListener('click',()=>Dext.actions.activate('exit').then(v=>{actions.exitResults.push(v);report();},e=>{actions.exitResults.push({error:e.code});report();}));
                    let tested=false;Dext.desk.subscribe(v=>{if(v.lifecycle.stage==='desktop'&&!tested){tested=true;setTimeout(()=>Dext.actions.activate('exit').then(r=>{actions.exitTimer=r.status;report();}),300);}});
                  }
                  const context=new AudioContext(),oscillator=context.createOscillator(),gain=context.createGain();gain.gain.value=0;oscillator.connect(gain).connect(context.destination);oscillator.start();context.resume();
                  const storage={initialized:false,existing:null,value:null,lastError:null,reads:0,denied:0,dateType:null};let sampling=false;
                  const report=()=>parent.postMessage({liveDocument:true,consumer:Dext.session.consumerId,documentId,web:{state:context.state,time:context.currentTime},storage,actions},'*');report();context.addEventListener('statechange',report);
                  const sample=async()=>{if(sampling)return;sampling=true;try{
                    if(!storage.initialized){storage.existing=await Dext.storage.get('state');if(storage.existing===null)await Dext.storage.set('state',{owner:Dext.session.consumerId,documentId,label:'\u65e5\u671f',at:'2026-10-03T00:00:00Z',items:[1,true,null],privateMarker:'__PRIVATE_MARKER__'});storage.initialized=true;}
                    storage.value=await Dext.storage.get('state');storage.dateType=typeof storage.value?.at;storage.lastError=null;storage.reads++;
                  }catch(error){storage.lastError=error.code;if(['denied','missingPermission'].includes(error.code))storage.denied++;}finally{sampling=false;report();}};sample();setInterval(()=>{report();sample();},160);
                  Dext.data.bindReadout('time.read',document.getElementById('readout'),v=>String(v.unixMs));
                });
                </script>
                """.Replace("__PRIVATE_MARKER__","dext-kv-"+roomId).Replace("__AUTHOR_NAV__",authoredInput?"true":"false")
                .Replace("__PRODUCT_EXIT__",productExit?"true":"false").Replace("__SYSTEM_CONTROLS__",systemControls?"true":"false").Replace("__TEST_LEVEL__",JsonConvert.SerializeObject(controlDevices?.TestLevel??0))
                .Replace("__ORIGINAL_LEVEL__",JsonConvert.SerializeObject(controlDevices?.OriginalLevel??0)).Replace("__ORIGINAL_MUTED__",controlDevices?.OriginalMuted==true?"true":"false"));
            if(lifecycleMedia=="html")File.WriteAllText(Path.Combine(source.FullName,"slot.html"),"""
                <!doctype html><video muted loop autoplay src=clip.mp4></video><audio loop autoplay src=clip.mp4></audio><script src=sdk.js></script><script>
                const documentId=crypto.randomUUID();Dext.ready().then(()=>{
                  const context=new AudioContext(),osc=context.createOscillator(),gain=context.createGain();gain.gain.value=0;osc.connect(gain).connect(context.destination);osc.start();context.resume();
                  document.querySelector('video').play().catch(()=>{});document.querySelector('audio').muted=true;document.querySelector('audio').play().catch(()=>{});
                  const done={attempts:0,status:null,error:null};let finishing=false;
                  const report=()=>parent.postMessage({liveSlot:true,consumer:Dext.session.consumerId,documentId,state:context.state,time:context.currentTime,done,video:{time:document.querySelector('video').currentTime,paused:document.querySelector('video').paused}},'*');
                  report();context.addEventListener('statechange',report);setInterval(report,80);
                  setInterval(()=>{const life=Dext.session.snapshot.lifecycle;
                    if(Dext.session.consumerId!=='slot.start'||life.stage!=='starting'||life.playbackPaused||life.locked||context.currentTime<.65||finishing||done.status==='requested')return;
                    finishing=true;done.attempts++;Dext.scene.done().then(v=>{done.status=v.status;done.error=null;},e=>{done.error=e.code;}).finally(()=>{finishing=false;report();});
                  },100);
                });</script>
                """);
            var manifest=new{version=3,apiVersion=1,id=roomId,name="Actual native Core probe",startDesk="home",resources=new[]{"sdk.js","author.html","background.svg","animation.gif","clip.mp4"},
                start=new{type="gif",src="animation.gif"},roomScene=new{entry="author.html",capabilities=new[]{"desk.read","desk.navigate","time.read","storage.read","storage.write"}.Concat(systemControls?new[]{"media.control","audio.control"}:Array.Empty<string>()).Concat(productExit?new[]{"dext.exit"}:Array.Empty<string>()).ToArray()},transition=new{type="slide",durationMs=450},buttons=new[]{systemControls?new Dictionary<string,object>{{"id","next"},{"name","Control"},{"scope","room"}}:new Dictionary<string,object>{{"id","next"},{"name","Next"},{"scope","room"},{"action",new{type="desk.next"}}}}.Concat(productExit?new[]{new Dictionary<string,object>{{"id","exit"},{"name","Exit Dext"},{"scope","room"},{"action",new{type="dext.exit"}}}}:Array.Empty<Dictionary<string,object>>()).ToArray(),
                components=new[]{new{id="shared",role="widget",entry="author.html",placement=new{x=400,y=50,width=260,height=120},buttonIds=new[]{"next"},capabilities=new[]{"desk.read","desk.navigate","time.read","storage.read","storage.write"}.Concat(systemControls?new[]{"media.control","audio.control"}:Array.Empty<string>()).Concat(productExit?new[]{"dext.exit"}:Array.Empty<string>()).ToArray()}},
                desks=new[]{new{id="home",name="Home",icons=Array.Empty<object>(),components=new[]{"shared"},background=new{type="image",src="background.svg"}},new{id="focus",name="Focus",icons=Array.Empty<object>(),components=new[]{"shared"},background=new{type="video",src="clip.mp4"}}}};
            var roomManifest=JObject.FromObject(manifest);
            if(lifecycleMedia is not null){
                var src=lifecycleMedia switch{"image"=>"background.svg","gif"=>"animation.gif","video"=>"clip.mp4",_=>"slot.html"};
                var content=new JObject{{"type",lifecycleMedia},{"src",src}};
                roomManifest["start"]=content.DeepClone();roomManifest["idle"]=content.DeepClone();
                foreach(var desk in (JArray)roomManifest["desks"]!)desk["background"]=content.DeepClone();
                if(lifecycleMedia=="html")((JArray)roomManifest["resources"]!).Add("slot.html");
            }
            File.WriteAllText(Path.Combine(source.FullName,"room.json"),roomManifest.ToString(Formatting.Indented));
            var install=new ProcessStartInfo(Path.GetFullPath(installer)){UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden,RedirectStandardOutput=true,RedirectStandardError=true};
            foreach(var arg in new[]{"--install",source.FullName,Path.Combine(host.FullName,"content")})install.ArgumentList.Add(arg);
            using(var process=Process.Start(install)??throw new Exception("Installer did not start"))
            {var output=process.StandardOutput.ReadToEndAsync();var error=process.StandardError.ReadToEndAsync();await process.WaitForExitAsync();Require(process.ExitCode==0,"production install: "+await error);File.WriteAllText(Path.Combine(evidence.FullName,"installation.json"),await output);}
            Require(!Process.GetProcessesByName("Lively").Any(p=>{try{return Path.GetFullPath(p.MainModule!.FileName).Equals(corePath,StringComparison.OrdinalIgnoreCase);}catch{return false;}}),"test Core already running");
            var verified=RoomV3Installation.Verify(Path.Combine(host.FullName,"content"));personal=new RoomPersonalStore(personalPath);
            personal.Update(state=>{var room=new RoomPersonalData();state.Rooms.Add(roomId,room);foreach(var consumer in new[]{"scene","component.shared"})room.Grants.Add(consumer,new(verified.InstallationStamp,new[]{"desk.read","desk.navigate","time.read","storage.read","storage.write"}.Concat(systemControls?new[]{"media.control","audio.control"}:Array.Empty<string>()).Concat(productExit?new[]{"dext.exit"}:Array.Empty<string>()).ToArray()));});
            events.Add("fixture administrator granted declared navigation/storage only to the temporary verified Room consumers");
            // The user's grid coverage rule correctly pauses behind any maximized
            // visible window. This fixture exercises actual foreground decisions
            // instead, then restores the saved Settings.json byte-for-byte.
            var fixtureSettings=System.Text.Json.Nodes.JsonNode.Parse(saved[Path.Combine(data,"Settings.json")]! )!.AsObject();
            fixtureSettings["ProcessMonitorAlgorithm"]=0;
            if(lifecycleMedia is not null)fixtureSettings["ScreensaverLockOnResume"]=false;
            File.WriteAllText(Path.Combine(data,"Settings.json"),fixtureSettings.ToJsonString());
            events.Add("fixture playback uses foreground algorithm; original settings bytes remain backed up");
            await StartCore();
            if(productExit){
                Require(configuratorPath!=null,"native configurator path required");
                configurator=Process.Start(new ProcessStartInfo(Path.GetFullPath(configuratorPath!)){UseShellExecute=true,WindowStyle=ProcessWindowStyle.Hidden})??throw new Exception("Configurator did not start");
                await Task.Delay(1200);Require(!configurator.HasExited,"native configurator running");
                events.Add("native configurator pid="+configurator.Id+", path="+Path.GetFullPath(configurator.MainModule!.FileName));
            }
            var deadline=DateTime.UtcNow.AddSeconds(15);do{original=await Wallpapers();if(original.Count>0)break;await Task.Delay(100);}while(DateTime.UtcNow<deadline);Require(original.Count>0,"original wallpaper is restored before test");
            var screen=original!.FirstOrDefault(w=>w.Screen.IsPrimary)?.Screen??original[0].Screen;
            foreach(var old in original)Require(Directory.Exists(old.LivelyInfoPath),"original wallpaper directory available");
            CommandsService.CommandsServiceClient? lifecycleCommands=null;
            if(lifecycleMedia is not null){
                lifecycleCommands=new(new NamedPipeChannel(".",Constants.SingleInstance.GrpcPipeServerName));
                var pause=new AutomationCommandRequest();pause.Args.Add(new[]{"app","--play","false"});
                await lifecycleCommands.AutomationCommandAsync(pause,deadline:DateTime.UtcNow.AddSeconds(5));await Task.Delay(1500);
            }
            applied=true;await client!.SetWallpaperAsync(new SetWallpaperRequest{LivelyInfoPath=host.FullName,MonitorId=screen.DeviceId},deadline:DateTime.UtcNow.AddSeconds(20));
            if(lifecycleCommands is not null){
                var end=DateTime.UtcNow.AddSeconds(10);RoomSessionStatusResponse? starting=null;
                do{starting=await client!.GetRoomSessionAsync(new Empty(),deadline:DateTime.UtcNow.AddSeconds(2));if(starting.Active&&starting.RoomId==roomId&&starting.Lifecycle.Stage=="starting"&&starting.Lifecycle.PlaybackPaused)break;await Task.Delay(80);}while(DateTime.UtcNow<end);
                Require(starting is{Active:true}&&starting.RoomId==roomId&&starting.Lifecycle.Stage=="starting"&&starting.Lifecycle.PlaybackPaused,"real Core creates paused start");
                await Task.Delay(900);var held=await client!.GetRoomSessionAsync(new Empty(),deadline:DateTime.UtcNow.AddSeconds(2));
                Require(held.SessionId==starting.SessionId&&held.Lifecycle.Stage=="starting"&&held.Lifecycle.PlaybackPaused,"paused start cannot spend wall-time completion budget");
                events.Add("PASS "+lifecycleMedia+" actual Core paused startup retains session and does not complete during inactive wall time");
                var play=new AutomationCommandRequest();play.Args.Add(new[]{"app","--play","true"});await lifecycleCommands.AutomationCommandAsync(play,deadline:DateTime.UtcNow.AddSeconds(5));
            }
            FocusDesktop();RoomSessionStatusResponse? active=null;JObject? initial=null,final=null;IntPtr playerWindow=IntPtr.Zero;List<string>? documents=null;string? firstSession=null;int firstPid=0;bool clickSent=false;
            deadline=DateTime.UtcNow.AddSeconds(35);
            while(DateTime.UtcNow<deadline)
            {
                active=await client.GetRoomSessionAsync(new Empty(),deadline:DateTime.UtcNow.AddSeconds(2));
                if(active.Active&&active.RoomId==roomId&&active.PlayerPid>0)
                {
                    if(firstPid==0){firstPid=active.PlayerPid;firstSession=active.SessionId;events.Add("Core native session "+JsonConvert.SerializeObject(active));}
                    Require(firstPid==active.PlayerPid&&firstSession==active.SessionId,"same Core session and Player");
                    playerWindow=FindPlayer(firstPid);var observation=ReadObservation(playerWindow);
                    if(observation!=null)
                    {
                        if((string?)observation["stage"]=="desktop"&&(string?)observation["current"]=="home"&&(bool?)observation["inputReady"]==true&&((JArray?)observation["documents"])?.Count==2&&initial==null)
                        {initial=(JObject)observation.DeepClone();documents=((JArray)observation["documents"]!).Select(v=>v.ToString(Formatting.None)).Order().ToList();events.Add("initial "+initial.ToString(Formatting.None));}
                        if(authoredInput&&initial!=null&&(!systemControls?!clickSent:clicksSent<8)&&(bool?)observation["inputReady"]==true&&active.Operable&&
                            observation["actions"] is JArray readyActions&&readyActions.Count==2&&readyActions.All(v=>(string?)v[1]?["timerError"]=="inputRequired")&&(!systemControls||readyActions.Any(v=>(int?)v[1]?["clicks"]==clicksSent&&v[1]?["results"] is JArray completed&&completed.Count==clicksSent)))
                        {
                            if(systemControls){
                                var volume=await client.GetSystemVolumeAsync(new Empty(),deadline:DateTime.UtcNow.AddSeconds(2));
                                Require(volume.DeviceId==controlDevices!.DeviceId,"same default endpoint as saved audio device");
                                if(clicksSent==1){Require(Math.Abs(volume.Level-controlDevices.TestLevel)<.000001&&volume.Muted==controlDevices.OriginalMuted,"SDK actually changed native endpoint");changedVolumeObserved=true;events.Add("PASS actual author SDK audio.control changed native default endpoint to fixture level");}
                                if(clicksSent==2){Require(Math.Abs(volume.Level-controlDevices.OriginalLevel)<.000001&&volume.Muted==controlDevices.OriginalMuted,"SDK restored native endpoint");restoredVolumeObserved=true;events.Add("PASS actual author SDK audio.control restored original native volume/mute");}
                                if(clicksSent>=2&&clicksSent<=6){
                                    var media=await client.GetSystemMediaAsync(new Empty(),deadline:DateTime.UtcNow.AddSeconds(2));
                                    Require(media.HasSession&&media.Title==controlDevices.Title,"media command must target the owned muted fixture, never unrelated user playback");
                                    Require(controlDevices.Commands>=clicksSent-2,"prior actual owned media command callback observed");
                                }
                            }
                            Require(GetWindowRect(playerWindow,out var bounds),"native Player bounds");
                            var point=new NativePoint{X=bounds.Left+(int)Math.Round((bounds.Right-bounds.Left)*80.0/1920),Y=bounds.Top+(int)Math.Round((bounds.Bottom-bounds.Top)*42.0/1080)};
                            var hit=WindowFromPoint(point);GetWindowThreadProcessId(hit,out var hitPid);events.Add($"test point {point.X},{point.Y}; hit pid={hitPid}, class={Class(hit)}, root={Class(GetAncestor(hit,2))}");
                            if(!DesktopPoint(point)){
                                // Foregrounding Progman does not reveal desktop pixels.
                                // Shell tracks this temporary minimize set for Undo.
                                EnumWindows((window,_)=>{if(IsWindowVisible(window))windowsBefore[window]=(IsIconic(window),IsZoomed(window));return true;},IntPtr.Zero);
                                desktopShell=Activator.CreateInstance(System.Type.GetTypeFromProgID("Shell.Application")!)!;minimizedForTest=true;((dynamic)desktopShell).MinimizeAll();
                                await Task.Delay(700);events.Add("test temporarily shows the actual desktop; original window minimized/maximized flags captured");
                            }
                            FocusDesktop();await Task.Delay(400);
                            Require(DesktopPoint(point),"actual test pixel must belong to a desktop root, never a covering application");
                            Require(SetCursorPos(point.X,point.Y),"native test cursor");await Task.Delay(150);
                            var inputs=new[]{new NativeInput{Value=new NativeUnion{Mouse=new NativeMouse{Flags=2}}},new NativeInput{Value=new NativeUnion{Mouse=new NativeMouse{Flags=4}}}};
                            Require(SendInput(2,inputs,Marshal.SizeOf<NativeInput>())==2,"OS injected left down/up");clickSent=true;clicksSent++;events.Add("OS mouse injection sent through actual Windows/Core raw input; not manual physical acceptance");
                        }
                        if(initial!=null&&active.CurrentDeskId=="focus" &&active.TargetDeskId.Length==0&&(string?)observation["current"]=="focus"&&(long?)observation["revision"]==active.Revision&&(bool?)observation["inputReady"]==true&&ObservedAudio(observation)&&ObservedStorage(observation)&&ObservedBackground(observation))
                        {final=observation;break;}
                    }
                }
                await Task.Delay(80);
            }
            events.Add("last Core "+JsonConvert.SerializeObject(active));events.Add("last host "+ReadObservation(playerWindow)?.ToString(Formatting.None));var rawTitle=new StringBuilder(32768);GetWindowText(playerWindow,rawTitle,rawTitle.Capacity);events.Add("last title chars="+rawTitle.Length+", tail="+rawTitle.ToString()[Math.Max(0,rawTitle.Length-70)..]);
            Require(initial!=null&&final!=null,"actual Core native startup/geometry/navigation/commit; "+string.Join("\n",events));
            Require((int?)final!["frames"]==(lifecycleMedia=="html"?5:2)&&documents!.SequenceEqual(((JArray)final["documents"]!).Select(v=>v.ToString(Formatting.None)).Order()),"actual scene/shared SDK documents retained across Core commit");
            Require(final["frameError"]?.Type==JTokenType.Null,"expected stale capability cancellation is not a failure diagnostic");
            using(var player=Process.GetProcessById(firstPid))Require(Path.GetFullPath(player.MainModule!.FileName).Equals(Path.Combine(coreDirectory,"plugins","webview2","Lively.Player.WebView2.exe"),StringComparison.OrdinalIgnoreCase),"exact deployed Release Player");
            var parent=GetParent(playerWindow);var className=new StringBuilder(128);GetClassName(parent,className,className.Capacity);Require(className.ToString() is "WorkerW" or "Progman","real desktop parent: "+className);
            Require(ObservedStartup(final),"actual "+(lifecycleMedia??"GIF")+" startup observed before desktop on the new document");
            Require(ObservedAudio(final),"actual Core allows declared rendering of scene/shared WebAudio clocks");
            Require(ObservedLayout(initial!)&&ObservedLayout(final),"actual private Core layout read accepted before and after Desk commit");
            events.Add("PASS actual official DOM reads only current private Core layout revision zero before and after Desk commit");
            if(systemControls){
                Require(changedVolumeObserved&&restoredVolumeObserved&&clicksSent==8&&controlDevices!.Commands>=5,"all audio and five owned media intents actually reached Windows");
                Require((int?)final["nav"]==0&&final["actions"] is JArray values&&values.Any(v=>v[1]?["results"] is JArray replies&&replies.Count==8&&replies.All(r=>(string?)r["status"]=="accepted")),"all eight authored actions accepted without a trusted navigation driver");
                Require(final["nativeEvents"] is JArray receipts&&receipts.Count(v=>(string?)v["type"]=="dext:v3-native-response"&&(bool?)v["inputConsumed"]==true)==8,"one consumed Core receipt per real completion, no default duplicate");
                events.Add("PASS actual author SDK five media intents reached the owned muted Windows publisher through Core native proof");
                events.Add("PASS eight OS completions consumed once with status-only SDK receipts and no default double dispatch");
            }
            if(authoredNavigation){
                Require(clickSent&&(int?)final["nav"]==0,"navigation has no trusted top driver");
                Require(final["actions"] is JArray actionValues&&actionValues.Count==2&&actionValues.All(v=>(string?)v[1]?["timerError"]=="inputRequired")&&actionValues.Any(v=>(int?)v[1]?["clicks"]==1&&v[1]?["results"] is JArray results&&results.Any(r=>(string?)r["status"]=="accepted")),"actual author SDK navigation receipt and no-input timer refusal");
                Require(final["nativeEvents"] is JArray nativeValues&&nativeValues.Any(v=>(string?)v["kind"]=="activate"&&(long?)v["inputSequence"]>0)&&nativeValues.Count(v=>(string?)v["type"]=="dext:v3-native-response"&&(bool?)v["inputConsumed"]==true)==1,"one real native completion and one consumed action");
                events.Add("PASS actual author SDK desk.navigate/current consumer/private native proof/Core commit/accepted receipt/no timer authority/no double default through OS mouse injection (manual physical gate remains)");
            }
            events.Add("PASS actual production Rust install/Core reverify/native SDK/geometry/"+(lifecycleMedia??"GIF") +" startup/decoded background/Core commit/same Player and documents/desktop parent "+(authoredInput?"(author SDK native actions with OS injection)":"(trusted top navigation; not physical input)"));
            var persisted=personal.Read().Rooms[roomId].Storage;Require(persisted.Count==2&&persisted.All(p=>p.Value["state"].GetProperty("owner").GetString()==p.Key&&p.Value["state"].GetProperty("label").GetString()=="\u65e5\u671f"&&p.Value["state"].GetProperty("at").GetString()=="2026-10-03T00:00:00Z"),"actual Core stored separate Unicode/ISO JSON values in both consumer namespaces");
            events.Add("PASS actual SDK storage writes/reads through production Core private authority and isolates two identical keys");
            var coreLog=Directory.EnumerateFiles(Path.Combine(data,"logs"),"*.txt").OrderByDescending(File.GetLastWriteTimeUtc)
                .Select(ReadSharedLog).First(text=>text.Contains($"pid={core!.Id} |",StringComparison.Ordinal));
            Require(!coreLog.Contains("dext-kv-"+roomId,StringComparison.Ordinal),"private storage values must not be copied into Core IPC diagnostics");
            events.Add("PASS actual Core IPC diagnostics exclude private KV contents");
            GrantRead(false);await WaitStorage(observation=>ObservedStorageDenied(observation),"storage read consent withdrawn");
            events.Add("PASS actual same-installation consumer storage reads reject withdrawn personal consent");
            GrantRead(true);await WaitStorage(observation=>ObservedStorage(observation),"storage read consent restored");
            events.Add("PASS actual author storage recovers from restored consent without document reload");
            var stamp=active!.InstallationStamp;await StopCore();if(productExit)Require(configurator?.HasExited==false,"ordinary Core exit preserves configurator");await StartCore();FocusDesktop();
            RoomSessionStatusResponse? restoredSession=null;JObject? restartedHost=null,lastRestartedHost=null;bool focusedAfterRestart=false;deadline=DateTime.UtcNow.AddSeconds(35);
            while(DateTime.UtcNow<deadline)
            {
                restoredSession=await client!.GetRoomSessionAsync(new Empty(),deadline:DateTime.UtcNow.AddSeconds(2));
                if(restoredSession.Active&&restoredSession.RoomId==roomId&&restoredSession.PlayerPid>0)
                {
                    var observation=ReadObservation(FindPlayer(restoredSession.PlayerPid));lastRestartedHost=observation;
                    if((authoredInput||playerRecovery)&&!focusedAfterRestart&&(string?)observation?["stage"]=="desktop"){
                        var foreground=GetForegroundWindow();GetWindowThreadProcessId(foreground,out var foregroundPid);events.Add($"restart foreground before final native initialization: pid={foregroundPid}, class={Class(foreground)}");
                        FocusDesktop();focusedAfterRestart=true;await Task.Delay(150);continue;
                    }
                    if(restoredSession.CurrentDeskId=="focus"&&restoredSession.TargetDeskId.Length==0&&restoredSession.InstallationStamp==stamp&&
                        observation!=null&&(string?)observation["stage"]=="desktop"&&(string?)observation["current"]=="focus"&&(bool?)observation["inputReady"]==true&&
                        (long?)observation["revision"]==restoredSession.Revision&&ObservedAudio(observation)&&ObservedStorage(observation,true)&&((JArray?)observation["documents"])?.Count==2&&
                        ObservedBackground(observation))
                    {restartedHost=observation;break;}
                }
                await Task.Delay(80);
            }
            events.Add("restarted Core "+JsonConvert.SerializeObject(restoredSession));events.Add("restarted host "+(restartedHost??lastRestartedHost)?.ToString(Formatting.None));
            Require(restartedHost!=null&&restoredSession!.SessionId!=firstSession&&restoredSession.PlayerPid!=firstPid,"new Core session and Player restore committed focus from the same installed copy");
            Require((int?)restartedHost!["nav"]==0&&restartedHost["frameError"]?.Type==JTokenType.Null,"restart restoration requires no navigation driver and has no frame authorization error");
            var nextDocuments=((JArray)restartedHost["documents"]!).Select(v=>v.ToString(Formatting.None)).Order().ToList();
            Require(nextDocuments.All(v=>!documents!.Contains(v)),"new Player owns new SDK documents after restart");
            Require(ObservedStartup(restartedHost),"new Player replays "+(lifecycleMedia??"GIF")+" startup once before restored desktop");
            Require(ObservedAudio(restartedHost),"actual Core restart releases restored scene/shared AudioContexts");
            Require(ObservedStorage(restartedHost,true),"new SDK documents read the same persisted consumer values without test rewritten data");
            Require(ObservedLayout(restartedHost),"new official DOM reloads the same Core layout after normal restart");
            events.Add("PASS actual official DOM reloads current private Core layout after normal restart (no layout save performed)");
            Require(System.Text.Json.JsonSerializer.Serialize(personal.Read().Rooms[roomId].Storage)==System.Text.Json.JsonSerializer.Serialize(persisted),"restart and permission recovery did not overwrite persisted author values");
            events.Add("PASS actual Core restart restores persisted consumer JSON into two new SDK documents");
            events.Add("PASS actual normal Core restart restores committed focus/same installation with new Player/session/SDK documents/"+(lifecycleMedia??"GIF")+" startup/decoded background and no test navigation");
            if(lifecycleMedia is not null){
                var commands=new CommandsService.CommandsServiceClient(new NamedPipeChannel(".",Constants.SingleInstance.GrpcPipeServerName));
                var session=restoredSession!.SessionId;var pid=restoredSession.PlayerPid;var before=(JObject)restartedHost!.DeepClone();
                var originalPlayer=FindPlayer(pid);var originalParent=GetParent(originalPlayer);Require(GetWindowRect(originalPlayer,out var originalBounds),"desktop bounds before idle");
                for(var cycle=0;cycle<2;cycle++){
                    await commands.ScreensaverAsync(new ScreensaverRequest{State=ScreensaverState.Start,FadeIn=false},deadline:DateTime.UtcNow.AddSeconds(5));
                    var idle=await WaitLifecycle("idle",false);
                    Require(!idle.Status.Operable&&GetParent(FindPlayer(pid))!=originalParent,"same Player actually presented as native idle");
                    if(cycle==0){
                        var acquired=(JObject)idle.Host.DeepClone();
                        if(lifecycleMedia=="gif"){var moving=await SampleGif();Require(moving.Distinct().Count()>1,"actual GIF screen pixels animate before private pause");events.Add("gif active screen pixels "+string.Join(",",moving));}
                        await Playback(true);var paused=await WaitLifecycle("idle",true);
                        Require((bool?)paused.Host["paused"]==true&&paused.Host["videos"] is JArray pausedVideos&&pausedVideos.All(v=>(bool?)v["paused"]==true),"actual private playback barrier pauses all top video nodes");

                        if(lifecycleMedia=="gif"){var frozen=await SampleGif();events.Add("gif paused screen pixels "+string.Join(",",frozen));Require(frozen.Distinct().Count()==1,"actual GIF screen pixels freeze during private pause");}
                        await Task.Delay(1400);
                        var held=ReadObservation(FindPlayer(pid));Require(held!=null&&(bool?)held["paused"]==true,"paused renderer retains private barrier receipt");
                        await Playback(false);var resumed=await WaitLifecycle("idle",false);
                        Require((bool?)resumed.Host["paused"]==false,"actual private playback resume");
                        if(lifecycleMedia=="gif"){var moving=await SampleGif();Require(moving.Distinct().Count()>1,"actual GIF screen pixels resume animation");events.Add("PASS actual GIF on-screen pixels animate/freeze/resume across private pause "+string.Join(",",moving));}
                        if(lifecycleMedia is "video" or "html"){
                            double Clock(JObject host)=>lifecycleMedia=="video"?(double)((JArray)host["videos"]!).First(v=>(string?)v["consumer"]=="slot.idle")["time"]!:(double)((JArray)host["slots"]!).First(v=>(string?)v[0]=="slot.idle")[1]!["time"]!;
                            var stoppedAt=Clock(paused.Host);var resumedAt=Clock(resumed.Host);
                            Require(resumedAt>=stoppedAt-.05&&resumedAt-stoppedAt<.8,"media clock excludes 1400ms paused wall time");
                            await Task.Delay(700);var progressed=ReadObservation(FindPlayer(pid))!;
                            Require(Clock(progressed)>resumedAt+.2,"media clock progresses after private resume");
                            events.Add("PASS "+lifecycleMedia+" actual idle media clock excludes pause duration and progresses after resume");
                        }
                        Require(SameDocuments(acquired,resumed.Host)&&SameInstances(acquired,resumed.Host),"idle pause/resume retains all documents and instances");
                        events.Add("PASS "+lifecycleMedia+" actual Core native idle/private pause/resume retains phase/PID/session/Desk/documents/instances");
                    }
                    if(cycle==0){
                        // Actual Windows movement reaches the screensaver's production
                        // RawInput wake path; it is not a private stage setter.
                        var input=new[]{new NativeInput{Value=new NativeUnion{Mouse=new NativeMouse{X=2,Flags=1}}}};
                        Require(SendInput(1,input,Marshal.SizeOf<NativeInput>())==1,"OS mouse wake");
                    }else await commands.ScreensaverAsync(new ScreensaverRequest{State=ScreensaverState.Stop},deadline:DateTime.UtcNow.AddSeconds(5));
                    var awake=await WaitLifecycle("desktop",false);var currentPlayer=FindPlayer(pid);
                    Require(GetParent(currentPlayer)==originalParent&&GetWindowRect(currentPlayer,out var awakeBounds)&&awakeBounds.Equals(originalBounds),"wake restores original native parent and bounds");
                    Require(SameDocuments(before,awake.Host)&&((JArray)before["instances"]!).All(v=>((JArray)awake.Host["instances"]!).Any(x=>JToken.DeepEquals(x,v))),"wake retains desktop consumers");
                    Require(((JArray)awake.Host["stages"]!).Count(v=>(string?)v["stage"]=="starting")==1&&(int?)awake.Host["nav"]==0,"wake does not replay start or navigate");
                    events.Add("PASS "+lifecycleMedia+" native "+(cycle==0?"OS-input wake":"Core stop")+" restores desktop parent/bounds/same Desk/documents/start count");
                }
                async Task<List<uint>> SampleGif(){
                    var window=FindPlayer(pid);Require(GetWindowRect(window,out var bounds),"GIF window bounds");
                    var point=new NativePoint{X=(bounds.Left+bounds.Right)/2,Y=(bounds.Top+bounds.Bottom)/2};
                    GetWindowThreadProcessId(GetAncestor(WindowFromPoint(point),2),out var owner);Require(owner==pid,"GIF screen sample belongs to this owned fullscreen Player");
                    var colors=new List<uint>();
                    for(var sample=0;sample<10;sample++){
                        var dc=GetDC(IntPtr.Zero);Require(dc!=IntPtr.Zero,"screen DC");
                        try{var color=GetPixel(dc,point.X,point.Y);Require(color!=uint.MaxValue,"screen pixel available");colors.Add(color);}finally{ReleaseDC(IntPtr.Zero,dc);}
                        await Task.Delay(110);
                    }
                    return colors;
                }
                async Task Playback(bool paused){var request=new AutomationCommandRequest();request.Args.Add(new[]{"app","--play",paused?"false":"true"});await commands.AutomationCommandAsync(request,deadline:DateTime.UtcNow.AddSeconds(5));}
                async Task<(RoomSessionStatusResponse Status,JObject Host)> WaitLifecycle(string stage,bool paused){
                    var end=DateTime.UtcNow.AddSeconds(12);RoomSessionStatusResponse? status=null;JObject? observed=null;
                    while(DateTime.UtcNow<end){
                        status=await client!.GetRoomSessionAsync(new Empty(),deadline:DateTime.UtcNow.AddSeconds(2));observed=ReadObservation(FindPlayer(pid));
                        Require(!core!.HasExited&&status.SessionId==session&&status.PlayerPid==pid&&status.CurrentDeskId=="focus","lifecycle retains Core/player/session/committed Desk");
                        if(status.Lifecycle.Stage==stage&&status.Lifecycle.PlaybackPaused==paused&&observed!=null&&(string?)observed["stage"]==stage&&(bool?)observed["paused"]==paused&&PausedPictureVisible(pid)==paused){
                            if(stage=="desktop"?ObservedBackground(observed):paused||ObservedBackground(observed,"slot.idle")){events.Add(lifecycleMedia+" "+stage+" paused="+paused+" "+observed.ToString(Formatting.None));return(status,observed);}
                        }
                        await Task.Delay(80);
                    }
                    events.Add("lifecycle timeout "+JsonConvert.SerializeObject(status)+" "+observed?.ToString(Formatting.None));throw new TimeoutException(lifecycleMedia+" "+stage+" pause="+paused);
                }
                static bool SameDocuments(JObject a,JObject b)=>JToken.DeepEquals(a["documents"],b["documents"])&&a["slots"]!.All(v=>b["slots"]!.Any(x=>JToken.DeepEquals(x[0],v[0])&&JToken.DeepEquals(x[1]!["documentId"],v[1]!["documentId"])));
                static bool SameInstances(JObject a,JObject b)=>JToken.DeepEquals(a["instances"],b["instances"]);
            }
            if(playerRecovery){
                var corePid=core!.Id;var deadPid=restoredSession!.PlayerPid;var deadSession=restoredSession.SessionId;
                var deadWindow=FindPlayer(deadPid);var deadDocuments=nextDocuments;
                using(var failed=Process.GetProcessById(deadPid)){
                    Require(Path.GetFullPath(failed.MainModule!.FileName!).Equals(Path.Combine(coreDirectory,"plugins","webview2","Lively.Player.WebView2.exe"),StringComparison.OrdinalIgnoreCase),"fault targets only exact owned ReleasePlayer");
                    failed.Kill();await failed.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(10));
                }
                JObject? recovered=null;RoomSessionStatusResponse? recovery=null;var stop=DateTime.UtcNow.AddSeconds(30);
                while(DateTime.UtcNow<stop){
                    recovery=await client!.GetRoomSessionAsync(new Empty(),deadline:DateTime.UtcNow.AddSeconds(2));
                    if(recovery.Active&&recovery.PlayerPid>0&&recovery.PlayerPid!=deadPid){
                        FocusDesktop();var observation=ReadObservation(FindPlayer(recovery.PlayerPid));
                        if(recovery.CurrentDeskId=="focus"&&recovery.TargetDeskId.Length==0&&recovery.InstallationStamp==stamp&&
                            (string?)observation?["stage"]=="desktop"&&(string?)observation["current"]=="focus"&&(bool?)observation["inputReady"]==true&&
                            (long?)observation["revision"]==recovery.Revision&&ObservedAudio(observation)&&ObservedStorage(observation,true)&&
                            ObservedBackground(observation)){recovered=observation;break;}
                    }
                    await Task.Delay(80);
                }
                events.Add("independent Player recovery Core "+JsonConvert.SerializeObject(recovery));events.Add("independent Player recovery host "+recovered?.ToString(Formatting.None));
                Require(recovered!=null&&!core.HasExited&&core.Id==corePid&&recovery!.SessionId!=deadSession,"actual Core automatically rebuilds independently failed Player with new session");
                Require(!IsWindow(deadWindow)&&ObservedStartup(recovered!)&&(int?)recovered!["nav"]==0,"old window gone and new document starts once without navigation driver");
                var recoveredDocuments=((JArray)recovered["documents"]!).Select(v=>v.ToString(Formatting.None)).ToList();
                Require(recoveredDocuments.Count==2&&recoveredDocuments.All(v=>!deadDocuments.Contains(v)),"new Player owns fresh SDK documents");
                Require(System.Text.Json.JsonSerializer.Serialize(personal.Read().Rooms[roomId].Storage)==System.Text.Json.JsonSerializer.Serialize(persisted),"Player recovery retains exact persisted consumer KV");
                events.Add("PASS independent owned Player fault rebuilds on the same Core with committed focus/same stamp/new PID/session/documents/startup/video/audio/KV");
                await client!.CloseAllWallpapersAsync(new CloseAllWallpapersRequest(),deadline:DateTime.UtcNow.AddSeconds(10));
                await Task.Delay(1500);
                Require((await Wallpapers()).Count==0&&!(await client.GetRoomSessionAsync(new Empty())).Active,"normal close cannot resurrect failed Player");
                events.Add("PASS normal close retires recovered session and does not rebuild the Player");
            }
            if(productExit){
                Require(configurator?.HasExited==false,"native configurator survives ordinary Core restart");
                events.Add("PASS ordinary Core shutdown and same-installation restart preserve native configurator");
                for(var choice=0;choice<2;choice++){
                    var stop=DateTime.UtcNow.AddSeconds(15);RoomSessionStatusResponse? status=null;JObject? observation=null;
                    do {FocusDesktop();await Task.Delay(160);status=await client!.GetRoomSessionAsync(new Empty(),deadline:DateTime.UtcNow.AddSeconds(2));observation=ReadObservation(FindPlayer(status.PlayerPid));
                        if(status.Operable&&(bool?)observation?["inputReady"]==true&&observation?["actions"] is JArray actions&&actions.Any(v=>(string?)v[1]?["exitTimer"]=="inputRequired"))break;
                    }while(DateTime.UtcNow<stop);
                    Require(status!.Operable&&(bool?)observation?["inputReady"]==true,"real exit entry input ready");
                    Require(observation!["actions"] is JArray timers&&timers.Any(v=>(string?)v[1]?["exitTimer"]=="inputRequired"),"exit timer cannot open confirmation without actual input");
                    var currentPlayer=FindPlayer(status.PlayerPid);Require(GetWindowRect(currentPlayer,out var rect),"exit Player bounds");
                    var point=new NativePoint{X=rect.Left+(int)Math.Round((rect.Right-rect.Left)*240.0/1920),Y=rect.Top+(int)Math.Round((rect.Bottom-rect.Top)*42.0/1080)};
                    Require(DesktopPoint(point),"exit entry must be exposed on actual desktop");
                    await Click(point);
                    IntPtr dialog=IntPtr.Zero;stop=DateTime.UtcNow.AddSeconds(8);
                    do {EnumWindows((window,_)=>{GetWindowThreadProcessId(window,out var pid);var text=new StringBuilder(128);GetWindowText(window,text,text.Capacity);
                        if(pid==core!.Id&&Class(window)=="#32770"&&text.ToString()=="Dext 退出确认"&&IsWindowVisible(window)&&GetDlgItem(window,6)!=IntPtr.Zero&&GetDlgItem(window,7)!=IntPtr.Zero&&(SendMessageW(window,0x400,IntPtr.Zero,IntPtr.Zero).ToInt64()&0xffff)==7){dialog=window;return false;}return true;},IntPtr.Zero);
                        if(dialog!=IntPtr.Zero)break;await Task.Delay(80);
                    }while(DateTime.UtcNow<stop);
                    Require(dialog!=IntPtr.Zero,"actual trusted Core-owned native confirmation");
                    Require((SendMessageW(dialog,0x400,IntPtr.Zero,IntPtr.Zero).ToInt64()&0xffff)==7,"native confirmation defaults to No");
                    var textSeen=false;EnumChildWindows(dialog,(window,_)=>{var text=new StringBuilder(512);GetWindowText(window,text,text.Capacity);if(text.ToString().Contains("回到普通 Windows 桌面"))textSeen=true;return true;},IntPtr.Zero);
                    Require(textSeen,"fixed native Dext explanation, not author text");
                    var button=GetDlgItem(dialog,choice==0?7:6);Require(button!=IntPtr.Zero,"native No/Yes button");Require(GetWindowRect(button,out var bounds),"native button bounds");
                    var buttonPoint=new NativePoint{X=(bounds.Left+bounds.Right)/2,Y=(bounds.Top+bounds.Bottom)/2};
                    IntPtr buttonHit=IntPtr.Zero;uint buttonPid=0;stop=DateTime.UtcNow.AddSeconds(3);
                    do{buttonHit=WindowFromPoint(buttonPoint);GetWindowThreadProcessId(buttonHit,out buttonPid);if(buttonPid==core!.Id)break;await Task.Delay(80);}while(DateTime.UtcNow<stop);
                    GetWindowThreadProcessId(GetForegroundWindow(),out var foregroundPid);
                    events.Add($"native choice {choice}: button={button}, bounds={bounds.Left},{bounds.Top},{bounds.Right},{bounds.Bottom}, hit={buttonHit}/{Class(buttonHit)}/pid{buttonPid}, foreground pid={foregroundPid}, Core pid={core!.Id}");
                    Require(buttonPid==core.Id,"native confirmation button must be exposed to real OS input");
                    await Click(buttonPoint);
                    if(choice==0){
                        stop=DateTime.UtcNow.AddSeconds(5);while(IsWindow(dialog)&&DateTime.UtcNow<stop)await Task.Delay(80);
                        events.Add($"cancel actual dialog exists={IsWindow(dialog)}, core exited={core!.HasExited}, configurator exited={configurator?.HasExited}");
                        Require(!IsWindow(dialog)&&!core.HasExited&&configurator?.HasExited==false,"cancel preserves Core and configurator");
                        Require(Process.GetProcessById(status.PlayerPid).HasExited==false,"cancel preserves native Player");
                        Require(!(await client.GetCoreStatsAsync(new Empty())).IsProductExiting,"cancel does not publish product-exit notice");
                        events.Add("PASS actual Core native confirmation defaults No; OS click No cancels and preserves Core/Player/configurator");
                    }else{
                        using var player=Process.GetProcessById(status.PlayerPid);
                        await Task.WhenAll(core!.WaitForExitAsync(),configurator!.WaitForExitAsync(),player.WaitForExitAsync()).WaitAsync(TimeSpan.FromSeconds(12));
                        Require(core.ExitCode==0&&configurator.ExitCode==0,"normal product process exit codes");
                        Require(!IsWindow(currentPlayer)&&!IsWindow(dialog),"native desktop Player and confirmation removed");
                        var watchdogStop=DateTime.UtcNow.AddSeconds(3);
                        while(Process.GetProcessesByName("Lively.Watchdog").Any(p=>{try{return Path.GetFullPath(p.MainModule!.FileName).StartsWith(coreDirectory,StringComparison.OrdinalIgnoreCase);}catch{return false;}})&&DateTime.UtcNow<watchdogStop)await Task.Delay(80);
                        Require(!Process.GetProcessesByName("Lively.Watchdog").Any(p=>{try{return Path.GetFullPath(p.MainModule!.FileName).StartsWith(coreDirectory,StringComparison.OrdinalIgnoreCase);}catch{return false;}}),"own Watchdog exits");
                        productExited=true;
                        events.Add("PASS OS click Yes: same-worktree native configurator/Core/ReleasePlayer/Watchdog normally exit and desktop wallpaper window is removed");
                    }
                }
            }

        }
        catch(Exception error){events.Add("FAIL primary test: "+error);throw;}
        finally
        {
            try
            {
                if(core!=null&&!core.HasExited)CancelOwnedConfirmation(core.Id);
                if(lifecycleMedia is not null&&core!=null&&!core.HasExited){
                    var commands=new CommandsService.CommandsServiceClient(new NamedPipeChannel(".",Constants.SingleInstance.GrpcPipeServerName));
                    await commands.ScreensaverAsync(new ScreensaverRequest{State=ScreensaverState.Stop},deadline:DateTime.UtcNow.AddSeconds(5));
                    var play=new AutomationCommandRequest();play.Args.Add(new[]{"app","--play","true"});await commands.AutomationCommandAsync(play,deadline:DateTime.UtcNow.AddSeconds(5));
                }
                if(productExited){core?.Dispose();core=null;client=null;events.Add("whole-product exit leaves ordinary Windows desktop; original saved layout/data restored below without restarting Dext");}
                if(applied&&client!=null&&original!=null)
                {
                    await client.CloseWallpaperLibraryAsync(new CloseWallpaperLibraryRequest{LivelyInfoPath=host.FullName},deadline:DateTime.UtcNow.AddSeconds(10));
                    foreach(var old in original)await client.SetWallpaperAsync(new SetWallpaperRequest{LivelyInfoPath=old.LivelyInfoPath,MonitorId=old.Screen.DeviceId},deadline:DateTime.UtcNow.AddSeconds(20));
                    var check=await Wallpapers();Require(original.All(w=>check.Any(c=>c.Screen.DeviceId==w.Screen.DeviceId&&Path.GetFullPath(c.LivelyInfoPath).Equals(Path.GetFullPath(w.LivelyInfoPath),StringComparison.OrdinalIgnoreCase))),"original wallpaper runtime restored");
                    Require(!(await client.GetRoomSessionAsync(new Empty())).Active,"original v2 native session inactive");events.Add("original wallpaper runtime restored");
                }
                controlDevices?.Restore();
                if(systemControls){Require(controlDevices!.IsRestored(),"original exact endpoint restored before normal Core exit");events.Add("PASS original native endpoint volume/mute restored");}
                await StopCore();
                foreach(var pair in saved){if(pair.Value==null){if(File.Exists(pair.Key))File.Delete(pair.Key);}else File.WriteAllBytes(pair.Key,pair.Value);}
                Require(saved.All(p=>p.Value==null?!File.Exists(p.Key):File.Exists(p.Key)&&Hash(File.ReadAllBytes(p.Key))==Hash(p.Value)),"original layout/settings/checkpoint bytes restored");
                Require(userRooms.All(p=>File.Exists(p.Key)&&Hash(File.ReadAllBytes(p.Key))==p.Value),"user Room bytes unchanged");
                foreach(var directory in absentDirectories.Reverse())if(Directory.Exists(directory)&&!Directory.EnumerateFileSystemEntries(directory).Any())
                {Require(Path.GetFullPath(directory).StartsWith(Path.GetFullPath(data).TrimEnd('\\')+"\\",StringComparison.OrdinalIgnoreCase),"new private directory containment");Directory.Delete(directory);}
                events.Add("PASS original personal snapshot bytes or missing state restored; temporary Room grants/KV removed");
                restored=true;events.Add("PASS original layout/settings/checkpoint exact bytes and user Room hashes restored after normal Core exit");
            }
            finally
            {
                if(minimizedForTest&&desktopShell!=null){
                    try{((dynamic)desktopShell).UndoMinimizeAll();await Task.Delay(500);
                        Require(windowsBefore.All(p=>!IsWindow(p.Key)||(IsIconic(p.Key),IsZoomed(p.Key))==p.Value),"original minimized/maximized window flags restored");events.Add("PASS temporary show-desktop window flags restored");
                    }finally{Marshal.ReleaseComObject(desktopShell);}
                }
                if(originalForeground!=IntPtr.Zero&&IsWindow(originalForeground))SetForegroundWindow(originalForeground);
                File.WriteAllLines(Path.Combine(evidence.FullName,"native-core-live.log"),events);
                if(restored){var temp=Path.GetFullPath(Path.GetTempPath()).TrimEnd('\\')+"\\";Require(root.FullName.StartsWith(temp,StringComparison.OrdinalIgnoreCase),"fixture cleanup root containment");root.Delete(true);}
                else Console.Error.WriteLine("Native Core recovery pending; fixture retained: "+root.FullName+"; backups: "+evidence.FullName);
                if(configurator!=null){if(!configurator.HasExited){configurator.CloseMainWindow();await configurator.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(10));}configurator.Dispose();}
                core?.Dispose();controlDevices?.Dispose();if(authoredInput)SetCursorPos(originalCursor.X,originalCursor.Y);
            }
        }
        foreach(var item in events.Where(e=>e.StartsWith("PASS")))Console.WriteLine(item);
        void GrantRead(bool granted)=>personal!.Update(state=>{foreach(var consumer in new[]{"scene","component.shared"}){var grant=state.Rooms[roomId].Grants[consumer];state.Rooms[roomId].Grants[consumer]=grant with{Capabilities=granted?new[]{"desk.read","desk.navigate","time.read","storage.read","storage.write"}.Concat(systemControls?new[]{"media.control","audio.control"}:Array.Empty<string>()).Concat(productExit?new[]{"dext.exit"}:Array.Empty<string>()).ToArray():new[]{"desk.read","desk.navigate","time.read","storage.write"}.Concat(systemControls?new[]{"media.control","audio.control"}:Array.Empty<string>()).Concat(productExit?new[]{"dext.exit"}:Array.Empty<string>()).ToArray()};}});
        async Task WaitStorage(Func<JObject,bool> accepted,string reason)
        {
            var stop=DateTime.UtcNow.AddSeconds(12);while(DateTime.UtcNow<stop){var status=await client!.GetRoomSessionAsync(new Empty(),deadline:DateTime.UtcNow.AddSeconds(2));var observation=ReadObservation(FindPlayer(status.PlayerPid));
                if(observation!=null&&accepted(observation)){events.Add(reason+" "+observation["storage"]!.ToString(Formatting.None));return;}await Task.Delay(80);}throw new TimeoutException(reason);
        }
        async Task StartCore()
        {
            core=Process.Start(new ProcessStartInfo(corePath){WorkingDirectory=coreDirectory,UseShellExecute=true,WindowStyle=ProcessWindowStyle.Hidden})??throw new Exception("Core did not start");
            client=new DesktopService.DesktopServiceClient(new NamedPipeChannel(".",Constants.SingleInstance.GrpcPipeServerName));
            var stop=DateTime.UtcNow.AddSeconds(30);GetCoreStatsResponse? stats=null;
            while(DateTime.UtcNow<stop){try{stats=await client.GetCoreStatsAsync(new Empty(),deadline:DateTime.UtcNow.AddSeconds(2));if(stats.IsCoreInitialized)break;}catch(RpcException){}await Task.Delay(120);}
            Require(stats?.IsCoreInitialized==true&&stats.ProcessId==core.Id&&Path.GetFullPath(stats.BaseDirectory).TrimEnd('\\').Equals(coreDirectory,StringComparison.OrdinalIgnoreCase),"exact worktree Core identity");
        }
        async Task StopCore()
        {
            if(core==null)return;
            if(!core.HasExited)
            {
                using var close=Process.Start(new ProcessStartInfo(corePath){UseShellExecute=true,WindowStyle=ProcessWindowStyle.Hidden,Arguments="app --shutdown true"})??throw new Exception("Core shutdown did not start");
                await close.WaitForExitAsync();await core.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(10));
            }
            core.Dispose();core=null;
        }
        async Task<List<GetWallpapersResponse>> Wallpapers(){var items=new List<GetWallpapersResponse>();using var stream=client!.GetWallpapers(new Empty(),deadline:DateTime.UtcNow.AddSeconds(10));while(await stream.ResponseStream.MoveNext(CancellationToken.None))items.Add(stream.ResponseStream.Current);return items;}
        static bool ObservedLayout(JObject observation)=>(long?)observation["layout"]?["revision"]==0&&(bool?)observation["layout"]?["ready"]==true&&observation["layout"]?["error"]?.Type==JTokenType.Null;
        static bool ObservedStorage(JObject observation,bool restarted=false)=>observation["storage"] is JArray values&&values.Count==2&&values.All(v=>v is JArray pair&&pair.Count==2&&pair[1] is JObject storage&&
            (bool?)storage["initialized"]==true&&(int?)storage["reads"]>0&&storage["lastError"]?.Type==JTokenType.Null&&(string?)storage["dateType"]=="string"&&(string?)storage["value"]?["owner"]==(string?)pair[0]&&(!restarted||storage["existing"]?.Type==JTokenType.Object));
        static bool ObservedStorageDenied(JObject observation)=>observation["storage"] is JArray values&&values.Count==2&&values.All(v=>v is JArray pair&&pair[1] is JObject storage&&
            (int?)storage["denied"]>0&&((string?)storage["lastError"] is "denied" or "missingPermission"));
        static bool ObservedAudio(JObject observation)=>observation["audio"] is JArray values&&values.Count==2&&values.All(v=>v is JArray pair&&pair.Count==2&&pair[1] is JObject audio&&(string?)audio["state"]=="running"&&(double?)audio["time"]>0.05);
        bool ObservedBackground(JObject observation,string consumer="slot.background.focus"){
            if(lifecycleMedia is "image" or "gif")return observation["images"] is JArray images&&images.Any(v=>(string?)v["consumer"]==consumer&&(int?)v["width"]>0&&(bool?)v["hidden"]==false);
            if(lifecycleMedia=="html")return observation["slots"] is JArray slots&&slots.Any(v=>(string?)v[0]==consumer&&(string?)v[1]?["state"]=="running"&&(double?)v[1]?["time"]>0.05);
            return observation["videos"] is JArray videos&&videos.Any(v=>(string?)v["consumer"]==consumer&&(bool?)v["hidden"]==false&&(int?)v["ready"]>=2&&(double?)v["time"]>0.1&&(bool?)v["paused"]==false);
        }
        bool ObservedStartup(JObject observation)
        {
            var stages=(JArray?)observation["stages"];
            return stages?.Count==2&&(string?)stages[0]["stage"]=="starting"&&(lifecycleMedia is null?(bool?)stages[0]["gif"]==true:(bool?)stages[0]["mounted"]==true)&&
                (string?)stages[1]["stage"]=="desktop"&&(double?)stages[1]["at"]-(double?)stages[0]["at"]>=400;
        }
        static string ReadSharedLog(string path){using var stream=new FileStream(path,FileMode.Open,FileAccess.Read,FileShare.ReadWrite);using var reader=new StreamReader(stream);return reader.ReadToEnd();}
        static string Hash(byte[] bytes)=>Convert.ToHexString(SHA256.HashData(bytes));
        static void Require(bool value,string reason){if(!value)throw new Exception(reason);}
    }
    [DllImport("user32.dll")] static extern IntPtr GetDlgItem(IntPtr dialog,int id);
    [DllImport("user32.dll")] static extern IntPtr SendMessageW(IntPtr window,uint message,IntPtr wparam,IntPtr lparam);
    [DllImport("user32.dll")] static extern bool PostMessageW(IntPtr window,uint message,IntPtr wparam,IntPtr lparam);
    static void CancelOwnedConfirmation(int owner){
        EnumWindows((window,_)=>{GetWindowThreadProcessId(window,out var pid);var title=new StringBuilder(128);GetWindowText(window,title,title.Capacity);
            if(pid==owner&&title.ToString()=="Dext 退出确认"){var no=GetDlgItem(window,7);if(no!=IntPtr.Zero)PostMessageW(no,0xf5,IntPtr.Zero,IntPtr.Zero);}
            return true;},IntPtr.Zero);
    }
    static async Task Click(NativePoint point){
        if(!SetCursorPos(point.X,point.Y))throw new Exception("OS cursor");await Task.Delay(120);
        var inputs=new[]{new NativeInput{Value=new NativeUnion{Mouse=new NativeMouse{Flags=2}}},new NativeInput{Value=new NativeUnion{Mouse=new NativeMouse{Flags=4}}}};
        if(SendInput(2,inputs,Marshal.SizeOf<NativeInput>())!=2)throw new Exception("OS mouse down/up");
    }
    static string Class(IntPtr window){var name=new StringBuilder(128);GetClassName(window,name,name.Capacity);return name.ToString();}
    static bool DesktopPoint(NativePoint point)=>Class(GetAncestor(WindowFromPoint(point),2)) is "Progman" or "WorkerW";
    static void FocusDesktop()
    {
        var desktop=FindWindow("Progman",null);if(desktop==IntPtr.Zero)throw new Exception("Desktop window unavailable");
        var current=GetCurrentThreadId();var foreground=GetWindowThreadProcessId(GetForegroundWindow(),out _);bool attached=foreground!=current&&AttachThreadInput(current,foreground,true);
        try{SetForegroundWindow(desktop);}finally{if(attached)AttachThreadInput(current,foreground,false);}
    }
    static IntPtr FindPlayer(int pid){IntPtr result=IntPtr.Zero;EnumChildWindows(FindWindow("Progman",null),(window,_)=>{GetWindowThreadProcessId(window,out var owner);if(owner==pid&&ReadObservation(window)!=null){result=window;return false;}return true;},IntPtr.Zero);
        if(result==IntPtr.Zero)EnumChildWindows(IntPtr.Zero,(window,_)=>{GetWindowThreadProcessId(window,out var owner);if(owner==pid&&ReadObservation(window)!=null){result=window;return false;}
            EnumChildWindows(window,(child,_)=>{GetWindowThreadProcessId(child,out var childOwner);if(childOwner==pid&&ReadObservation(child)!=null){result=child;return false;}return true;},IntPtr.Zero);return result==IntPtr.Zero;},IntPtr.Zero);return result;}
    static bool PausedPictureVisible(int pid){
        var root=FindPlayer(pid);if(root==IntPtr.Zero)return false;var found=false;
        EnumChildWindows(root,(window,_)=>{var text=new StringBuilder(80);GetWindowText(window,text,text.Capacity);
            if(IsWindowVisible(window)&&text.ToString()=="Dext native pause frame"){found=true;return false;}return true;},IntPtr.Zero);
        return found;
    }
    static JObject? ReadObservation(IntPtr window){if(window==IntPtr.Zero)return null;var title=new StringBuilder(32768);GetWindowText(window,title,title.Capacity);const string prefix="DEXT_V3_LIVE:";if(!title.ToString().StartsWith(prefix,StringComparison.Ordinal))return null;try{return JObject.Parse(title.ToString()[prefix.Length..]);}catch(JsonException){return null;}}
}
