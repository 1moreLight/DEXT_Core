using System;
using System.Collections.Generic;
namespace Lively.Services.DesktopSync;

internal sealed record DesktopFileKeyEdge(int Key,bool Down,int Modifiers,int ScanCode,bool Extended);
internal sealed record DesktopFileKeyboardOffer(long ExpiresAt,IntPtr Foreground,int X,int Y,int Width,int Height,
    string Button,Action<DesktopFileKeyEdge> Deliver);
// Used only on the hook thread. A physical press keeps its original owner until UP.
internal sealed class DesktopFileKeyboardOwnership
{
    internal static bool IsCommandKey(int key)=>key is 13 or 32 or 46 or 67 or 88 or 86 or 114 or 93 or 121;
    private readonly HashSet<int> held=new();
    private readonly Dictionary<int,(DesktopFileKeyboardOffer Offer,int Modifiers)> owners=new();
    internal void IgnoreHeld(int key){if(IsCommandKey(key))held.Add(key);}
    internal bool Process(DesktopFileKeyEdge edge,bool injected,long now,IntPtr foreground,int x,int y,
        DesktopFileKeyboardOffer? offer,Func<DesktopFileKeyboardOffer,DesktopFileKeyEdge,bool> enqueue)
    {
        // On-screen keyboards also use injected events. They keep the same scope checks.
        if(!IsCommandKey(edge.Key))return false;
        if(!edge.Down){
            held.Remove(edge.Key);
            if(!owners.Remove(edge.Key,out var previous))return false;
            try{enqueue(previous.Offer,edge with{Modifiers=previous.Modifiers});}catch{}
            return true;
        }
        if(!held.Add(edge.Key))return owners.ContainsKey(edge.Key);
        var command=offer?.Button=="desktop.paste";
        var file=offer?.Button?.StartsWith("desktop-",StringComparison.Ordinal)==true;
        var allowed=edge.Key is 93 or 121?file&&edge.Modifiers==(edge.Key==93?0:2):edge.Key==46?file&&edge.Modifiers is 0 or 2:edge.Key is 67 or 88 or 86?edge.Modifiers==1&&(file||command&&edge.Key==86):
            edge.Modifiers==0&&(file||command&&edge.Key is 13 or 32);
        if(!allowed||offer is null||now>offer.ExpiresAt||foreground==IntPtr.Zero||foreground!=offer.Foreground||
            x<offer.X||y<offer.Y||(long)x>=((long)offer.X+offer.Width)||(long)y>=((long)offer.Y+offer.Height))return false;
        try{if(!enqueue(offer,edge))return false;}catch{return false;}
        owners.Add(edge.Key,(offer,edge.Modifiers));return true;
    }
}
