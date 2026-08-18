export function mergeMemory(state, chars, hooks) {
  const out = { ...state };
  const cs = (out.characters || []).slice();
  for (const c of chars) {
    if (!c || !c.name) continue;
    if (!cs.some((x) => x.name === c.name)) {
      cs.push({ name: String(c.name), role: String(c.role || ''), desc: String(c.desc || '') });
    }
  }
  out.characters = cs;
  const hs = (out.hooks || []).slice();
  for (const h of hooks) {
    if (!h || !h.name) continue;
    const ex = hs.find((x) => x.name === h.name);
    const status = (h.status === 'progressing' || h.status === 'resolved') ? h.status : 'open';
    if (ex) ex.status = status;
    else hs.push({ name: String(h.name), status, note: String(h.note || '') });
  }
  out.hooks = hs;
  return out;
}
