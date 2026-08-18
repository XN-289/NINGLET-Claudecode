const CSS = `
:root { --ground: #F4F2EC; --ink: #2A2A28; --hairline: #D9D6CD; --accent: #3E4C6B; --red: #C8161D; --muted: #7C7B76; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--ground); color: var(--ink); font-family: Georgia, 'Noto Serif SC', 'Songti SC', serif; }
.head { padding: 28px 32px 20px; border-bottom: 1px solid var(--hairline); }
.title { font-size: 22px; font-weight: 600; }
.meta { margin-top: 8px; color: var(--muted); font-size: 13px; }
.tabs { display: flex; gap: 4px; padding: 12px 32px 0; }
.tab { cursor: pointer; font-size: 13px; padding: 5px 12px; border: 1px solid var(--hairline); border-radius: 2px; color: var(--muted); background: none; }
.tab.on { background: var(--ink); color: var(--ground); border-color: var(--ink); }
.view { padding: 16px 32px 40px; max-width: 860px; }
.section { padding: 14px 0 6px; font-size: 11px; letter-spacing: 0.08em; color: var(--muted); text-transform: uppercase; }
.item { padding: 9px 0; border-bottom: 1px solid var(--hairline); font-size: 14px; cursor: pointer; }
.item:hover { opacity: 0.7; }
.muted { color: var(--muted); font-size: 12px; }
.status { font-size: 11px; color: var(--red); margin-left: 6px; }
.status.resolved { color: var(--muted); }
.status.progressing { color: var(--accent); }
.prose { white-space: pre-wrap; font-size: 15px; line-height: 1.9; }
.back { cursor: pointer; color: var(--accent); font-size: 13px; margin-bottom: 12px; }
@media (prefers-color-scheme: dark) {
  :root { --ground: #1C1B19; --ink: #EDEBE4; --hairline: #35332E; --muted: #8B8A85; }
  .tab.on { background: #EDEBE4; color: #1C1B19; border-color: #EDEBE4; }
}
`;

const JS = `
function $(id) { return document.getElementById(id); }
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
function setView(html) { $('view').innerHTML = html; window.scrollTo(0, 0); }

function tabs() {
  const defs = [
    ['outline', '大纲'], ['chapters', '章节'], ['characters', '角色'], ['hooks', '伏笔'],
  ];
  $('tabs').innerHTML = defs.map(function (d) {
    return '<button class="tab" id="tab-' + d[0] + '" onclick="show(\'' + d[0] + '\')">' + d[1] + '</button>';
  }).join('');
}

function show(key) {
  document.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('on'); });
  $('tab-' + key).classList.add('on');
  if (key === 'outline') setView(renderOutline());
  if (key === 'chapters') setView(renderChapters());
  if (key === 'characters') setView(renderCharacters());
  if (key === 'hooks') setView(renderHooks());
}

function renderOutline() {
  if (!DATA.outline.length) return '<div class="muted">（暂无大纲）</div>';
  return '<div class="section">大纲</div>' + DATA.outline.map(function (o) {
    return '<div class="item">' + esc(o.title) + '</div>';
  }).join('');
}

function renderChapters() {
  if (!DATA.chapters.length) return '<div class="muted">（还没有章节）</div>';
  return '<div class="section">章节</div>' + DATA.chapters.map(function (c) {
    return '<div class="item" onclick="readChapter(' + c.index + ')">第' + c.index + '章 ' + esc(c.title)
      + ' <span class="muted">' + c.wordCount + ' 字 · 评分 ' + c.aiTasteScore + '</span></div>';
  }).join('');
}

function renderCharacters() {
  if (!DATA.characters.length) return '<div class="muted">（暂无角色）</div>';
  return '<div class="section">角色</div>' + DATA.characters.map(function (c) {
    return '<div class="item">' + esc(c.name) + ' <span class="muted">' + esc(c.role || '') + '</span>'
      + '<div class="muted">' + esc(c.desc || '') + '</div></div>';
  }).join('');
}

function renderHooks() {
  if (!DATA.hooks.length) return '<div class="muted">（暂无伏笔）</div>';
  return '<div class="section">伏笔</div>' + DATA.hooks.map(function (h) {
    return '<div class="item">' + esc(h.name) + '<span class="status ' + esc(h.status) + '">' + esc(h.status) + '</span>'
      + '<div class="muted">' + esc(h.note || '') + '</div></div>';
  }).join('');
}

function readChapter(index) {
  var c = DATA.chapters.filter(function (x) { return x.index === index; })[0];
  if (!c) return;
  setView('<div class="back" onclick="show(\'chapters\')">← 返回章节列表</div>'
    + '<div class="title">' + esc(c.title) + '</div>'
    + '<div class="muted">' + c.wordCount + ' 字 · AI 味评分 ' + c.aiTasteScore + '</div>'
    + '<div class="prose">' + esc(DATA.bodies[String(index)] || '') + '</div>');
}

tabs();
show('chapters');
`;

export function renderReport(state, chapters) {
  const data = {
    book: state.book,
    outline: state.outline || [],
    chapters: chapters.map((c) => ({ index: c.index, title: c.title, wordCount: c.wordCount, aiTasteScore: c.aiTasteScore, status: c.status })),
    bodies: Object.fromEntries(chapters.map((c) => [String(c.index), c.body || ''])),
    characters: state.characters || [],
    hooks: state.hooks || [],
  };
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  const totalWords = data.chapters.reduce((a, c) => a + c.wordCount, 0);
  const avgScore = data.chapters.length
    ? Math.round(data.chapters.reduce((a, c) => a + c.aiTasteScore, 0) / data.chapters.length)
    : '—';
  return '<!doctype html>\n<html lang="zh-CN">\n<head>\n<meta charset="utf-8">\n'
    + '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
    + '<title>《' + state.book.title + '》 · NINGLET 报告</title>\n'
    + '<style>' + CSS + '</style>\n</head>\n<body>\n'
    + '<header class="head"><div class="title">《' + state.book.title + '》</div>'
    + '<div class="meta">' + (state.book.genre || '未分类') + ' · 共 ' + data.chapters.length + ' 章 · ' + totalWords + ' 字 · 平均 AI 味评分 ' + avgScore
    + (state.book.brief ? '<br>' + state.book.brief : '') + '</div></header>\n'
    + '<nav class="tabs" id="tabs"></nav>\n'
    + '<main class="view" id="view"></main>\n'
    + '<script type="application/json" id="ninglet-data">' + json + '</script>\n'
    + '<script>var DATA = JSON.parse(document.getElementById(\'ninglet-data\').textContent);\n' + JS + '\n</script>\n'
    + '</body>\n</html>\n';
}
