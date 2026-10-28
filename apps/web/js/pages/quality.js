import { S, isMe, positions, dupGroups, rawCount, dlText, getPos } from '../store.js';
import { esc, icon, act, countBy, pct } from '../util.js';
import { pageHead, confDot, verdictBadge } from '../components.js';
import { hbars } from '../charts.js';

const LV = ['高', '中', '低'];
const lvCls = { 高: 'c-ok', 中: 'c-warn', 低: 'c-mute' };
const dist = (set, key) => { const c = countBy(set, (v) => v.conf[key]); return LV.map((l) => ({ label: l, value: c.get(l) || 0, cls: lvCls[l] })); };
const ACC = [['毕业时间', '官方原文 / 规则解析', 60, 97], ['毕业时间', 'AI 抽取', 60, 88], ['学历', '规则解析', 60, 99], ['截止日', '官方原文', 45, 96], ['截止日', 'AI 抽取', 45, 79], ['专业', 'AI 抽取', 40, 84], ['城市', '规则解析', 50, 95]];

export default {
  title: () => '数据质量',
  render() {
    const set = positions();
    const queue = set.filter((v) => v.conf.overall === '低' && !v.userVerified && !v.risk).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 10);
    const confl = set.filter((v) => v.conflicts.length);
    const risk = set.filter((v) => v.risk);
    const kinds = [...countBy(set.flatMap((v) => v.sources.slice(0, 1)), (s) => s.kind)].sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ label: k, value: n }));
    const noSrc = set.filter((v) => !v.sources.length).length;
    if (noSrc) kinds.push({ label: '没有来源链接', value: noSrc });
    const groups = dupGroups();
    const low = set.filter((v) => v.conf.overall === '低').length;
    return `${pageHead('数据质量', `<strong class="tnum">${low}</strong> 个岗位可信度偏低，<strong class="tnum">${confl.length}</strong> 个有冲突，投之前先核对官网。`)}
    <dl class="stats"><div class="stat"><dt>岗位总数</dt><dd class="tnum">${set.length}</dd></div><div class="stat"><dt>合并重复</dt><dd class="tnum">${rawCount() - set.length}</dd></div><div class="stat"><dt>有冲突</dt><dd class="tnum">${confl.length}</dd></div><div class="stat"><dt>疑似风险</dt><dd class="tnum">${risk.length}</dd></div></dl>
    <div class="grid-2">
      <section class="panel"><h2>综合可信度</h2>${hbars(dist(set, 'overall'))}<p class="muted s">由来源、字段、时效三项按固定规则推出，不是一个黑箱分数。</p></section>
      <section class="panel"><h2>来源可信度</h2>${hbars(dist(set, 'source'))}<p class="muted s">官方原文 &gt; 招聘系统页 &gt; 第三方整理。</p></section>
      <section class="panel"><h2>字段可靠度</h2>${hbars(dist(set, 'field'))}<p class="muted s">规则解析或人工核对 &gt; AI 抽取 &gt; 默认值。</p></section>
      <section class="panel"><h2>时效</h2>${hbars(dist(set, 'freshness'))}<p class="muted s">30 天内为高，90 天内为中。</p></section>
      <section class="panel"><h2>来源类型</h2>${hbars(kinds)}</section>
      ${isMe() ? '<section class="panel"><h2>实测准确率 <span class="badge b-muted">尚未实测</span></h2><p class="muted">这份第三方数据包还没有抽样核对过，可信度按先验估计。</p></section>' : ''}${isMe() ? '' : `<section class="panel"><h2>实测准确率 <span class="badge b-muted">示例 · 虚构数字，尚未实测</span></h2><div class="tbl-wrap"><table class="tbl"><thead><tr><th>字段</th><th>取得方式</th><th>样本</th><th>一致率</th></tr></thead><tbody>${ACC.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td class="tnum">${r[2]}</td><td class="tnum">${r[3]}%</td></tr>`).join('')}</tbody></table></div><p class="muted s">抽样回到原始来源核对。这里是虚构数字，真实数据需要先抽样。</p></section>`}
    </div>
    <section class="block"><h2 class="h2">冲突列表</h2>${confl.length ? `<div class="list">${confl.map((v) => `<div class="row-link static"><a href="#/jobs/${v.id}" class="grow"><strong>${esc(v.company)} · ${esc(v.title)}</strong><small>${v.conflicts.map((c) => `${c.field === 'deadline' ? '截止日' : '学历'}：${c.values.map((x) => esc(x.value)).join(' / ')}`).join('；')}</small></a><button class="btn secondary sm" data-act="d-verify" data-id="${v.id}">${v.userVerified ? '已核对' : '我核对过了'}</button></div>`).join('')}</div>` : '<p class="muted">没有冲突。</p>'}</section>
    <section class="block"><h2 class="h2">待核验队列</h2><div class="list">${S.feedback.map((fb) => { const v = getPos(fb.posId); return v ? `<div class="row-link static"><a href="#/jobs/${v.id}" class="grow"><strong>${esc(v.company)} · ${esc(v.title)}</strong><small>${esc(fb.reason)}${fb.note ? '：' + esc(fb.note) : ''}</small></a><span class="badge b-warn">${icon('flag', 14)}用户反馈</span></div>` : ''; }).join('')}${queue.map((v) => `<div class="row-link static"><a href="#/jobs/${v.id}" class="grow"><strong>${esc(v.company)} · ${esc(v.title)}</strong><small>${confDot(v.conf, true).replace(/<\/?small>/g, '')}</small></a><button class="btn secondary sm" data-act="d-verify" data-id="${v.id}">我核对过了</button></div>`).join('') || '<p class="muted">队列是空的。</p>'}</div></section>
    <section class="block"><h2 class="h2">风险提示</h2>${risk.length ? `<div class="list">${risk.slice(0, 8).map((v) => `<a class="row-link" href="#/jobs/${v.id}"><span><strong>${esc(v.company)} · ${esc(v.title)}</strong><small>${esc(v.risk.kind)}</small></span>${icon('right', 18)}</a>`).join('')}</div>` : '<p class="muted">没有。</p>'}<p class="fine">风险提示只是疑似判断，默认在岗位列表里排除，可在筛选里打开。</p></section>
    <section class="block"><h2 class="h2">去重</h2><p class="muted">${rawCount()} 条原始记录按「公司规范名 + 岗位名 + 批次 + 毕业区间」合并成 ${set.length} 个岗位，多个来源挂在同一岗位上。</p>
      <div class="list">${groups.slice(0, 5).map((g) => `<a class="row-link" href="#/jobs/${g[0].id}"><span><strong>${esc(g[0].title)}</strong><small>${esc([...new Set(g.map((x) => x.company))].join(' = '))}</small></span><span class="badge b-muted tnum">${g.length} 条</span>${icon('right', 18)}</a>`).join('')}</div></section>`;
  },
};
