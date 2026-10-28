import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { mapR27, splitRoles, keepsCohort27, linkOf, type R27Input } from '../src/me/mapper.ts';
import { parseCsvRecords } from '../src/import/csv.ts';

const dir = fileURLToPath(new URL('../../data-private/feishu-27届校招_2026-10-27/', import.meta.url));
// 真实数据只在本机私有目录里；仓库克隆下来没有它，相关用例跳过
const HAS = existsSync(dir + 'r27');
const NO_DATA = !HAS && '没有私有数据目录 data-private/';
const pages = HAS ? readdirSync(dir + 'r27').filter((x) => /^p\d+\.json$/.test(x)).sort().map((x) => JSON.parse(readFileSync(dir + 'r27/' + x, 'utf-8')).data) : [{ fields: [], data: [], record_id_list: [] }];
const page = { fields: pages[0].fields, data: pages.flatMap((d) => d.data), record_id_list: pages.flatMap((d) => d.record_id_list) };
const scored = HAS ? parseCsvRecords(readFileSync(dir + 'confidence/r27_scored.csv', 'utf-8')) : [];
const OPTS = { today: '2026-10-28', readAt: '2026-10-28T09:00:00.000Z' };
const f = (name: string) => page.fields.indexOf(name);
const pick = (pred: (r: unknown[]) => boolean) => page.data.findIndex(pred);
const sub = (...idx: number[]): R27Input => ({ fields: page.fields, rows: idx.map((i) => page.data[i]), ids: idx.map((i) => page.record_id_list[i]), scored });

test('岗位拆分：顿号、逗号、空白，括号内不拆，重复合并', () => {
  assert.deepEqual(splitRoles('猎头顾问助理 人力资源实习生,新媒体运营、商务BD;'), ['猎头顾问助理', '人力资源实习生', '新媒体运营', '商务BD']);
  assert.deepEqual(splitRoles('测试开发(labview方向、软件)，汇款营运部实习生,汇款营运部实习生'), ['测试开发(labview方向、软件)', '汇款营运部实习生']);
  assert.deepEqual(splitRoles(null), []);
});

test('届次与链接解析', () => {
  for (const c of ['27届', '26/27届', '27/28/29届', '不限届']) assert.equal(keepsCohort27(c), true, c);
  for (const c of ['26届', '24/25/26届', '28届', null, '2020/01']) assert.equal(keepsCohort27(c as string | null), false, String(c));
  assert.equal(linkOf('[➡️校招公告](https://mp.weixin.qq.com/s/abc)'), 'https://mp.weixin.qq.com/s/abc');
  assert.equal(linkOf(null), '');
});

test('r27 真实行映射：多岗位拆分、可信度先验、截止日三态、届次分流', { skip: NO_DATA }, () => {
  const multi = pick((r) => splitRoles(String(r[f('可投岗位')])).length > 3 && /^\d{4}\/\d{2}\/\d{2}$/.test(String(r[f('截止时间')])) && String(r[f('截止时间')]) > '2026/11' && String(r[f('届次')]).includes('27'));
  const open = pick((r) => r[f('截止时间')] === '尽快投递' && String(r[f('届次')]).includes('27'));
  const old = pick((r) => String(r[f('届次')]).includes('届') && !String(r[f('届次')]).includes('27'));
  assert.ok(multi >= 0 && open >= 0, '样本页里要有这两类行');
  const idx = old >= 0 ? [multi, open, old] : [multi, open];
  const r = mapR27(sub(...idx), OPTS);
  assert.equal(r.postings.length, idx.length);
  const mine = r.positions.filter((p) => p.recordId === page.record_id_list[multi]);
  assert.equal(mine.length, 1, '一行原表 = 一个岗位');
  assert.ok(mine[0].roles.length > 3);
  assert.match(mine[0].title, new RegExp(`等 ${mine[0].roles.length} 个岗位$`));
  const post = r.postings.find((p) => p.id === mine[0].postingId);
  const want = scored.find((s) => s.record_id === page.record_id_list[multi])!;
  assert.equal(post.scored.overall, want['总等级']);
  assert.equal(post.scored.basis, want['依据']);
  assert.ok(r.positions.some((p) => p.recordId === page.record_id_list[open] && p.deadlineRaw === '尽快投递'));
  if (old >= 0) assert.ok(r.archive.some((p) => p.recordId === page.record_id_list[old]) && !r.positions.some((p) => p.recordId === page.record_id_list[old]));
});

test('截止日：未来留在当前，过期进存档，模板行丢弃', { skip: NO_DATA }, () => {
  const i = pick((r) => String(r[f('届次')]) === '27届' || String(r[f('届次')]).includes('27'));
  const row = [...page.data[i]];
  const run = (dl: string, extra: Record<string, unknown> = {}) => {
    const r2 = [...row]; r2[f('截止时间')] = dl; r2[f('可投岗位')] = '产品经理';
    for (const [k, v] of Object.entries(extra)) r2[f(k)] = v;
    return mapR27({ fields: page.fields, rows: [r2], ids: ['x'], scored: [] }, OPTS);
  };
  assert.equal(run('2026/12/31').positions.length, 1);
  assert.equal(run('2026/06/01').archive.length, 1);
  assert.equal(run('招满即止').positions.length, 1);
  const t = run('2026/12/31', { 岗位ID: '20260703001' });
  assert.equal(t.stats.template, 1);
  assert.equal(t.positions.length + t.archive.length, 0);
});

test('工作地归一：区名归城市，地址和垃圾归其他城市，国家归海外', async () => {
  const { normalizeCities } = await import('../src/me/cities.ts');
  assert.deepEqual(normalizeCities('浦东新区陆家嘴'), ['上海']);
  assert.deepEqual(normalizeCities('东城区北三环东路36号环球贸易中心'), ['北京']);
  assert.deepEqual(normalizeCities('杭州萧山、深圳市'), ['杭州', '深圳']);
  assert.deepEqual(normalizeCities('具体地址看投递链接'), ['其他城市']);
  assert.deepEqual(normalizeCities('......'), ['其他城市']);
  assert.deepEqual(normalizeCities('北京、内部'), ['北京']);
  assert.deepEqual(normalizeCities('美国法国日本英国西班牙'), ['海外']);
  assert.deepEqual(normalizeCities('印度尼西亚'), ['海外']);
  assert.deepEqual(normalizeCities('全国各地'), ['全国多地']);
  assert.deepEqual(normalizeCities('连云港（含赣榆、连云）'), ['连云港']);
  assert.deepEqual(normalizeCities('凉山彝族自治州'), ['凉山']);
  assert.deepEqual(normalizeCities('广西壮族自治区'), ['广西']);
});
