# Frontend Work Doc —— 配置器 UI 协作手册

> 更新：2026-08-25。记录配置器（tauri-ui/）UI 设计的**协作方式**与**当前进度**。
> 渲染器（wallpapers/dext-room/）的外观手册见 FRONTEND.md，两者别混。

## 一、协作方式（用户与 AI 的既定工作流）

1. **小步迭代**：一轮只改一个点（一个组件/一处样式），不做大批量改动。
2. **实时预览**：`cd tauri-ui && npm run dev:ui`（浏览器 1421，mock 数据，HMR 秒刷）。
   AI 改完代码用户直接在浏览器看效果，无需任何操作。
3. **多轮反馈后才 commit**：用户逐轮给反馈（哪里不对/想怎么调），多轮满意后用户说
   「commit」才提交。此条为用户对 AGENTS.md「每轮必 commit」的显式覆盖。
4. **mock 与真后端同构**：设计模式的数据在 `App.tsx` 顶部 `MOCK_APPS / MOCK_ROOMS /
   MOCK_DESKS`，改什么假数据直接动那里；真 Tauri 环境走同一套组件，仅数据源不同。
   封面图例外：浏览器里是渐变兜底，真图要 Tauri 真机（lib:// 协议）才看得到。
5. **深浅主题都过一眼**：顶栏月亮/太阳切换，改完样式两种主题都要检查。
6. **验收与记录不省略**：多轮迭代结束 commit 时，一次性补 TODO 打标 +
   ACCEPTANCE.md 清单（验收项标「真机」的必须在 Tauri 环境验）。

## 二、当前进度（2026-08-25，Phase 8 主页改版）

### 已完成并提交（e01ad57）

- Rust：`list_rooms` 增 `covers` 字段（逐 desk 解析 background：图片/视频标记）
- Rust：`lib://` 自定义协议映射房间库目录（list_rooms 同步目录到托管状态，防穿越）
- 前端：`CoverCollage` 拼贴封面组件（1 满幅 / 2 对分 / 3 三联 / 4 田字；
  视频位=暗底胶片角标；无背景=按房名哈希渐变兜底）
- 前端：使用模式 Hero 布局 + 顶栏深浅主题切换（localStorage 记忆）
- 顺手修：设计模式 invoke TypeError（两个初始化 useEffect 均加 IS_TAURI 守卫，ERRORS #15）

### 本轮迭代（多轮协作中，**未 commit**）

- [ ] 布局改版：使用页 = 左侧房间卡片网格（2 列，16:9 封面卡）+ 右侧主 room 大卡（占一半宽）；
      点卡片 → 右侧大卡跟随
- [ ] 使用页搜索栏：按房名过滤卡片；无匹配/库为空各有提示
- [ ] 顶栏 tab 扩为四个：使用 / 编辑 / 创意工坊 / 设置（后两者为占位页）

### 待办

- [ ] 用户验收 Phase 8（ACCEPTANCE.md「Phase 8」H/I/J/K 四组；I 组需真机）
- [ ] 本轮迭代改动 commit（用户拍板时机）

## 三、当前 UI 结构快照

```
<main> 顶栏：Dext ｜ [使用|编辑|创意工坊|设置] ｜ … ｜ 🌙 ｜ 状态栏 ｜（编辑模式时：房间下拉/新建/另存/库路径/转场/预览/保存/应用）
├─ 使用页：左 = 搜索栏 + 房间卡片网格（2 列）
│          右 = 主 room 大卡（w-1/2，渐变遮罩 + 房名/统计/应用中徽标 + 应用钮）
├─ 编辑页：desk 侧栏 + 应用库/预览（Phase 2-6.5 形态，未动）
├─ 创意工坊：占位（规划中文案）
└─ 设置：占位（库路径/主题偏好未来集中于此）
```

关键代码位置（App.tsx）：

| 内容 | 位置 |
|---|---|
| `CoverRef / CoverTile / GRADIENTS / nameGradient / roomCovers` | 类型与封面数据层（transitionLabel 之后） |
| `CoverTileBox / CoverCollage` | 封面拼贴组件 |
| `heroRoom / filteredRooms` 派生 | App() 组件体后段 |
| 使用页 JSX | `mode === "use"` 分支 |
| mock 数据 | 文件顶部 `MOCK_*` 常量 |

## 四、纪律（继承 FRONTEND.md 第七节，配置器侧）

- 设计模式新增任何初始化逻辑，先想 `IS_TAURI` 守卫（ERRORS #15）
- 禁止裸 catch；invoke 失败必须 `setStatus` 让用户看见
- 改完跑 `npm run build`（tsc 类型检查）；动 Rust 则 `cargo check`
- 两前端共享的只有 room.json，别在配置器里写渲染器逻辑
