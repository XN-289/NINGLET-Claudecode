<div align="center">

# NINGLET for Claude Code

**让 AI 写小说，但读者闻不出 AI 味。**

跑在 Claude Code 上的小说创作工具集 —— 专门写小说，也专门把「AI 味」挡在正文之外。

[安装](#安装) · [快速开始](#快速开始) · [技能](#技能) · [工具](#工具) · [书库结构](#书库结构) · [与 dsh 版互通](#与-dsh-版互通) · [故障排查](#故障排查)

<sub>Claude Code 版 · 与 [NINGLET-dsh](https://github.com/XN-289/dsh-NINGLET-novel-Agent.git) 书库状态完全互通</sub>

</div>

---

## 是什么

NINGLET 是小说创作工具集。它不是「输入大纲、吐正文」的黑盒，而是一条可控的生产线：

> 建书 → 写章（规划 → 编排 → 写作 → 反 AI 味审计 → 修订 → 结算）→ 落盘 → HTML 报告回看。

它由两部分组成：**Skills**（5 个写作技能，Claude 按技能编排写章流程）、**MCP Server**（零依赖 Node，8 个确定性工具：反AI味扫描、状态校验、落盘、报告）。

**关键区别**：dsh 版在插件内部调 LLM 写章；Claude Code 版由 Claude 自己写章（它读着 skill 直接写），工具只做机器做得比人可靠的活——扫描、校验、落盘。结算严格模式：**反 AI 味扫描 0 命中才落盘**。

## 安装

克隆本仓库，三步装进你的 Claude Code：

```bash
git clone <仓库地址> && cd NINGLET-Claudecode   # 本地使用可跳过克隆；发布 GitHub 后替换 <仓库地址>
```

**1. 注册 MCP server**（零依赖，无需 npm install）：

```bash
claude mcp add ninglet -- node "<本仓库绝对路径>/server/index.js"
```

> 想让所有项目可用：加 `--scope user`。如果书库根目录探测不到你的工作区（书总是写到别处），显式指定：`claude mcp add ninglet --env NINGLET_ROOT=<工作区路径> -- node ...`

**2. 复制技能**：

```bash
# Unix
cp -r skills/* ~/.claude/skills/
# Windows (PowerShell)
Copy-Item -Recurse skills\* $HOME\.claude\skills\
```

**3. 冒烟测试**（可选但推荐）：

```bash
node scripts/smoke-test.mjs
# 输出 SMOKE PASS 即环境 OK
```

## 快速开始

在装了 server + skills 的 Claude Code 会话里说：

> 「创建一本都市修仙小说《吞天魔帝》」
> 「写下一章，重点写师徒矛盾」
> 「生成这本书的报告」

状态落盘在**会话工作区**的 `novels/<bookId>/` 下：`story/state/state.json`（权威状态）+ `chapters/NNN.md`（正文）。

## 技能

| 技能 | 作用 |
|---|---|
| `anti-ai-flavor` | 反 AI 味规则：80+ 禁用词、量化指标、Show-Don't-Tell |
| `longform-writing` | 长篇章节生产流水线（规划→写作→扫描→修订→结算）+ 钩子 / 节奏 / 水章诊断 |
| `novel-qa` | 10 维一致性审查 + AI 味评分（0-100）|
| `novel-outline-researcher` | 大纲调研：先读、先问、再给 |
| `novel-style-reference` | 叙事风格库：学习 / 引用 |

## 工具（MCP，8 个确定性工具）

| 工具 | 作用 |
|---|---|
| `novel_create_book` | 建书：bookId + state 初始化 |
| `novel_scan_chapter` | 反 AI 味扫描（干跑，不落盘） |
| `novel_settle_chapter` | 章节结算（严格：0 hits 落盘 + 状态推进 + 记忆合并） |
| `novel_update_memory` | 记忆更新：角色 / 伏笔 / 摘要 / 大纲 |
| `novel_list_books` / `novel_list_chapters` | 书目 / 章节列表 |
| `novel_read_chapter` | 读章节正文 |
| `novel_generate_report` | HTML 报告（结构树 + 章节阅读） |

## 书库结构

```
novels/
└── <bookId>/
    ├── story/
    │   ├── state/state.json          # 权威状态（校验后才写入）
    │   └── runtime/chapter-NNN.intent.md   # 各章写作意图
    ├── chapters/NNN.md               # 正文
    ├── reports/                      # 调研报告
    └── report.html                   # 阅读报告
```

## 与 dsh 版互通

state.json schema、章节路径、bookId 算法与 NINGLET-dsh 完全一致——同一本书可以在 dsh 和 Claude Code 之间切换着写。差异详见 [docs/PORT.md](docs/PORT.md)。

## 故障排查

- **Claude 说「找不到 novel_* 工具」**：MCP server 未注册或未重启会话。跑 `claude mcp list` 确认 ninglet 在列，然后重启 Claude Code 会话。
- **书总写到别处**：用 `--env NINGLET_ROOT=<工作区路径>` 重新注册（见安装第 1 步）。
- **结算被拒绝**：正文命中反 AI 味扫描（禁用词/的密度/句长方差）。按错误消息里的命中清单修订后重试——这是严格模式在工作，不是 bug。
- **状态文件损坏**：按报错路径手动修复 `novels/<bookId>/story/state/state.json`（合法 JSON 即可）。

## 测试

```bash
node --test tests/*.test.js   # 单测 + 集成 + parity，全绿
```

## License

MIT
