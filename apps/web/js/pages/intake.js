// 添加一条招聘：粘贴 JD 文本或链接，用领域代码规则解析并立刻给出能不能投
import { S, addUserPosition } from '../store.js';
import { parseGradWindow } from '../../lib/grad.js';
import { parseDeadline } from '../../lib/deadline.js';
import { checkEligibility } from '../../lib/eligibility.js';
import { esc, icon, openSheet, closeSheet, act, onInput, sheetRoot, toast } from '../util.js';
import { reasonIcon } from '../components.js';

let it;
const fresh = () => ({ text: '', url: '', company: '', title: '', grad: '', deadline: '', degree: '本科', major: '', dirty: new Set(), auto: new Set() });

export function detect(text) {
  const out = {};
  const url = text.match(/https?:\/\/[^\s)）]+/);
  out.url = url ? url[0] : '';
  const g = text.match(/(?:\d{4}|\d{2})(?:\s*[\/、,，]\s*(?:\d{4}|\d{2}))*\s*届/);
  if (g && parseGradWindow(g[0].replace(/\s+/g, ''))) out.grad = g[0].replace(/\s+/g, '');
  const dl = text.match(/(?:截止|报名至|网申至|投递至|申请至)[^\d招额]{0,8}((?:\d{4}\s*[年\/.\-]\s*)?\d{1,2}\s*[月\/.\-]\s*\d{1,2}\s*日?)/);
  if (dl) out.deadline = dl[1].replace(/\s+/g, '');
  else if (/招满即止|额满即止|招满为止/.test(text)) out.deadline = '招满即止';
  if (/本科/.test(text)) out.degree = '本科';
  else if (/硕士|研究生/.test(text)) out.degree = '硕士';
  else if (/博士/.test(text)) out.degree = '博士';
  else if (/大专|专科/.test(text)) out.degree = '大专';
  if (/不限专业|专业不限/.test(text)) out.major = '';
  else { const m = text.match(/专业[:：]\s*([^\n。；;]+)/); if (m) out.major = m[1].split(/[、，,/或]/).map((s) => s.trim()).filter(Boolean).join('、'); }
  return out;
}

function compute() {
  const grad = parseGradWindow(it.grad.trim());
  const deadline = parseDeadline(it.deadline.trim(), 2026);
  const majors = it.major.trim() ? it.major.split(/[、，,]/).map((s) => s.trim()).filter(Boolean) : [];
  const pos = { company: it.company, title: it.title, batch: '我添加的', gradWindow: grad, minDegree: it.degree, downwardCompatible: true, degrees: [], majors, cities: [], deadline };
  const elig = checkEligibility(pos, { gradDate: S.profile.gradDate, degree: S.profile.degree, major: S.profile.major || undefined }, S.today);
  return { grad, deadline, majors, elig };
}

function previewHTML() {
  const { grad, deadline, majors, elig } = compute();
  const row = (k, v, ok, auto) => `<li><span class="pk">${k}</span><span class="pv">${v}</span><span class="pm ${ok ? '' : 'miss'}">${ok ? (auto ? '规则解析' : '人工录入') : '未识别'}</span></li>`;
  const dlTxt = deadline.kind === 'date' ? deadline.date : deadline.kind === 'rolling' ? '招满即止' : '未公布';
  const cls = { 可投: 'ok', 待确认: 'warn', 不可投: 'muted' }[elig.verdict];
  const ic = { 可投: 'check', 待确认: 'question', 不可投: 'dash' }[elig.verdict];
  return `<div class="parse">
    <ul class="parse-list">
      ${row('毕业区间', grad ? `${grad.from} ~ ${grad.to}` : '—', !!grad, it.auto.has('grad') && !it.dirty.has('grad'))}
      ${row('截止日', dlTxt, deadline.kind !== 'unknown', it.auto.has('deadline') && !it.dirty.has('deadline'))}
      ${row('学历', it.degree + '及以上', true, it.auto.has('degree') && !it.dirty.has('degree'))}
      ${row('专业', majors.length ? esc(majors.join('、')) : '不限', true, it.auto.has('major') && !it.dirty.has('major'))}
    </ul>
    <div class="verdict-box ${cls}"><div class="vb-h"><span class="badge b-${cls}">${icon(ic, 14)}${elig.verdict}</span><span>按你的画像（${esc(S.profile.gradDate)} 毕业 · ${esc(S.profile.degree)}）</span></div>
    <ul class="reasons">${elig.reasons.map((r) => { const [i, c] = reasonIcon(r); return `<li class="${c}">${icon(i, 16)}<span>${esc(r)}</span></li>`; }).join('')}</ul></div>
  </div>`;
}

function formHTML() {
  return `<div class="form">
    <label class="field"><span>招聘公告文字或链接</span><textarea class="input" rows="5" data-input="it-text" placeholder="把公告原文或链接粘贴到这里，例如：2027届校园招聘，本科及以上，网申截止 2026年11月20日……">${esc(it.text)}</textarea></label>
    <div class="two">
      <label class="field"><span>公司</span><input class="input" data-input="it-company" value="${esc(it.company)}" placeholder="公司名称"></label>
      <label class="field"><span>岗位</span><input class="input" data-input="it-title" value="${esc(it.title)}" placeholder="岗位名称"></label>
    </div>
    <h3 class="sub-h">马上看结果</h3>
    <div id="it-preview">${previewHTML()}</div>
    <h3 class="sub-h">解析结果，可以改</h3>
    <div class="two">
      <label class="field"><span>届次</span><input class="input" data-input="it-grad" value="${esc(it.grad)}" placeholder="例如 27届、26/27届"></label>
      <label class="field"><span>截止</span><input class="input" data-input="it-deadline" value="${esc(it.deadline)}" placeholder="例如 2026/11/20 或 招满即止"></label>
    </div>
    <div class="two">
      <label class="field"><span>学历要求</span><select class="input" data-change="it-degree">${['大专', '本科', '硕士', '博士'].map((d) => `<option ${d === it.degree ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
      <label class="field"><span>限定专业（空 = 不限）</span><input class="input" data-input="it-major" value="${esc(it.major)}" placeholder="用顿号隔开"></label>
    </div>
    <div class="sheet-foot"><button class="btn ghost" data-act="close-sheet">取消</button><button class="btn primary" data-act="it-save">${icon('plus', 18)}保存到岗位</button></div>
  </div>`;
}

export function openIntake() {
  it = fresh();
  openSheet(formHTML(), { title: '添加一条招聘', wide: true });
}
const repaint = () => { const p = document.getElementById('it-preview'); if (p) p.innerHTML = previewHTML(); };
const setField = (k, el, v) => { it[k] = v; it.dirty.add(k); };

onInput('it-text', (el) => {
  it.text = el.value;
  const d = detect(it.text);
  const sh = sheetRoot();
  const fill = (k, field, val, inputSel) => {
    if (val === undefined || it.dirty.has(k)) return;
    it[field] = val; it.auto.add(k);
    const inp = sh.querySelector(inputSel); if (inp) inp.value = val;
  };
  fill('grad', 'grad', d.grad, '[data-input="it-grad"]');
  fill('deadline', 'deadline', d.deadline, '[data-input="it-deadline"]');
  fill('degree', 'degree', d.degree, '[data-change="it-degree"]');
  fill('major', 'major', d.major, '[data-input="it-major"]');
  it.url = d.url;
  repaint();
});
onInput('it-company', (el) => { it.company = el.value; });
onInput('it-title', (el) => { it.title = el.value; });
onInput('it-grad', (el) => { setField('grad', el, el.value); repaint(); });
onInput('it-deadline', (el) => { setField('deadline', el, el.value); repaint(); });
onInput('it-major', (el) => { setField('major', el, el.value); repaint(); });
onInput('it-degree', (el) => { setField('degree', el, el.value); repaint(); });
act('it-save', () => {
  if (!it.company.trim() || !it.title.trim()) { toast('请先填写公司和岗位名称'); return; }
  const { majors } = compute();
  const auto = ['grad', 'deadline', 'degree', 'major'].filter((k) => it.auto.has(k) && !it.dirty.has(k)).map((k) => ({ grad: 'grad_window', deadline: 'deadline', degree: 'degree', major: 'majors' }[k]));
  const id = addUserPosition({ company: it.company.trim(), title: it.title.trim(), url: it.url, gradRaw: it.grad.trim(), deadlineRaw: it.deadline.trim(), degree: it.degree, majors, autoFields: auto });
  closeSheet();
  toast('已添加到岗位列表');
  location.hash = `#/jobs/${id}`;
});
