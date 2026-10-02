# Room v3 作品契约（apiVersion 1）

> 2026-10-02 V3-P3-001：正式原生作品数据定义，运行/编辑入口按后续包接入；契约校验通过不等于功能已全部实现。当前证据与缺项见V3_DELIVERY.md。

## 作品与个人数据

唯一作者清单为`room.json`：`version:3`、`apiVersion:1`、非零UUID `id`、`name`、稳定ID `startDesk`、`desks`和完整`resources`清单。Desk必须有稳定`id`、`name`、`icons`和组件ID引用`components`。排序与改名不更换ID。本机另存及每次导入分享包生成新Room UUID，Desk/按钮/组件ID在各副本内部保持关联。

作者图标只声明ID、buttonId、格位、公开名称/字形。按钮有ID、名称、作用域`room`或Desk ID，可选默认通用动作。`binding.launch`只表示入口语义，不带程序、参数、工作目录、绑定目标或路径。个人绑定、授权、皮肤、实际布局覆盖和组件存储由Core持有，按Room副本ID分开，不写回共享作品。删除副本清理其专属个人数据，不删除全局应用目标。

## 画面与组件

`roomScene`可选，`entry`指向持续运行的本地HTML；无此字段时官方模板直接渲染Desk背景。`background`、可选`start`和`idle`采用`{type,src}`，支持image/video/gif/html。默认`transition`为slide/fade/none，时长0..10000毫秒；author要求共享Room场景，完成与超时仲裁仍由Core决定。

组件在顶层声明`id/role/entry/placement/capabilities`，role为widget或dock；可公开config和buttonIds。placement使用1920×1080设计画布。Desk按ID选择组件；componentOverrides只保存该Desk更改的公开配置字段，其他字段继承共享值。原生Dock引用`dockComponentId`，Windows显示模式是独立本机偏好。

## 声明与授权

允许声明的API词汇为desk.read、desk.navigate、time.read、hardware.read、media.read/control、audio.read/control、storage.read/write、binding.launch、dext.exit。声明不自动获得权限；运行时必须报告当前支持和授权状态。作者API及各能力的生产行为在后续包实现，不允许直接原生Core调用或接触官方DOM。

按钮默认动作仅为desk.next/previous/go、binding.launch、dext.exit。desk.go必须引用已有Desk，其余动作不带deskId。dext.exit必须由Dext宿主显示确认；本机目标启动须宿主核验真实输入，作者自报isTrusted无效。

## 资源和安装

resources列出全部作者文件，入口/媒体必须在清单内。使用`/`相对路径，拒绝空段、`.`/`..`、绝对/URL/反斜杠/Windows设备名/ADS及URL歧义字符；同一清单拒绝大小写碰撞。只允许HTML/CSS/JS/JSON、媒体、图片与字体，不允许作者exe/native库。运行时网络、导航、弹窗和下载仍按宿主隔离，资源扫描不能代替运行时安全。

宿主安装快照为`installation.json`，独立formatVersion=1，记录Room ID、原生清单字节SHA256及每个资源的规范相对路径/SHA256/字节数。先检查源并构建同卷暂存安装，复核后替换；失败保留旧安装。Core独立重读全部已安装字节，匹配快照后才授予绑定的Player。个人布局不会改写此快照。

Windows发布使用已验证目录句柄完成改名，资源读取和暂存写入保留祖先句柄；遇到后来出现的非本包目标不会覆盖。前代安装保留在`.dext-previous-*`，失败暂存保留在`.dext-install-*`，避免对失去所有权的路径递归删除。发布收口必须增加有界、核验身份的遗留恢复与清理，当前不保证掉电事务恢复或自动空间回收。

限制：清单1MiB、64Desk、1024按钮、128组件、每Desk512图标/32组件，4096资源。Schema只做形状与值范围校验；Rust与Core另查引用、身份、路径/链接、完整资源摘要及实际安装。

## 样包与检查

- `rooms/v3-basic`：无共享HTML的简单Room，有待绑定应用入口。
- `rooms/v3-continuous`：同一共享场景跨两个Desk，实例ID可观察；SDK调用需后续正式宿主接入。
- `cargo test --manifest-path tests/room-v3-contract/Cargo.toml`：独立测试实际生产契约模块，不依赖Tauri或改桌面。
