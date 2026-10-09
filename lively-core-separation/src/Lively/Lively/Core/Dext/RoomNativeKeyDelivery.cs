using System;

namespace Dext.Core.Rooms;

// Serializes physical-key delivery after Core resolves preceding Tab samples.
// This lock may read the input leaf; the leaf never calls back into delivery.
internal sealed class RoomNativeKeyDelivery(RoomNativeInputAuthority input,
    Action<RoomNativeInputGesture,RoomNativeButton,string,int,bool> send)
{
    private readonly object gate=new();
    private sealed record Pending(RoomNativeInputGesture Gesture,int ScanCode,bool Extended);
    private Pending? pending,held;
    private RoomNativeButton? heldFocus;
    internal void Down(RoomNativeInputGesture gesture,int scanCode,bool extended)
    {
        lock(gate){CancelHeld();pending=new(gesture,scanCode,extended);FlushLocked();}
    }
    internal void Up(int key)
    {
        lock(gate){
            FlushLocked();
            if(held is not{} own || own.Gesture.Key!=key)return;
            var state=input.State;
            var current=Matches(state,own.Gesture)&&state!.Gesture!.Released;
            held=null;var focus=heldFocus!;heldFocus=null;
            send(own.Gesture,focus,current?"up":"cancel",own.ScanCode,own.Extended);
        }
    }
    internal void FocusRequested(){lock(gate){pending=null;CancelHeld();}}
    internal void Flush(){lock(gate)FlushLocked();}
    private void FlushLocked()
    {
        if(pending is not{} own)return;
        var state=input.State;
        if(!Matches(state,own.Gesture)){pending=null;return;}
        if(!state!.KeyReady)return;
        pending=null;
        if(state.Focus is not{} focus)return;
        var current=own with{Gesture=state.Gesture!};held=current;heldFocus=focus;
        send(current.Gesture,focus,"down",current.ScanCode,current.Extended);
        if(current.Gesture.Released){
            held=null;heldFocus=null;
            send(current.Gesture,focus,"up",current.ScanCode,current.Extended);
        }
    }
    private static bool Matches(RoomNativeInputState? state,RoomNativeInputGesture gesture)=>
        state?.Gesture is{} current&&current.Sequence==gesture.Sequence&&current.Key==gesture.Key&&
        state.Generation==gesture.Generation&&state.Session==gesture.Session&&state.Revision==gesture.Revision&&state.GeometryVersion==gesture.GeometryVersion;
    private void CancelHeld()
    {
        if(held is not{} own)return;
        held=null;var focus=heldFocus!;heldFocus=null;
        send(own.Gesture,focus,"cancel",own.ScanCode,own.Extended);
    }
}
