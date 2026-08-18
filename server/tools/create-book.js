import { makeBookId } from '../engine/book-id.js';
import { readState, writeState } from '../books.js';

export const name = 'novel_create_book';
export const description = '创建一本新小说：生成安全 bookId 并初始化书库状态文件（novels/<bookId>/story/state/state.json）。同名书已存在时拒绝覆盖。';
export const inputSchema = {
  type: 'object',
  properties: {
    title: { type: 'string', description: '书名（≤50 字）' },
    genre: { type: 'string', description: '类型（可选）' },
    brief: { type: 'string', description: '创作简报（可选，存入书状态供大纲生成参考）' },
  },
  required: ['title'],
};

export async function handler(args) {
  const title = String(args.title || '').trim();
  if (!title) throw new Error('title 不能为空');
  if (title.length > 50) throw new Error('title 过长（≤50 字）');
  const bookId = makeBookId(title);
  const existing = await readState(bookId);
  if (existing) return '书已存在：' + bookId + '（不覆盖）';
  const state = {
    book: {
      bookId, title, genre: args.genre || '', brief: args.brief || '',
      targetChapters: 50, chapterWords: 2000, nextChapterIndex: 1,
    },
    chapters: [], summaries: [], hooks: [], characters: [], outline: [],
  };
  await writeState(bookId, state);
  return '已创建书《' + title + '》bookId=' + bookId + '，状态写入 novels/' + bookId + '/story/state/state.json'
    + (args.brief ? '。已存创作简报，可用 novel-outline-researcher 技能生成大纲后经 novel_update_memory 落盘' : '');
}
