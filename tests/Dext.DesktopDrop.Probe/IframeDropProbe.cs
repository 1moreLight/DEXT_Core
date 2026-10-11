using Microsoft.Web.WebView2.WinForms;
using System.Text.Json;

internal static class IframeDropProbe
{
    internal static async Task Run(WebView2 view)
    {
        var root = Directory.CreateTempSubdirectory("Dext-iframe-drop-").FullName;
        var file = Path.Combine(root, "fixture.txt");
        File.WriteAllText(file, "isolated iframe drop fixture");
        var core = view.CoreWebView2;
        var loaded = new TaskCompletionSource();
        EventHandler<Microsoft.Web.WebView2.Core.CoreWebView2NavigationCompletedEventArgs> handler = (_, e) =>
        { if (e.IsSuccess) loaded.TrySetResult(); else loaded.TrySetException(new Exception(e.WebErrorStatus.ToString())); };
        var received = new TaskCompletionSource<string[]>();
        EventHandler<Microsoft.Web.WebView2.Core.CoreWebView2WebMessageReceivedEventArgs> message = (_, args) =>
        {
            try
            {
                using var json = JsonDocument.Parse(args.TryGetWebMessageAsString());
                if (json.RootElement.GetProperty("method").GetString() != "desktopDrop") return;
                if (!Lively.Player.WebView2.DextNativeDroppedFiles.TryRead(args.AdditionalObjects, out var paths))
                    throw new Exception("Production file reader rejected iframe drop");
                received.TrySetResult(paths);
            }
            catch (Exception error) { received.TrySetException(error); }
        };
        core.WebMessageReceived += message;
        core.NavigationCompleted += handler;
        try
        {
            core.NavigateToString("""
                <!doctype html><style>html,body{margin:0;width:100%;height:100%}iframe{width:100%;height:100%;border:0}</style>
                <script>
                window.events=[];
                for(const name of ['dragenter','dragover','dragleave','drop'])document.addEventListener(name,e=>{
                  events.push('top:'+name+':'+e.target.tagName);e.preventDefault();
                  if(name==='dragover')e.dataTransfer.dropEffect='copy';
                },true);
                window.addEventListener('message',e=>events.push(e.data));
                </script>
                <iframe sandbox="allow-scripts" srcdoc="<script>for(const name of ['dragenter','dragover','dragleave','drop'])document.addEventListener(name,e=>{e.preventDefault();if(name==='dragover')e.dataTransfer.dropEffect='copy';parent.postMessage('frame:'+name,'*');},true);</script>Author scene"></iframe>
                """);
            await loaded.Task.WaitAsync(TimeSpan.FromSeconds(10));
            await core.ExecuteScriptAsync(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "native-host.js")));
            using var setup = JsonDocument.Parse(await core.ExecuteScriptAsync("""
                (()=>{
                  window.nativeBridge=DextNativeHost.createNativeHost({transport:chrome.webview,
                    initialIdentity:{runtimeGeneration:1,sessionId:'iframe-drop-probe',revision:1}});
                  document.addEventListener('drop',e=>{
                    e.preventDefault();e.dataTransfer.dropEffect='none';
                    nativeBridge.dropFiles({desktopContextId:'probe',deskId:'home',x:.2,y:.2,modifiers:1,allowedEffects:e.dataTransfer.effectAllowed},Array.from(e.dataTransfer.files)).catch(()=>{});
                  });
                  return typeof nativeBridge.dropFiles==='function';
                })()
                """));
            if (!setup.RootElement.GetBoolean()) throw new Exception("Production native bridge not initialized");
            foreach (var phase in new[] { "dragEnter", "dragOver", "drop" })
                await core.CallDevToolsProtocolMethodAsync("Input.dispatchDragEvent", JsonSerializer.Serialize(new
                { type = phase, x = 100, y = 100, data = new { items = Array.Empty<object>(), files = new[] { file }, dragOperationsMask = 1 } }));
            var paths = await received.Task.WaitAsync(TimeSpan.FromSeconds(5));
            if (paths.Length != 1 || !string.Equals(paths[0], file, StringComparison.OrdinalIgnoreCase))
                throw new Exception("Iframe drop source identity mismatch");
            Console.WriteLine("PASS iframe hit -> top drop -> production native-host -> AdditionalObjects -> production Player reader preserves disk identity");
            await core.ExecuteScriptAsync("nativeBridge.dispose()");
            await Task.Delay(150);
            Console.WriteLine("IFRAME ROUTING " + await core.ExecuteScriptAsync("JSON.stringify(window.events)"));
            if (File.ReadAllText(file) != "isolated iframe drop fixture") throw new Exception("Source changed");
            Console.WriteLine("PASS iframe route observation finished; CDP is not OS OLE completion evidence");
        }
        finally
        {
            core.NavigationCompleted -= handler;
            core.WebMessageReceived -= message;
            File.Delete(file); Directory.Delete(root, false);
        }
    }
}