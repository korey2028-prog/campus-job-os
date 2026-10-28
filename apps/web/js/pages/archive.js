import { S, isMe, archive, filterJobs, sortJobs, TAGS, EXTRA_TAGS } from '../store.js';
import { esc, icon, act, onInput, countBy, rerender } from '../util.js';
import { pageHead, jobCard, emptyState } from '../components.js';
import { donut, hbars } from '../charts.js';

const f = { q: '', tags: new Set(), own: new Set(), ind: '', city: '', sort: 'new', expired: true, risk: true, mine: false };
let shown = 40;
const TAGSET = ['free', 'open', 'soe', 'foreign', 'bank', 'famous'];
const ALL = [...TAGS, ...EXTRA_TAGS];

function list() {
  const res = sortJobs(filterJobs(archive(), f), 'new');
  return `<p class="muted s">${res.length} 条</p>${res.length ? `<div class="cards">${res.slice(0, shown).map((v) => jobCard(v)).join('')}</div>${res.length > shown ? '<div class="more-row"><button class="btn secondary" data-act="ar-more">再显示 40 条</button></div>' : ''}` : emptyState('没有符合的存档', '换个关键词试试。')}`;
}

export default {
  title: () => '往届存档',
  render() {
    shown = 40;
    const A = archive();
    const c = countBy(A, (v) => v.ownership);
    const EX = ['27届', '27/28届', '27/28/29届', '26/27/28届', '26/27届', '26届', '不限届', '28届'];
    const past = [...countBy(A.filter((a) => !EX.includes(a.gradRaw)), (a) => a.gradRaw)].sort((a, b) => b[1] - a[1]);
    const ind = [...countBy(A, (v) => v.industry)].sort((a, b) => b[1] - a[1]).slice(0, 8);
    const cls = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'];
    const pastItems = past.slice(0, 5).map(([k, n], i) => ({ label: k, value: n, cls: cls[i] }));
    const rest = past.slice(5).reduce((s, x) => s + x[1], 0); if (rest) pastItems.push({ label: '其他', value: rest, cls: 'c6' });
    return `${pageHead('往届存档', isMe() ? '已过截止日的 27 届岗位，只读。用同一套筛选看，不会混进当前岗位。' : '26 届数据，只读。用同一套筛选看，不会混进当前岗位。')}
    <dl class="stats dense">
      <div class="stat"><dt>${isMe() ? '已截止岗位' : '26 届校招'}</dt><dd class="tnum">${A.length}</dd></div>
      <div class="stat"><dt>央国企总量</dt><dd class="tnum">${c.get('央国企') || 0}</dd></div>
      <div class="stat"><dt>外企总量</dt><dd class="tnum">${(c.get('外企') || 0) + (c.get('合资') || 0)}</dd></div>
      <div class="stat"><dt>民企</dt><dd class="tnum">${c.get('民企') || 0}</dd></div>
      <div class="stat"><dt>免笔试</dt><dd class="tnum">${A.filter((v) => v.writtenTest === '免').length}</dd></div>
      <div class="stat"><dt>不限专业</dt><dd class="tnum">${A.filter((v) => v.majors.includes('不限专业')).length}</dd></div></dl>
    <div class="grid-2"><section class="panel"><h2>往届生可投分布</h2>${donut(pastItems, { center: String(past.reduce((s, x) => s + x[1], 0)), sub: '条' })}</section>
    <section class="panel"><h2>行业分布</h2>${hbars(ind.map(([k, n]) => ({ label: k, value: n })))}</section></div>
    <div class="sticky-filter glass"><div class="searchbar">${icon('search', 20)}<input class="search" type="search" data-input="ar-q" value="${esc(f.q)}" placeholder="搜存档里的公司或岗位" aria-label="搜索存档" autocomplete="off"></div>
    <div class="filterbar"><div class="chips scroll" id="ar-chips">${chips()}</div></div></div>
    <div id="ar-list">${list()}</div>`;
  },
};
const chips = () => TAGSET.map((id) => { const t = ALL.find((x) => x.id === id); const on = f.tags.has(id); return `<button class="chip ${on ? 'on' : ''}" data-act="ar-tag" data-id="${id}" aria-pressed="${on}">${on ? icon('check', 15) : ''}${t.label}</button>`; }).join('');
const paint = () => { document.getElementById('ar-list').innerHTML = list(); document.getElementById('ar-chips').innerHTML = chips(); };
act('ar-tag', (el) => { const id = el.dataset.id; f.tags.has(id) ? f.tags.delete(id) : f.tags.add(id); shown = 40; paint(); });
act('ar-more', () => { shown += 40; paint(); });
onInput('ar-q', (el) => { f.q = el.value; shown = 40; paint(); });
