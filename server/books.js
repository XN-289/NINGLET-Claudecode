import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { isValidBookId } from './engine/book-id.js';
import { validateState } from './engine/state-schema.js';

export function resolveRoot() {
  return process.env.NINGLET_ROOT || process.cwd();
}

function guard(bookId) {
  if (!isValidBookId(bookId)) throw new Error('unsafe bookId');
}

export function statePath(bookId) {
  guard(bookId);
  return join(resolveRoot(), 'novels', bookId, 'story', 'state', 'state.json');
}

export function chapterPath(bookId, index) {
  guard(bookId);
  const n = String(index).padStart(3, '0');
  return join(resolveRoot(), 'novels', bookId, 'chapters', n + '.md');
}

export function reportPath(bookId) {
  guard(bookId);
  return join(resolveRoot(), 'novels', bookId, 'report.html');
}

export function intentPath(bookId, index) {
  guard(bookId);
  const n = String(index).padStart(3, '0');
  return join(resolveRoot(), 'novels', bookId, 'story', 'runtime', 'chapter-' + n + '.intent.md');
}

export async function readState(bookId) {
  guard(bookId);
  const p = statePath(bookId);
  let raw;
  try {
    raw = await readFile(p, 'utf8');
  } catch {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('状态文件损坏（非合法 JSON），请修复 novels/' + bookId + '/story/state/state.json');
  }
}

export async function writeState(bookId, state) {
  guard(bookId);
  const v = validateState(state);
  if (!v.ok) throw new Error('状态非法，拒绝写入：' + v.errors.join('; '));
  const p = statePath(bookId);
  await mkdir(join(p, '..'), { recursive: true });
  await writeFile(p, JSON.stringify(state, null, 2), 'utf8');
}

export async function writeChapter(bookId, index, body) {
  guard(bookId);
  const p = chapterPath(bookId, index);
  await mkdir(join(p, '..'), { recursive: true });
  await writeFile(p, body, 'utf8');
  return 'novels/' + bookId + '/chapters/' + String(index).padStart(3, '0') + '.md';
}

export async function readChapter(bookId, index) {
  guard(bookId);
  if (!Number.isInteger(index) || index < 1) throw new Error('章节号非法');
  try {
    return await readFile(chapterPath(bookId, index), 'utf8');
  } catch {
    return null;
  }
}

export async function listBooks() {
  let entries;
  try {
    entries = await readdir(join(resolveRoot(), 'novels'), { withFileTypes: true });
  } catch {
    return [];
  }
  const books = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const state = await readState(e.name);
    if (state && state.book) books.push({ bookId: state.book.bookId, title: state.book.title });
  }
  return books;
}
