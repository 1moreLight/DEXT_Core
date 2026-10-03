using Lively.Common.Helpers;
using Newtonsoft.Json.Linq;

internal static class NativeInputGuardianPolicyChecks
{
    public static void Run()
    {
        var secret = new string('a', 64);
        var combined = DextNativeFrameMediaPolicy.BuildScript(secret);
        Require(combined.Contains("__dextNativeInputGuardianV1"), "combined bootstrap must contain the input guardian");
        Require(combined.IndexOf("__dextNativeInputGuardianV1", StringComparison.Ordinal) <
            combined.IndexOf("__dextNativeMediaPolicyV1", StringComparison.Ordinal), "guardian must install before media captures attachShadow");
        Require(!combined.Contains("__DEXT_INPUT_GUARDIAN_TOKEN__") &&
            !combined.Contains("__DEXT_MEDIA_POLICY_TOKEN__"), "both private placeholders must be replaced");
        Require(combined.Contains("__dextNativeMediaPolicyV1"), "existing media policy remains installed");
        var nonce=Guid.NewGuid().ToString("D");
        var arm=DextNativeInputGuardianPolicy.ArmScript(secret,nonce,42,7);
        var payload=Payload(arm);
        Require((string?)payload["token"]==secret&&(string?)payload["kind"]=="arm"&&
            (string?)payload["documentNonce"]==nonce&&(long?)payload["gestureId"]==42&&(long?)payload["structuralVersion"]==7,
            "native arm binds the exact document and positive gesture/structural version");
        Require(!arm.Contains("globalThis")&&!arm.Contains("window."),"author aliases cannot intercept control arguments");
        Require((string?)Payload(DextNativeInputGuardianPolicy.RevokeScript(secret,nonce))["kind"]=="revoke","explicit document revoke");
        Require((string?)Payload(DextNativeInputGuardianPolicy.DescribeScript(secret))["kind"]=="describe","private describe");
        foreach(var bad in new[]{"",new string('A',64),new string('a',63),secret+"'"}){
            Throws(()=>DextNativeInputGuardianPolicy.BuildScript(bad));
            Throws(()=>DextNativeInputGuardianPolicy.DescribeScript(bad));
        }
        foreach(var bad in new[]{"",nonce+"'",Guid.NewGuid().ToString("N")}){
            Throws(()=>DextNativeInputGuardianPolicy.ArmScript(secret,bad,1,1));
            Throws(()=>DextNativeInputGuardianPolicy.RevokeScript(secret,bad));
        }
        foreach(var number in new[]{0L,-1,9007199254740992L,long.MaxValue}){
            Throws(()=>DextNativeInputGuardianPolicy.ArmScript(secret,nonce,number,1));
            Throws(()=>DextNativeInputGuardianPolicy.ArmScript(secret,nonce,1,number));
        }
        var max=Payload(DextNativeInputGuardianPolicy.ArmScript(secret,nonce,9007199254740991,9007199254740991));
        Require((long?)max["gestureId"]==9007199254740991,"safe integer limit accepted without rounding");
        var rawRequest="{\"type\":\"dext:runtime:request\",\"apiVersion\":1,\"instanceId\":\"fixture\",\"sessionId\":\""+nonce+"\",\"token\":\"sdk\",\"requestId\":\"r1\",\"method\":\"actions.activate\",\"params\":{\"buttonId\":\"open\"}}";
        JObject Witness()=>new(){["type"]="dext:v3-input-witness",["protocolVersion"]=1,["token"]=secret,["documentNonce"]=nonce,
            ["gestureId"]=42,["structuralVersion"]=7,["dispatchSequence"]=3,["requestJson"]=rawRequest};
        var witness=DextNativeInputGuardianPolicy.ParseWitness(Witness().ToString(),secret,Guid.Parse(nonce));
        Require(witness!=null&&witness.DocumentNonce==Guid.Parse(nonce)&&witness.GestureId==42&&witness.StructuralVersion==7&&witness.DispatchSequence==3&&witness.RequestJson==rawRequest,
            "actual native frame witness envelope must freeze exact document, positive gesture and original request");
        foreach(var field in new[]{"protocolVersion","gestureId","structuralVersion","dispatchSequence"}){
            foreach(var bad in new JToken[]{0,-1,1.5,"1",9007199254740992L,JValue.CreateNull()}){
                var value=Witness();value[field]=bad;Require(DextNativeInputGuardianPolicy.ParseWitness(value.ToString(),secret,Guid.Parse(nonce))==null,"strict witness "+field);
            }
        }
        foreach(var field in new[]{"type","token","documentNonce","requestJson"}){
            var value=Witness();value[field]=true;Require(DextNativeInputGuardianPolicy.ParseWitness(value.ToString(),secret,Guid.Parse(nonce))==null,"strict witness string "+field);
        }
        var extra=Witness();extra["consumer"]="forged";Require(DextNativeInputGuardianPolicy.ParseWitness(extra.ToString(),secret,Guid.Parse(nonce))==null,"author cannot choose native frame consumer");
        Require(DextNativeInputGuardianPolicy.ParseWitness(Witness().ToString(),"b".PadRight(64,'b'),Guid.Parse(nonce))==null,"different native secret");
        Require(DextNativeInputGuardianPolicy.ParseWitness(Witness().ToString(),secret,Guid.NewGuid())==null,"different actual document");
        Require(DextNativeInputGuardianPolicy.ParseWitness(Witness().ToString(),secret,Guid.Empty)==null,"uninitialized document");
        Require(DextNativeInputGuardianPolicy.ParseWitness(Witness().ToString()+ "{}",secret,Guid.Parse(nonce))==null,"trailing envelope");
        Require(DextNativeInputGuardianPolicy.ParseWitness(Witness().ToString().Replace("\"protocolVersion\": 1","\"protocolVersion\": 1, \"protocolVersion\": 1"),secret,Guid.Parse(nonce))==null,"duplicate envelope fields");
        extra=Witness();extra["requestJson"]=new string('中',11000);Require(DextNativeInputGuardianPolicy.ParseWitness(extra.ToString(),secret,Guid.Parse(nonce))==null,"UTF8 request budget");
        Require(DextNativeInputGuardianPolicy.ParseWitness(new string(' ',256*1024+1),secret,Guid.Parse(nonce))==null,"native envelope budget");
        Console.WriteLine("PASS embedded guardian/media order, exact native document arm/revoke, integer bounds and strict native witness envelope");
        static JObject Payload(string script){
            var start=script.IndexOf('(');return JObject.Parse(script.Substring(start+1,script.Length-start-2));
        }
        static void Throws(Action action){try{action();}catch(ArgumentException){return;}throw new Exception("invalid native control accepted");}
        static void Require(bool value, string reason) { if (!value) throw new Exception(reason); }
    }
}
