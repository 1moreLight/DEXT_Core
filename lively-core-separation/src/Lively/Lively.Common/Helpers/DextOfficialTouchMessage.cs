using System;
using System.IO;
using Lively.Models.Message;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
namespace Lively.Common.Helpers
{
    public static class DextOfficialTouchMessage
    {
        public static LivelyMessageRoomDockTouch Parse(string json,string secret,Guid nonce)
        {
            if(json==null||json.Length>2048||nonce==Guid.Empty)return null;
            try
            {
                JObject v;
                using(var reader=new JsonTextReader(new StringReader(json)){MaxDepth=3,DateParseHandling=DateParseHandling.None})
                {v=JObject.Load(reader,new JsonLoadSettings{DuplicatePropertyNameHandling=DuplicatePropertyNameHandling.Error});if(reader.Read())return null;}
                if(v.Count!=14||(string)v["type"]!="dext:v3-official-touch"||(int?)v["protocolVersion"]!=1||
                    (string)v["token"]!=secret||!Guid.TryParseExact((string)v["documentNonce"],"D",out var actual)||actual!=nonce||
                    !Guid.TryParseExact((string)v["sessionId"],"D",out var session))return null;
                long Number(string key){return v[key]?.Type==JTokenType.Integer?(long)v[key]:-1;}
                var generation=Number("runtimeGeneration");var revision=Number("revision");var sequence=Number("sequence");var pointer=Number("pointerId");
                var kind=(string)v["kind"];
                if(generation<=0||revision<=0||sequence<=0||sequence>9007199254740991||pointer<0||pointer>int.MaxValue||
                    kind!="down"&&kind!="up"&&kind!="cancel")return null;
                double Coordinate(string key){return v[key]?.Type==JTokenType.Integer||v[key]?.Type==JTokenType.Float?(double)v[key]:double.NaN;}
                var x=Coordinate("x");var y=Coordinate("y");var width=Coordinate("width");var height=Coordinate("height");
                if(!(width>0&&width<=65536&&height>0&&height<=65536&&x>=0&&y>=0&&x<width&&y<height))return null;
                return new LivelyMessageRoomDockTouch{RuntimeGeneration=generation,SessionId=session,Revision=revision,
                    DocumentNonce=nonce,Sequence=sequence,PointerId=(int)pointer,Kind=kind,X=x/width,Y=y/height};
            }
            catch(Exception e)when(e is JsonException||e is FormatException||e is InvalidCastException||e is OverflowException||e is ArgumentException){return null;}
        }
    }
}
