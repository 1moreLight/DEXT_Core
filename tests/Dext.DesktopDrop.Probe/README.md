# Desktop drop registration probe

Registration-only spike, separate from the shipping Player. Uses the same pinned WebView2 SDK 1.0.3595.46. The .NET 9 WinForms host differs from the .NET Framework production Player, so this is discovery evidence only.

Build: `dotnet build tests/Dext.DesktopDrop.Probe -c Release -p:NuGetAudit=false`.
Run the resulting executable hidden. It creates a hidden, offscreen Form and WebView2, navigates only to inline HTML, inspects owned HWND registration in three AllowExternalDrop states, then disposes the controls. It never starts DoDragDrop, moves the cursor, transfers files, changes Explorer, or modifies the running Dext instance.

Only same-process HWNDs are tested. A successful temporary RegisterDragDrop is immediately paired with RevokeDragDrop; existing registrations and foreign browser windows are never revoked. All callbacks reject the operation. A unique temporary browser profile is retained until browser shutdown; it is not recursively deleted while alive.

2026-10-11 result: runtime 154.0.4258.62; hidden Form, WinForms WebView control and owned Chrome_WidgetWin_0 register successfully in all three states. Chrome_WidgetWin_1 and Intermediate D3D Window belong to browser processes. Log: .build/drop-registration.log, exit 0.

This does not prove OLE routing, Explorer source behavior, WorkerW hit testing, or physical input preservation. Next probe must verify real OLE dispatch across child windows before any file operation is attached. SDK restore emits an unused WPF assembly version conflict warning in this WinForms-only harness; build has zero errors.
File-object probe extension: CDP sets only an isolated temporary file-input fixture, then browser-level Input.dispatchDragEvent supplies a temporary file and directory to the document. Both native AdditionalObjects paths match the originals; all temporary source fixtures are deleted non-recursively afterward. No transfers are performed. Script-created File is rejected by this runtime before WebMessageReceived; ExecuteScriptAsync results explicitly capture that exception to avoid waiting for a message that cannot arrive.

This proves browser-event to native-host file identity transport, including folders. CDP bypasses OS OLE/Explorer and WorkerW hit testing, so those remain unverified. No remote debugging port is opened. The running Dext is unchanged.
