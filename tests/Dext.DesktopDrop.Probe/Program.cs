using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;
using System.Text;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

// Registration-only spike. Hidden windows, no DoDragDrop, cursor movement,
// file transfers, Explorer modification, or Dext runtime replacement.
internal static class Program
{
    [STAThread]
    private static int Main()
    {
        var code = 1;
        var profile = Path.Combine(Path.GetTempPath(), "Dext-drop-registration-" + Guid.NewGuid().ToString("N"));
        Application.SetHighDpiMode(HighDpiMode.PerMonitorV2);
        Application.EnableVisualStyles();
        using var form = new Form { ShowInTaskbar = false, StartPosition = FormStartPosition.Manual,
            Location = new(-32000, -32000), Size = new(640, 480) };
        using var view = new WebView2 { Dock = DockStyle.Fill };
        form.Controls.Add(view);
        _ = form.Handle; _ = view.Handle;
        using var context = new ApplicationContext();
        EventHandler? begin = null;
        begin = async (_, _) =>
        {
            Application.Idle -= begin;
            var ole = OleInitialize(IntPtr.Zero);
            try
            {
                Marshal.ThrowExceptionForHR(ole);
                var environment = await CoreWebView2Environment.CreateAsync(null, profile);
                await view.EnsureCoreWebView2Async(environment).WaitAsync(TimeSpan.FromSeconds(20));
                Console.WriteLine("WebView SDK=1.0.3595.46 runtime=" + environment.BrowserVersionString);
                var loaded = new TaskCompletionSource();
                view.NavigationCompleted += (_, args) => { if (args.IsSuccess) loaded.TrySetResult(); else loaded.TrySetException(new Exception(args.WebErrorStatus.ToString())); };
                view.NavigateToString("<!doctype html><html><body>Registration-only probe</body></html>");
                await loaded.Task.WaitAsync(TimeSpan.FromSeconds(10));
                Inspect(form, view, "default");
                view.AllowExternalDrop = false;
                await Task.Delay(200);
                Inspect(form, view, "external-disabled");
                view.AllowExternalDrop = true;
                await Task.Delay(200);
                Inspect(form, view, "external-restored");
                Console.WriteLine("PASS registration inspection completed; actual OLE routing and WorkerW remain unverified");
                code = 0;
            }
            catch (Exception error) { Console.Error.WriteLine(error); }
            finally
            {
                view.Dispose(); form.Dispose();
                if (ole >= 0) OleUninitialize();
                // Browser profile is left at this unique temporary path until browser
                // shutdown completes; never recursively delete a live browser profile.
                Console.WriteLine("Temporary probe profile: " + profile);
                context.ExitThread();
            }
        };
        Application.Idle += begin;
        Application.Run(context);
        return code;
    }
    private static void Inspect(Form form, WebView2 view, string phase)
    {
        var windows = new List<nint> { form.Handle };
        EnumChildWindows(form.Handle, (window, _) => { windows.Add(window); return true; }, IntPtr.Zero);
        Console.WriteLine($"PHASE {phase} allowExternalDrop={view.AllowExternalDrop} windows={windows.Count}");
        foreach (var window in windows)
        {
            GetWindowThreadProcessId(window, out var pid);
            var name = new StringBuilder(256); GetClassName(window, name, name.Capacity);
            // Never register/revoke a browser process or a foreign app's window.
            if (pid != Environment.ProcessId) { Console.WriteLine($"FOREIGN class={name} pid={pid}"); continue; }
            var target = new RejectingTarget();
            var result = RegisterDragDrop(window, target);
            Console.WriteLine($"OWN class={name} form={window == form.Handle} control={window == view.Handle} registration=0x{result:X8}");
            if (result == 0) Marshal.ThrowExceptionForHR(RevokeDragDrop(window));
            else if (result != unchecked((int)0x80040101)) Marshal.ThrowExceptionForHR(result);
            GC.KeepAlive(target);
        }
    }
    private delegate bool WindowCallback(nint window, nint data);
    [DllImport("ole32.dll")] private static extern int OleInitialize(nint reserved);
    [DllImport("ole32.dll")] private static extern void OleUninitialize();
    [DllImport("ole32.dll")] private static extern int RegisterDragDrop(nint window, [MarshalAs(UnmanagedType.Interface)] IProbeDropTarget target);
    [DllImport("ole32.dll")] private static extern int RevokeDragDrop(nint window);
    [DllImport("user32.dll")] private static extern bool EnumChildWindows(nint parent, WindowCallback callback, nint data);
    [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(nint window, out int processId);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetClassName(nint window, StringBuilder name, int count);
}
[StructLayout(LayoutKind.Sequential)] public struct ProbePoint { public int X, Y; }
[ComVisible(true), Guid("00000122-0000-0000-C000-000000000046"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IProbeDropTarget
{
    [PreserveSig] int DragEnter([MarshalAs(UnmanagedType.Interface)] System.Runtime.InteropServices.ComTypes.IDataObject data, uint keys, ProbePoint point, ref uint effect);
    [PreserveSig] int DragOver(uint keys, ProbePoint point, ref uint effect);
    [PreserveSig] int DragLeave();
    [PreserveSig] int Drop([MarshalAs(UnmanagedType.Interface)] System.Runtime.InteropServices.ComTypes.IDataObject data, uint keys, ProbePoint point, ref uint effect);
}
[ComVisible(true), ClassInterface(ClassInterfaceType.None)]
public sealed class RejectingTarget : IProbeDropTarget
{
    public int DragEnter(System.Runtime.InteropServices.ComTypes.IDataObject data, uint keys, ProbePoint point, ref uint effect) { effect = 0; return 0; }
    public int DragOver(uint keys, ProbePoint point, ref uint effect) { effect = 0; return 0; }
    public int DragLeave() => 0;
    public int Drop(System.Runtime.InteropServices.ComTypes.IDataObject data, uint keys, ProbePoint point, ref uint effect) { effect = 0; return 0; }
}