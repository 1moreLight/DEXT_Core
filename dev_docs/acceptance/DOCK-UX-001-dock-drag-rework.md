# DOCK-UX-001 Dock 双向拖拽重做验收

- 状态：待用户验收
- 分支：`feat/ui-v2-001-configurator-v2`（用户指定沿用 v2 工作线；回滚点 `9ae48d8`）
- 目标：真桌面编辑模式下，双向拖拽稳定可用——桌面图标拖入 Dock 为**移动**语义（从当前 Desk 移除），
  Dock 图标拖回桌面；全部写入当前 Desk 的 dock 覆盖并经 persistRoom 双写持久化。
- 范围外：全局 Dock 编辑（仅配置器 DockEditor）、autoHide、Dock 皮肤（DOCK-SKIN-001 另立）、
  运行态圆点、Player/Core 消息链重构（addDockIcon 链保留但渲染器停用）。

## 交付口径（用户 2026-09-05 拍板）

1. 拖入 Dock = 移动：图标从当前 Desk 消失，出现在 Dock 尾部；非复制。
2. 拖入只写当前 Desk 的 `desks[i].dock.icons`（首次拖入建立桌级覆盖并复制全局列表）；
   全局 Dock 只能在配置器设置。
3. 双向一起重做；仅编辑模式（长按抖动）可拖；autoHide 不动。
4. 当年两类实机问题的修复面：图标层边界裁剪（ghost 化）+ 松手不落入（结束事件统一 + 吸附带）。

## 自动检查

- [ ] `node --check wallpapers/dext-room/main.js`
- [ ] `node --check wallpapers/dext-room/capability-bridge.js`
- [ ] `cd tauri-ui && npm run build`
- [ ] Git 仅暂存本工作包具名文件；提交到当前分支并停在待验收。

## 人工验收（真桌面，重铺壁纸后）

1. [ ] 应用任一有多图标的 Room → 长按桌面图标进编辑模式 → 按住一个图标**从桌面向底部 Dock 拖**：
       图标以幽灵跟随（原图标变暗原位不动），接近 Dock（不必精确压在条带上）Dock 高亮；
       松手后图标**从桌面消失**、Dock 尾部出现该应用真图标，toast「已移入 Dock」。
2. [ ] 从屏幕上方/左侧向 Dock 拖动：中途不会被图标层边界卡住，命中反馈与落点一致。
3. [ ] 从 Dock 正下方（任务栏方向）向上拖入：即使松手瞬间指针被任务栏截走（pointercancel），
       只要最后已知位置在吸附带内仍然落点成功。
4. [ ] 拖入已存在于 Dock 的应用 → toast「已存在」，桌面图标原样保留；拖入无启动目标的图标 → toast 不可用。
5. [ ] 编辑模式按住 Dock 图标拖到桌面空格 → 图标落格、从当前 Desk Dock 移除；拖到已占用格 → toast 拒绝，Dock 不变。
6. [ ] 切到其他 Desk：上一桌拖入的 Dock 图标不影响其他桌（桌级覆盖）；DockEditor 里看到全局列表未被污染。
7. [ ] 持久化：拖拽操作后重启 Dext（或重新应用 Room）→ 移动结果保持；源 Room 的 room.json 中
       desk.icons 少了该项、desks[i].dock.icons 多了该项（无 x/y 残留）。
8. [ ] 回归：桌面图标普通拖拽重排/占用交换、长按进入退出编辑、Dock 双击启动、运行态绿点、删除徽章均不受影响。

## 通过标准

- 验收 1–4 全过（拖入是本包核心）；5–8 无回归。任一失败则在同一分支修复后重验。
