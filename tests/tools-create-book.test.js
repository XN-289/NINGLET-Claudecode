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
