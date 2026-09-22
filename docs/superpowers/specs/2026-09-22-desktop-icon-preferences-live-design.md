# DESK-PREFS-001：五项桌面图标偏好真实生效设计

日期：2026-09-22。状态：书面规格待用户确认；本文件不是已实现声明。

## 目标与基线

让设置页已有的五项偏好——反馈风格、显示名称、命中框档位、图形大小档位、间距档位——在真正的 Dext Room 中实时生效，重启、切 Desk 和重铺后保持一致。独立分支 `feat/DESK-PREFS-001-icon-settings-live` 从最后已验证可以直接拖动图标的 `6eca2db` 建立；不在有用户改动的主 worktree 开发。代码自测和真实桌面人工验收通过前不合并 master。现有 DESK-MOTION-001 / DESK-ICON-001 / DESK-REORDER-001 的待验收或失败实现不得被当作已合并依赖。

范围外：重做图标拖动、Sortable 路径重排、`DextDesktopLayoutController`、Widget/Dock 管理、修改 `room.json` Schema、新的运动偏好和另外的 Core 常规设置。实验台仍是视觉调试工具，不是生产 DOM 或真实 WebView2 手势的验收替代品。

## 已有链路和断点

设置页已经显示并 patch 五项；Rust 通过 Core Settings RPC 保存，向当前壁纸发 `CMD_DESKTOP_ICON_PREFERENCES`；Core 在可信 Wallpaper loaded 后发送完整快照，Player 转换为 `dext:desktop-preferences`。目前生产 `dext-room/index.html` 没加载共享图标模块/CSS，`main.js` 也不处理该消息，所以“保存/送达”不等于“渲染完成”。共享 `icon-feedback.js/.css` 与实验台的几何规则已经存在；配置器的 `desktopIconGrid(desk.iconSize)` 仍使用旧尺寸，新增应用的格坐标可能与启用偏好后的桌面不一致。

## 偏好契约和几何

沿用已经持久化的字段、枚举和消息，不新增 Room 字段。收到缺失/无效值时逐项规范化为 `halo / true / standard / standard / standard`。三个反馈风格是图标光晕、紧凑内容框、纯净无边框；名称单行省略、完整无障碍名称保留。隐藏名称时，仅在悬停稳定 500ms 后显示名称浮层；编辑、按下或拖动时禁止浮层。图形大小为 48/56/64px；命中框显示名称时为 72×80 / 80×84 / 84×88px，隐藏名称时为 64×64 / 72×72 / 80×80px；间距为 4×12 / 20×28 / 40×40px。布局步长等于命中框加间距，三组控制互相独立；不同应用使用同档同中心的统一命中框。

以现有 `icon-feedback.js` 的规范化和 `resolveDesktopIconGeometry()` 为唯一几何参数来源；配置器的 TypeScript 适配必须有同一张参数表及契约对照测试，不维护另一个语义不同的网格。全局 visualSize 决定可见图形大小；只有没有收到有效全局快照时才用旧 `desk.iconSize` 作兼容兜底。Room 图标 `x/y` 是整数列、行编号而不是像素坐标；Widget placement 则使用 1920×1080 逻辑画布坐标。运行时要按图标层实际尺寸投影障碍区，不能把两种单位直接相加或把 CSS 像素写成 Room 坐标。

## 真实 DOM 与手势所有权

保持旧链 `renderIcons() → attachPress(el,index) → startDrag()`，保持 `.icon` 是指针事件与 `setPointerCapture` 的真实目标；再次按下直接拖动的操作方式与直接改 `left/top` 的跟手机制不变。不能引入 `.icon { pointer-events:none }` 或把捕获转交给 `.icon-face`，不能只留下 `attachPress` 函数却删除创建时的绑定。生产 `.icon` 本身收缩到统一 footprint（等于实际命中框），并以图形中心定位于布局格；拖动计算要计入 footprint 与格步长之间的半间距偏移，不能使元素在 pointerdown 时跳位。命中框外网格空白不触发图标点击/拖动。可用内层 `.icon-visual` 承担风格/图形抖动、`.icon-label` 独立保持静止，避免装饰 transform 覆盖旧拖动位移。图标节点的同一身份和 Widget iframe 在偏好切换时不替换；必要的首次 DOM 分层改造不能改变 pointer capture 主体，必须用真实 WebView2 验证。

反馈/图形尺寸变更只改外观和命中，图标数据不落盘；显示名称和命中档位会改变 footprint，间距会改变步长，因此走下述布局检查。切换当前偏好不重载 Scene 或 Widget；编辑态保留旧长按流程。reduced-motion 关掉光晕渐变过渡、缩放及图形 jiggle，但仍显示静态状态反馈，指针位移绝不能被 `transform:none` 抹掉。

## 布局事务与异常

对会改变网格几何的偏好，先用新的 footprint 和步长检查当前 Room 各 Desk 的图标。仍在新网格范围、互不相交且不碰 Widget/Dock 的图标保留原 `x/y` 列行编号；它们的屏幕像素位置会随新步长自然变化，但不能仅因像素位置变化就改写 Room。Widget/Dock 永不被图标推动；越界或冲突图标按稳定的原始顺序搜索离原列行最近的可放置新格，距离相同时按行、列确定性选择。所有 Desk 都有解才一次性提交这次 Room 坐标变更，并沿现有保存链持久化；否则不做部分保存，不覆盖原坐标，当前 Room 保持上一版有效几何，并明确提示空间不足。本轮不做任意全局紧凑整理，也不为缩回间距恢复过去的位置；只有实际 `x/y` 变化才保存。

切换偏好时若图标/Widget 拖动或缩放正在进行，保存设置可立即完成，但几何应用和搬格延迟到本次手势结清；权威热布局、切 Desk 或窗口缩放先终止旧手势提交权，再按最新设置重算。相同完整快照的重复消息必须幂等；对并发加载快照和设置 patch，实施计划需明确可验证的最新值判定/顺序规则，不能让旧 loaded 快照在新 patch 后回写画面。无空间/保存失败只让本 Room 保持先前布局，显示可理解的失败提示；全局偏好仍已保存，后续 Room 可单独尝试。非几何风格选项仍可应用，不因搬格失败一起消失。

配置器新增应用读取当前五项偏好推导同一网格，再调用既有 `findOpenDeskIconCell`；新格依旧避开已有图标、Widget 和 Dock。配置器在打开/重新聚焦或新增应用前获取最新设置，避免持有过期网格；读取失败时使用旧兼容尺寸并显式提示，不能默默声称与当前桌面一致。

## 交付状态语义

Rust 返回的 `not_needed / applied / deferred` 保留兼容，但 `applied` 只表示消息已发给当前 Player，不是渲染器回执。设置页应显示“已保存并发送至当前桌面”，`deferred` 显示“已保存，将在下次桌面加载时生效”。确需声称“当前桌面已更新”时应另加 renderer ACK（本轮不扩展协议）。遇到空间不足、当前 Room 未应用或 Room 保存失败时，桌面侧明确报告，不让“已发送”盖过失败。Core 在 trusted-host loaded 后下发完整偏好快照，运行中的更改实时下发；不信任的内容页面不能借消息越权修改 Room。

## 测试与验收门槛

- Node/TypeScript：五项默认/非法值、映射一致性、三档视觉/命中/间距和隐藏名称几何；合法位置不动、最近可用格、相同距离稳定顺序、Widget/Dock 禁区、多 Desk 任一无解整体不落盘、尺寸缩回不逆迁移、重复消息与旧手势失效。
- 浏览器：三种风格、名称单行和 500ms 浮层、实际命中/空白、视觉与命中尺寸解耦、节点/iframe 复用、reduced-motion；真实 Room 的旧 pointerdown→move（松手前跟手）→up（只保存一次）序列必须通过，不能只测实验台。
- 集成：设置页保存并投递、延迟投递、Player 重新加载快照；配置器新增应用与生产几何相同。执行 `npm test`、`npm run build`、`npm run test:renderer:e2e`、渲染器 Node/`node --check`、Rust 定向测试与 `cargo check`、`scripts/build.ps1`（如触及 C#/.proto）、Room Schema 和 `git diff --check`。真实运行前核验 Core/Player 的 worktree 路径；强制重铺只作为明确的人工活体验收，不在普通测试中误跑。
- 真实桌面由用户执行独立验收卡：五项逐项保存并立即观察、切 Desk/重启、隐藏名称浮层及命中边缘、改间距后新增应用/Widget/Dock、连续至少十次旧式直接拖放、取消/空白退出、reduced-motion。Chromium 全绿不等于 WebView2 可拖；未通过真实手势前不能标“待验收通过”或合并。

完成代码并通过自动检查后只提交此工作分支，按验收卡停在真实桌面待验收。书面规格确认后才写具体实施计划，计划确认后才修改产品代码。
