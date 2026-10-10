# 03 定向检查和构建
状态：做完
控制层13/13，TS/Vite、Tauri v3-release和Core/Player/Watchdog完整Release均通过。退出UI线程阻塞问题有先失败后修复的检查。
最终候选：D:\use\Orca\DEXT\DEXT_Core\.build\v3-taskbar-controls-ready-20261010。
已按build.ps1 → start.ps1顺序启动，产品Dext v3 Core/pipe身份核对通过。
最终候选taskbar-exit-probe通过：真实任务栏隐藏、Core正常退出恢复任务栏、真实Core重启保持模式、恢复后保持可见10秒。探针finally恢复原个人模式，未残留测试固定项。
实际按钮点击、切Desk、全屏和原触控待统一验收，不以RPC结果替代。