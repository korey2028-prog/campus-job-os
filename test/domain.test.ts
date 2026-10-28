import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseGradWindow } from '../src/domain/grad.ts';
import { parseDeadline, isExpired } from '../src/domain/deadline.ts';
import { checkEligibility } from '../src/domain/eligibility.ts';
import { normalizeCompany, positionKey } from '../src/domain/dedupe.ts';
import { mapStage } from '../src/domain/stage.ts';
import { confidence } from '../src/domain/confidence.ts';
import { openDb, upsertPosition, listPositions, getDetail } from '../src/store/db.ts';
import type { Position } from '../src/domain/types.ts';

test('grad window variants', () => {
  const w27 = { from: '2026-09', to: '2027-08' };
  assert.deepEqual(parseGradWindow('27届'), w27);
  assert.deepEqual(parseGradWindow('2027届'), w27);
  const u = { from: '2025-09', to: '2027-08' };
  for (const s of ['26/27届', '26届/27届', '26届、27届']) assert.deepEqual(parseGradWindow(s), u, s);
  assert.deepEqual(parseGradWindow('24/25/26/27届'), { from: '2023-09', to: '2027-08' });
  assert.deepEqual(parseGradWindow('27/28/29/30届'), { from: '2026-09', to: '2030-08' });
  for (const s of ['2020/01', '', '不限', '届', '27']) assert.equal(parseGradWindow(s), null, s);
});

test('deadline parsing', () => {
  for (const s of ['2026/10/31', '2026-10-31', '2026.10.31', '2026年10月31日'])
    assert.deepEqual(parseDeadline(s), { kind: 'date', date: '2026-10-31' }, s);
  assert.deepEqual(parseDeadline('10月31日', 2026), { kind: 'date', date: '2026-10-31' });
  assert.equal(parseDeadline('10月31日').kind, 'unknown');
  for (const s of ['招满即止', '额满即止', '招满为止']) assert.deepEqual(parseDeadline(s), { kind: 'rolling' });
  assert.deepEqual(parseDeadline('尽快投递'), { kind: 'unknown', raw: '尽快投递' });
  assert.deepEqual(parseDeadline(''), { kind: 'unknown', raw: '' });
  assert.equal(parseDeadline('2026/02/30').kind, 'unknown');
  assert.equal(isExpired({ kind: 'date', date: '2026-10-01' }, '2026-10-02'), true);
  assert.equal(isExpired({ kind: 'date', date: '2026-10-02' }, '2026-10-02'), false);
  assert.equal(isExpired({ kind: 'rolling' }, '2030-01-01'), false);
  assert.equal(isExpired({ kind: 'unknown', raw: 'x' }, '2030-01-01'), false);
});

const base: Position = {
  company: '甲', title: 'T', batch: '', gradWindow: { from: '2026-09', to: '2027-08' }, minDegree: '本科',
  downwardCompatible: true, degrees: ['本科'], majors: [], cities: [], deadline: { kind: 'rolling' },
};
const me = { gradDate: '2027-06', degree: '硕士' as const, major: '计算机科学' };

test('eligibility matrix', () => {
  let e = checkEligibility(base, me, '2026-10-27');
  assert.equal(e.verdict, '可投');
  assert.ok(e.reasons.length >= 4);
  e = checkEligibility({ ...base, deadline: { kind: 'date', date: '2026-10-01' } }, me, '2026-10-27');
  assert.equal(e.verdict, '不可投');
  assert.ok(e.reasons.some((r) => r.includes('已截止') && r.includes('2026-10-01')));
  e = checkEligibility({ ...base, gradWindow: null }, me);
  assert.equal(e.verdict, '待确认');
  assert.ok(e.reasons.some((r) => r.includes('届次无法解析')));
  assert.equal(checkEligibility(base, { ...me, gradDate: '2028-06' }).verdict, '不可投');
  assert.equal(checkEligibility({ ...base, minDegree: '博士' }, me).verdict, '不可投');
  assert.equal(checkEligibility({ ...base, downwardCompatible: false }, me).verdict, '不可投');
  assert.equal(checkEligibility({ ...base, downwardCompatible: false, degrees: ['本科', '硕士'] }, me).verdict, '可投');
  // majors
  assert.equal(checkEligibility({ ...base, majors: ['不限专业'] }, { ...me, major: undefined }).verdict, '可投');
  assert.equal(checkEligibility({ ...base, majors: ['计算机'] }, me).verdict, '可投');
  assert.equal(checkEligibility({ ...base, majors: ['法学'] }, me).verdict, '待确认');
  assert.equal(checkEligibility({ ...base, majors: ['法学'] }, { ...me, major: undefined }).verdict, '待确认');
  // worst-of
  assert.equal(checkEligibility({ ...base, majors: ['法学'], minDegree: '博士' }, me).verdict, '不可投');
  assert.equal(checkEligibility({ ...base, gradWindow: null, majors: ['法学'] }, me).verdict, '待确认');
});

test('dedupe', () => {
  const variants = ['示例科技（北京）有限公司', '示例科技(北京)有限公司', ' 示例 科技 股份有限公司', '示例科技集团', '示例科技'];
  for (const v of variants) assert.equal(normalizeCompany(v), '示例科技', v);
  assert.equal(normalizeCompany('ＡＢＣ（中国）有限公司'), 'abc');
  const w = { from: '2026-09', to: '2027-08' };
  assert.equal(positionKey('示例科技有限公司', ' PM ', '27届秋招', w), '示例科技|PM|27届秋招|2026-09-2027-08');

  const db = openDb(':memory:');
  const mk = (company: string, url: string) => upsertPosition(db, { ...base, company, title: 'PM', batch: 'b', url, sourceKind: 'web' });
  const a = mk('示例科技有限公司', 'https://example.com/a');
  const b = mk('示例科技（北京）有限公司', 'https://example.com/b');
  assert.equal(a.created, true);
  assert.equal(b.created, false);
  assert.equal(a.positionId, b.positionId);
  const rows = listPositions(db);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].sourceCount, 2);
});

test('stage mapping', () => {
  const cases: [string, string][] = [
    ['未核验', 'verify'], ['本人决定不投', 'stopped'], ['现场简历已收', 'offline_received'], ['来源关闭', 'closed_source'],
    ['已有定向材料待核验', 'preparing'], ['已交流待JD', 'candidate'], ['已投递（用户确认）', 'submitted'],
    ['现场简历已收待转交', 'offline_received'], ['现场简历已收待内部转交', 'offline_received'],
    ['现场简历已收待部门筛选', 'offline_received'], ['资格不符暂不推进', 'stopped'], ['现场简历已收待联系', 'offline_received'],
    ['现场简历已收；无需重复网申', 'offline_received'], ['仅核官网入口；未投递', 'preparing'], ['收纸质简历待确认', 'offline_received'],
    ['初面已完成，结果未知', 'interviewing'], ['官网已核；未提交', 'preparing'], ['网申草稿未提交', 'drafted'],
  ];
  assert.equal(cases.length, 18);
  for (const [raw, en] of cases) {
    const s = mapStage(raw);
    assert.equal(s.enum, en, raw);
    assert.equal(s.raw, raw);
  }
  // priorities
  assert.equal(mapStage('已投递，二面').enum, 'interviewing');
  assert.equal(mapStage('来源关闭，已投递').enum, 'closed_source');
  assert.equal(mapStage('本人决定不投，来源关闭').enum, 'stopped');
  assert.equal(mapStage('随便什么').enum, 'unknown');
  assert.equal(mapStage('').enum, 'unknown');
});

test('merge: better deadline wins, conflicts recorded', () => {
  const db = openDb(':memory:');
  const common = { batch: '27届秋招', gradWindow: parseGradWindow('26/27届'), minDegree: '本科' as const, downwardCompatible: true,
    degrees: ['本科' as const], majors: [] as string[], cities: [] as string[] };
  const a = upsertPosition(db, { ...common, company: '示例科技（北京）有限公司', title: '产品经理', deadline: parseDeadline('尽快投递') });
  const b = upsertPosition(db, { ...common, company: '示例科技有限公司', title: '产品经理', gradWindow: parseGradWindow('26届/27届'),
    deadline: parseDeadline('2026/11/30'), url: 'https://example.com/x', prov: { deadline: { method: '规则解析', raw: '2026/11/30' } } });
  assert.equal(a.positionId, b.positionId);
  let rows = listPositions(db);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].deadline, { kind: 'date', date: '2026-11-30' });
  // later date from later source wins, conflict recorded
  const c = upsertPosition(db, { ...common, company: '示例科技', title: '产品经理', deadline: parseDeadline('2026/12/15'),
    url: 'https://example.com/y', obtainedAt: '2999-01-01T00:00:00Z' });
  assert.equal(c.conflicts, 1);
  assert.deepEqual(listPositions(db)[0].deadline, { kind: 'date', date: '2026-12-15' });
  // degree conflict keeps existing, majors fill
  const d = upsertPosition(db, { ...common, company: '示例科技', title: '产品经理', deadline: parseDeadline(''), minDegree: '硕士', majors: ['计算机'] });
  assert.equal(d.conflicts, 1);
  rows = listPositions(db);
  assert.equal(rows[0].minDegree, '本科');
  assert.deepEqual(rows[0].majors, ['计算机']);
  assert.equal(getDetail(db, a.positionId).conflicts.length, 2);
});

test('confidence rules', () => {
  const now = '2026-10-27T00:00:00Z';
  const pv = (field: string, method: string, at = '2026-10-20T00:00:00Z', v: string | null = null) => ({ field, method, obtained_at: at, verified_at: v });
  const good = [pv('grad_window', '规则解析'), pv('degree', '人工录入'), pv('deadline', '规则解析')];
  const dl = { kind: 'date', date: '2026-12-01' } as const;
  const gw = { from: '2026-09', to: '2027-08' };
  let c = confidence({ sourceUrls: ['https://app.mokahr.com/x'], provenance: good, deadline: dl, gradWindow: gw, now });
  assert.deepEqual([c.source, c.field, c.freshness, c.overall, c.label], ['高', '高', '高', '高', '高（未实测）']);
  assert.equal(confidence({ sourceUrls: ['https://a.edu.cn/p'], provenance: good, deadline: dl, gradWindow: gw, now }).source, '高');
  assert.equal(confidence({ sourceUrls: ['https://www.wjx.cn/x'], provenance: good, deadline: dl, gradWindow: gw, now }).source, '中');
  assert.equal(confidence({ sourceUrls: ['https://blog.example.com'], provenance: good, deadline: dl, gradWindow: gw, now }).source, '中');
  c = confidence({ sourceUrls: [], provenance: good, deadline: dl, gradWindow: gw, now });
  assert.equal(c.source, '低'); assert.equal(c.overall, '低');
  c = confidence({ sourceUrls: ['https://x.gov.cn'], provenance: [pv('grad_window', 'AI抽取'), pv('degree', '人工录入'), pv('deadline', '规则解析')], deadline: dl, gradWindow: gw, now });
  assert.equal(c.field, '中'); assert.equal(c.overall, '中');
  c = confidence({ sourceUrls: ['https://x.gov.cn'], provenance: good, deadline: { kind: 'unknown', raw: '' }, gradWindow: null, now });
  assert.equal(c.field, '低');
  // freshness
  const old = (d: string) => good.map((g) => ({ ...g, obtained_at: d }));
  assert.equal(confidence({ sourceUrls: ['https://x.gov.cn'], provenance: old('2026-09-20T00:00:00Z'), deadline: dl, gradWindow: gw, now }).freshness, '中');
  assert.equal(confidence({ sourceUrls: ['https://x.gov.cn'], provenance: old('2026-01-01T00:00:00Z'), deadline: dl, gradWindow: gw, now }).freshness, '低');
  // verified drops 未实测
  const ver = good.map((g) => ({ ...g, verified_at: '2026-10-25T00:00:00Z' }));
  assert.equal(confidence({ sourceUrls: ['https://x.gov.cn'], provenance: ver, deadline: dl, gradWindow: gw, now }).label, '高');
});
