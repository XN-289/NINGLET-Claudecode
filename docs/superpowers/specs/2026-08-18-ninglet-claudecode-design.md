# NINGLET for Claude Code —— 设计文档

- 日期：2026-08-18
- 状态：已与用户确认
- 上游：NINGLET-dsh（`D:\github项目\AI小说\NINGLET-dsh`，DeepSeek Harness 小说创作插件）

## 一、目标

把 NINGLET-dsh 适配到 Claude Code 框架，做成一个**公开发布**给他人使用的小说创作工具集。核心承诺不变：

> 建书 → 写章（规划 → 编排 → 写作 → 反 AI 味审计 → 修订 → 结算）→ 落盘 → 报告回看。让 AI 写小说，但读者闻不出 AI 味。

## 二、已确认的需求决策

| 决策点 | 结论 |
|---|---|
| 使用场景 | 发布给他人用（GitHub 仓库 + README 安装说明，安装步骤少） |
| 功能范围 | 全量对等：5 技能 + 建书/写章流水线 + 状态落盘 + 章节面板 |
| 章节面板形态 | 按需生成自包含 HTML 报告（无后台进程，浏览器打开即看） |
| 状态互通 | 与 dsh 版互通：state.json schema、`chapters/NNN.md` 路径、bookId 算法完全一致 |
| 扫描严格度 | **严格**：`novel_settle_chapter` 终审时反 AI 味扫描必须 0 hits，否则拒绝落盘并返回 hits 列表 |
| 报告位置 | `novels/<bookId>/report.html`（跟着书走） |

## 三、形态决策：插件 / skill / Agent 的分工

dsh 版把一切塞进动态插件。Claude Code 版按框架能力分层，各归其位：

| 层 | 载体 | 内容 |
|---|---|---|
| 确定性引擎 | **MCP Server**（零依赖 Node，stdio 协议） | 反AI味扫描、状态校验、bookId、字数、HTML 报告 |
| 写作工艺 | **Skills**（5 个，`~/.claude/skills/`） | 反AI味规则、长文生产流程、QA 审查、大纲调研、风格库 |
| 观察者角色 | 内联在 longform-writing skill 流程中 | 每章写完后的角色/伏笔/摘要抽取（不设独立 subagent，少一个安装步骤） |

**关键架构变化**：dsh 的 `novel_write_chapter` 工具在内部调用 LLM 写章（llm.stream）。Claude Code 里 Claude 本身就是 LLM——写章由 Claude 按 skill 原生执行，工具只做"机器做得比人可靠"的活：扫描、校验、落盘、状态推进。**工具从「流水线控制器」退化为「状态机 + 校验器」**。因此 MCP 工具全部是确定性的、无 LLM 调用的。

不用 `preset/`（DSH 预设组合）、`harness-packages/`（DSH 源码树固化）、subagent 文件。YAGNI。

## 四、仓库结构

```
NINGLET-Claudecode/
├── README.md            # 安装 + 快速开始 + 故障排查
├── skills/              # 5 个 Claude Code skill（从 dsh 移植改写）
│   ├── anti-ai-flavor/SKILL.md
│   ├── longform-writing/SKILL.md
│   ├── novel-qa/SKILL.md
│   ├── novel-outline-researcher/SKILL.md
│   └── novel-style-reference/SKILL.md
├── server/              # 零依赖 MCP server
│   ├── index.js         # MCP stdio 协议壳（JSON-RPC over stdin/stdout，自实现）
│   ├── tools.js         # 8 个工具的实现
│   ├── engine/          # 纯函数核心：从 dsh src/ 原样复制（互通的基础）
│   │   ├── anti-ai-engine.js
│   │   ├── book-id.js
│   │   ├── state-reducer.js
│   │   ├── state-schema.js
│   │   └── word-count.js
│   └── report.js        # HTML 报告生成
├── tests/               # node --test
│   ├── *.test.js        # 引擎单测（dsh 的 34 个为基线）
│   ├── tools.test.js    # 工具集成测试（临时目录全流程）
│   ├── parity.test.js   # 与 dsh 版的互通契约（测试向量）
│   └── vectors/         # 互通测试向量（JSON，两仓库共用）
├── scripts/
│   ├── smoke-test.mjs       # MCP 握手 + 建书写章一轮冒烟测试
│   └── gen-vectors.mjs      # 从引擎生成互通测试向量
├── docs/                # 设计文档 + 与 dsh 版差异说明
└── package.json         # type: module，仅 test script，零运行时依赖
```

### 引擎代码的同步策略

`server/engine/` 从 dsh `src/` 复制（不 symlink，保证发布自包含）。防漂移手段：`tests/vectors/` 存放互通测试向量（bookId、detectAI、validateState 的输入→输出快照），两个仓库各自跑同一份向量。向量由 `scripts/gen-vectors.mjs` 从任一仓库的引擎生成。

## 五、MCP 工具契约（8 个确定性工具）

所有工具错误经 MCP error 返回，错误语义照搬 dsh（见 §七）。书库根目录解析：`NINGLET_ROOT` 环境变量 → `process.cwd()` 兜底。

### 1. novel_create_book
- 参数：`title`（必填，≤50 字）、`genre?`、`brief?`
- 行为：`makeBookId(title)`（与 dsh 同算法）→ 已存在则拒绝覆盖 → 初始化 state.json（`targetChapters=50, chapterWords=2000, nextChapterIndex=1`，brief 存入 state）
- **不生成大纲**：dsh 在工具内调 LLM 生成大纲；Claude Code 版由 Claude 按 outline-researcher / longform-writing skill 生成后，经 `novel_update_memory` 落盘 outline
- 返回：bookId + 状态文件路径

### 2. novel_scan_chapter（干跑审计，不落盘）
- 参数：`body`（正文全文）
- 行为：`detectAI(body)` → 返回 `{ score, hits: [{rule, detail, severity}] }`
- 用途：Claude 写完后先扫，有 hits 就按规则修订，干净了再 settle

### 3. novel_settle_chapter（终审结算，一次调用完成）
- 参数：`bookId`（必填）、`body`（必填）、`title?`、`summary?`、`characters?[]`、`hooks?[]`
- 行为（全原子，任何一步失败则不写任何文件）：
  1. 校验 bookId（防路径穿越）
  2. 读 state.json（损坏则报错指引修复）
  3. `detectAI(body)` → **hits 非空则拒绝落盘**，错误信息含完整 hits 列表与修订指引
  4. `countWords(body)` → wordCount
  5. 写 `chapters/NNN.md`（`index = state.book.nextChapterIndex`，文件名三位补零）
  6. 合并 `summary`/`characters`/`hooks`（合并规则与 dsh 一致：角色按名去重、伏笔按名更新状态）
  7. `applyChapterDelta(state, chapter)` → 校验产物 → 写 state.json
- 意图文件不由 settle 管：Claude 在 compose 步骤直接用 Write 工具落盘 `story/runtime/chapter-NNN.intent.md`（非权威状态，是辅助输入）
- 严格扫描下，Claude Code 流程产出的章节 status 恒为 `approved`（schema 保留 `revised` 以兼容 dsh 侧已有数据）
- 返回：`{ index, wordCount, aiTasteScore, hits: [], path }`

### 4. novel_update_memory
- 参数：`bookId`（必填）、`summary?`、`characters?[]`、`hooks?[]`、`outline?[]`
- 行为：独立更新记忆——角色按名去重合并、伏笔按名更新状态（open/progressing/resolved）、outline 整体替换；校验后落盘
- 用途：观察者抽取（写章后）、大纲生成（建书后）、后文回收伏笔（写后续章节时）

### 5. novel_list_books
- 无参数。扫描 `novels/` 下所有含合法 state.json 的目录，返回 `[{bookId, title}]`

### 6. novel_list_chapters
- 参数：`bookId`。返回 `[{index, title, wordCount, score}]`（score = aiTasteScore）

### 7. novel_read_chapter
- 参数：`bookId`、`index`。返回正文全文；章节不存在返回明确提示

### 8. novel_generate_report
- 参数：`bookId`
- 行为：读 state.json + 各章正文，生成**自包含单文件 HTML**（数据内嵌 JSON、零外链、vanilla JS），写入 `novels/<bookId>/report.html`（覆盖旧报告）
- 内容：结构视图（大纲/章节列表带字数与 AI 味评分/角色/伏笔状态）+ 点击章节切换阅读视图
- 视觉：沿用 dsh 版「纸墨」设计系统（`#F4F2EC` / `#2A2A28` / `#D9D6CD`，无渐变、无 emoji 图标、无投影堆砌）——UI 也去 AI 味

## 六、写章数据流（skill 编排，Claude 执行）

longform-writing skill 的六阶段工作流在 Claude Code 里的落地：

```
用户：「写下一章，重点写师徒矛盾」
1. plan   —— 苏格拉底规划：未给意图则先问三问（核心推进/主角状态/结尾钩子），
             Claude 对话式追问，天然替代 dsh 的 userQuestions
2. compose —— 意图落盘 story/runtime/chapter-NNN.intent.md；读 state.json + 前 5 章摘要（直接 Read 文件）
3. write  —— 写正文（遵循 anti-ai-flavor + novel-style-reference，CJK ≥2000 字）
4. audit  —— novel_scan_chapter(body) → score + hits
5. revise —— 有 hits 则按规则修订（重写后必须再 scan 确认）
6. settle —— novel_settle_chapter（严格扫描：0 hits 才落盘；坏数据拒绝写入，不滚雪球）
7. 观察者  —— 内联执行：抽取本章摘要/新角色/伏笔 → novel_update_memory 合并
8. 回看    —— 用户想看时 novel_generate_report → 浏览器打开
```

状态权威文件仍是 `novels/<bookId>/story/state/state.json`，正文是 Markdown。

## 七、错误处理

- 坏 bookId → `unsafe bookId`（所有涉及 bookId 的入口都校验）
- 状态文件损坏 → `状态文件损坏（非合法 JSON），请修复 novels/<bookId>/story/state/state.json`
- 状态校验失败 → `状态非法，拒绝写入：<错误列表>`
- settle 扫描未通过 → 拒绝落盘，返回 hits 列表 + 修订指引
- 书/章节不存在 → 明确提示，不静默返回空

## 八、测试

1. **引擎单测**：dsh 的 34 个测试为基线移植（anti-ai-engine / book-id / state-reducer / state-schema / word-count）
2. **工具集成测试**：临时目录（`NINGLET_ROOT` 指向）跑 create → settle → update_memory → report 全流程，含错误路径（坏 bookId、损坏 state、hits 拒绝落盘）
3. **互通契约（parity）**：`tests/vectors/` 测试向量驱动引擎断言，两仓库共用，防复制漂移
4. **冒烟测试**：`scripts/smoke-test.mjs` 模拟 MCP initialize + tools/list + 一轮建书写章，用户装完跑一遍即知环境 OK

## 九、安装体验（README 主线）

```bash
# 1. 克隆（仓库地址发布时替换 <repo>）
git clone <repo> && cd NINGLET-Claudecode

# 2. 注册 MCP server（零 npm install，直接 node 跑）
claude mcp add ninglet -- node "<绝对路径>/server/index.js"

# 3. 复制技能（Windows PowerShell）
Copy-Item -Recurse skills\* $HOME\.claude\skills\

# 4. 冒烟测试
node scripts/smoke-test.mjs

# 5. 任意工作区说：创建一本都市修仙小说《吞天魔帝》
```

书籍落盘在**会话工作区**的 `novels/<bookId>/` 下。若工作区自动探测失败，用 `claude mcp add ... --env NINGLET_ROOT=<路径>` 显式指定（README 故障排查一节说明）。

## 十、与 dsh 版差异（docs/PORT.md 单独成文）

| 方面 | dsh 版 | Claude Code 版 |
|---|---|---|
| 写章 | 工具内调 LLM | Claude 原生写，skill 编排 |
| 苏格拉底规划 | userQuestions 插件 | Claude 对话式追问 |
| 扫描→修订 | 工具内自动重写 1 次，有 hits 也如实落盘（status=revised） | scan 干跑 + Claude 修订 + settle 严格拒绝（status 恒为 approved） |
| 章节面板 | 右下角 Client 插件 | 按需生成 HTML 报告 |
| 观察者 | 工具内 LLM 调用 | skill 流程内联 |
| 保持一致 | — | state schema、路径、bookId 算法、引擎阈值、错误语义 |

## 十一、范围外（明确不做）

- npm 发布（v1 走 GitHub 克隆安装）
- subagent 版观察者（未来若需要隔离上下文再加，加一个 md 文件即可）
- preset / harness-packages 的等价物
- 多书同时并行写作的会话级协调（一本书一个会话是 v1 假设）
