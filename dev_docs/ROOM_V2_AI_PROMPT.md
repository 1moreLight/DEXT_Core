# Room v2 AI 创作提示词

> 用途：让 AI 像写前端一样创作 Room v2 或为现有 Room 增加 Scene/Widget。生成结果仍必须经过 Schema、资源、安全和隔离预览检查；AI 不是安全边界。

## 可直接复制的提示词

```text
你正在为 Dext 创作一个可分享的 Creator Pack v1，由用户确认后加入原生 Room v2。请把它当作“官方桌面宿主中的受限前端内容”，不要生成桌面程序、Shell 脚本、完整 Room 或通用系统自动化。

目标与风格：
- [在这里描述主题、视觉风格、目标分辨率观感和交互]
- Desk 数量：[填写]
- 希望显示的数据：[例如时间、CPU/RAM、媒体标题、封面、音量]
- 希望允许的动作：[只从播放、暂停、播放/暂停切换、上一首、下一首、系统主音量设置/静音中选择]

创作判断：
1. 如果动态信息与壁纸构图强绑定，例如墙上时钟、建筑灯条 CPU、唱片机封面、HUD 进度条，优先把它做进 background HTML Scene，可任意形状和位置，不要强行做成卡片。
2. 如果内容需要独立拖动、缩放、复用或由用户自由组合，则做成 Widget。一个 Desk 可以有多个 Widget，尺寸可以不同，也允许受控重叠。
3. Scene 与多个 Widget 可以混用。不要因为支持 Widget 就把整个画面切成一堆矩形小组件。
4. Widget 与桌面图标冲突由 Dext 官方宿主处理；不要在作者代码里移动、隐藏或覆盖图标与 Dock。

必须遵守的 Room v2 契约：
- room.json 固定 version: 2；每个 Desk 都必须有 widgets 数组，没有 Widget 也写 []。
- 只使用 background/start/switch/idle/widgets 五个内容目录。
- 所有路径必须是 Room 内正斜杠相对路径，禁止 URL、绝对路径、盘符、反斜杠、. 和 ..。
- Widget id 使用小写 ASCII slug，整个 Room 内唯一；src 必须是 widgets/<id>/ 下的 HTML，并列入 resources。
- resources 必须逐项声明 Widget 用到的全部本地文件，不能藏未声明文件。
- placement 使用 1920×1080 逻辑画布整数 x/y/width/height/z，最小 64×64，完整位于画布内。
- config 是可分享的普通 JSON；不得放 token、密码、授权记录、当前歌曲、设备 id 或运行态。
- 不生成顶层 room.js/room.css，不修改官方 Desk、Dock、图标或 IPC DOM。

安全限制：
- Scene/Widget iframe 运行在 sandbox="allow-scripts"，没有 allow-same-origin。
- 不得使用 chrome.webview、Tauri invoke、gRPC、Node.js、ActiveX、文件系统、注册表、Shell、PowerShell、cmd、任意 exe/lnk/URI/URL 启动。
- 默认无网络；不得 fetch、WebSocket、远程 script、远程 iframe、远程字体或 CDN。所有资源自包含。
- 不得自行访问系统媒体、主音量或硬件 API。只写 Dext 版本化能力桥的适配层；若当前 SDK 尚未提供该能力，使用清晰的 mock 数据并标注待接线，不要伪造可运行接口。
- 系统操作只能声明 Dext 标准 action id，并由官方可信热点在真实用户点击后执行。作者脚本不能自动播放/暂停、改音量或把 postMessage 冒充用户手势。

唯一输出包结构：
- creator.json：严格符合随上下文提供的 `creator-kit/creator-pack.schema.json`。
- content/：entry、CSS、JS、图片、字体等全部离线资源；`resources` 相对 content/ 逐项声明，实际文件必须与清单完全一致。
- 最终将 creator.json 与 content/ 直接压在 zip 根目录，文件名使用 `<id>.dext-content.zip`。不要输出 room.json，也不要把完整 Room 或本机应用绑定装入包。
- 优先复用 `creator-kit/sdk/dext-sdk.js` 和 `.d.ts`；模板见 `creator-kit/templates/scene` 与 `creator-kit/templates/widget`。

输出要求：
1. 先给出“Scene 还是 Widget”的设计判断及理由。
2. 列出完整文件树和内容的权限、可信热点；Widget 还要写 placement。
3. 生成完整文件内容，不省略关键 CSS/JS，不引用外网。
4. 提供合法的 creator.json v1；Dext 配置器负责把它安全合并到当前 Room。
5. 提供安全自检：非法路径、未声明资源、网络、危险 API、权限、系统动作、消息来源和资源大小。
6. 提供 1920×1080、16:10、超宽屏下的布局检查，以及多 Widget 拖动/重叠/图标避让的人工验收步骤。
7. 如果需求超出 Dext 已定义能力，明确写“需要新增官方能力”，不要用绕过方案实现。
```

## 使用建议

- 首轮让 AI 只做 P0/P1 的离线视觉与 mock，隔离预览稳定后再接 P2 媒体数据或可信动作。
- 直接使用配置器“AI 创作 → 导出 AI 上下文”，它会提供脱敏后的当前 Room、两个 Schema、SDK、模板、fixtures 和安全说明。
- AI 修改设计时仍重新生成一个完整 Creator Pack，并在输出后重新枚举 resources，避免漏文件或隐藏孤儿资源。
- 对高度艺术化页面，优先让 AI 写一个完整 Scene，再选择性拆出真正需要用户拖动的模块。
