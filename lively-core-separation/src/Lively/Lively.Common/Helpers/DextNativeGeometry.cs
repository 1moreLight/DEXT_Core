using Lively.Models.Message;
using System;
using System.Collections.Generic;
using System.Linq;

namespace Lively.Common.Helpers
{
    // Private host protocol geometry. The returned objects own immutable copies;
    // neither caller DTOs nor focus/proof metadata can change accepted hit regions.
    public static class DextNativeGeometry
    {
        public const int MaxEntries=4096, MaxPieces=64, MaxPointsPerPiece=32, MaxTotalPoints=65536;
        internal const double MachineEpsilon=2.2204460492503131e-16;
        public static bool TryCreate(IReadOnlyList<LivelyRoomNativeButton> source,out DextNativeGeometryEntry[] entries)
        {
            entries=null;
            if(source==null || source.Count>MaxEntries)return false;
            var input=source.ToArray();var result=new DextNativeGeometryEntry[input.Length];
            var identities=new HashSet<string>(StringComparer.Ordinal);var actionKinds=new Dictionary<string,bool>(StringComparer.Ordinal);int total=0;
            for(int i=0;i<input.Length;i++)
            {
                var value=input[i];if(value==null)return false;
                // Snapshot scalar properties once before validating. Points are copied
                // to value types before any geometric predicates are evaluated.
                var consumer=value.Consumer;var button=value.Button;var id=value.EntryId;
                var x=value.X;var y=value.Y;var width=value.Width;var height=value.Height;var tab=value.TabIndex;var polygons=value.Polygons;
                if(!Id(consumer,128)||!Id(button,80)||id!=null&&!Id(id,192)||
                    !Finite(x)||!Finite(y)||!Finite(width)||!Finite(height)||x<0||y<0||width<=0||height<=0||x+width>1||y+height>1||tab< -1||tab>4095)return false;
                var action=consumer+"\0"+button;var explicitId=id!=null;
                if(actionKinds.TryGetValue(action,out var previous) && (!previous||!explicitId))return false;
                actionKinds[action]=explicitId;
                if(explicitId&&!identities.Add(consumer+"\0"+id))return false;
                NativePoint[][] owned=null;
                if(polygons==null){total+=4;if(total>MaxTotalPoints)return false;}
                else
                {
                    if(!explicitId||polygons.Length<1||polygons.Length>MaxPieces)return false;
                    var pieces=polygons.ToArray();owned=new NativePoint[pieces.Length][];
                    double minX=1,minY=1,maxX=0,maxY=0;
                    for(int j=0;j<pieces.Length;j++)
                    {
                        var piece=pieces[j];if(piece==null||piece.Length<3||piece.Length>MaxPointsPerPiece)return false;
                        total+=piece.Length;if(total>MaxTotalPoints)return false;
                        var points=piece.ToArray();var copy=new NativePoint[points.Length];
                        for(int k=0;k<points.Length;k++)
                        {
                            var point=points[k];if(point==null)return false;
                            copy[k]=new NativePoint(point.X,point.Y);
                        }
                        foreach(var point in copy)
                        {
                            if(!Finite(point.X)||!Finite(point.Y)||point.X<0||point.X>1||point.Y<0||point.Y>1)return false;
                            minX=Math.Min(minX,point.X);minY=Math.Min(minY,point.Y);maxX=Math.Max(maxX,point.X);maxY=Math.Max(maxY,point.Y);
                        }
                        if(!ConvexSimple(copy))return false;owned[j]=copy;
                    }
                    if(!Same(x,minX)||!Same(y,minY)||!Same(width,maxX-minX)||!Same(height,maxY-minY))return false;
                }
                result[i]=new DextNativeGeometryEntry(consumer,button,id,x,y,width,height,tab,owned);
            }
            entries=result;return true;
        }
        private static bool Id(string value,int max)=>!string.IsNullOrEmpty(value)&&value.Length<=max&&!value.Any(char.IsControl);
        private static bool Finite(double value)=>!double.IsNaN(value)&&!double.IsInfinity(value);
        private static bool Same(double a,double b)=>Math.Abs(a-b)<=32*MachineEpsilon*Math.Max(1,Math.Max(Math.Abs(a),Math.Abs(b)));
        private static bool ConvexSimple(NativePoint[] polygon)
        {
            int winding=0,n=polygon.Length;
            for(int i=0;i<n;i++)
            {
                var a=polygon[i];var b=polygon[(i+1)%n];
                if(a.X==b.X&&a.Y==b.Y)return false;
                var turn=Sign(a,b,polygon[(i+2)%n]);
                if(turn==0||winding!=0&&turn!=winding)return false;winding=turn;
            }
            // A star can have consistent local turns and still cross itself.
            for(int i=0;i<n;i++)for(int j=i+1;j<n;j++)
            {
                if(j==i+1||i==0&&j==n-1)continue;
                if(Intersects(polygon[i],polygon[(i+1)%n],polygon[j],polygon[(j+1)%n]))return false;
            }
            return true;
        }
        private static bool Intersects(NativePoint a,NativePoint b,NativePoint c,NativePoint d)
        {
            int abC=Sign(a,b,c),abD=Sign(a,b,d),cdA=Sign(c,d,a),cdB=Sign(c,d,b);
            return abC*abD<0&&cdA*cdB<0 || abC==0&&OnSegment(a,b,c) || abD==0&&OnSegment(a,b,d) || cdA==0&&OnSegment(c,d,a) || cdB==0&&OnSegment(c,d,b);
        }
        private static bool OnSegment(NativePoint a,NativePoint b,NativePoint p)=>
            (p.X>=Math.Min(a.X,b.X)||Same(p.X,Math.Min(a.X,b.X)))&&(p.X<=Math.Max(a.X,b.X)||Same(p.X,Math.Max(a.X,b.X)))&&
            (p.Y>=Math.Min(a.Y,b.Y)||Same(p.Y,Math.Min(a.Y,b.Y)))&&(p.Y<=Math.Max(a.Y,b.Y)||Same(p.Y,Math.Max(a.Y,b.Y)));
        internal static int Sign(NativePoint a,NativePoint b,NativePoint p)
        {
            var dx=b.X-a.X;var dy=b.Y-a.Y;var px=p.X-a.X;var py=p.Y-a.Y;var cross=dx*py-dy*px;
            // Covers multiplication and subtraction rounding; this is not a CSS
            // pixel padding. Keep aligned with the official geometry.js predicate.
            var tolerance=32*MachineEpsilon*(Math.Abs(dx*py)+Math.Abs(dy*px)+Math.Abs(dx)*(Math.Abs(p.Y)+Math.Abs(a.Y))+
                Math.Abs(py)*(Math.Abs(b.X)+Math.Abs(a.X))+Math.Abs(dy)*(Math.Abs(p.X)+Math.Abs(a.X))+Math.Abs(px)*(Math.Abs(b.Y)+Math.Abs(a.Y)));
            return cross>tolerance?1:cross< -tolerance?-1:0;
        }
        internal readonly struct NativePoint
        {
            internal NativePoint(double x,double y){X=x;Y=y;}
            internal double X {get;}
            internal double Y {get;}
        }
    }

    public sealed class DextNativeGeometryEntry
    {
        private readonly DextNativeGeometry.NativePoint[][] polygons;
        internal DextNativeGeometryEntry(string consumer,string button,string id,double x,double y,double width,double height,int tabIndex,DextNativeGeometry.NativePoint[][] owned)
        {Consumer=consumer;Button=button;EntryId=id;X=x;Y=y;Width=width;Height=height;TabIndex=tabIndex;polygons=owned;}
        public string Consumer {get;}
        public string Button {get;}
        public string EntryId {get;}
        public double X {get;}
        public double Y {get;}
        public double Width {get;}
        public double Height {get;}
        public int TabIndex {get;}
        public bool Contains(double x,double y)
        {
            if(!(x>=X&&y>=Y&&x<X+Width&&y<Y+Height))return false;
            if(polygons==null)return true;
            var point=new DextNativeGeometry.NativePoint(x,y);
            foreach(var polygon in polygons)
            {
                int winding=0;bool inside=true;
                for(int i=0;i<polygon.Length;i++)
                {
                    int side=DextNativeGeometry.Sign(polygon[i],polygon[(i+1)%polygon.Length],point);
                    if(side==0||winding!=0&&side!=winding){inside=false;break;}winding=side;
                }
                if(inside)return true;
            }
            return false;
        }
    }
}