import { S, isMe } from '../store.js';
import { esc, icon } from '../util.js';
import { pageHead } from '../components.js';
const ITEMS = [
  ['insights', '数据', 'insights', '指标、图表，口径透明'], ['guide', '渠道与参考', 'guide', '渠道目录、专业看岗位、截止日历'], ['activity', '运行记录', 'activity', '岗位核验、投递和下一步的历史'],
  ['archive', '往届存档', 'archive', '已过截止日的岗位，只读'], ['quality', '数据质量', 'quality', '来源、可信度、冲突与核验'],
  ['facts', '事实库', 'materials', '确认过的经历，简历只引用这里'], ['settings', '设置与隐私', 'settings', '修改画像、导出、清除'],
];
export default {
  title: () => '更多',
  render() {
    const p = S.profile;
    return `${pageHead('更多', `${esc(p.name)} · ${esc(p.gradDate)} 毕业 · ${esc(p.degree)}${p.major ? ' · ' + esc(p.major) : ''}`)}
    <div class="list">${ITEMS.map(([id, t, ic, d]) => `<a class="row-link" href="#/${id}"><span class="lc-ic">${icon(ic, 22)}</span><span><strong>${t}</strong><small>${d}</small></span>${icon('right', 18)}</a>`).join('')}</div>
    <p class="demo-line">${isMe() ? '我的版本 · 仅本机' : `演示版 · 公司与数据均为虚构 · 演示日期 ${S.today} ·<a href="https://korey2028.tech/work/job-os.html" target="_blank" rel="noopener noreferrer">关于这个项目</a>`}</p>`;
  },
};
