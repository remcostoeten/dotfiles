function varint(b, i) { let v = 0n, s = 0n; for (;;) { const c = b[i++]; v |= BigInt(c & 0x7f) << s; s += 7n; if (c < 0x80) return [v, i]; } }
function parse(b) {
  const out = []; let i = 0;
  try {
    while (i < b.length) {
      let k; [k, i] = varint(b, i); const f = Number(k >> 3n), t = Number(k & 7n); let v;
      if (t === 0) [v, i] = varint(b, i);
      else if (t === 2) { let l; [l, i] = varint(b, i); v = b.subarray(i, i + Number(l)); i += Number(l); if (i > b.length) return null; }
      else if (t === 1) { v = b.subarray(i, i + 8); i += 8; }
      else if (t === 5) { v = b.subarray(i, i + 4); i += 4; }
      else return null;
      if (f === 0) return null;
      out.push({ f, t, v });
    }
  } catch { return null; }
  return i === b.length ? out : null;
}
function dump(b, depth = 0) {
  const p = parse(b); if (!p || depth > 6) return JSON.stringify(Buffer.from(b).toString('utf8'));
  return '{' + p.map(({ f, t, v }) => `${f}:` + (t === 2 ? dump(v, depth + 1) : t === 0 ? v.toString() : 'x')).join(', ') + '}';
}
module.exports = { parse, dump };
