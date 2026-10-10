# 踩坑记录 · 前端篇（配置器 Tauri/React，追加式勿删）

> 格式：症状 / 根因 / 解决 / 防再犯
> 全量索引见 `../ERRORS.md`；其他分册：git / backend / renderer / toolchain

## 5. 配置器界面裸样式（无 CSS）

- 根因：index.html 被 demo 版来回替换后恢复时丢了样式引入，main.tsx 从未 import index.css
- 解决：a5b1e61 补 `import "./index.css"`，删除无主 App.css
- 防再犯：UI 改版后先看 dist 里 css 产物是否非零

## 15. 设计模式下 invoke 报 TypeError 刷满状态栏

- 症状：浏览器设计模式（dev:ui）状态栏显示 `error: TypeError: Cannot read properties of undefined (reading 'invoke')`，盖掉「UI 设计模式」提示
- 根因：App.tsx 有两个初始化 useEffect，只有第一个做了 IS_TAURI 守卫；第二个（refreshRooms→openRoom）在浏览器里照样调 invoke（@tauri-apps/api 在非 Tauri 环境是 undefined）
- 解决：第二个 useEffect 也加 `if (!IS_TAURI) return;`
- 防再犯：设计模式下新增任何初始化逻辑，先想 IS_TAURI 守卫；新增 useEffect 时对照检查

## 22. DockEditor 先写后编译：TS 语法误入 .js + 组件编译错误堆

- 现象：审查 R11 UI 时 npm run build 一次性爆出 ~30 个错误：
  @/components/ui 无 Select/Switch（只有 button/input 原件）；named export 被 default import；
  setStatus/setDesks 未接线；icons[].label 路径键不匹配 keyof；DEFAULT_STYLE 判空；
  空 JSX 表达式；另外 main.js 里误写了 TS 类型标注 const vars: [...]
- 解决：抽 lib/dock.ts 共享类型与预设；DockEditor 改用原生 select/checkbox + 现有 Button/Input；
  per-desk 覆盖通过 setDesks 真正写回 room.json；渲染器 style 变量改 removeProperty 防残留
- 防再犯：新组件先 npm run build 再谈功能；.js 文件绝不写 TS 类型标注；
  UI 原件清单只有 button.tsx/input.tsx，选型前先 glob 确认

## 24. 配置器预览状态还在，但 iframe 已被 UI 改版移除

- 现象：顶栏「预览」按钮、`showPreview`、`postRoom` 和 `previewRef` 都存在，但点击后看不到任何预览；Dock 皮肤无法实时验证。
- 根因：R8 思维导图改版移除了 JSX 中的 `<iframe>`，却保留了全部预览状态和消息逻辑，形成半截功能。
- 解决：按 Phase 2 原结构恢复 `http://dext.localhost/index.html` iframe；`dext:room` 同时注入 roomCss，渲染器用预览专用 style 隔离覆盖包内旧 room.css。
- 防再犯：删除 UI 容器时同步检查对应 state/ref/effect 是否仍有消费者；保留入口按钮就必须有可观察结果。可用 `rg "previewRef|showPreview"` 核对定义和 JSX 引用是否成对。

## 25. 前端编译目标不支持 `Array.prototype.at`

- 现象：`npm run build` 报 TS2550，提示当前 lib 目标没有 `Array.at()`。
- 根因：项目 TypeScript 目标早于 ES2022，运行时可能支持并不代表类型配置允许。
- 解决：改用 `array[array.length - 1]` 的兼容写法。
- 防再犯：提交前必须跑 `npm run build`；在未统一升级编译目标前避免使用 ES2022 新增 API。

## 28. flex 节点内 `truncate` 未约束宽度仍会溢出

- 现象：思维导图的启动画面节点已有 Tailwind `truncate`，但名称变长后文字仍从固定宽节点左右溢出。
- 根因：节点是纵向 flex 容器；文字子项只有 `truncate`，没有占满父节点的明确宽度，浏览器仍按内容固有宽度布局。
- 解决：文字子项补 `w-full truncate`，节点补 `title` 保留完整名称提示；可变宽 Desk 节点另设最大宽度并在内部截断。
- 防再犯：flex/grid 子项做省略时同时给出可收缩的宽度约束（如 `w-full` / `min-w-0` / `max-w-*`），并用真实长文本做浏览器检查，不能只看短 mock 文案。

## 29. 撤回删除节点后选择状态仍指向不存在索引

- 现象：新增第三个 Desk 后执行撤回，节点和连线正确恢复为两个，但属性栏仍显示已不存在的 `d2`，当前 Desk 索引也越界。
- 根因：撤销快照只恢复 `desks/edges`，没有在节点数量缩小时校正 `activeDesk` 与 `graphSel` 这两个派生选择状态。
- 解决：应用快照时把 `activeDesk` 钳制到有效范围；若 `graphSel` 指向已不存在的 Desk，则清空选择。
- 防再犯：任何会改变集合长度的撤销/恢复逻辑，都要同时核对依赖该集合索引的选中项、焦点、详情面板和活动页状态。

## 35. UI 按钮存在，但真实 Tauri 链路仍走 mock 或漏保存素材

- 现象：Room 列表的“新增 Room”只追加浏览器 mock；编辑页“应用”绕过未保存草稿；已有 `saveAs` 函数没有可见入口，而且另存时只写 JSON，不复制 `background/start/switch/end`，新 Room 的内容引用全部悬空。
- 根因：UI 改版只检查按钮外观和函数是否存在，没有从真实 Tauri 入口追到 Rust 文件系统结果，也没有把 Room 当作“JSON + 四类素材目录”的整体。
- 解决：真实新增调用 `create_room`，成功后才选中并进入；编辑页应用统一走 `applyCurrent` 先保存 dirty 草稿；另存为通过 Rust 事务式创建目标并复用四类素材复制，失败时清理刚创建的目标，原 Room 保持不变。
- 防再犯：配置器入口验收必须覆盖“空库 → 新建 → 编辑 → 保存/应用 → 另存 → 重开”，并检查文件系统而不只看 React 状态；任何 Room 复制都必须同时验证 JSON、四类目录和 `__source` 边界。

## 36. 属性栏素材按钮只有外观、没有点击动作

- 现象：新增 Room 后，Desk/start 属性栏显示“图片 / 网页代码 / 视频”，但点击不打开文件选择；switch 方向只有预设下拉框。
- 根因：UI 改版留下了带“下一轮接真实导入”提示的占位按钮，却在 DXT-001 待验收时把“按钮可见”误当成内容配置已可用；既有 Rust 命令也只支持背景图片/视频和 switch 视频。
- 解决：复用并泛化 `import_background`，按 `slot + content_type` 复制到四个固定目录；Desk/start/switch 属性栏共用同一个 picker，两个 switch 方向分别更新各自 edge；选择后只更新内存草稿，明确保存才写 JSON。
- 防再犯：可交互控件进入待验收前必须逐个检查 `onClick/onChange` 和真实桌面结果；带“下一轮”提示的占位控件不能留在本轮可验收路径上。自动测试至少覆盖各目录、各类型和类型不匹配拒绝。

## 38. Core 身份只在配置器挂载时读取，退出后仍显示已连接

- 现象：从托盘退出 Dext Core 后壁纸和 pipe 已消失，但仍开着的配置器继续显示“Dext Core 已连接”；点击应用 Room 才得到连接失败。
- 根因：`core_identity` 只在 React 首次挂载时调用一次，绿色状态保存的是历史快照，不是当前连接状态。
- 解决：配置器每两秒重新验证一次 Core 身份；断线立即清空 identity，显示“Dext Core 未运行”并禁用全部应用 Room 入口；RPC 在两次轮询之间断开时也会主动降级状态。
- 防再犯：连接、进程和设备状态都不能用一次性初始化结果长期展示；必须定义刷新/事件机制，并把业务按钮可用性绑定到同一份实时状态。

## 43. Tauri `openPath` 有命令权限仍会被路径 scope 拒绝

- 现象：设置页“打开数据目录”和关于文档按钮都已渲染；补上 `opener:allow-open-path` 后，点击仍报 `Not allowed to open path`。
- 根因：Tauri opener 的命令 ACL 与路径 scope 是两层约束；前端直接提交任意绝对路径既需要广泛 scope，也扩大了 WebView 被注入时的文件打开面。
- 解决：前端只提交固定枚举；Rust `open_about_document` 重新映射并校验仓库内三份文档，`open_dext_directory` 从已验证 Core 身份派生 data/log 路径，再由原生 `OpenerExt` 打开。仅保留诊断保存所需的 `dialog:allow-save`，不授予 WebView 任意路径 opener scope。
- 防再犯：真实 Tauri 功能必须点击验证，不能以按钮出现或 TypeScript 编译通过代替；涉及文件、shell、opener 的能力优先设计为后端白名单 command，不向 WebView 开放通配路径权限。

## 51. 条件挂载画布的测量 effect 未依赖视图，流程连线为空

- 现象：Desk 流程视图的启动、Desk、待机节点正常出现，但 SVG 中没有任何 `line`，肉眼看不到节点间关系。
- 根因：几何测量 `useLayoutEffect` 在 Room 进入时执行，此时默认是桌面画布、流程 DOM 尚未挂载，于是因 `canvasRef` 为空提前返回；切换到流程视图时依赖项没有变化，effect 不会重跑。
- 解决：把 `editorView` 加入依赖，并仅在 `flow` 视图挂载后测量；零连线时也保留节点几何测量，不再用 `edges.length` 阻止初始化。
- 防再犯：任何测量条件挂载 DOM 的 effect 都必须依赖控制挂载的视图/开关状态；视觉验收同时检查 SVG 实际元素数量，不能只确认节点出现。

## 52. 自动检查全绿，但计划中的真实入口仍然缺失

- 现象：前端、Rust、C# 和浏览器检查全部通过后，工作包曾进入待验收；逐条回看总计划才发现空间库缺少排序、复制、重命名，Desk 也没有身份级重排入口，`DockEditor` 仍保存父子两份草稿。
- 根因：验证围绕“已经实现的代码”设计，没有把 `CONFIGURATOR_V2_PLAN.md` 的每一条范围反向映射到可见 UI、真实 Tauri/Core 链路和对应证据；测试全绿只能说明现有测试通过，不能证明需求全集完整。
- 解决：撤回待验收状态，建立完成度复审续作清单；补齐 Room 管理、Desk 重排与 Dock 单一真相源，并继续审计编辑器层级、运行生命周期和 Creator 真链。
- 防再犯：进入待验收前必须逐条执行“计划条目 → 用户入口 → 状态真相源 → 后端/运行时落点 → 自动或活体证据”的覆盖审计；不存在真实入口或只有 mock 证据的条目一律视为未完成。

## 104. 配置器在异步 Room 审计前写状态，失败后表现为“编辑无反应”

- 现象：Room 卡片“编辑”按钮可点击，但页面不进入编辑器；顶部只短暂或不明显地出现错误。当前 Room 的 `room.json` 没有 Widget，目录却残留 `widgets/clock-hardware/*`。
- 根因：`openRoom` 在等待发布级 `get_permission_review` 前已经连续写入 Desk、Dock、路径等 React 状态；严格资源清单检查因孤儿文件失败后 catch 返回 `false`，调用方不进入编辑器，留下不可解释的半状态。
- 解决：新增结构化 `inspect_room_for_edit`，把声明资源缺失/越界保留为致命错误，把未声明普通 Widget 文件报告为可修复项；前端在所有异步读取、审计和草稿读取完成后才提交状态。孤儿存在时进入带文件清单的受限编辑，并由显式按钮把文件复制校验后移至 Dext 恢复目录。
- 防再犯：任何“打开文档/项目”流程都必须先在局部变量完成解析与异步校验，再原子提交 UI 状态；编辑容错不能复用发布级布尔失败，也不能吞错后只返回 `false`。可修复错误必须有可见原因和可逆动作，发布/导出最终边界仍保持严格。
# #59 断线错误分类过窄

现象：Core 已退出或管道不可用时，顶部状态可能显示“身份拒绝”，而不是“Core 未运行”。

原因：App 和 AppHeader 只对固定的 `pipe connect failed` 子串做判断。

修复：统一按 pipe/connect/unavailable/not running 及中英文断线关键词分类，连接失败状态显示为 Core 未运行，并继续禁用依赖 Core 的操作。

防再犯：新增 Core RPC 错误文案时，必须覆盖连接失败分类和恢复后的重新连接。
# #60 Creator 报告信息与关闭状态不足

现象：安全报告只显示资源数量，无法直接核对实际资源；执行 inspect/confirm 时仍可关闭对话框。

原因：报告 UI 未渲染 `entry/resources`，关闭按钮没有绑定忙碌状态。

修复：显示入口路径、增加可展开滚动资源清单，并在异步操作期间禁用关闭按钮，避免 preview token 与 confirm/discard 竞态。

防再犯：导入报告必须展示实际资源、权限和入口；异步事务期间禁止关闭或重复提交。
# #61 运行诊断无法在配置器内查看

现象：用户只能把诊断导出到文件，无法快速确认 Player、活动 Room 和运行包状态。

原因：设置页未调用已有的 `diagnostics_json` 命令。

修复：新增“刷新运行诊断”按钮和可滚动 JSON 面板；浏览器 mock 提供脱敏占位，Tauri 断线/失败显示明确错误。

防再犯：后端新增只读诊断命令时，配置器应同时提供查看入口和导出入口。

## #226 改名返回路径须与列表和应用状态使用同一表示（2026-10-04）
rename_room_dir采用canonical源，Windows返回带扩展前缀目标；list_rooms/active_room是常规路径。配置器找不到roomPickPath/appliedRoom，退回库首项，立即编辑会打开另一Room。仅看磁盘改名和来源成功不足以验证UI。
rename_room返回display_path；原生作者rename更新name并保持UUID/资源，失败尝试恢复原文。最后UTF-8改名后不重新选卡，立即编辑正确Room，实际来源/节点/资源保持。UsePage复制入口和App处理器按saveAs能力禁用，v3不能因edit开放而允许未接通的复制。

## #231 ActiveRoom来源字段须核对实际camelCase回复（2026-10-04）
新个人面板误声明active_room.source_path，实际Rust Serialize为sourcePath。sameSource读undefined抛错，实际Core正常。读取真实RPC/source确认后修正；初次HMR旧面板仍有旧错误，重新打开后当前本机面板可用。接续同一自有Room，不重跑初始化覆盖原localStorage备份。Core检查不能代替Tauri JSON字段/实际UI核对。

## #233 目标库/视觉定位回执不能重置尚未保存的按钮选择（2026-10-04）
个人面板每个编辑回执都从确认按钮覆盖表单，保存目标或定位时把待保存的动作/Desk/皮肤选择丢掉，失败也会清空草稿。列表另按作者默认动作显示绑定徽标，启动改导航后误报未绑定，导航改缺目标启动却显示默认动作。
修复：按闭合操作更新选择，只有自身setButton确认/失败或成功resetButton回到确认值；目标元数据/定位保持草稿，成功删除仅清该目标引用。徽标使用Core有效动作与isBound。三个操作序列实际RED→GREEN，标签追加RED→GREEN，最终生产TS直接Node4/4约0.25秒；未构建/启动应用，真实UI在用户游戏结束后继续。

## #234 删除目标成功后旧编辑表单仍可把目标重建（2026-10-04）
目标列表允许编辑表单开启时明确删除；原流程删除只改Core目标列表，旧表单未关闭。再次点击保存以同UUID upsert，已删除目标会无意重建。
修复：目标表单在Core确认同ID upsertTarget或removeTarget成功后关闭；失败、其他目标或定位保持内容和重试ID。UI通过同一成功回执更新，去掉单独的保存promise清空。生产TS直接Node实际5/6→6/6约0.14秒，没有编译/应用/窗口；实际UI按验收第5项游戏后核对。

## #235 普通图标新增数量检查在模型/两个入口不一致（2026-10-04）
原默认图标模型不检查数量，UI只检查Desk512图标而没检查Room1024按钮，会编辑出无法保存的作者清单；个人面板复用按钮入口满512仍可点击并从事件抛错。
修复：同一v3IconCreationIssue检查Desk存在、512图标及仅新声明时1024按钮。两模型守原文、两个UI禁用并显示原因；按钮满额仍允许复用已有按钮，移除呈现仍保声明。生产TS直接Node实际6/8→8/8约0.16秒，原文不变/最后一项/ID保持均覆盖。未编译或启动窗口，实际UI按第3项游戏后核对。

## #236 试验台模拟接线与正式作者协议、当前几何须一致（2026-10-04）
首轮源接口核对发现，SDK导航发送params.action对象，公开按钮action是字符串；不能按独立deskId或作者清单action对象模拟。诊断只缓存geometry发布回执会留在动画旧坐标；发送全部控制设置中的旧Desk又会使调数据时误导航。
修正为正式SDK结构/公开投影；从正式DOM的readInputSample读取当前帧区域，Desk导航独立发送，其他模拟开关不带旧Desk。仅源核对/JS语法，未宣称实际运行通过；Task4一次真实资源/SDK/区域冒烟集中验证，不扩展网络专项。

## #263 v3本机数据授权只挂Dock，漏掉Widget（2026-10-09）
用户星轨实验室的读数声明在component.observatory，navigation只有导航/绑定能力。V3DockEditor只挂V3ReadGrantPanel并传component.navigation，面板过滤该消费者，返回无读数时错误引导重新应用；正式Core GetReadGrants实际已包含全部声明只读源。
修复：授权面板独立挂在Room编辑器，按当前安装身份的Core回复列出全部只读消费者，来源选择提供Widget/场景/背景/Dock名称；逐项保存仍传确认的consumerId/installationStamp，原授权和迟到结果处理保持，撤销只改对应项。新入口不扩KV或系统控制授权。
验证：TS/Vite及配置器v3-release完整成功；替换精确路径配置器并start.ps1复用Core，实际UI控件树出现Widget · 轨道观测台及四项复选框。授权由用户选择，没有代填允许/撤销或桌面读数验收。UI截图若被前台窗口遮挡，不能作为配置器视觉通过，使用控件树核对并停止额外前台操作。

## #266 原生应用 Dock 刷新与点击交错（2026-10-09）
问题：窗口标题/前台变化触发控件重建时，若发生在鼠标按下和抬起之间，会丢失 Click；配置器状态查询在途时直接 return 会吞掉用户修改。
处理：原生 Dock 在物理按键按下或菜单打开时延后控件重建；配置器用请求序号丢弃旧查询结果，修改请求优先，只有重复修改互斥。
验证：Release 编译、Core RPC；物理鼠标手感保留在独立验收卡，不能由接口检查替代。

## #267 未显示预览窗的DPI不可用于锚点换算（2026-10-09）
窗口第一次Show前GetDpi可能仍是默认值。若用它除Dock物理屏幕坐标，高DPI下预览会偏移。
锚点改由已显示Dock的Left加按钮TranslatePoint得到DIP；DWM目标矩形在预览Show后按其实际DPI转为设备像素。
轻量编译通过；高DPI实际屏幕效果仍由V3-P8-004第03步确认。

## #269 预览保留图标时点击闭包继续使用旧窗口快照
- 现象：预览可见时控件为保持输入稳定而不重建；应用新增/关闭窗口后，点击仍可能启动重复实例或走旧单窗动作。
- 原因：预览列表更新了，图标事件闭包捕获的DockGroup却未更新。
- 修复：保留按钮，点击时用稳定应用key读取最新快照；已移除项不派发。不要用强制重建按钮修这个问题，否则重引入按下/抬起丢失。
- 验证：真实WPF Button事件层旧固定项->运行项先RED后GREEN，加单->多窗口、移除项；物理输入仍单列实机验收。

## #274 观测台尾次计数遗漏（2026-10-10）
旧set在途时后续save因savePending退出；旧set成功后needsSave=true却显示已保存且未调度补写。改为成功后仅在值相同显示已保存，否则排一次最新值写入；失败不循环。延迟传输先RED再GREEN，下一文档读回最新值。
