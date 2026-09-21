# DESK-ICON-001 桌面图标反馈与命中区优化验收

- 状态：待验收（阶段 B；本 worktree 真实桌面已启动）
- 分支：`feat/DESK-ICON-001-icon-feedback`
- 基线：DESK-MOTION-001 `5d91bb2`
- 设计：`docs/superpowers/specs/2026-09-20-desktop-icon-feedback-design.md`
- 计划：`docs/superpowers/plans/2026-09-20-desktop-icon-feedback.md`
- 目标：在浏览器实验通过的共享视觉层基础上，让真实桌面支持三种图标反馈、统一 footprint/命中、独立视觉大小与间距、名称规则和全局偏好实时投递。
- 范围外：不修改 Room Schema、Widget 契约、Dock 管理入口或应用启动协议；不先于 DESK-MOTION-001 合入 master。

## 阶段 A 自动检查

- [x] Node：图标偏好 3/3；连同既有 layout/motion/controller/bridge 共 25/25。
- [x] Playwright：图标实验台 12/12；连同真实桌面与 motion 实验台共 51/51。
- [x] Vitest 50/50、前端 build、语法、Room Schema 与 diff check。
- [x] 独立代码审查无 Critical；两项 Important 已修复并由先失败后转绿的回归覆盖。

## 阶段 A 浏览器人工验收

1. [x] 运行 `cd tauri-ui && npm run dev:icons`，打开图标实验台。
2. [x] 在明亮、深色和复杂背景上切换“图标光晕 / 紧凑内容框 / 纯净无边框”，确认反馈克制且不再像整格 Android 卡片。
3. [x] 打开“显示实际命中区”，确认橙色布局格与绿色实际命中框四边完全重合；四个 footprint 尺寸一致，框间 gap 不响应。
4. [x] 检查 PNG/Glyph、短名称和长名称；长名称单行省略。关闭名称后，小/标准/大 footprint 分别收紧为 64×64 / 72×72 / 80×80，并在稳定悬停约 500ms 后显示浮层。
5. [x] 保持默认“交互”，真实悬停图标出现反馈、按下缩放、短按另一图标后页脚 TARGET 随之更新；点透明网格边缘不选择。
6. [x] 长按图标约 300ms 进入苹果式抖动，确认只有 56px 图标图形以 ±3° / 150ms 旋转，下面的名称和 footprint/命中边框完全静止；编辑中拖起图标并移动，确认跟手托起，松手回到原网格且不排序；双击真正画布空白退出。
7. [x] 使用固定状态按钮依次查看正常、悬停、按下、编辑和拖动；确认抖动、托起与三种反馈互不覆盖，拖动/按下期间不出现名称浮层。
8. [x] 开启 reduced-motion，确认缩放、过渡和抖动关闭，但 hover、命中区和名称规则仍有效。
9. [x] 切换紧凑、标准、宽松三档间距；确认只改变 footprint 之间的 4×12 / 20×28 / 40×40 gap，图标框自身尺寸不变。
10. [x] 显示名称时独立切换小 72×80、标准 80×84、大 84×88 三档；隐藏名称时确认对应收为 64×64、72×72、80×80。两种模式下布局格与命中区始终重合、图标保持居中，名称长度不改变同一模式的框体。
11. [x] 独立切换小 48px、标准 56px、大 64px 图标视觉大小；确认只改变图标图形与光晕，不改变当前 footprint 或 gap，不替换图标节点，名称保持静止且图标始终居中。

> 硬门槛：用户明确回复阶段 A 通过前，不开始真实桌面、设置页或 Core 集成。

## 阶段 B 自动检查

- [x] 真实桌面 Playwright：节点/iframe 复用、命中几何、五项偏好、编辑/拖动/热更新、tooltip 与 reduced-motion（15/15）。
- [x] Rust：旧设置默认、patch 未修改字段保留、applied/deferred 投递状态。
- [x] C# / proto：设置往返与官方宿主 loaded 后启动快照；Release 构建通过。
- [x] Vitest 52/52、Rust 40/40（3 ignored）、Node 20/20、renderer Playwright 52/52、前端 build、C# Release、Room Schema、proto 文本一致与 diff check。

## 阶段 B 真实桌面人工验收

本轮重点复验：连续拖放图标 12 次；鼠标在候选位置停住时图标不得跳动；桌面四周和图标间空隙双击退出，双击图标/Widget/Dock 不退出。

1. [ ] 设置页切换光晕/紧凑/无边框，当前真实桌面立即生效；重启后保持。
2. [ ] 开关名称；隐藏时悬停约 500ms 出现名称浮层，编辑/按下/拖动时不出现。
3. [ ] 独立切换图标视觉 48/56/64px、footprint 三档和 gap 三档，确认节点不闪烁、图标居中且命中区与布局格一致。
4. [ ] 网格 gap 不启动应用、不开始拖动；图标与可见名称区域正常点击、启动和长按。
5. [ ] 长按 300ms 后仅图形 ±3° / 150ms 抖动，名称与 footprint 静止；拖动托起、路径让位和取消不回归。
6. [ ] Widget 拖动/缩放、Dock 禁区、双击空白退出、实时新增/移除应用均不回归。
7. [ ] 切 Desk、缩放窗口、重铺壁纸和重启后偏好一致；Widget iframe 与 Scene 不重载。
8. [ ] Windows reduced-motion 下缩放、过渡和抖动关闭，命中、占位和最终布局仍正确。

## 验收记录

- 2026-09-20：用户批准 DESK-ICON-001 计划并要求先做浏览器实验；独立 worktree 从 DESK-MOTION-001 `5d91bb2` 建立。
- 2026-09-20：阶段 A 共享模块与实验台实现完成；真实浏览器截图发现并通过先失败的 Playwright 回归移除 button 默认 2px 白边框。生产 `wallpapers/dext-room`、设置页和 Core 保持零差异。
- 2026-09-20：独立审查指出 reduced-motion 仍保留缩放、页面外松手会残留 pressed；两项均以 Playwright 红测复现并修复，图标实验台更新为 6/6。
- 2026-09-20：最终自动检查为 Node 18/18、Vitest 50/50、renderer Playwright 45/45、前端 build、语法、Room Schema 与 diff check 全绿；`codegraph sync` 按规范尝试，但本 worktree 索引为 Not initialized，未擅自初始化。
- 2026-09-20：阶段 A 人工验收反馈指出隐式 hover、紧凑 padding 和拖动 transform 混在同一画布，图标看起来乱跳且状态不可固定；决定改为显式状态预览，并增加 88/100/120px 三档水平密度。真实用户设置是否加入阶段 B，待本轮浏览器密度验收后决定。
- 2026-09-20：固定状态与三档密度完成；hover 不再位移，紧凑框不再用 padding 推动内容，按下缩放原点固定为几何中心。图标实验台 8/8、renderer 全量 47/47。
- 2026-09-20：最终复验为 Vitest 50/50、Node 25/25、renderer Playwright 47/47，前端 build、语法、Room Schema、生产边界与 diff check 通过。
- 2026-09-20：用户反馈内容自适应命中框偏移并批准独立命中框档位；共享偏好增加 `hitTargetSize`，三档固定几何与中心对齐回归先失败后转绿。最终复验为 Vitest 50/50、Node 25/25、图标实验台 9/9、renderer 全量 48/48，build、语法、Schema、生产边界与 diff check 通过。
- 2026-09-20：用户要求实验台像既有 Widget 实验台一样可直接操作；新增默认交互模式、真实 hover/press/短按选择、500ms 长按编辑、编辑中跟手托起/回位和双击空白退出。固定五状态继续保留为诊断工具，不做排序或持久化。
- 2026-09-20：直接交互补充完成最终复验：Vitest 50/50、Node 25/25、图标实验台 11/11、renderer Playwright 50/50、build、语法、Room Schema、生产边界与 diff check 全绿；`codegraph sync` 因独立 worktree 未初始化而按既定边界跳过建索引。继续停在阶段 A 浏览器人工验收。
- 2026-09-20：用户指出橙色布局格与绿色命中框仍不重合；验收模型改为单一 unified footprint，布局、点击和拖动共享同一矩形，间距仅由独立 gap 表达。真实 bounding box 重合与 gap 点击回归先失败后转绿。
- 2026-09-20：统一 footprint 修正完成最终复验：Vitest 50/50、Node 25/25、图标实验台 11/11、renderer Playwright 50/50、build、语法、Room Schema、生产边界与 diff check 全绿；真实桌面、设置页和 Core 仍未接入。
- 2026-09-20：用户批准隐藏名称时将三档 footprint 收紧为 64×64 / 72×72 / 80×80，并把图标编辑抖动调整为 ±1.5° / 280ms；500ms 长按、Widget 抖动、gap 与 reduced-motion 规则不变。两条目标 Playwright 场景先 RED 后 GREEN，浏览器目视确认标准档为 72×72 且布局/命中边界重合。
- 2026-09-20：本轮最终复验为 Vitest 50/50、Node 25/25、图标实验台 11/11、renderer Playwright 50/50、build、语法、Room Schema、生产边界与 diff check 全绿；`codegraph sync` 因独立 worktree 未初始化而记录后跳过。继续停在阶段 A 浏览器人工验收，未接入真实桌面、设置页或 Core。
- 2026-09-20：用户反馈抖动仍慢，明确把实验台长按改为 300ms、图标 jiggle 改为 ±5° / 150ms。名称浮层仍为 500ms，Widget、拖动、reduced-motion 和真实桌面保持不变；Playwright 以受控页面时钟锁定 299ms/300ms 边界，并读取真实 CSSAnimation 时长与关键帧。
- 2026-09-20：快速抖动修正最终复验为 Vitest 50/50、Node 25/25、图标实验台 11/11、renderer Playwright 50/50、build、语法、Room Schema、生产边界与 diff check 全绿；`codegraph sync` 因独立 worktree 未初始化而记录后跳过。继续停在阶段 A 浏览器人工验收。
- 2026-09-20：用户将图标抖动幅度从 ±5° 收敛为 ±3°；300ms 长按、150ms 周期及其他行为不变。真实 CSSAnimation 关键帧回归先读取到旧 ±5° 并失败，修改后转绿。
- 2026-09-20：±3° 幅度修正最终复验为 Vitest 50/50、Node 25/25、图标实验台 11/11、renderer Playwright 50/50、build、语法、Room Schema、生产边界与 diff check 全绿；`codegraph sync` 因独立 worktree 未初始化而记录后跳过。继续停在阶段 A 浏览器人工验收。
- 2026-09-20：用户反馈文字视觉上没有跟随抖动。浏览器双时点采样确认文字虽随父 face 移动，但纯旋转关键帧的平移分量为 0，基线位移不明显；同一 face 增加 ±1.5px 水平位移，让图形、文字和命中边框保持刚性整体。真实 CSSAnimation 矩阵回归先 RED 后 GREEN。
- 2026-09-20：整体抖动修正最终复验为 Vitest 50/50、Node 25/25、图标实验台 11/11、renderer Playwright 50/50、build、语法、Room Schema、生产边界与 diff check 全绿；`codegraph sync` 因独立 worktree 未初始化而记录后跳过。继续停在阶段 A 浏览器人工验收。
- 2026-09-20：用户澄清“图标文字不抖”是要求文字保持静止，不是反馈文字没有跟随。撤销基于误解加入的整体平移，把 jiggle 从 `.icon-face` 移到 `.icon-visual`；最终仅 56px 图形执行 ±3° / 150ms，名称和 footprint 静止。目标 Playwright 先在旧 face 动画上 RED 后 GREEN。
- 2026-09-20：仅图形抖动修正最终复验为 Vitest 50/50、Node 25/25、图标实验台 11/11、renderer Playwright 50/50、build、语法、Room Schema、生产边界与 diff check 全绿；`codegraph sync` 因独立 worktree 未初始化而记录后跳过。继续停在阶段 A 浏览器人工验收，未接入真实桌面、设置页或 Core。
- 2026-09-20：用户确认现有三档只是 footprint，并批准增加独立图标视觉大小。共享偏好与实验台增加 small 48px / standard 56px / large 64px，默认标准；切换不改变 footprint、gap 或节点身份，最小 footprint + 大图标仍完整容纳名称。Node 与 Playwright 均先在缺失字段/控件上 RED 后 GREEN。
- 2026-09-20：独立图标视觉大小最终复验为 Vitest 50/50、Node 25/25、图标实验台 12/12、renderer Playwright 51/51、build、语法、Room Schema、生产边界与 diff check 全绿；`codegraph sync` 因独立 worktree 未初始化而记录后跳过。继续停在阶段 A 浏览器人工验收，未接入真实桌面、设置页或 Core。
- 2026-09-21：用户回复“感觉差不多了，可以尝试合并进去了”，确认阶段 A 浏览器方向可进入阶段 B。当前分支已叠加 DESK-MOTION-001，允许继续实现但不改变最终合并顺序：Motion 真实桌面验收并合入 master 后，Icon 才能最终合入。
- 2026-09-21：阶段 B 真实 renderer 分层与偏好消息完成。共享 Node 19/19、真实 Room Playwright 15/15、图标实验台 12/12；真实图标和 Widget iframe 原地复用，长按 300ms，仅 `.icon-visual` 以 ±3° / 150ms 抖动。
- 2026-09-21：全局偏好链路完成：Settings proto 使用向后兼容零值与 optional 名称开关，Rust patch 返回实时投递状态，设置页提供反馈/名称/命中框/视觉大小/间距五项控制，可信 WebView2 宿主 loaded 后收到完整快照。Vitest 52/52、Rust 40/40（3 ignored）、前端 build 与 C# Release 通过。
- 2026-09-21：全分支审查发现并修复两项真实环境问题：Glyph 未写共享 `--icon-color` 导致渐变颜色丢失，以及 reduced-motion 把拖动位移一并清除。两项均先新增失败回归再修复；完整 renderer Playwright 52/52、相关 Node 20/20。
- 2026-09-21：阶段 B 最终自动验证全绿：Vitest 52/52、Rust 40/40（3 个活体测试 ignored）、Node 20/20、renderer Playwright 52/52、前端生产 build、C# Release、Room Schema、proto 文本一致与 diff check。`scripts/start.ps1` 正确拒绝复用/停止主 worktree PID 29524 的 Core；需先由用户关闭当前 Dext，再启动本 worktree 做真实桌面人工验收。
- 2026-09-21：用户关闭旧 Dext 后，本 worktree Core PID 65292、Watchdog、Player 与配置器均成功启动；强制重铺活体测试 1/1 通过，Player 当前壁纸路径已核对为 `DEXT_Core-desk-icon-001/wallpapers/dext-room/index.html`，运行态阻塞解除。
- 2026-09-21：首次真实桌面验收发现全黑。根因是 Vite 可跨目录加载 `../dext-icon-feedback`，正式 WebView2 虚拟主机却只映射 `dext-room`；共享模块缺失使主脚本在渲染前中止。新增“仅暴露生产映射目录”Playwright 回归并先 RED，再把唯一共享 JS/CSS 收进 `dext-room`、让实验台反向引用。最终 Vitest 52/52、Node 20/20、renderer Playwright 53/53、前端 build、Schema 与 diff check 全绿；真实桌面已重铺。
- 2026-09-21：真实桌面验收发现长按托起后继续移动无效、松手回原位。根因是计时到点先清空 pressing，仍按住的 pointer 未交接给拖动。Node 与真实 Room 新增连续 pointerdown→dwell→move→up 回归并先 RED；修复后同一 pointer 直接进入 draggingIcon，跨格预览和单次保存均转绿。最终 Vitest 52/52、Node 20/20、renderer Playwright 54/54、前端 build、Schema 与 diff check 全绿；真实桌面已重铺。
