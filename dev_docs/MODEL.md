# Room↔Desk 概念模型（schema v1 蓝图）

> 定稿于 2026-08-25，用户拍板三项争议点后成文。
> 本文是 schema v1 的前置输入；实现（渲染器/配置器改造）另行排期。

## 一、实体与关系

```
Room ──── 分享单位（文件夹 → zip），自包含
 │   room.json        数据 + 清单（唯一契约）
 │   background/      背景/转场素材目录
 │   transition/      stinger 视频素材目录
 ├──▶ Desk[0..N]      页面：有序数组，环形导航（% length），≥ 1 个
 │      name / background / icons[] / iconSize
 └──▶ Icon[0..N/桌]   值拷贝语义：base64 图 + launch 快照
                      稀疏网格坐标 (x,y)，同页内唯一（拖拽交换保证）

Library（rooms/library.json）
    配置器私有应用库，不属于任何 Room；
    拖入 Desk 时快照为 Icon，此后与库无引用关系
```

要点：

- **Room = 主题包**，分享/上传/下载的单位；room.json 自包含，不引用包外资源。
- **Desk = 页面**，对应手机主屏的一页；身份 = 数组下标（无 id），顺序即导航顺序。
- **Icon 是拷贝不是引用**：从 Library 拖入即内嵌（base64 + launch 三元组快照），删库不影响桌面。

## 二、字段归属判据

> **切到另一页时希望它变吗？** 变 → desk 级；不变 → room 级。

| 字段 | 层级 | 判定 |
|---|---|---|
| `name` | desk | ✓ 页面标识 |
| `background` | desk | ✓ 每页换景（string=图片 / {video} / 空=纯黑兜底） |
| `icons` + `x,y` | desk | ✓ 页面内容，稀疏网格 |
| `iconSize` | desk | ✓ 每页密度独立 |
| `transition` / `transitions` | room | ✓ 切换行为，全房间一致（见下节） |
| 外观主题（颜色/字体/Dock 样式） | — | **暂不做**（2026-08-25 拍板 YAGNI），将来若做进 `room.theme` |

## 三、转场：有向边模型（本轮核心决策）

切桌动画按 **desk 有向边** 建模：N 个桌有 N×(N-1) 条有向边（3 桌 = 6 条），来回可不同。
数据上用「房间默认 + 边级覆盖表」，想配几条配几条：

```jsonc
{
  "transition": "slide",            // 房间默认（现有字段，兼容不动）
  "transitions": {                  // 可选：边级覆盖表（新字段，预留接口）
    "0>1": "fade",
    "1>0": { "type": "video", "src": "transition/back.mp4" },
    "2>1": "zoom"
  }
}
```

- key 格式 `"from>to"`，值为下标；方向天然区分来回。
- 渲染时查找顺序：`transitions["cur>next"] ?? transition ?? "slide"`。
- 未覆盖的边全部走默认 → 现有房间零迁移。
- 值的多态与现有一致：字符串=预设名（slide/fade/zoom/none/text），对象 `{type:"video",src}`=stinger。
- 环形导航下 from/to 取实际下标（如末桌→首桌为 `"2>0"`）。

## 四、清理项

- **`transitionText` 废弃**：v1 移除该字段。text 类型转场保留在预设里，文案改固定模板
  （渲染器内部生成，不再是数据字段）。
- **`__source`**：运行时双写戳（apply_room 盖章、Core 保存回写用），非内容字段。
  schema 中标注为「传输保留，创作者/AI 不要写」。

## 五、不变量

1. `desks.length ≥ 1`
2. desk 身份 = 下标；数组顺序 = 导航顺序（环形）
3. 同一 desk 内 icon 的 (x,y) 唯一（编辑器保证；宽容读取不校验重复）
4. room.json 自包含：素材路径相对包根，一律 ASCII
5. 宽容读取：缺字段一律默认值（ERRORS #4 教训）；未知字段忽略不报错
6. 图标无 `launch` 时双击走 `action` toast 文案

## 六、room.json v1 字段总表（草案）

```jsonc
{
  "desks": [                        // 必需，≥1
    {
      "name": "Desk 1",             // 缺省 "Desk N"
      "background": "background/a.png" | {"type":"video","src":"..."} | null,
      "iconSize": "large"|"medium"|"small",   // 缺省 medium
      "icons": [
        {
          "label": "...",
          "icon_png": "<base64>",   // 可选；缺省用 glyph+color 兜底
          "glyph": "🌐", "color": "#3b82f6",
          "action": "...",          // 无 launch 时 toast 文案
          "launch": {"target":"...","args":"...","workdir":"..."},  // 可选
          "x": 0, "y": 2            // 稀疏网格；旧数据自动补齐
        }
      ]
    }
  ],
  "transition": "slide"|{"type":"video","src":"..."},   // 房间默认，缺省 slide
  "transitions": {"from>to": <同 transition 值>}         // 可选边级覆盖
  // "__source": 运行时保留字段，勿写
}
```

## 七、待实现（另立 phase）

- [ ] 渲染器 switchDesk 接入边级查找
- [ ] 配置器转场 UI 从单选升级为「默认 + 边级列表」（或矩阵视图，做法后议）
- [ ] transitionText 清理 + text 预设固定模板
