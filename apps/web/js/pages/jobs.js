import { S, isMe, positions, filterJobs, sortJobs, parseFilters, filtersToParams, TAGS, EXTRA_TAGS, PRESETS, tagCount, easyTags, EASY_COMBO, LUCK_COMBO, matchBase, summary, rawCount, dlText } from '../store.js';
import { esc, icon, act, onInput, openSheet, sheetRoot, safeGet, safeSet } from '../util.js';
import { jobCard, emptyState, pageHead, verdictBadge, confFlag } from '../components.js';
import { openIntake } from './intake.js';

const PAGE = 48;
let shown = PAGE;
let view = safeGet('jobos.view') === 'table' ? 'table' : 'cards';
const getF = () => parseFilters(new URLSearchParams(location.hash.split('?')[1] || ''));
function setF(mut, { reset = true } = {}) {
  const f = getF(); mut(f);
  const qs = filtersToParams(f).toString();
  history.replaceState(null, '', '#/jobs' + (qs ? '?' + qs : ''));
  if (reset) shown = PAGE;
  paint();
}

const COMBOS = { easy: { ids: EASY_COMBO, label: '省事组合', tip: '能投 + 免笔试或部分免笔试 + 截止未过' }, luck: { ids: LUCK_COMBO, label: '碰运气', tip: '省事组合里 7 天内截止的，按截止日排：门槛低，投一下试试' } };
// 碰运气包含省事组合，开着碰运气时省事组合不再单独亮
const comboOn = (f, k = 'easy') => COMBOS[k].ids.every((id) => f.tags.has(id)) && !(k === 'easy' && comboOn(f, 'luck'));
function chipsHTML(f) {
  const base = positions();
  const combo = Object.entries(COMBOS).map(([k, c]) => `<button class="chip ${comboOn(f, k) ? 'on' : ''}" data-act="jf-combo" data-id="${k}" aria-pressed="${comboOn(f, k)}" title="${c.tip}">${comboOn(f, k) ? icon('check', 15) : ''}${c.label}<em>${filterJobs(base, { ...f, tags: new Set([...f.tags, ...c.ids]) }).length}</em></button>`).join('');
  return combo + TAGS.map((t) => {
    const on = f.tags.has(t.id);
    return `<button class="chip ${on ? 'on' : ''}" data-act="jf-tag" data-id="${t.id}" aria-pressed="${on}">${on ? icon('check', 15) : ''}${t.label}<em>${tagCount(base, f, t.id)}</em></button>`;
  }).join('');
}
// 个人模式：只列出现 2 次以上的城市（优先城市在前，接着“远程”，其余按岗位数），“其他城市”“海外”放最后；演示版保持原样
const MIN_CITY_JOBS = 2, REMOTE = '远程', TAIL_CITIES = ['其他城市', '海外'];
function cityOptions(base) {
  const n = new Map();
  for (const v of base) for (const c of new Set(v.cities)) n.set(c, (n.get(c) || 0) + 1);
  if (!isMe()) return [...n.keys()].filter((c) => c !== '全国多地' && c !== '未填写').sort();
  const pref = S.profile.cities || [];
  const main = [...n].filter(([c, k]) => k >= MIN_CITY_JOBS && c !== '全国多地' && c !== '未填写' && c !== REMOTE && !TAIL_CITIES.includes(c)).sort((a, b) => b[1] - a[1]).map(([c]) => c);
  const head = [...pref.filter((c) => main.includes(c)), ...(n.has(REMOTE) ? [REMOTE] : [])];
  return [...head, ...main.filter((c) => !head.includes(c)), ...TAIL_CITIES.filter((c) => n.has(c))];
}
function optsLists() {
  const base = positions();
  return {
    inds: [...new Set(base.map((v) => v.industry))].sort(),
    cities: cityOptions(base),
  };
}
function selectsHTML(f, suffix = '') {
  const { inds, cities } = optsLists();
  return `<label class="sel"><span class="sr">行业</span><select data-change="jf-ind${suffix}"><option value="">行业：全部</option>${inds.map((i) => `<option ${f.ind === i ? 'selected' : ''}>${esc(i)}</option>`).join('')}</select>${icon('down', 16)}</label>
  <label class="sel"><span class="sr">城市</span><select data-change="jf-city${suffix}"><option value="">城市：全部</option>${cities.map((c) => `<option ${f.city === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>${icon('down', 16)}</label>`;
}
const activeCount = (f) => f.tags.size + f.own.size + (f.ind ? 1 : 0) + (f.city ? 1 : 0) + (f.expired ? 1 : 0) + (f.risk ? 1 : 0) + (f.mine ? 1 : 0);

function tableHTML(rows) {
  return `<div class="tbl-wrap jobs-tbl"><table class="tbl dense"><thead><tr><th>公司</th><th>岗位</th><th>能否投</th><th>截止</th><th>城市</th><th>企业性质</th><th>可信度</th></tr></thead><tbody>${rows.map((v) => `<tr class="${v.elig.verdict === '不可投' ? 'dim' : ''}" data-act="go" data-href="#/jobs/${v.id}"><td><a href="#/jobs/${v.id}" class="cell-link">${esc(v.company)}</a></td><td>${esc(v.title)}</td><td>${verdictBadge(v)}</td><td class="tnum nowrap">${esc(dlText(v))}</td><td>${esc(v.cities.slice(0, 2).join('、'))}</td><td>${esc(v.ownership)}</td><td class="nowrap">${confFlag(v)}</td></tr>`).join('')}</tbody></table></div>`;
}

function listHTML(f) {
  const all = positions();
  const res = sortJobs(filterJobs(all, f), f.sort === 'due' ? 'rel' : f.sort);
  if (f.sort === 'due') res.sort((a, b) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999));
  const hidden = !f.expired ? all.filter((v) => v.expired && filterJobs([v], { ...f, expired: true }).length).length : 0;
  const cnt = { 可投: 0, 待确认: 0, 不可投: 0 };
  res.forEach((v) => { cnt[v.elig.verdict]++; });
  const stat = `共 ${res.length} 个 · 能投 ${cnt.可投} · 待确认 ${cnt.待确认} · 不可投 ${cnt.不可投}`;
  let html = '';
  if (!res.length) {
    let best = null;
    for (const id of f.tags) { const g = { ...f, tags: new Set([...f.tags].filter((x) => x !== id)) }; const n = filterJobs(all, g).length; if (n && (!best || n > best.n)) best = { id, n, label: [...TAGS, ...EXTRA_TAGS].find((t) => t.id === id)?.label }; }
    if (f.q) { const g = { ...f, q: '' }; const n = filterJobs(all, g).length; if (n && (!best || n > best.n)) best = { id: '__q', n, label: `搜索「${f.q}」` }; }
    html = emptyState('没有符合的岗位', best ? `去掉『${best.label}』可看到 ${best.n} 个。` : '换个关键词，或清空筛选看看。',
      best ? `<button class="btn secondary" data-act="jf-relax" data-id="${best.id}">去掉『${esc(best.label)}』</button>` : `<button class="btn secondary" data-act="jf-clear">清空筛选</button>`);
  } else {
    const part = res.slice(0, shown);
    const cards = `<div class="cards">${part.map((v) => jobCard(v)).join('')}</div>`;
    html = view === 'table' ? `<div class="only-desktop">${tableHTML(part)}</div><div class="only-mobile">${cards}</div>` : cards;
    if (res.length > shown) html += `<div class="more-row"><button class="btn secondary" data-act="jf-more">再显示 ${Math.min(PAGE, res.length - shown)} 个（还有 ${res.length - shown} 个）</button></div>`;
  }
  if (hidden) html += `<div class="more-row"><button class="btn ghost" data-act="jf-expired">显示 ${hidden} 个已截止</button></div>`;
  if (f.expired) html += `<div class="more-row"><button class="btn ghost" data-act="jf-expired">收起已截止</button></div>`;
  return { html, n: res.length, stat };
}

function paint() {
  const f = getF();
  const c = document.getElementById('jf-chips'); if (!c) return;
  c.innerHTML = chipsHTML(f);
  const { html, stat } = listHTML(f);
  document.getElementById('jf-list').innerHTML = html;
  document.getElementById('jf-count').textContent = stat;
  const n = activeCount(f);
  document.querySelectorAll('.jf-badge').forEach((b) => { b.textContent = n || ''; b.hidden = !n; });
  const sel = document.getElementById('jf-sel'); if (sel) sel.innerHTML = selectsHTML(f);
}

const badge = (f) => `<span class="count-badge jf-badge" ${activeCount(f) ? '' : 'hidden'}>${activeCount(f) || ''}</span>`;

export default {
  title: () => '岗位',
  render() {
    const f = getF(); const s = summary();
    shown = PAGE;
    const L = listHTML(f);
    return `${pageHead('岗位', `按你的情况，能投 <strong class="ok-t">${s.can}</strong> 个、需要确认 <strong class="warn-t">${s.maybe}</strong> 个`,
      `<button class="btn secondary add-btn" data-act="open-intake" aria-label="添加一条招聘">${icon('plus', 18)}<span class="lbl">添加一条招聘</span></button>`)}
    <div class="sticky-filter glass"><div class="search-row"><div class="searchbar">${icon('search', 20)}<input id="jf-q" class="search" type="search" data-input="jf-q" value="${esc(f.q)}" placeholder="搜公司、岗位、专业" aria-label="搜索岗位" autocomplete="off"></div>
      <button class="btn secondary filter-m" data-act="jf-sheet" aria-label="筛选">${icon('filter', 18)}<span class="lbl">筛选</span>${badge(f)}</button></div>
    <div class="filterbar"><div class="chips scroll" id="jf-chips" role="group" aria-label="筛选标签">${chipsHTML(f)}</div></div></div>
    <div class="filter-row"><div class="sels" id="jf-sel">${selectsHTML(f)}</div>
      <button class="btn secondary sm" data-act="jf-sheet">${icon('filter', 18)}快捷筛选${badge(f)}</button></div>
    <div class="list-head"><span id="jf-count" class="muted tnum">${L.stat}</span>
      <div class="lh-right"><div class="seg sm only-desktop" role="group" aria-label="显示方式"><button class="${view === 'cards' ? 'on' : ''}" data-act="jf-view" data-v="cards" aria-pressed="${view === 'cards'}">卡片</button><button class="${view === 'table' ? 'on' : ''}" data-act="jf-view" data-v="table" aria-pressed="${view === 'table'}">表格</button></div>
      <label class="sel plain"><span class="sr">排序</span><select data-change="jf-sort">${isMe() ? `<option value="rec" ${f.sort === 'rec' ? 'selected' : ''}>为你推荐</option>` : ''}<option value="rel" ${f.sort === 'rel' ? 'selected' : ''}>最相关</option><option value="new" ${f.sort === 'new' ? 'selected' : ''}>最新更新</option><option value="due" ${f.sort === 'due' ? 'selected' : ''}>截止最近</option></select>${icon('down', 16)}</label></div></div>
    <div id="jf-list">${L.html}</div>
    <p class="fine">共 ${rawCount()} 条原始记录，已按公司、岗位、批次、毕业区间合并为 ${positions().length} 个岗位。</p>`;
  },
};

function sheetHTML() {
  const f = getF();
  return `<div class="sheet-sec"><h3 class="sub-h">行业与城市</h3><div class="sels in-sheet">${selectsHTML(f, '-s')}</div></div>
  <div class="sheet-sec"><h3 class="sub-h">省事筛选</h3><p class="muted s">可以叠加，数字是加上当前条件后的结果数。</p>
    <div class="chips wrap">${easyTags().map((t) => `<button class="chip ${f.tags.has(t.id) ? 'on' : ''}" data-act="jf-tag-sheet" data-id="${t.id}" aria-pressed="${f.tags.has(t.id)}">${f.tags.has(t.id) ? icon('check', 15) : ''}${t.label}<em>${tagCount(positions(), f, t.id)}</em></button>`).join('')}</div></div>
  <div class="sheet-sec"><h3 class="sub-h">快捷筛选</h3><p class="muted s">原站的各个视图，现在都是这里的一键组合。</p>
    <div class="presets">${PRESETS.map((p, i) => { const q = new URLSearchParams(p.q); return `<button class="preset" data-act="jf-preset" data-i="${i}"><span><strong>${esc(p.name)}</strong><small>原站：${esc(p.was)}</small></span><em>${filterJobs(positions(), parseFilters(q)).length}</em></button>`; }).join('')}</div></div>
  <div class="sheet-sec"><h3 class="sub-h">更多条件</h3>
    <label class="switch-row"><span><strong>排除风险岗位</strong><small>疑似培训收费、承诺包就业、来源为问卷表单的岗位</small></span><input type="checkbox" role="switch" data-change="jf-risk" ${f.risk ? '' : 'checked'}></label>
    <label class="switch-row"><span><strong>显示已截止</strong><small>默认隐藏</small></span><input type="checkbox" role="switch" data-change="jf-exp" ${f.expired ? 'checked' : ''}></label>
    <label class="switch-row"><span><strong>只看我添加的</strong><small>你自己粘贴进来的招聘</small></span><input type="checkbox" role="switch" data-change="jf-mine" ${f.mine ? 'checked' : ''}></label>
    <div class="chips wrap">${EXTRA_TAGS.map((t) => `<button class="chip ${f.tags.has(t.id) ? 'on' : ''}" data-act="jf-tag-sheet" data-id="${t.id}" aria-pressed="${f.tags.has(t.id)}">${t.label}</button>`).join('')}</div></div>
  <div class="sheet-foot"><button class="btn ghost" data-act="jf-clear-sheet">清空全部</button><button class="btn primary" data-act="close-sheet">看 ${filterJobs(positions(), f).length} 个结果</button></div>`;
}
const repaintSheet = () => { const b = sheetRoot()?.querySelector('.sheet-body'); if (b) b.innerHTML = sheetHTML(); };

act('open-intake', () => openIntake());
act('go', (el, e) => { if (e.target.closest('a')) return; location.hash = el.dataset.href; });
act('jf-view', (el) => { view = el.dataset.v; safeSet('jobos.view', view); document.querySelectorAll('[data-act="jf-view"]').forEach((b) => { const on = b.dataset.v === view; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); }); paint(); });
act('jf-tag', (el) => setF((f) => { const id = el.dataset.id; f.tags.has(id) ? f.tags.delete(id) : f.tags.add(id); }));
act('jf-tag-sheet', (el) => { setF((f) => { const id = el.dataset.id; f.tags.has(id) ? f.tags.delete(id) : f.tags.add(id); }); repaintSheet(); });
act('jf-combo', (el) => setF((f) => {
  const k = el.dataset.id || 'easy', { ids } = COMBOS[k];
  if (comboOn(f, k)) { ids.forEach((id) => f.tags.delete(id)); if (k === 'luck' && f.sort === 'due') f.sort = ''; }
  else { ids.forEach((id) => f.tags.add(id)); if (k === 'luck') f.sort = 'due'; }
}));
act('jf-more', () => { shown += PAGE; paint(); });
act('jf-expired', () => setF((f) => { f.expired = !f.expired; }, { reset: false }));
act('jf-relax', (el) => setF((f) => { if (el.dataset.id === '__q') { f.q = ''; document.getElementById('jf-q').value = ''; } else f.tags.delete(el.dataset.id); }));
act('jf-clear', () => { const i = document.getElementById('jf-q'); if (i) i.value = ''; setF((f) => { f.tags.clear(); f.own.clear(); f.ind = ''; f.city = ''; f.q = ''; f.expired = false; f.mine = false; f.risk = false; }); });
act('jf-sheet', () => openSheet(sheetHTML(), { title: '筛选', wide: true }));
act('jf-preset', (el) => {
  const p = PRESETS[Number(el.dataset.i)];
  const f = parseFilters(new URLSearchParams(p.q));
  const cur = getF(); f.q = cur.q; f.ind = cur.ind; f.city = cur.city; f.risk = cur.risk;
  history.replaceState(null, '', '#/jobs?' + filtersToParams(f).toString());
  shown = PAGE; paint(); repaintSheet();
});
act('jf-clear-sheet', () => { document.querySelector('[data-act="jf-clear"]') ? 0 : 0; const i = document.getElementById('jf-q'); if (i) i.value = ''; setF((f) => { f.tags.clear(); f.own.clear(); f.ind = ''; f.city = ''; f.q = ''; f.expired = false; f.mine = false; f.risk = false; }); repaintSheet(); });
onInput('jf-q', (el) => setF((f) => { f.q = el.value; }));
onInput('jf-ind', (el) => setF((f) => { f.ind = el.value; }));
onInput('jf-city', (el) => setF((f) => { f.city = el.value; }));
onInput('jf-ind-s', (el) => { setF((f) => { f.ind = el.value; }); repaintSheet(); });
onInput('jf-city-s', (el) => { setF((f) => { f.city = el.value; }); repaintSheet(); });
onInput('jf-sort', (el) => setF((f) => { f.sort = el.value; }));
onInput('jf-risk', (el) => { setF((f) => { f.risk = !el.checked; }); repaintSheet(); });
onInput('jf-exp', (el) => { setF((f) => { f.expired = el.checked; }); repaintSheet(); });
onInput('jf-mine', (el) => { setF((f) => { f.mine = el.checked; }); repaintSheet(); });
