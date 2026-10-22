const { ClassicLevel } = require('classic-level'); const { parse } = require('./pb.js');
const field = (msg, f) => msg && msg.find((x) => x.f === f)?.v;
(async () => {
  const [dir, mode] = process.argv.slice(2);
  const db = new ClassicLevel(dir, { keyEncoding: 'buffer', valueEncoding: 'buffer' });
  const groups = new Map(), tabs = [];
  for await (const [k, v] of db.iterator({ gte: Buffer.from('saved_tab_group-dt-'), lt: Buffer.from('saved_tab_group-dt.') })) {
    const spec = parse(field(parse(v), 2)); const group = field(spec, 4), tab = field(spec, 5);
    if (group) groups.set(Buffer.from(field(spec, 1)).toString(), { key: k, title: Buffer.from(field(parse(group), 2) ?? []).toString() });
    else if (tab) tabs.push({ key: k, group: Buffer.from(field(parse(tab), 1)).toString() });
  }
  const doomed = new Set([...groups].filter(([, g]) => /claude/i.test(g.title)).map(([id]) => id));
  const keys = [...[...doomed].map((id) => groups.get(id).key), ...tabs.filter((t) => doomed.has(t.group)).map((t) => t.key)];
  const titles = {}; for (const id of doomed) titles[groups.get(id).title] = (titles[groups.get(id).title] || 0) + 1;
  console.log(`groups total ${groups.size}, claude ${doomed.size}, records to delete ${keys.length}`, titles);
  console.log('kept:', [...groups.values()].filter((g) => !/claude/i.test(g.title)).map((g) => g.title));
  if (mode === '--apply') { await db.batch(keys.map((key) => ({ type: 'del', key }))); console.log('deleted'); }
  await db.close();
})();
