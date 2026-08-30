# OPS-003 开发优先级与 dev_docs 记录指南验收

- 状态：待验收
- 分支：`docs/ops-003-devdocs-priority-reset`
- 提交：待提交
- 目标：把新的开发顺序和 dev_docs 日常记录方法写成唯一、易执行的当前口径。
- 范围外：不修改代码、Schema、Room 文件；不继续开发或合并 DXT-002；不触碰 DOCK-004。

## 自动检查

- [x] `ROADMAP.md` 只有一个“下一项”，且为 CORE-002。
- [x] DXT-002 明确保持待验收并暂缓，不被误写为已完成或已合并。
- [x] README 能说明想法、开工、开发中、踩坑、待验收和合并后分别写到哪里。
- [x] PROJECT 记录 Dext 与原版 Lively 的运行身份隔离决定，并区分“已决定”和“尚未实现”。
- [x] `git diff --check` 通过，Git 变更只包含本工作包具名 dev_docs 文件。

## 人工验收

1. [ ] 打开 `dev_docs/README.md` 的“怎样记录一次开发”，确认不需要阅读全部历史就知道该写哪个文件。
2. [ ] 复制 README 提供的开工提示词，确认它足以约束后续开发先建工作包、TODO 和验收卡，验收前不合并。
3. [ ] 打开 `dev_docs/ROADMAP.md`，确认当前先做 Dext Core 身份隔离，idle 暂缓，之后才补 Room 编辑与 zip 导入导出闭环。
4. [ ] 打开 `dev_docs/PROJECT.md`，确认 Dext 使用自有 Core，不能与另装的原版 Lively 共用实例、管道和数据目录。

## 通过标准

- 四项人工验收均符合预期。
- 文档中的当前状态和推荐顺序没有互相矛盾。
- 用户明确回复“通过”前不合并 master。

## 验收记录

- 待用户确认。
