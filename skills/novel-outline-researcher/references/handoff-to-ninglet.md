# 与 NINGLET 书库的交接指引

本 Skill 输出不直接写入书库状态文件，经 `novel_update_memory` 工具落盘。

## 开题输出 → outline / characters

1. 用户确认开题报告后，把「分幕式总体大纲」整理成 outline 数组（每项 `{index, title}`，title 含一句话摘要）。
2. 调用 `novel_update_memory` 工具，参数 `bookId` + `outline`。
3. 人物草图整理成 characters 数组（`{name, role, desc}`），同一次或另行调用落盘。

## 续写输出 → 后续章节写作

1. 章节方案用于指导写章；写章遵循 longform-writing 技能流程（scan → settle）。
2. 若续写报告建议调整大纲，重新调用 `novel_update_memory` 更新 outline。

## 改写输出 → 执行改写与回归

1. 改写某章：按方案重写正文后直接覆盖 `novels/<bookId>/chapters/NNN.md`，并调用 `novel_update_memory` 同步受影响的人设/伏笔/大纲（如需）。
2. 改写后建议跑 novel-qa 技能做人设/时间线/伏笔一致性检查。

## 文件位置速查

- 书库：`novels/<bookId>/`
- 权威状态：`story/state/state.json`（只能由 novel_* 工具写入）
- 正文：`chapters/NNN.md`（NNN 三位补零）
- 章节意图：`story/runtime/chapter-NNN.intent.md`
- HTML 报告：`report.html`
- 调研报告：`reports/`
