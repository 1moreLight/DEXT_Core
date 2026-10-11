using System;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
namespace Lively.Services.ApplicationDock;

// Manifest eligibility only. Actual viewport fit, occlusion and input readiness
// must still be acknowledged by the running official host.
internal static class DockThemeEligibility
{
    internal static string Reason(JsonElement manifest,string deskId)
    {
        if(manifest.ValueKind!=JsonValueKind.Object)return "noNativeRoom";
        try
        {
            var room=JsonNode.Parse(manifest.GetRawText());
            var id=room?["dockComponentId"]?.GetValue<string>();
            var desk=room?["desks"]?.AsArray().FirstOrDefault(d=>d?["id"]?.GetValue<string>()==deskId);
            if(id==null||desk==null||desk["components"]?.AsArray().Any(c=>c?.GetValue<string>()==id)!=true)return "noDock";
            var component=room?["components"]?.AsArray().FirstOrDefault(c=>c?["id"]?.GetValue<string>()==id&&c?["role"]?.GetValue<string>()=="dock");
            if(component==null)return "noDock";
            var config=component["config"]?.DeepClone();
            if(desk["componentOverrides"] is JsonObject overrides&&overrides.TryGetPropertyValue(id,out var value))config=Merge(config,value);
            var area=config?["dextTaskArea"];
            if(area==null)return "missingTaskArea";
            if(area["version"]?.GetValue<int>()!=1)return "invalidTaskArea";
            var rect=area["rect"];var placement=component["placement"];
            double Number(JsonNode n,string key)=>n?[key]?.GetValue<double>()??double.NaN;
            var width=Number(placement,"width");var height=Number(placement,"height");
            var x=Number(rect,"x");var y=Number(rect,"y");var w=Number(rect,"width");var h=Number(rect,"height");
            if(!new[]{width,height,x,y,w,h}.All(double.IsFinite)||width<=0||height<=0||x<0||y<0||w<=0||h<=0||x+w>width||y+h>height)return "invalidTaskArea";
            if(area.AsObject().ContainsKey("style"))
            {
                if(area["style"] is not JsonObject style)return "invalidTaskArea";
                foreach(var pair in style)
                {
                    if(pair.Key is "surface" or "accent")
                    {if(!Regex.IsMatch(pair.Value?.GetValue<string>()??"","^#[a-fA-F0-9]{6}([a-fA-F0-9]{2})?$"))return "invalidTaskArea";}
                    else
                    {
                        var range=pair.Key switch {"iconSizeDip"=>(24d,64d),"gapDip"=>(0d,24d),"radiusDip"=>(0d,32d),_=>(double.NaN,double.NaN)};
                        var number=pair.Value?.GetValue<double>()??double.NaN;
                        if(!double.IsFinite(range.Item1)||!double.IsFinite(number)||number<range.Item1||number>range.Item2)return "invalidTaskArea";
                    }
                }
            }
            return null;
        }
        catch(Exception e) when(e is InvalidOperationException or JsonException or FormatException or OverflowException or ArgumentException)
        {return "invalidTaskArea";}
    }
    private static JsonNode Merge(JsonNode original,JsonNode patch)
    {
        if(original is not JsonObject left||patch is not JsonObject right)return patch?.DeepClone();
        var result=(JsonObject)left.DeepClone();
        foreach(var pair in right)result[pair.Key]=Merge(result[pair.Key],pair.Value);
        return result;
    }
}
