using Lively.Models.Message;
using System;
using System.Threading.Tasks;
using System.Collections.Generic;
using System.Diagnostics;
namespace Lively.Common.Helpers
{
    public sealed class DextNativePointerPacket
    {
        public DextNativePointerPacket(LivelyMessageRoomNativePointer value){
            if(value==null || value.ProtocolVersion!=1 || !Positive(value.RuntimeGeneration) || value.SessionId==Guid.Empty ||
                !Positive(value.Revision) || !Positive(value.GeometryVersion) || !Positive(value.GestureId) ||
                value.IssuedAt<0 || value.InputHandle==0 || value.Dpi<1 || value.Dpi>1536 ||
                value.PixelWidth<1 || value.PixelHeight<1 || value.PixelWidth>65535 || value.PixelHeight>65535 ||
                value.SampleMouse&&value.Key!=0 || value.SampleKeyboard&&value.Key!=13&&value.Key!=32 || (value.Key!=0&&value.Key!=9&&value.Key!=13&&value.Key!=32) || value.ScanCode<0 || value.ScanCode>255 ||
                value.Key==0&&(value.ScanCode!=0||value.IsExtended||value.Consumer!=null||value.Button!=null||value.EntryId!=null) ||
                value.Key==9&&(value.Kind!="focus"||value.ScanCode!=0||value.IsExtended||value.Consumer!=null||value.Button!=null||value.EntryId!=null) ||
                value.Kind=="focus"&&value.Key!=9 || value.Reverse&&value.Key!=9 ||
                (value.Key==13||value.Key==32)&&(value.Kind=="move"||!Text(value.Consumer,128)||!Text(value.Button,80)||!Text(value.EntryId,192)) ||
                (value.Modifiers&~12)!=0 || value.Kind!="down"&&value.Kind!="move"&&value.Kind!="up"&&value.Kind!="cancel"&&value.Kind!="focus" ||
                (double)value.X-value.OriginX<short.MinValue || (double)value.X-value.OriginX>short.MaxValue ||
                (double)value.Y-value.OriginY<short.MinValue || (double)value.Y-value.OriginY>short.MaxValue ||
                value.Kind=="down"&&((double)value.X-value.OriginX<0 || (double)value.X-value.OriginX>=value.PixelWidth ||
                    (double)value.Y-value.OriginY<0 || (double)value.Y-value.OriginY>=value.PixelHeight))
                throw new ArgumentException("Invalid private native pointer");
            Kind=value.Kind;RuntimeGeneration=value.RuntimeGeneration;SessionId=value.SessionId;Revision=value.Revision;
            GeometryVersion=value.GeometryVersion;GestureId=value.GestureId;IssuedAt=value.IssuedAt;InputHandle=value.InputHandle;
            OriginX=value.OriginX;OriginY=value.OriginY;PixelWidth=value.PixelWidth;PixelHeight=value.PixelHeight;
            Dpi=value.Dpi;X=value.X;Y=value.Y;Modifiers=value.Modifiers;
            SampleMouse=value.SampleMouse;SampleKeyboard=value.SampleKeyboard;Reverse=value.Reverse;Key=value.Key;ScanCode=value.ScanCode;IsExtended=value.IsExtended;Consumer=value.Consumer;Button=value.Button;EntryId=value.EntryId;
        }
        private static bool Text(string value,int max){if(string.IsNullOrEmpty(value)||value.Length>max)return false;foreach(var c in value)if(char.IsControl(c))return false;return true;}
        private static bool Positive(long value)=>value>0&&value<=9007199254740991;
        public bool SampleMouse {get;}
        public bool SampleKeyboard {get;}
        public bool Reverse {get;}
        public bool SampleVisual=>SampleMouse||SampleKeyboard||Kind=="focus";
        public int Key {get;}
        public int ScanCode {get;}
        public bool IsExtended {get;}
        public string Consumer {get;}
        public string Button {get;}
        public string EntryId {get;}
        public string Kind {get;}
        public long RuntimeGeneration {get;}
        public Guid SessionId {get;}
        public long Revision {get;}
        public long GeometryVersion {get;}
        public long GestureId {get;}
        public long IssuedAt {get;}
        public long InputHandle {get;}
        public int OriginX {get;}
        public int OriginY {get;}
        public int PixelWidth {get;}
        public int PixelHeight {get;}
        public int Dpi {get;}
        public int X {get;}
        public int Y {get;}
        public int Modifiers {get;}
    }
    // UI-thread owned. A single operation arms the actual document before
    // forwarding DOWN; later physical edges cannot overtake that operation.
    public sealed class DextNativePointerDelivery
    {
        private sealed class Entry
        {
            internal Entry(DextNativePointerPacket packet,long epoch){Packet=packet;Epoch=epoch;}
            internal DextNativePointerPacket Packet;
            internal readonly long Epoch;
        }
        private readonly Func<DextNativePointerPacket,Task<bool>> arm;
        private readonly Func<Task> revoke;
        private readonly Action<DextNativePointerPacket> forward;
        private readonly Func<DextNativePointerPacket,bool> current;
        private readonly Func<DextNativePointerPacket,Task> released;
        private readonly Action failed;
        private readonly Func<DextNativePointerPacket,Task<bool>> prepare;
        private readonly Func<DextNativePointerPacket,Task> dispatched;
        private readonly Func<long> clock;
        private readonly long frequency;
        private readonly List<Entry> pending=new List<Entry>();
        private DextNativePointerPacket held;
        private long epoch;
        private bool running,terminal;
        private TaskCompletionSource<bool> idle;
        public DextNativePointerDelivery(Func<DextNativePointerPacket,Task<bool>> arm,Func<Task> revoke,
            Action<DextNativePointerPacket> forward,Func<DextNativePointerPacket,bool> current,
            Func<DextNativePointerPacket,Task> released,Action failed,Func<long> clock=null,long frequency=0,
            Func<DextNativePointerPacket,Task<bool>> prepare=null,Func<DextNativePointerPacket,Task> dispatched=null)
        {
            this.arm=arm??throw new ArgumentNullException(nameof(arm));this.revoke=revoke??throw new ArgumentNullException(nameof(revoke));
            this.forward=forward??throw new ArgumentNullException(nameof(forward));this.current=current??throw new ArgumentNullException(nameof(current));
            this.released=released??throw new ArgumentNullException(nameof(released));this.failed=failed??throw new ArgumentNullException(nameof(failed));
            this.prepare=prepare??(packet=>Task.FromResult(true));this.dispatched=dispatched??(packet=>Task.CompletedTask);
            this.clock=clock??Stopwatch.GetTimestamp;this.frequency=frequency==0?Stopwatch.Frequency:frequency;
            if(this.frequency<=0)throw new ArgumentOutOfRangeException(nameof(frequency));
        }
        public bool Submit(LivelyMessageRoomNativePointer value)
        {
            if(terminal)return false;DextNativePointerPacket packet;
            try{packet=new DextNativePointerPacket(value);}catch(ArgumentException){return false;}
            if(packet.Kind=="move"&&pending.Count>0)
            {
                var last=pending[pending.Count-1];
                if(last.Epoch==epoch&&last.Packet?.Kind=="move"&&Same(last.Packet,packet)){last.Packet=packet;return true;}
            }
            if(pending.Count>=64)
            {
                terminal=true;InvalidateAsync();failed();return false;
            }
            pending.Add(new Entry(packet,epoch));Start();return true;
        }
        public Exception LastFailure { get; private set; }
        public Task WhenIdle()=>running?idle.Task:Task.CompletedTask;
        public Task InvalidateAsync()
        {
            epoch++;pending.Clear();pending.Add(new Entry(null,epoch));Start();return WhenIdle();
        }
        private void Start()
        {
            if(running)return;running=true;
            idle=new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
            Run();
        }
        private async void Run()
        {
            try
            {
                while(pending.Count>0)
                {
                    var item=pending[0];pending.RemoveAt(0);var packet=item.Packet;
                    if(packet==null){await Cancel();continue;}
                    if(item.Epoch!=epoch)continue;
                    if(packet.Kind=="cancel")
                    {
                        if(held==null||Same(held,packet))await Cancel(packet);
                        continue;
                    }
                    if(packet.Kind=="focus")
                    {
                        // Core Tab is one read of current visual regions. Retire
                        // any authored pair; no DOM key or action is dispatched.
                        await Cancel();
                        if(item.Epoch!=epoch||!current(packet)||Expired(packet))continue;
                        if(!await prepare(packet)||item.Epoch!=epoch||!current(packet)||Expired(packet)){await Cancel();continue;}
                        await dispatched(packet);
                        if(item.Epoch!=epoch||!current(packet)||Expired(packet))await Cancel();
                        continue;
                    }
                    if(packet.Kind=="down")
                    {
                        if(held!=null)await Cancel();
                        if(!current(packet)||Expired(packet))continue;
                        var accepted=await arm(packet);
                        if(item.Epoch!=epoch || !accepted || !current(packet) || Expired(packet)){await Cancel();continue;}
                        if(!await prepare(packet) || item.Epoch!=epoch || !current(packet) || Expired(packet)){await Cancel();continue;}
                        forward(packet);held=packet;await dispatched(packet);
                        if(item.Epoch!=epoch || !current(packet) || Expired(packet))await Cancel();
                        continue;
                    }
                    if(held==null || !Same(held,packet))continue;
                    if(!current(packet)||Expired(packet)){await Cancel(packet);continue;}
                    if(packet.Kind=="up" && (!await prepare(packet) || item.Epoch!=epoch || !current(packet) || Expired(packet))){await Cancel(packet);continue;}
                    forward(packet);
                    if(packet.Kind=="up"){
                        await dispatched(packet);
                        if(item.Epoch!=epoch || !current(packet) || Expired(packet)){await Cancel(packet);continue;}
                        held=null;await released(packet);
                    }
                    else held=packet;
                }
            }
            catch(Exception error)
            {
                LastFailure=error;
                terminal=true;pending.Clear();
                try{await Cancel();}catch(Exception){}
                failed();
            }
            finally{running=false;idle.TrySetResult(true);}
        }
        private async Task Cancel(DextNativePointerPacket releasePoint=null)
        {
            // Revoke before sending release: the release itself may dispatch an
            // authored UP/click callback and must not grant a stale request.
            await revoke();
            var previous=held;held=null;
            if(previous!=null&&releasePoint!=null&&Same(previous,releasePoint))previous=releasePoint;
            if(previous!=null)forward(new DextNativePointerPacket(new LivelyMessageRoomNativePointer {
                Kind="cancel",RuntimeGeneration=previous.RuntimeGeneration,SessionId=previous.SessionId,Revision=previous.Revision,
                GeometryVersion=previous.GeometryVersion,GestureId=previous.GestureId,IssuedAt=previous.IssuedAt,InputHandle=previous.InputHandle,
                OriginX=previous.OriginX,OriginY=previous.OriginY,PixelWidth=previous.PixelWidth,PixelHeight=previous.PixelHeight,
                Dpi=previous.Dpi,X=previous.X,Y=previous.Y,Modifiers=previous.Modifiers,SampleMouse=previous.SampleMouse,SampleKeyboard=previous.SampleKeyboard,Reverse=previous.Reverse,Key=previous.Key,ScanCode=previous.ScanCode,
                IsExtended=previous.IsExtended,Consumer=previous.Consumer,Button=previous.Button,EntryId=previous.EntryId }));
        }
        private bool Expired(DextNativePointerPacket packet)
        {var elapsed=((decimal)clock()-packet.IssuedAt)/frequency;return elapsed<0||elapsed>=1.5m;}
        private static bool Same(DextNativePointerPacket a,DextNativePointerPacket b)=>
            a.RuntimeGeneration==b.RuntimeGeneration&&a.SessionId==b.SessionId&&a.Revision==b.Revision&&a.GeometryVersion==b.GeometryVersion&&
            a.GestureId==b.GestureId&&a.IssuedAt==b.IssuedAt&&a.InputHandle==b.InputHandle&&a.OriginX==b.OriginX&&a.OriginY==b.OriginY&&
            a.PixelWidth==b.PixelWidth&&a.PixelHeight==b.PixelHeight&&a.Dpi==b.Dpi&&a.SampleMouse==b.SampleMouse&&a.SampleKeyboard==b.SampleKeyboard&&a.Reverse==b.Reverse&&a.Key==b.Key&&a.ScanCode==b.ScanCode&&
            a.IsExtended==b.IsExtended&&a.Consumer==b.Consumer&&a.Button==b.Button&&a.EntryId==b.EntryId;
    }
}
