using Lively.Common.Helpers;
using Lively.Models.Message;
internal static class NativePointerDeliveryChecks
{
    public static async Task Run()
    {
        var failures=0;var total=0;
        async Task Check(string name,Func<Task> body){total++;try{await body();Console.WriteLine("PASS "+name);}catch(Exception e){failures++;Console.WriteLine("FAIL "+name+": "+e.Message);}}
        void Require(bool value,string message){if(!value)throw new Exception(message);}
        var session=Guid.NewGuid();
        LivelyMessageRoomNativePointer Packet(string kind,long gesture=1,int x=300)=>new(){
            RuntimeGeneration=1,SessionId=session,Revision=1,GeometryVersion=1,GestureId=gesture,IssuedAt=0,InputHandle=42,
            Kind=kind,OriginX=100,OriginY=200,PixelWidth=1000,PixelHeight=1000,Dpi=144,X=x,Y=400,Modifiers=4};
        await Check("official desktop keys stay on the physical keyboard path",()=>{
            foreach(var key in new[]{13,32,114}){
                var raw=Packet("down");raw.Key=key;raw.SampleKeyboard=true;raw.Consumer="official.desktop";raw.Button="desktop-"+new string('a',64);raw.EntryId="desktop.scan/"+raw.Button;
                var value=new DextNativePointerPacket(raw);
                Require(value.UsesOfficialKeyboard,"official desktop keyboard treated as author input");
                Require(DextNativePointerPacket.IsOfficialConsumer("official.desktop"),"desktop mouse receipt is not official");
            }
            Require(!DextNativePointerPacket.IsOfficialConsumer("scene"),"author input bypassed dispatch");return Task.CompletedTask;
        });
        await Check("pointer IPC preserves private DOWN scope and native metrics",()=>{
            var p=RuntimeMessageChecks.Roundtrip(Packet("down")) as LivelyMessageRoomNativePointer;
            Require(p!=null&&p.GestureId==1&&p.InputHandle==42&&p.Dpi==144&&p.OriginX==100&&p.X==300,"private pointer roundtrip");return Task.CompletedTask;
        });
        await Check("UP waits for asynchronous frame arm and DOWN forwarding",async()=>{
            var gate=new TaskCompletionSource<bool>();var order=new List<string>();
            var q=new DextNativePointerDelivery(async p=>{order.Add("arm");return await gate.Task;},()=>Task.CompletedTask,p=>order.Add(p.Kind),p=>true,p=>{order.Add("released");return Task.CompletedTask;},()=>order.Add("failed"),()=>0,1000);
            Require(q.Submit(Packet("down")),"DOWN submit");Require(q.Submit(Packet("up")),"UP submit");
            Require(string.Join(",",order)=="arm","UP overtook arm");gate.SetResult(true);await q.WhenIdle();
            Require(string.Join(",",order)=="arm,down,up,released","ordered physical pair");
        });
        await Check("queued pointer data is detached and consecutive moves coalesce before UP",async()=>{
            var gate=new TaskCompletionSource<bool>();var points=new List<(string,int)>();
            var q=new DextNativePointerDelivery(p=>gate.Task,()=>Task.CompletedTask,p=>points.Add((p.Kind,p.X)),p=>true,p=>Task.CompletedTask,()=>{},()=>0,1000);
            var down=Packet("down");Require(q.Submit(down),"DOWN submit");down.X=999;
            for(int i=0;i<120;i++)Require(q.Submit(Packet("move",x:300+i)),"coalesced move submit");
            Require(q.Submit(Packet("up",x:419)),"UP submit");gate.SetResult(true);await q.WhenIdle();
            Require(points.SequenceEqual(new[]{("down",300),("move",419),("up",419)}),"immutable latest move and paired UP");
        });
        await Check("expired arm cannot forward DOWN or create a released pair",async()=>{
            long now=0;var gate=new TaskCompletionSource<bool>();int forwards=0,releases=0,revokes=0;
            var q=new DextNativePointerDelivery(p=>gate.Task,()=>{revokes++;return Task.CompletedTask;},p=>forwards++,p=>true,p=>{releases++;return Task.CompletedTask;},()=>{},()=>now,1000);
            Require(q.Submit(Packet("down")),"DOWN submit");Require(q.Submit(Packet("up")),"UP submit");now=1500;gate.SetResult(true);await q.WhenIdle();
            Require(forwards==0&&releases==0&&revokes>0,"expired DOWN was forwarded");
        });
        await Check("scope revoked during arm prevents input and drains bounded queue",async()=>{
            bool current=true;var gate=new TaskCompletionSource<bool>();int forwards=0;
            var q=new DextNativePointerDelivery(p=>gate.Task,()=>Task.CompletedTask,p=>forwards++,p=>current,p=>Task.CompletedTask,()=>{},()=>0,1000);
            Require(q.Submit(Packet("down")),"DOWN submit");current=false;gate.SetResult(true);await q.WhenIdle();Require(forwards==0,"old scope input");
        });
        await Check("UP without this queue's DOWN never forwards or releases authority",async()=>{
            int forwards=0,releases=0;var q=new DextNativePointerDelivery(p=>Task.FromResult(true),()=>Task.CompletedTask,p=>forwards++,p=>true,p=>{releases++;return Task.CompletedTask;},()=>{},()=>0,1000);
            Require(q.Submit(Packet("up")),"UP accepted for processing");await q.WhenIdle();Require(forwards==0&&releases==0,"unmatched UP");
        });
        await Check("invalidate releases the owned press only after guardian revoke",async()=>{
            var order=new List<string>();var q=new DextNativePointerDelivery(p=>Task.FromResult(true),()=>{order.Add("revoke");return Task.CompletedTask;},p=>order.Add(p.Kind),p=>true,p=>Task.CompletedTask,()=>{},()=>0,1000);
            Require(q.Submit(Packet("down")),"DOWN submit");await q.WhenIdle();await q.InvalidateAsync();
            Require(string.Join(",",order)=="down,revoke,cancel","owned release order");
        });
        await Check("cancel keeps the last forwarded physical pointer position",async()=>{
            var points=new List<(string,int)>();var q=new DextNativePointerDelivery(p=>Task.FromResult(true),()=>Task.CompletedTask,p=>points.Add((p.Kind,p.X)),p=>true,p=>Task.CompletedTask,()=>{},()=>0,1000);
            Require(q.Submit(Packet("down")),"DOWN submit");await q.WhenIdle();
            Require(q.Submit(Packet("move",x:330)),"MOVE submit");await q.WhenIdle();
            await q.InvalidateAsync();
            Require(points.SequenceEqual(new[]{("down",300),("move",330),("cancel",330)}),"cancel jumped back to DOWN position");
        });
        await Check("stale UP cannot release a newer gesture's native press",async()=>{
            var order=new List<string>();var q=new DextNativePointerDelivery(p=>Task.FromResult(true),()=>Task.CompletedTask,p=>order.Add(p.Kind+":"+p.GestureId),p=>true,p=>Task.CompletedTask,()=>{},()=>0,1000);
            Require(q.Submit(Packet("down",2)),"DOWN submit");await q.WhenIdle();Require(q.Submit(Packet("up",1)),"stale UP submit");await q.WhenIdle();
            Require(string.Join(",",order)=="down:2","stale UP released newer press");Require(q.Submit(Packet("up",2)),"current UP submit");await q.WhenIdle();
            Require(string.Join(",",order)=="down:2,up:2","current UP lost");
        });
        await Check("malformed private pointer packets are rejected before queue admission",async()=>{
            int forwards=0;var q=new DextNativePointerDelivery(p=>Task.FromResult(true),()=>Task.CompletedTask,p=>forwards++,p=>true,p=>Task.CompletedTask,()=>{},()=>0,1000);
            foreach(var bad in new[]{"gesture","handle","scope","kind","dpi","modifiers","outside"}){
                var p=Packet("down");switch(bad){case"gesture":p.GestureId=0;break;case"handle":p.InputHandle=0;break;case"scope":p.SessionId=Guid.Empty;break;case"kind":p.Kind="click";break;case"dpi":p.Dpi=0;break;case"modifiers":p.Modifiers=1;break;case"outside":p.X=99;break;}
                Require(!q.Submit(p),"invalid packet "+bad);
            }await q.WhenIdle();Require(forwards==0,"invalid forwarding");
        });
        LivelyMessageRoomNativePointer KeyPacket(string kind){var p=Packet(kind);p.Key=13;p.ScanCode=28;p.IsExtended=true;p.Consumer="scene";p.Button="open";p.EntryId="button.open";return p;}
        await Check("keyboard private packet freezes key, scan and Core focus entry",()=>{
            var input=KeyPacket("down");var dto=(LivelyMessageRoomNativePointer)RuntimeMessageChecks.Roundtrip(input)!;var frozen=new DextNativePointerPacket(dto);
            input.Consumer="other";Require(frozen.Key==13&&frozen.ScanCode==28&&frozen.IsExtended&&frozen.Consumer=="scene"&&frozen.Button=="open"&&frozen.EntryId=="button.open","keyboard association lost");return Task.CompletedTask;
        });
        await Check("keyboard cancel releases the same native key after guardian revoke",async()=>{
            var order=new List<string>();var q=new DextNativePointerDelivery(p=>Task.FromResult(true),()=>{order.Add("revoke");return Task.CompletedTask;},p=>order.Add(p.Kind+":"+p.Key+":"+p.Consumer),p=>true,p=>Task.CompletedTask,()=>{},()=>0,1000);
            q.Submit(KeyPacket("down"));await q.WhenIdle();await q.InvalidateAsync();
            Require(string.Join(",",order)=="down:13:scene,revoke,cancel:13:scene","key release became mouse release");
        });
        await Check("mouse UP cannot release a keyboard gesture even with the same correlation",async()=>{
            var sent=new List<string>();var q=new DextNativePointerDelivery(p=>Task.FromResult(true),()=>Task.CompletedTask,p=>sent.Add(p.Kind),p=>true,p=>Task.CompletedTask,()=>{},()=>0,1000);
            q.Submit(KeyPacket("down"));await q.WhenIdle();q.Submit(Packet("up"));await q.WhenIdle();Require(sent.SequenceEqual(new[]{"down"}),"mouse released keyboard");
            q.Submit(KeyPacket("up"));await q.WhenIdle();Require(sent.SequenceEqual(new[]{"down","up"}),"same keyboard UP missing");
        });
        await Check("visual sampling and actual dispatch barriers serialize DOWN and UP",async()=>{
            var first=new TaskCompletionSource<bool>();var second=new TaskCompletionSource<bool>();var order=new List<string>();
            var q=new DextNativePointerDelivery(p=>Task.FromResult(true),()=>Task.CompletedTask,p=>order.Add("forward:"+p.Kind),
                p=>true,p=>{order.Add("released");return Task.CompletedTask;},()=>order.Add("failed"),()=>0,1000,
                prepare:p=>{order.Add("sample:"+p.Kind);return Task.FromResult(true);},
                dispatched:async p=>{await(p.Kind=="down"?first.Task:second.Task);order.Add("dispatch:"+p.Kind);});
            q.Submit(Packet("down"));q.Submit(Packet("up"));Require(order.SequenceEqual(new[]{"sample:down","forward:down"}),"UP crossed DOWN dispatch");
            first.SetResult(true);await Task.Delay(10);
            Require(order.SequenceEqual(new[]{"sample:down","forward:down","dispatch:down","sample:up","forward:up"}),"ordered UP sample");
            second.SetResult(true);await q.WhenIdle();Require(order.Last()=="released"&&order[^2]=="dispatch:up","action released before actual UP");
        });
        await Check("a refused visual sample prevents native forwarding",async()=>{
            var sent=new List<string>();var q=new DextNativePointerDelivery(p=>Task.FromResult(true),()=>Task.CompletedTask,p=>sent.Add(p.Kind),
                p=>true,p=>{sent.Add("released");return Task.CompletedTask;},()=>{},()=>0,1000,
                prepare:p=>Task.FromResult(false),dispatched:p=>Task.CompletedTask);
            q.Submit(Packet("down"));q.Submit(Packet("up"));await q.WhenIdle();Require(sent.Count==0,"refused sample forwarded");
        });
        await Check("sampled keyboard flag is immutable and retained on native cancel",async()=>{
            var p=KeyPacket("down");p.SampleKeyboard=true;var copy=new DextNativePointerPacket((LivelyMessageRoomNativePointer)RuntimeMessageChecks.Roundtrip(p)!);
            p.SampleKeyboard=false;Require(copy.SampleKeyboard,"keyboard sampling flag lost");
            var sent=new List<DextNativePointerPacket>();var q=new DextNativePointerDelivery(v=>Task.FromResult(true),()=>Task.CompletedTask,sent.Add,
                v=>true,v=>Task.CompletedTask,()=>{},()=>0,1000);
            p.SampleKeyboard=true;q.Submit(p);await q.WhenIdle();await q.InvalidateAsync();
            Require(sent.Count==2&&sent.All(v=>v.SampleKeyboard)&&sent[1].Kind=="cancel"&&sent[1].Key==13,"cancel dropped sampled key");
        });
        LivelyMessageRoomNativePointer FocusPacket(){var p=Packet("focus");p.Key=9;p.Reverse=true;return p;}
        await Check("native Tab samples current geometry once without arm, forwarded key or action release",async()=>{
            var order=new List<string>();var q=new DextNativePointerDelivery(p=>{order.Add("arm");return Task.FromResult(true);},()=>{order.Add("revoke");return Task.CompletedTask;},
                p=>order.Add("forward"),p=>true,p=>{order.Add("release");return Task.CompletedTask;},()=>order.Add("failed"),()=>0,1000,
                prepare:p=>{order.Add("prepare:"+p.Key+":"+p.Reverse);return Task.FromResult(true);},
                dispatched:p=>{order.Add("sample");return Task.CompletedTask;});
            Require(q.Submit(FocusPacket()),"Tab private packet admission");await q.WhenIdle();
            Require(order.SequenceEqual(new[]{"revoke","prepare:9:True","sample"}),"Tab dispatched DOM key or action");
        });
        Console.WriteLine($"{total-failures}/{total} pointer delivery checks passed");if(failures>0)throw new Exception("Pointer delivery regression");
    }
}
