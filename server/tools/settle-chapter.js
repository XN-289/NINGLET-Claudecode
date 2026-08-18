import { detectAI } from '../engine/anti-ai-engine.js';
import { countWords } from '../engine/word-count.js';
import { applyChapterDelta } from '../engine/state-reducer.js';
import { validateState } from '../engine/state-schema.js';
import { readState, writeState, writeChapter } from '../books.js';
import { mergeMemory } from './update-memory.js';

export const name = 'novel_settle_chapter';
export const description = '章节终审结算（严格）：反 AI 味扫描必须 0 命中才落盘。写 chapters/NNN.md、合并摘要/角色/伏笔、推进状态机，一次调用原子完成；坏数据拒绝写入。';
export const inputSchema = {
  type: 'object',
  properties: {
    bookId: { type: 'string', description: '书 ID（novel_create_book 返回）' },
    body: { type: 'string', description: '章节正文全文（终稿）' },
    title: { type: 'string', description: '章节标题（可选，默认 第N章）' },
    summary: { type: 'string', description: '观察者抽取的本章摘要（80 字内，可选）' },
    characters: {
      type: 'array',
      items: { type: 'object', properties: { name: { type: 'string' }, role: { type: 'string' }, desc: { type: 'string' } }, required: ['name'] },
      description: '本章新角色（可选）',
    },
    hooks: {
      type: 'array',
      items: { type: 'object', properties: { name: { type: 'string' }, status: { type: 'string' }, note: { type: 'string' } }, required: ['name'] },
      description: '本章伏笔（可选，status 取值 open/progressing/resolved）',
    },
  },
  required: ['bookId', 'body'],
};

export async function handler(args) {
  const bookId = String(args.bookId || '');
  const body = String(args.body || '');

  const ai = detectAI(body);
  if (ai.hits.length > 0) {
    const detail = ai.hits.map((h) => '[' + h.rule + '] ' + h.detail).join('；');
    throw new Error('反 AI 味扫描未通过，拒绝落盘（得分 ' + ai.score + '）。命中：' + detail + '。请按 anti-ai-flavor 技能规则修订后重新结算。');
  }

  const state = await readState(bookId);
  if (!state) return '书 ' + bookId + ' 不存在，请先 novel_create_book';
  const index = state.book.nextChapterIndex;

  const chapter = {
    index,
    title: args.title || '第' + index + '章',
    wordCount: countWords(body),
    filePath: 'novels/' + bookId + '/chapters/' + String(index).padStart(3, '0') + '.md',
    aiTasteScore: ai.score,
    status: 'approved',
  };

  // state-reducer 只保留 book/chapters/summaries/hooks，characters/outline 需回挂（与 dsh 落盘行为一致）
  let next = applyChapterDelta(state, chapter);
  next = { ...next, characters: state.characters || [], outline: state.outline || [] };
  if (args.summary) {
    next.summaries = next.summaries.concat([{ index, text: String(args.summary) }]);
  }
  next = mergeMemory(next, args.characters || [], args.hooks || []);

  // 校验先行：任何校验失败都不写任何文件
  const v = validateState(next);
  if (!v.ok) throw new Error('状态非法，拒绝写入：' + v.errors.join('; '));

  await writeChapter(bookId, index, body);
  await writeState(bookId, next);
  return '第 ' + index + ' 章完成：字数 ' + chapter.wordCount + '，AI味评分 ' + ai.score + '，落盘 ' + chapter.filePath;
}
