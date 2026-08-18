import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const dshSrc = resolve(process.argv[2] || '../NINGLET-dsh/src');
const antiAi = await import(pathToFileURL(join(dshSrc, 'anti-ai-engine.js')).href);
const bookId = await import(pathToFileURL(join(dshSrc, 'book-id.js')).href);
const stateSchema = await import(pathToFileURL(join(dshSrc, 'state-schema.js')).href);
const wordCount = await import(pathToFileURL(join(dshSrc, 'word-count.js')).href);
const stateReducer = await import(pathToFileURL(join(dshSrc, 'state-reducer.js')).href);
const fns = { ...antiAi, ...bookId, ...stateSchema, ...wordCount, ...stateReducer };

const C = (fn, args) => ({ fn, args, output: fns[fn](...args) });

const validBook = { bookId: 'the-dark-lord', title: 'The Dark Lord', genre: 'fantasy', targetChapters: 50, chapterWords: 2000, nextChapterIndex: 1 };
const base = { book: { bookId: 'b', title: 'B', targetChapters: 5, chapterWords: 100, nextChapterIndex: 1 }, chapters: [], summaries: [], hooks: [] };
const chapter = { index: 1, title: '第一章', wordCount: 90, filePath: 'chapters/001.md', aiTasteScore: 80, status: 'draft' };

const cases = [
  C('makeBookId', ['吞天魔帝']),
  C('makeBookId', ['The Dark Lord']),
  C('makeBookId', ['Hello 世界!']),
  C('makeBookId', ['都市修仙']),
  C('slugify', ['The Dark Lord!']),
  C('hash6', ['吞天魔帝']),
  C('isValidBookId', ['the-dark-lord']),
  C('isValidBookId', ['book-abc123']),
  C('isValidBookId', ['../etc']),
  C('isValidBookId', ['a/b']),
  C('isValidBookId', ['C:\\x']),
  C('isValidBookId', ['']),
  C('scanForbidden', ['他心中一凛，不由自主地后退一步。']),
  C('scanForbidden', ['他退了一步，没说话。']),
  C('deDensity', ['他的眼神里透着冷的、硬的光。']),
  C('deDensity', ['']),
  C('sentenceLengths', ['雨下了一夜。第二天清早，他推开窗。']),
  C('detectAI', ['他退了一步，没说话。']),
  C('detectAI', ['他心中一凛，不由自主地望了过去，眼中闪过一丝复杂。']),
  C('detectAI', ['']),
  C('detectAI', ['他走了。她来了。他看了。她去了。他停了。她跑了。']),
  C('rewriteRules', []),
  C('detectLanguage', ['他缓缓睁开眼，望向远方。']),
  C('detectLanguage', ['He opened his eyes.']),
  C('countZhChars', ['他望向远方。']),
  C('countZhChars', ['Hello 世界']),
  C('countEnWords', ['He opened his eyes.']),
  C('countWords', ['他望向远方。']),
  C('countWords', ['He opened his eyes.']),
  C('validateBook', [validBook]),
  C('validateBook', [{ bookId: '../etc', title: 'x' }]),
  C('validateBook', [{ bookId: 'a-book', title: 'x', targetChapters: 5, chapterWords: 100, nextChapterIndex: 0 }]),
  C('validateChapter', [chapter]),
  C('validateChapter', [{ index: 1, status: 'bogus' }]),
  C('validateState', [validBook && { book: validBook, chapters: [], summaries: [], hooks: [] }]),
  C('validateState', [null]),
  C('validateState', [{ book: null, chapters: [], summaries: [], hooks: [] }]),
  C('validateState', [{ book: { bookId: 'b' }, chapters: 'nope' }]),
  C('applyChapterDelta', [base, chapter]),
];

mkdirSync(new URL('../tests/vectors/', import.meta.url), { recursive: true });
writeFileSync(
  new URL('../tests/vectors/engine.json', import.meta.url),
  JSON.stringify({ source: 'dsh ' + dshSrc, generatedAt: new Date().toISOString(), cases }, null, 2),
);
console.log('已生成 ' + cases.length + ' 组向量，来自 ' + dshSrc);
