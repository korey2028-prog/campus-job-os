import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankPosition, type RankInput } from '../src/domain/rank.ts';

const TODAY = '2026-10-28';
const profile = { directions: ['AI产品经理', '产品经理'], cities: ['北京', '深圳', '杭州'] };
const base: RankInput = {
  company: 'X', title: 'AI产品经理', batch: '', gradWindow: { from: '2026-09', to: '2027-08' }, downwardCompatible: true, degrees: [], majors: [],
  cities: ['北京'], deadline: { kind: 'unknown', raw: '' }, verdict: '可投', confidence: '中', industry: '其他', ownership: '民企',
};
const r = (o: Partial<RankInput>) => rankPosition({ ...base, ...o }, profile, TODAY);

test('A：强方向 + 第 1 城市，理由只列命中的事实', () => {
  const x = r({ industry: '互联网/科技', deadline: { kind: 'date', date: '2026-11-02' } });
  assert.equal(x.tier, 'A');
  assert.deepEqual(x.reasons, ['北京 · 含 AI产品经理 · 大厂']);
});

test('B：方向命中 + 列表内城市；C：方向或城市不符；null：不可投', () => {
  assert.equal(r({ title: '产品助理', cities: ['杭州'] }).tier, 'B');
  assert.equal(r({ title: '运营专员' }).tier, 'C');
  assert.equal(r({ cities: ['成都'] }).tier, 'C');
  assert.deepEqual(r({ verdict: '不可投' }), { tier: null, reasons: [], matched: [] });
});

test('城市顺序生效：第 2 城市没有加分到不了 A，有加分可以', () => {
  assert.equal(r({ cities: ['深圳'] }).tier, 'B');
  assert.equal(r({ cities: ['深圳'], ownership: '外企' }).tier, 'A');
  assert.equal(r({ cities: ['杭州'], ownership: '外企' }).tier, 'B');
  const swapped = rankPosition({ ...base, cities: ['深圳'] }, { ...profile, cities: ['深圳', '北京'] }, TODAY);
  assert.equal(swapped.tier, 'A');
});

test('全国多地：包含偏好城市时按该城市算，否则不算', () => {
  assert.equal(r({ cities: ['全国多地', '北京'] }).tier, 'A');
  assert.equal(r({ cities: ['全国多地'] }).tier, 'C');
});

test('可信度低或待确认不进 A', () => {
  assert.equal(r({ confidence: '低' }).tier, 'B');
  assert.equal(r({ verdict: '待确认' }).tier, 'B');
});

test('方向在公告列出的各个岗位上匹配，理由写命中的那个岗位', () => {
  const x = r({ title: '运营、销售 等 3 个岗位', roles: ['运营', '销售', 'AI产品运营'] });
  assert.equal(x.tier, 'A');
  assert.deepEqual(x.reasons, ['北京 · 含 AI产品运营']);
  assert.deepEqual(x.matched, ['AI产品运营']);
  assert.deepEqual(r({ title: 'x', roles: ['【抖音AI产品人才】：AI策略产品经理', '产品经理', '运营'] }).matched, ['AI策略产品经理', '产品经理']);
  assert.equal(r({ title: '研发 等 2 个岗位', roles: ['研发', '测试'] }).tier, 'C');
});

test('普通产品岗只算方向命中，不是强命中', () => {
  assert.equal(r({ title: '产品经理实习生' }).tier, 'B');
  assert.equal(r({ title: '大模型产品运营' }).tier, 'A');
});

test('排序不变量：加分、城市前缀、方向缺失和不可投', () => {
  const urgent = r({ cities: ['深圳'], deadline: { kind: 'date', date: '2026-11-02' } });
  assert.equal(urgent.tier, 'A');
  assert.equal(urgent.reasons.some((x) => x.includes('紧迫')), false);

  const trusted = r({ cities: ['深圳'], confidence: '高' });
  assert.equal(trusted.tier, 'A');
  assert.match(trusted.reasons.join(''), /来源可信度高/);
  assert.equal(r({ cities: ['深圳'], ownership: '央国企' }).tier, 'A');
  assert.equal(r({ cities: ['深圳'], deadline: { kind: 'date', date: '2026-10-01' } }).tier, 'B');
  assert.equal(r({ cities: ['杭州'], ownership: '外企', industry: '互联网/科技', confidence: '高' }).tier, 'B');
  assert.equal(r({ cities: ['北京市'] }).tier, 'A');
  assert.equal(rankPosition(base, { cities: ['北京'] }, TODAY).tier, 'C');
  assert.equal(r({ title: 'x', roles: ['AI产品经理' + '甲'.repeat(30)] }).tier, 'C');
  assert.equal(r({ title: 'x', roles: ['AI产品类与运营类及设计类合集'] }).tier, 'C');
  assert.deepEqual(r({ verdict: '不可投', industry: '互联网/科技', ownership: '外企' }), { tier: null, reasons: [], matched: [] });
  const matched = r({ title: '多岗位', roles: ['AI产品经理', '大模型产品', 'AIGC产品', 'LLM产品运营'] });
  assert.equal(matched.tier, 'A');
  assert.equal(matched.matched.length, 3);
});
