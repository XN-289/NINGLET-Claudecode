import { detectAI } from '../engine/anti-ai-engine.js';

export const name = 'novel_scan_chapter';
export const description = '反 AI 味确定性扫描（干跑，不落盘）：禁用词、的密度、句长方差。返回 0-100 评分与命中列表，供修订决策。';
export const inputSchema = {
  type: 'object',
  properties: { body: { type: 'string', description: '章节正文全文' } },
  required: ['body'],
};

export async function handler(args) {
  const body = String(args.body || '');
  const { score, hits } = detectAI(body);
  return JSON.stringify({ score, hits, pass: hits.length === 0 });
}
