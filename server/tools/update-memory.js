import { readState, writeState } from '../books.js';

export function mergeMemory(state, chars, hooks) {
  const out = { ...state };
  const cs = (out.characters || []).slice();
  for (const c of chars) {
    if (!c || !c.name) continue;
    if (!cs.some((x) => x.name === c.name)) {
      cs.push({ name: String(c.name), role: String(c.role || ''), desc: String(c.desc || '') });
    }
  }
  out.characters = cs;
  const hs = (out.hooks || []).slice();
  for (const h of hooks) {
    if (!h || !h.name) continue;
    const ex = hs.find((x) => x.name === h.name);
    const status = (h.status === 'progressing' || h.status === 'resolved') ? h.status : 'open';
    if (ex) ex.status = status;
    else hs.push({ name: String(h.name), status, note: String(h.note || '') });
  }
  out.hooks = hs;
  return out;
}

export const name = 'novel_update_memory';
export const description = '独立更新书库记忆：摘要（追加）、角色（按名去重合并）、伏笔（按名更新状态 open/progressing/resolved）、大纲（整体替换）。校验后落盘。';
export const inputSchema = {
  type: 'object',
  properties: {
    bookId: { type: 'string', description: '书 ID' },
    summary: { type: 'string', description: '要追加的摘要（可选）' },
    characters: {
      type: 'array',
      items: { type: 'object', properties: { name: { type: 'string' }, role: { type: 'string' }, desc: { type: 'string' } }, required: ['name'] },
      description: '角色（按名合并，可选）',
    },
    hooks: {
      type: 'array',
      items: { type: 'object', properties: { name: { type: 'string' }, status: { type: 'string' }, note: { type: 'string' } }, required: ['name'] },
      description: '伏笔（按名更新状态，可选）',
    },
    outline: {
      type: 'array',
      items: { type: 'object', properties: { index: { type: 'number' }, title: { type: 'string' } }, required: ['title'] },
      description: '章回大纲（整体替换，可选）',
    },
  },
  required: ['bookId'],
};

export async function handler(args) {
  const bookId = String(args.bookId || '');
  const state = await readState(bookId);
  if (!state) return '书 ' + bookId + ' 不存在，请先 novel_create_book';

  let next = { ...state };
  if (args.summary) {
    next.summaries = (state.summaries || []).concat([{ index: state.book.nextChapterIndex - 1, text: String(args.summary) }]);
  }
  next = mergeMemory(next, args.characters || [], args.hooks || []);
  if (args.outline !== undefined) next.outline = args.outline;

  await writeState(bookId, next);
  return '已更新《' + state.book.title + '》记忆：'
    + (args.summary ? '摘要+1，' : '')
    + (args.characters && args.characters.length ? '角色' + args.characters.length + '，' : '')
    + (args.hooks && args.hooks.length ? '伏笔' + args.hooks.length + '，' : '')
    + (args.outline !== undefined ? '大纲已替换，' : '')
    + '已落盘。';
}
