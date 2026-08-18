import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const skillsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills');

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

const files = walk(skillsDir);
assert.ok(files.length >= 10, 'skills 文件数异常');

for (const f of files) {
  test('无框架残留引用：' + f.replace(skillsDir, ''), () => {
    const text = readFileSync(f, 'utf8');
    assert.ok(!text.includes('novel-studio'), f + ' 含 novel-studio');
    assert.ok(!/dagang|dsh/i.test(text), f + ' 含 dagang/dsh');
  });
}

for (const s of ['anti-ai-flavor', 'longform-writing', 'novel-qa', 'novel-outline-researcher', 'novel-style-reference']) {
  test('frontmatter 合法：' + s, () => {
    const text = readFileSync(join(skillsDir, s, 'SKILL.md'), 'utf8');
    const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    assert.ok(m, s + ' 缺 frontmatter');
    assert.ok(/^name:\s*\S+$/m.test(m[1]), s + ' 缺 name');
    assert.ok(/^description:\s*\S/m.test(m[1]), s + ' 缺 description');
  });
}

test('longform-writing 引用结算/扫描工具', () => {
  const text = readFileSync(join(skillsDir, 'longform-writing', 'SKILL.md'), 'utf8');
  assert.ok(text.includes('novel_settle_chapter'));
  assert.ok(text.includes('novel_scan_chapter'));
});

test('anti-ai-flavor 引用扫描工具', () => {
  const text = readFileSync(join(skillsDir, 'anti-ai-flavor', 'SKILL.md'), 'utf8');
  assert.ok(text.includes('novel_scan_chapter'));
});

test('handoff-to-ninglet.md 存在', () => {
  assert.ok(existsSync(join(skillsDir, 'novel-outline-researcher', 'references', 'handoff-to-ninglet.md')));
});
