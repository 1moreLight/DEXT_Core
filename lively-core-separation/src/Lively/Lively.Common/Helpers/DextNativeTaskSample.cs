using Lively.Models.Message;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System;

namespace Lively.Common.Helpers
{
    // Used only for the value returned by ExecuteScript on the fixed official page.
    public static class DextNativeTaskSample
    {
        public static bool TryParse(JToken token, out LivelyRoomNativeTaskHit hit)
        {
            hit=null;
            if(token==null||token.Type==JTokenType.Null)return true;
            if(!(token is JObject value)||value.Count>8)return false;
            try
            {
                var parsed=value.ToObject<LivelyRoomNativeTaskHit>();
                if(!Valid(parsed))return false;
                hit=parsed;return true;
            }
            catch(JsonException){return false;}
            catch(ArgumentException){return false;}
        }
        public static bool Valid(LivelyRoomNativeTaskHit value) => value!=null&&Id(value.ContextId)&&Id(value.ItemId)&&
            (value.Action=="chooseWindow"?Id(value.WindowId):value.WindowId==null&&
                (value.Action=="activate"||value.Action=="openWindows"||value.Action=="togglePin"))&&
            Finite(value.X)&&Finite(value.Y)&&Finite(value.Width)&&Finite(value.Height)&&value.X>=0&&value.Y>=0&&
            value.Width>0&&value.Height>0&&value.X+value.Width<=1&&value.Y+value.Height<=1;
        private static bool Id(string value)=>value!=null&&value.Length==32&&Guid.TryParseExact(value,"N",out _);
        private static bool Finite(double value)=>!double.IsNaN(value)&&!double.IsInfinity(value);
    }
}
