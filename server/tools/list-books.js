import { listBooks } from '../books.js';

export const name = 'novel_list_books';
export const description = '列出书库中所有书（bookId + 书名）。';
export const inputSchema = { type: 'object', properties: {} };

export async function handler() {
  const books = await listBooks();
  return books.length ? JSON.stringify(books) : '（书库为空）';
}
