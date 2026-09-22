# Native desktop input regression

Windows / .NET 9, run from the worktree root:

```powershell
dotnet run --project tests/Dext.Input.Tests
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build.ps1
dotnet run --project tests/Dext.Input.Tests -- lively-core-separation/src/Lively/Lively.Player.WebView2/bin/Release/Lively.Player.WebView2.exe
```

The first command sends the production helper's messages to a hidden Win32 receiver. It checks
button state, signed coordinates, duplicate release and original-recipient routing.

The optional executable argument launches an isolated production Release WebView2 Player with
the local `probe.html` fixture. Its stdout is consumed only by this test (no Core or Room writes).
It reproduces the legacy `WM_MOUSEMOVE wParam=0x20 → PointerEvent.buttons=8` error, resets the
fixture, then verifies ten sequences with capture acquired, left-button moves, one release and
no premature cancellation. The test window is shown without activation because the standalone
Player initially minimizes itself. It closes at test completion; the real desktop stays running.

This covers the actual Player/WebView2 and Win32 message boundary, but not physical mouse RawInput
or WorkerW focus/Explorer routing. Those still require the real desktop acceptance card.
