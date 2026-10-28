import { S, setProfile, persist } from '../store.js';
import { esc, icon, act, onInput, rerender } from '../util.js';

let step = 0;
let d = null;
const MAJORS = ['市场营销', '工商管理', '电子商务', '国际贸易', '会计学', '财务管理', '金融学', '经济学', '计算机科学', '软件工程', '数据科学', '电气工程', '机械工程', '材料科学', '自动化', '新闻传播', '汉语言文学', '广告学', '人力资源管理', '行政管理', '法学', '药学', '生物工程', '英语'];
const CITIES = ['上海', '杭州', '北京', '深圳', '广州', '成都', '南京', '苏州', '武汉', '西安', '天津', '合肥', '长沙', '青岛'];
const Q = ['你哪年几月毕业？', '你的学历和专业？', '想去哪些城市？'];
const H = ['系统会换算成毕业时间区间，直接告诉你每个岗位能不能投。', '学历和专业用来判断门槛，不会外传。', '可以多选，也可以跳过。'];

function ensure() { if (!d) { d = { ...S.profile, cities: [...(S.profile.cities || [])] }; const [y, m] = d.gradDate.split('-'); d.y = Number(y); d.m = Number(m); } }

function body() {
  if (step === 0) {
    const years = [2026, 2027, 2028, 2029];
    return `<div class="seg big" role="group" aria-label="毕业年份">${years.map((y) => `<button class="${d.y === y ? 'on' : ''}" data-act="w-year" data-v="${y}" aria-pressed="${d.y === y}">${y}</button>`).join('')}</div>
      <div class="month-grid" role="group" aria-label="毕业月份">${Array.from({ length: 12 }, (_, i) => i + 1).map((m) => `<button class="mchip ${d.m === m ? 'on' : ''}" data-act="w-month" data-v="${m}" aria-pressed="${d.m === m}">${m} 月</button>`).join('')}</div>
      <p class="w-note">${icon('info', 16)}大多数人是 6 月毕业。</p>`;
  }
  if (step === 1) {
    return `<div class="seg big" role="group" aria-label="学历">${['大专', '本科', '硕士', '博士'].map((x) => `<button class="${d.degree === x ? 'on' : ''}" data-act="w-degree" data-v="${x}" aria-pressed="${d.degree === x}">${x}</button>`).join('')}</div>
      <label class="field"><span>专业</span><input class="input" id="w-major" list="majors" data-input="w-major" value="${esc(d.major || '')}" placeholder="输入或选择，例如 市场营销" autocomplete="off"></label>
      <datalist id="majors">${MAJORS.map((m) => `<option value="${m}">`).join('')}</datalist>
      <div class="chips wrap">${MAJORS.slice(0, 8).map((m) => `<button class="chip ${d.major === m ? 'on' : ''}" data-act="w-major-pick" data-v="${m}">${m}</button>`).join('')}</div>`;
  }
  return `<div class="chips wrap big">${CITIES.map((c) => `<button class="chip ${d.cities.includes(c) ? 'on' : ''}" data-act="w-city" data-v="${c}" aria-pressed="${d.cities.includes(c)}">${d.cities.includes(c) ? icon('check', 16) : ''}${c}</button>`).join('')}</div>`;
}

export default {
  title: () => '欢迎',
  render() {
    ensure();
    return `<div class="welcome">
      <div class="w-brand"><span class="logo">${icon('check', 18)}</span>求职控制台</div>
      <div class="w-card">
        <div class="w-prog" aria-label="第 ${step + 1} 步，共 3 步">${[0, 1, 2].map((i) => `<i class="${i <= step ? 'on' : ''}"></i>`).join('')}</div>
        <p class="w-step">第 ${step + 1} 步 / 3</p>
        <h1>${Q[step]}</h1>
        <p class="lede">${H[step]}</p>
        <div class="w-body">${body()}</div>
        <div class="w-foot">
          ${step > 0 ? `<button class="btn ghost" data-act="w-back">${icon('left', 18)}返回</button>` : '<span></span>'}
          <button class="btn primary" data-act="${step === 2 ? 'w-finish' : 'w-next'}">${step === 2 ? (d.cities.length ? '看我能投的岗位' : '跳过，直接看岗位') : '继续'}${icon('right', 18)}</button>
        </div>
      </div>
      <p class="w-fine">演示数据，公司均为虚构。画像只存在这台设备上。</p>
    </div>`;
  },
};

act('w-year', (el) => { d.y = Number(el.dataset.v); rerender(); });
act('w-month', (el) => { d.m = Number(el.dataset.v); rerender(); });
act('w-degree', (el) => { d.degree = el.dataset.v; rerender(); });
act('w-major-pick', (el) => { d.major = el.dataset.v; rerender(); });
onInput('w-major', (el) => { d.major = el.value.trim(); });
act('w-city', (el) => { const c = el.dataset.v; d.cities = d.cities.includes(c) ? d.cities.filter((x) => x !== c) : [...d.cities, c]; rerender(); });
act('w-next', () => { step++; rerender({ keepScroll: false }); });
act('w-back', () => { step--; rerender({ keepScroll: false }); });
act('w-finish', () => {
  setProfile({ gradDate: `${d.y}-${String(d.m).padStart(2, '0')}`, degree: d.degree, major: d.major || '', cities: d.cities });
  S.onboarded = true; persist(); step = 0; d = null;
  location.hash = '#/jobs';
});
