import { S, isMe, persist } from '../store.js';
import { esc, icon, act, toast, rerender } from '../util.js';
import { pageHead, emptyState } from '../components.js';

const isOk = (f) => f.status === '已确认' || S.factOk[f.id];
const factById = (id) => S.data.facts.find((f) => f.id === id);
const MS = { 已匹配: ['ok', 'check'], 表达缺口: ['warn', 'question'], 证据不足: ['warn', 'question'], 真实缺口: ['muted', 'dash'], 待确认: ['muted', 'question'] };
const TIERS = ['建议投递', '补充材料后投递', '谨慎投递', '暂不建议投递'];

const resumeFiles = () => {
  const L = S.data.resumeFiles || [];
  return L.length ? `<div class="list">${L.map((r) => `<div class="row-link static"><span><strong>${esc(r.company)} · ${esc(r.role)}</strong><small class="tnum">${esc(r.path)}</small></span><span class="badge b-muted tnum">${esc(r.localId)}</span></div>`).join('')}</div>` : emptyState('台账里还没有材料路径', '');
};

export const facts = {
  title: () => '事实库',
  render() {
    const F = S.data.facts;
    const ok = F.filter(isOk).length;
    return `<a class="back" href="#/materials">${icon('left', 18)}材料</a>
    ${pageHead('事实库', `已确认 <strong class="tnum">${ok}</strong> 条，待确认 <strong class="tnum">${F.length - ok}</strong> 条。只有你确认过的事实，才会进入简历。`)}
    <section class="block"><ul class="facts">${F.map((f) => `<li class="fact ${isOk(f) ? '' : 'pending'}">
      <div class="fact-id tnum">${f.id}</div>
      <div class="fact-b"><h3>${esc(f.title)}</h3><p>${esc(f.detail)}</p>
        <dl class="chips-kv">${f.boundary !== undefined ? `<div><dt>表述边界</dt><dd>${esc(f.boundary)}</dd></div>` : `<div><dt>角色</dt><dd>${esc(f.role)}</dd></div><div><dt>阶段</dt><dd>${esc(f.stage)}</dd></div>`}<div><dt>来源</dt><dd>${esc(f.source)}</dd></div></dl></div>
      <div class="fact-s">${isOk(f) ? `<span class="badge b-ok">${icon('check', 14)}已确认</span>` : `<span class="badge b-warn">${icon('question', 14)}待确认</span><button class="btn secondary sm" data-act="fact-ok" data-id="${f.id}">我确认这条</button>`}</div></li>`).join('')}</ul></section>
    <section class="block two-col even"><div><h2 class="h2">缺口</h2><ul class="plain gaps">${S.data.factGaps.map((g) => `<li><strong class="tnum">${g.id}</strong><div><p>${esc(g.text)}</p><small>${esc(g.suggest)}</small></div></li>`).join('')}</ul></div>
    <div><h2 class="h2">更正记录</h2><ul class="plain gaps">${S.data.factFixes.map((g) => `<li><strong class="tnum">${g.date.slice(5)}</strong><div><p>${esc(g.text)}</p><small>${esc(g.by)}确认</small></div></li>`).join('')}</ul></div></section>
    <p class="fine">${isMe() ? '读自 career-workflow/事实底稿.md，网页里只读，要改请改底稿。' : '格式与 resume-claim-guard 的事实底稿一致。演示数据。'}</p>`;
  },
};
act('fact-ok', (el) => { S.factOk[el.dataset.id] = true; persist(); toast('已确认'); rerender(); });

export const materials = {
  title: () => '材料',
  render() {
    const F = S.data.facts, ok = F.filter(isOk).length;
    return `${pageHead('材料', '事实库是起点，定向材料从岗位生成，每一句都能追溯到事实。')}
    <a class="link-card" href="#/facts"><span class="lc-ic">${icon('doc', 22)}</span><span><strong>事实库</strong><small>已确认 ${ok} / ${F.length} 条 · 缺口 ${S.data.factGaps.length} 项</small></span>${icon('right', 18)}</a>
    <section class="block"><h2 class="h2">定向材料</h2>
      ${isMe() ? resumeFiles() : S.data.materials.length ? `<div class="list">${S.data.materials.map((m) => `<a class="row-link" href="#/materials/${m.id}"><span><strong>${esc(m.company)} · ${esc(m.role)}</strong><small>${esc(m.advice.level)} · ${m.resume.length} 句简历草稿 · ${m.interview.length} 个追问</small></span><span class="badge b-muted tnum">${m.id}</span>${icon('right', 18)}</a>`).join('')}</div>` : emptyState('还没有定向材料', '在岗位详情里点「准备定向材料」。')}
      ${isMe() ? '<p class="fine">路径来自台账的 resume_path 列。网页不生成草稿，定向材料在台账所在的工作区里做。</p>' : '<p class="fine">演示版只放了两份示例，它们按 JD 拆解 → 匹配 → 简历 → 面试预演的顺序展开。</p>'}</section>`;
  },
};

export const materialDetail = {
  title: (c) => '定向材料 ' + c.parts[1],
  render({ parts }) {
    const m = S.data.materials.find((x) => x.id === parts[1]);
    if (!m) return emptyState('找不到这份材料', '', '<a class="btn secondary" href="#/materials">回到材料</a>');
    const step = (n, t, inner) => `<section class="step"><h2><span class="step-n tnum">${n}</span>${t}</h2>${inner}</section>`;
    const sCount = m.matches.reduce((a, x) => (a[x.status] = (a[x.status] || 0) + 1, a), {});
    return `<a class="back" href="#/materials">${icon('left', 18)}材料</a>
    ${pageHead(`${m.company} · ${m.role}`, `${esc(m.advice.level)}：${esc(m.advice.reason)}`)}
    <div class="two-col rail">
      <div class="steps">
        ${step(1, 'JD 拆解', `<p class="lead-p">${esc(m.jd.summary)}</p><div class="chips wrap">${m.jd.asks.map((a) => `<span class="chip static">${esc(a)}</span>`).join('')}</div>`)}
        ${step(2, '要求与证据匹配', `<div class="tbl-wrap"><table class="tbl match"><thead><tr><th>要求</th><th>状态</th><th>事实</th><th>说明</th></tr></thead><tbody>${m.matches.map((x) => { const [c, i] = MS[x.status]; return `<tr><td>${esc(x.ask)}</td><td><span class="badge b-${c}">${icon(i, 14)}${x.status}</span></td><td class="tnum">${esc(x.fact)}</td><td>${esc(x.note)}</td></tr>`; }).join('')}</tbody></table></div><p class="muted s">${Object.entries(sCount).map(([k, v]) => `${k} ${v}`).join(' · ')}</p>`)}
        ${step(3, '投递建议', `<ol class="tiers">${TIERS.map((t) => `<li class="${t === m.advice.level ? 'on' : ''}">${t === m.advice.level ? icon('check', 16) : ''}${t}</li>`).join('')}</ol><p>${esc(m.advice.reason)}</p>`)}
        ${step(4, '简历草稿', `<ul class="resume">${m.resume.map((r) => { const ok = r.facts.every((id) => { const f = factById(id); return f && isOk(f); }); return `<li class="${ok ? '' : 'grey'}"><p>${esc(r.text)}</p><div class="refs">${r.facts.map((id) => `<span class="badge b-muted tnum">${id}</span>`).join('')}${ok ? '' : '<span class="badge b-warn">'+icon('question', 14)+'未确认，暂不能用</span>'}</div></li>`; }).join('')}</ul><p class="muted s">每句标出引用的事实编号。引用到未确认事实的句子会置灰。</p>`)}
        ${step(5, '面试追问预演', `<ul class="qa">${m.interview.map((q) => `<li><strong>${esc(q.q)}</strong><p>${esc(q.hint)}</p><div class="refs">${q.facts.map((id) => `<span class="badge b-muted tnum">${id}</span>`).join('') || '<span class="badge b-muted">无对应事实</span>'}</div></li>`).join('')}</ul>`)}
        ${step(6, '人工确认清单', `<ul class="checklist">${m.checklist.map((c, i) => { const k = `chk-${m.id}-${i}`; return `<li><button class="check ${S.done[k] ? 'on' : ''}" data-act="chk" data-key="${k}" aria-pressed="${!!S.done[k]}" aria-label="${esc(c)}">${icon('check', 16)}</button><span class="${S.done[k] ? 'struck' : ''}">${esc(c)}</span></li>`; }).join('')}</ul><p class="muted s">投递前由你确认。系统不会替你发送或提交。</p>`)}
      </div>
      <aside class="rail-col"><div class="panel sticky"><h2>运行记录</h2><p class="muted s">示例数据</p>
        <ul class="runs">${m.runs.map((r) => `<li><strong>${esc(r.skill)} <span class="tnum">${esc(r.version)}</span></strong><dl><div><dt>模型</dt><dd>${esc(r.model)}</dd></div><div><dt>用到事实</dt><dd class="tnum">${esc(r.facts.join('、'))}</dd></div><div><dt>时间</dt><dd class="tnum">${esc(r.at)}</dd></div><div><dt>确认人</dt><dd>${esc(r.confirmedBy)}</dd></div></dl></li>`).join('')}</ul></div></aside>
    </div>`;
  },
};
act('chk', (el) => { const k = el.dataset.key; S.done[k] = !S.done[k]; persist(); rerender(); });
