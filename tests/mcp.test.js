import { test } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import { makeBookId } from '../server/engine/book-id.js';

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
  const { proc, rpc, notify } = startServer();
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
  assert.ok(created.result.content[0].text.includes('bookId=' + makeBookId('烟雨楼')));
  const settled = await rpc('tools/call', { name: 'novel_settle_chapter', arguments: { bookId: makeBookId('烟雨楼'), body: CLEAN } });
  assert.equal(settled.result.isError, false);
  assert.ok(settled.result.content[0].text.includes('第 1 章完成'));
  const listed = await rpc('tools/call', { name: 'novel_list_chapters', arguments: { bookId: makeBookId('烟雨楼') } });
  assert.equal(JSON.parse(listed.result.content[0].text).length, 1);
  proc.kill();
});

test('工具错误 → isError 响应', async () => {
  const { proc, rpc } = startServer();
  await rpc('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '0' } });
  const res = await rpc('tools/call', { name: 'novel_settle_chapter', arguments: { bookId: makeBookId('烟雨楼'), body: CLEAN + '他心中一凛。' } });
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
