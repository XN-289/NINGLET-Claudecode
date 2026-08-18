export const name = 'novel_generate_report';
export const description = '生成书的自包含 HTML 报告（结构视图 + 章节阅读），写入 novels/<bookId>/report.html（覆盖旧报告）。';
export const inputSchema = { type: 'object', properties: { bookId: { type: 'string' } }, required: ['bookId'] };
export async function handler() {
  throw new Error('未实现（Task 10 交付）');
}
