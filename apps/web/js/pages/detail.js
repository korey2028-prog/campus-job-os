import { S, isMe, displayTitle, provOf, getPos, siblings, dlText, appFor, addApp, moveApp, colOf, verify, isFav, persist } from '../store.js';
import { esc, icon, act, toast, rerender, openSheet, closeSheet, sheetRoot } from '../util.js';
import { verdictBadge, confDot, reasonIcon, emptyState, dlChip } from '../components.js';

const FIELD = { grad_window: '毕业时间', degree: '学历', deadline: '截止日', majors: '专业', cities: '城市' };
const host = (u) => { try { return new URL(u).hostname; } catch { return u || '—'; } };

function actionBlock(v) {
  if (v.archive) return `<p class="hint">这是往届存档，只读。</p>`;
  const app = appFor(v.id);
  if (!app) return `<button class="btn primary block" data-act="d-add" data-id="${v.id}">${icon('plus', 18)}加入我的投递</button><p class="hint">加入后可以记录进度、准备定向材料。</p>`;
  const col = colOf(app);
  if (col === '想投') return `<button class="btn primary block" data-act="d-prep" data-id="${v.id}">${icon('materials', 18)}准备定向材料</button><p class="hint">已在投递里，状态：想投。</p>`;
  if (col === '准备中') return `<a class="btn primary block" href="${esc(v.applyUrl || '#')}" target="_blank" rel="noopener noreferrer">${icon('external', 18)}去官网投递</a>
    <p class="hint">投递在官网完成，回来标记已投递。</p><button class="btn secondary block" data-act="d-done" data-id="${app.localId}">${icon('check', 18)}我已投递</button>`;
  return `<a class="btn secondary block" href="#/applications">查看投递进度（${esc(col)}）</a><p class="hint">当前状态：${esc(col)}。</p>`;
}

export default {
  title: (c) => getPos(c.parts[1])?.company || '岗位',
  render({ parts }) {
    const v = getPos(parts[1]);
    if (!v) return emptyState('找不到这个岗位', '它可能已被合并或删除。', '<a class="btn secondary" href="#/jobs">回到岗位</a>');
    const fav = isFav(v.id);
    const sibs = v.archive ? [] : siblings(v);
    const kv = (k, val) => `<div class="kv"><dt>${k}</dt><dd>${val}</dd></div>`;
    const gradTxt = v.grad ? `${v.gradRaw}（${v.grad.from} ~ ${v.grad.to}）` : `${esc(v.gradRaw)}（无法解析）`;
    const fb = S.feedback.filter((x) => x.posId === v.id).length;
    return `<div class="detail">
    <a class="back" href="${v.archive ? '#/archive' : '#/jobs'}">${icon('left', 18)}${v.archive ? '往届存档' : '岗位'}</a>
    <header class="detail-head">
      <div class="dh-main"><p class="eyebrow">${esc(v.industry)} · ${esc(v.ownership)}${v.mine ? ' · 我添加的' : ''}</p><h1>${esc(v.company)}</h1><p class="d-title">${esc(displayTitle(v))}</p>
        <div class="dh-badges">${verdictBadge(v)}${dlChip(v)}${confDot(v.conf)}</div></div>
      ${v.archive ? '' : `<button class="star big ${fav ? 'on' : ''}" data-act="fav" data-id="${v.id}" aria-pressed="${fav}" aria-label="${fav ? '取消收藏' : '收藏'}">${icon('star', 24)}</button>`}
    </header>
    ${v.cohortDoubt ? `<div class="risk-note" role="note">${icon('alert', 20)}<div><strong>届次存疑，先看公告</strong><p>数据里的届次是「${esc(v.gradRaw)}」，招聘类型却写 27 届秋招。系统按“届次无法解析”处理，可信度记为低。</p></div></div>` : ''}
    ${v.risk ? `<div class="risk-note" role="note">${icon('alert', 20)}<div><strong>${esc(v.risk.kind)}</strong><p>${esc(v.risk.note)}。这只是系统的疑似判断，不代表一定有问题。</p></div></div>` : ''}
    <section class="panel"><h2>能不能投</h2>
      ${v.archive ? '<p class="muted">往届存档不做资格判断。</p>' : `<p class="muted s verdict-for">按你的画像：${esc(S.profile.gradDate)} 毕业 · ${esc(S.profile.degree)}${S.profile.major ? ' · ' + esc(S.profile.major) : ''}</p>
      <ul class="reasons">${v.elig.reasons.map((r) => { const [i, c, t] = reasonIcon(r); return `<li class="${c}">${icon(i, 18)}<span>${esc(r)}</span><span class="sr">${t}</span></li>`; }).join('')}</ul>`}
    </section>
    <div class="next-step">${actionBlock(v)}</div>
    ${v.roles && v.roles.length > 3 ? `<section class="panel"><h2>公告里的岗位（${v.roles.length}）</h2><p class="muted s">${esc(v.roles.join('、'))}</p></section>` : ''}
    <dl class="kvs">${kv('城市', esc(v.cities.join('、')))}${kv('批次', esc(v.batch))}${kv('毕业时间', esc(gradTxt))}${kv('截止', esc(dlText(v)) + (v.deadline.kind === 'date' ? `<small>${v.deadline.date}</small>` : ''))}${kv('学历', !v.minDegree ? '未列明' : esc(v.minDegree) + (v.downwardCompatible ? '及以上' : '（不向下兼容）'))}${kv('专业', v.majors.length ? esc(v.majors.join('、')) : '不限')}${kv('笔试', v.writtenTest === '免' ? '免笔试' : v.writtenTest === '部分' ? '部分岗位免笔试' : v.writtenTest === '未知' ? '未说明' : '需要笔试')}</dl>
    ${v.archive ? '<section class="panel"><h2>这条信息靠不靠谱</h2><p class="muted">往届存档不做可信度评估。</p></section>' : `<section class="panel"><h2>这条信息靠不靠谱</h2>
          <div class="conf-head">${confDot(v.conf)}<span class="muted s">${v.userVerified ? `你在 ${v.userVerified} 核对过` : v.conf.measured ? '已有核验记录' : '没有抽样核对过，按先验估计'}</span></div>
          <dl class="kvs three"><div class="kv"><dt>来源</dt><dd>${v.conf.source}</dd></div><div class="kv"><dt>字段</dt><dd>${v.conf.field}</dd></div><div class="kv"><dt>时效</dt><dd>${v.conf.freshness}</dd></div></dl>
          ${v.conf.basis ? `<p class="muted s">依据：${esc(v.conf.basis)}</p>` : ''}
          ${v.conflicts.length ? `<div class="conflict">${v.conflicts.map((c) => `<p><strong>${icon('alert', 16)}${FIELD[c.field] || c.field}有冲突</strong></p><ul>${c.values.map((x) => `<li><span class="tnum">${esc(x.value)}</span><small>${esc(host(x.source))}</small></li>`).join('')}</ul>`).join('')}<p class="muted s">以官网为准，核对后点下面的按钮。</p></div>` : ''}
          <details class="more"><summary>${icon('down', 16)}看每个字段的出处</summary>
            <div class="tbl-wrap"><table class="tbl"><thead><tr><th>字段</th><th>取得方式</th><th>来源</th><th>取得</th><th>核验</th></tr></thead><tbody>${provOf(v).map((p) => `<tr><td>${FIELD[p.field] || p.field}</td><td>${esc(p.method)}</td><td>${esc(host(p.source))}</td><td class="tnum">${p.obtained_at}</td><td class="tnum">${v.userVerified || p.verified_at || '—'}</td></tr>`).join('')}</tbody></table></div></details>
          <button class="btn secondary" data-act="d-verify" data-id="${v.id}">${icon('check', 18)}${v.userVerified ? '撤销核对' : '我核对过了'}</button>
        </section>`}
    <section class="panel"><h2>原始公告</h2>
      ${v.sources.length ? `<ul class="plain">${v.sources.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer" class="ext">${icon('link', 16)}<span>${esc(host(s.url))}</span><small>${esc(s.kind)}</small></a></li>`).join('')}</ul>` : '<p class="muted">没有找到公开来源链接。</p>'}
      ${v.recordId ? `<p class="muted s">第三方数据包 · 原记录 <span class="tnum">${esc(v.recordId)}</span></p>` : ''}<p class="muted s">来源更新 <span class="tnum">${v.updatedAt}</span>${v.archive ? '' : ` · 最后核验 <span class="tnum">${v.userVerified || '无'}</span>`}</p>
      ${sibs.length ? `<h3 class="sub-h">同一公告的其他岗位</h3><div class="list">${sibs.map((x) => `<a class="row-link" href="#/jobs/${x.id}"><span><strong>${esc(x.title)}</strong><small>${esc(x.cities.join('、'))}</small></span>${verdictBadge(x)}${icon('right', 18)}</a>`).join('')}</div>` : ''}
    </section>
    ${v.archive ? '' : `<p class="report"><button class="link" data-act="d-report" data-id="${v.id}">${icon('flag', 16)}信息有误？</button>${fb ? `<span class="muted s">你已反馈 ${fb} 次，已进入待核验队列。</span>` : ''}</p>`}
    </div>`;
  },
};

act('d-add', async (el) => { const v = getPos(el.dataset.id); if (await addApp(v)) toast('已加入我的投递'); rerender(); });
act('d-prep', async (el) => {
  const id = Number(el.dataset.id); const app = appFor(id);
  await moveApp(app.localId, '准备中');
  if (isMe()) { location.hash = '#/materials'; return; }
  const m = S.data.materials.find((x) => x.positionId === id);
  if (m) location.hash = `#/materials/${m.id}`; else { toast('演示里只有两份示例材料，已为你打开示例'); location.hash = '#/materials/M-01'; }
});
act('d-done', async (el) => { if ((await moveApp(el.dataset.id, '已投递')) !== false) toast('已标记为已投递'); rerender(); });
act('d-verify', (el) => { const on = verify(Number(el.dataset.id)); toast(on ? '已记录核对' : '已撤销'); rerender(); });

const REASONS = ['已截止', '链接打不开', '要求写错了', '其他'];
act('d-report', (el) => {
  const id = Number(el.dataset.id);
  openSheet(`<p class="muted s">告诉我哪里不对，会进入「数据质量」的待核验队列。只存在这台设备上。</p>
    <div class="radio-list" role="radiogroup" aria-label="问题类型">${REASONS.map((r, i) => `<label class="radio-row"><input type="radio" name="fb" value="${r}" ${i === 0 ? 'checked' : ''}><span>${r}</span></label>`).join('')}</div>
    <label class="field"><span>补充说明（可选）</span><textarea class="input" rows="3" id="fb-note" placeholder="例如：官网写的是 11 月 30 日"></textarea></label>
    <div class="sheet-foot"><button class="btn ghost" data-act="close-sheet">取消</button><button class="btn primary" data-act="d-report-save" data-id="${id}">提交反馈</button></div>`, { title: '信息有误？' });
});
act('d-report-save', (el) => {
  const sh = sheetRoot();
  const reason = sh.querySelector('input[name="fb"]:checked')?.value || '其他';
  const note = sh.querySelector('#fb-note')?.value.trim() || '';
  S.feedback.push({ posId: Number(el.dataset.id), reason, note, at: S.today });
  persist(); closeSheet(); toast('已记录，进入待核验队列'); rerender();
});
