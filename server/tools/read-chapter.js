import { readChapter } from '../books.js';

export const name = 'novel_read_chapter';
export const description = '读取某一章正文全文。';
export const inputSchema = {
  type: 'object',
  properties: {
    bookId: { type: 'string', description: '书 ID' },
    index: { type: 'number', description: '章节号（从 1 开始）' },
  },
  required: ['bookId', 'index'],
};

export async function handler(args) {
  const body = await readChapter(String(args.bookId || ''), args.index);
  return body === null ? '章节不存在' : body;
}
