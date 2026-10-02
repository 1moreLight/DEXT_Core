using Dext.Core.Rooms;
using Lively.Common.Helpers;
using Lively.Models.Message;
using Newtonsoft.Json.Linq;

internal static class NativeInputMessageChecks
{
    public static void Run()
    {
        int passed=0,total=0;
        void Check(string name,Action body){total++;try{body();passed++;Console.WriteLine("PASS "+name);}catch(Exception e){Console.Error.WriteLine("FAIL "+name+": "+e.Message);}}
        var f=RuntimeMessageChecks.Fixture();
        DextRoomRuntimeState State(){var s=new DextRoomRuntimeState();s.Initialize(RuntimeMessageChecks.ContextMessage(f.Context,f.Snapshot,1));var m=RoomSessionPlayerMessage.Create(f.Snapshot,["home","focus"]);m.RuntimeGeneration=1;s.AcceptSnapshot(m);return s;}
        JObject Request()=>new(){["type"]="dext:v3-native-request",["protocolVersion"]=1,["requestId"]="request-1",["method"]="geometry",["runtimeGeneration"]=1,["sessionId"]=f.Snapshot.SessionId.ToString(),["revision"]=1,["geometryVersion"]=1,
            ["viewport"]=new JObject{["width"]=800,["height"]=600,["dpr"]=1.5},["buttons"]=new JArray(new JObject{["consumer"]="scene",["button"]="open",["x"]=.1,["y"]=.2,["width"]=.2,["height"]=.3,["tabIndex"]=0})};
        LivelyMessageRoomNativeRequest? Parse(JObject r,DextRoomRuntimeState? s=null)=>DextNativeInputProtocol.Parse(r.ToString(),s??State(),1200,900);
        void Require(bool ok){if(!ok)throw new Exception("unexpected acceptance");}
        Check("geometry uses native pixels and preserves normalized public fields",()=>{var r=Parse(Request());Require(r?.Buttons.Length==1&&r.Buttons[0].X==.1&&r.PixelWidth==1200&&r.PixelHeight==900);Require(RuntimeMessageChecks.Roundtrip(r!) is LivelyMessageRoomNativeRequest);});
        foreach(var field in new[]{"protocolVersion","runtimeGeneration","revision","geometryVersion"})
            Check("reject noninteger "+field,()=>{var r=Request();r[field]=1.2;Require(Parse(r)==null);});
        foreach(var bad in new[]{"missingX","missingTab","unknownEntry","stringNumber","fractionalTab","duplicateEntry","unknownViewport","missingScale","wrongScale","wrongSession","oldGeneration","oldRevision","extraField","badId","arrayRoot","duplicateJson","trailingJson","oversize","afterNavigation"})
            Check("native input parser rejects "+bad,()=>{
                var r=Request();var b=(JObject)r["buttons"]![0]!;var s=State();string? raw=null;
                switch(bad){case "missingX":b.Remove("x");break;case "missingTab":b.Remove("tabIndex");break;case "unknownEntry":b["path"]="C:/secret";break;case "stringNumber":b["width"]="0.2";break;case "fractionalTab":b["tabIndex"]=.5;break;
                    case "duplicateEntry":((JArray)r["buttons"]!).Add(b.DeepClone());break;case "unknownViewport":r["viewport"]!["offset"]=4;break;case "missingScale":((JObject)r["viewport"]!).Remove("dpr");break;case "wrongScale":r["viewport"]!["dpr"]=1;break;
                    case "wrongSession":r["sessionId"]=Guid.NewGuid().ToString();break;case "oldGeneration":r["runtimeGeneration"]=2;break;case "oldRevision":r["revision"]=0;break;case "extraField":r["ticket"]="fake";break;case "badId":r["requestId"]="bad\n";break;
                    case "arrayRoot":raw="[]";break;case "duplicateJson":raw=r.ToString().Replace("\"protocolVersion\": 1","\"protocolVersion\": 1, \"protocolVersion\": 1");break;case "trailingJson":raw=r+"{}";break;case "oversize":raw=new string(' ',1024*1024+1);break;case "afterNavigation":s.Invalidate("navigation");break;}
                Require(DextNativeInputProtocol.Parse(raw??r.ToString(),s,1200,900)==null);
            });
        Check("activate requests carry no native proof or private launch target",()=>{var r=Request();r["method"]="activate";r.Remove("viewport");r.Remove("buttons");r["consumer"]="scene";r["button"]="open";Require(Parse(r)!=null);r["proof"]="pretend";Require(Parse(r)==null);});
        Console.WriteLine($"{passed}/{total} native input message checks passed");if(passed!=total)throw new Exception("native message checks failed");
    }
}
