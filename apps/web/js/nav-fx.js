// 个人模式的导航动效：滑动高亮块、“今天”计数徽标、命令面板（⌘K / Ctrl+K / “/”）。演示版不加载。
import { S, positions, appsAll, displayTitle } from './store.js';
import { esc, icon, safeGet, safeSet } from './util.js';
import { todayCount } from './pages/today.js';

const NAVS = ['.side nav', '.tabbar'];
const ON = { '.side nav': '.nav-i.on', '.tabbar': '.tab.on' };

// ---------- 滑动高亮块 ----------
const relRect = (el, box) => { const a = el.getBoundingClientRect(), b = box.getBoundingClientRect(); return { x: a.left - b.left + box.scrollLeft, y: a.top - b.top + box.scrollTop, w: a.width, h: a.height }; };
// 换页前记下旧高亮的位置
export function snapNav() {
  const out = {};
  for (const sel of NAVS) { const box = document.querySelector(sel), on = box?.querySelector(ON[sel]); if (on && on.offsetParent) out[sel] = relRect(on, box); }
  return out;
}
const place = (pill, r) => { pill.style.width = r.w + 'px'; pill.style.height = r.h + 'px'; pill.style.transform = `translate(${r.x}px, ${r.y}px)`; };

function slide(prev) {
  for (const sel of NAVS) {
    const box = document.querySelector(sel), on = box?.querySelector(ON[sel]);
    if (!box || !on || !on.offsetParent) continue;
    const pill = document.createElement('span');
    pill.className = 'nav-pill';
    pill.setAttribute('aria-hidden', 'true');
    box.prepend(pill);
    const to = relRect(on, box), from = prev[sel];
    place(pill, from || to);
    if (from && (from.x !== to.x || from.y !== to.y)) { pill.getBoundingClientRect(); pill.classList.add('go'); place(pill, to); }
  }
}

// ---------- “今天”徽标：有新待办时出现并呼吸，进入今天页后缩小消失 ----------
const SEEN = 'jobos.seen.today', SHOWN = 'jobos.shown.today';
function badge(active) {
  const n = todayCount();
  // 记下今天看过时的件数；之后只有件数变多才重新提醒，勾掉一件不会再冒出来
  const [day, seenN] = (safeGet(SEEN) || '').split(':');
  const seen = day === S.today && n <= Number(seenN);
  const last = Number(safeGet(SHOWN) ?? n);
  safeSet(SHOWN, String(n));
  if (active === 'today') safeSet(SEEN, `${S.today}:${n}`);
  if (!n || (seen && active !== 'today')) return;
  const roll = last !== n ? `<span class="roll" style="--from:'${last}'">` : '<span>';
  for (const a of document.querySelectorAll('.side nav a[href="#/today"], .tabbar a[href="#/today"]')) {
    a.insertAdjacentHTML('beforeend', `<span class="nav-badge ${active === 'today' ? 'leave' : 'fresh'}" aria-label="${n} 件待办">${roll}${n}</span></span>`);
  }
}

// ---------- 命令面板 ----------
let items = [], sel = 0, root = null, prevFocus = null;
const PRESET = [
  ['为你推荐', '#/jobs', '岗位按推荐排'], ['碰运气', '#/jobs?tags=can%2Cfreeany%2Csoon7&sort=due', '能投 + 免笔试 + 7 天内截止'],
  ['省事组合', '#/jobs?tags=can%2Cfreeany', '能投 + 免笔试或部分免笔试'], ['远程岗位', '#/jobs?city=%E8%BF%9C%E7%A8%8B', '城市选“远程”'],
  ['即将截止', '#/jobs?tags=soon&sort=due', '7 天内截止，按截止日排'],
];
const words = (q) => q.trim().toLowerCase().split(/\s+/).filter(Boolean);
const hit = (text, ws) => { const t = text.toLowerCase(); return ws.every((w) => t.includes(w)); };
function mark(text, ws) {
  if (!ws.length) return esc(text);
  const re = new RegExp(`(${ws.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  return text.split(re).map((s, i) => (i % 2 ? `<mark>${esc(s)}</mark>` : esc(s))).join('');
}

function build(q, pages) {
  const ws = words(q);
  const g = [];
  const add = (group, list) => { if (list.length) g.push([group, list]); };
  add('页面', pages.filter(([, label]) => hit(label, ws)).map(([id, label, ic]) => ({ label, href: `#/${id}`, ic })));
  add('快捷筛选', PRESET.filter(([l, , d]) => hit(l + d, ws)).map(([label, href, sub]) => ({ label, href, sub, ic: 'filter' })));
  if (ws.length) {
    add('我的投递', appsAll().filter((a) => hit(a.company + ' ' + a.role, ws)).slice(0, 5).map((a) => ({ label: `${a.company} · ${a.role}`, sub: a.stageRaw || '', href: a.positionId ? `#/jobs/${a.positionId}` : '#/applications', ic: 'apps' })));
    // 公司名命中的排前面；字段之间加空格，免得“全芯微”+“软件”拼成“微软”
    const byCo = (v) => (hit(v.company, ws) ? 0 : 1) + (v.rank?.tier === 'A' ? 0 : 0.5);
    add('岗位', positions().filter((v) => !v.expired && hit([v.company, ...(v.roles || []), v.title].join(' '), ws)).sort((a, b) => byCo(a) - byCo(b)).slice(0, 8).map((v) => ({ label: `${v.company} · ${displayTitle(v)}`, sub: v.cities.slice(0, 2).join('、'), href: `#/jobs/${v.id}`, ic: 'jobs' })));
    g.push(['', [{ label: `在岗位页搜索“${q.trim()}”`, href: `#/jobs?q=${encodeURIComponent(q.trim())}`, ic: 'search', raw: true }]]);
  }
  items = g.flatMap(([, l]) => l);
  sel = 0;
  let i = 0;
  return g.map(([name, list]) => `${name ? `<p class="cmdk-g">${name}</p>` : ''}${list.map((it) => `<a class="cmdk-i" href="${it.href}" data-i="${i++}" role="option">${icon(it.ic, 18)}<span><strong>${it.raw ? esc(it.label) : mark(it.label, ws)}</strong>${it.sub ? `<small>${esc(it.sub)}</small>` : ''}</span></a>`).join('')}`).join('') || '<p class="cmdk-empty">没有匹配的项</p>';
}
function paintSel() {
  root.querySelectorAll('.cmdk-i').forEach((a) => { const on = Number(a.dataset.i) === sel; a.classList.toggle('on', on); a.setAttribute('aria-selected', on); if (on) a.scrollIntoView({ block: 'nearest' }); });
}
function closePalette() {
  if (!root) return;
  const r = root; root = null;
  r.classList.remove('open');
  setTimeout(() => r.remove(), 160);
  if (prevFocus && document.contains(prevFocus)) prevFocus.focus({ preventScroll: true });
}
function go(i) { const it = items[i]; if (!it) return; closePalette(); location.hash = it.href.slice(1); }

export function openPalette(pages) {
  if (root) return;
  prevFocus = document.activeElement;
  root = document.createElement('div');
  root.className = 'cmdk';
  root.innerHTML = `<div class="cmdk-scrim"></div><div class="cmdk-box" role="dialog" aria-modal="true" aria-label="快速跳转">
    <label class="cmdk-in">${icon('search', 18)}<input type="text" placeholder="搜公司、岗位、页面…" aria-label="搜索" role="combobox" aria-controls="cmdk-list" aria-expanded="true" autocomplete="off"><kbd>esc</kbd></label>
    <div class="cmdk-list" id="cmdk-list" role="listbox">${build('', pages)}</div></div>`;
  document.body.append(root);
  const input = root.querySelector('input'), list = root.querySelector('.cmdk-list');
  paintSel();
  requestAnimationFrame(() => { root?.classList.add('open'); input.focus(); });
  input.addEventListener('input', () => { list.innerHTML = build(input.value, pages); paintSel(); });
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') { e.preventDefault(); input.focus(); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % Math.max(items.length, 1); paintSel(); }
    else if (e.key === 'Enter') { e.preventDefault(); go(sel); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePalette(); }
  });
  list.addEventListener('mousemove', (e) => { const a = e.target.closest('.cmdk-i'); if (a && Number(a.dataset.i) !== sel) { sel = Number(a.dataset.i); paintSel(); } });
  list.addEventListener('click', (e) => { const a = e.target.closest('.cmdk-i'); if (a) { e.preventDefault(); go(Number(a.dataset.i)); } });
  root.querySelector('.cmdk-scrim').addEventListener('click', closePalette);
}

const typing = (el) => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
export function installNavFx(pages) {
  document.addEventListener('keydown', (e) => {
    if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !typing(e.target) && !root)) { e.preventDefault(); root ? closePalette() : openPalette(pages); }
  });
  document.addEventListener('click', (e) => { if (e.target.closest('[data-act="cmdk"]')) { e.preventDefault(); openPalette(pages); } });
}
// 每次画完外壳后调用
export function afterShell(prev, active) {
  const side = document.querySelector('.side .brand');
  if (side && !document.querySelector('.cmdk-btn')) side.insertAdjacentHTML('afterend', `<button class="cmdk-btn" data-act="cmdk">${icon('search', 16)}<span>快速跳转</span><kbd>⌘K</kbd></button>`);
  slide(prev);
  badge(active);
}
