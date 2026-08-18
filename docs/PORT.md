# 与 NINGLET-dsh 版的差异

Claude Code 版从 dsh 版移植，书库状态完全互通。以下为行为差异。

| 方面 | dsh 版 | Claude Code 版 |
|---|---|---|
| 写章 | 工具内调 LLM（llm.stream） | Claude 原生写，longform-writing 技能编排 |
| 苏格拉底规划 | userQuestions 插件追问 | Claude 对话式追问 |
| 扫描→修订 | 工具内自动重写 1 次，有 hits 也如实落盘（status=revised） | novel_scan_chapter 干跑 + Claude 修订 + settle 严格拒绝（status 恒为 approved） |
| 章节面板 | 右下角 Client 插件（结构树+画布） | 按需生成 HTML 报告（novels/<bookId>/report.html） |
| 观察者 | 工具内 LLM 调用 | skill 流程内联执行 |
| 安装 | 复制 skills + cordis 动态插件 | 复制 skills + claude mcp add 一条命令 |

**保持一致**：state.json schema、novels/<bookId>/ 路径布局、bookId 算法（slugify + FNV-1a hash6）、反 AI 味引擎阈值（deThreshold 0.05 / varThreshold 20 / 禁用词表）、错误消息文案。

## 已知限制（v1）

- 改写已落盘章节：直接覆盖 chapters/NNN.md 正文后，state.json 中该章的 wordCount/aiTasteScore 不会自动更新（需手动修正或等待后续版本提供重结算工具）。
- 多本书并行写作：一本书一个会话是 v1 假设；书库状态本身支持多书共存。
- 报告为静态快照：写新章后需重新 novel_generate_report 刷新。
