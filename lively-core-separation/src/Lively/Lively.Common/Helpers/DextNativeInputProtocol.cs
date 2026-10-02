using Lively.Models.Message;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
namespace Lively.Common.Helpers
{
    public static class DextNativeInputProtocol
    {
        private static readonly string[] IdentityFields={"type","protocolVersion","requestId","method","runtimeGeneration","sessionId","revision"};
        // Only the official top document reaches this parser. It can request
        // consumption of native facts, never create a proof or name a target path.
        public static LivelyMessageRoomNativeRequest Parse(string json,DextRoomRuntimeState state,int pixelWidth,int pixelHeight)
        {
            if(json==null || state==null || Encoding.UTF8.GetByteCount(json)>1024*1024)return null;
            try
            {
                JObject o;
                using(var reader=new JsonTextReader(new StringReader(json)){MaxDepth=24,DateParseHandling=DateParseHandling.None})
                {o=JObject.Load(reader,new JsonLoadSettings{DuplicatePropertyNameHandling=DuplicatePropertyNameHandling.Error});if(reader.Read())return null;}
                if(Text(o["type"])!="dext:v3-native-request" || !Integer(o["protocolVersion"],1,1) || !Integer(o["runtimeGeneration"],1) || !Integer(o["revision"],1) ||
                    !Id(Text(o["requestId"]),128) || !Guid.TryParse(Text(o["sessionId"]),out var session))return null;
                var request=new LivelyMessageRoomNativeRequest {
                    RequestId=Text(o["requestId"]),Method=Text(o["method"]),RuntimeGeneration=(long)o["runtimeGeneration"],SessionId=session,
                    Revision=(long)o["revision"],PixelWidth=pixelWidth,PixelHeight=pixelHeight
                };
                if(!state.CanUseInput(request.RuntimeGeneration,request.SessionId,request.Revision))return null;
                switch(request.Method)
                {
                    case "invalidateGeometry": return Shape(o,IdentityFields)?request:null;
                    case "activate":
                        if(!Shape(o,IdentityFields.Concat(new[]{"consumer","button","geometryVersion"}).ToArray()) ||
                            !Id(Text(o["consumer"]),128) || !Id(Text(o["button"]),80) || !Integer(o["geometryVersion"],1))return null;
                        request.Consumer=Text(o["consumer"]);request.Button=Text(o["button"]);request.GeometryVersion=(long)o["geometryVersion"];return request;
                    case "buttons":
                        if(!Shape(o,IdentityFields.Concat(new[]{"consumer"}).ToArray()) || !Id(Text(o["consumer"]),128))return null;
                        request.Consumer=Text(o["consumer"]);return request;
                    case "geometry":
                        if(!Shape(o,IdentityFields.Concat(new[]{"geometryVersion","buttons","viewport"}).ToArray()) || !Integer(o["geometryVersion"],1) ||
                            !(o["buttons"] is JArray entries) || entries.Count>4096 || !(o["viewport"] is JObject view) || !Shape(view,"width","height","dpr") || pixelWidth<=0 || pixelHeight<=0 ||
                            !Number(view["width"],out var width)||!Number(view["height"],out var height)||!Number(view["dpr"],out var scale)||width<=0||height<=0||scale<.1||scale>8||
                            Math.Abs(width*scale-pixelWidth)>2||Math.Abs(height*scale-pixelHeight)>2)return null;
                        var result=new List<LivelyRoomNativeButton>();var ids=new HashSet<string>(StringComparer.Ordinal);
                        foreach(var token in entries)
                        {
                            if(!(token is JObject b) || !Shape(b,"consumer","button","x","y","width","height","tabIndex") || !Id(Text(b["consumer"]),128)||!Id(Text(b["button"]),80)||
                                !Number(b["x"],out var x)||!Number(b["y"],out var y)||!Number(b["width"],out var w)||!Number(b["height"],out var h)||
                                x<0||y<0||w<=0||h<=0||x+w>1||y+h>1||!Integer(b["tabIndex"],-1,4095)||!ids.Add(Text(b["consumer"])+"\0"+Text(b["button"])))return null;
                            result.Add(new LivelyRoomNativeButton{Consumer=Text(b["consumer"]),Button=Text(b["button"]),X=x,Y=y,Width=w,Height=h,TabIndex=(int)b["tabIndex"]});
                        }
                        request.GeometryVersion=(long)o["geometryVersion"];request.Buttons=result.ToArray();return request;
                    default:return null;
                }
            }
            catch(Exception e)when(e is JsonException || e is ArgumentException || e is InvalidCastException || e is FormatException || e is OverflowException){return null;}
        }
        private static string Text(JToken t)=>t?.Type==JTokenType.String?(string)t:null;
        private static bool Shape(JObject o,params string[] fields)=>o.Count==fields.Length && fields.All(f=>o.Property(f)!=null);
        private static bool Integer(JToken t,long min,long max=9007199254740991)=>t?.Type==JTokenType.Integer && (long)t>=min && (long)t<=max;
        private static bool Number(JToken t,out double value){value=0;if(t==null || t.Type!=JTokenType.Integer && t.Type!=JTokenType.Float)return false;value=(double)t;return !double.IsNaN(value)&&!double.IsInfinity(value);}
        private static bool Id(string value,int limit)=>!string.IsNullOrEmpty(value)&&value.Length<=limit&&!value.Any(char.IsControl);
    }
}
