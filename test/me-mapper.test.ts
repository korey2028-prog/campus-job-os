import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { mapR27, splitRoles, keepsCohort27, linkOf, applicationsFromLedger, applyLedgerLinks, parseLedger, parseFacts, resumeFilesFromLedger, type R27Input } from '../src/me/mapper.ts';
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

const FIELDS = ['岗位ID', '公司名称', '可投岗位', '届次', '招聘类型', '截止时间', '学历', '工作地', '企业性质', '所属行业', '校招公告', '投递 渠道', '更新日期', '免笔试', '部分岗位免笔试', '不限专业', '知名企业'];
const cell = (partial: Record<string, unknown>) => FIELDS.map((name) => partial[name] ?? '');
const mapRows = (rows: Record<string, unknown>[], scored: Record<string, string>[] = []) =>
  mapR27({ fields: FIELDS, rows: rows.map(cell), ids: rows.map((_, i) => `rec-${i}`), scored }, OPTS);

test('mapR27：一行一个岗位，过期和模板行分流，届次存疑留在当前', () => {
  const notice = '[公告](https://example.com/notice)';
  const channel = '[入口](https://example.com/apply)';
  const base = { 公司名称: '示例科技', 可投岗位: '产品经理、运营、设计、销售', 届次: '27届', 招聘类型: '27届秋招', 截止时间: '2026/12/31', 学历: '本科及以上', 工作地: '北京', 企业性质: '民企', 所属行业: 'IT互联网', 校招公告: notice, '投递 渠道': channel, 更新日期: '2026-10-20', 免笔试: true, 不限专业: true };
  const current = mapRows([base]);
  assert.equal(current.postings.length, 1);
  assert.equal(current.positions.length, 1);
  assert.equal(current.archive.length, 0);
  assert.equal(current.positions[0].roles.length, 4);
  assert.match(current.positions[0].title, /等 4 个岗位$/);
  assert.equal(current.positions[0].minDegree, '本科');
  assert.deepEqual(current.positions[0].majors, ['不限专业']);
  assert.equal(current.positions[0].industry, '互联网/科技');
  assert.equal(current.positions[0].writtenTest, '免');
  assert.equal(current.postings[0].sources.length, 2);

  assert.equal(mapRows([{ ...base, 截止时间: '2026/06/01' }]).archive.length, 1);
  assert.equal(mapRows([{ ...base, 截止时间: '招满即止' }]).positions.length, 1);
  assert.equal(mapRows([{ ...base, 岗位ID: '20260703001' }]).stats.template, 1);
  assert.equal(mapRows([{ ...base, 岗位ID: '20260703001' }]).positions.length, 0);

  const old = mapRows([{ ...base, 届次: '26届', 招聘类型: '26届秋招' }]);
  assert.equal(old.positions.length, 0);
  assert.equal(old.archive.length, 1);
  assert.equal(old.stats.otherCohort, 1);

  const doubt = mapRows([{ ...base, 届次: '26届', 招聘类型: '27届秋招', 所属行业: '请提供需要判断所属行业的完整企业名称。', 企业性质: '神秘' }], [
    { record_id: 'rec-0', 来源可信度: '高', 字段可靠度: '高', 时效: '高', 总等级: '高', 依据: '官网' },
  ]);
  assert.equal(doubt.positions.length, 1);
  assert.equal(doubt.positions[0].cohortDoubt, true);
  assert.equal(doubt.positions[0].industry, '未分类');
  assert.equal(doubt.positions[0].ownership, '其他');
  assert.equal(doubt.postings[0].scored.overall, '低');
  assert.match(doubt.postings[0].scored.basis, /^届次存疑/);
});

test('台账映射：按公司岗位关联，重复链接不猜，补链不覆盖已有关联', () => {
  assert.deepEqual(parseLedger('local_id,company\nA,甲\n,空编号\nB,乙\n').map((r) => r.local_id), ['A', 'B']);
  const positions = [
    { id: 1, company: '示例科技（北京）有限公司', title: '产品经理', applyUrl: 'https://a.example/1' },
    { id: 2, company: '另一家', title: '运营', applyUrl: 'https://a.example/1' },
  ];
  const apps = applicationsFromLedger([
    { local_id: 'A', company: '示例科技有限公司', role: '产品经理', official_url: 'https://other.example' },
    { local_id: 'B', company: '没对上', role: 'X', official_url: 'https://a.example/1' },
    { local_id: 'C', company: '没对上', role: 'Y', official_url: '', resume_path: 'resume.sample.pdf' },
  ], positions);
  assert.equal(apps[0].positionId, 1);
  assert.equal(apps[1].positionId, null);
  assert.deepEqual(resumeFilesFromLedger(apps.map((a, i) => ({ local_id: a.localId, company: a.company, role: a.role, resume_path: i === 2 ? 'resume.sample.pdf' : '' }))), [
    { localId: 'C', company: '没对上', role: 'Y', path: 'resume.sample.pdf' },
  ]);
  const linked = applyLedgerLinks(
    [{ localId: 'A', positionId: null }, { localId: 'B', positionId: 5 }],
    [{ id: 9, recordId: 'r1' }],
    { A: 'r1', B: 'r1', C: 'missing' },
  );
  assert.equal(linked[0].positionId, 9);
  assert.equal(linked[1].positionId, 5);
});

test('事实底稿抽出已确认事实、本人更正和补证清单', () => {
  const md = [
    '| ID | 事实 | 来源 | 边界 |',
    '| F1 | 2026 年暑期在示例科技实习，做产品 | 本人 | 不写绩效 |',
    '## 2026-10-01 本人更正',
    '- 公司名改为示例科技',
    '## 补证清单',
    '1. 补毕业时间',
  ].join('\n');
  const got = parseFacts(md);
  assert.equal(got.facts[0].id, 'F1');
  assert.equal(got.facts[0].source, '本人');
  assert.equal(got.factFixes[0].date, '2026-10-01');
  assert.equal(got.factFixes[0].text, '公司名改为示例科技');
  assert.equal(got.factGaps[0].text, '补毕业时间');
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
