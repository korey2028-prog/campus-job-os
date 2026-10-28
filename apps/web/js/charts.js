// 手搭图表：SVG / CSS，无任何库。每个数值都以文字显示，不靠颜色单独表达。
import { esc } from './util.js';

export function hbars(items, { href = null, unit = '', max } = {}) {
  const m = max ?? Math.max(1, ...items.map((i) => i.value));
  if (!items.length) return '<p class="muted">暂无数据</p>';
  return `<ul class="hbars">${items.map((i) => {
    const w = Math.max(i.value ? 2 : 0, (i.value / m) * 100);
    const inner = `<span class="hb-l">${esc(i.label)}</span><span class="hb-t"><i style="width:${w}%" class="${i.cls || ''}"></i></span><span class="hb-v">${i.value}${unit}</span>`;
    const h = href ? href(i) : null;
    return `<li>${h ? `<a class="hb-row" href="${esc(h)}">${inner}</a>` : `<div class="hb-row">${inner}</div>`}</li>`;
  }).join('')}</ul>`;
}

export function donut(items, { center = '', sub = '' } = {}) {
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  const R = 54, C = 2 * Math.PI * R;
  let off = 0;
  const arcs = items.map((i) => {
    const len = (i.value / total) * C;
    const el = `<circle cx="70" cy="70" r="${R}" fill="none" stroke-width="18" class="${i.cls}" stroke-dasharray="${Math.max(0, len - 1.5)} ${C}" stroke-dashoffset="${-off}" transform="rotate(-90 70 70)"/>`;
    off += len; return el;
  }).join('');
  return `<div class="donut"><svg viewBox="0 0 140 140" role="img" aria-label="环形图">${arcs}<text x="70" y="68" text-anchor="middle" class="d-big">${esc(center)}</text><text x="70" y="86" text-anchor="middle" class="d-sub">${esc(sub)}</text></svg>
  <ul class="legend">${items.map((i) => `<li><i class="sw ${i.cls}"></i><span class="lg-l">${esc(i.label)}</span><span class="lg-v">${i.value}<small>${Math.round((i.value / total) * 100)}%</small></span></li>`).join('')}</ul></div>`;
}

// 堆叠柱：labels 为横轴；series=[{key,label,cls}]；rows[i][key]
export function stackedColumns(labels, series, rows, { height = 170, every = 5 } = {}) {
  const W = 640, H = height, L = 30, B = 24, T = 8;
  const n = labels.length, bw = (W - L) / n;
  const totals = rows.map((r) => series.reduce((s, x) => s + (r[x.key] || 0), 0));
  const max = Math.max(1, ...totals);
  const nice = Math.ceil(max / 4) * 4 || 4;
  const y = (v) => T + (H - T - B) * (1 - v / nice);
  let g = '';
  for (let i = 0; i <= 4; i++) { const v = (nice / 4) * i; g += `<line x1="${L}" x2="${W}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" class="axis">${v}</text>`; }
  let bars = '';
  rows.forEach((r, i) => {
    let acc = 0;
    series.forEach((s) => {
      const v = r[s.key] || 0; if (!v) return;
      const y1 = y(acc + v), y0 = y(acc); acc += v;
      bars += `<rect x="${L + i * bw + bw * 0.14}" y="${y1}" width="${bw * 0.72}" height="${Math.max(0.5, y0 - y1)}" rx="1.5" class="${s.cls}"><title>${esc(labels[i])} ${esc(s.label)} ${v}</title></rect>`;
    });
    if (i % every === 0 || i === n - 1) bars += `<text x="${L + i * bw + bw / 2}" y="${H - 6}" text-anchor="middle" class="axis">${esc(labels[i])}</text>`;
  });
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="柱状图">${g}${bars}</svg><ul class="legend inline">${series.map((s) => `<li><i class="sw ${s.cls}"></i>${esc(s.label)}</li>`).join('')}</ul></div>`;
}

export function lineChart(labels, values, { height = 150, every = 5 } = {}) {
  const W = 640, H = height, L = 30, B = 24, T = 10;
  const max = Math.max(1, ...values), nice = Math.ceil(max / 4) * 4 || 4;
  const n = values.length, step = (W - L - 8) / Math.max(1, n - 1);
  const x = (i) => L + i * step, y = (v) => T + (H - T - B) * (1 - v / nice);
  let g = '';
  for (let i = 0; i <= 4; i++) { const v = (nice / 4) * i; g += `<line x1="${L}" x2="${W}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" class="axis">${v}</text>`; }
  const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  const area = `M${x(0)},${y(0)} L${pts.join(' L')} L${x(n - 1)},${y(0)}Z`;
  const lab = labels.map((l, i) => (i % every === 0 || i === n - 1 ? `<text x="${x(i)}" y="${H - 6}" text-anchor="middle" class="axis">${esc(l)}</text>` : '')).join('');
  const dots = values.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="2.4" class="dot"><title>${esc(labels[i])} ${v}</title></circle>`).join('');
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="折线图">${g}<path d="${area}" class="area"/><polyline points="${pts.join(' ')}" class="ln" fill="none"/>${dots}${lab}</svg></div>`;
}

// 横向堆叠：rows=[{label,segs:{key:value}}]
export function stackedHBars(rows, series, { href = null } = {}) {
  const tot = (r) => series.reduce((s, x) => s + (r.segs[x.key] || 0), 0);
  const max = Math.max(1, ...rows.map(tot));
  return `<div class="shb">${rows.map((r) => {
    const t = tot(r);
    const segs = series.map((s) => { const v = r.segs[s.key] || 0; return v ? `<i class="${s.cls}" style="width:${(v / max) * 100}%" title="${esc(s.label)} ${v}"></i>` : ''; }).join('');
    const detail = series.filter((s) => r.segs[s.key]).map((s) => `${s.label} ${r.segs[s.key]}`).join(' · ');
    const inner = `<span class="hb-l">${esc(r.label)}</span><span class="shb-t">${segs}</span><span class="hb-v">${t}</span><span class="shb-d">${esc(detail)}</span>`;
    return href ? `<a class="shb-row" href="${esc(href(r))}">${inner}</a>` : `<div class="shb-row">${inner}</div>`;
  }).join('')}<ul class="legend inline">${series.map((s) => `<li><i class="sw ${s.cls}"></i>${esc(s.label)}</li>`).join('')}</ul></div>`;
}
