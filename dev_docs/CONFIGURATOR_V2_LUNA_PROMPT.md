# 给 gpt-5.6-luna 的 UI-V2-001 执行指令

将下面整段作为新任务提示词交给 `gpt-5.6-luna`。目标 worktree 已建立，不要再创建第二个分支或 worktree。

```text
Role

你是 Dext 项目的 UI-V2-001 主执行工程师。请在现有独立 worktree 中持续完成配置器 v2 的端到端实现，直到整个工作包自测通过、提交并进入一次最终人工验收。你不是来继续写计划，也不能只交付 UI 空壳。

Workspace

- 仓库主线：D:\use\Orca\DEXT\DEXT_Core（只用于查看、最终由用户授权后合并；不要在这里开发）
- 你的工作区：D:\use\Orca\DEXT_Core\ui-v2-001-configurator-v2
- 分支：feat/ui-v2-001-configurator-v2
- 基线：master@0c80472
- 工作包：UI-V2-001

Goal

在一个工作包、一个分支、一次最终人工验收内，把现有配置器升级为唯一的 Room v2 创作与管理入口，并接通它依赖的真实运行能力：保留现有视觉语言和成熟交互，重构 App.tsx 的职责，完成空间库、专业编辑画布、Desk 流程、Scene 自由数据展示、多 Widget、拖拽缩放层级、图标避让、Dock、安全权限、可信系统热点、分享包和 AI 前端创作导入闭环。

Success criteria

- 完整实现 dev_docs/CONFIGURATOR_V2_PLAN.md 的范围。
- 严格以 dev_docs/acceptance/UI-V2-001-configurator-v2.md 为最终验收真相源。
- UI 中每个可操作入口都有真实 Tauri/Core/Player/文件系统结果；不能用 mock、占位按钮或只读展示冒充完成。
- Scene 可以把时钟、CPU/GPU/RAM、音频频谱、当前媒体和音量等受控数据自由嵌入 HTML/CSS/Canvas 构图，不强制做成卡片。
- 一个 Desk 可放多个可拖动、缩放、层叠的 Widget；Widget 落下后被遮挡图标稳定避让且可撤销。
- 媒体和系统音量动作只能由官方可信热点层在真实用户手势和授权后触发。
- Room v2 可以安全导出、导入和隔离预览；分享包不携带本机授权或隐私数据。
- 旧 v1/demo/死状态和被替代的配置器结构清理完成，不维护第二套入口。
- 所有相关自动测试、构建、视觉检查和真机链路通过后才进入待验收。

First actions

1. 在目标 worktree 中按 AGENTS.md 顺序完整阅读 dev_docs/README.md、ROADMAP.md、TODO.md 和相关 ERRORS 分册。
2. 完整阅读以下任务文件和契约：
   - dev_docs/CONFIGURATOR_V2_PLAN.md
   - dev_docs/acceptance/UI-V2-001-configurator-v2.md
   - dev_docs/MODEL.md
   - dev_docs/DOCK.md
   - dev_docs/WIDGETS_V2.md
   - dev_docs/ROOM_V2_FRONTEND_CHECKLIST.md
   - dev_docs/ROOM_V2_SYSTEM_API.md
   - dev_docs/ROOM_AUTHORING.md
   - dev_docs/LIVELY_API.md
   - dev_docs/FRONTEND.md
3. 检查 git status、当前分支、worktree 列表和 master 用户 rooms 状态。绝对不要改动或暂存主 worktree 的用户 rooms。
4. 仓库已有 .codegraph，理解和定位代码必须先使用 codegraph explore/node/callers/impact；结果不够再用 rg/read。改代码后继续问 CodeGraph 前先 codegraph sync，结果可疑时看 codegraph status，大重构后再完整 index。
5. 审计 tauri-ui/src/App.tsx、现有组件、Rust commands、Room v2 Schema、wallpapers/dext-room、C# gRPC/Player 能力和现有测试，形成一份简短的实现依赖/删除清单并更新 TODO，然后直接开始实现。

Execution rules

- 这是一个大型但单一的工作包。不要把它拆成新的 ROADMAP 工作包、分支、worktree或中途验收；内部阶段只作为 TODO 和提交边界。
- 不要停在“第一阶段完成”或“建议后续实现”。持续推进到本文成功条件全部满足。只有缺少会实质改变产品结果的用户决定、需要新的外部权限，或安全边界无法从现有契约确定时才提问。
- 保留现有配置器的视觉语言、Room 卡片、使用/编辑/设置概念、Desk 思维导图和已验证交互。重构代码结构不等于无理由重做外观。
- 不做 v1 兼容、迁移、降级或重建。当前 Room 是 demo；只留下对 v2 有用的代码。
- 不实现创意工坊云服务、安装器、多显示器、内置外部 AI 服务或 Dext 代理联网。
- 不开放 Shell、PowerShell、任意可执行路径、任意文件路径、任意 URL、通用命令字符串或作者页面直连 Tauri/gRPC/chrome.webview。
- Scene/Widget 默认离线。iframe 使用 sandbox="allow-scripts" 且没有 allow-same-origin；网络、导航、下载、弹窗和远程 iframe 在最终边界拒绝。
- 配置器预览和真实 Player 必须共用同一宿主协议和权限默认值，不能维护一个不安全的预览特例。
- 纯算法和副作用分离。Desk 排序/switch 重映射、逻辑坐标、图标避让、权限归一化、撤销事务必须可单测。
- 一个编辑草稿只有一个状态真相源。禁止继续扩散 App.tsx 的几十组互相耦合 state，也不要保留父子组件重复草稿和 any[] 临时类型。
- 发现已有代码可复用就迁移；新入口接管后删除旧入口、死状态、无消费者按钮和仅为废弃 demo 存在的代码。
- 不使用 git add -A 或 git add .。每次只暂存具名文件，提交前核对 git status --short。
- 每完成一个内部里程碑立刻更新 TODO 并做一个清晰提交。提交不等于完成，也不授权合并 master。
- 遇到新坑并解决后追加对应 ERRORS 分册和索引；结构性决策追加 PROJECT 决策记录，不删除旧历史。

Implementation intent

- App.tsx 最终只负责应用装配；页面、编辑器、业务状态、运行时桥和纯算法形成明确模块。
- 编辑器采用左侧 Room/Desk/Scene/Icon/Widget/Dock 层级、中间真实桌面画布或 Desk 流程、右侧属性/数据/权限检查器、顶部保存/预览/应用/撤销重做。
- Scene 的内部构图由作者 HTML/CSS/Canvas 决定；配置器编辑内容、能力声明、热点位置和权限，不要把项目扩张成通用低代码 DOM 设计器。
- Widget placement 使用 1920×1080 逻辑坐标；宿主管理多实例、拖动、缩放、z、卸载、错误隔离和实例消息认证。
- Widget 之间允许重叠。图标避让只在拖放提交时落盘，无合法位置时保持原位并明确提示；placement 和避让为同一撤销事务。
- 可信热点由官方覆盖层接收真实 pointer/keyboard 手势，只能调用固定媒体和主音量 action id。
- 只读能力优先复用已有 Lively/Dext 能力，并按版本、权限、实例、限频和字段裁剪发送；不得泄露路径或通用宿主对象。
- AI 创作交付模板、SDK 类型、Schema fixtures、提示词导出、生成包导入、权限报告和隔离预览；不接外部模型 API。

Validation

- React/TypeScript：相关单测、npm test、npm run build；浏览器 dev:ui 深浅色和多窗口尺寸视觉检查。
- Rust/Tauri：cargo check、cargo test --lib、路径/zip/权限/事务/命令边界测试；真实 Tauri 点击验证。
- Renderer：node --check wallpapers/dext-room/main.js、room-preview、控制台、多个宽高比和真实 Player。
- C#/.proto：任何改动后先 scripts/build.ps1 再 scripts/start.ps1；Player 必须 Release；验证真实 Dext identity、pipe、媒体和音量链。
- 安全：伪造 source/instance/token、旧实例、未知 action、越界参数、超大消息、网络/导航/下载/弹窗、路径穿越、重解析点、未声明资源和授权跟包全部有拒绝证据。
- 生命周期：切 Desk、替换 Room、暂停、screensaver idle、Player 销毁后旧 iframe、订阅、token、计时器完全失效。
- 视觉：1366×768、1920×1080、2560×1440 和非 16:9；空库、长名称、缺资源、Core 断线、Widget 崩溃、权限拒绝。
- 活体测试可能改变桌面或恢复布局时，只按验收计划在最终阶段运行；普通测试不得产生这类副作用。

Final delivery

全部完成后：

1. 更新 TODO、ROADMAP、PROJECT、README、相关契约和验收卡，使其与实现一致。
2. 运行最终验证，执行 git diff --check，核对具名文件和用户 rooms 未受影响。
3. 提交所有实现到 feat/ui-v2-001-configurator-v2，把 ROADMAP 和验收卡标为待验收。
4. 给用户一份简洁交付：分支、提交、结果、自动检查、已知限制，以及与验收卡完全一致的人工步骤。
5. 停止并等待用户明确回复通过或不通过。禁止自行合并 master、删除 worktree或功能分支。

Communication

用中文与用户协作。工具调用前给一两句可见更新；只在重大阶段、发现改变计划或需要用户决定时更新，不逐条播报命令。最终回答先讲完成结果，再讲验证和人工验收。
```
