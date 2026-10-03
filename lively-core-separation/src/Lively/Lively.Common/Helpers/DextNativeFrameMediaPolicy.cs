using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System;
using System.IO;
using System.Linq;
using System.Text;

namespace Lively.Common.Helpers
{
    public sealed class DextNativeFrameMediaRequest
    {
        public string FrameName { get; internal set; }
        public string Consumer { get; internal set; }
        public bool Active { get; internal set; }
    }
    public static class DextNativeFrameMediaPolicy
    {
        private static readonly string[] Fields={"type","protocolVersion","runtimeGeneration","sessionId","revision","frameName","consumer","active"};
        public static DextNativeFrameMediaRequest Parse(string json,DextRoomRuntimeState state)
        {
            if(json==null||state==null||Encoding.UTF8.GetByteCount(json)>2048)return null;
            try
            {
                JObject value;
                using(var reader=new JsonTextReader(new StringReader(json)){MaxDepth=4,DateParseHandling=DateParseHandling.None})
                {value=JObject.Load(reader,new JsonLoadSettings{DuplicatePropertyNameHandling=DuplicatePropertyNameHandling.Error});if(reader.Read())return null;}
                if(value.Count!=Fields.Length||Fields.Any(f=>value.Property(f)==null)||(string)value["type"]!="dext:v3-frame-policy"||
                    value["protocolVersion"]?.Type!=JTokenType.Integer||(long)value["protocolVersion"]!=1||value["runtimeGeneration"]?.Type!=JTokenType.Integer||
                    value["revision"]?.Type!=JTokenType.Integer||value["sessionId"]?.Type!=JTokenType.String||!Guid.TryParse((string)value["sessionId"],out var session)||
                    !state.CanUseInput((long)value["runtimeGeneration"],session,(long)value["revision"])||value["active"]?.Type!=JTokenType.Boolean||
                    value["frameName"]?.Type!=JTokenType.String||value["consumer"]?.Type!=JTokenType.String)return null;
                var name=(string)value["frameName"];var consumer=(string)value["consumer"];
                if(name.Length!=48||!name.StartsWith("dext-native-",StringComparison.Ordinal)||!Guid.TryParseExact(name.Substring(12),"D",out _)||!state.HasMediaConsumer(consumer))return null;
                return new DextNativeFrameMediaRequest{FrameName=name,Consumer=consumer,Active=(bool)value["active"]};
            }
            catch(Exception e)when(e is JsonException||e is ArgumentException||e is InvalidCastException||e is FormatException||e is OverflowException){return null;}
        }
        public static string NewSecret()=>Guid.NewGuid().ToString("N")+Guid.NewGuid().ToString("N");
        public static string BuildScript(string secret=null)
        {
            secret=secret??NewSecret();
            if(secret.Length!=64||secret.Any(c=>!(c>='0'&&c<='9'||c>='a'&&c<='f')))throw new ArgumentException("Invalid private media secret");
            using(var stream=typeof(DextNativeFrameMediaPolicy).Assembly.GetManifestResourceStream("Dext.NativeMediaPolicy.js")??throw new InvalidOperationException("Native media policy missing"))
            using(var reader=new StreamReader(stream))return reader.ReadToEnd().Replace("__DEXT_MEDIA_POLICY_TOKEN__",secret);
        }
        public static string DescribeScript(string secret)=>Call(new JObject{["token"]=secret,["kind"]="describe"});
        public static string ApplyScript(string secret,string nonce,long sequence,bool active)=>Call(new JObject{["token"]=secret,["documentNonce"]=nonce,["sequence"]=sequence,["active"]=active});
        // Top-level `this` is the actual realm. Authored globalThis/window aliases
        // must never be able to intercept a private argument via a Proxy.
        private static string Call(JObject args)=>"this.__dextNativeMediaPolicyV1 && this.__dextNativeMediaPolicyV1("+args.ToString(Formatting.None)+")";
    }
}
