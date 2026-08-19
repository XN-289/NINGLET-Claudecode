<div align="center">

<img src="assets/logo.svg" width="112" height="112" alt="NINGLET Logo">

# NINGLET for Claude Code

**让 AI 写小说，但读者闻不出 AI 味。**

跑在 Claude Code 上的小说创作工具集 —— 专门写小说，也专门把「AI 味」挡在正文之外。

[是什么](#是什么) · [安装](#安装) · [特性](#特性) · [技能](#技能) · [工具](#工具) · [架构](#架构) · [项目结构](#项目结构) · [借鉴与致谢](#借鉴与致谢)

<sub>Claude Code 版 · 与 [NINGLET-dsh](https://github.com/XN-289/dsh-NINGLET-novel-Agent) 书库状态完全互通</sub>

**安装**：克隆本仓库，`claude mcp add` 一条命令注册零依赖 MCP server，再把 `skills/` 下 5 个技能复制到 `~/.claude/skills/`——详见[安装](#安装)。

</div>

---

## 是什么

NINGLET 是小说创作工具集。它不是「输入大纲、吐正文」的黑盒，而是一条可控的生产线：

> 建书 → 写章（规划 → 编排 → 写作 → 反 AI 味审计 → 修订 → 结算）→ 落盘 → HTML 报告回看。

它由两部分组成：**Skills**（5 个写作技能，Claude 按技能编排写章流程）、**MCP Server**（零依赖 Node，8 个确定性工具：反AI味扫描、状态校验、落盘、报告）。

**关键区别**：dsh 版在插件内部调 LLM 写章；Claude Code 版由 Claude 自己写章——它读着 skill 直接写，工具只做机器做得比人可靠的活：扫描、校验、落盘。**工具从「流水线控制器」退化为「状态机 + 校验器」。**

## 特性

- **反 AI 味引擎**：确定性检测（禁用词、`的`字密度、句长方差）+ 生成时注入规则 + 结算严格模式——扫描 0 命中才落盘。
- **苏格拉底规划（give me）**：写章前若没给意图，先追问你「核心推进 / 主角状态 / 结尾钩子」三问，把本章意图落成 `story/runtime/chapter-NNN.intent.md` 再动笔。
- **章回大纲**：建书后由大纲调研技能先读、先问、再给，生成 8-12 章大纲，经工具落盘。
- **结构化记忆**：每章写完后由「观察者」抽取角色、伏笔，并生成结构化摘要（事件/角色变化/伏笔/结尾），替代粗暴截断。
- **HTML 报告**：按需生成自包含单文件报告——结构视图（大纲 / 章节 / 角色 / 伏笔）+ 章节点击阅读，一眼看懂整本书。
- **结构化状态**：每本书的状态是校验后的 JSON（`story/state/state.json`），正文是 Markdown（`chapters/NNN.md`）；坏数据拒绝写入，不滚雪球。
- **安静编辑部设计**：纸墨设计系统，连报告 UI 都去 AI 味——无渐变、无 emoji 图标、无投影堆砌。

## 安装

克隆本仓库，三步装进你的 Claude Code：

```bash
git clone git@github.com:XN-289/NINGLET-Claudecode.git
```

**1. 注册 MCP server**（零依赖，无需 npm install）：

```bash
claude mcp add ninglet -- node "<本仓库绝对路径>/server/index.js"
```

> 想让所有项目可用：加 `--scope user`。如果书库根目录探测不到你的工作区（书总是写到别处），显式指定：`claude mcp add ninglet --env NINGLET_ROOT=<工作区路径> -- node ...`

**2. 复制技能**：

```bash
# Unix
cp -r NINGLET-Claudecode/skills/* ~/.claude/skills/
# Windows (PowerShell)
Copy-Item -Recurse NINGLET-Claudecode\skills\* $HOME\.claude\skills\
```

**3. 冒烟测试**（可选但推荐）：

```bash
node scripts/smoke-test.mjs   # 输出 SMOKE PASS 即环境 OK
```

## 快速开始

在装好 server + skills 的 Claude Code 会话里说：

> 「创建一本都市修仙小说《吞天魔帝》」
> 「写下一章，重点写师徒矛盾」
> 「生成这本书的报告」

状态落盘在**会话工作区**的 `novels/<bookId>/` 下：`story/state/state.json`（权威状态）+ `chapters/NNN.md`（正文）。

## 技能

NINGLET 把「写小说」拆成 5 个可被 Claude Code 直接调用的技能：

| 技能 | 作用 |
|---|---|
| `anti-ai-flavor` | 反 AI 味规则：80+ 禁用词、量化指标、Show-Don't-Tell |
| `longform-writing` | 长篇章节生产流水线 + 钩子 / 节奏 / 水章诊断 |
| `novel-qa` | 10 维一致性审查 + AI 味评分（0-100）|
| `novel-outline-researcher` | 大纲调研：先读、先问、再给 |
| `novel-style-reference` | 叙事风格库：学习 / 引用 |

## 工具

8 个确定性 MCP 工具——全部无 LLM 调用：

| 工具 | 作用 |
|---|---|
| `novel_create_book` | 建书：bookId + state 初始化 |
| `novel_scan_chapter` | 反 AI 味扫描（干跑，不落盘） |
| `novel_settle_chapter` | 章节结算（严格：0 hits 落盘 + 状态推进 + 记忆合并） |
| `novel_update_memory` | 记忆更新：角色 / 伏笔 / 摘要 / 大纲 |
| `novel_list_books` / `novel_list_chapters` | 书目 / 章节列表 |
| `novel_read_chapter` | 读章节正文 |
| `novel_generate_report` | HTML 报告（结构视图 + 章节阅读） |

## 架构

```
┌──────────────────────────────────────────────┐
│  Skills（5 个 SKILL.md）                      │  ← 写作工艺：Claude 按技能编排写章
│  anti-ai-flavor / longform-writing / QA …    │
├──────────────────────────────────────────────┤
│  MCP Server（零依赖 Node）                    │  ← 确定性引擎：扫描 / 校验 / 落盘
│  create / scan / settle / memory / report    │
│  engine/（与 dsh src 逐字节一致）             │
├──────────────────────────────────────────────┤
│  书库 novels/<bookId>/                        │  ← 权威状态 + 正文 + 报告
│  story/state/state.json · chapters/NNN.md    │
└──────────────────────────────────────────────┘
```

## 项目结构

```
NINGLET-Claudecode/
├── skills/            # 5 个 Claude Code 技能
├── server/            # 零依赖 MCP server
│   ├── index.js       # MCP stdio 协议壳 + 工具注册
│   ├── books.js       # 书库 fs 访问层
│   ├── tools/         # 8 个工具（每工具一文件）
│   ├── engine/        # 纯函数核心（与 dsh src 逐字节一致）
│   └── report.js      # HTML 报告生成
├── scripts/           # 冒烟测试 + 互通向量生成
├── tests/             # node --test（133 项：单测 + 集成 + 互通契约）
├── docs/              # 设计文档 / 实施计划 / 与 dsh 差异
└── assets/            # logo
```

## 与 dsh 版互通

state.json schema、章节路径、bookId 算法、反 AI 味引擎阈值与 NINGLET-dsh 完全一致——同一本书可以在 dsh 和 Claude Code 之间切换着写。行为差异详见 [docs/PORT.md](docs/PORT.md)。

## 故障排查

- **Claude 说「找不到 novel_* 工具」**：MCP server 未注册或未重启会话。跑 `claude mcp list` 确认 ninglet 在列，然后重启 Claude Code 会话。
- **书总写到别处**：用 `--env NINGLET_ROOT=<工作区路径>` 重新注册（见安装第 1 步）。
- **结算被拒绝**：正文命中反 AI 味扫描（禁用词/的密度/句长方差）。按错误消息里的命中清单修订后重试——这是严格模式在工作，不是 bug。
- **状态文件损坏**：按报错路径手动修复 `novels/<bookId>/story/state/state.json`（合法 JSON 即可）。

## 测试

```bash
node --test tests/*.test.js   # 133 项：单测 + 集成 + 互通契约，全绿
```

## 借鉴与致谢

- [NINGLET-dsh](https://github.com/XN-289/dsh-NINGLET-novel-Agent) —— 本项目的上游：书库状态互通、引擎逐字节一致
- [inkos](https://github.com/Narcooo/inkos) —— 架构参考：三层记忆、状态结算、输入治理、流水线阶段
- [ConardLi/garden-skills](https://github.com/ConardLi/garden-skills) —— 前端设计方法论（`web-design-engineer`）
- kealin-AI-novels —— 反 AI 味引擎移植蓝本

## License

MIT
