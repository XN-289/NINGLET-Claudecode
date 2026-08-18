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
      try {
        const text = await tool.handler(params.arguments || {});
        return { content: [{ type: 'text', text }], isError: false };
      } catch (e) {
        return { content: [{ type: 'text', text: e.message }], isError: true };
      }
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
