# V3-P2A-001 连续场景宿主验证

- 状态：自动检查通过，待真实 WorkerW 人工验收
- 分支：`feat/V3-P2A-001-continuous-scene-host`（基于 V3-CORE-004）
- 目标：真实桌面 Player 中，一个持续 HTML 场景跨 Desk 切换保持同一文档与运行状态，官方图标可操作，作者声明占用区和图标/Widget 使用同一坐标系。
- 范围外：P3 正式作品 Schema、开放生产 v3 会话准入、Core/Player 正式传输、原生 Dock/AppBar。

## 人工验收

1. 在此分支根目录运行 `dotnet build tests/Dext.Input.Tests -c Release`，再运行 `.\tests\Dext.Input.Tests\bin\Release\net9.0-windows\Dext.Input.Tests.exe --workerw-p2a`；它会临时把 P2a 样包放到主屏 WorkerW，按 Enter 或 Ctrl+C 恢复先前壁纸。它只接受本分支 Dext Core 且要求原主屏壁纸仍存在。
2. 观察测试场景中的文档 ID 和按钮计数，点击作者按钮并用 Dock 上一页/下一页切换两次；ID 和计数不归零，官方 A/B 图标随 Desk 更换。
3. 双击官方图标并长按进入编辑，将图标向场景矩形内拖动后松开；图标不应落入占用区。Widget 若与场景矩形相撞应回退。改变 Windows 显示缩放后重复，记录视觉与命中偏差。
4. 按 Enter 恢复原壁纸，再运行 `scripts/verify-runtime-identity.ps1`；Core/Player 应仍来自本分支。当前配置器因 Rust 缓存清理而关闭，身份脚本对它会显示 `MISSING`。

## 自动证据

- Playwright P2a 2/2：同一 iframe 文档跨切页，作者按钮和官方图标可点；1280×800 占用区拒绝图标拖入。
- Release WebView2 隔离 Player：同一沙箱文档、两个 Desk 图标、画布比例几何通过；旧 Room 原生拖动 10/10。
- `scripts/build.ps1`、配置器 Vitest 62/62、`npm run build` 通过。本分支 Core/Player 运行身份核对通过；配置器在 C 盘空间不足时重定向 D 盘构建成功，随后按用户要求清理 Rust 编译缓存并关闭。
- WorkerW 临时包验收入口已编译但尚未运行；真实物理鼠标与系统 DPI 结果不能由隔离 Player 代填。

## 通过标准

自动检查和上述实机步骤有可复现证据；本包的验证接口不冒充最终作品协议。
