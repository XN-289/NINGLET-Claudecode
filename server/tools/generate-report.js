import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readState, readChapter, reportPath } from '../books.js';
import { renderReport } from '../report.js';

export const name = 'novel_generate_report';
export const description = '生成书的自包含 HTML 报告（结构视图 + 章节阅读），写入 novels/<bookId>/report.html（覆盖旧报告）。';
export const inputSchema = { type: 'object', properties: { bookId: { type: 'string' } }, required: ['bookId'] };

export async function handler(args) {
  const bookId = String(args.bookId || '');
  const state = await readState(bookId);
  if (!state) return '书不存在';
  const chapters = [];
  for (const c of state.chapters) {
    const body = await readChapter(bookId, c.index);
    chapters.push({ ...c, body: body || '' });
  }
  const html = renderReport(state, chapters);
  const p = reportPath(bookId);
  await mkdir(join(p, '..'), { recursive: true });
  await writeFile(p, html, 'utf8');
  return '报告已生成：' + p;
}
