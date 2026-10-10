using System.Text.Json;
using System.Text.Json.Nodes;
using Lively.Services.ApplicationDock;
internal static class ThemeEligibilityChecks
{
    internal static void Run()
    {
        var manifest=JsonNode.Parse("""{"dockComponentId":"dock","components":[{"id":"dock","role":"dock","placement":{"width":1000,"height":100},"config":{"dextTaskArea":{"version":1,"rect":{"x":0,"y":0,"width":500,"height":80}}}}],"desks":[{"id":"home","components":["dock"]},{"id":"quiet","components":[]}]}""")!;
        string Read(string desk="home")=>DockThemeEligibility.Reason(JsonSerializer.SerializeToElement(manifest),desk);
        void Check(bool ok,string name){if(!ok)throw new Exception(name);Console.WriteLine("PASS theme eligibility: "+name);}
        Check(Read()==null,"declared official area admitted");
        Check(Read("quiet")=="noDock"&&Read("missing")=="noDock","unassigned and missing Desk rejected");
        var desk=manifest["desks"]![0]!;
        desk["componentOverrides"]=JsonNode.Parse("""{"dock":{"dextTaskArea":{"rect":{"width":300}}}}""");
        Check(Read()==null,"partial override deep merges rectangle");
        desk["componentOverrides"]!["dock"]!["dextTaskArea"]=null;
        Check(Read()=="missingTaskArea","explicit null override removes declaration");
        desk["componentOverrides"]=null;
        manifest["components"]![0]!["config"]!["dextTaskArea"]!["rect"]!["width"]=1001;
        Check(Read()=="invalidTaskArea","out-of-bounds area rejected before launching host");
        manifest["components"]![0]!["config"]!["dextTaskArea"]!["rect"]!["width"]=500;
        manifest["components"]![0]!["config"]!["dextTaskArea"]!["style"]=JsonNode.Parse("""{"iconSizeDip":90}""");
        Check(Read()=="invalidTaskArea","unsupported style rejected");
        Check(DockThemeEligibility.Reason(default,"home")=="noNativeRoom","missing manifest handled");
    }
}
