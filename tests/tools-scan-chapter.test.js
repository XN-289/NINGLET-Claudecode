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
