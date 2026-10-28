import { S, isMe, setProfile, persist, resetAll, positions, importState } from '../store.js';
import { esc, icon, act, onInput, toast, openSheet, closeSheet, rerender } from '../util.js';
import { pageHead } from '../components.js';

const CITIES = ['上海', '杭州', '北京', '深圳', '广州', '成都', '南京', '苏州', '武汉', '西安', '天津', '合肥', '长沙', '青岛'];
export default {
  title: () => '设置与隐私',
  render() {
    const p = S.profile; const [y, m] = p.gradDate.split('-').map(Number);
    return `${pageHead('设置与隐私', '修改画像后，所有岗位的"能不能投"会立刻重新计算。')}
    <section class="panel"><h2>我的画像</h2>
      <div class="two"><label class="field"><span>毕业年份</span><select class="input" data-change="s-y">${[2025, 2026, 2027, 2028, 2029].map((x) => `<option ${x === y ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
      <label class="field"><span>毕业月份</span><select class="input" data-change="s-m">${Array.from({ length: 12 }, (_, i) => i + 1).map((x) => `<option value="${x}" ${x === m ? 'selected' : ''}>${x} 月</option>`).join('')}</select></label></div>
      <div class="two"><label class="field"><span>学历</span><select class="input" data-change="s-deg">${['大专', '本科', '硕士', '博士'].map((x) => `<option ${x === p.degree ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
      <label class="field"><span>专业</span><input class="input" data-input="s-major" value="${esc(p.major || '')}" placeholder="例如 市场营销"></label></div>
      <div class="field"><span>想去的城市</span><div class="chips wrap">${CITIES.map((c) => `<button class="chip ${p.cities.includes(c) ? 'on' : ''}" data-act="s-city" data-v="${c}" aria-pressed="${p.cities.includes(c)}">${c}</button>`).join('')}</div></div>
    </section>
    ${isMe() ? prefs() : ''}
    <section class="panel"><h2>数据与隐私</h2>
      <dl class="kvs one"><div class="kv"><dt>存放位置</dt><dd>${isMe() ? '画像存在本机 private/profile.json；投递状态写回 career-workflow/岗位台账.csv（每次写入前自动备份）；收藏和核对记录存在这个浏览器里。' : '只在这台设备的浏览器里。'}${S.storageOk ? '' : '<strong class="warn-t">当前浏览器不允许保存，刷新后会回到默认状态。</strong>'}</dd></div>
      <div class="kv"><dt>已保存</dt><dd class="tnum">收藏 ${S.favs.length} · 我添加的岗位 ${S.added.length} · 核对记录 ${Object.keys(S.verified).length} · 新增投递 ${S.appsAdded.length} · 运行记录 ${(S.events || []).length}</dd></div>
      ${isMe() ? '' : `<div class="kv"><dt>演示数据</dt><dd>公司、链接、人物均为虚构，数据日期固定在 ${S.today}。</dd></div>`}</dl>
      ${isMe() ? '' : `<div class="btn-row"><button class="btn secondary" data-act="s-export">${icon('download', 18)}导出我的数据</button><label class="btn secondary" for="s-import-file">${icon('upload', 18)}恢复导出文件</label><input id="s-import-file" class="sr" type="file" accept="application/json" data-change="s-import"><button class="btn danger" data-act="s-clear">${icon('trash', 18)}重置演示</button></div>`}
    </section>`;
  },
};
const list = (key) => S.profile[key] || [];
const row = (key, v, i, n) => `<li class="pref-row"><span class="tnum pref-n">${i + 1}</span><span class="pref-v">${esc(v)}</span><button class="icon-btn sm" data-act="pf-up" data-k="${key}" data-i="${i}" aria-label="上移 ${esc(v)}" ${i === 0 ? 'disabled' : ''}>${icon('left', 16, 'rot-up')}</button><button class="icon-btn sm" data-act="pf-down" data-k="${key}" data-i="${i}" aria-label="下移 ${esc(v)}" ${i === n - 1 ? 'disabled' : ''}>${icon('down', 16)}</button><button class="icon-btn sm" data-act="pf-del" data-k="${key}" data-i="${i}" aria-label="删除 ${esc(v)}">${icon('x', 16)}</button></li>`;
function prefs() {
  const d = list('directions'), c = list('cities');
  return `<section class="panel"><h2>我想找的</h2><p class="muted s">按顺序排，越靠前越优先。岗位页的「为你推荐」按这里的顺序排。</p>
    <div class="field"><span>方向</span><ol class="pref-list">${d.map((v, i) => row('directions', v, i, d.length)).join('') || '<li class="muted">还没有设置</li>'}</ol>
      <div class="pref-add"><input class="input" id="pf-dir" placeholder="例如 产品经理" autocomplete="off"><button class="btn secondary" data-act="pf-add">添加方向</button></div></div>
    <div class="field"><span>城市优先级</span><ol class="pref-list">${c.map((v, i) => row('cities', v, i, c.length)).join('') || '<li class="muted">还没有设置</li>'}</ol></div></section>`;
}
const move = (k, i, d) => { const a = [...list(k)]; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; setProfile({ [k]: a }); rerender(); };
act('pf-up', (el) => move(el.dataset.k, Number(el.dataset.i), -1));
act('pf-down', (el) => move(el.dataset.k, Number(el.dataset.i), 1));
act('pf-del', (el) => { setProfile({ [el.dataset.k]: list(el.dataset.k).filter((_, i) => i !== Number(el.dataset.i)) }); rerender(); });
act('pf-add', () => { const v = document.getElementById('pf-dir')?.value.trim(); if (!v || list('directions').includes(v)) return; setProfile({ directions: [...list('directions'), v] }); rerender(); });

const upd = (o) => { setProfile(o); toast('已更新，岗位判断已重新计算'); };
const gd = () => S.profile.gradDate.split('-');
onInput('s-y', (el) => upd({ gradDate: `${el.value}-${gd()[1]}` }));
onInput('s-m', (el) => upd({ gradDate: `${gd()[0]}-${String(el.value).padStart(2, '0')}` }));
onInput('s-deg', (el) => upd({ degree: el.value }));
onInput('s-major', (el) => { clearTimeout(window.__sm); window.__sm = setTimeout(() => { setProfile({ major: el.value.trim() }); }, 400); });
act('s-city', (el) => { const c = el.dataset.v, cs = S.profile.cities; setProfile({ cities: cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c] }); rerender(); });
act('s-export', () => {
  const { profile, favs, appsAdded, moves, verified, added, done, factOk, feedback, events } = S;
  try {
    const blob = new Blob([JSON.stringify({ profile, favs, appsAdded, moves, verified, added, done, factOk, feedback, events }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'job-os-demo-data.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000); toast('已导出');
  } catch { toast('导出失败'); }
});
onInput('s-import', async (el) => {
  const file = el.files?.[0]; if (!file) return;
  try { importState(JSON.parse(await file.text())); toast('已恢复导出数据'); rerender(); }
  catch (e) { toast(`恢复失败：${e.message || '文件格式不正确'}`); }
  el.value = '';
});
act('s-clear', () => openSheet(`<p class="lead-p">会清除画像、收藏、投递、反馈和你添加的岗位，回到首次进入的状态。演示数据不受影响。</p><div class="sheet-foot"><button class="btn ghost" data-act="close-sheet">取消</button><button class="btn danger" data-act="s-clear-ok">确认重置</button></div>`, { title: '重置演示？' }));
act('s-clear-ok', () => { resetAll(); closeSheet(); toast('已重置'); location.hash = '#/welcome'; });
