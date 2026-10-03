using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using Google.Protobuf.WellKnownTypes;
using Grpc.Core;
using GrpcDotNetNamedPipes;
using Lively.Common;
using Lively.Grpc.Common.Proto.Desktop;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

// Actual production Core + WorkerW + ReleasePlayer; only the temporary official
// observer and trusted top navigation driver are test instrumentation. No Core
// responses, permissions, Windows facts, input proofs or commits are fixtures.
internal static class NativeCoreLiveProbe
{
    [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern IntPtr FindWindow(string name,string? title);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr window);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window,out uint pid);
    [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
    [DllImport("user32.dll")] static extern bool AttachThreadInput(uint from,uint to,bool attach);
    [DllImport("user32.dll")] static extern IntPtr GetParent(IntPtr window);
    [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr parent,Callback callback,IntPtr data);
    [DllImport("user32.dll")] static extern bool IsWindow(IntPtr window);
    [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr window,StringBuilder text,int count);
    [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr window,StringBuilder text,int count);
    delegate bool Callback(IntPtr window,IntPtr data);
    public static async Task Run(string corePath,string hostDirectory,string installer,string sdk,string mediaDirectory,string evidenceDirectory)
    {
        corePath=Path.GetFullPath(corePath);var coreDirectory=Path.GetDirectoryName(corePath)!;hostDirectory=Path.GetFullPath(hostDirectory);
        var evidence=Directory.CreateDirectory(Path.GetFullPath(evidenceDirectory));
        var data=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"Dext");
        var saved=new Dictionary<string,byte[]?>();
        foreach(var relative in new[]{"WallpaperLayout.json","Settings.json",Path.Combine("v3","room-session.json")})
        {var path=Path.Combine(data,relative);saved[path]=File.Exists(path)?File.ReadAllBytes(path):null;
            if(saved[path] is{} bytes)File.WriteAllBytes(Path.Combine(evidence.FullName,relative.Replace(Path.DirectorySeparatorChar,'_')+".before"),bytes);}
        if(saved[Path.Combine(data,"WallpaperLayout.json")]==null)throw new Exception("Current layout backup is required");
        var userRooms=new Dictionary<string,string>(StringComparer.OrdinalIgnoreCase);
        foreach(var item in JArray.Parse(Encoding.UTF8.GetString(saved[Path.Combine(data,"WallpaperLayout.json")]!)))
        {var path=Path.GetFullPath(Path.Combine((string)item["LivelyInfoPath"]!,"room.json"));if(File.Exists(path))userRooms[path]=Hash(File.ReadAllBytes(path));}
        var root=Directory.CreateTempSubdirectory("Dext-v3-core-native-");
        var host=Directory.CreateDirectory(Path.Combine(root.FullName,"host"));var source=Directory.CreateDirectory(Path.Combine(root.FullName,"source"));
        var originalForeground=GetForegroundWindow();Process? core=null;DesktopService.DesktopServiceClient? client=null;List<GetWallpapersResponse>? original=null;bool applied=false,restored=false;
        var events=new List<string>();var roomId=Guid.NewGuid().ToString();
        try
        {
            foreach(var file in new[]{"LivelyInfo.json","index.html","main.js","style.css","runtime-model.js","native-host.js","frame-host.js","media-host.js","playback-host.js","dom-host.js"})File.Copy(Path.Combine(hostDirectory,file),Path.Combine(host.FullName,file));
            File.AppendAllText(Path.Combine(host.FullName,"main.js"),"""
                ;(()=>{const documents=new Map(),audio=new Map(),stages=[];let nav=0,first=null;
                  addEventListener('message',e=>{if(![...document.querySelectorAll('iframe')].some(f=>f.contentWindow===e.source)||!e.data?.liveDocument)return;documents.set(e.data.consumer,e.data.documentId);audio.set(e.data.consumer,e.data.web);});
                  setInterval(()=>{const d=dextRuntimeDiagnostics(),r=d.runtime;if(!r)return;
                    if(stages.at(-1)?.stage!==r.lifecycle.stage)stages.push({stage:r.lifecycle.stage,at:performance.now(),gif:false});
                    if(r.lifecycle.stage==='starting'&&document.querySelector('img[src$="animation.gif"]'))stages.at(-1).gif=true;
                    if(!first&&r.inputReady&&r.lifecycle.stage==='desktop')first=performance.now();
                    if(first&&performance.now()-first>700&&nav===0&&r.currentDeskId==='home'&&r.lifecycle.stage==='desktop'&&!d.paused){nav++;chrome.webview.postMessage(JSON.stringify({type:'dext:v3-request-desk',sessionId:d.sessionId,deskId:'focus'}));}
                    document.title='DEXT_V3_LIVE:'+JSON.stringify({generation:d.runtimeGeneration,session:d.sessionId,revision:d.revision,current:r.currentDeskId,target:r.targetDeskId,
                      inputReady:r.inputReady,stage:r.lifecycle.stage,paused:d.paused,frames:r.frames.count,instances:r.instances.map(v=>v.instanceId),documents:[...documents],nav,
                      error:r.lastError,frameError:r.frames.lastError,stages,audio:[...audio],videos:[...document.querySelectorAll('video')].map(v=>({ready:v.readyState,time:v.currentTime,paused:v.paused,loop:v.loop,muted:v.muted}))});
                  },80);
                })();
                """);
            File.Copy(Path.GetFullPath(sdk),Path.Combine(source.FullName,"sdk.js"));
            foreach(var name in new[]{"animation.gif","clip.mp4"})File.Copy(Path.Combine(Path.GetFullPath(mediaDirectory),name),Path.Combine(source.FullName,name));
            File.WriteAllText(Path.Combine(source.FullName,"background.svg"),"<svg xmlns='http://www.w3.org/2000/svg' width='1920' height='1080'><rect width='1920' height='1080' fill='#204056'/></svg>");
            File.WriteAllText(Path.Combine(source.FullName,"author.html"),"""
                <!doctype html><h2>Native Core SDK</h2><span id=readout>pending</span><script src=sdk.js></script><script>
                const documentId=crypto.randomUUID();Dext.ready().then(()=>{
                  const context=new AudioContext(),oscillator=context.createOscillator(),gain=context.createGain();gain.gain.value=0;oscillator.connect(gain).connect(context.destination);oscillator.start();context.resume();
                  const report=()=>parent.postMessage({liveDocument:true,consumer:Dext.session.consumerId,documentId,web:{state:context.state,time:context.currentTime}},'*');report();context.addEventListener('statechange',report);setInterval(report,160);
                  Dext.data.bindReadout('time.read',document.getElementById('readout'),v=>String(v.unixMs));
                });
                </script>
                """);
            var manifest=new{version=3,apiVersion=1,id=roomId,name="Actual native Core probe",startDesk="home",resources=new[]{"sdk.js","author.html","background.svg","animation.gif","clip.mp4"},
                start=new{type="gif",src="animation.gif"},roomScene=new{entry="author.html",capabilities=new[]{"desk.read","time.read"}},transition=new{type="slide",durationMs=450},
                components=new[]{new{id="shared",role="widget",entry="author.html",placement=new{x=400,y=50,width=260,height=120},capabilities=new[]{"desk.read","time.read"}}},
                desks=new[]{new{id="home",name="Home",icons=Array.Empty<object>(),components=new[]{"shared"},background=new{type="image",src="background.svg"}},new{id="focus",name="Focus",icons=Array.Empty<object>(),components=new[]{"shared"},background=new{type="video",src="clip.mp4"}}}};
            File.WriteAllText(Path.Combine(source.FullName,"room.json"),JsonConvert.SerializeObject(manifest,Formatting.Indented));
            var install=new ProcessStartInfo(Path.GetFullPath(installer)){UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden,RedirectStandardOutput=true,RedirectStandardError=true};
            foreach(var arg in new[]{"--install",source.FullName,Path.Combine(host.FullName,"content")})install.ArgumentList.Add(arg);
            using(var process=Process.Start(install)??throw new Exception("Installer did not start"))
            {var output=process.StandardOutput.ReadToEndAsync();var error=process.StandardError.ReadToEndAsync();await process.WaitForExitAsync();Require(process.ExitCode==0,"production install: "+await error);File.WriteAllText(Path.Combine(evidence.FullName,"installation.json"),await output);}
            Require(!Process.GetProcessesByName("Lively").Any(p=>{try{return Path.GetFullPath(p.MainModule!.FileName).Equals(corePath,StringComparison.OrdinalIgnoreCase);}catch{return false;}}),"test Core already running");
            await StartCore();
            var deadline=DateTime.UtcNow.AddSeconds(15);do{original=await Wallpapers();if(original.Count>0)break;await Task.Delay(100);}while(DateTime.UtcNow<deadline);Require(original.Count>0,"original wallpaper is restored before test");
            var screen=original!.FirstOrDefault(w=>w.Screen.IsPrimary)?.Screen??original[0].Screen;
            foreach(var old in original)Require(Directory.Exists(old.LivelyInfoPath),"original wallpaper directory available");
            applied=true;await client!.SetWallpaperAsync(new SetWallpaperRequest{LivelyInfoPath=host.FullName,MonitorId=screen.DeviceId},deadline:DateTime.UtcNow.AddSeconds(20));
            FocusDesktop();RoomSessionStatusResponse? active=null;JObject? initial=null,final=null;IntPtr playerWindow=IntPtr.Zero;List<string>? documents=null;string? firstSession=null;int firstPid=0;
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
                        if(initial!=null&&active.CurrentDeskId=="focus"&&active.TargetDeskId.Length==0&&(string?)observation["current"]=="focus"&&(long?)observation["revision"]==active.Revision&&(bool?)observation["inputReady"]==true&&ObservedAudio(observation)&&((JArray?)observation["videos"])?.Any(v=>(int?)v["ready"]>=2&&(double?)v["time"]>0.1&&(bool?)v["paused"]==false)==true)
                        {final=observation;break;}
                    }
                }
                await Task.Delay(80);
            }
            events.Add("last Core "+JsonConvert.SerializeObject(active));events.Add("last host "+ReadObservation(playerWindow)?.ToString(Formatting.None));
            Require(initial!=null&&final!=null,"actual Core native startup/geometry/navigation/commit; "+string.Join("\n",events));
            Require((int?)final!["frames"]==2&&documents!.SequenceEqual(((JArray)final["documents"]!).Select(v=>v.ToString(Formatting.None)).Order()),"actual scene/shared SDK documents retained across Core commit");
            Require(final["frameError"]?.Type==JTokenType.Null,"expected stale capability cancellation is not a failure diagnostic");
            using(var player=Process.GetProcessById(firstPid))Require(Path.GetFullPath(player.MainModule!.FileName).Equals(Path.Combine(coreDirectory,"plugins","webview2","Lively.Player.WebView2.exe"),StringComparison.OrdinalIgnoreCase),"exact deployed Release Player");
            var parent=GetParent(playerWindow);var className=new StringBuilder(128);GetClassName(parent,className,className.Capacity);Require(className.ToString() is "WorkerW" or "Progman","real desktop parent: "+className);
            Require(ObservedStartup(final),"actual GIF startup observed before desktop on the new document");
            Require(ObservedAudio(final),"actual Core allows declared rendering of scene/shared WebAudio clocks");
            events.Add("PASS actual production Rust install/Core reverify/native SDK/geometry/GIF startup/decoded video/trusted top navigation/Core commit/same Player and documents/desktop parent (not physical input)");
            var stamp=active!.InstallationStamp;await StopCore();await StartCore();FocusDesktop();
            RoomSessionStatusResponse? restoredSession=null;JObject? restartedHost=null;deadline=DateTime.UtcNow.AddSeconds(35);
            while(DateTime.UtcNow<deadline)
            {
                restoredSession=await client!.GetRoomSessionAsync(new Empty(),deadline:DateTime.UtcNow.AddSeconds(2));
                if(restoredSession.Active&&restoredSession.RoomId==roomId&&restoredSession.PlayerPid>0)
                {
                    var observation=ReadObservation(FindPlayer(restoredSession.PlayerPid));
                    if(restoredSession.CurrentDeskId=="focus"&&restoredSession.TargetDeskId.Length==0&&restoredSession.InstallationStamp==stamp&&
                        observation!=null&&(string?)observation["stage"]=="desktop"&&(string?)observation["current"]=="focus"&&(bool?)observation["inputReady"]==true&&
                        (long?)observation["revision"]==restoredSession.Revision&&ObservedAudio(observation)&&((JArray?)observation["documents"])?.Count==2&&
                        ((JArray?)observation["videos"])?.Any(v=>(int?)v["ready"]>=2&&(double?)v["time"]>0.1&&(bool?)v["paused"]==false)==true)
                    {restartedHost=observation;break;}
                }
                await Task.Delay(80);
            }
            events.Add("restarted Core "+JsonConvert.SerializeObject(restoredSession));events.Add("restarted host "+restartedHost?.ToString(Formatting.None));
            Require(restartedHost!=null&&restoredSession!.SessionId!=firstSession&&restoredSession.PlayerPid!=firstPid,"new Core session and Player restore committed focus from the same installed copy");
            Require((int?)restartedHost!["nav"]==0&&restartedHost["frameError"]?.Type==JTokenType.Null,"restart restoration requires no navigation driver and has no frame authorization error");
            var nextDocuments=((JArray)restartedHost["documents"]!).Select(v=>v.ToString(Formatting.None)).Order().ToList();
            Require(nextDocuments.All(v=>!documents!.Contains(v)),"new Player owns new SDK documents after restart");
            Require(ObservedStartup(restartedHost),"new Player replays GIF startup once before restored desktop");
            Require(ObservedAudio(restartedHost),"actual Core restart releases restored scene/shared AudioContexts");
            events.Add("PASS actual normal Core restart restores committed focus/same installation with new Player/session/SDK documents/GIF startup/decoded video and no test navigation");
        }
        finally
        {
            try
            {
                if(applied&&client!=null&&original!=null)
                {
                    await client.CloseWallpaperLibraryAsync(new CloseWallpaperLibraryRequest{LivelyInfoPath=host.FullName},deadline:DateTime.UtcNow.AddSeconds(10));
                    foreach(var old in original)await client.SetWallpaperAsync(new SetWallpaperRequest{LivelyInfoPath=old.LivelyInfoPath,MonitorId=old.Screen.DeviceId},deadline:DateTime.UtcNow.AddSeconds(20));
                    var check=await Wallpapers();Require(original.All(w=>check.Any(c=>c.Screen.DeviceId==w.Screen.DeviceId&&Path.GetFullPath(c.LivelyInfoPath).Equals(Path.GetFullPath(w.LivelyInfoPath),StringComparison.OrdinalIgnoreCase))),"original wallpaper runtime restored");
                    Require(!(await client.GetRoomSessionAsync(new Empty())).Active,"original v2 native session inactive");events.Add("original wallpaper runtime restored");
                }
                await StopCore();
                foreach(var pair in saved){if(pair.Value==null){if(File.Exists(pair.Key))File.Delete(pair.Key);}else File.WriteAllBytes(pair.Key,pair.Value);}
                Require(saved.All(p=>p.Value==null?!File.Exists(p.Key):File.Exists(p.Key)&&Hash(File.ReadAllBytes(p.Key))==Hash(p.Value)),"original layout/settings/checkpoint bytes restored");
                Require(userRooms.All(p=>File.Exists(p.Key)&&Hash(File.ReadAllBytes(p.Key))==p.Value),"user Room bytes unchanged");
                restored=true;events.Add("PASS original layout/settings/checkpoint exact bytes and user Room hashes restored after normal Core exit");
            }
            finally
            {
                if(originalForeground!=IntPtr.Zero&&IsWindow(originalForeground))SetForegroundWindow(originalForeground);
                File.WriteAllLines(Path.Combine(evidence.FullName,"native-core-live.log"),events);
                if(restored){var temp=Path.GetFullPath(Path.GetTempPath()).TrimEnd('\\')+"\\";Require(root.FullName.StartsWith(temp,StringComparison.OrdinalIgnoreCase),"fixture cleanup root containment");root.Delete(true);}
                else Console.Error.WriteLine("Native Core recovery pending; fixture retained: "+root.FullName+"; backups: "+evidence.FullName);
                core?.Dispose();
            }
        }
        foreach(var item in events.Where(e=>e.StartsWith("PASS")))Console.WriteLine(item);
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
        static bool ObservedAudio(JObject observation)=>observation["audio"] is JArray values&&values.Count==2&&values.All(v=>v is JArray pair&&pair.Count==2&&pair[1] is JObject audio&&(string?)audio["state"]=="running"&&(double?)audio["time"]>0.05);
        static bool ObservedStartup(JObject observation)
        {
            var stages=(JArray?)observation["stages"];
            return stages?.Count==2&&(string?)stages[0]["stage"]=="starting"&&(bool?)stages[0]["gif"]==true&&
                (string?)stages[1]["stage"]=="desktop"&&(double?)stages[1]["at"]-(double?)stages[0]["at"]>=400;
        }
        static string Hash(byte[] bytes)=>Convert.ToHexString(SHA256.HashData(bytes));
        static void Require(bool value,string reason){if(!value)throw new Exception(reason);}
    }
    static void FocusDesktop()
    {
        var desktop=FindWindow("Progman",null);if(desktop==IntPtr.Zero)throw new Exception("Desktop window unavailable");
        var current=GetCurrentThreadId();var foreground=GetWindowThreadProcessId(GetForegroundWindow(),out _);bool attached=foreground!=current&&AttachThreadInput(current,foreground,true);
        try{SetForegroundWindow(desktop);}finally{if(attached)AttachThreadInput(current,foreground,false);}
    }
    static IntPtr FindPlayer(int pid){IntPtr result=IntPtr.Zero;EnumChildWindows(FindWindow("Progman",null),(window,_)=>{GetWindowThreadProcessId(window,out var owner);if(owner==pid&&ReadObservation(window)!=null){result=window;return false;}return true;},IntPtr.Zero);
        if(result==IntPtr.Zero)EnumChildWindows(IntPtr.Zero,(window,_)=>{GetWindowThreadProcessId(window,out var owner);if(owner==pid&&ReadObservation(window)!=null){result=window;return false;}
            EnumChildWindows(window,(child,_)=>{GetWindowThreadProcessId(child,out var childOwner);if(childOwner==pid&&ReadObservation(child)!=null){result=child;return false;}return true;},IntPtr.Zero);return result==IntPtr.Zero;},IntPtr.Zero);return result;}
    static JObject? ReadObservation(IntPtr window){if(window==IntPtr.Zero)return null;var title=new StringBuilder(8192);GetWindowText(window,title,title.Capacity);const string prefix="DEXT_V3_LIVE:";if(!title.ToString().StartsWith(prefix,StringComparison.Ordinal))return null;try{return JObject.Parse(title.ToString()[prefix.Length..]);}catch(JsonException){return null;}}
}
