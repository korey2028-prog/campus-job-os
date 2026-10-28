import { load, S, toggleFav, isMe } from './store.js';
import { esc, icon, ACTIONS, INPUTS, closeSheet, toast, act } from './util.js';
import welcome from './pages/welcome.js';
import today from './pages/today.js';
import jobs from './pages/jobs.js';
import detail from './pages/detail.js';
import applications from './pages/applications.js';
import { facts, materials, materialDetail } from './pages/materials.js';
import insights from './pages/insights.js';
import guide from './pages/guide.js';
import archivePage from './pages/archive.js';
import quality from './pages/quality.js';
import settings from './pages/settings.js';
import more from './pages/more.js';
import activity from './pages/activity.js';
import { installNavFx, snapNav, afterShell } from './nav-fx.js';

const NAV = [
  ['today', '今天', 'today'], ['jobs', '岗位', 'jobs'], ['applications', '投递', 'apps'], ['materials', '材料', 'materials'],
];
const MORE = [
  ['insights', '数据', 'insights'], ['guide', '渠道与参考', 'guide'], ['archive', '往届存档', 'archive'], ['quality', '数据质量', 'quality'], ['activity', '运行记录', 'activity'], ['settings', '设置与隐私', 'settings'],
];
const SECTION = { facts: 'materials', 'materials': 'materials' };

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, qs] = raw.split('?');
  return { parts: path.split('/').filter(Boolean).map(decodeURIComponent), q: new URLSearchParams(qs || '') };
}

function resolve(parts) {
  const [a, b] = parts;
  switch (a) {
    case 'welcome': return welcome;
    case 'today': return today;
    case 'jobs': return b ? detail : jobs;
    case 'applications': return applications;
    case 'facts': return facts;
    case 'materials': return b ? materialDetail : materials;
    case 'insights': return insights;
    case 'guide': return guide;
    case 'archive': return archivePage;
    case 'quality': return quality;
    case 'settings': return settings;
    case 'activity': return activity;
    case 'more': return more;
    default: return null;
  }
}

function shell(active, inner) {
  const p = S.profile;
  const link = ([id, label, ic]) => `<a class="nav-i ${active === id ? 'on' : ''}" href="#/${id}" ${active === id ? 'aria-current="page"' : ''}>${icon(ic, 20)}<span>${label}</span></a>`;
  return `<div class="shell">
    <aside class="side" aria-label="主导航">
      <a class="brand" href="#/today"><span class="logo">${icon('check', 18)}</span><span>求职控制台</span></a>
      <nav>${NAV.map(link).join('')}<p class="nav-sec">更多</p>${MORE.map(link).join('')}</nav>
      <div class="side-foot"><p class="demo-line">${isMe() ? '我的版本 · 仅本机' : `演示版 · 公司与数据均为虚构<br>演示日期固定为 ${S.today}<br><a href="https://korey2028.tech/work/job-os.html" target="_blank" rel="noopener noreferrer">关于这个项目</a>`}</p>
      <a class="me" href="#/settings"><span class="avatar">${esc(p.name.slice(0, 1))}</span><span class="me-t"><strong>${esc(p.name)}</strong><small>${esc(p.gradDate)} 毕业 · ${esc(p.degree)}${p.major ? ' · ' + esc(p.major) : ''}</small></span></a></div>
    </aside>
    <main id="main" class="main" tabindex="-1">${inner}</main>
    <nav class="tabbar" aria-label="主导航">
      ${NAV.map(([id, label, ic]) => `<a class="tab ${active === id ? 'on' : ''}" href="#/${id}" ${active === id ? 'aria-current="page"' : ''}>${icon(ic, 24)}<span>${label}</span></a>`).join('')}
      <a class="tab ${MORE.some((m) => m[0] === active) || active === 'more' ? 'on' : ''}" href="#/more">${icon('more', 24)}<span>更多</span></a>
    </nav>
  </div>`;
}

const app = () => document.getElementById('app');
let current = null;
let lastKey = '';

export function rerender({ keepScroll = true } = {}) {
  const { parts, q } = parseHash();
  let page = resolve(parts);
  if (isMe() && parts[0] === 'welcome') { location.replace('#/today'); return; }
  if (!page) { location.replace('#/' + (S.onboarded ? 'today' : 'welcome')); return; }
  if (!S.onboarded && parts[0] !== 'welcome' && !window.__skipWelcome) { location.replace('#/welcome'); return; }
  const y = keepScroll ? window.scrollY : 0;
  const ctx = { parts, q };
  const html = page.render(ctx);
  const key = parts.join('/');
  const fresh = key !== lastKey;
  lastKey = key;
  const prevNav = isMe() ? snapNav() : null;
  if (parts[0] === 'welcome') app().innerHTML = `<div class="page ${fresh ? 'enter' : ''}">${html}</div>`;
  else app().innerHTML = shell(SECTION[parts[0]] || parts[0], `<div class="page ${fresh ? 'enter' : ''}">${html}</div>`);
  current = page;
  if (prevNav && parts[0] !== 'welcome') afterShell(prevNav, SECTION[parts[0]] || parts[0]);
  if (page.mount) page.mount(ctx, document.getElementById('main') || app());
  window.scrollTo(0, fresh ? 0 : y);
  document.title = `${page.title ? page.title(ctx) + ' · ' : ''}求职控制台`;
  if (fresh) closeSheet();
}
window.__rerender = rerender;

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = ACTIONS[el.dataset.act];
  if (fn) { if (el.tagName !== 'A') e.preventDefault(); fn(el, e); }
});
document.addEventListener('input', (e) => {
  const el = e.target.closest('[data-input]');
  if (el && INPUTS[el.dataset.input]) INPUTS[el.dataset.input](el, e);
});
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-change]');
  if (el && INPUTS[el.dataset.change]) INPUTS[el.dataset.change](el, e);
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

act('close-sheet', () => closeSheet());
act('fav', (el) => {
  const id = Number(el.dataset.id);
  const on = toggleFav(id);
  document.querySelectorAll(`[data-act="fav"][data-id="${id}"]`).forEach((b) => { b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  toast(on ? '已收藏' : '已取消收藏');
});

window.addEventListener('hashchange', () => rerender({ keepScroll: false }));

async function boot() {
  try { await load(); } catch (err) {
    app().innerHTML = `<div class="boot-err"><h1>数据没加载出来</h1><p>请先运行 <code>npm run gen:demo</code> 和 <code>npm run build:web</code>，再用 <code>npm run web</code> 打开。</p></div>`;
    console.error(err); return;
  }
  if (isMe()) {
    document.documentElement.classList.add('v');
    document.head.insertAdjacentHTML('beforeend', '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400..700&family=Geist+Mono:wght@500;600&display=swap"><link rel="stylesheet" href="css/theme-v.css">');
    document.title = '我的求职台';
    installNavFx([...NAV, ...MORE]);
  }
  if (!location.hash) location.replace('#/' + (S.onboarded ? 'today' : 'welcome'));
  rerender({ keepScroll: false });
}
boot();
