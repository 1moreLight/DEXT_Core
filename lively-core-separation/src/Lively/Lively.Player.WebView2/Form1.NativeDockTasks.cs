using Lively.Models.Message;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System.Threading.Tasks;

namespace Lively.Player.WebView2
{
    public partial class Form1
    {
        private async Task ApplyNativeDockTasks(LivelyMessageRoomDockTasks value)
        {
            if (value == null || value.ProtocolVersion != 1 || IsDisposed || Disposing ||
                !NativeDockIdentity(value.RuntimeGeneration, value.SessionId, value.Revision) ||
                value.SnapshotJson == null || value.SnapshotJson.Length > 4 * 1024 * 1024 ||
                webView.CoreWebView2 == null || !IsOfficialDextDocument(webView.CoreWebView2.Source)) return;
            // JSON is reserialized as a value, never inserted as executable source.
            // This comes from Core stdin; no author-frame message forwards here.
            var payload = new JObject
            {
                ["runtimeGeneration"] = value.RuntimeGeneration,
                ["sessionId"] = value.SessionId.ToString(), ["revision"] = value.Revision,
                ["snapshot"] = JObject.Parse(value.SnapshotJson), ["actionsEnabled"] = value.ActionsEnabled
            };
            await webView.CoreWebView2.ExecuteScriptAsync(
                "this.dextNativeTaskSnapshot&&this.dextNativeTaskSnapshot(" + payload.ToString(Formatting.None) + ")");
        }
    }
}
