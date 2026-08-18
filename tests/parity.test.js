import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import * as antiAi from '../server/engine/anti-ai-engine.js';
import * as bookId from '../server/engine/book-id.js';
import * as stateSchema from '../server/engine/state-schema.js';
import * as wordCount from '../server/engine/word-count.js';
import * as stateReducer from '../server/engine/state-reducer.js';

const fns = { ...antiAi, ...bookId, ...stateSchema, ...wordCount, ...stateReducer };
const vectors = JSON.parse(readFileSync(new URL('./vectors/engine.json', import.meta.url), 'utf8'));

for (const c of vectors.cases) {
  test('parity ' + c.fn + ' ' + JSON.stringify(c.args).slice(0, 50), () => {
    assert.deepEqual(fns[c.fn](...c.args), c.output);
  });
}
