import { spawn } from 'node:child_process';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import { makeBookId } from '../server/engine/book-id.js';

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
if (!created.includes('bookId=' + makeBookId('烟雨楼'))) fail('建书返回异常：' + created);
ok('建书 OK：' + created);

const settled = await call('novel_settle_chapter', {
  bookId: makeBookId('烟雨楼'), body: CLEAN, title: '第一章 油条摊',
  summary: '雨夜后主角遇见哑巴摊主。',
  characters: [{ name: '阿哑', role: '配角', desc: '油条摊主' }],
  hooks: [{ name: '阿哑的来历', status: 'open', note: '似有隐情' }],
});
if (!settled.includes('第 1 章完成')) fail('结算异常：' + settled);
ok('结算 OK：' + settled);

const strict = await rpc('tools/call', { name: 'novel_settle_chapter', arguments: { bookId: makeBookId('烟雨楼'), body: '他心中一凛。' } });
if (!strict.result.isError || !strict.result.content[0].text.includes('拒绝落盘')) fail('严格扫描未生效');
ok('严格扫描 OK：命中禁用词被拒绝落盘');

const report = await call('novel_generate_report', { bookId: makeBookId('烟雨楼') });
const reportFile = join(root, 'novels', makeBookId('烟雨楼'), 'report.html');
if (!existsSync(reportFile)) fail('报告文件不存在');
if (!readFileSync(reportFile, 'utf8').includes('烟雨楼')) fail('报告内容缺失');
ok('报告 OK：' + report);

const stateRaw = readFileSync(join(root, 'novels', makeBookId('烟雨楼'), 'story', 'state', 'state.json'), 'utf8');
const state = JSON.parse(stateRaw);
if (state.book.nextChapterIndex !== 2 || state.chapters.length !== 1) fail('状态机推进异常');
ok('状态机 OK：nextChapterIndex=2，章节数=1');

proc.kill();
console.log('\nSMOKE PASS');
