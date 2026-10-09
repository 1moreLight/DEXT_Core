using Lively.Common.Helpers;
using Microsoft.Web.WebView2.Core;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Lively.Player.WebView2
{
    // UI-thread owned. No author-supplied frame identifier can select a native
    // frame: only the fixed official document names direct children before mount.
    internal sealed partial class DextNativeFrameMedia : IDisposable
    {
        private sealed class Frame
        {
            public CoreWebView2Frame Native;
            public uint Id;
            public Frame Parent;
            public string Name, Nonce;
            public bool Invalid, Navigating, Retiring;
            public long Epoch, Sequence;
            public string InputNonce;
            public long InputGesture, InputDispatch;
            public Action Detach;
            public Frame Root => Parent?.Root ?? this;
        }
        private readonly CoreWebView2 core;
        private readonly DextRoomRuntimeState state;
        private readonly Action<string> failure;
        private readonly bool controlledDockInput;
        private readonly string secret=DextNativeFrameMediaPolicy.NewSecret();
        private readonly Dictionary<uint,Frame> frames=new Dictionary<uint,Frame>();
        private readonly Dictionary<string,DextNativeFrameMediaRequest> desired=new Dictionary<string,DextNativeFrameMediaRequest>(StringComparer.Ordinal);
        private bool suspended,disposed,failed;
        public DextNativeFrameMedia(CoreWebView2 core,DextRoomRuntimeState state,Action<string> failure,bool controlledDockInput=false)
        {this.core=core;this.state=state;this.failure=failure;this.controlledDockInput=controlledDockInput;}
        public async Task InitializeAsync()
        {
            await core.AddScriptToExecuteOnDocumentCreatedAsync(DextNativeFrameMediaPolicy.BuildScript(secret,controlledDockInput));
            core.FrameCreated+=Created;
        }
        private void Created(object sender,CoreWebView2FrameCreatedEventArgs e)=>Track(e.Frame,null);
        private void Track(CoreWebView2Frame native,Frame parent)
        {
            if(disposed||frames.ContainsKey(native.FrameId))return;
            if(frames.Count>=1024){Fail();return;}
            var frame=new Frame{Native=native,Id=native.FrameId,Parent=parent,Name=native.Name};frames.Add(native.FrameId,frame);
            EventHandler<object> renamed=(s,e)=>{
                if(parent!=null)return;
                // Some runtimes announce a frame before its initial name. Once
                // established, an authored window.name change retires this root.
                if(string.IsNullOrEmpty(frame.Name)&&native.Name.StartsWith("dext-native-",StringComparison.Ordinal))frame.Name=native.Name;
                else frame.Invalid=true;
                Observe(RefreshAsync());
            };
            EventHandler<CoreWebView2NavigationStartingEventArgs> navigating=(s,e)=>{
                if(e.Cancel)return;
                if(Guid.TryParseExact(frame.InputNonce,"D",out var oldInputNonce))inputActions?.RevokeDocument(frame.Id,frame.Epoch,oldInputNonce);
                var nonce=frame.Nonce;var inputNonce=frame.InputNonce;frame.Epoch++;frame.Nonce=null;frame.InputNonce=null;frame.InputGesture=0;frame.InputDispatch=0;frame.Sequence=0;frame.Navigating=true;
                if(inputNonce!=null)Observe(RevokeOldInputAsync(frame,inputNonce));
                if(nonce!=null)Observe(StopOldAsync(frame,nonce));
            };
            EventHandler<CoreWebView2DOMContentLoadedEventArgs> loaded=(s,e)=>Observe(LoadAsync(frame));
            EventHandler<CoreWebView2FrameCreatedEventArgs> child=(s,e)=>Track(e.Frame,frame);
            EventHandler<object> destroyed=(s,e)=>Remove(frame,false);
            EventHandler<CoreWebView2WebMessageReceivedEventArgs> input=(s,e)=>ReceiveInput(frame,e.WebMessageAsJson);
            native.WebMessageReceived+=input;
            native.NameChanged+=renamed;native.NavigationStarting+=navigating;native.DOMContentLoaded+=loaded;native.FrameCreated+=child;native.Destroyed+=destroyed;
            frame.Detach=()=>{native.WebMessageReceived-=input;native.NameChanged-=renamed;native.NavigationStarting-=navigating;native.DOMContentLoaded-=loaded;native.FrameCreated-=child;native.Destroyed-=destroyed;};
        }
        private bool Alive(Frame frame,long epoch)
        {
            if(disposed||failed||!frames.TryGetValue(frame.Id,out var current)||!ReferenceEquals(frame,current)||frame.Epoch!=epoch)return false;
            try{return frame.Native.IsDestroyed()==0;}catch(System.Runtime.InteropServices.COMException){return false;}catch(InvalidOperationException){return false;}
        }
        private async Task<string> Execute(Frame frame,string script)
        {
            var operation=frame.Native.ExecuteScriptAsync(script);
            if(await Task.WhenAny(operation,Task.Delay(5000))!=operation)throw new TimeoutException("Native frame media policy timeout");
            return await operation;
        }
        private async Task LoadAsync(Frame frame)
        {
            var epoch=frame.Epoch;
            if(!Alive(frame,epoch)||!frame.Navigating)return;
            try
            {
                var json=await Execute(frame,DextNativeFrameMediaPolicy.DescribeScript(secret));
                if(!Alive(frame,epoch))return;
                var description=JObject.Parse(json);var nonce=(string)description["documentNonce"];
                if(!Guid.TryParse(nonce,out _)||(bool?)description["active"]!=false||(long?)description["sequence"]!=0)throw new InvalidOperationException("Native frame policy unavailable");
                // Only registered direct author documents receive input. Nested
                // media documents still follow their root's playback policy.
                if(frame.Parent==null){
                    var inputJson=await Execute(frame,DextNativeInputGuardianPolicy.DescribeScript(secret));
                    if(!Alive(frame,epoch))return;
                    var input=JObject.Parse(inputJson);var inputNonce=(string)input["documentNonce"];
                    if(!Guid.TryParseExact(inputNonce,"D",out _) || (bool?)input["armed"]!=false || (long?)input["gestureId"]!=0 ||
                        (long?)input["structuralVersion"]!=0)throw new InvalidOperationException("Native frame input policy unavailable");
                    frame.InputNonce=inputNonce;
                }
                frame.Nonce=nonce;await ApplyAsync(frame);
            }
            catch(Exception error){if(Alive(frame,epoch))Fail("Frame load: "+error.GetType().Name+": "+error.Message);}
        }
        private async Task StopOldAsync(Frame frame,string nonce)
        {
            var epoch=frame.Epoch;
            try{await Execute(frame,DextNativeFrameMediaPolicy.ApplyScript(secret,nonce,9007199254740991,false));}
            catch(Exception){if(Alive(frame,epoch))Fail();}
        }
        private bool Effective(Frame frame)
        {
            var owner=frame.Root;
            if(suspended||disposed||failed||owner.Invalid||owner.Name==null||!desired.TryGetValue(owner.Name,out var request)||!request.Active||!state.CanRenderMedia(request.Consumer))return false;
            // A repeated root name cannot gain authority through an alias.
            return frames.Values.Count(f=>f.Parent==null&&!f.Invalid&&f.Name==owner.Name)==1;
        }
        private async Task ApplyAsync(Frame frame)
        {
            var nonce=frame.Nonce;var epoch=frame.Epoch;
            if(nonce==null||!Alive(frame,epoch))return;
            var sequence=++frame.Sequence;var active=Effective(frame);
            try
            {
                var json=await Execute(frame,DextNativeFrameMediaPolicy.ApplyScript(secret,nonce,sequence,active));
                if(!Alive(frame,epoch)||frame.Nonce!=nonce||frame.Sequence!=sequence)return;
                if(!active&&frame.Root.Retiring&&json=="null")return; // pagehide has already stopped this retiring document
                var stop=DateTime.UtcNow.AddSeconds(5);
                while(true)
                {
                    var reply=JObject.Parse(json);
                    if((string)reply["documentNonce"]!=nonce||(long?)reply["sequence"]!=sequence||(bool?)reply["active"]!=active)throw new InvalidOperationException("Native frame policy rejected");
                    // ExecuteScript returns JSON without awaiting JS Promises.
                    // The output gate is already muted; await the real WebAudio
                    // suspension receipt before letting the renderer suspend.
                    if(active||(bool?)reply["settled"]==true)return;
                    if(DateTime.UtcNow>=stop)throw new TimeoutException("Native WebAudio suspension timeout");
                    await Task.Delay(20);
                    if(!Alive(frame,epoch)||frame.Nonce!=nonce||frame.Sequence!=sequence)return;
                    json=await Execute(frame,DextNativeFrameMediaPolicy.DescribeScript(secret));
                    if(!Alive(frame,epoch)||frame.Nonce!=nonce||frame.Sequence!=sequence)return;
                    if(frame.Root.Retiring&&json=="null")return;
                }
            }
            catch(Exception error){if(Alive(frame,epoch)&&frame.Nonce==nonce&&frame.Sequence==sequence)Fail(error.GetType().Name+": "+error.Message);}
        }
        public async Task AcceptAsync(string json)
        {
            if(disposed||failed)return;var request=DextNativeFrameMediaPolicy.Parse(json,state);if(request==null)return;
            if(!desired.ContainsKey(request.FrameName)&&desired.Count>=196){Fail();return;}
            if(desired.TryGetValue(request.FrameName,out var old)&&(old.Consumer!=request.Consumer || old.InstanceId!=null&&old.InstanceId!=request.InstanceId)){Fail();return;}
            if(!request.Active)await RevokeInputAsync();
            desired[request.FrameName]=request;foreach(var frame in frames.Values.Where(f=>f.Parent==null&&f.Name==request.FrameName))frame.Retiring=false;await RefreshAsync();
        }
        // Cached Core changes while the renderer is suspended cannot execute JS.
        // The pause barrier already stopped every live document; new ones default paused.
        public Task RefreshAsync()=>suspended?Task.CompletedTask:ApplyAllAsync();
        private Task ApplyAllAsync()=>Task.WhenAll(frames.Values.ToArray().Select(ApplyAsync));
        public async Task SetSuspendedAsync(bool value){suspended=value;if(value)await RevokeInputAsync();await ApplyAllAsync();}
        public async Task ResetAsync(){await RevokeInputAsync();desired.Clear();foreach(var frame in frames.Values)frame.Retiring=true;await RefreshAsync();}
        private async void Observe(Task operation){try{await operation;}catch(Exception){Fail();}}
        private void Remove(Frame frame,bool detach=true)
        {
            if(!frames.TryGetValue(frame.Id,out var current)||!ReferenceEquals(current,frame))return;
            foreach(var child in frames.Values.Where(f=>f.Parent==frame).ToArray())Remove(child,detach);
            inputActions?.RevokeFrame(frame.Id);
            frames.Remove(frame.Id);frame.Epoch++;frame.Nonce=null;frame.InputNonce=null;frame.InputGesture=0;
            // A Destroyed callback is already inside native frame teardown. Do not
            // reenter the dying frame to remove handlers (WebView native crash).
            if(detach)try{frame.Detach?.Invoke();}catch(Exception){}
            if(frame.Parent==null&&frame.Name!=null)desired.Remove(frame.Name);
        }
        private void Fail(string reason="Native frame policy unavailable"){if(disposed||failed)return;failed=true;failure(reason);}
        public void Dispose()
        {
            if(disposed)return;disposed=true;inputActions?.Cancel();currentInput=null;inputOperation++;core.FrameCreated-=Created;
            foreach(var frame in frames.Values.ToArray())Remove(frame);desired.Clear();
        }
    }
}
