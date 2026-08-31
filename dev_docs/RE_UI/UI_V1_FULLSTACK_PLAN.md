# UI-V1-001 Dext 配置器核心页面全栈开发计划

- 状态：实现完成，待用户验收（2026-08-31）
- 计划日期：2026-08-30
- 推荐分支：`feat/ui-v1-001-configurator-fullstack`
- 推荐 worktree：`D:\use\Orca\DEXT_Core\ui-v1-001-configurator-fullstack`
- 推荐验收文件：`dev_docs/acceptance/UI-V1-001-configurator-fullstack.md`
- 目标：在一个持续 Goal 和一个独立工作包中，完成 Room 安全导入导出、配置器使用页、编辑页、真实设置页与创意工坊占位的前后端闭环，统一完成自动测试和真机验收。
- 实现状态：已在 `feat/ui-v1-001-configurator-fullstack` 完成范围内实现、自动测试和真机检查；以验收卡和提交记录为最终状态。

> 本文件从原 `docs/ui-use-001-use-page-spec` 设计工作树带入实现分支，保留原计划作为范围基线；实际检查结果见 `../acceptance/UI-V1-001-configurator-fullstack.md`。

## 一、Goal 目标文本

创建 Goal 时使用以下目标：

> 完成 UI-V1-001 Dext 配置器核心页面全栈闭环：实现 Room 安全导入导出、使用页、编辑页、真实设置页和创意工坊占位；排除多显示器及所有无真实底层能力的假设置；严格遵守 AGENTS.md，在独立 worktree 中完成文档、前端、Rust、必要 Core 接线、自动测试和真机验收，提交后停在待验收，不合并 master。

Goal 负责跨多轮持续推进，但不改变仓库纪律：本包只使用一个 ID、一个 worktree、一个分支和一份独立验收文件；自测完成后必须停在“待验收”，用户明确回复“通过”前禁止合并 master。

## 二、范围

### 本包包含

- Room 新增、删除、多选、安全 zip 导入和导出。
- 使用页单击应用、真实运行状态、停止壁纸、紧凑详情栏和统一预览。
- 编辑页侧栏顺序、应用库删除、删除 Desk、Desk/Switch 属性栏重做。
- 设置页中已有真实底层能力的开关、路径、诊断和关于信息。
- 创意工坊“敬请期待”正式空状态。
- React、Rust、必要 proto/Core 接线、自动测试、运行验证和文档同步。

### 明确排除

- 多显示器和逐屏 Room。
- DXT-002 idle、DOCK-004、Dock 架构重构。
- 用户 `rooms` 内容及其迁移、删除或格式批量改写。
- 原版 Lively 数据迁移、安装器、更新服务和 Gallery。
- FPS/统一渲染质量、前端语言切换、在线更新、运行中清理播放器缓存、配置器托盘/关闭行为等当前没有完整真实能力的设置。
- 分享、创意工坊上传下载订阅、Room 在线发布。
- Player/Core 架构重构和 Lively namespace/程序集大范围改名。

## 三、开工前置条件

1. 用户明确确认 `UI-USE-001` 设计规格“通过”，完成合并、归档和 worktree 清理。
2. 检查 master、待验收分支和所有 worktree；不得触碰 DXT-002、DOCK-004 或其他会话工作区。
3. 从最新 master 创建 `UI-V1-001` 独立 worktree 和分支。
4. 动代码前在 TODO 追加目标、范围外、阶段和人工验收，并建立独立验收文件。
5. 检查 `.codegraph` 状态；查询代码前先用 CodeGraph。动过代码后再次查询前先 `codegraph status`，有 Pending Changes 时执行 `codegraph sync`。
6. 建立临时测试 Room/fixture；所有自动测试不得读取、覆盖或删除用户 `rooms`。
7. 记录基线：`npm run build`、`cargo check`、相关 Rust 测试和 `scripts/start.ps1` 当前结果。

## 四、阶段 1：Room 后端基础与运行状态

### 1.1 安全 Room 删除

- Rust 新增删除 Room command。
- 只允许操作当前 Room 库根目录下、包含合法 `room.json` 的直接 Room 目录。
- 拒绝库根目录、仓库根目录、符号链接/reparse point、路径穿越和库外路径。
- 优先移动到 Windows 回收站，不做不可恢复的递归永久删除。
- 删除当前正在运行的 Room 前先提示并调用停止壁纸；删除失败时不得从 UI 列表消失。

### 1.2 Room zip 导出

- 新增 `export_room_zip`。
- zip 根级只允许 `room.json`、`background/`、`start/`、`switch/`、`end/`。
- 导出前执行 v1 schema 与素材引用检查，剥离 `__source`，不携带旧 `room.js`、`room.css`、`transition/` 或运行包残留。
- 先写临时 zip，成功后再原子移动到目标路径；失败不留下半成品。
- 单个 Room 和多选 Room 分别导出为独立 zip；首版不再套一层自定义批量包协议。

### 1.3 Room zip 导入

- 新增 `import_room_zip`。
- 防护路径穿越、绝对路径、盘符、UNC、重复 entry、符号链接/reparse point、异常压缩比、文件数量、单文件大小和总解压大小。
- 只接受根级 `room.json` 与四类素材目录，拒绝 `__source`、旧扩展和未知顶层内容。
- 解压到 Room 库内的临时目录，完成 JSON、素材存在性、类型和路径校验后再原子改名。
- 重名不静默覆盖：前端要求用户改名，或明确生成不冲突名称。
- 任何失败清理临时目录，现有 Room 不受影响。

### 1.4 真实运行状态与停止壁纸

- Rust 封装 Core 已有 `CloseAllWallpapers` RPC；停止壁纸只能关闭 Player/壁纸，不退出 Dext Core。
- 增加 `active_room` 查询：以 `GetWallpapers` 返回的真实运行包为准，再从运行包 `room.json.__source` 解析源 Room。
- `localStorage` 只保存最近选择，不再作为“正在使用”的真相源。
- Core 重启、托盘停止或其他入口关闭壁纸后，配置器必须在下一次状态刷新中恢复为空闲状态。

### 1.5 设置 RPC 基础

- Rust 构建加入现有 `settings.proto`，复用身份验证后的 named pipe 调用。
- 提供最小 `get_dext_settings` / `patch_dext_settings` command，只暴露本包允许编辑的字段。
- 设置写入必须先 Get 全量设置、只 patch 指定字段、再 Set，禁止使用默认对象覆盖用户未编辑的 Core 设置。
- 配置器主题保持前端独立状态，不写 Core `ApplicationTheme`，避免触发旧 UI 重启逻辑。

## 五、阶段 2：使用页完整闭环

### 2.1 Room 管理工具栏

- 常驻：新增、导入、多选。
- 有选择时启用：删除、导出。
- 多选模式显示已选数量、全选、取消选择、批量删除和批量导出。
- 危险操作必须二次确认；处理期间禁用重复操作并显示明确进度。

### 2.2 选择、双击应用与停止

- 单击 Room 只完成选中和显示详情，不切换壁纸。
- 双击未应用 Room 才应用；多选模式下双击不得触发应用。
- 当前 Room 的详情主按钮从“应用”切换为“停止”。
- 详情栏提供独立“编辑”按钮，直接打开当前 Room 的 Desk 编辑模式。
- 应用/停止失败时恢复 Core 返回的真实状态，不能留下假成功状态。
- Dext Core 断开时仍可浏览本地 Room，但应用和停止禁用并显示原因。

### 2.3 紧凑详情栏与统一预览

- 详情栏宽度目标为约 `340–380px`，最终按常用窗口宽度实测调整。
- 预览区域固定为 16:9，常规尺寸约 `320×180px`，不得铺满整个详情栏。
- 详情预览只显示 Room 的图片/视频背景；HTML 或无静态背景时显示简单稳定占位，不执行完整 Room renderer。
- 预览不得显示桌面应用图标、Dock 或其他运行态宿主 UI。
- 预览无法加载时保持固定尺寸并显示具体错误，不导致布局跳动。

## 六、阶段 3：编辑页完整闭环

### 3.1 侧栏与应用库

- 编辑页侧栏顺序：Room → 应用库 → Dock。
- 应用库“删除”常驻在“添加”旁边，不依赖多选模式才出现。
- 无选择时删除按钮灰色禁用，选中后启用。
- 将“选中供删除”与“把应用加入 Desk”的交互状态分开，避免普通单击同时触发两种含义。
- 应用库保存成功后才更新最终 UI；Rust 写入失败时保留原列表并显示原因。

### 3.2 删除 Desk

- 顶栏用“删除 Desk”替换现有分享位置；分享暂缓，“另存为”位置不在本包改造成分享。
- 未选择 Desk 或只剩一个 Desk 时删除按钮禁用。
- 删除前生成旧索引到新索引映射，统一处理：
  - `startDesk`
  - `activeDesk`
  - `graphSel`
  - Desk 顺序
  - 两个方向的 switch
  - 撤销/重做快照
- 原本存在的 switch 跟随旧 Desk 对和方向迁移。
- 删除后新形成、过去不相邻的 Desk 组合保持为空，并明确提示需要补充切换内容，禁止猜测复制。

### 3.3 Desk 属性栏

- 增加固定 16:9 小预览。
- 显示素材名称、相对 Room 路径、素材类型和是否已选择。
- 图片、视频、HTML 入口旁显示当前类型圆点，同时保留文字和无障碍状态，不只靠颜色表达。
- 素材为空、文件缺失、类型错误时显示稳定占位和具体原因。
- 增加“放入应用”按钮，跳到应用库并保持当前 Desk 作为加入目标。
- 应用库显示提示：“应用加入后，可在桌面长按图标拖动位置。”

### 3.4 Switch 属性栏

- 每个方向使用与 Desk 属性栏一致的预览、路径、类型和操作结构。
- 类型入口为图片、视频、HTML、内置效果。
- 只有选中“内置效果”时才显示 `slide`、`fade`、`zoom`、`none` 列表。
- 不修改 room.json v1 schema；继续使用现有 `Content` 或内置效果字符串。

## 七、阶段 4：设置页真实功能

### 4.1 常规

- 开机启动：读写 Core `Startup`，验证 Windows Run 项使用 Dext 身份。
- 配置器主题：只保留并排的太阳/月亮图标选择浅色与深色；保持为配置器自己的设置。

### 4.2 壁纸与性能策略

- 全屏应用时暂停。
- 电池供电时暂停。
- 节能模式时暂停。
- 仅桌面可见时播放声音。

这些项目必须读写 Core 已有真实字段并通过运行验证；设置页不提供全局壁纸音量，也不在没有 Room v1/Core 契约的情况下添加 Desk 音量假控件。不把在线流 `StreamQuality` 冒充为 Dext Room 渲染质量，也不提供无效 FPS 控件。

### 4.3 存储与诊断

- Room 库路径使用配置器现有 `libDir`，与 Core `WallpaperDir` 明确区分。
- 提供目录选择并验证目标可读写；切换路径不自动迁移旧 Room。
- 提供“打开 Dext 数据目录”和“打开日志目录”。
- 导出诊断文本或 JSON，至少包含：配置器版本、Core 版本、PID、Core 绝对路径、运行身份、pipe、数据目录、日志目录、当前壁纸运行包和源 Room。

### 4.4 关于

- 显示 Dext 配置器与 Core 版本、Core 身份和真实路径。
- 提供 LICENSE、NOTICE/README 上游来源入口。
- 明确 Dext 使用自己的 Lively Core fork，不依赖用户另外安装的原版 Lively。
- 不恢复原版 Lively Gallery 或 GitHub 更新检查。

## 八、阶段 5：创意工坊占位

- 页面只显示稳定的“敬请期待”空状态和简短说明。
- 不显示无功能的上传、下载、登录、订阅和搜索控件。
- 不新增后端 command，也不提前定义 MARKET-001 协议。

## 九、实现结构约束

- `App.tsx` 已较大，只按功能抽取必要的 `RoomToolbar`、`SettingsPage` 和纯 Desk 重映射 helper；Room 详情背景复用现有封面素材渲染，不保留完整 renderer iframe 组件，不在本包进行全应用架构重构。
- Desk 删除/重映射必须实现为纯函数并单测，JSX 不直接承载索引算法。
- Room 文件操作统一集中在 Rust，并使用显式根目录校验；React 不直接拼接删除目标。
- 所有业务 RPC 继续经过 Dext Core 身份验证层。
- 用户可见错误必须说明具体对象和恢复方式，不只显示 `error`。
- 新增依赖前先确认必要性；zip、回收站或前端测试依赖只选择维护活跃且用途单一的实现。

## 十、自动测试

### 前端与 Rust

- `cd tauri-ui && npm run build`
- `cd tauri-ui/src-tauri && cargo check`
- `cd tauri-ui/src-tauri && cargo test --lib`
- `cd tauri-ui/src-tauri && cargo test --lib applies_room_wallpaper -- --ignored`（活体测试，会改变桌面与 Core 恢复布局）

### 新增测试重点

- Desk 删除：首/中/尾位置、删除 `startDesk`、仅剩两个 Desk、三 Desk 首尾、两个方向 switch 保留、新邻接为空、undo/redo。
- Room zip：正常 roundtrip、无 `__source`、重名、非法 schema、缺素材、类型不符、路径穿越、盘符/UNC、重复 entry、数量/大小超限、失败无残留。
- Room 删除：库内合法 Room、库外路径、根目录、符号链接/reparse point、活动 Room、回收站失败。
- 设置：Get → patch → Set 保留未修改字段；断开 Core 时禁用；非法数值拒绝。
- 运行状态：应用、外部停止、Core 重启、Player 异常退出后都不保留假“应用中”。

### 构建与运行

- 修改 C# 或 proto 后：`scripts/build.ps1`
- `scripts/start.ps1`
- `scripts/verify-runtime-identity.ps1`
- `git diff --check`
- `git status --short` 只包含本工作包具名文件。

## 十一、真机人工验收

1. 启动 Dext，确认 Core、Player 和配置器来自 UI-V1-001 当前 worktree 构建路径。
2. 使用页单击一个未应用 Room，确认立即应用、右侧显示详情，当前 Room 主按钮变为“停止”。
3. 点击“停止”，确认 Player/壁纸关闭但 Dext Core 和配置器保持连接；从托盘停止后配置器状态也能同步。
4. 新增、删除、多选、导入和导出 Room；确认删除可恢复、重名不覆盖、非法 zip 被拒绝且库中无残留。
5. 确认图片、视频和 HTML Room 都在相同固定 16:9 预览框显示，详情栏不会被预览铺满。
6. 编辑页确认侧栏顺序为 Room → 应用库 → Dock；应用库删除按钮常驻，未选禁用、选中启用。
7. 删除首、中、尾 Desk，确认 `startDesk`、当前选择、撤销/重做和双向 Switch 均正确；新邻接没有错误继承旧效果。
8. Desk 与 Switch 属性栏均显示预览、素材名称、相对路径和类型圆点；只有内置效果显示效果列表。
9. 设置页修改开机启动、主题、全屏暂停、电池/节能暂停和音量，重启配置器/Core 后确认保存并真实生效。
10. 更改 Room 库路径，确认不静默迁移旧 Room；打开数据/日志目录并导出诊断，确认路径和 Core 身份正确。
11. 关于页保留 Dext 产品身份、LICENSE 和上游 Lively fork 归属；创意工坊只显示“敬请期待”。
12. 确认没有多显示器入口，没有修改 DXT-002、DOCK-004 或用户 rooms，也没有恢复原版 Lively 更新/Gallery。

## 十二、完成标准与停止点

- 上述范围全部完成，自动测试和十二项人工验收准备就绪。
- README、ROADMAP、TODO、PROJECT、LIVELY_API、RE_UI 页面规格和独立验收文件同步实际结果。
- 按阶段提交清晰 commit，最终工作分支干净。
- ROADMAP 和验收卡标记“待验收”，给出提交哈希、自动检查结果、真实进程路径和已知限制。
- 到此停止 Goal 的开发动作；用户明确回复“通过”之前不得合并 master、删除工作分支或清理 worktree。

## 十三、主要风险与控制

| 风险 | 控制方式 |
|---|---|
| zip 路径穿越或解压炸弹 | 临时目录、严格 entry 校验、数量/大小/压缩比上限、完整验证后原子改名 |
| Desk 删除导致 switch 错配 | 使用旧索引映射的纯函数，覆盖首中尾和方向单测 |
| 设置全量 RPC 覆盖未编辑字段 | Get 全量 → 只 patch 白名单字段 → Set 全量，并做保留字段测试 |
| UI 显示假“应用中” | Core `GetWallpapers` 与运行包 `__source` 作为唯一运行真相 |
| 删除错误目录 | canonical path、库根边界、合法 Room 标志、回收站和二次确认 |
| `App.tsx` 继续膨胀 | 只抽必要组件和纯 helper，不做无关架构重构 |
| 大工作包排障困难 | 阶段门、阶段测试、清晰 commit；任一阶段失败先修复，不把错误滚入下一阶段 |
