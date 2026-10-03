using Lively.Common.Helpers;
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
        public event Action<DextNativeInputFrameScope,DextNativeInputWitness> InputWitness;
        private bool InputCurrent(DextNativePointerPacket value)=>value!=null&&!disposed&&!failed&&!suspended&&
            state.CanUseInput(value.RuntimeGeneration,value.SessionId,value.Revision);
        private bool InputFrame(Frame frame)=>frame.Parent==null&&frame.InputNonce!=null&&Effective(frame)&&
            desired.TryGetValue(frame.Name,out var request)&&request.InstanceId!=null;
        public async Task<bool> ArmInputAsync(DextNativePointerPacket value)
        {
            await RevokeInputAsync();
            if(!InputCurrent(value))return false;
            currentInput=value;var operation=++inputOperation;
            await Task.WhenAll(frames.Values.Where(InputFrame).ToArray().Select(async frame=>{
                var epoch=frame.Epoch;var nonce=frame.InputNonce;frame.InputGesture=value.GestureId;
                var json=await Execute(frame,DextNativeInputGuardianPolicy.ArmScript(secret,nonce,value.GestureId,value.GeometryVersion));
                if(operation!=inputOperation || !InputCurrent(value) || !Alive(frame,epoch) || frame.InputNonce!=nonce)return;
                var reply=JObject.Parse(json);
                if((string)reply["documentNonce"]!=nonce || (bool?)reply["armed"]!=true ||
                    (long?)reply["gestureId"]!=value.GestureId || (long?)reply["structuralVersion"]!=value.GeometryVersion)
                    throw new InvalidOperationException("Native input arm rejected");
            }));
            return operation==inputOperation&&ReferenceEquals(currentInput,value)&&InputCurrent(value);
        }
        public async Task RevokeInputAsync()
        {
            currentInput=null;inputOperation++;
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
        private void ReceiveInput(Frame frame,string json)
        {
            var value=currentInput;
            if(!InputCurrent(value) || !InputFrame(frame) || frame.InputGesture!=value.GestureId ||
                !Alive(frame,frame.Epoch) || !Guid.TryParseExact(frame.InputNonce,"D",out var nonce))return;
            var elapsed=((decimal)Stopwatch.GetTimestamp()-value.IssuedAt)/Stopwatch.Frequency;
            if(elapsed<0||elapsed>=1.5m)return;
            var witness=DextNativeInputGuardianPolicy.ParseWitness(json,secret,nonce);
            if(witness==null || witness.GestureId!=value.GestureId || witness.StructuralVersion!=value.GeometryVersion ||
                witness.DispatchSequence<=frame.InputDispatch)return;
            frame.InputDispatch=witness.DispatchSequence;
            var owner=desired[frame.Name];
            InputWitness?.Invoke(new DextNativeInputFrameScope(value.RuntimeGeneration,value.SessionId,value.Revision,
                frame.Id,frame.Epoch,nonce,owner.Consumer,owner.InstanceId),witness);
        }
    }
}
