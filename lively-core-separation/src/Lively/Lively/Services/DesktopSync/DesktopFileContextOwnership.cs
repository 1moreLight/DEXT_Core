using Lively.Common.Helpers;
using System;
using System.Collections.Generic;
using System.Linq;
namespace Lively.Services.DesktopSync;

internal sealed record DesktopFileContextEdge(bool Down,int X,int Y,long At,string Button,string? EntryId,bool Cancelled=false);
internal sealed class DesktopFileContextOffer
{
    internal DesktopFileContextOffer(long expiresAt,IntPtr root,int x,int y,int width,int height,int tolerance,
        IEnumerable<DextNativeGeometryEntry> regions,Action<DesktopFileContextEdge> deliver,IEnumerable<IntPtr>? otherRoots=null,bool allowBackground=false)
    {AllowBackground=allowBackground;ExpiresAt=expiresAt;Roots=Array.AsReadOnly(new[]{root}.Concat(otherRoots??Array.Empty<IntPtr>()).Where(value=>value!=IntPtr.Zero).Distinct().ToArray());X=x;Y=y;Width=width;Height=height;Tolerance=tolerance;Regions=Array.AsReadOnly(regions.ToArray());Deliver=deliver;}
    internal bool AllowBackground{get;}
    internal long ExpiresAt{get;}
    internal IReadOnlyList<IntPtr> Roots{get;}
    internal int X{get;} internal int Y{get;} internal int Width{get;} internal int Height{get;} internal int Tolerance{get;}
    internal IReadOnlyList<DextNativeGeometryEntry> Regions{get;}
    internal Action<DesktopFileContextEdge> Deliver{get;}
}
internal sealed class DesktopFileContextOwnership(long frequency)
{
    private bool held,cancelled;
    private DesktopFileContextOffer? owner;
    private DesktopFileContextEdge? down;
    internal bool IsTracking=>owner is not null;
    internal void IgnoreHeld()=>held=true;
    internal bool Process(int message,int x,int y,long at,IntPtr root,bool synthetic,
        DesktopFileContextOffer? offer,Func<DesktopFileContextOffer,DesktopFileContextEdge,bool> enqueue,bool otherButtonHeld=false)
    {
        // Touch/pen promoted and synthetic mouse events retain their original
        // route. They also cannot finish another device's physical pair.
        if(synthetic)return false;
        if(message!=0x204&&message!=0x205){
            if(owner is not null&&(message==0x201||message==0x207||message==0x20b||
                message==0x200&&!WithinPress(x,y,at,root)))cancelled=true;
            return false;
        }
        if(message==0x205){
            held=false;
            var previous=owner;var press=down;
            if(previous is null||press is null)return false;
            var release=Hit(previous,x,y);
            var same=press.Button=="desktop.background" ? release is null&&Inside(previous,x,y) :
                release?.Consumer=="official.desktop"&&release.Button==press.Button&&release.EntryId==press.EntryId;
            var invalid=cancelled||!WithinPress(x,y,at,root)||!same;
            owner=null;down=null;cancelled=false;
            // DOWN already went to Dext. Even a closing queue must not give
            // Explorer an unmatched UP and a second context menu.
            try{enqueue(previous,new(false,x,y,at,press.Button,press.EntryId,invalid));}catch{}
            return true;
        }
        if(held)return owner is not null;
        held=true;
        if(otherButtonHeld||offer is null||at>offer.ExpiresAt||root==IntPtr.Zero||!offer.Roots.Contains(root)||frequency<=0||
            offer.Regions.Count>4096||offer.Width<=0||offer.Height<=0||offer.Tolerance<1||offer.Tolerance>256)return false;
        var target=Hit(offer,x,y);
        var blank=target is null&&offer.AllowBackground&&Inside(offer,x,y);
        if(!blank&&(target?.Consumer!="official.desktop"||!target.Button.StartsWith("desktop-",StringComparison.Ordinal)))return false;
        var edge=new DesktopFileContextEdge(true,x,y,at,blank?"desktop.background":target!.Button,blank?null:target!.EntryId);
        try{if(!enqueue(offer,edge))return false;}catch{return false;}
        owner=offer;down=edge;cancelled=false;return true;
    }
    private bool WithinPress(int x,int y,long at,IntPtr root)=>owner is not null&&down is not null&&owner.Roots.Contains(root)&&
        (decimal)at-down.At>=0&&((decimal)at-down.At)/frequency<1.5m&&
        Math.Abs((double)x-down.X)<=owner.Tolerance&&Math.Abs((double)y-down.Y)<=owner.Tolerance;
    private static bool Inside(DesktopFileContextOffer offer,int x,int y)=>x>=offer.X&&y>=offer.Y&&(long)x<(long)offer.X+offer.Width&&(long)y<(long)offer.Y+offer.Height;
    private static DextNativeGeometryEntry? Hit(DesktopFileContextOffer offer,int x,int y)
    {
        var px=((double)x-offer.X)/offer.Width;var py=((double)y-offer.Y)/offer.Height;
        if(px<0||py<0||px>=1||py>=1)return null;
        // Preserve all front-to-back entries. Filtering files before hit testing
        // would capture a file covered by an authored control.
        foreach(var region in offer.Regions)if(region.Contains(px,py))return region;
        return null;
    }
}
