import { S, isMe, positions, OWN_GROUP } from '../store.js';
import { esc, icon, act, openSheet, diffDays, addDays, fmtMD, countBy, pct, rerender } from '../util.js';
import { pageHead, seg, calWrap, legend } from '../components.js';
import { hbars, donut, stackedColumns, lineChart, stackedHBars } from '../charts.js';

let scope = 'all';
const OG = ['民企', '央国企', '银行', '外企', '其他'];
const OC = { 民企: 'o-private', 央国企: 'o-soe', 银行: 'o-bank', 外企: 'o-foreign', 其他: 'o-other' };
const og = (v) => OWN_GROUP(v.ownership);

function dataset() { return positions().filter((v) => !v.risk && (scope === 'all' || v.elig.verdict === '可投')); }

function metrics(set) {
  const n = set.length || 1;
  const dated = set.filter((v) => v.deadline.kind === 'date').length;
  const good = set.filter((v) => v.conf.overall !== '低').length;
  const confTxt = `高、中可信度的岗位占 ${pct(good, set.length)}%，其余来源较弱或信息较旧。`;
  const dlCov = `截止日已知的岗位占 ${pct(dated, set.length)}%，其余是"未公布"或"招满即止"，所以这个数偏低。`;
  const gen = isMe() ? '这个口径依赖的字段来自第三方数据包，未逐条核对。' : '这个口径依赖的字段在演示数据里均已标注。';
  const camp = set.filter((v) => !v.internship);
  const win = (v, a, b) => v.daysLeft != null && v.daysLeft >= a && v.daysLeft <= b && !v.expired;
  return [
    { id: 'd7', label: '7 天内截止', v: set.filter((v) => win(v, 0, 7)).length, def: '截止日在今天到 7 天后之间的岗位，已截止的不算。', cov: dlCov, href: '#/jobs?tags=soon&sort=due' },
    { id: 'd30', label: '30 天内截止', v: set.filter((v) => win(v, 0, 30)).length, def: '截止日在今天到 30 天后之间的岗位。', cov: dlCov, href: '#/jobs?sort=due' },
    { id: 'all27', label: '27 届校招总数', v: camp.length, def: '非实习的岗位总数，已按公司、岗位、批次、毕业区间合并重复。', cov: gen, href: '#/jobs' },
    { id: 'open', label: '不限专业', v: set.filter((v) => v.majors.length === 0 || v.majors.includes('不限专业')).length, def: '公告里没有限制专业，或明确写了"不限专业"的岗位。', cov: '大部分营销、运营、销售类岗位实际不限专业，但公告没写的不算在内。', href: '#/jobs?tags=open' },
    { id: 'soe', label: '央国企总量', v: set.filter((v) => ['央国企', '银行'].includes(v.ownership)).length, def: '企业性质为央国企或银行的岗位。', cov: gen, href: '#/jobs?own=央国企,银行' },
    { id: 'intern', label: '27/28 届实习', v: set.filter((v) => v.internship).length, def: '招聘类型为实习的岗位。', cov: gen, href: '#/jobs?tags=intern' },
    { id: 'foreign', label: '外企校招', v: camp.filter((v) => ['外企', '合资'].includes(v.ownership)).length, def: '企业性质为外企或合资、非实习的岗位。', cov: gen, href: '#/jobs?tags=foreign' },
    { id: 'big', label: '大厂校招', v: camp.filter((v) => v.industry === '互联网/科技').length, def: '所属行业为互联网/科技、非实习的岗位。', cov: gen, href: '#/jobs?tags=big' },
    { id: 'past', label: '25/26 届可投（往届可投）', v: set.filter((v) => v.grad && v.grad.from < '2026-09').length, def: '毕业区间覆盖 2025/2026 届的岗位，往届生也能投。', cov: '毕业区间由届次文字换算，无法解析的不计。', href: '#/jobs?tags=past&expired=1' },
    { id: 'free', label: '免笔试', v: set.filter((v) => v.writtenTest === '免').length, def: '公告明确写了免笔试，或流程里没有笔试的岗位。', cov: '"部分岗位免笔试"不计入这里。', href: '#/jobs?tags=free' },
  ].map((m) => ({ ...m, conf: confTxt }));
}

function lastDays(n) { const out = []; for (let i = n - 1; i >= 0; i--) out.push(addDays(S.today, -i)); return out; }

export default {
  title: () => '数据',
  render() {
    const set = dataset();
    const M = metrics(set);
    const grad = `${S.profile.gradDate}-30`;
    const left = diffDays(grad, S.today);
    // 图表数据
    const ownC = countBy(set, og);
    const donutItems = OG.map((k) => ({ label: k, value: ownC.get(k) || 0, cls: OC[k] })).filter((x) => x.value);
    const cityC = [...countBy(set.flatMap((v) => v.cities.map((c) => ({ c }))), (x) => x.c)].filter(([c]) => c !== '未填写').sort((a, b) => b[1] - a[1]).slice(0, 12);
    const indC = [...countBy(set, (v) => v.industry)].sort((a, b) => b[1] - a[1]);
    const days = lastDays(30);
    const upd = set.filter((v) => v.updatedAt >= days[0]);
    const byDay = (fn) => days.map((d) => { const r = {}; for (const v of upd.filter((x) => x.updatedAt === d)) { const k = fn(v); r[k] = (r[k] || 0) + 1; } return r; });
    const labels = days.map((d) => fmtMD(d).replace('月', '/').replace('日', ''));
    const freeRows = OG.map((k) => ({ label: k, segs: { 免: set.filter((v) => og(v) === k && v.writtenTest === '免').length, 其他: set.filter((v) => og(v) === k && v.writtenTest !== '免').length } })).filter((r) => r.segs.免 + r.segs.其他);
    const vs = indC.map(([ind]) => ({ label: ind, segs: Object.fromEntries(OG.map((k) => [k, set.filter((v) => v.industry === ind && og(v) === k).length])) }));
    const due = set.filter((v) => v.daysLeft != null && v.daysLeft >= 0 && v.daysLeft <= 30).sort((a, b) => a.daysLeft - b.daysLeft);
    const A = S.data.archive;
    const EX = ['27届', '27/28届', '27/28/29届', '26/27/28届', '26/27届', '26届', '不限届', '28届'];
    const pastC = [...countBy(A.filter((a) => !EX.includes(a.gradRaw)), (a) => a.gradRaw)].sort((a, b) => b[1] - a[1]);
    const ringCls = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'];
    const pastItems = pastC.slice(0, 5).map(([k, v], i) => ({ label: k, value: v, cls: ringCls[i] }));
    const rest = pastC.slice(5).reduce((s, x) => s + x[1], 0);
    if (rest) pastItems.push({ label: '其他', value: rest, cls: 'c6' });
    const panel = (t, def, inner, wide) => `<section class="panel ${wide ? 'wide' : ''}"><div class="p-head"><h2>${t}</h2><button class="icon-btn sm" data-act="chart-def" data-def="${esc(def)}" data-title="${esc(t)}" aria-label="${esc(t)} 的口径">${icon('info', 18)}</button></div>${inner}</section>`;
    const groups = OG.map((k) => [k, due.filter((v) => og(v) === k)]).filter(([, l]) => l.length);
    return `${pageHead('数据', `原站两个仪表盘的指标都在这里。点任一数字，看口径、覆盖率和可信度。`, seg('ins-scope', [['all', '全部岗位'], ['can', '我能投的']], scope))}
    <dl class="stats dense">${M.map((m) => `<button class="stat click" data-act="metric" data-id="${m.id}"><dt>${esc(m.label)}</dt><dd class="tnum">${m.v}</dd></button>`).join('')}
      <div class="stat"><dt>距毕业（${esc(S.profile.gradDate)}）</dt><dd class="tnum">${left}<small>天</small></dd></div></dl>
    <div class="grid-2">
      ${panel('企业类型', '按企业性质统计岗位数。外企包含合资；事业单位并入"其他"。', donut(donutItems, { center: String(set.length), sub: '个岗位' }))}
      ${panel('往届生可投分布', '来自 26 届存档：可投届次不属于 27 届及以后的岗位，按届次写法分组。', donut(pastItems, { center: String(A.filter((a) => !EX.includes(a.gradRaw)).length), sub: '条存档' }))}
      ${panel('Base 地分布', '按工作地统计岗位数，一个岗位多个城市时每个城市各计一次。点城市可看对应岗位。', hbars(cityC.map(([c, n]) => ({ label: c, value: n })), { href: (i) => (i.label === '全国多地' ? '#/jobs?tags=multi' : `#/jobs?city=${encodeURIComponent(i.label)}`) }))}
      ${panel('行业分布', '按所属行业统计岗位数。点行业可看对应岗位。', hbars(indC.map(([k, n]) => ({ label: k, value: n })), { href: (i) => `#/jobs?ind=${encodeURIComponent(i.label)}` }))}
      ${panel('各类型企业免笔试数量', '每种企业性质里，免笔试与其他岗位的数量。', stackedHBars(freeRows, [{ key: '免', label: '免笔试', cls: 'c2' }, { key: '其他', label: '其他', cls: 'c7' }]))}
      ${panel('各行业 VS 企业性质', '每个行业里，不同企业性质的岗位数。', stackedHBars(vs, OG.map((k) => ({ key: k, label: k, cls: OC[k] }))))}
      ${panel('近 30 天更新趋势', '来源最近一次更新落在该日的岗位数。', lineChart(labels, days.map((d) => upd.filter((v) => v.updatedAt === d).length)), true)}
      ${panel('近 30 天各类型企业更新概况', '最近 30 天有更新的岗位，按企业性质分组，每天一根柱。', stackedColumns(labels, OG.map((k) => ({ key: k, label: k, cls: OC[k] })), byDay(og)), true)}
      ${panel('近 30 天更新企业量（含免笔试）', '最近 30 天有更新的岗位，分成免笔试与其他。', stackedColumns(labels, [{ key: '免', label: '免笔试', cls: 'c2' }, { key: '其他', label: '其他', cls: 'c7' }], byDay((v) => (v.writtenTest === '免' ? '免' : '其他'))), true)}
      ${panel('30 天内截止企业汇总', '只统计有明确截止日的岗位，按企业性质分组。', groups.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>企业</th><th>岗位</th><th>截止</th></tr></thead><tbody>${groups.map(([k, l]) => `<tr class="grp"><th colspan="3">${k} <span class="tnum">${l.length}</span></th></tr>${l.slice(0, 8).map((v) => `<tr><td><a href="#/jobs/${v.id}">${esc(v.company)}</a></td><td>${esc(v.title)}</td><td class="tnum">${fmtMD(v.deadline.date)}</td></tr>`).join('')}${l.length > 8 ? `<tr><td colspan="3" class="muted">还有 ${l.length - 8} 个</td></tr>` : ''}`).join('')}</tbody></table></div>` : '<p class="muted">30 天内没有明确截止的岗位。</p>', true)}
      ${panel('网申截止日历', '已截止和没有明确截止日的岗位已过滤。颜色之外，每个日期都有数字。', calWrap(scope), true)}
    </div>
    <p class="fine">${isMe() ? '岗位来自第三方整理的公开校招表。' : '演示数据为虚构。'}口径说明按原站仪表盘配置改写成白话，并增加了覆盖率与可信度。</p>`;
  },
  _metrics: metrics, _dataset: dataset,
};
act('ins-scope', (el) => { scope = el.dataset.v; rerender(); });
act('chart-def', (el) => openSheet(`<p class="lead-p">${esc(el.dataset.def)}</p>`, { title: el.dataset.title }));
act('metric', (el) => {
  const m = metrics(dataset()).find((x) => x.id === el.dataset.id);
  openSheet(`<div class="metric-sheet"><div class="big-n tnum">${m.v}</div>
    <dl class="kvs one"><div class="kv"><dt>口径</dt><dd>${esc(m.def)}</dd></div><div class="kv"><dt>覆盖率</dt><dd>${esc(m.cov)}</dd></div><div class="kv"><dt>可信度</dt><dd>${esc(m.conf)}</dd></div><div class="kv"><dt>范围</dt><dd>${scope === 'all' ? '全部岗位（不含疑似风险岗位）' : '只含按你的画像判断为"可投"的岗位'}</dd></div></dl>
    <div class="sheet-foot"><a class="btn primary" href="${m.href}" data-act="close-sheet">看这些岗位${icon('right', 18)}</a></div></div>`, { title: m.label });
});
