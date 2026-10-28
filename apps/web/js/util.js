// 通用小工具：转义、图标、日期、浮层、提示
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const P = {
  today: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>',
  jobs: '<rect x="3" y="7" width="18" height="13" rx="3"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3 13h18"/>',
  apps: '<rect x="3.5" y="4" width="5" height="16" rx="1.5"/><rect x="10.5" y="4" width="5" height="10" rx="1.5"/><rect x="17.5" y="4" width="3" height="6" rx="1.2"/>',
  materials: '<path d="M7 3.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V5A1.5 1.5 0 0 1 7.5 3.5z"/><path d="M14 3.5V8h4M9 12.5h6M9 16h4"/>',
  more: '<circle cx="6" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18" cy="12" r="1.2"/>',
  insights: '<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>',
  guide: '<circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  archive: '<rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9v9.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V9M10 13h4"/>',
  quality: '<path d="M12 3l7 3v5.5c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6z"/><path d="M8.8 12l2.3 2.3 4.2-4.6"/>',
  settings: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  star: '<path d="M12 3.8l2.5 5.2 5.6.8-4.1 4 1 5.6-5-2.7-5 2.7 1-5.6-4.1-4 5.6-.8z"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  question: '<circle cx="12" cy="12" r="8.5"/><path d="M9.7 9.6a2.4 2.4 0 1 1 3.4 2.2c-.7.4-1.1.9-1.1 1.7M12 16.6v.1"/>',
  dash: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 12h7"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  right: '<path d="M9.5 5l7 7-7 7"/>',
  left: '<path d="M14.5 5l-7 7 7 7"/>',
  down: '<path d="M5 9.5l7 7 7-7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v4.5A1.5 1.5 0 0 1 16.5 20h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M8 3v4M16 3v4M3.5 10h17"/>',
  alert: '<path d="M12 4l9 15.5H3z"/><path d="M12 10v4.2M12 17.2v.1"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  user: '<circle cx="12" cy="8.5" r="3.7"/><path d="M5 20c.6-3.6 3.4-5.5 7-5.5s6.4 1.9 7 5.5"/>',
  download: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14"/>',
  upload: '<path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M5 19.5h14"/>',
  trash: '<path d="M5 7h14M9.5 7V5h5v2M7 7l.8 12h8.4L17 7M10 11v5M14 11v5"/>',
  doc: '<path d="M7 3.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V5A1.5 1.5 0 0 1 7.5 3.5z"/>',
  sparkle: '<path d="M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6zM18.5 16l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
  flag: '<path d="M6 21V4M6 4h11l-2 4 2 4H6"/>',
  pin: '<path d="M12 21s6.5-5.6 6.5-10.5a6.5 6.5 0 0 0-13 0C5.5 15.4 12 21 12 21z"/><circle cx="12" cy="10.5" r="2.3"/>',
  grip: '<path d="M9 6v.1M9 12v.1M9 18v.1M15 6v.1M15 12v.1M15 18v.1"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8v.1"/>',
  activity: '<path d="M4 17h3l2-8 3 11 2-7h6"/>',
};
export function icon(name, size = 20, cls = '') {
  const fill = name === 'star' ? '' : '';
  return `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill || 'none'}" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${P[name] || ''}</svg>`;
}

export const parseISO = (s) => new Date(s + 'T00:00:00Z');
export const diffDays = (a, b) => Math.round((parseISO(a) - parseISO(b)) / 86400000);
export function addDays(s, n) { const d = parseISO(s); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
export const fmtMD = (s) => { const [, m, d] = s.split('-'); return `${Number(m)}月${Number(d)}日`; };
export const fmtYMD = (s) => { const [y, m, d] = s.split('-'); return `${y}年${Number(m)}月${Number(d)}日`; };
const WK = ['日', '一', '二', '三', '四', '五', '六'];
export const weekday = (s) => '周' + WK[parseISO(s).getUTCDay()];

export function safeGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
export function safeSet(key, val) { try { localStorage.setItem(key, val); return true; } catch { return false; } }
export function safeDel(key) { try { localStorage.removeItem(key); } catch { /* 存储不可用时忽略 */ } }

let toastTimer;
export function toast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

// 浮层（桌面居中、手机底部弹出）
let lastFocus = null;
export function openSheet(inner, { title = '', wide = false } = {}) {
  closeSheet();
  lastFocus = document.activeElement;
  const layer = document.getElementById('layer');
  layer.innerHTML = `<div class="scrim" data-act="close-sheet"></div>
    <div class="sheet ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}" tabindex="-1">
      <div class="sheet-grip" aria-hidden="true"></div>
      <div class="sheet-head"><h2>${esc(title)}</h2><button class="icon-btn" data-act="close-sheet" aria-label="关闭">${icon('x')}</button></div>
      <div class="sheet-body">${inner}</div>
    </div>`;
  document.body.classList.add('has-sheet');
  const sh = layer.querySelector('.sheet');
  requestAnimationFrame(() => { layer.classList.add('open'); sh.focus({ preventScroll: true }); });
  return sh;
}
export function closeSheet() {
  const layer = document.getElementById('layer');
  if (!layer || !layer.innerHTML) return;
  layer.classList.remove('open');
  layer.innerHTML = '';
  document.body.classList.remove('has-sheet');
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  lastFocus = null;
}
export const sheetRoot = () => document.querySelector('#layer .sheet');

export const ACTIONS = {};
export const INPUTS = {};
export const act = (name, fn) => { ACTIONS[name] = fn; };
export const onInput = (name, fn) => { INPUTS[name] = fn; };

export const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
export const countBy = (arr, fn) => { const m = new Map(); for (const x of arr) { const k = fn(x); if (k == null) continue; m.set(k, (m.get(k) || 0) + 1); } return m; };
export const rerender = (o) => window.__rerender && window.__rerender(o);
