import { esc, icon, fmtMD, weekday, addDays, parseISO } from './util.js';
import { S, isMe, dlText, dlUrgent, isFav, displayTitle, OWN_GROUP } from './store.js';

export function verdictBadge(v) {
  if (v.archive) return `<span class="badge b-muted">${icon('archive', 14)}存档</span>`;
  const m = { 可投: ['ok', 'check'], 待确认: ['warn', 'question'], 不可投: ['muted', 'dash'] }[v.elig.verdict];
  return `<span class="badge b-${m[0]}">${icon(m[1], 14)}${v.elig.verdict}</span>`;
}
export function confDot(c, withText = true) {
  if (!c) return '';
  const n = { 高: 3, 中: 2, 低: 1 }[c.overall];
  const bars = [1, 2, 3].map((i) => `<i class="${i <= n ? 'on' : ''}"></i>`).join('');
  return `<span class="conf ${c.measured ? '' : 'unmeasured'} lv-${c.overall}" title="可信度${c.overall}${c.measured ? '' : '（未实测）'}"><span class="bars" aria-hidden="true">${bars}</span>${withText ? `<span>可信度 ${c.overall}${c.measured ? '' : '<small> · 未实测</small>'}</span>` : `<span class="sr">可信度${c.overall}</span>`}</span>`;
}
// 个人模式的列表里，可信度只在“低”或岗位待确认时提示；其余收起（详情页仍完整显示）
export const confFlag = (v) => (!isMe() || v.conf?.overall === '低' || v.elig?.verdict === '待确认' ? confDot(v.conf) : '');
export function dlChip(v) {
  const u = dlUrgent(v);
  const ic = v.deadline.kind === 'date' ? 'clock' : v.deadline.kind === 'rolling' ? 'clock' : 'question';
  return `<span class="dl ${u ? 'urgent' : ''}">${icon(ic, 14)}${esc(dlText(v))}</span>`;
}

export function jobCard(v, { showApp = false } = {}) {
  const fav = isFav(v.id);
  const sub = [displayTitle(v), v.cities.slice(0, 2).join('、') + (v.cities.length > 2 ? ' 等' : '')].filter(Boolean).join(' · ');
  return `<article class="card job ${v.elig?.verdict === '不可投' ? 'dim' : ''} press">
    <a class="job-main" href="#/jobs/${v.id}">
      <div class="job-top"><h3 class="job-co">${esc(v.company)}</h3>${v.mine ? '<span class="tag-mine">我添加的</span>' : ''}${v.merged > 1 ? `<span class="tag-mine alt" title="已合并 ${v.merged} 条重复来源">${v.merged} 个来源</span>` : ''}</div>
      <p class="job-title">${esc(sub)}</p>
      ${v.rank?.tier === 'A' && v.rank.reasons[0] ? `<p class="job-why">${icon('sparkle', 14)}${esc(v.rank.reasons[0])}</p>` : ''}
      <div class="job-meta">${verdictBadge(v)}${dlChip(v)}${confFlag(v)}${v.cohortDoubt ? `<span class="badge b-warn soft">${icon('alert', 14)}届次存疑，先看公告</span>` : ''}${v.risk ? `<span class="badge b-warn soft">${icon('alert', 14)}疑似风险</span>` : ''}</div>
    </a>
    ${v.archive ? '' : `<button class="star ${fav ? 'on' : ''}" data-act="fav" data-id="${v.id}" aria-pressed="${fav}" aria-label="${fav ? '取消收藏' : '收藏'} ${esc(v.company)}">${icon('star', 22)}</button>`}
  </article>`;
}

export function reasonIcon(text) {
  if (/不在|低于|已截止|不向下兼容|不符/.test(text)) return ['x', 'no', '不符'];
  if (/未知|无法解析|未提供|无明显匹配|不固定/.test(text)) return ['question', 'maybe', '待确认'];
  return ['check', 'yes', '符合'];
}

// 简单月历：items 是 {date, v}[]；selected 为选中的日期
export function calendarHTML(monthStr, items, selected) {
  const [y, m] = monthStr.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7; // 周一为首
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const byDay = new Map();
  for (const it of items) { if (!byDay.has(it.date)) byDay.set(it.date, []); byDay.get(it.date).push(it.v); }
  const prev = addMonth(monthStr, -1), next = addMonth(monthStr, 1);
  let cells = '';
  for (let i = 0; i < lead; i++) cells += '<span class="cal-cell empty" aria-hidden="true"></span>';
  for (let d = 1; d <= days; d++) {
    const ds = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const list = byDay.get(ds) || [];
    const groups = [...new Set(list.map((v) => OWN_GROUP(v.ownership)))].slice(0, 4);
    const cls = ['cal-cell', ds === S.today ? 'today' : '', ds === selected ? 'sel' : '', list.length ? 'has' : ''].join(' ');
    cells += `<button class="${cls}" data-act="cal-day" data-date="${ds}" ${list.length ? '' : 'aria-disabled="true"'} aria-label="${m}月${d}日，${list.length} 个截止"><span class="cal-d">${d}</span>${list.length ? `<span class="cal-n">${list.length}</span><span class="cal-dots" aria-hidden="true">${groups.map((g) => `<i class="o-${ownKey(g)}"></i>`).join('')}</span>` : ''}</button>`;
  }
  return `<div class="cal" data-month="${monthStr}">
    <div class="cal-head"><button class="icon-btn" data-act="cal-nav" data-month="${prev}" aria-label="上个月">${icon('left')}</button><strong>${y}年${m}月</strong><button class="icon-btn" data-act="cal-nav" data-month="${next}" aria-label="下个月">${icon('right')}</button></div>
    <div class="cal-grid"><span class="cal-wd">一</span><span class="cal-wd">二</span><span class="cal-wd">三</span><span class="cal-wd">四</span><span class="cal-wd">五</span><span class="cal-wd">六</span><span class="cal-wd">日</span>${cells}</div>
    <p class="cal-legend">${legend()}</p>
  </div>`;
}
export const ownKey = (g) => ({ 民企: 'private', 央国企: 'soe', 银行: 'bank', 外企: 'foreign', 其他: 'other' }[g] || 'other');
export function legend() {
  return ['民企', '央国企', '银行', '外企', '其他'].map((g) => `<span class="lg"><i class="o-${ownKey(g)}"></i>${g}</span>`).join('');
}
export function addMonth(ms, n) { const [y, m] = ms.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); return d.toISOString().slice(0, 7); }

export function calendarItems(list) {
  return list.filter((v) => v.deadline.kind === 'date' && !v.archive && v.deadline.date >= S.today).map((v) => ({ date: v.deadline.date, v }));
}
export function dayList(date, items) {
  const rows = items.filter((i) => i.date === date).map((i) => i.v);
  if (!rows.length) return `<p class="muted pad">${fmtMD(date)}${weekday(date)}没有截止的岗位。点有数字的日期查看。</p>`;
  return `<h3 class="sub-h">${fmtMD(date)}${weekday(date)} · ${rows.length} 个截止</h3><div class="list">${rows.map((v) => `<a class="row-link" href="#/jobs/${v.id}"><span><strong>${esc(v.company)}</strong><small>${esc(v.title)}</small></span>${verdictBadge(v)}${icon('right', 18)}</a>`).join('')}</div>`;
}

export function emptyState(title, body, actionHTML = '') {
  return `<div class="empty"><div class="empty-ic">${icon('search', 28)}</div><h3>${esc(title)}</h3><p>${esc(body)}</p>${actionHTML}</div>`;
}
export function pageHead(title, sub = '', right = '') {
  return `<header class="page-head"><div><h1>${esc(title)}</h1>${sub ? `<p class="lede">${sub}</p>` : ''}</div>${right ? `<div class="head-actions">${right}</div>` : ''}</header>`;
}
export const seg = (name, opts, cur) => `<div class="seg" role="tablist">${opts.map(([v, l]) => `<button role="tab" class="${v === cur ? 'on' : ''}" aria-selected="${v === cur}" data-act="${name}" data-v="${esc(v)}">${esc(l)}</button>`).join('')}</div>`;
export { parseISO };

// ---- 日历容器：数据页与渠道页共用 ----
import { positions as _positions } from './store.js';
import { act as _act } from './util.js';
const calState = { month: '2026-10', day: null };
export function calWrap(scope = 'all') {
  const items = calendarItems(_positions().filter((v) => !v.risk && (scope === 'all' || v.elig.verdict === '可投')));
  calState.month = calState.month || S.today.slice(0, 7);
  return `<div class="cal-wrap" data-scope="${scope}">${calendarHTML(calState.month, items, calState.day)}<div class="cal-day">${calState.day ? dayList(calState.day, items) : '<p class="muted pad">点有数字的日期，查看当天截止的岗位。</p>'}</div></div>`;
}
function repaintCal(el) {
  const w = el.closest('.cal-wrap'); if (!w) return;
  w.outerHTML = calWrap(w.dataset.scope);
}
_act('cal-nav', (el) => { calState.month = el.dataset.month; calState.day = null; repaintCal(el); });
_act('cal-day', (el) => { if (el.getAttribute('aria-disabled')) return; calState.day = el.dataset.date; repaintCal(el); });
