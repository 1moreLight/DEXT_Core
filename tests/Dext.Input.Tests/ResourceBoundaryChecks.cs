using Lively.Common.Helpers;
using Lively.Models.Message;
using System.Security.Cryptography;
using System.Text;

internal static class ResourceBoundaryChecks
{
    public static void Run()
    {
        var passed=0; var total=0;
        void Check(string name,Action<Fixture> test){total++;using var f=new Fixture();try{test(f);passed++;Console.WriteLine("PASS "+name);}catch(Exception e){Console.Error.WriteLine("FAIL "+name+": "+e.Message);}}
        Check("native resources deny content before context and undeclared official files", f=>{
            f.Expect("content/1/scene/data.json",403);f.Expect("secret.json",403);f.Expect("room.json",403);f.Expect("index.html",200,"official");
        });
        Check("verified resource response preserves bytes headers and frozen context inventory",f=>{
            var inventory=f.Inventory();if(!f.Server.Activate(1,inventory))throw new Exception("activate");inventory[0].Sha256=new string('0',64);
            using var r=f.Server.Prepare(f.Url("content/1/scene/data.json"),"GET",null);
            if(r.StatusCode!=200||!r.Headers.Contains("application/json")||!r.Headers.Contains("no-store")||!r.Headers.Contains("nosniff")||Read(r.Content)!="0123456789")throw new Exception("response");
        });
        Check("official and author documents carry enforced browser policy without network report endpoints",f=>{
            f.Activate();foreach(var path in new[]{"index.html","content/1/scene/data.json"}){
                using var r=f.Server.Prepare(f.Url(path),"GET",null);
                if(!r.Headers.Contains("Connection-Allowlist: (response-origin); webrtc=block; redirects=block; report-to=dext-native-policy\r\n")||r.Headers.Contains("Reporting-Endpoints:"))throw new Exception("browser policy header");
            }
            if(!f.Server.IsOfficialResource(f.Url("index.html"))||f.Server.IsOfficialResource(f.Url("content/1/scene/data.json")))throw new Exception("pre-policy resource classification");
        });
        foreach(var path in new[]{"content/1/../index.html","content/1/%2e%2e/index.html","content/1/scene%2fdata.json","content/1/scene/%2564ata.json","content/1/scene/data.json?secret=1","content/1/scene/data.json%20","content/1/room.json","content/1/installation.json","content/1/scene/missing.json","content/2/scene/data.json"})
            Check("resource rejects URL "+path,f=>{f.Activate();f.Expect(path,403);});
        Check("resource rejects remote origin scheme port credentials and write method",f=>{
            f.Activate();foreach(var address in new[]{"https://example.com/content/1/scene/data.json",f.Server.Origin.Replace("https:","http:")+"/index.html",f.Server.Origin.Replace("https://","https://user@")+"/index.html",f.Server.Origin+":444/index.html"})
                using(var r=f.Server.Prepare(address,"GET",null)){if(r.StatusCode!=403)throw new Exception(address);}
            using var post=f.Server.Prepare(f.Url("content/1/scene/data.json"),"POST",null);if(post.StatusCode!=405)throw new Exception("write method");
        });
        foreach(var range in new[]{("bytes=0-","0123456789","0-9"),("bytes=2-5","2345","2-5"),("bytes=-3","789","7-9"),("bytes=8-99","89","8-9")})
            Check("range "+range.Item1,f=>{f.Activate();using var r=f.Server.Prepare(f.Url("content/1/scene/data.json"),"GET",range.Item1);
                if(r.StatusCode!=206||Read(r.Content)!=range.Item2||!r.Headers.Contains("Content-Range: bytes "+range.Item3+"/10"))throw new Exception("partial response");});
        Check("range overflow and suffix zero reject; multi-range explicitly returns full response",f=>{
            f.Activate();foreach(var range in new[]{"bytes=10-","bytes=-0","bytes=9223372036854775808-"}){
                using var r=f.Server.Prepare(f.Url("content/1/scene/data.json"),"GET",range);if(r.StatusCode!=416||!r.Headers.Contains("bytes */10"))throw new Exception(range);}
            using var all=f.Server.Prepare(f.Url("content/1/scene/data.json"),"GET","bytes=0-1,4-5");if(all.StatusCode!=200||Read(all.Content)!="0123456789")throw new Exception("multi-range");
        });
        Check("HEAD preserves verified length without response bytes",f=>{
            f.Activate();using var r=f.Server.Prepare(f.Url("content/1/scene/data.json"),"HEAD",null);if(r.StatusCode!=200||!r.Headers.Contains("Content-Length: 10")||Read(r.Content)!="")throw new Exception("head");
        });
        Check("range stream cannot seek or read outside declared interval; zero read stays usable",f=>{
            f.Activate();using var r=f.Server.Prepare(f.Url("content/1/scene/data.json"),"GET","bytes=2-5");var b=new byte[8];
            if(r.Content.Read(b,0,0)!=0||r.Content.Length!=4)throw new Exception("zero read");
            if(r.Content.Seek(-1,SeekOrigin.End)!=3||r.Content.Read(b,0,8)!=1||b[0]!=(byte)'5')throw new Exception("bounds");
            try{r.Content.Seek(5,SeekOrigin.Begin);throw new Exception("seek escaped");}catch(IOException){}
        });
        foreach(var changed in new[]{"X123456789","short","0123456789long"})Check("tampered resource rejected before any body: "+changed,f=>{
            f.Activate();File.WriteAllText(f.Data,changed);f.Expect("content/1/scene/data.json",403);
        });
        Check("verified cache releases original installation and keeps authorized bytes",f=>{
            f.Activate();using var r=f.Server.Prepare(f.Url("content/1/scene/data.json"),"GET",null);
            Directory.Move(f.Content,f.Content+"-old");Directory.CreateDirectory(f.Content);File.WriteAllText(Path.Combine(f.Content,"untrusted.json"),"changed");
            if(Read(r.Content)!="0123456789")throw new Exception("cache changed");f.Expect("content/1/scene/data.json",200,"0123456789");
        });
        Check("revocation closes prior response and rejects old generation after replacement",f=>{
            f.Activate();using var r=f.Server.Prepare(f.Url("content/1/scene/data.json"),"GET",null);f.Server.Revoke();
            if(f.Server.IsCurrent(r))throw new Exception("stale response current");try{r.Content.ReadByte();throw new Exception("stale response read");}catch(ObjectDisposedException){}
            f.Expect("content/1/scene/data.json",403);if(f.Server.Activate(1,f.Inventory()))throw new Exception("generation revived");
            if(!f.Server.Activate(2,f.Inventory()))throw new Exception("new generation");f.Expect("content/1/scene/data.json",403);f.Expect("content/2/scene/data.json",200,"0123456789");
        });
        Check("parent junction cannot substitute inventory bytes",f=>{
            f.Activate();var old=Path.Combine(f.Content,"scene");var moved=old+"-old";Directory.Move(old,moved);
            var link=System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo("cmd.exe","/c mklink /J \""+old+"\" \""+moved+"\""){UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true});link!.WaitForExit();
            if(link.ExitCode!=0)throw new Exception("junction setup");try{f.Expect("content/1/scene/data.json",403);}finally{Directory.Delete(old);}
        });
        Check("unsafe or duplicate inventory cannot activate context",f=>{
            var items=f.Inventory();items[0].Path="../data.json";if(f.Server.Activate(1,items))throw new Exception("traversal activated");
            items=f.Inventory();if(f.Server.Activate(1,new[]{items[0],items[0]}))throw new Exception("duplicate activated");f.Activate();
        });
        Check("maximum length and Unicode resource paths retain inventory identity",f=>{
            var relative="scene/"+new string('a',229)+".json";
            var bytes=Encoding.UTF8.GetBytes("unicode");var unicode="scene/汉字.json";
            File.WriteAllBytes(Path.Combine(f.Content,relative.Replace('/','\\')),bytes);File.WriteAllBytes(Path.Combine(f.Content,unicode.Replace('/','\\')),bytes);
            var hash=Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
            if(!f.Server.Activate(1,new[]{new LivelyRoomRuntimeResource{Path=relative,Size=bytes.Length,Sha256=hash},new LivelyRoomRuntimeResource{Path=unicode,Size=bytes.Length,Sha256=hash}}))throw new Exception("valid paths rejected");
            f.Expect("content/1/"+relative,200,"unicode");f.Expect("content/1/scene/"+Uri.EscapeDataString("汉字.json"),200,"unicode");
        });
        Check("empty resources and frame navigation are bounded by current inventory",f=>{
            var path=Path.Combine(f.Content,"scene","empty.json");File.WriteAllBytes(path,Array.Empty<byte>());
            if(!f.Server.Activate(1,new[]{new LivelyRoomRuntimeResource{Path="scene/empty.json",Size=0,Sha256=Convert.ToHexString(SHA256.HashData(Array.Empty<byte>())).ToLowerInvariant()}}))throw new Exception("empty activate");
            f.Expect("content/1/scene/empty.json",200,"");using var r=f.Server.Prepare(f.Url("content/1/scene/empty.json"),"GET","bytes=0-");if(r.StatusCode!=416)throw new Exception("empty range");
            if(!f.Server.CanNavigateFrame(f.Url("content/1/scene/empty.json"))||f.Server.CanNavigateFrame(f.Url("index.html"))||f.Server.CanNavigateFrame("data:text/html,hello"))throw new Exception("frame URL");
            f.Server.Revoke();if(f.Server.CanNavigateFrame(f.Url("content/1/scene/empty.json")))throw new Exception("retired frame");
        });
        Check("revocation releases owned temporary bytes even when browser abandons a response",f=>{
            var before=Directory.GetFiles(Path.GetTempPath(),"Dext-v3-resource-*.tmp").ToHashSet(StringComparer.OrdinalIgnoreCase);
            f.Activate();using var r=f.Server.Prepare(f.Url("content/1/scene/data.json"),"GET",null);
            var created=Directory.GetFiles(Path.GetTempPath(),"Dext-v3-resource-*.tmp").Where(path=>!before.Contains(path)).ToArray();
            if(created.Length!=1)throw new Exception("owned byte store not observed");f.Server.Revoke();if(created.Any(File.Exists))throw new Exception("abandoned response kept temporary file");
        });
        Console.WriteLine($"{passed}/{total} native resource checks passed");if(passed!=total)throw new Exception("native resource boundary failed");
    }
    private static string Read(Stream s){using var reader=new StreamReader(s,Encoding.UTF8,false,1024,true);return reader.ReadToEnd();}
    private sealed class Fixture:IDisposable
    {
        private readonly DirectoryInfo root=Directory.CreateTempSubdirectory("Dext-v3-resource-test-");
        public readonly DextNativeResourceServer Server;
        public string Content=>Path.Combine(root.FullName,"content");public string Data=>Path.Combine(Content,"scene","data.json");
        public Fixture(){Directory.CreateDirectory(Path.GetDirectoryName(Data)!);File.WriteAllText(Data,"0123456789");File.WriteAllText(Path.Combine(root.FullName,"index.html"),"official");File.WriteAllText(Path.Combine(root.FullName,"secret.json"),"private");Server=new(Path.Combine(root.FullName,"index.html"));}
        public string Url(string path)=>Server.Origin+"/"+path;
        public LivelyRoomRuntimeResource[] Inventory()=>new[]{new LivelyRoomRuntimeResource{Path="scene/data.json",Size=10,Sha256=Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes("0123456789"))).ToLowerInvariant()}};
        public void Activate(){if(!Server.Activate(1,Inventory()))throw new Exception("activate");}
        public void Expect(string path,int status,string? body=null){using var r=Server.Prepare(Url(path),"GET",null);if(r.StatusCode!=status||(body!=null&&Read(r.Content)!=body))throw new Exception(path+" status="+r.StatusCode);}
        public void Dispose(){Server.Dispose();var temp=Path.GetFullPath(Path.GetTempPath()).TrimEnd('\\')+"\\";if(!root.FullName.StartsWith(temp,StringComparison.OrdinalIgnoreCase))throw new Exception("unsafe fixture");root.Delete(true);}
    }
}
