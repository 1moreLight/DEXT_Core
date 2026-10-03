using Lively.Common.Helpers;
using Lively.Models.Message;
using System;
using System.Diagnostics;
using System.Linq;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;

namespace Lively.Player.WebView2
{
    internal sealed partial class DextNativeFrameMedia
    {
        private DextNativePointerPacket currentInput;
        private long inputOperation;
        private DextNativeAuthorActionDelivery inputActions;
        public void InitializeInputActions(Action<LivelyMessageRoomNativeRequest> ready,Action<LivelyMessageRoomNativeRequest,string> rejected)
            =>inputActions=new DextNativeAuthorActionDelivery(ready,rejected);
        public bool HasInputActions=>inputActions?.HasCurrent==true;
        public void ExpireInputActions()=>inputActions?.Expire();
        public Task ReleasedInputAsync(DextNativePointerPacket value){inputActions?.Released(value);return Task.CompletedTask;}
        private DextNativeInputFrameScope InputScope(Frame frame,DextNativePointerPacket value){
            if(value==null||!InputFrame(frame)||!Guid.TryParseExact(frame.InputNonce,"D",out var nonce))return null;
            var owner=desired[frame.Name];
            return new DextNativeInputFrameScope(value.RuntimeGeneration,value.SessionId,value.Revision,frame.Id,frame.Epoch,nonce,owner.Consumer,owner.InstanceId);
        }
        public void AcceptInputRequest(LivelyMessageRoomNativeRequest request){
            var matching=frames.Values.Where(InputFrame).Where(f=>desired[f.Name].Consumer==request.Consumer&&desired[f.Name].InstanceId==request.AuthorInstance).ToArray();
            var scope=matching.Length==1?InputScope(matching[0],currentInput):null;
            inputActions?.Official(scope,request);
        }
        public event Action<DextNativeInputFrameScope,DextNativeInputWitness> InputWitness;
        private bool InputCurrent(DextNativePointerPacket value)=>value!=null&&!disposed&&!failed&&!suspended&&
            state.CanUseInput(value.RuntimeGeneration,value.SessionId,value.Revision);
        private bool InputFrame(Frame frame)=>frame.Parent==null&&frame.InputNonce!=null&&Effective(frame)&&
            desired.TryGetValue(frame.Name,out var request)&&request.InstanceId!=null;
        public async Task<bool> ArmInputAsync(DextNativePointerPacket value)
        {
            await RevokeInputAsync();
            if(!InputCurrent(value))return false;
            var selected=frames.Values.Where(InputFrame).Where(f=>value.Key==0||desired[f.Name].Consumer==value.Consumer).ToArray();
            if(value.Key!=0&&value.Consumer!="official"&&selected.Length!=1)return false;
            currentInput=value;inputActions?.Begin(value);var operation=++inputOperation;var accepted=true;
            await Task.WhenAll(selected.Select(async frame=>{
                var epoch=frame.Epoch;var nonce=frame.InputNonce;frame.InputGesture=value.GestureId;
                bool Current()=>operation==inputOperation&&InputCurrent(value)&&Alive(frame,epoch)&&frame.InputNonce==nonce;
                void Check(string json){
                    var reply=JObject.Parse(json);
                    if((string)reply["documentNonce"]!=nonce || (bool?)reply["armed"]!=true ||
                        (long?)reply["gestureId"]!=value.GestureId || (long?)reply["structuralVersion"]!=value.GeometryVersion)
                        throw new InvalidOperationException("Native input document rejected");
                }
                var json=await Execute(frame,DextNativeInputGuardianPolicy.ArmScript(secret,nonce,value.GestureId,value.GeometryVersion,value.SampleMouse));
                if(!Current()){accepted=false;return;}Check(json);
                if(value.Key!=0){
                    json=await Execute(frame,DextNativeInputGuardianPolicy.FocusScript(secret,nonce));
                    if(!Current()){accepted=false;return;}Check(json);
                }
            }));
            return accepted&&operation==inputOperation&&ReferenceEquals(currentInput,value)&&InputCurrent(value);
        }
        public async Task RevokeInputAsync()
        {
            currentInput=null;inputOperation++;inputActions?.Cancel();dispatchReceipt?.TrySetResult(false);dispatchReceipt=null;dispatchPacket=null;
            await Task.WhenAll(frames.Values.Where(f=>f.Parent==null&&f.InputNonce!=null).ToArray().Select(async frame=>{
                var epoch=frame.Epoch;var nonce=frame.InputNonce;frame.InputGesture=0;
                try{await Execute(frame,DextNativeInputGuardianPolicy.RevokeScript(secret,nonce));}
                catch(Exception){if(Alive(frame,epoch))throw;}
            }));
        }
        private async Task RevokeOldInputAsync(Frame frame,string nonce)
        {
            try{await Execute(frame,DextNativeInputGuardianPolicy.RevokeScript(secret,nonce));}
            catch(Exception){if(!disposed&&!failed&&frames.ContainsKey(frame.Id))throw;}
        }
        private DextNativePointerPacket dispatchPacket;
        private string dispatchConsumer;
        private Guid officialDispatchNonce;
        private TaskCompletionSource<bool> dispatchReceipt;
        public string OfficialDispatchScript(DextNativePointerPacket value)=>DextNativeInputGuardianPolicy.OfficialArmScript(secret,value.GestureId,value.GeometryVersion,value.Kind);
        public void ExpectInputDispatch(DextNativePointerPacket value,string consumer,Guid officialNonce)
        {
            dispatchReceipt?.TrySetResult(false);dispatchPacket=value;dispatchConsumer=consumer;officialDispatchNonce=officialNonce;
            dispatchReceipt=new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        }
        public async Task<bool> WaitInputDispatchAsync(DextNativePointerPacket value)
        {
            var receipt=dispatchReceipt;if(receipt==null||dispatchPacket!=value)return false;
            var remaining=1500-(int)(((decimal)Stopwatch.GetTimestamp()-value.IssuedAt)*1000/Stopwatch.Frequency);
            if(remaining<=0 || await Task.WhenAny(receipt.Task,Task.Delay(remaining))!=receipt.Task)
                throw new TimeoutException("Native input dispatch not observed");
            return await receipt.Task;
        }
        public void ReceiveOfficialInputDispatch(string json)
        {
            var value=dispatchPacket;
            if(value==null||!InputCurrent(value)||dispatchConsumer!=null&&dispatchConsumer!="official")return;
            if(DextNativeInputGuardianPolicy.ParseDispatch(json,secret,officialDispatchNonce,value.GestureId,value.GeometryVersion,value.Kind))
                dispatchReceipt?.TrySetResult(true);
        }
        private bool ReceiveFrameInputDispatch(Frame frame,string json,Guid nonce)
        {
            var value=dispatchPacket;
            if(value==null||!InputCurrent(value)||dispatchConsumer!=null&&dispatchConsumer!=desired[frame.Name].Consumer)return false;
            if(!DextNativeInputGuardianPolicy.ParseDispatch(json,secret,nonce,value.GestureId,value.GeometryVersion,value.Kind))return false;
            dispatchReceipt?.TrySetResult(true);return true;
        }
        private void ReceiveInput(Frame frame,string json)
        {
            var value=currentInput;
            if(!InputCurrent(value) || !InputFrame(frame) || frame.InputGesture!=value.GestureId ||
                !Alive(frame,frame.Epoch) || !Guid.TryParseExact(frame.InputNonce,"D",out var nonce))return;
            var elapsed=((decimal)Stopwatch.GetTimestamp()-value.IssuedAt)/Stopwatch.Frequency;
            if(elapsed<0||elapsed>=1.5m)return;
            if(ReceiveFrameInputDispatch(frame,json,nonce))return;
            var witness=DextNativeInputGuardianPolicy.ParseWitness(json,secret,nonce);
            if(witness==null || witness.GestureId!=value.GestureId || witness.StructuralVersion!=value.GeometryVersion ||
                witness.DispatchSequence<=frame.InputDispatch)return;
            frame.InputDispatch=witness.DispatchSequence;
            var owner=desired[frame.Name];
            var scope=InputScope(frame,value);
            inputActions?.Witness(scope,witness.RequestJson,witness.GestureId,witness.StructuralVersion);
            InputWitness?.Invoke(scope,witness);
        }
    }
}
