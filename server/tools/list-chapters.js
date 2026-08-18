import { readState } from '../books.js';

export const name = 'novel_list_chapters';
export const description = '列出某本书的全部章节（章号/标题/字数/AI味评分）。';
export const inputSchema = {
  type: 'object',
  properties: { bookId: { type: 'string', description: '书 ID' } },
  required: ['bookId'],
};

export async function handler(args) {
  const state = await readState(String(args.bookId || ''));
  if (!state) return '书不存在';
  return JSON.stringify(state.chapters.map((c) => ({ index: c.index, title: c.title, wordCount: c.wordCount, score: c.aiTasteScore })));
}
