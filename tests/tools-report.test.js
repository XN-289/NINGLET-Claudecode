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
import { makeBookId } from '../server/engine/book-id.js';

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
    bookId: makeBookId('烟雨楼'), body: CLEAN, title: '第一章 油条摊',
    summary: '雨夜后主角遇见哑巴摊主。', characters: [{ name: '阿哑', role: '配角', desc: '油条摊主' }],
    hooks: [{ name: '阿哑的来历', status: 'open', note: '似有隐情' }],
  });
  return makeBookId('烟雨楼');
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
