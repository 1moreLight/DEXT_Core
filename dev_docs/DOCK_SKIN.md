# DOCK-SKIN-001 Dock 沙箱皮肤 · 受管格式设计稿（待用户拍板）

> 2026-09-05 起草。目标：给 Dock 定义「创作者提交代码换外观」的官方受管格式，
> 与 Room v2 的 Scene/Widget 同款安全模型（沙箱 + 能力桥 + 白名单动作）。
> 本稿是**设计契约**，不是实现；实现拆分见 §8。用户拍板 §9 的三个决策后进入实现工作包。

## 一、定位与动机

- Dock 目前只有受管 `dock.style`（6 个 CSS 变量映射）——表达力有限；DOCK-001 时代的
  顶层 `room.css` 全 CSS 覆写已在 v2 废弃（可覆盖官方 DOM/IPC，安全边界冲突，见 DOCK.md 零）。
- 用户定调（2026-09-05）：dock 的样式要能「像 desk 那样自己提交代码」，机制同款，
  官方提供接口、不让恶意代码越界。
- 本设计把 Dock 皮肤定义为**一种沙箱 HTML 内容**：皮肤页负责整条 Dock 的视觉渲染，
  官方宿主保留全部数据、交互命中、启动、拖拽与持久化。

## 二、数据契约草案（room.json v2 增量）

```jsonc
{
  "dock": {
    "enabled": true,
    "position": "bottom",
    "indicator": "text",
    "style": { /* 现有受管字段；无皮肤时照旧生效 */ },
    "icons": [ /* 现有常驻图标，不变 */ ],
    "skin": {                      // 【新增，可选】
      "name": "HUD Dock",
      "type": "html",             // 仅 html（皮肤需要响应状态；image/video 不设）
      "src": "dock/hud.html"      // 固定 dock/ 目录（路径规则同 start//idle/）
    }
  },
  "desks": [ /* 每桌 dock 覆盖结构不变；skin 是否允许桌级覆盖 → §9-D3 */ ]
}
```

- Schema 增量：`$defs.dock` 增 `skin`（`$ref` content 变体，src 锚定 `^dock/`，禁 `..`/
  反斜杠/绝对路径——复用 safeRelativePath 规则）；`additionalProperties: false` 保持严格。
- `apply_room` 子目录拷贝清单加 `"dock"`（与 start//idle/ 同款泛化拷贝）。
- 资源约束：皮肤页可引用 dock/ 内相对资源；跨目录引用（../background/..）一律拒绝——
  皮肤是独立交付物，分享时自成一体（与 Widget resources 白名单同哲学，量级更轻）。

## 三、运行模型（推荐方案 B：整条视觉委托 + 隐形官方命中层）

```
┌ #dock（官方定位层，z-index 20，不变）──────────────┐
│  无 skin：官方 .dock-inner 照旧渲染（现状零变化）      │
│  有 skin：官方 chrome 隐藏（visibility 不占位判断）    │
│   ├─ skin iframe（sandbox="allow-scripts"）          │
│   │    皮肤画整条 dock：背景/形状/图标/动画/字体       │
│   └─ 官方隐形命中层（宿主根据皮肤上报的 rect 生成）     │
│        点击→msg_launch；拖入/拖出命中→官方判定        │
└──────────────────────────────────────────────┘
```

- **官方永远保留**：图标数据（room.dock.icons）、点击启动、编辑模式删除徽章逻辑、
  桌面↔Dock 拖拽的命中与持久化（拖拽入口恢复与否见 ERRORS #65，与本包无关）、
  运行态轮询、切桌重算、persistRoom 双写。
- **皮肤拿到**：dock 状态只读快照 + 推送（§4），自由渲染一切视觉。
- **皮肤拿不到**：官方 DOM、IPC 通道、网络（离线边界已挡）、图标数据改写、启动调用
  （它连 launch 都看不见 target——只看到图标的展示别名与序号）。

### 3.1 命中握手协议（本设计的关键新机制）

皮肤渲染的图标位置官方不可知，因此皮肤**上报布局**，官方校验后生成隐形命中层：

```jsonc
// 皮肤 → 官方（window.parent.postMessage，带实例 token，协议复用能力桥通道）
{ "type": "dext:dock-layout", "protocol": 1,
  "hitAreas": [
    { "id": "icon:0", "rect": { "x": 12, "y": 8, "w": 44, "h": 44 } },   // 像素，相对皮肤视口
    { "id": "icon:1", "rect": { "...": "..." } },
    { "id": "custom:menu", "rect": { "...": "..." } }                     // 自定义可点区（动作受限，§4）
  ]}
```

- 官方校验：数量 ≤ icons.length + 8；rect 必须落在 Dock 条带内；越界/非法/超频（≥200ms
  节流）整包丢弃并回退官方渲染。
- `icon:N` 命中 → 官方按 N 取 `dock.icons[N]` 执行既有启动/删除逻辑；`custom:*` 命中
  → 仅允许转发为白名单动作（如 `action.invoke` 系），无任意能力。
- 皮肤未上报/上报失效 → 官方隐形层不生成，点击穿透到皮肤页自身（仅视觉），并标记
  `degraded`，状态推送里告知皮肤「命中层未生效」。

## 四、能力桥增量（permissions 与推送）

| 新增能力 | 方向 | 内容 |
|---|---|---|
| `dock.read` | 官方→皮肤 | 只读快照+推送：icons 展示视图（label/glyph/icon_png/序号——**不含 launch**）、indicator 状态、running 集合、editMode、官方拖拽反馈（dragOver/highlight）、degraded 标记 |
| `dock.layout` | 皮肤→官方 | §3.1 命中上报（不算 permission，属握手协议，带 token 校验） |

- 复用现有机制：实例注册（token/协议号）、按权限推送、暂停冻结/恢复补快照、
  `disposeRuntime()` 统一失效——能力桥零新概念，只加一种实例类别（dock skin）。
- `action.invoke` 白名单照旧；皮肤**不新增**任何系统能力。

## 五、安全边界（与 Scene/Widget 完全同款，无新增攻击面）

1. `sandbox="allow-scripts"` 独立 opaque origin：无官方 DOM、无 Cookie/存储特权。
2. 离线边界（Player Offline Boundary）：仅同虚拟主机 `.localhost` 资源可达，网络/外域/下载全拒。
3. 权限最小化：皮肤默认零权限，`dock.read` 需在 room.json 声明并由配置器权限审阅 UI 展示
   （复用 Widget 权限询问流）。
4. 命中上报只进不出的单向数据流：rect 数据校验后仅用于生成官方命中层，不回流不存储。
5. 最坏情况评估：恶意皮肤能做的 = 在自己的画布里画任何东西 + 恶意上报 hitAreas 让官方
   层错位（用户点 A 启动 B）→ 缓解：hitAreas 数量/范围校验 + 皮肤权限审阅提示 +
   「官方兜底渲染」一键回退（§6）。

## 六、降级与兜底（必须实现，非可选）

- 皮肤 iframe 加载失败 / 3s 未上报布局 / 运行中崩溃（error 或 layout 失效）→ 自动回退
  官方默认 dock 渲染，状态栏 toast「Dock 皮肤不可用，已回退官方样式」。
- 配置器可一键「停用皮肤」（删 skin 字段）——皮肤永不具备把 Dock 变不可用的能力。
- Room 应用隔离（ROOM-FIX-001 链）天然覆盖 dock/ 目录：换房即镜像替换，无残留。

## 七、与现有字段/功能的关系

| 项 | 关系 |
|---|---|
| `dock.style` | 无皮肤时照旧；有皮肤时**忽略**（皮肤自管视觉），文档标注避免双重来源 |
| 运行态绿点（DOCK-004） | 数据照常推给皮肤（running 集合）；官方 chrome 隐藏时圆点由皮肤画 |
| 每桌 dock 覆盖 | icons/position 等字段继续生效并推送给皮肤；skin 本身是否可桌级覆盖 → §9-D3 |
| autoHide | 官方定位/缩回机制不动；皮肤配合收到的视口/状态推送自画（本轮不做适配要求） |
| Dock 模板库（DOCK-001 卡片） | 后续升级为「皮肤包」载体（§8-b），旧 CSS 模板仍按受管 style 注入，不混用 |

## 八、实施拆分（拍板后另立工作包，本包只交设计）

- **SKIN-001a 契约与宿主**：schema 增量 + fixtures、`apply_room` 拷贝 dock/、渲染器
  皮肤挂载/命中层/降级回退、能力桥 `dock.read`、`disposeRuntime` 接线、真机验收。
- **SKIN-001b 配置器与模板**：Room 内 Dock 皮肤选择/权限审阅/一键停用；Dock 模板库
  升级皮肤包格式（含最小示例皮肤 ×2：HUD 风、胶囊风）。
- **SKIN-001c 预览**：`room-preview.ps1` 与配置器内嵌预览中皮肤可渲染（无真启动）。

## 九、待用户拍板的决策点

| # | 决策 | 推荐 |
|---|---|---|
| D1 | 皮肤管多大：A 只换壳（官方图标仍官方画）/ B 整条视觉委托+隐形命中层 | **B**（表达力拉满，兜底已设计） |
| D2 | 皮肤能否隐藏官方功能件（切桌箭头/指示器/尺寸切换/完成钮） | **能**——皮肤收到状态后自画等价物；但「编辑模式退出钮」必须保留可点（皮肤必须上报其命中区，否则降级回退） |
| D3 | `dock.skin` 允许桌级覆盖吗 | **不允许**（全局唯一，每桌只覆盖 icons/style）——皮肤管「整条 dock 长什么样」，一房一肤，避免多皮肤切换的复杂度 |
| D4 | 皮肤素材是否允许引用 dock/ 之外的房间资源 | **不允许**（皮肤自包含，分享语义干净） |

## 十、参考

- DOCK.md（Dock 模块契约；零节安全边界、待补节皮肤欠账出处）
- WIDGETS_V2.md / room-v2.schema.json（沙箱/权限/资源白名单母型）
- capability-bridge.js（实例/token/权限推送机制，直接复用）
- ERRORS #65（真桌面拖拽取消——本设计不依赖拖拽，命中层方案独立成立）
