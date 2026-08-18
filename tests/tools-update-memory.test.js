import { test } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { handler as createBook } from '../server/tools/create-book.js';
import { name, handler } from '../server/tools/update-memory.js';
import { statePath } from '../server/books.js';
import { makeBookId } from '../server/engine/book-id.js';

function tempRoot() {
  const dir = mkdtempSync(join(tmpdir(), 'ninglet-mem-'));
  process.env.NINGLET_ROOT = dir;
  return dir;
}

async function setup() {
  tempRoot();
  await createBook({ title: '烟雨楼' });
  return makeBookId('烟雨楼');
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
