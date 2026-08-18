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
import { makeBookId } from '../server/engine/book-id.js';

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
  await settle({ bookId: makeBookId('烟雨楼'), body: CLEAN });
  const out = JSON.parse(await listChapters({ bookId: makeBookId('烟雨楼') }));
  assert.equal(out.length, 1);
  assert.equal(out[0].index, 1);
  assert.equal(out[0].score, 100);
  assert.ok(out[0].wordCount > 0);
});

test('read_chapter 读回正文与错误路径', async () => {
  tempRoot();
  await createBook({ title: '烟雨楼' });
  await settle({ bookId: makeBookId('烟雨楼'), body: CLEAN });
  assert.equal(await readChapter({ bookId: makeBookId('烟雨楼'), index: 1 }), CLEAN);
  assert.ok((await readChapter({ bookId: makeBookId('烟雨楼'), index: 9 })).includes('章节不存在'));
  await assert.rejects(readChapter({ bookId: '../etc', index: 1 }), /unsafe bookId/);
});

test('元数据', () => {
  assert.equal(lbName, 'novel_list_books');
  assert.equal(lcName, 'novel_list_chapters');
  assert.equal(rcName, 'novel_read_chapter');
});
