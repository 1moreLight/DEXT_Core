# DOCK-CUT-001 裁掉 Dock 产品面

状态：待验收
分支：`cursor/cut-dock-product-c11e`
基线：`master`（不依赖 PR #2 / `cursor/room-desk-ia-36db`）
自动检查：Vitest 83/83；v3 host + desk-switch Node 测试通过；v2 `main.js` 语法通过。Linux 上未跑 Windows Core/Player/Release。

## 一句话目标

运行中的 Room 不再出现原生 Application Dock、主题系统 Dock 或配置器里的 Dock 设置；Desk 切换改走桌面图标/按钮。

## 范围外

- 不合并、不改 PR #2
- 不把自绘图标迁到 Explorer-only
- 不重做 Wallpaper / Widget / Desk 同步
- 不删除全部历史 Dock 源码与孤立单元测试；只关掉产品入口和运行宿主
- 不恢复系统 Dock 来补导航

## 自动检查

- `cd tauri-ui && npm test`（配置器 Vitest）
- `node --test wallpapers/dext-room-v3/*.test.js`
- `node --test tests/room-desk-switch-path.test.cjs`
- Linux 上不跑 Windows-only Core/Player/Release 启动

## 人工验收

1. 打开配置器设置页：没有「应用 Dock / 原生 Dock / 主题呈现」产品入口。
2. 打开 Room 编辑：没有 Dock 模板库、Dock 编辑页、共享 Dock 选择。
3. 应用一个带多个 Desk 的样包（融合实验室或新建 Room）：桌面上看不到系统黑条 Dock，也看不到主题系统 Dock 窗口。
4. 用桌面上的「上一页 / 下一页」图标（或样包里已有的切页按钮）切换 Desk；壁纸、Widget、自绘图标仍在。

## 通过标准

- Dock 产品面从运行时和配置器消失
- Desk / 壁纸 / Widget / 自绘图标仍可构建和接线
- 切 Dock 后仍有可用切 Desk 入口，且没有再引入系统 Dock
