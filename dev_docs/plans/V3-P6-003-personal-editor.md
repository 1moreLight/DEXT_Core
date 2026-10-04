# V3-P6-003 实施计划
执行superpowers:executing-plans；设计见同目录personal-editor-design。独立worktree/分支，以未合并P6-002 6c32e66为依赖；按连续授权推进，本地功能优先，不创建子代理。完整16项1/16≈6%，最终集中前不合并master。

## Task1 Core本机编辑与接线
文件：RoomActionAuthority.PersonalEditor.cs、RoomSessionRuntimeCoordinator.PersonalEditor.cs及接口；RoomPersonalStore重用目标验证；WinDesktopCoreServer与两份wallpaper.proto；grpc.rs/lib.rs；tests/Dext.RoomActions.Tests/RoomPersonalEditorChecks.cs。
- [x] 写当前声明全按钮/未绑定发现、两个入口共用目标、覆盖/重置与皮肤重读、全局目标更新/删除引用、旧授权不提升/无关保持、发布失败原字节、无变化不发布等必要本地检查，限定--personal-editor跑行为RED。
- [x] 实现当前Coordinator读取/原子编辑，闭合操作，不对作者开放私人目标；旧控制/读数授权与布局/KV保持。
- [x] 接proto/Tauri命令、必要Core回归/四阶段build→start，具名阶段提交；不扩大网络专项。

## Task2 统一按钮和普通呈现UI
文件：V3PersonalEditor.tsx、personal-editor.ts与测试；V3RoomEditor.tsx；实际浏览器功能探针。
- [x] 已声明按钮全列表、Room/Desk搜索和来源定位；未安装草稿提示保存应用，私人编辑不改作者草稿/已保存状态。
- [ ] 动作/已有应用库及手动application/file/url目标、目标更新/删除确认、继承作者重置；个人编辑失败/旧副本确认状态保持。
- [x] 普通图标引用已有按钮、独立显示身份、增删与撤销重做/作用域/其他引用保持；皮肤选择只写Core。
- [ ] 浏览器行为/模型及npm build/cargo check；Mock明确，实际文件/动作不代填。

## Task3 正式宿主呈现
文件：Core安全官方皮肤投影/Player桥、wallpapers/dext-room-v3/dom-host/native-host/style与必要IPC接线。
- [x] 官方普通图标持续读取当前私人皮肤，修改不重建共享iframe/不泄给作者；逻辑尺寸和当前几何保持。
- [ ] 配置器短时定位当前可见按钮；无动作/输入证明，非当前Desk有明确反馈。
- [ ] 必要功能RED/GREEN、实际ReleasePlayer及完整build→start；物理输入保留集中。

## Task4 实际集成
- [ ] 真实配置器同目标绑定作者按钮/普通图标、修改动作仅本机覆盖，皮肤保存/重启/改名排序保持。
- [ ] 删除呈现保其他引用/目标；重置恢复作者默认；缺/失效目标与保存失败反馈清楚，原文保持。
- [ ] 当前私有源/用户四文件/localStorage保护、正常关窗/Core退出、自有资源清理/进程监听0，具名提交。
- [ ] 集中本包人工六项/P5七项及一次整体审查。实际Core OS/物理DPI/锁屏等未证明就保持；拖动后置。

游戏期间约束：已正常退出Dext并精确恢复用户状态；最后sourcePath/视觉定位修复仅做轻量核对，结束游戏后继续实际定位/普通重启/剩余UI。不启动窗口、编译或桌面输入。整体仍1/16≈6%。

Task2补充选择保持（2026-10-04）：目标库写入/视觉定位保持按钮草稿，成功目标删除只清对应引用；自身setButton失败恢复原确认，resetButton失败保持草稿。已接闭合操作类型/生产更新函数和有效动作徽标；Node原生执行四项功能RED→GREEN，不跑编译器/浏览器。完整打包与实际第1/5项继续游戏后核对。

Task2目标删除收尾：明确删除当前正在编辑的目标，Core确认后关闭同ID旧表单，避免随后保存重新创建；失败保留字段和稳定ID。生产TS直接Node5/6→6/6，实际UI/打包仍待游戏结束（ERRORS #234）。
