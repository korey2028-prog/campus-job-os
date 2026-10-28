import { S, COLS, isMe, appsAll, colOf, getPos, moveApp, updateApp, humanNext } from '../store.js';
import { esc, icon, act, toast, fmtMD, diffDays, rerender, openSheet, closeSheet, sheetRoot } from '../util.js';
import { pageHead, seg, emptyState } from '../components.js';

let cur = '想投';
const HINT = { 想投: '还在考虑', 准备中: '在写定向材料', 已投递: '等通知', 笔试面试: '进入流程', 结束: '不投或来源关闭' };

function card(a) {
  const v = getPos(a.positionId);
  const col = colOf(a);
  const moved = S.moves[a.localId];
  const d = a.nextActionDate ? diffDays(a.nextActionDate, S.today) : null;
  // 个人模式：下一步只显示人话，台账原文和状态放到悬停提示里
  const next = isMe() ? humanNext(a.nextAction, col, !!v) : a.nextAction && a.nextAction !== '—' ? a.nextAction : '';
  return `<article class="app-card" draggable="true" data-id="${a.localId}"${isMe() ? ` title="台账状态：${esc(a.stageRaw)}${a.nextAction ? '\n下一步原文：' + esc(a.nextAction) : ''}"` : ''}>
    <a class="app-main" href="${v ? '#/jobs/' + v.id : a.officialUrl ? esc(a.officialUrl) : '#'}"${!v && a.officialUrl ? ' target="_blank" rel="noopener noreferrer"' : ''}><strong>${esc(a.company)}</strong><span>${esc(a.role)}</span></a>
    ${next ? `<p class="app-next">${icon('clock', 14)}<span>${esc(next)}</span>${a.nextActionDate ? `<em class="tnum ${d != null && d <= 2 ? 'urgent' : ''}">${fmtMD(a.nextActionDate)}</em>` : ''}</p>` : ''}
    <div class="app-foot">${isMe() ? '<span></span>' : `<span class="raw" title="原始状态文字">原始状态：${esc(a.stageRaw)}${moved ? ' · 已手动移动' : ''}</span>`}
      <div class="app-actions"><button class="chg" data-act="app-edit" data-id="${a.localId}">编辑下一步</button><button class="chg" data-act="app-menu" data-id="${a.localId}" aria-label="改 ${esc(a.company)} 的状态">改状态${icon('down', 14)}</button></div></div>
  </article>`;
}

export default {
  title: () => '投递',
  render() {
    const apps = appsAll();
    const by = Object.fromEntries(COLS.map((c) => [c, apps.filter((a) => colOf(a) === c)]));
    const active = apps.filter((a) => colOf(a) !== '结束').length;
    const col = (c) => `<section class="kcol" data-col="${c}" aria-label="${c}"><header><h2>${c}</h2><span class="tnum">${by[c].length}</span></header><p class="muted s">${HINT[c]}</p><div class="kbody">${by[c].map(card).join('') || '<p class="kempty">空</p>'}</div></section>`;
    return `${pageHead('投递', `进行中 <strong class="tnum">${active}</strong> 条，共 <span class="tnum">${apps.length}</span> 条。${isMe() ? '' : '拖动卡片或用菜单改状态，原始状态文字会保留。'}`)}
    <div class="only-mobile">${seg('app-tab', COLS.map((c) => [c, `${c} ${by[c].length}`]), cur)}<div class="mcol">${by[cur].map(card).join('') || emptyState('这一列是空的', '在岗位详情里点「加入我的投递」。', '<a class="btn secondary" href="#/jobs">去看岗位</a>')}</div></div>
    <div class="board only-desktop">${COLS.map(col).join('')}</div>`;
  },
  mount(ctx, root) {
    root.querySelectorAll('.app-card').forEach((c) => {
      c.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', c.dataset.id); c.classList.add('drag'); });
      c.addEventListener('dragend', () => c.classList.remove('drag'));
    });
    root.querySelectorAll('.kcol').forEach((k) => {
      k.addEventListener('dragover', (e) => { e.preventDefault(); k.classList.add('over'); });
      k.addEventListener('dragleave', () => k.classList.remove('over'));
      k.addEventListener('drop', async (e) => { e.preventDefault(); if ((await moveApp(e.dataTransfer.getData('text/plain'), k.dataset.col)) !== false) toast(`已移到「${k.dataset.col}」`); rerender(); });
    });
  },
};
act('app-tab', (el) => { cur = el.dataset.v; rerender(); });
act('app-menu', (el) => {
  const a = appsAll().find((x) => x.localId === el.dataset.id); if (!a) return;
  const cur = colOf(a);
  openSheet(`<p class="muted s">${esc(a.company)} · ${esc(a.role)}<br>${isMe() ? '台账状态' : '原始状态'}：${esc(a.stageRaw)}，${isMe() ? '选择后会改写台账里的 stage。' : '不会被改动。'}</p><div class="menu-list">${COLS.map((c) => `<button class="menu-row ${c === cur ? 'on' : ''}" data-act="app-move" data-id="${a.localId}" data-v="${c}"><span>${c}</span>${c === cur ? icon('check', 18) : ''}</button>`).join('')}</div>`, { title: '改状态' });
});
act('app-edit', (el) => {
  const a = appsAll().find((x) => x.localId === el.dataset.id); if (!a) return;
  openSheet(`<p class="muted s">${esc(a.company)} · ${esc(a.role)}<br>只更新你的下一步，不会改变原始邮件或岗位来源。</p>
    <label class="field"><span>下一步</span><input class="input" id="app-next" value="${esc(a.nextAction === '—' ? '' : a.nextAction)}" placeholder="例如：核对官网截止日"></label>
    <label class="field"><span>下一步日期</span><input class="input" id="app-date" type="date" value="${(isMe() ? /^\d{4}-\d{2}-\d{2}$/ : /^\\d{4}-\\d{2}-\\d{2}$/).test(a.nextActionDate) ? esc(a.nextActionDate) : ''}"></label>
    <label class="field"><span>备注</span><textarea class="input" id="app-notes" rows="4" placeholder="记录实际结果、来源和待确认项">${esc(a.notes || '')}</textarea></label>
    <div class="sheet-foot"><button class="btn ghost" data-act="close-sheet">取消</button><button class="btn primary" data-act="app-edit-save" data-id="${a.localId}">保存下一步</button></div>`, { title: '编辑投递下一步' });
});
act('app-edit-save', async (el) => {
  const sh = sheetRoot();
  const nextAction = sh.querySelector('#app-next')?.value || '';
  const nextActionDate = sh.querySelector('#app-date')?.value || '';
  const notes = sh.querySelector('#app-notes')?.value || '';
  const ok = await updateApp(el.dataset.id, { nextAction, nextActionDate, notes });
  closeSheet(); if (ok !== false) toast('已保存下一步'); rerender();
});
act('app-move', async (el) => { const ok = await moveApp(el.dataset.id, el.dataset.v); closeSheet(); if (ok !== false) toast(`已移到「${el.dataset.v}」`); rerender(); });
