# NINGLET-Claudecode 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 NINGLET-dsh（DeepSeek Harness 小说创作插件）适配为 Claude Code 版：零依赖 MCP server（确定性引擎 + 状态机）+ 5 个 Claude Code skill + HTML 报告，与 dsh 版书库状态完全互通。

**Architecture:** MCP server 只做确定性工作（反AI味扫描、状态校验、落盘、报告），写章由 Claude 按 skill 原生执行（longform-writing 编排：规划→写作→scan→修订→settle→观察者）。`server/engine/` 从 dsh `src/` 逐字节复制保证互通；`tests/vectors/` 测试向量（由 dsh 引擎生成）防漂移。设计文档：`docs/superpowers/specs/2026-08-18-ninglet-claudecode-design.md`。

**Tech Stack:** Node.js ≥18（零运行时依赖，只依赖 node: 内置模块）、node:test、MCP stdio（JSON-RPC 2.0，newline-delimited，自实现）、ESM。

## Global Constraints

- Node.js `>=18.0.0`；零运行时依赖（禁 npm install）
- ESM（`"type": "module"`）
- 引擎文件从 `D:\github项目\AI小说\NINGLET-dsh\src\` **原样复制**，不改一个字（互通契约）
- 错误消息文案与 dsh 一致：`unsafe bookId`、`状态非法，拒绝写入：`、`状态文件损坏（非合法 JSON），请修复 novels/<bookId>/story/state/state.json`、`title 不能为空`、`title 过长（≤50 字）`、`书已存在：`、`书不存在`、`章节不存在`
- 严格结算：`novel_settle_chapter` 扫描 0 hits 才落盘；hits>0 抛错且不写任何文件
- 书库根目录：`NINGLET_ROOT` 环境变量 → `process.cwd()` 兜底；书在 `novels/<bookId>/`
- state.json schema 与 dsh 完全一致（validateState 全量校验，坏数据拒绝写入）
- 报告位置：`novels/<bookId>/report.html`（覆盖旧报告）
- 纸墨设计系统 token：ground `#F4F2EC`、ink `#2A2A28`、hairline `#D9D6CD`、强调墨蓝 `#3E4C6B`、钩子红 `#C8161D`、深色 ground `#1C1B19`/正文 `#EDEBE4`/线 `#35332E`；无渐变、无 emoji、圆角 2px
- 测试命令统一 `node --test tests/*.test.js`，全部绿色才算完成
- 提交信息：中文 conventional commits（`feat:` / `test:` / `docs:`）

---

### Task 1: 仓库骨架 + 引擎移植 + 基线测试

**Files:**
- Create: `package.json`、`.gitignore`、`LICENSE`、`server/engine/anti-ai-engine.js`、`server/engine/book-id.js`、`server/engine/state-reducer.js`、`server/engine/state-schema.js`、`server/engine/word-count.js`
- Create: `tests/anti-ai-engine.test.js`、`tests/book-id.test.js`、`tests/state-reducer.test.js`、`tests/state-schema.test.js`、`tests/word-count.test.js`（从 dsh 复制后改 import 路径）
- Modify: `docs/superpowers/specs/2026-08-18-ninglet-claudecode-design.md`（目录树更新）

**Interfaces:**
- Produces: `server/engine/` 导出与 dsh src 完全一致（`detectAI`、`scanForbidden`、`deDensity`、`sentenceLengths`、`rewriteRules`、`DEFAULT_FORBIDDEN`；`slugify`、`hash6`、`makeBookId`、`isValidBookId`；`validateBook`、`validateChapter`、`validateState`、`CHAPTER_STATUSES`；`detectLanguage`、`countZhChars`、`countEnWords`、`countWords`；`applyChapterDelta`）

- [ ] **Step 1: 写 package.json**

```json
{
  "name": "ninglet-claudecode",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=18.0.0" },
  "scripts": { "test": "node --test tests/*.test.js" }
}
```

- [ ] **Step 2: 写 .gitignore 与 LICENSE**

`.gitignore`：
```
node_modules/
*.log
```

`LICENSE`（MIT，与 dsh 版一致）：
```
MIT License

Copyright (c) 2026 NINGLET contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 3: 复制引擎与测试（原样复制 + 改测试 import 路径）**

```bash
cd "D:\github项目\AI小说\NINGLET-Claudecode"
mkdir -p server/engine tests
cp ../NINGLET-dsh/src/anti-ai-engine.js server/engine/
cp ../NINGLET-dsh/src/book-id.js server/engine/
cp ../NINGLET-dsh/src/state-reducer.js server/engine/
cp ../NINGLET-dsh/src/state-schema.js server/engine/
cp ../NINGLET-dsh/src/word-count.js server/engine/
cp ../NINGLET-dsh/tests/anti-ai-engine.test.js tests/
cp ../NINGLET-dsh/tests/book-id.test.js tests/
cp ../NINGLET-dsh/tests/state-reducer.test.js tests/
cp ../NINGLET-dsh/tests/state-schema.test.js tests/
cp ../NINGLET-dsh/tests/word-count.test.js tests/
sed -i 's|\.\./src/|../server/engine/|' tests/*.test.js
```

- [ ] **Step 4: 跑基线测试，确认 27 个全绿**

Run: `node --test tests/*.test.js`
Expected: `# pass 27`（anti-ai-engine 9 + book-id 4 + state-reducer 3 + state-schema 7 + word-count 4），`# fail 0`

- [ ] **Step 5: 更新设计文档目录树（tools.js 拆成 tools/ + books.js）**

Edit `docs/superpowers/specs/2026-08-18-ninglet-claudecode-design.md`：
- old: `│   ├── index.js         # MCP stdio 协议壳（JSON-RPC over stdin/stdout，自实现）\n│   ├── tools.js         # 8 个工具的实现`
- new: `│   ├── index.js         # MCP stdio 协议壳（JSON-RPC over stdin/stdout，自实现）+ 工具注册\n│   ├── books.js         # 书库 fs 访问层（根解析/状态读写/章节读写/书目）\n│   ├── tools/           # 8 个工具的实现（每工具一文件）`

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: 仓库骨架 + 引擎移植（dsh src 原样复制）+ 27 个基线测试"
```

---

### Task 2: 互通测试向量 + parity 测试

**Files:**
- Create: `scripts/gen-vectors.mjs`、`tests/vectors/engine.json`（生成）、`tests/parity.test.js`

**Interfaces:**
- Consumes: Task 1 的 `server/engine/`（导出名见 Task 1）
- Produces: `tests/vectors/engine.json`（{source, generatedAt, cases:[{fn, args, output}]}）；`scripts/gen-vectors.mjs` 用法 `node scripts/gen-vectors.mjs [dsh-src-路径]`

- [ ] **Step 1: 写 gen-vectors.mjs**

```js
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const dshSrc = resolve(process.argv[2] || '../NINGLET-dsh/src');
const antiAi = await import(join(dshSrc, 'anti-ai-engine.js'));
const bookId = await import(join(dshSrc, 'book-id.js'));
const stateSchema = await import(join(dshSrc, 'state-schema.js'));
const wordCount = await import(join(dshSrc, 'word-count.js'));
const stateReducer = await import(join(dshSrc, 'state-reducer.js'));
const fns = { ...antiAi, ...bookId, ...stateSchema, ...wordCount, ...stateReducer };

const C = (fn, args) => ({ fn, args, output: fns[fn](...args) });

const validBook = { bookId: 'the-dark-lord', title: 'The Dark Lord', genre: 'fantasy', targetChapters: 50, chapterWords: 2000, nextChapterIndex: 1 };
const base = { book: { bookId: 'b', title: 'B', targetChapters: 5, chapterWords: 100, nextChapterIndex: 1 }, chapters: [], summaries: [], hooks: [] };
const chapter = { index: 1, title: '第一章', wordCount: 90, filePath: 'chapters/001.md', aiTasteScore: 80, status: 'draft' };

const cases = [
  C('makeBookId', ['吞天魔帝']),
  C('makeBookId', ['The Dark Lord']),
  C('makeBookId', ['Hello 世界!']),
  C('makeBookId', ['都市修仙']),
  C('slugify', ['The Dark Lord!']),
  C('hash6', ['吞天魔帝']),
  C('isValidBookId', ['the-dark-lord']),
  C('isValidBookId', ['book-abc123']),
  C('isValidBookId', ['../etc']),
  C('isValidBookId', ['a/b']),
  C('isValidBookId', ['C:\\x']),
  C('isValidBookId', ['']),
  C('scanForbidden', ['他心中一凛，不由自主地后退一步。']),
  C('scanForbidden', ['他退了一步，没说话。']),
  C('deDensity', ['他的眼神里透着冷的、硬的光。']),
  C('deDensity', ['']),
  C('sentenceLengths', ['雨下了一夜。第二天清早，他推开窗。']),
  C('detectAI', ['他退了一步，没说话。']),
  C('detectAI', ['他心中一凛，不由自主地望了过去，眼中闪过一丝复杂。']),
  C('detectAI', ['']),
  C('detectAI', ['他走了。她来了。他看了。她去了。他停了。她跑了。']),
  C('rewriteRules', []),
  C('detectLanguage', ['他缓缓睁开眼，望向远方。']),
  C('detectLanguage', ['He opened his eyes.']),
  C('countZhChars', ['他望向远方。']),
  C('countZhChars', ['Hello 世界']),
  C('countEnWords', ['He opened his eyes.']),
  C('countWords', ['他望向远方。']),
  C('countWords', ['He opened his eyes.']),
  C('validateBook', [validBook]),
  C('validateBook', [{ bookId: '../etc', title: 'x' }]),
  C('validateBook', [{ bookId: 'a-book', title: 'x', targetChapters: 5, chapterWords: 100, nextChapterIndex: 0 }]),
  C('validateChapter', [chapter]),
  C('validateChapter', [{ index: 1, status: 'bogus' }]),
  C('validateState', [validBook && { book: validBook, chapters: [], summaries: [], hooks: [] }]),
  C('validateState', [null]),
  C('validateState', [{ book: null, chapters: [], summaries: [], hooks: [] }]),
  C('validateState', [{ book: { bookId: 'b' }, chapters: 'nope' }]),
  C('applyChapterDelta', [base, chapter]),
];

mkdirSync(new URL('../tests/vectors/', import.meta.url), { recursive: true });
writeFileSync(
  new URL('../tests/vectors/engine.json', import.meta.url),
  JSON.stringify({ source: 'dsh ' + dshSrc, generatedAt: new Date().toISOString(), cases }, null, 2),
);
console.log('已生成 ' + cases.length + ' 组向量，来自 ' + dshSrc);
```

- [ ] **Step 2: 运行生成向量**

Run: `node scripts/gen-vectors.mjs`
Expected: 输出 `已生成 39 组向量，来自 <dsh src 绝对路径>`，`tests/vectors/engine.json` 存在

- [ ] **Step 3: 写 parity 测试**

```js
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import * as antiAi from '../server/engine/anti-ai-engine.js';
import * as bookId from '../server/engine/book-id.js';
import * as stateSchema from '../server/engine/state-schema.js';
import * as wordCount from '../server/engine/word-count.js';
import * as stateReducer from '../server/engine/state-reducer.js';

const fns = { ...antiAi, ...bookId, ...stateSchema, ...wordCount, ...stateReducer };
const vectors = JSON.parse(readFileSync(new URL('./vectors/engine.json', import.meta.url), 'utf8'));

for (const c of vectors.cases) {
  test('parity ' + c.fn + ' ' + JSON.stringify(c.args).slice(0, 50), () => {
    assert.deepEqual(fns[c.fn](...c.args), c.output);
  });
}
```

- [ ] **Step 4: 跑测试确认 parity 全绿**

Run: `node --test tests/*.test.js`
Expected: `# pass 66`（27 基线 + 39 parity），`# fail 0`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test: 互通测试向量（由 dsh 引擎生成）+ parity 测试"
```

---

### Task 3: books.js 书库访问层

**Files:**
- Create: `server/books.js`
- Test: `tests/books.test.js`

**Interfaces:**
- Consumes: `server/engine/book-id.js`（`isValidBookId`）、`server/engine/state-schema.js`（`validateState`）
- Produces（后续所有工具依赖，签名不可变）：
  - `resolveRoot(): string`
  - `statePath(bookId): string`、`chapterPath(bookId, index): string`、`reportPath(bookId): string`、`intentPath(bookId, index): string`
  - `readState(bookId): Promise<object|null>`（文件缺失→null；JSON 损坏→throw 带 dsh 文案）
  - `writeState(bookId, state): Promise<void>`（validateState 不过→throw；自动建目录；pretty JSON 2 空格）
  - `writeChapter(bookId, index, body): Promise<string>`（返回相对路径 `novels/<bookId>/chapters/NNN.md`）
  - `readChapter(bookId, index): Promise<string|null>`（`index` 非正整数→throw `章节号非法`）
  - `listBooks(): Promise<Array<{bookId, title}>>`
  - 所有函数对非法 bookId throw `unsafe bookId`

- [ ] **Step 1: 写失败测试**

```js
import { test } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  resolveRoot, statePath, chapterPath, reportPath, intentPath,
  readState, writeState, writeChapter, readChapter, listBooks,
} from '../server/books.js';

const validState = {
  book: { bookId: 'b', title: 'B', targetChapters: 5, chapterWords: 100, nextChapterIndex: 1 },
  chapters: [], summaries: [], hooks: [],
};

function tempRoot() {
  const dir = mkdtempSync(join(tmpdir(), 'ninglet-books-'));
  process.env.NINGLET_ROOT = dir;
  return dir;
}

test('resolveRoot 优先 NINGLET_ROOT', () => {
  const dir = tempRoot();
  assert.equal(resolveRoot(), dir);
  delete process.env.NINGLET_ROOT;
});

test('路径布局与 dsh 一致', () => {
  tempRoot();
  assert.equal(statePath('b'), join(resolveRoot(), 'novels', 'b', 'story', 'state', 'state.json'));
  assert.equal(chapterPath('b', 7), join(resolveRoot(), 'novels', 'b', 'chapters', '007.md'));
  assert.equal(reportPath('b'), join(resolveRoot(), 'novels', 'b', 'report.html'));
  assert.equal(intentPath('b', 7), join(resolveRoot(), 'novels', 'b', 'story', 'runtime', 'chapter-007.intent.md'));
});

test('非法 bookId 一律 unsafe bookId', async () => {
  tempRoot();
  for (const bad of ['../etc', 'a/b', 'C:\\x', '', null, 123]) {
    assert.throws(() => statePath(bad), /unsafe bookId/);
    await assert.rejects(readState(bad), /unsafe bookId/);
  }
});

test('readState 缺失返回 null，损坏 JSON 抛错带修复指引', async () => {
  tempRoot();
  assert.equal(await readState('missing-book'), null);
  mkdirSync(join(resolveRoot(), 'novels', 'bad', 'story', 'state'), { recursive: true });
  writeFileSync(join(resolveRoot(), 'novels', 'bad', 'story', 'state', 'state.json'), '{oops', 'utf8');
  await assert.rejects(readState('bad'), /状态文件损坏（非合法 JSON），请修复 novels\/bad\/story\/state\/state.json/);
});

test('writeState 拒绝非法状态', async () => {
  tempRoot();
  await assert.rejects(writeState('b', { book: { bookId: 'b' } }), /状态非法，拒绝写入/);
});

test('writeState 落盘 pretty JSON', async () => {
  tempRoot();
  await writeState('b', validState);
  const raw = readFileSync(statePath('b'), 'utf8');
  assert.deepEqual(JSON.parse(raw), validState);
  assert.ok(raw.includes('\n  "book"'));
});

test('writeChapter 返回相对路径并落盘，readChapter 可读回', async () => {
  tempRoot();
  const rel = await writeChapter('b', 1, '正文内容');
  assert.equal(rel, 'novels/b/chapters/001.md');
  assert.equal(await readChapter('b', 1), '正文内容');
  assert.equal(await readChapter('b', 99), null);
  await assert.rejects(readChapter('b', 0), /章节号非法/);
});

test('listBooks 只列合法书', async () => {
  tempRoot();
  mkdirSync(join(resolveRoot(), 'novels', 'not-a-book'), { recursive: true });
  await writeState('b', validState);
  await writeState('c', { ...validState, book: { ...validState.book, bookId: 'c', title: 'C' } });
  const books = await listBooks();
  assert.deepEqual(books.map((x) => x.bookId).sort(), ['b', 'c']);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test tests/books.test.js`
Expected: FAIL（`Cannot find module '../server/books.js'` 等）

- [ ] **Step 3: 写 books.js**

```js
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { isValidBookId } from './engine/book-id.js';
import { validateState } from './engine/state-schema.js';

export function resolveRoot() {
  return process.env.NINGLET_ROOT || process.cwd();
}

function guard(bookId) {
  if (!isValidBookId(bookId)) throw new Error('unsafe bookId');
}

export function statePath(bookId) {
  guard(bookId);
  return join(resolveRoot(), 'novels', bookId, 'story', 'state', 'state.json');
}

export function chapterPath(bookId, index) {
  guard(bookId);
  const n = String(index).padStart(3, '0');
  return join(resolveRoot(), 'novels', bookId, 'chapters', n + '.md');
}

export function reportPath(bookId) {
  guard(bookId);
  return join(resolveRoot(), 'novels', bookId, 'report.html');
}

export function intentPath(bookId, index) {
  guard(bookId);
  const n = String(index).padStart(3, '0');
  return join(resolveRoot(), 'novels', bookId, 'story', 'runtime', 'chapter-' + n + '.intent.md');
}

export async function readState(bookId) {
  guard(bookId);
  const p = statePath(bookId);
  let raw;
  try {
    raw = await readFile(p, 'utf8');
  } catch {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('状态文件损坏（非合法 JSON），请修复 novels/' + bookId + '/story/state/state.json');
  }
}

export async function writeState(bookId, state) {
  guard(bookId);
  const v = validateState(state);
  if (!v.ok) throw new Error('状态非法，拒绝写入：' + v.errors.join('; '));
  const p = statePath(bookId);
  await mkdir(join(p, '..'), { recursive: true });
  await writeFile(p, JSON.stringify(state, null, 2), 'utf8');
}

export async function writeChapter(bookId, index, body) {
  guard(bookId);
  const p = chapterPath(bookId, index);
  await mkdir(join(p, '..'), { recursive: true });
  await writeFile(p, body, 'utf8');
  return 'novels/' + bookId + '/chapters/' + String(index).padStart(3, '0') + '.md';
}

export async function readChapter(bookId, index) {
  guard(bookId);
  if (!Number.isInteger(index) || index < 1) throw new Error('章节号非法');
  try {
    return await readFile(chapterPath(bookId, index), 'utf8');
  } catch {
    return null;
  }
}

export async function listBooks() {
  let entries;
  try {
    entries = await readdir(join(resolveRoot(), 'novels'), { withFileTypes: true });
  } catch {
    return [];
  }
  const books = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const state = await readState(e.name);
    if (state && state.book) books.push({ bookId: state.book.bookId, title: state.book.title });
  }
  return books;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test tests/books.test.js`
Expected: `# pass 8`，`# fail 0`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: server/books.js 书库访问层（根解析/状态/章节/书目）"
```

---

### Task 4: novel_create_book 工具

**Files:**
- Create: `server/tools/create-book.js`
- Test: `tests/tools-create-book.test.js`

**Interfaces:**
- Consumes: `makeBookId`（engine）、`readState`/`writeState`（books.js）
- Produces: 工具模块形状（Task 9 消费）：`{ name, description, inputSchema, handler(args): Promise<string> }`，handler 抛错 = 工具失败

- [ ] **Step 1: 写失败测试**

```js
import { test } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeBookId } from '../server/engine/book-id.js';
import { statePath } from '../server/books.js';
import { name, handler } from '../server/tools/create-book.js';

function tempRoot() {
  const dir = mkdtempSync(join(tmpdir(), 'ninglet-create-'));
  process.env.NINGLET_ROOT = dir;
  return dir;
}

test('创建书：返回 bookId、state 落盘、默认值正确', async () => {
  tempRoot();
  const out = await handler({ title: '吞天魔帝', genre: '都市修仙', brief: '草根逆袭' });
  const bookId = makeBookId('吞天魔帝');
  assert.ok(out.includes(bookId));
  const state = JSON.parse(readFileSync(statePath(bookId), 'utf8'));
  assert.equal(state.book.title, '吞天魔帝');
  assert.equal(state.book.genre, '都市修仙');
  assert.equal(state.book.brief, '草根逆袭');
  assert.equal(state.book.targetChapters, 50);
  assert.equal(state.book.chapterWords, 2000);
  assert.equal(state.book.nextChapterIndex, 1);
  assert.deepEqual(state.outline, []);
});

test('同名书拒绝覆盖', async () => {
  tempRoot();
  await handler({ title: '吞天魔帝' });
  const out = await handler({ title: '吞天魔帝' });
  assert.ok(out.includes('书已存在'));
  assert.ok(out.includes('不覆盖'));
});

test('空书名与超长书名抛错', async () => {
  tempRoot();
  await assert.rejects(handler({ title: '  ' }), /title 不能为空/);
  await assert.rejects(handler({ title: '长'.repeat(51) }), /title 过长/);
});

test('工具元数据完整', () => {
  assert.equal(name, 'novel_create_book');
  assert.ok(existsSync(new URL('../server/tools/create-book.js', import.meta.url)));
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test tests/tools-create-book.test.js`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 写 create-book.js**

```js
import { makeBookId } from '../engine/book-id.js';
import { readState, writeState } from '../books.js';

export const name = 'novel_create_book';
export const description = '创建一本新小说：生成安全 bookId 并初始化书库状态文件（novels/<bookId>/story/state/state.json）。同名书已存在时拒绝覆盖。';
export const inputSchema = {
  type: 'object',
  properties: {
    title: { type: 'string', description: '书名（≤50 字）' },
    genre: { type: 'string', description: '类型（可选）' },
    brief: { type: 'string', description: '创作简报（可选，存入书状态供大纲生成参考）' },
  },
  required: ['title'],
};

export async function handler(args) {
  const title = String(args.title || '').trim();
  if (!title) throw new Error('title 不能为空');
  if (title.length > 50) throw new Error('title 过长（≤50 字）');
  const bookId = makeBookId(title);
  const existing = await readState(bookId);
  if (existing) return '书已存在：' + bookId + '（不覆盖）';
  const state = {
    book: {
      bookId, title, genre: args.genre || '', brief: args.brief || '',
      targetChapters: 50, chapterWords: 2000, nextChapterIndex: 1,
    },
    chapters: [], summaries: [], hooks: [], characters: [], outline: [],
  };
  await writeState(bookId, state);
  return '已创建书《' + title + '》bookId=' + bookId + '，状态写入 novels/' + bookId + '/story/state/state.json'
    + (args.brief ? '。已存创作简报，可用 novel-outline-researcher 技能生成大纲后经 novel_update_memory 落盘' : '');
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test tests/tools-create-book.test.js`
Expected: `# pass 4`，`# fail 0`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: novel_create_book 工具（bookId 生成 + state 初始化）"
```

---

### Task 5: novel_scan_chapter 工具

**Files:**
- Create: `server/tools/scan-chapter.js`
- Test: `tests/tools-scan-chapter.test.js`

**Interfaces:**
- Consumes: `detectAI`（engine）
- Produces: `{ name: 'novel_scan_chapter', description, inputSchema, handler }`；handler 返回 JSON 字符串 `{"score":N,"hits":[...],"pass":bool}`

- [ ] **Step 1: 写失败测试**

```js
import { test } from 'node:test';
import assert from 'node:assert';
import { name, handler } from '../server/tools/scan-chapter.js';

test('干净正文 pass=true 满分', async () => {
  const out = JSON.parse(await handler({ body: '他退了一步，没说话。' }));
  assert.equal(out.pass, true);
  assert.equal(out.score, 100);
  assert.deepEqual(out.hits, []);
});

test('命中禁用词 pass=false 且列出命中', async () => {
  const out = JSON.parse(await handler({ body: '他心中一凛，不由自主地后退一步。' }));
  assert.equal(out.pass, false);
  assert.ok(out.score < 100);
  assert.ok(out.hits.some((h) => h.rule === 'forbidden' && h.detail.includes('心中一凛')));
});

test('空正文 pass=true', async () => {
  const out = JSON.parse(await handler({ body: '' }));
  assert.equal(out.pass, true);
});

test('元数据', () => {
  assert.equal(name, 'novel_scan_chapter');
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test tests/tools-scan-chapter.test.js`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 写 scan-chapter.js**

```js
import { detectAI } from '../engine/anti-ai-engine.js';

export const name = 'novel_scan_chapter';
export const description = '反 AI 味确定性扫描（干跑，不落盘）：禁用词、的密度、句长方差。返回 0-100 评分与命中列表，供修订决策。';
export const inputSchema = {
  type: 'object',
  properties: { body: { type: 'string', description: '章节正文全文' } },
  required: ['body'],
};

export async function handler(args) {
  const body = String(args.body || '');
  const { score, hits } = detectAI(body);
  return JSON.stringify({ score, hits, pass: hits.length === 0 });
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test tests/tools-scan-chapter.test.js`
Expected: `# pass 4`，`# fail 0`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: novel_scan_chapter 工具（干跑反 AI 味扫描）"
```

---

### Task 6: novel_settle_chapter 工具（严格结算）

**Files:**
- Create: `server/tools/settle-chapter.js`
- Test: `tests/tools-settle-chapter.test.js`

**Interfaces:**
- Consumes: `detectAI`/`countWords`/`applyChapterDelta`（engine）、`readState`/`writeState`/`writeChapter`/`readChapter`（books.js）、`mergeMemory`（Task 7 的 update-memory.js 导出，本任务先定义并在 Task 7 实现——两个任务中签名一致）
- Produces: `{ name: 'novel_settle_chapter', description, inputSchema, handler }`；handler 成功返回 `第 N 章完成：字数 M，AI味评分 S，落盘 novels/<id>/chapters/NNN.md`

**严格结算语义（本任务核心）**：`detectAI(body).hits.length > 0` → throw（错误消息含完整命中列表），**不写任何文件**；扫描干净才写章节文件 + 推进状态。状态推进顺序：构造 next state → `validateState` 预校验 → `writeChapter` → `writeState`（校验先行保证原子性；磁盘级故障时同 index 重试即覆盖）。

- [ ] **Step 1: 写失败测试**

```js
import { test } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { handler as createBook } from '../server/tools/create-book.js';
import { name, handler } from '../server/tools/settle-chapter.js';
import { statePath, chapterPath } from '../server/books.js';

const CLEAN = '雨下了一夜。第二天清早，他推开窗，看见巷口有人支起了油条摊子。摊主是个哑巴，打手势问他要几根。他伸出两根手指。油锅里的面圈翻了个身，滋滋响着，把整条巷子都染成了早饭的味道。';

function tempRoot() {
  const dir = mkdtempSync(join(tmpdir(), 'ninglet-settle-'));
  process.env.NINGLET_ROOT = dir;
  return dir;
}

test('干净正文：落盘章节 + 推进状态 + 合并记忆', async () => {
  tempRoot();
  const out = await createBook({ title: '烟雨楼' });
  const bookId = out.match(/bookId=([a-z0-9-]+)/)[1];
  const res = await handler({
    bookId,
    body: CLEAN,
    title: '第一章 油条摊',
    summary: '雨夜后的清晨，主角遇见哑巴摊主。',
    characters: [{ name: '阿哑', role: '配角', desc: '巷口油条摊主' }],
    hooks: [{ name: '阿哑的来历', status: 'open', note: '摊主似有隐情' }],
  });
  assert.ok(res.includes('第 1 章完成'));
  assert.ok(res.includes('AI味评分 100'));
  const state = JSON.parse(readFileSync(statePath(bookId), 'utf8'));
  assert.equal(state.book.nextChapterIndex, 2);
  assert.equal(state.chapters.length, 1);
  assert.equal(state.chapters[0].status, 'approved');
  assert.equal(state.chapters[0].wordCount > 0, true);
  assert.equal(state.summaries[0].text, '雨夜后的清晨，主角遇见哑巴摊主。');
  assert.equal(state.characters[0].name, '阿哑');
  assert.equal(state.hooks[0].status, 'open');
  assert.equal(state.outline.length, 0);
  assert.ok(existsSync(chapterPath(bookId, 1)));
});

test('命中禁用词：拒绝落盘，不写任何文件', async () => {
  tempRoot();
  await createBook({ title: '烟雨楼' });
  const bookId = 'yan-yu-lou';
  await assert.rejects(
    handler({ bookId, body: CLEAN + '他心中一凛。' }),
    /反 AI 味扫描未通过，拒绝落盘/,
  );
  assert.equal(existsSync(chapterPath(bookId, 1)), false);
  const state = JSON.parse(readFileSync(statePath(bookId), 'utf8'));
  assert.equal(state.chapters.length, 0);
  assert.equal(state.book.nextChapterIndex, 1);
});

test('书不存在返回提示', async () => {
  tempRoot();
  const out = await handler({ bookId: 'no-such-book', body: CLEAN });
  assert.ok(out.includes('不存在'));
});

test('章节号连续推进：第二章节号 2、文件名 002', async () => {
  tempRoot();
  await createBook({ title: '烟雨楼' });
  await handler({ bookId: 'yan-yu-lou', body: CLEAN });
  const res = await handler({ bookId: 'yan-yu-lou', body: CLEAN });
  assert.ok(res.includes('第 2 章完成'));
  assert.ok(existsSync(chapterPath('yan-yu-lou', 2)));
});

test('元数据', () => {
  assert.equal(name, 'novel_settle_chapter');
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test tests/tools-settle-chapter.test.js`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 写 settle-chapter.js**

```js
import { detectAI } from '../engine/anti-ai-engine.js';
import { countWords } from '../engine/word-count.js';
import { applyChapterDelta } from '../engine/state-reducer.js';
import { validateState } from '../engine/state-schema.js';
import { readState, writeState, writeChapter } from '../books.js';
import { mergeMemory } from './update-memory.js';

export const name = 'novel_settle_chapter';
export const description = '章节终审结算（严格）：反 AI 味扫描必须 0 命中才落盘。写 chapters/NNN.md、合并摘要/角色/伏笔、推进状态机，一次调用原子完成；坏数据拒绝写入。';
export const inputSchema = {
  type: 'object',
  properties: {
    bookId: { type: 'string', description: '书 ID（novel_create_book 返回）' },
    body: { type: 'string', description: '章节正文全文（终稿）' },
    title: { type: 'string', description: '章节标题（可选，默认 第N章）' },
    summary: { type: 'string', description: '观察者抽取的本章摘要（80 字内，可选）' },
    characters: {
      type: 'array',
      items: { type: 'object', properties: { name: { type: 'string' }, role: { type: 'string' }, desc: { type: 'string' } }, required: ['name'] },
      description: '本章新角色（可选）',
    },
    hooks: {
      type: 'array',
      items: { type: 'object', properties: { name: { type: 'string' }, status: { type: 'string' }, note: { type: 'string' } }, required: ['name'] },
      description: '本章伏笔（可选，status 取值 open/progressing/resolved）',
    },
  },
  required: ['bookId', 'body'],
};

export async function handler(args) {
  const bookId = String(args.bookId || '');
  const body = String(args.body || '');

  const ai = detectAI(body);
  if (ai.hits.length > 0) {
    const detail = ai.hits.map((h) => '[' + h.rule + '] ' + h.detail).join('；');
    throw new Error('反 AI 味扫描未通过，拒绝落盘（得分 ' + ai.score + '）。命中：' + detail + '。请按 anti-ai-flavor 技能规则修订后重新结算。');
  }

  const state = await readState(bookId);
  if (!state) return '书 ' + bookId + ' 不存在，请先 novel_create_book';
  const index = state.book.nextChapterIndex;

  const chapter = {
    index,
    title: args.title || '第' + index + '章',
    wordCount: countWords(body),
    filePath: 'novels/' + bookId + '/chapters/' + String(index).padStart(3, '0') + '.md',
    aiTasteScore: ai.score,
    status: 'approved',
  };

  // state-reducer 只保留 book/chapters/summaries/hooks，characters/outline 需回挂（与 dsh 落盘行为一致）
  let next = applyChapterDelta(state, chapter);
  next = { ...next, characters: state.characters || [], outline: state.outline || [] };
  if (args.summary) {
    next.summaries = next.summaries.concat([{ index, text: String(args.summary) }]);
  }
  next = mergeMemory(next, args.characters || [], args.hooks || []);

  // 校验先行：任何校验失败都不写任何文件
  const v = validateState(next);
  if (!v.ok) throw new Error('状态非法，拒绝写入：' + v.errors.join('; '));

  await writeChapter(bookId, index, body);
  await writeState(bookId, next);
  return '第 ' + index + ' 章完成：字数 ' + chapter.wordCount + '，AI味评分 ' + ai.score + '，落盘 ' + chapter.filePath;
}
```

- [ ] **Step 4: 写 update-memory.js 的最小形态（mergeMemory 部分，完整版在 Task 7）**

先创建 `server/tools/update-memory.js`，只含 mergeMemory 导出（Task 7 再补 handler 与元数据）——测试仅依赖 mergeMemory：

```js
export function mergeMemory(state, chars, hooks) {
  const out = { ...state };
  const cs = (out.characters || []).slice();
  for (const c of chars) {
    if (!c || !c.name) continue;
    if (!cs.some((x) => x.name === c.name)) {
      cs.push({ name: String(c.name), role: String(c.role || ''), desc: String(c.desc || '') });
    }
  }
  out.characters = cs;
  const hs = (out.hooks || []).slice();
  for (const h of hooks) {
    if (!h || !h.name) continue;
    const ex = hs.find((x) => x.name === h.name);
    const status = (h.status === 'progressing' || h.status === 'resolved') ? h.status : 'open';
    if (ex) ex.status = status;
    else hs.push({ name: String(h.name), status, note: String(h.note || '') });
  }
  out.hooks = hs;
  return out;
}
```

- [ ] **Step 5: 跑测试确认通过**

Run: `node --test tests/tools-settle-chapter.test.js`
Expected: `# pass 5`，`# fail 0`

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: novel_settle_chapter 工具（严格扫描 0 hits 落盘 + 记忆合并）"
```

---

### Task 7: novel_update_memory 工具

**Files:**
- Modify: `server/tools/update-memory.js`（补 name/description/inputSchema/handler）
- Test: `tests/tools-update-memory.test.js`

**Interfaces:**
- Consumes: `readState`/`writeState`（books.js）、`mergeMemory`（本文件 Task 6 已定义）
- Produces: `{ name: 'novel_update_memory', description, inputSchema, handler }`；handler 成功返回 `已更新《书名》记忆：...已落盘。`

- [ ] **Step 1: 写失败测试**

```js
import { test } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { handler as createBook } from '../server/tools/create-book.js';
import { name, handler } from '../server/tools/update-memory.js';
import { statePath } from '../server/books.js';

function tempRoot() {
  const dir = mkdtempSync(join(tmpdir(), 'ninglet-mem-'));
  process.env.NINGLET_ROOT = dir;
  return dir;
}

async function setup() {
  tempRoot();
  await createBook({ title: '烟雨楼' });
  return 'yan-yu-lou';
}

test('角色按名去重合并', async () => {
  const bookId = await setup();
  await handler({ bookId, characters: [{ name: '阿哑', role: '配角', desc: '摊主' }] });
  await handler({ bookId, characters: [{ name: '阿哑', role: '配角', desc: '旧描述' }, { name: '沈七', role: '主角', desc: '少年' }] });
  const state = JSON.parse(readFileSync(statePath(bookId), 'utf8'));
  assert.equal(state.characters.length, 2);
  assert.equal(state.characters[0].desc, '摊主'); // 已有角色不被覆盖
});

test('伏笔按名更新状态 open→progressing→resolved', async () => {
  const bookId = await setup();
  await handler({ bookId, hooks: [{ name: '阿哑的来历', status: 'open', note: '隐情' }] });
  await handler({ bookId, hooks: [{ name: '阿哑的来历', status: 'progressing' }] });
  await handler({ bookId, hooks: [{ name: '阿哑的来历', status: 'resolved' }] });
  const state = JSON.parse(readFileSync(statePath(bookId), 'utf8'));
  assert.equal(state.hooks.length, 1);
  assert.equal(state.hooks[0].status, 'resolved');
});

test('非法 status 回退 open', async () => {
  const bookId = await setup();
  await handler({ bookId, hooks: [{ name: 'X', status: 'bogus' }] });
  const state = JSON.parse(readFileSync(statePath(bookId), 'utf8'));
  assert.equal(state.hooks[0].status, 'open');
});

test('outline 整体替换', async () => {
  const bookId = await setup();
  const outline = [{ index: 1, title: '第一章：油条摊 —— 主角与哑巴摊主相遇' }];
  await handler({ bookId, outline });
  const state = JSON.parse(readFileSync(statePath(bookId), 'utf8'));
  assert.deepEqual(state.outline, outline);
});

test('summary 追加到最近一章', async () => {
  const bookId = await setup();
  await handler({ bookId, summary: '测试摘要' });
  const state = JSON.parse(readFileSync(statePath(bookId), 'utf8'));
  assert.equal(state.summaries.length, 1);
  assert.equal(state.summaries[0].text, '测试摘要');
});

test('书不存在返回提示', async () => {
  tempRoot();
  const out = await handler({ bookId: 'no-such-book' });
  assert.ok(out.includes('不存在'));
});

test('非法 outline 拒绝写入', async () => {
  const bookId = await setup();
  await assert.rejects(handler({ bookId, outline: '不是数组' }), /状态非法，拒绝写入/);
});

test('元数据', () => {
  assert.equal(name, 'novel_update_memory');
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test tests/tools-update-memory.test.js`
Expected: FAIL（`handler is not a function` / 模块缺导出）

- [ ] **Step 3: 补全 update-memory.js**

在 Task 6 的 mergeMemory 之上补（文件顶部加 import，底部加导出）：

```js
import { readState, writeState } from '../books.js';

export const name = 'novel_update_memory';
export const description = '独立更新书库记忆：摘要（追加）、角色（按名去重合并）、伏笔（按名更新状态 open/progressing/resolved）、大纲（整体替换）。校验后落盘。';
export const inputSchema = {
  type: 'object',
  properties: {
    bookId: { type: 'string', description: '书 ID' },
    summary: { type: 'string', description: '要追加的摘要（可选）' },
    characters: {
      type: 'array',
      items: { type: 'object', properties: { name: { type: 'string' }, role: { type: 'string' }, desc: { type: 'string' } }, required: ['name'] },
      description: '角色（按名合并，可选）',
    },
    hooks: {
      type: 'array',
      items: { type: 'object', properties: { name: { type: 'string' }, status: { type: 'string' }, note: { type: 'string' } }, required: ['name'] },
      description: '伏笔（按名更新状态，可选）',
    },
    outline: {
      type: 'array',
      items: { type: 'object', properties: { index: { type: 'number' }, title: { type: 'string' } }, required: ['title'] },
      description: '章回大纲（整体替换，可选）',
    },
  },
  required: ['bookId'],
};

export async function handler(args) {
  const bookId = String(args.bookId || '');
  const state = await readState(bookId);
  if (!state) return '书 ' + bookId + ' 不存在，请先 novel_create_book';

  let next = { ...state };
  if (args.summary) {
    next.summaries = (state.summaries || []).concat([{ index: state.book.nextChapterIndex - 1, text: String(args.summary) }]);
  }
  next = mergeMemory(next, args.characters || [], args.hooks || []);
  if (args.outline !== undefined) next.outline = args.outline;

  await writeState(bookId, next);
  return '已更新《' + state.book.title + '》记忆：'
    + (args.summary ? '摘要+1，' : '')
    + (args.characters && args.characters.length ? '角色' + args.characters.length + '，' : '')
    + (args.hooks && args.hooks.length ? '伏笔' + args.hooks.length + '，' : '')
    + (args.outline !== undefined ? '大纲已替换，' : '')
    + '已落盘。';
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test tests/tools-update-memory.test.js`
Expected: `# pass 8`，`# fail 0`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: novel_update_memory 工具（角色/伏笔合并 + 大纲替换）"
```

---

### Task 8: 读类工具（list-books / list-chapters / read-chapter）

**Files:**
- Create: `server/tools/list-books.js`、`server/tools/list-chapters.js`、`server/tools/read-chapter.js`
- Test: `tests/tools-read.test.js`

**Interfaces:**
- Consumes: `listBooks`/`readState`/`readChapter`（books.js）
- Produces: 三个工具模块，形状同前（`{ name, description, inputSchema, handler }`）

- [ ] **Step 1: 写失败测试**

```js
import { test } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { handler as createBook } from '../server/tools/create-book.js';
import { handler as settle } from '../server/tools/settle-chapter.js';
import { name as lbName, handler as listBooks } from '../server/tools/list-books.js';
import { name as lcName, handler as listChapters } from '../server/tools/list-chapters.js';
import { name as rcName, handler as readChapter } from '../server/tools/read-chapter.js';

const CLEAN = '雨下了一夜。第二天清早，他推开窗，看见巷口有人支起了油条摊子。摊主是个哑巴，打手势问他要几根。他伸出两根手指。油锅里的面圈翻了个身，滋滋响着，把整条巷子都染成了早饭的味道。';

function tempRoot() {
  const dir = mkdtempSync(join(tmpdir(), 'ninglet-read-'));
  process.env.NINGLET_ROOT = dir;
  return dir;
}

test('list_books 列出已建书', async () => {
  tempRoot();
  await createBook({ title: '烟雨楼' });
  await createBook({ title: 'The Dark Lord' });
  const books = JSON.parse(await listBooks());
  assert.equal(books.length, 2);
  assert.ok(books.some((b) => b.title === '烟雨楼'));
});

test('list_books 书库为空返回提示', async () => {
  tempRoot();
  assert.ok((await listBooks()).includes('书库为空'));
});

test('list_chapters 列出章节元数据', async () => {
  tempRoot();
  await createBook({ title: '烟雨楼' });
  await settle({ bookId: 'yan-yu-lou', body: CLEAN });
  const out = JSON.parse(await listChapters({ bookId: 'yan-yu-lou' }));
  assert.equal(out.length, 1);
  assert.equal(out[0].index, 1);
  assert.equal(out[0].score, 100);
  assert.ok(out[0].wordCount > 0);
});

test('read_chapter 读回正文与错误路径', async () => {
  tempRoot();
  await createBook({ title: '烟雨楼' });
  await settle({ bookId: 'yan-yu-lou', body: CLEAN });
  assert.equal(await readChapter({ bookId: 'yan-yu-lou', index: 1 }), CLEAN);
  assert.ok((await readChapter({ bookId: 'yan-yu-lou', index: 9 })).includes('章节不存在'));
  await assert.rejects(readChapter({ bookId: '../etc', index: 1 }), /unsafe bookId/);
});

test('元数据', () => {
  assert.equal(lbName, 'novel_list_books');
  assert.equal(lcName, 'novel_list_chapters');
  assert.equal(rcName, 'novel_read_chapter');
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test tests/tools-read.test.js`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 写三个工具**

`server/tools/list-books.js`：
```js
import { listBooks } from '../books.js';

export const name = 'novel_list_books';
export const description = '列出书库中所有书（bookId + 书名）。';
export const inputSchema = { type: 'object', properties: {} };

export async function handler() {
  const books = await listBooks();
  return books.length ? JSON.stringify(books) : '（书库为空）';
}
```

`server/tools/list-chapters.js`：
```js
import { readState } from '../books.js';

export const name = 'novel_list_chapters';
export const description = '列出某本书的全部章节（章号/标题/字数/AI味评分）。';
export const inputSchema = {
  type: 'object',
  properties: { bookId: { type: 'string', description: '书 ID' } },
  required: ['bookId'],
};

export async function handler(args) {
  const state = await readState(String(args.bookId || ''));
  if (!state) return '书不存在';
  return JSON.stringify(state.chapters.map((c) => ({ index: c.index, title: c.title, wordCount: c.wordCount, score: c.aiTasteScore })));
}
```

`server/tools/read-chapter.js`：
```js
import { readChapter } from '../books.js';

export const name = 'novel_read_chapter';
export const description = '读取某一章正文全文。';
export const inputSchema = {
  type: 'object',
  properties: {
    bookId: { type: 'string', description: '书 ID' },
    index: { type: 'number', description: '章节号（从 1 开始）' },
  },
  required: ['bookId', 'index'],
};

export async function handler(args) {
  const body = await readChapter(String(args.bookId || ''), args.index);
  return body === null ? '章节不存在' : body;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test tests/tools-read.test.js`
Expected: `# pass 5`，`# fail 0`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: 读类工具 novel_list_books / novel_list_chapters / novel_read_chapter"
```

---

### Task 9: MCP 协议壳 index.js

**Files:**
- Create: `server/index.js`
- Test: `tests/mcp.test.js`

**Interfaces:**
- Consumes: 8 个工具模块的 `{ name, description, inputSchema, handler }`
- Produces: `node server/index.js` 启动 stdio MCP server；支持 `initialize`（回显客户端 protocolVersion）、`ping`、`tools/list`、`tools/call`；`notifications/*` 不回应；错误 → JSON-RPC error `{code:-32000, message}`

- [ ] **Step 1: 写失败测试**

```js
import { test } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';

const SERVER = join(dirname(fileURLToPath(import.meta.url)), '..', 'server', 'index.js');
const CLEAN = '雨下了一夜。第二天清早，他推开窗，看见巷口有人支起了油条摊子。摊主是个哑巴，打手势问他要几根。他伸出两根手指。油锅里的面圈翻了个身，滋滋响着，把整条巷子都染成了早饭的味道。';

function startServer() {
  const root = mkdtempSync(join(tmpdir(), 'ninglet-mcp-'));
  const proc = spawn(process.execPath, [SERVER], {
    env: { ...process.env, NINGLET_ROOT: root },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const rl = createInterface({ input: proc.stdout });
  const pending = new Map();
  let nextId = 1;
  rl.on('line', (line) => {
    const msg = JSON.parse(line);
    if (pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  });
  function rpc(method, params) {
    const id = nextId++;
    return new Promise((resolve) => {
      pending.set(id, resolve);
      proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    });
  }
  function notify(method, params) {
    proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
  }
  return { proc, rpc, notify };
}

test('initialize 握手返回 protocolVersion 与 serverInfo', async () => {
  const { proc, rpc } = startServer();
  const res = await rpc('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '0' } });
  assert.equal(res.result.protocolVersion, '2024-11-05');
  assert.equal(res.result.serverInfo.name, 'ninglet');
  notify('notifications/initialized', {});
  proc.kill();
});

test('tools/list 返回 8 个工具', async () => {
  const { proc, rpc } = startServer();
  await rpc('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '0' } });
  const res = await rpc('tools/list', {});
  const names = res.result.tools.map((t) => t.name).sort();
  assert.deepEqual(names, [
    'novel_create_book', 'novel_generate_report', 'novel_list_books', 'novel_list_chapters',
    'novel_read_chapter', 'novel_scan_chapter', 'novel_settle_chapter', 'novel_update_memory',
  ]);
  for (const t of res.result.tools) {
    assert.equal(t.inputSchema.type, 'object');
    assert.ok(t.description.length > 0);
  }
  proc.kill();
});

test('tools/call 全流程：建书→结算→列章', async () => {
  const { proc, rpc } = startServer();
  await rpc('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '0' } });
  const created = await rpc('tools/call', { name: 'novel_create_book', arguments: { title: '烟雨楼' } });
  assert.equal(created.result.isError, false);
  assert.ok(created.result.content[0].text.includes('bookId=yan-yu-lou'));
  const settled = await rpc('tools/call', { name: 'novel_settle_chapter', arguments: { bookId: 'yan-yu-lou', body: CLEAN } });
  assert.equal(settled.result.isError, false);
  assert.ok(settled.result.content[0].text.includes('第 1 章完成'));
  const listed = await rpc('tools/call', { name: 'novel_list_chapters', arguments: { bookId: 'yan-yu-lou' } });
  assert.equal(JSON.parse(listed.result.content[0].text).length, 1);
  proc.kill();
});

test('工具错误 → isError 响应', async () => {
  const { proc, rpc } = startServer();
  await rpc('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '0' } });
  const res = await rpc('tools/call', { name: 'novel_settle_chapter', arguments: { bookId: 'yan-yu-lou', body: CLEAN + '他心中一凛。' } });
  assert.equal(res.result.isError, true);
  assert.ok(res.result.content[0].text.includes('拒绝落盘'));
  proc.kill();
});

test('ping 返回空对象', async () => {
  const { proc, rpc } = startServer();
  await rpc('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '0' } });
  const res = await rpc('ping', {});
  assert.deepEqual(res.result, {});
  proc.kill();
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test tests/mcp.test.js`
Expected: FAIL（spawn 报 ENOENT：server/index.js 不存在）

- [ ] **Step 3: 写 index.js**

```js
import { createInterface } from 'node:readline';
import * as createBook from './tools/create-book.js';
import * as scanChapter from './tools/scan-chapter.js';
import * as settleChapter from './tools/settle-chapter.js';
import * as updateMemory from './tools/update-memory.js';
import * as listBooks from './tools/list-books.js';
import * as listChapters from './tools/list-chapters.js';
import * as readChapter from './tools/read-chapter.js';
import * as generateReport from './tools/generate-report.js';

const TOOLS = [createBook, scanChapter, settleChapter, updateMemory, listBooks, listChapters, readChapter, generateReport];
const SERVER_INFO = { name: 'ninglet', version: '0.1.0' };

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n');
}

async function handle(method, params) {
  switch (method) {
    case 'initialize':
      // 回显客户端请求的协议版本，保证握手兼容
      return { protocolVersion: params.protocolVersion || '2024-11-05', capabilities: { tools: {} }, serverInfo: SERVER_INFO };
    case 'ping':
      return {};
    case 'tools/list':
      return { tools: TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })) };
    case 'tools/call': {
      const tool = TOOLS.find((t) => t.name === params.name);
      if (!tool) throw new Error('未知工具：' + params.name);
      const text = await tool.handler(params.arguments || {});
      return { content: [{ type: 'text', text }], isError: false };
    }
    default:
      throw new Error('未知方法：' + method);
  }
}

const rl = createInterface({ input: process.stdin, terminal: false });

rl.on('line', async (line) => {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return; // 非 JSON 行，忽略
  }
  if (typeof msg.method !== 'string') return;
  if (msg.method.startsWith('notifications/')) return; // 通知不回应
  try {
    const result = await handle(msg.method, msg.params || {});
    send({ jsonrpc: '2.0', id: msg.id, result });
  } catch (e) {
    send({ jsonrpc: '2.0', id: msg.id, error: { code: -32000, message: e.message } });
  }
});
```

- [ ] **Step 4: 写 generate-report.js 占位（Task 10 补全）**

index.js import 的模块必须存在，先放最小占位：

```js
export const name = 'novel_generate_report';
export const description = '生成书的自包含 HTML 报告（结构视图 + 章节阅读），写入 novels/<bookId>/report.html（覆盖旧报告）。';
export const inputSchema = { type: 'object', properties: { bookId: { type: 'string' } }, required: ['bookId'] };
export async function handler() {
  throw new Error('未实现（Task 10 交付）');
}
```

- [ ] **Step 5: 跑测试确认通过**

Run: `node --test tests/mcp.test.js`
Expected: `# pass 5`，`# fail 0`

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: MCP stdio 协议壳 + 8 工具注册"
```

---

### Task 10: report.js + novel_generate_report 工具

**Files:**
- Create: `server/report.js`
- Modify: `server/tools/generate-report.js`（补全实现）
- Test: `tests/tools-report.test.js`

**Interfaces:**
- Consumes: `readState`/`readChapter`/`reportPath`（books.js）
- Produces: `renderReport(state, chapters): string`（自包含 HTML）；工具 handler 返回 `报告已生成：<绝对路径>`

**HTML 约束**：单文件自包含（无 `<script src>`、无外部 URL、数据内嵌）；结构视图（大纲/章节/角色/伏笔）+ 点击章节切阅读视图；纸墨 token；`<` 转义为 `<` 防 `</script>` 逃逸。

- [ ] **Step 1: 写失败测试**

```js
import { test } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { handler as createBook } from '../server/tools/create-book.js';
import { handler as settle } from '../server/tools/settle-chapter.js';
import { handler as updateMemory } from '../server/tools/update-memory.js';
import { name, handler } from '../server/tools/generate-report.js';
import { reportPath } from '../server/books.js';

const CLEAN = '雨下了一夜。第二天清早，他推开窗，看见巷口有人支起了油条摊子。摊主是个哑巴，打手势问他要几根。他伸出两根手指。油锅里的面圈翻了个身，滋滋响着，把整条巷子都染成了早饭的味道。';

function tempRoot() {
  const dir = mkdtempSync(join(tmpdir(), 'ninglet-report-'));
  process.env.NINGLET_ROOT = dir;
  return dir;
}

async function buildBook() {
  tempRoot();
  await createBook({ title: '烟雨楼', genre: '市井', brief: '巷口早点摊的江湖' });
  await settle({
    bookId: 'yan-yu-lou', body: CLEAN, title: '第一章 油条摊',
    summary: '雨夜后主角遇见哑巴摊主。', characters: [{ name: '阿哑', role: '配角', desc: '油条摊主' }],
    hooks: [{ name: '阿哑的来历', status: 'open', note: '似有隐情' }],
  });
  return 'yan-yu-lou';
}

test('报告生成到 novels/<bookId>/report.html', async () => {
  const bookId = await buildBook();
  const out = await handler({ bookId });
  assert.ok(out.includes('report.html'));
  assert.ok(existsSync(reportPath(bookId)));
});

test('报告内容：标题/章节/角色/伏笔/正文俱全', async () => {
  const bookId = await buildBook();
  await handler({ bookId });
  const html = readFileSync(reportPath(bookId), 'utf8');
  assert.ok(html.includes('烟雨楼'));
  assert.ok(html.includes('第一章 油条摊'));
  assert.ok(html.includes('阿哑'));
  assert.ok(html.includes('阿哑的来历'));
  assert.ok(html.includes('雨下了一夜'));
});

test('报告自包含：无外部引用', async () => {
  const bookId = await buildBook();
  await handler({ bookId });
  const html = readFileSync(reportPath(bookId), 'utf8');
  assert.ok(!/<script[^>]*src=/.test(html));
  assert.ok(!/<link[^>]*href=/.test(html));
  assert.ok(!html.includes('http://'));
  assert.ok(!html.includes('https://'));
});

test('纸墨 token 生效', async () => {
  const bookId = await buildBook();
  await handler({ bookId });
  const html = readFileSync(reportPath(bookId), 'utf8');
  for (const token of ['#F4F2EC', '#2A2A28', '#D9D6CD', '#3E4C6B', '#C8161D', '#1C1B19']) {
    assert.ok(html.includes(token), '缺 token ' + token);
  }
});

test('书不存在返回提示', async () => {
  tempRoot();
  assert.ok((await handler({ bookId: 'no-such-book' })).includes('不存在'));
});

test('元数据', () => {
  assert.equal(name, 'novel_generate_report');
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test tests/tools-report.test.js`
Expected: FAIL（`未实现（Task 10 交付）`）

- [ ] **Step 3: 写 report.js**

```js
const CSS = `
:root { --ground: #F4F2EC; --ink: #2A2A28; --hairline: #D9D6CD; --accent: #3E4C6B; --red: #C8161D; --muted: #7C7B76; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--ground); color: var(--ink); font-family: Georgia, 'Noto Serif SC', 'Songti SC', serif; }
.head { padding: 28px 32px 20px; border-bottom: 1px solid var(--hairline); }
.title { font-size: 22px; font-weight: 600; }
.meta { margin-top: 8px; color: var(--muted); font-size: 13px; }
.tabs { display: flex; gap: 4px; padding: 12px 32px 0; }
.tab { cursor: pointer; font-size: 13px; padding: 5px 12px; border: 1px solid var(--hairline); border-radius: 2px; color: var(--muted); background: none; }
.tab.on { background: var(--ink); color: var(--ground); border-color: var(--ink); }
.view { padding: 16px 32px 40px; max-width: 860px; }
.section { padding: 14px 0 6px; font-size: 11px; letter-spacing: 0.08em; color: var(--muted); text-transform: uppercase; }
.item { padding: 9px 0; border-bottom: 1px solid var(--hairline); font-size: 14px; cursor: pointer; }
.item:hover { opacity: 0.7; }
.muted { color: var(--muted); font-size: 12px; }
.status { font-size: 11px; color: var(--red); margin-left: 6px; }
.status.resolved { color: var(--muted); }
.status.progressing { color: var(--accent); }
.prose { white-space: pre-wrap; font-size: 15px; line-height: 1.9; }
.back { cursor: pointer; color: var(--accent); font-size: 13px; margin-bottom: 12px; }
@media (prefers-color-scheme: dark) {
  :root { --ground: #1C1B19; --ink: #EDEBE4; --hairline: #35332E; --muted: #8B8A85; }
  .tab.on { background: #EDEBE4; color: #1C1B19; border-color: #EDEBE4; }
}
`;

const JS = `
function $(id) { return document.getElementById(id); }
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
function setView(html) { $('view').innerHTML = html; window.scrollTo(0, 0); }

function tabs() {
  const defs = [
    ['outline', '大纲'], ['chapters', '章节'], ['characters', '角色'], ['hooks', '伏笔'],
  ];
  $('tabs').innerHTML = defs.map(function (d) {
    return '<button class="tab" id="tab-' + d[0] + '" onclick="show(\'' + d[0] + '\')">' + d[1] + '</button>';
  }).join('');
}

function show(key) {
  document.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('on'); });
  $('tab-' + key).classList.add('on');
  if (key === 'outline') setView(renderOutline());
  if (key === 'chapters') setView(renderChapters());
  if (key === 'characters') setView(renderCharacters());
  if (key === 'hooks') setView(renderHooks());
}

function renderOutline() {
  if (!DATA.outline.length) return '<div class="muted">（暂无大纲）</div>';
  return '<div class="section">大纲</div>' + DATA.outline.map(function (o) {
    return '<div class="item">' + esc(o.title) + '</div>';
  }).join('');
}

function renderChapters() {
  if (!DATA.chapters.length) return '<div class="muted">（还没有章节）</div>';
  return '<div class="section">章节</div>' + DATA.chapters.map(function (c) {
    return '<div class="item" onclick="readChapter(' + c.index + ')">第' + c.index + '章 ' + esc(c.title)
      + ' <span class="muted">' + c.wordCount + ' 字 · 评分 ' + c.aiTasteScore + '</span></div>';
  }).join('');
}

function renderCharacters() {
  if (!DATA.characters.length) return '<div class="muted">（暂无角色）</div>';
  return '<div class="section">角色</div>' + DATA.characters.map(function (c) {
    return '<div class="item">' + esc(c.name) + ' <span class="muted">' + esc(c.role || '') + '</span>'
      + '<div class="muted">' + esc(c.desc || '') + '</div></div>';
  }).join('');
}

function renderHooks() {
  if (!DATA.hooks.length) return '<div class="muted">（暂无伏笔）</div>';
  return '<div class="section">伏笔</div>' + DATA.hooks.map(function (h) {
    return '<div class="item">' + esc(h.name) + '<span class="status ' + esc(h.status) + '">' + esc(h.status) + '</span>'
      + '<div class="muted">' + esc(h.note || '') + '</div></div>';
  }).join('');
}

function readChapter(index) {
  var c = DATA.chapters.filter(function (x) { return x.index === index; })[0];
  if (!c) return;
  setView('<div class="back" onclick="show(\'chapters\')">← 返回章节列表</div>'
    + '<div class="title">' + esc(c.title) + '</div>'
    + '<div class="muted">' + c.wordCount + ' 字 · AI 味评分 ' + c.aiTasteScore + '</div>'
    + '<div class="prose">' + esc(DATA.bodies[String(index)] || '') + '</div>');
}

tabs();
show('chapters');
`;

export function renderReport(state, chapters) {
  const data = {
    book: state.book,
    outline: state.outline || [],
    chapters: chapters.map((c) => ({ index: c.index, title: c.title, wordCount: c.wordCount, aiTasteScore: c.aiTasteScore, status: c.status })),
    bodies: Object.fromEntries(chapters.map((c) => [String(c.index), c.body || ''])),
    characters: state.characters || [],
    hooks: state.hooks || [],
  };
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  const totalWords = data.chapters.reduce((a, c) => a + c.wordCount, 0);
  const avgScore = data.chapters.length
    ? Math.round(data.chapters.reduce((a, c) => a + c.aiTasteScore, 0) / data.chapters.length)
    : '—';
  return '<!doctype html>\n<html lang="zh-CN">\n<head>\n<meta charset="utf-8">\n'
    + '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
    + '<title>《' + state.book.title + '》 · NINGLET 报告</title>\n'
    + '<style>' + CSS + '</style>\n</head>\n<body>\n'
    + '<header class="head"><div class="title">《' + state.book.title + '》</div>'
    + '<div class="meta">' + (state.book.genre || '未分类') + ' · 共 ' + data.chapters.length + ' 章 · ' + totalWords + ' 字 · 平均 AI 味评分 ' + avgScore
    + (state.book.brief ? '<br>' + state.book.brief : '') + '</div></header>\n'
    + '<nav class="tabs" id="tabs"></nav>\n'
    + '<main class="view" id="view"></main>\n'
    + '<script type="application/json" id="ninglet-data">' + json + '</script>\n'
    + '<script>var DATA = JSON.parse(document.getElementById(\'ninglet-data\').textContent);\n' + JS + '\n</script>\n'
    + '</body>\n</html>\n';
}
```

- [ ] **Step 4: 补全 generate-report.js（用以下内容整体覆盖 Task 9 的占位文件）**

```js
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readState, readChapter, reportPath } from '../books.js';
import { renderReport } from '../report.js';

export const name = 'novel_generate_report';
export const description = '生成书的自包含 HTML 报告（结构视图 + 章节阅读），写入 novels/<bookId>/report.html（覆盖旧报告）。';
export const inputSchema = { type: 'object', properties: { bookId: { type: 'string' } }, required: ['bookId'] };

export async function handler(args) {
  const bookId = String(args.bookId || '');
  const state = await readState(bookId);
  if (!state) return '书不存在';
  const chapters = [];
  for (const c of state.chapters) {
    const body = await readChapter(bookId, c.index);
    chapters.push({ ...c, body: body || '' });
  }
  const html = renderReport(state, chapters);
  const p = reportPath(bookId);
  await mkdir(join(p, '..'), { recursive: true });
  await writeFile(p, html, 'utf8');
  return '报告已生成：' + p;
}
```

- [ ] **Step 5: 跑测试确认通过**

Run: `node --test tests/tools-report.test.js`
Expected: `# pass 6`，`# fail 0`

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: HTML 报告（纸墨设计系统，自包含单文件）"
```

---

### Task 11: 冒烟测试脚本

**Files:**
- Create: `scripts/smoke-test.mjs`

**Interfaces:**
- Consumes: `server/index.js`（完整 MCP server）
- Produces: `node scripts/smoke-test.mjs` 全流程验证，成功打印 `SMOKE PASS` 退出码 0，失败打印错误退出码 1

- [ ] **Step 1: 写 smoke-test.mjs**

```js
import { spawn } from 'node:child_process';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';

const SERVER = join(dirname(fileURLToPath(import.meta.url)), '..', 'server', 'index.js');
const root = mkdtempSync(join(tmpdir(), 'ninglet-smoke-'));
const CLEAN = '雨下了一夜。第二天清早，他推开窗，看见巷口有人支起了油条摊子。摊主是个哑巴，打手势问他要几根。他伸出两根手指。油锅里的面圈翻了个身，滋滋响着，把整条巷子都染成了早饭的味道。';

const proc = spawn(process.execPath, [SERVER], {
  env: { ...process.env, NINGLET_ROOT: root },
  stdio: ['pipe', 'pipe', 'inherit'],
});
const rl = createInterface({ input: proc.stdout });
const pending = new Map();
let nextId = 1;
rl.on('line', (line) => {
  const msg = JSON.parse(line);
  if (pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
});

function rpc(method, params) {
  const id = nextId++;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
}

function fail(msg) {
  console.error('SMOKE FAIL: ' + msg);
  proc.kill();
  process.exit(1);
}

function ok(msg) { console.log('  ✓ ' + msg); }

async function call(name, args) {
  const res = await rpc('tools/call', { name, arguments: args });
  if (res.error) fail(name + ' → ' + res.error.message);
  if (res.result.isError) fail(name + ' → ' + res.result.content[0].text);
  return res.result.content[0].text;
}

const init = await rpc('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'smoke', version: '0' } });
if (!init.result || init.result.serverInfo.name !== 'ninglet') fail('initialize 握手失败');
ok('initialize 握手 OK（protocolVersion ' + init.result.protocolVersion + '）');

const tools = await rpc('tools/list', {});
if (tools.result.tools.length !== 8) fail('tools/list 应有 8 个工具，实际 ' + tools.result.tools.length);
ok('tools/list 返回 8 个工具');

const created = await call('novel_create_book', { title: '烟雨楼', genre: '市井', brief: '巷口早点摊的江湖' });
if (!created.includes('bookId=yan-yu-lou')) fail('建书返回异常：' + created);
ok('建书 OK：' + created);

const settled = await call('novel_settle_chapter', {
  bookId: 'yan-yu-lou', body: CLEAN, title: '第一章 油条摊',
  summary: '雨夜后主角遇见哑巴摊主。',
  characters: [{ name: '阿哑', role: '配角', desc: '油条摊主' }],
  hooks: [{ name: '阿哑的来历', status: 'open', note: '似有隐情' }],
});
if (!settled.includes('第 1 章完成')) fail('结算异常：' + settled);
ok('结算 OK：' + settled);

const strict = await rpc('tools/call', { name: 'novel_settle_chapter', arguments: { bookId: 'yan-yu-lou', body: '他心中一凛。' } });
if (!strict.result.isError || !strict.result.content[0].text.includes('拒绝落盘')) fail('严格扫描未生效');
ok('严格扫描 OK：命中禁用词被拒绝落盘');

const report = await call('novel_generate_report', { bookId: 'yan-yu-lou' });
const reportFile = join(root, 'novels', 'yan-yu-lou', 'report.html');
if (!existsSync(reportFile)) fail('报告文件不存在');
if (!readFileSync(reportFile, 'utf8').includes('烟雨楼')) fail('报告内容缺失');
ok('报告 OK：' + report);

const stateRaw = readFileSync(join(root, 'novels', 'yan-yu-lou', 'story', 'state', 'state.json'), 'utf8');
const state = JSON.parse(stateRaw);
if (state.book.nextChapterIndex !== 2 || state.chapters.length !== 1) fail('状态机推进异常');
ok('状态机 OK：nextChapterIndex=2，章节数=1');

proc.kill();
console.log('\nSMOKE PASS');
```

- [ ] **Step 2: 运行冒烟测试**

Run: `node scripts/smoke-test.mjs`
Expected: 输出 7 行 `✓` + `SMOKE PASS`，退出码 0

- [ ] **Step 3: 跑全量测试**

Run: `node --test tests/*.test.js`
Expected: 全部通过（基线 27 + parity 39 + books 8 + create 4 + scan 4 + settle 5 + memory 8 + read 5 + mcp 5 + report 6 = `# pass 111`，`# fail 0`）

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test: 冒烟测试（MCP 握手 + 建书写章全流程）"
```

---

### Task 12: 5 个 skill 的移植与适配

**Files:**
- Create: `skills/anti-ai-flavor/SKILL.md`、`skills/longform-writing/SKILL.md`、`skills/novel-qa/SKILL.md`、`skills/novel-outline-researcher/SKILL.md`、`skills/novel-style-reference/SKILL.md` 及附带目录（从 dsh 复制后改写）
- Create: `skills/novel-outline-researcher/references/handoff-to-ninglet.md`（新），Delete: `skills/novel-outline-researcher/references/handoff-to-novel-studio.md`
- Test: `tests/skills.test.js`

**Interfaces:**
- Consumes: dsh 仓库 `skills/` 目录
- Produces: `skills/` 下 5 个 Claude Code skill（frontmatter 含 name + description）；全部内容不含 `novel-studio`、`dsh` 字样；longform-writing 提到 `novel_settle_chapter`/`novel_scan_chapter`；anti-ai-flavor 提到 `novel_scan_chapter`

- [ ] **Step 1: 复制 skills 目录**

```bash
cd "D:\github项目\AI小说\NINGLET-Claudecode"
cp -r ../NINGLET-dsh/skills/. skills/
rm skills/novel-outline-researcher/references/handoff-to-novel-studio.md
```

- [ ] **Step 2: 写失败测试 skills.test.js**

```js
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const skillsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills');

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

const files = walk(skillsDir);
assert.ok(files.length >= 10, 'skills 文件数异常');

for (const f of files) {
  test('无框架残留引用：' + f.replace(skillsDir, ''), () => {
    const text = readFileSync(f, 'utf8');
    assert.ok(!text.includes('novel-studio'), f + ' 含 novel-studio');
    assert.ok(!/dsh/i.test(text), f + ' 含 dsh');
  });
}

for (const s of ['anti-ai-flavor', 'longform-writing', 'novel-qa', 'novel-outline-researcher', 'novel-style-reference']) {
  test('frontmatter 合法：' + s, () => {
    const text = readFileSync(join(skillsDir, s, 'SKILL.md'), 'utf8');
    const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    assert.ok(m, s + ' 缺 frontmatter');
    assert.ok(/^name:\s*\S+$/m.test(m[1]), s + ' 缺 name');
    assert.ok(/^description:\s*\S+$/m.test(m[1]), s + ' 缺 description');
  });
}

test('longform-writing 引用结算/扫描工具', () => {
  const text = readFileSync(join(skillsDir, 'longform-writing', 'SKILL.md'), 'utf8');
  assert.ok(text.includes('novel_settle_chapter'));
  assert.ok(text.includes('novel_scan_chapter'));
});

test('anti-ai-flavor 引用扫描工具', () => {
  const text = readFileSync(join(skillsDir, 'anti-ai-flavor', 'SKILL.md'), 'utf8');
  assert.ok(text.includes('novel_scan_chapter'));
});

test('handoff-to-ninglet.md 存在', () => {
  assert.ok(existsSync(join(skillsDir, 'novel-outline-researcher', 'references', 'handoff-to-ninglet.md')));
});
```

- [ ] **Step 3: 跑测试确认失败**

Run: `node --test tests/skills.test.js`
Expected: FAIL（dsh 原版含 novel-studio 引用）

- [ ] **Step 4: 改写 longform-writing/SKILL.md（整体替换）**

用以下完整内容覆盖 `skills/longform-writing/SKILL.md`：

```markdown
---
name: longform-writing
description: 长篇小说的章节生产工作流与写作规则：规划→编排→写作→审计→修订→结算（配合 novel_scan_chapter / novel_settle_chapter 工具），及章节结构、钩子设计、节奏控制、对话写作等网文准则。触发：「写下一章」「写第X章」「继续写」。
---

# 长篇写作规则（NINGLET · Claude Code）

## 章节生产工作流

每章按序执行：

1. **plan —— 苏格拉底规划**：用户未给本章意图时，先问三问——本章核心推进什么 / 主角什么状态 / 结尾留什么钩子。意图写入 `novels/<bookId>/story/runtime/chapter-NNN.intent.md`（NNN = 章号三位补零）。
2. **compose —— 组装上下文**：读 `novels/<bookId>/story/state/state.json`（近 5 章摘要、角色表、伏笔表、大纲），必要时读前几章正文。
3. **write —— 生成草稿**：注入 anti-ai-flavor 规则 + 字数目标（CJK ≥2000 字）。
4. **audit —— 确定性检测**：调用 `novel_scan_chapter` 工具（禁用词 / 的密度 / 句长方差）。
5. **revise —— 修订**：有 hits 时按清单改写，改写后必须重新 `novel_scan_chapter` 确认。
6. **settle —— 结算**：调用 `novel_settle_chapter` 工具落盘（严格：0 hits 才落盘，坏数据拒绝写入）。参数带上观察者抽取的 summary / characters / hooks。
7. **观察者**：写完后抽取——本章摘要（80 字内，事件+结果）、新角色（名/定位/一句话）、伏笔（名/状态 open|progressing|resolved/一句话）。回收了旧伏笔时，另行调用 `novel_update_memory` 工具更新状态。
8. **回看**：用户要求时调用 `novel_generate_report` 生成 HTML 报告，浏览器打开。

## 写作规则（通用）

- 开头第一屏要有钩子，章尾留悬念（钩子 ledger 回收）。
- 章节要有"密度"：靠意义与场景推进，不是靠切碎段落。
- 段落节奏：长短交替；连续短段要有意义，不为切而切。
- 人物行动要有动机，避免无目的的 idle 描写与报告式流水账。
- 信息只给当前视角角色该知道的，避免上帝视角信息泄漏。
- 对话要有目的（推进 / 揭示 / 冲突），不要为凑字数闲聊。

## 章节结构

- 单章 2000 字结构：开头 200 字直接进事件 / 中间 1400 字冲突升级+一次以上转折 / 结尾 400 字节奏加快+最后一句留悬念。
- 前 20% 定生死；开头致命错误：天气描写 / 日常流程 / 回顾上章 / 缓慢铺垫 / 平淡对话 / 过度解释。
- 标准结构：开头钩子(10%) → 发展(60%) → 高潮(20%) → 结尾悬念(10%)。

## 钩子设计

- 悬念钩子十三式（精简）：突然揭示 / 紧急危机 / 未完成动作 / 身份反转 / 两难选择 / 神秘物品 / 时间限制 / 承诺威胁 / 离奇消失 / 言外之意 / 意象钩子 / 回声钩子 / 留白钩子。
- 单章三段式悬念：播种(前 20%) → 生长(中 60-70%) → 收获(最后 10%)。
- 跨章悬念弧：短弧 2-3 章 / 中弧 5-8 章 / 长弧全书，三弧并行。
- 悬念禁忌：虚假悬念 / 机械降神 / 过度留白 / 低风险钩子 / 同质悬念。
- **读者翻开下一章的理由，永远要在这一章的结尾给够。**

## 节奏控制

- 长短句交替（连续三句长度相同就必须打破）；段落呼吸；信息密度波浪（连续三段高密度=疲劳，连续三段低密度=无聊）。
- 水章诊断（满足任意 3 条即需大改）：人物状态无变化 / 无新信息揭露 / 无冲突张力 / 主要内容是回忆说明 / 章末无前向驱动 / 读后记不住任何内容。
- 情绪债务-回收：读者阅读驱动力 = 情绪债务的积累与释放；小爽点每 2-3 章 / 中爽点每 8-10 章 / 大爽点每 30-40 章；担忧型最多 5 章内回收 / 委屈型 10 章内缓解 / 期待型最多 30 章。

## 对话写作

- 对话目的：推情节 / 揭人物 / 造冲突 / 传信息 / 表情感 / 造悬念；对话占比 ≥30%。
- 真实对话不完整：打断 / 迟疑 / 话题转移 / 话没说完 / 暗示而非明说。
- 潜台词四技巧：话题转移 / 反问而非回答 / 谈论其他事物 / 沉默和动作。

## 内容扩充（防注水）

- 六技法：场景肌理充实 / 关键时刻放慢 / 内心世界展开 / 对话层次丰富 / 次要情节穿插 / 感官维度叠加。
- 防注水判断："**删掉这段扩充，故事是否变差？**"如果否 = 注水。

## 质量制度

- 三章一轮：每 3 章跑一次 AI 指纹扫描 + 一致性检查，不达标当场修。
- 信息密度：对话 ≥30%、动作/冲突 ≥30%、感官 ≥25%、纯讲解 ≤15%。
- 章节差异性三要素：每章 ≥1 个独特场景 + 1 个独特对话 + 1 个独特意象。
- 角色语音卡：核心角色各建语音卡，盲测去掉名字仍能分辨。

## 摘要要求

每章结算时生成结构化摘要：事件、角色状态变化、伏笔埋设/回收、结尾状态。
```

- [ ] **Step 5: 改写 anti-ai-flavor/SKILL.md（两处 Edit）**

Edit 1 —— 用法段落：
- old:
```
## 用法

- 生成前：把 §一~§六 的硬约束原样注入写手提示词（从源头不让 AI 犯）。
- 落盘前：对正文跑确定性检测（禁用词/的密度/句长方差），不通过则自动重写一次。
- 修订：只输出修订后正文，不输出评论/解释/要点/修改说明。
```
- new:
```
## 用法（Claude Code）

- 生成前：把 §一~§六 的硬约束原样注入写手提示词（从源头不让 AI 犯）。
- 落盘前：调用 `novel_scan_chapter` 工具跑确定性检测（禁用词/的密度/句长方差）；有 hits 则修订并重新扫描。
- `novel_settle_chapter` 工具终审强制 0 hits 才落盘（严格模式），不要试图绕过。
- 修订：只输出修订后正文，不输出评论/解释/要点/修改说明。
```

Edit 2 —— 检查方法第一条：
- old: `- **三章一轮**：每写完 3 章立即跑 AI 指纹扫描（不是X是Y次数/破折号数/AI 口水词密度/CJK），不达标当场修。`
- new: `- **三章一轮**：每写完 3 章立即跑 AI 指纹扫描——机器项（禁用词/的密度/句长方差）调 \`novel_scan_chapter\` 工具；人工项（不是X是Y次数/破折号数/口水词密度）对照 §一 自查，不达标当场修。`

- [ ] **Step 6: 改写 novel-qa/SKILL.md（一处 Edit）**

- old:
```
**关键区分（不得误判）**：懒人心理总结（"他心想：这件事不简单"）**是** AI 特征；软性内心活动（"我越想越糊涂""我说不上来哪儿不对"）**不是**——这是真人挣扎的表现，不得标记。
```
- new:
```
**关键区分（不得误判）**：懒人心理总结（"他心想：这件事不简单"）**是** AI 特征；软性内心活动（"我越想越糊涂""我说不上来哪儿不对"）**不是**——这是真人挣扎的表现，不得标记。

> 确定性指标（禁用词/的密度/句长方差）以 `novel_scan_chapter` 工具输出为准；本技能负责其余人工维度（人设/时间线/逻辑/伏笔等）。
```

- [ ] **Step 7: 改写 novel-outline-researcher/SKILL.md（五处 Edit）**

Edit 1（description 尾句）：
- old: `可与 novel-studio 衔接。`
- new: `可与 NINGLET 书库（novels/<bookId>/）衔接。`

Edit 2（§1.1 边界）：
- old:
```
### 1.1 边界
- 不写章节正文；不直接修改 novel-studio 项目文件。
- 输出为用户确认后可粘贴到 `dagang.md` 或交 novel-studio 使用。
- 报告落盘：用户明确说「出报告/保存报告/输出到 reports」时，将最终版本写入 `reports/` 目录。
```
- new:
```
### 1.1 边界
- 不写章节正文；不直接修改书库状态文件（`novels/<bookId>/story/state/state.json` 只能由 novel_* 工具落盘）。
- 输出为用户确认后，大纲可经 `novel_update_memory` 工具的 outline 参数写入书库。
- 报告落盘：用户明确说「出报告/保存报告」时，将最终版本写入 `novels/<bookId>/reports/` 目录。
```

Edit 3（§2 Step 0 强制读取清单）：
- old:
```
**强制读取清单**（按目标范围调整）：
1. `meta.md`：类型、风格、主题。
2. `outline.md`：目标章节段 + 前 2 章 + 后 2 章（若改第 25–32 章，则读 23–34 章段及整体脉络）。
3. `characters.md`：目标章涉及的人物及直接牵连人物（如改某角色线，须读该角色及关联人物）。
4. `timeline.md`：目标章所在幕的时间锚点及前后事件。
5. 若项目有 `spaces.md` 且目标章涉及常现场景：读取，避免调研方案与空间布局矛盾。
6. 若对应章节已有正文：读取 `chapters/chapter_xx.md`，避免与正文脱节。
7. 若有 `dagang.md` 的 `## 待更新内容`：读取，掌握用户最新意图。
```
- new:
```
**强制读取清单**（按目标范围调整）：
1. `novels/<bookId>/story/state/state.json`：书的 genre/brief（类型、风格、主题）、outline、characters、hooks、summaries（近章摘要）。
2. `outline`：目标章节段 + 前 2 章 + 后 2 章（若改第 25–32 章，则读 23–34 章段及整体脉络）。
3. `characters`：目标章涉及的人物及直接牵连人物（如改某角色线，须读该角色及关联人物）。
4. 若对应章节已有正文：读取 `novels/<bookId>/chapters/NNN.md`（NNN 三位补零）及相邻章，避免与正文脱节。
5. 若存在 `novels/<bookId>/story/runtime/chapter-NNN.intent.md`：读取，掌握用户最新意图。
```

Edit 4（§3 场景 A 落盘行）：
- old: `- **落盘**：\`reports/[书名或项目名]-开题调研报告-[YYYYMMDD].md\`。`
- new: `- **落盘**：\`novels/<bookId>/reports/[书名或项目名]-开题调研报告-[YYYYMMDD].md\`。`

Edit 5（§3 场景 B 落盘行）：
- old: `- **落盘**：\`reports/[书名或项目名]-续写策略报告-[YYYYMMDD].md\`（仅当用户要求保存时）。`
- new: `- **落盘**：\`novels/<bookId>/reports/[书名或项目名]-续写策略报告-[YYYYMMDD].md\`（仅当用户要求保存时）。`

Edit 6（§3 场景 C 落盘行）：
- old: `- **落盘**：\`reports/[书名或项目名]-改写策略报告-[YYYYMMDD].md\`（仅当用户要求保存时）。`
- new: `- **落盘**：\`novels/<bookId>/reports/[书名或项目名]-改写策略报告-[YYYYMMDD].md\`（仅当用户要求保存时）。`

Edit 7（§6 整节替换）：
- old:
```
## 6. 输出与 novel-studio 衔接

- **开题输出**：长报告可放入 `dagang.md` 的 `## 待更新内容`，通过「更新 [项目名] 的设定」同步。
- **续写 / 改写 / 章节规划**：短版章节方案可直接用于指导写作，或经用户删减后粘贴到 outline；用户需要时再展开成长报告并落盘。
- **可选 QA 衔接**：改写落地后，可建议用户使用 novel-qa Skill 对人设、时间线、空间布置、伏笔等做一致性检查。
- 分步迁移见 [references/handoff-to-novel-studio.md](references/handoff-to-novel-studio.md)。
- **报告命名**：
  - 开题：`[书名或项目名]-开题调研报告-[YYYYMMDD].md`
  - 续写：`[书名或项目名]-续写策略报告-[YYYYMMDD].md`
  - 改写：`[书名或项目名]-改写策略报告-[YYYYMMDD].md`
```
- new:
```
## 6. 输出与 NINGLET 书库衔接

- **开题输出**：大纲确认后，调用 `novel_update_memory` 工具（outline 参数，每项 {index, title}）写入书库状态。
- **续写 / 改写 / 章节规划**：短版章节方案可直接用于指导写作（longform-writing 技能），或经用户删减后更新 outline；用户需要时再展开成长报告并落盘。
- **可选 QA 衔接**：改写落地后，可建议用户使用 novel-qa 技能对人设、时间线、伏笔等做一致性检查。
- 分步交接见 [references/handoff-to-ninglet.md](references/handoff-to-ninglet.md)。
- **报告命名**（均写入 `novels/<bookId>/reports/`）：
  - 开题：`[书名或项目名]-开题调研报告-[YYYYMMDD].md`
  - 续写：`[书名或项目名]-续写策略报告-[YYYYMMDD].md`
  - 改写：`[书名或项目名]-改写策略报告-[YYYYMMDD].md`
```

- [ ] **Step 8: 写 handoff-to-ninglet.md（替换被删文件）**

`skills/novel-outline-researcher/references/handoff-to-ninglet.md`：

```markdown
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
```

- [ ] **Step 9: 改写 novel-style-reference/SKILL.md（五处 Edit）**

Edit 1：
- old: `本 Skill 支持两种用法：**学习**（从原文提炼并保存某作品的叙事风格）、**引用**（写小说时按作品名加载该风格作为参考）。可与 novel-studio 配合使用。`
- new: `本 Skill 支持两种用法：**学习**（从原文提炼并保存某作品的叙事风格）、**引用**（写小说时按作品名加载该风格作为参考）。可与 NINGLET 写章流程配合使用。`

Edit 2：
- old: `**触发**：用户说「引用《伊豆的舞女》的叙事风格」「按伊豆的舞女的风格写」「参考 XXX 的叙事风格」等（包括在写 novel-studio 某章时附带此类要求）。`
- new: `**触发**：用户说「引用《伊豆的舞女》的叙事风格」「按伊豆的舞女的风格写」「参考 XXX 的叙事风格」等（包括在写 NINGLET 书库某章时附带此类要求）。`

Edit 3：
- old: `## 四、与 novel-studio 配合`
- new: `## 四、与 NINGLET 写章流程配合`

Edit 4：
- old: `1. 按 novel-studio 的章节写作流程：读取该项目的 meta、outline、timeline、characters 及前文。`
- new: `1. 按 longform-writing 技能的章节写作流程：读取 novels/<bookId>/story/state/state.json（brief/outline/characters/summaries）及前文章节正文。`

Edit 5：
- old: `3. 将**项目设定与前文**与**风格文档**一并作为写作依据：情节、人物、时间线服从 novel-studio 设定，叙事风格（视角、节奏、句式、氛围等）服从所引用的风格文档。`
- new: `3. 将**项目设定与前文**与**风格文档**一并作为写作依据：情节、人物、时间线服从书库状态设定，叙事风格（视角、节奏、句式、氛围等）服从所引用的风格文档。`

- [ ] **Step 10: 跑测试确认通过**

Run: `node --test tests/skills.test.js`
Expected: `# pass`（全部 skill 测试），`# fail 0`。若有残留 `novel-studio`/`dsh` 引用，按失败信息逐个清理（输出会给出具体文件路径）

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: 5 个 skill 移植为 Claude Code 版（NINGLET 工具流适配）"
```

---

### Task 13: README + docs/PORT.md

**Files:**
- Create: `README.md`、`docs/PORT.md`

**Interfaces:**
- Consumes: 无（文档任务）
- Produces: 面向用户的安装文档（3 步安装 + 快速开始 + 故障排查）；与 dsh 版差异说明

- [ ] **Step 1: 写 README.md**

```markdown
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
node --test tests/   # 单测 + 集成 + parity，全绿
```

## License

MIT
```

- [ ] **Step 2: 写 docs/PORT.md**

```markdown
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
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "docs: README（安装/快速开始/故障排查）+ PORT（与 dsh 差异）"
```

---

### Task 14: 全量验证 + dsh 互通实测

**Files:**
- 无新文件（如发现问题则修复对应文件）

**Interfaces:**
- Consumes: 全部既有模块
- Produces: 全绿测试 + 互通验证记录

- [ ] **Step 1: 全量测试**

Run: `node --test tests/*.test.js`
Expected: `# pass 109+`，`# fail 0`

- [ ] **Step 2: 冒烟测试**

Run: `node scripts/smoke-test.mjs`
Expected: `SMOKE PASS`

- [ ] **Step 3: dsh 互通实测（手工验证，输出记录到提交信息）**

```bash
cd "D:\github项目\AI小说\NINGLET-Claudecode"
# 建一本测试书（走 Claude Code server 路径）
NINGLET_ROOT=$(mktemp -d) node -e "
import('./server/books.js').then(async ({ writeState }) => {
  await writeState('hu-tong-xiao-chi', {
    book: { bookId: 'hu-tong-xiao-chi', title: '胡同小吃', genre: '', brief: '', targetChapters: 50, chapterWords: 2000, nextChapterIndex: 3 },
    chapters: [
      { index: 1, title: '第一章', wordCount: 2100, filePath: 'novels/hu-tong-xiao-chi/chapters/001.md', aiTasteScore: 95, status: 'approved' },
      { index: 2, title: '第二章', wordCount: 2200, filePath: 'novels/hu-tong-xiao-chi/chapters/002.md', aiTasteScore: 88, status: 'revised' },
    ],
    summaries: [], hooks: [], characters: [], outline: [],
  });
  console.log('已构造 dsh 风格书（含 revised 状态章节，模拟 dsh 侧产出）');
});"
```

然后人工确认（用 node 断言）：
```bash
NINGLET_ROOT=$(mktemp -d) node -e "
import('./server/engine/state-schema.js').then(({ validateState }) => {
  const dshStyle = { book: { bookId: 'b', title: 'B', targetChapters: 5, chapterWords: 100, nextChapterIndex: 2 }, chapters: [{ index: 1, title: '第一章', wordCount: 100, filePath: 'chapters/001.md', aiTasteScore: 88, status: 'revised' }], summaries: [], hooks: [] };
  const r = validateState(dshStyle);
  if (!r.ok) { console.error('互通校验失败：' + r.errors.join('; ')); process.exit(1); }
  console.log('互通验证 OK：dsh 侧 revised 状态章节可被 Claude Code 版读取校验');
});"
```

Expected: 输出 `互通验证 OK：...`

- [ ] **Step 4: 最终 Commit 与推送准备**

```bash
git add -A
git commit -m "verify: 全量测试 + 冒烟 + dsh 互通实测通过" --allow-empty
git log --oneline
```

Expected: 14 个提交，工作区干净

---

## 完成定义

- `node --test tests/*.test.js` 全绿（≥111 项）
- `node scripts/smoke-test.mjs` 输出 `SMOKE PASS`
- `git status` 干净，提交历史 14 条左右
- 与 dsh 互通：同一 schema 的 state 可被两边读取（Task 14 实测）
- README 三步安装可用（`claude mcp add` + 复制 skills + 冒烟）
