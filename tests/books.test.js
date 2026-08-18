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
