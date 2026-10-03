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
        Check("private polygon geometry accepts separate presentations for one action",()=>{
            var r=Request();var b=(JObject)r["buttons"]![0]!;b["entryId"]="icon.home/one";
            b["polygons"]=new JArray { new JArray(new JObject{["x"]=.1,["y"]=.2},new JObject{["x"]=.3,["y"]=.2},new JObject{["x"]=.1,["y"]=.5}) };
            var second=(JObject)b.DeepClone();second["entryId"]="icon.home/two";((JArray)r["buttons"]!).Add(second);
            Require(Parse(r)?.Buttons.Length==2);
        });
        Check("official author route preserves SDK original JSON without selecting a native sequence",()=>{
            var r=Request();r["method"]="authorInput";r.Remove("viewport");r.Remove("buttons");
            r["consumer"]="scene";r["instanceId"]="instance";r["requestJson"]="{\"requestId\":\"r1\"}";
            var parsed=Parse(r);Require(parsed?.AuthorInstance=="instance"&&parsed.SdkRequestJson=="{\"requestId\":\"r1\"}"&&parsed.InputSequence==0);
        });
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
        JObject Precise(){var r=Request();var b=(JObject)r["buttons"]![0]!;b["entryId"]="button.open";b["polygons"]=new JArray { new JArray(new JObject{["x"]=.1,["y"]=.2},new JObject{["x"]=.3,["y"]=.2},new JObject{["x"]=.1,["y"]=.5}) };return r;}
        Check("private geometry preserves entry and every point through IPC",()=>{
            var r=Parse(Precise());Require(r!=null);var copy=RuntimeMessageChecks.Roundtrip(r!) as LivelyMessageRoomNativeRequest;
            Require(copy?.Buttons[0].EntryId=="button.open"&&copy.Buttons[0].Polygons.Length==1&&copy.Buttons[0].Polygons[0][2].Y==.5);
        });
        Check("presentation ids allow 192 characters and consumer-local reuse",()=>{
            var r=Precise();var b=(JObject)r["buttons"]![0]!;b["entryId"]=new string('x',192);var second=(JObject)b.DeepClone();second["consumer"]="component.shared";((JArray)r["buttons"]!).Add(second);Require(Parse(r)?.Buttons.Length==2);
            b.Remove("polygons");Require(Parse(r)!=null);
        });
        Check("private polygon parser accepts both windings and 64 pieces",()=>{
            var r=Precise();var b=(JObject)r["buttons"]![0]!;var p=(JArray)b["polygons"]![0]!;b["polygons"]=new JArray(Enumerable.Range(0,64).Select(_=>new JArray(p.Reverse())));Require(Parse(r)!=null);
        });
        foreach(var bad in new[]{"noEntry","nullEntry","emptyEntry","longEntry","controlEntry","nullPolygons","emptyPolygons","nullPolygon","emptyPolygon","tooManyPieces","tooFewPoints","tooManyPoints","nullPoint","pointField","stringPoint","missingPoint","pointOutside","duplicatePoint","closingPoint","collinear","concave","crossed","bboxWide","bboxShift","sameEntry","legacyFirst","legacyLast"})
            Check("strict private polygon parser rejects "+bad,()=>{
                var r=Precise();var b=(JObject)r["buttons"]![0]!;var pieces=(JArray)b["polygons"]!;var p=(JArray)pieces[0]!;
                JObject Point(double x,double y)=>new(){["x"]=x,["y"]=y};
                switch(bad){case "noEntry":b.Remove("entryId");break;case "nullEntry":b["entryId"]=JValue.CreateNull();break;case "emptyEntry":b["entryId"]="";break;case "longEntry":b["entryId"]=new string('x',193);break;case "controlEntry":b["entryId"]="bad\n";break;
                    case "nullPolygons":b["polygons"]=JValue.CreateNull();break;case "emptyPolygons":b["polygons"]=new JArray();break;case "nullPolygon":pieces[0]=JValue.CreateNull();break;case "emptyPolygon":pieces[0]=new JArray();break;
                    case "tooManyPieces":b["polygons"]=new JArray(Enumerable.Range(0,65).Select(_=>p.DeepClone()));break;case "tooFewPoints":p.RemoveAt(2);break;
                    case "tooManyPoints":pieces[0]=new JArray(Enumerable.Range(0,33).Select(i=>Point(.2+.1*Math.Cos(i*Math.PI*2/33),.35+.15*Math.Sin(i*Math.PI*2/33))));break;
                    case "nullPoint":p[0]=JValue.CreateNull();break;case "pointField":p[0]!["z"]=1;break;case "stringPoint":p[0]!["x"]="0.1";break;case "missingPoint":((JObject)p[0]!).Remove("y");break;case "pointOutside":p[0]!["x"]=-.1;break;
                    case "duplicatePoint":p[1]=p[0]!.DeepClone();break;case "closingPoint":p.Add(p[0]!.DeepClone());break;case "collinear":pieces[0]=new JArray(Point(.1,.2),Point(.2,.35),Point(.3,.5));break;
                    case "concave":pieces[0]=new JArray(Point(.1,.2),Point(.3,.2),Point(.15,.25),Point(.1,.5));break;case "crossed":pieces[0]=new JArray(Point(.1,.2),Point(.3,.5),Point(.3,.2),Point(.1,.5));break;
                    case "bboxWide":b["width"]=.21;break;case "bboxShift":b["x"]=.11;break;case "sameEntry":var other=(JObject)b.DeepClone();other["button"]="other";((JArray)r["buttons"]!).Add(other);break;
                    case "legacyFirst":((JArray)r["buttons"]!).Insert(0,Request()["buttons"]![0]!.DeepClone());break;case "legacyLast":((JArray)r["buttons"]!).Add(Request()["buttons"]![0]!.DeepClone());break;
                }
                Require(Parse(r)==null);
            });
        Check("official layout read is private current identity with no consumer or grant fields",()=>{
            var r=Request();r["method"]="layoutRead";r.Remove("viewport");r.Remove("buttons");r.Remove("geometryVersion");
            Require(Parse(r)?.Method=="layoutRead");r["consumer"]="scene";Require(Parse(r)==null);r.Remove("consumer");r["revision"]=2;Require(Parse(r)==null);
        });
        Check("official layout save preserves independent revision and closed item shape",()=>{
            var r=Request();r["method"]="layoutSave";r.Remove("viewport");r.Remove("buttons");r.Remove("geometryVersion");r["layoutRevision"]=0;
            r["change"]=new JObject{["kind"]="icon",["id"]="icon-1",["deskId"]="home",["x"]=240,["y"]=360};
            var parsed=Parse(r);Require(parsed?.Method=="layoutSave");Require(RuntimeMessageChecks.Roundtrip(parsed!) is LivelyMessageRoomNativeRequest);
            foreach(var invalid in new JToken[]{-1,1.5,"1"}){r["layoutRevision"]=invalid;Require(Parse(r)==null);}r["layoutRevision"]=0;
            foreach(var field in new[]{"target","consumer","proof","approved"}){r[field]="fake";Require(Parse(r)==null);r.Remove(field);}
            r["change"]!["x"]=1825;Require(Parse(r)==null);
            r["change"]=new JObject{["kind"]="widget",["id"]="widget",["x"]=100,["y"]=200,["width"]=300,["height"]=180};Require(Parse(r)!=null);
            r["change"]!["deskId"]="home";Require(Parse(r)==null);((JObject)r["change"]!).Remove("deskId");r["change"]!["kind"]="dock";Require(Parse(r)==null);
        });
        Check("authors cannot send an exit decision or a confirmation capability",()=>{
            var r=Request();r["method"]="activate";r.Remove("viewport");r.Remove("buttons");r["consumer"]="scene";r["button"]="exit";r["inputSequence"]=0;Require(Parse(r)!=null);
            foreach(var field in new[]{"approved","confirmed","exit","confirmation","token"}){r[field]=true;Require(Parse(r)==null);r.Remove(field);}
            r["method"]="confirmExit";Require(Parse(r)==null);
        });
        Check("activate requests carry no native proof or private launch target",()=>{var r=Request();r["method"]="activate";r.Remove("viewport");r.Remove("buttons");r["consumer"]="scene";r["button"]="open";r["inputSequence"]=0;Require(Parse(r)!=null);r["proof"]="pretend";Require(Parse(r)==null);});
        Check("startup completion accepts only exact starting phase and has no Windows fact fields",()=>{
            var starting=new DextRoomRuntimeState();starting.Initialize(RuntimeMessageChecks.ContextMessage(f.Context,f.Snapshot,1));
            var snap=RoomSessionPlayerMessage.Create(f.Snapshot with{Lifecycle=new(RoomLifecycleStage.Starting,true,true,4)},["home","focus"]);snap.RuntimeGeneration=1;starting.AcceptSnapshot(snap);
            var r=new JObject{["type"]="dext:v3-native-request",["protocolVersion"]=1,["requestId"]="startup",["method"]="startupComplete",["runtimeGeneration"]=1,["sessionId"]=f.Snapshot.SessionId.ToString(),["revision"]=1,["lifecycleRevision"]=4};
            Require(Parse(r,starting)?.LifecycleRevision==4);Require(Parse(r)==null);
            foreach(var invalid in new JToken[]{3,4.2,"4"}){r["lifecycleRevision"]=invalid;Require(Parse(r,starting)==null);}r["lifecycleRevision"]=4;
            r["locked"]=false;Require(Parse(r,starting)==null);r.Remove("locked");starting.Invalidate("navigation");Require(Parse(r,starting)==null);
        });
        Check("capability query is an exact current-identity consumer request",()=>{
            var r=Request();r["method"]="capabilities";r.Remove("viewport");r.Remove("buttons");r.Remove("geometryVersion");r["consumer"]="slot.start";
            Require(Parse(r)?.Consumer=="slot.start");
            foreach(var bad in new[]{"capabilities","target","ticket"}){r[bad]="pretend";Require(Parse(r)==null);r.Remove(bad);}
            r["consumer"]=7;Require(Parse(r)==null);r["consumer"]="scene";r["revision"]=2;Require(Parse(r)==null);
        });
        Check("consumer data is a bounded current-identity query without an authored value",()=>{
            var r=Request();r["method"]="data";r.Remove("viewport");r.Remove("buttons");r.Remove("geometryVersion");r["consumer"]="scene";
            foreach(var capability in new[]{"time.read","hardware.read","media.read","audio.read"}){r["capability"]=capability;var value=Parse(r);Require(value?.Capability==capability);Require(RuntimeMessageChecks.Roundtrip(value!) is LivelyMessageRoomNativeRequest);}
            foreach(var capability in new JToken[]{"binding.launch","storage.read",4}){r["capability"]=capability;Require(Parse(r)==null);}r["capability"]="time.read";
            r["value"]="pretend";Require(Parse(r)==null);r.Remove("value");r["revision"]=2;Require(Parse(r)==null);
        });
        Check("storage get is a current fixed-consumer stable-key query",()=>{
            var r=Request();r["method"]="storageGet";r.Remove("viewport");r.Remove("buttons");r.Remove("geometryVersion");r["consumer"]="component.shared";r["key"]="notes";
            Require(Parse(r)?.Key=="notes");r["value"]=1;Require(Parse(r)==null);r.Remove("value");r["key"]="../private";Require(Parse(r)==null);r["key"]="notes";r["revision"]=2;Require(Parse(r)==null);
        });
        Check("storage set preserves bounded JSON strings null and strict shape across IPC",()=>{
            var r=Request();r["method"]="storageSet";r.Remove("viewport");r.Remove("buttons");r.Remove("geometryVersion");r["consumer"]="scene";r["key"]="notes";
            r["value"]=new JObject{["label"]="\u65e5\u671f",["at"]="2026-10-03T00:00:00Z",["items"]=new JArray(1,true,JValue.CreateNull())};
            var parsed=Parse(r);Require(parsed?.Key=="notes"&&parsed.ValueJson!=null);using(var valueReader=new Newtonsoft.Json.JsonTextReader(new StringReader(parsed!.ValueJson!)){DateParseHandling=Newtonsoft.Json.DateParseHandling.None})Require(JToken.ReadFrom(valueReader)["at"]!.Type==JTokenType.String);
            Require((RuntimeMessageChecks.Roundtrip(parsed) as LivelyMessageRoomNativeRequest)?.ValueJson==parsed.ValueJson);
            r["value"]=JValue.CreateNull();Require(Parse(r)?.ValueJson=="null");r.Remove("value");Require(Parse(r)==null);
            r["value"]=new string('x',32769);Require(Parse(r)==null);r["value"]=new JArray(Enumerable.Repeat(0,4097));Require(Parse(r)==null);
            r["value"]=1;r["ticket"]="forged";Require(Parse(r)==null);
        });
        Check("native navigate preserves only typed three-variant action and private completion sequence",()=>{
            var r=Request();r["method"]="navigate";r.Remove("viewport");r.Remove("buttons");r["consumer"]="scene";r["inputSequence"]=7;
            foreach(var type in new[]{"desk.next","desk.previous","desk.go"}){r["action"]=type=="desk.go"?new JObject{["type"]=type,["deskId"]="focus"}:new JObject{["type"]=type};
                var parsed=Parse(r);Require(parsed?.Action?.Type==type&&parsed.InputSequence==7);Require((RuntimeMessageChecks.Roundtrip(parsed!) as LivelyMessageRoomNativeRequest)?.Action?.Type==type);}
            foreach(var action in new JToken[]{new JObject{["type"]="binding.launch"},new JObject{["type"]="desk.next",["deskId"]="focus"},new JObject{["type"]="desk.go"},new JObject{["type"]="desk.go",["deskId"]=7}}){r["action"]=action;Require(Parse(r)==null);}
            r["action"]=new JObject{["type"]="desk.next"};r["button"]="open";Require(Parse(r)==null);r.Remove("button");r["ticket"]="fake";Require(Parse(r)==null);
        });
        Check("native action correlation rejects missing fractional negative and unsafe sequences",()=>{
            var r=Request();r["method"]="activate";r.Remove("viewport");r.Remove("buttons");r["consumer"]="scene";r["button"]="open";
            Require(Parse(r)==null);foreach(var sequence in new JToken[]{-1,1.2,"7",9007199254740992L}){r["inputSequence"]=sequence;Require(Parse(r)==null);}
            r["inputSequence"]=0;Require(Parse(r)?.InputSequence==0);r["inputSequence"]=7;Require(Parse(r)?.InputSequence==7);
        });

        JObject Control(string method){var r=Request();r["method"]=method;r.Remove("viewport");r.Remove("buttons");r["consumer"]="scene";r["inputSequence"]=7;return r;}
        Check("media controls preserve only five intents across strict Player IPC",()=>{
            var r=Control("mediaControl");foreach(var action in new[]{"play","pause","toggle","next","previous"}){
                r["action"]=action;var parsed=Parse(r);Require(parsed?.MediaAction==action&&parsed.InputSequence==7);
                Require((RuntimeMessageChecks.Roundtrip(parsed!) as LivelyMessageRoomNativeRequest)?.MediaAction==action);
            }
            foreach(var action in new JToken[]{"seek",7,new JObject{["type"]="play"}}){r["action"]=action;Require(Parse(r)==null);}
            r["action"]="play";r["button"]="fake";Require(Parse(r)==null);r.Remove("button");r["revision"]=2;Require(Parse(r)==null);
        });
        Check("audio control strict patch and IPC preserve endpoints and false mute",()=>{
            var r=Control("audioControl");foreach(var settings in new[]{new JObject{["volume"]=0},new JObject{["volume"]=1},new JObject{["muted"]=false},new JObject{["volume"]=.5,["muted"]=true}}){
                r["settings"]=settings;var parsed=Parse(r);Require(parsed!=null);var copy=RuntimeMessageChecks.Roundtrip(parsed!) as LivelyMessageRoomNativeRequest;
                Require(copy?.Volume==(double?)settings["volume"]&&copy?.Muted==(bool?)settings["muted"]);
            }
            foreach(var settings in new JToken[]{new JObject(),new JObject{["volume"]=-.1},new JObject{["volume"]=1.1},new JObject{["volume"]="0.5"},new JObject{["volume"]=JValue.CreateNull()},new JObject{["muted"]=1},new JObject{["path"]="private"}}){r["settings"]=settings;Require(Parse(r)==null);}
            r["settings"]=new JObject{["muted"]=true};r["ticket"]="pretend";Require(Parse(r)==null);
        });
        Check("system controls reject missing unsafe and wrong-generation correlation",()=>{
            foreach(var method in new[]{"mediaControl","audioControl"}){
                var r=Control(method);if(method=="mediaControl")r["action"]="pause";else r["settings"]=new JObject{["muted"]=true};
                foreach(var sequence in new JToken[]{-1,1.2,"7",9007199254740992L}){r["inputSequence"]=sequence;Require(Parse(r)==null);}
                r["inputSequence"]=0;Require(Parse(r)!=null);r.Remove("inputSequence");Require(Parse(r)==null);r["inputSequence"]=7;r["runtimeGeneration"]=2;Require(Parse(r)==null);
            }
        });
        Console.WriteLine($"{passed}/{total} native input message checks passed");if(passed!=total)throw new Exception("native message checks failed");
    }
}
