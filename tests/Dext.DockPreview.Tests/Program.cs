using System;
using Lively.Services.ApplicationDock;
if (args.Length == 2 && args[0] == "--interactive-preview") { InteractivePreviewProbe.Run(int.Parse(args[1])); return; }
void Check(bool pass, string label) { if (!pass) throw new Exception(label); Console.WriteLine("PASS " + label); }
var wide = DockPreviewGeometry.Fit(1920,1080,200,120);
Check(wide.Width == 200 && wide.Height == 112 && wide.Top == 4, "landscape preview fits without cropping");
var tall = DockPreviewGeometry.Fit(600,1200,200,120);
Check(tall.Width == 60 && tall.Left == 70 && tall.Height == 120, "portrait preview is centered");
Check(DockPreviewGeometry.Fit(0,1080,200,120).Width == 0, "invalid source has no preview");
Check(DockPreviewGeometry.Fit(100,100,0,120).Width == 0, "unmeasured destination has no preview");
Check(DockPreviewGeometry.PageSize(1920) == 6, "wide desktop bounds preview page size");
Check(DockPreviewGeometry.PageSize(320) == 1, "small desktop still has a reachable card");
Check(DockPreviewGeometry.ClampPage(2,2,6) == 0, "window closure clamps stale page");
Check(DockPreviewGeometry.ClampPage(9,14,6) == 2, "last page remains reachable");
DockButtonSnapshotTests.Run();
DockNavigationTests.Run();
