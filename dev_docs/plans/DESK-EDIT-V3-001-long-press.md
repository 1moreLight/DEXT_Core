# DESK-EDIT-V3-001 长按编辑迁移缺口
状态：待做
来源：2026-10-11用户指出旧版长按编辑消失。
证据：旧wallpapers/dext-room/main.js的attachPress和iconLayer长按500ms进入enterEdit；v3 dom-host无对应编辑模式，只有layoutRead/layoutSave接口。
目标：恢复用户可见的编辑入口、完成/取消与本机布局保存。
待做：确认旧版空白/图标/小组件入口；定义v3原生按住/移动取消/切页取消；编辑视图与保存失败恢复；鼠标和触控回归。
本文件不是当前开工包，当前仍DESK-SYNC-003。没有实现，不宣称长按恢复。
