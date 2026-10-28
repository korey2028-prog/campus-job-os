import { S, positions } from '../store.js';
import { esc, icon, act, onInput, rerender } from '../util.js';
import { pageHead, seg, calWrap } from '../components.js';

let tab = 'channels';
let major = '';

function majorView() {
  const list = S.data.majorMap;
  const m = major || S.profile.major || list[0].major;
  const hit = list.find((x) => x.major === m) || list.find((x) => m && (x.major.includes(m) || m.includes(x.major)));
  const live = positions().filter((v) => !v.expired && !v.risk);
  const open = live.filter((v) => v.majors.length === 0 || v.majors.includes('不限专业')).length;
  const match = live.filter((v) => v.majors.length === 0 || v.majors.includes('不限专业') || v.majors.some((x) => x.includes(m) || m.includes(x))).length;
  return `<label class="field"><span>选一个专业</span><input class="input" list="g-majors" data-input="g-major" value="${esc(m)}" autocomplete="off"></label>
    <datalist id="g-majors">${list.map((x) => `<option value="${x.major}">`).join('')}</datalist>
    <div class="chips wrap">${list.map((x) => `<button class="chip ${x.major === m ? 'on' : ''}" data-act="g-major" data-v="${x.major}">${x.major}</button>`).join('')}</div>
    <dl class="stats"><div class="stat"><dt>可投范围内的岗位</dt><dd class="tnum">${match}</dd></div><div class="stat"><dt>数据里不限专业</dt><dd class="tnum">${open}</dd></div></dl>
    ${hit ? `<section class="panel"><h2>常见可投岗位</h2><div class="chips wrap">${hit.roles.map((r) => `<a class="chip" href="#/jobs?q=${encodeURIComponent(r)}">${esc(r)}${icon('right', 14)}</a>`).join('')}</div><p class="muted">${esc(hit.tip)}</p></section>` : `<section class="panel"><p class="muted">参考表里还没有「${esc(m)}」。可以先看不限专业的岗位。</p><a class="btn secondary" href="#/jobs?tags=open">看不限专业岗位</a></section>`}`;
}

export default {
  title: () => '渠道与参考',
  render() {
    const body = tab === 'channels'
      ? `<div class="grid-2">${S.data.channels.map((g) => `<section class="panel"><h2>${esc(g.type)}</h2><ul class="plain ch">${g.items.map((i) => `<li><strong>${esc(i.name)}</strong><small>适合找：${esc(i.fit)}</small></li>`).join('')}</ul></section>`).join('')}</div><p class="fine">渠道只列类型和用途，不放广告位。</p>`
      : tab === 'majors' ? majorView() : `<section class="panel">${calWrap('all')}</section>`;
    return `${pageHead('渠道与参考', '去哪找岗位、什么专业看什么岗位、哪天截止。')}${seg('g-tab', [['channels', '求职渠道'], ['majors', '专业看岗位'], ['calendar', '截止日历']], tab)}<div class="tab-body">${body}</div>`;
  },
};
act('g-tab', (el) => { tab = el.dataset.v; rerender(); });
act('g-major', (el) => { major = el.dataset.v; rerender(); });
onInput('g-major', (el) => { major = el.value.trim(); clearTimeout(window.__gm); window.__gm = setTimeout(rerender, 450); });
