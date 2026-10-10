using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using System.Text.Json;

internal static class AdditionalFileProbe
{
    internal static async Task Run(WebView2 view)
    {
        var root = Directory.CreateTempSubdirectory("Dext-drop-file-object-").FullName;
        var path = Path.Combine(root, "fixture.txt");
        var folder = Directory.CreateDirectory(Path.Combine(root, "Folder")).FullName;
        File.WriteAllText(path, "Dext isolated file object fixture");
        var core = view.CoreWebView2;
        var received = new TaskCompletionSource<string[]>();
        EventHandler<CoreWebView2WebMessageReceivedEventArgs> handler = (_, args) =>
        {
            try
            {
                if (args.TryGetWebMessageAsString() != "file-object-probe") return;
                received.TrySetResult(args.AdditionalObjects.Select(item => item is CoreWebView2File file ? file.Path : "unsupported").ToArray());
            }
            catch (Exception error) { received.TrySetException(error); }
        };
        core.WebMessageReceived += handler;
        try
        {
            await core.ExecuteScriptAsync("document.body.innerHTML='<input id=fixture type=file>'; ");
            using var document = JsonDocument.Parse(await core.CallDevToolsProtocolMethodAsync("DOM.getDocument", "{}"));
            var rootId = document.RootElement.GetProperty("root").GetProperty("nodeId").GetInt32();
            using var node = JsonDocument.Parse(await core.CallDevToolsProtocolMethodAsync("DOM.querySelector", JsonSerializer.Serialize(new { nodeId = rootId, selector = "#fixture" })));
            var nodeId = node.RootElement.GetProperty("nodeId").GetInt32();
            await core.CallDevToolsProtocolMethodAsync("DOM.setFileInputFiles", JsonSerializer.Serialize(new { nodeId, files = new[] { path } }));
            await core.ExecuteScriptAsync("chrome.webview.postMessageWithAdditionalObjects('file-object-probe',document.querySelector('#fixture').files)");
            var files = await received.Task.WaitAsync(TimeSpan.FromSeconds(5));
            if (files.Length != 1 || !string.Equals(files[0], path, StringComparison.OrdinalIgnoreCase)) throw new Exception("Native file object did not preserve fixture identity");
            Console.WriteLine("PASS genuine disk File object reaches native host with exact path (CDP file-input fixture, not Explorer drag)");
            received = new();
            await core.ExecuteScriptAsync("document.body.innerHTML='Drop probe'; document.addEventListener('dragover', e=>{e.preventDefault();e.dataTransfer.dropEffect='copy';}); document.addEventListener('drop', e=>{e.preventDefault();chrome.webview.postMessageWithAdditionalObjects('file-object-probe',e.dataTransfer.files);});");
            foreach (var phase in new[]{"dragEnter","dragOver","drop"})
                await core.CallDevToolsProtocolMethodAsync("Input.dispatchDragEvent", JsonSerializer.Serialize(new { type=phase, x=20, y=20, data=new { items=Array.Empty<object>(), files=new[]{path,folder}, dragOperationsMask=1 } }));
            files = await received.Task.WaitAsync(TimeSpan.FromSeconds(5));
            if (files.Length != 2 || !files.Contains(path, StringComparer.OrdinalIgnoreCase) || !files.Contains(folder, StringComparer.OrdinalIgnoreCase))
                throw new Exception("Browser drop did not preserve file and directory identities");
            Console.WriteLine("PASS browser-dispatched drop forwards both disk file and folder paths; no OS cursor or Explorer drag used");
            received = new();
            using var scripted = JsonDocument.Parse(await core.ExecuteScriptAsync("(()=>{try{chrome.webview.postMessageWithAdditionalObjects('file-object-probe',[new File(['fixture'],'invented.txt')]);return {posted:true};}catch(error){return {posted:false,error:String(error)};}})()"));
            if (scripted.RootElement.GetProperty("posted").GetBoolean())
            {
                files = await received.Task.WaitAsync(TimeSpan.FromSeconds(5));
                if (files.Length != 1 || files[0] != "") throw new Exception("Script-created File unexpectedly has a native source path");
                Console.WriteLine("PASS script-created File has no source path");
            }
            else Console.WriteLine("PASS runtime rejects script-created File: " + scripted.RootElement.GetProperty("error").GetString());
            if (File.ReadAllText(path) != "Dext isolated file object fixture") throw new Exception("Source fixture changed");
        }
        finally
        {
            core.WebMessageReceived -= handler;
            File.Delete(path);
            Directory.Delete(folder, false);
            Directory.Delete(root, false);
        }
    }
}