import { test } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { handler as createBook } from '../server/tools/create-book.js';
import { name, handler } from '../server/tools/settle-chapter.js';
import { statePath, chapterPath } from '../server/books.js';
import { makeBookId } from '../server/engine/book-id.js';

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
  const out = await createBook({ title: '烟雨楼' });
  const bookId = out.match(/bookId=([a-z0-9-]+)/)[1];
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
  const out = await createBook({ title: '烟雨楼' });
  const bookId = out.match(/bookId=([a-z0-9-]+)/)[1];
  await handler({ bookId, body: CLEAN });
  const res = await handler({ bookId, body: CLEAN });
  assert.ok(res.includes('第 2 章完成'));
  assert.ok(existsSync(chapterPath(bookId, 2)));
});

test('元数据', () => {
  assert.equal(name, 'novel_settle_chapter');
});
