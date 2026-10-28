import { S } from '../store.js';
import { esc, icon } from '../util.js';
import { pageHead, emptyState } from '../components.js';

const LABELS = { application: '投递', verify: '核验', favorite: '收藏', position: '岗位' };

export default {
  title: () => '运行记录',
  render() {
    const rows = S.events || [];
    return `${pageHead('运行记录', '记录你对岗位、投递和来源做过的关键决定，方便回看，不把网页状态当成完成证据。')}
      <section class="panel"><div class="h-row"><h2 class="h2">最近动作</h2><span class="muted s tnum">${rows.length} 条</span></div>
      ${rows.length ? `<ol class="plain timeline">${rows.map((e) => `<li><span class="tl-ic">${icon(e.kind === 'application' ? 'apps' : e.kind === 'verify' ? 'check' : e.kind === 'favorite' ? 'star' : 'jobs', 18)}</span><div><strong>${esc(e.label)}</strong><small class="tnum">${esc(e.at)} · ${esc(LABELS[e.kind] || e.kind)}</small></div></li>`).join('')}</ol>` : emptyState('还没有运行记录', '你核验岗位、加入投递或更新下一步后，这里会自动留下记录。')}</section>
      <p class="fine">记录只保存在这台设备的浏览器中，可在「设置与隐私」导出。</p>`;
  },
};
