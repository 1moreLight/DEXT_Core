using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System;
using System.IO;
using System.Linq;

namespace Lively.Common.Helpers
{
    public sealed class DextNativeInputWitness
    {
        internal DextNativeInputWitness(Guid nonce,long gesture,long structure,long dispatch,string request)
        {DocumentNonce=nonce;GestureId=gesture;StructuralVersion=structure;DispatchSequence=dispatch;RequestJson=request;}
        public Guid DocumentNonce {get;}
        public long GestureId {get;}
        public long StructuralVersion {get;}
        public long DispatchSequence {get;}
        public string RequestJson {get;}
    }
    // Private bootstrap/control only. None of these values are SDK capabilities.
    // The native frame/document registry must still authenticate every witness
    // and Core must validate the named physical gesture before any action.
    public static class DextNativeInputGuardianPolicy
    {
        private const long MaxSafeInteger = 9007199254740991;
        public static string BuildScript(string secret)
        {
            ValidateSecret(secret);
            using(var stream=typeof(DextNativeInputGuardianPolicy).Assembly.GetManifestResourceStream("Dext.NativeInputGuardian.js") ??
                throw new InvalidOperationException("Native input guardian missing"))
            using(var reader=new StreamReader(stream))
                return reader.ReadToEnd().Replace("__DEXT_INPUT_GUARDIAN_TOKEN__", secret);
        }
        public static string DescribeScript(string secret) =>
            Call(secret, new JObject { ["token"]=secret, ["kind"]="describe" });
        public static string ArmScript(string secret, string documentNonce, long gestureId, long structuralVersion)
        {
            ValidateNonce(documentNonce);
            if(gestureId<=0 || gestureId>MaxSafeInteger)throw new ArgumentOutOfRangeException(nameof(gestureId));
            if(structuralVersion<=0 || structuralVersion>MaxSafeInteger)throw new ArgumentOutOfRangeException(nameof(structuralVersion));
            return Call(secret, new JObject { ["token"]=secret, ["kind"]="arm", ["documentNonce"]=documentNonce,
                ["gestureId"]=gestureId, ["structuralVersion"]=structuralVersion });
        }
        public static string FocusScript(string secret,string documentNonce)
        {
            ValidateNonce(documentNonce);
            return Call(secret,new JObject{["token"]=secret,["kind"]="focus",["documentNonce"]=documentNonce});
        }
        public static string RevokeScript(string secret, string documentNonce)
        {
            ValidateNonce(documentNonce);
            return Call(secret, new JObject { ["token"]=secret, ["kind"]="revoke", ["documentNonce"]=documentNonce });
        }
        // Only call for a WebMessageReceived event from the actual registered
        // native frame. This envelope cannot authenticate a self-reported frame
        // or replace the Core physical gesture. Native callers own replay state.
        public static DextNativeInputWitness ParseWitness(string json, string secret, Guid documentNonce)
        {
            if(json==null || json.Length>256*1024 || System.Text.Encoding.UTF8.GetByteCount(json)>256*1024 || documentNonce==Guid.Empty)return null;
            try
            {
                ValidateSecret(secret);
                JObject value;
                using(var reader=new JsonTextReader(new StringReader(json)){MaxDepth=4,DateParseHandling=DateParseHandling.None})
                {
                    value=JObject.Load(reader,new JsonLoadSettings{DuplicatePropertyNameHandling=DuplicatePropertyNameHandling.Error});
                    if(reader.Read())return null;
                }
                var fields=new[]{"type","protocolVersion","token","documentNonce","gestureId","structuralVersion","dispatchSequence","requestJson"};
                if(value.Count!=fields.Length || fields.Any(field=>value.Property(field)==null) ||
                    value["type"].Type!=JTokenType.String || (string)value["type"]!="dext:v3-input-witness" ||
                    value["protocolVersion"].Type!=JTokenType.Integer || (long)value["protocolVersion"]!=1 ||
                    value["token"].Type!=JTokenType.String || (string)value["token"]!=secret ||
                    value["documentNonce"].Type!=JTokenType.String || !Guid.TryParseExact((string)value["documentNonce"],"D",out var nonce) || nonce!=documentNonce ||
                    !PositiveInteger(value["gestureId"],out var gesture) || !PositiveInteger(value["structuralVersion"],out var structure) ||
                    !PositiveInteger(value["dispatchSequence"],out var dispatch) || value["requestJson"].Type!=JTokenType.String)return null;
                var request=(string)value["requestJson"];
                if(string.IsNullOrEmpty(request) || request.Length>32768 || System.Text.Encoding.UTF8.GetByteCount(request)>32768)return null;
                return new DextNativeInputWitness(nonce,gesture,structure,dispatch,request);
            }
            catch(Exception error)when(error is JsonException || error is ArgumentException || error is InvalidCastException || error is FormatException || error is OverflowException)
            {return null;}
        }
        private static bool PositiveInteger(JToken value,out long result)
        {
            result=0;if(value.Type!=JTokenType.Integer)return false;
            result=(long)value;return result>0&&result<=MaxSafeInteger;
        }
        private static void ValidateSecret(string value)
        {
            if(value==null || value.Length!=64 || value.Any(c=>!(c>='0'&&c<='9'||c>='a'&&c<='f')))
                throw new ArgumentException("Invalid private input secret", nameof(value));
        }
        private static void ValidateNonce(string value)
        {
            if(value==null || !Guid.TryParseExact(value,"D",out _))
                throw new ArgumentException("Invalid native document nonce", nameof(value));
        }
        private static string Call(string secret, JObject value)
        {
            ValidateSecret(secret);
            // Actual realm this, never authored window/globalThis aliases.
            return "this.__dextNativeInputGuardianV1 && this.__dextNativeInputGuardianV1("+
                value.ToString(Formatting.None)+")";
        }
    }
}
