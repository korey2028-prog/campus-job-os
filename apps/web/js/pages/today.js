import { S, isMe, displayTitle, positions, appsAll, colOf, getPos, summary, persist, dlText, moveApp, SOON_DAYS, humanNext } from '../store.js';
import { esc, icon, act, diffDays, fmtMD, addDays, rerender, toast } from '../util.js';
import { verdictBadge, dlChip, pageHead, emptyState } from '../components.js';

function actions() {
  const out = [];
  const late = [];
  for (const a of appsAll()) {
    const col = colOf(a);
    if (col === '结束' || !a.nextActionDate) continue;
    const v = getPos(a.positionId);
    const item = { key: 'app-' + a.localId, localId: a.localId, title: `${a.company} · ${a.role}`, sub: isMe() ? humanNext(a.nextAction, col, !!v) : a.nextAction, date: a.nextActionDate, href: v ? `#/jobs/${v.id}` : '#/applications', tag: col, v, days: diffDays(a.nextActionDate, S.today) };
    // 个人模式：已过期的下一步没有截止压力，单独成一块，不占“今天”的名额
    (isMe() && item.days < 0 ? late : out).push(item);
  }
  out.sort((x, y) => x.days - y.days);
  const have = new Set(appsAll().map((a) => a.positionId));
  const urgent = positions().filter((v) => !v.expired && !v.risk && v.elig.verdict === '可投' && v.daysLeft != null && v.daysLeft <= 7 && !have.has(v.id)).sort((a, b) => a.daysLeft - b.daysLeft);
  for (const v of urgent.slice(0, 3)) out.unshift({ key: 'pos-' + v.id, title: `${v.company} · ${v.title}`, sub: isMe() ? '还没加入投递' : `${dlText(v)}，还没加入投递 → 先看一眼要求`, date: v.deadline.date, href: `#/jobs/${v.id}`, tag: '可投', v, days: v.daysLeft });
  late.sort((x, y) => y.days - x.days);
  return { todo: out.slice(0, 5), late };
}

// 导航徽标用：今天还没勾掉的事
export const todayCount = () => actions().todo.filter((a) => !S.done[a.key]).length;

const lateRow = (a) => `<li class="act-row">
        <a class="act-main" href="${a.href}"><strong>${esc(a.title)}</strong><span>${esc(a.sub)}</span></a>
        <span class="act-date">${fmtMD(a.date)}<small>${esc(a.tag)}</small></span>
        ${['想投', '准备中'].includes(a.tag) ? `<button class="btn secondary sm" data-act="t-end" data-id="${a.localId}" title="移到「结束」">不投了</button>` : ''}</li>`;

export default {
  title: () => '今天',
  render() {
    const { todo: acts, late } = actions();
    const open = acts.filter((a) => !S.done[a.key]);
    const apps = appsAll();
    const week = apps.filter((a) => ['已投递', '笔试面试'].includes(colOf(a)) && diffDays(S.today, a.lastEventAt) <= 7).length;
    const s = summary();
    const soonList = positions().filter((v) => !v.expired && !v.risk && v.elig.verdict !== '不可投' && v.daysLeft != null && v.daysLeft >= 0 && v.daysLeft <= SOON_DAYS).sort((a, b) => a.daysLeft - b.daysLeft).slice(0, 12);
    const d7 = positions().filter((v) => v.daysLeft != null && v.daysLeft >= 0 && v.daysLeft <= 7 && !v.expired).length;
    const picks = isMe() ? positions().filter((v) => v.rank?.tier === 'A' && !v.expired && !v.risk && ((v.daysLeft != null && v.daysLeft <= 7) || v.updatedAt === S.today)).sort((a, b) => (a.daysLeft ?? 999) - (b.daysLeft ?? 999)).slice(0, 5) : [];
    const noDate = apps.filter((a) => colOf(a) !== '结束' && !a.nextActionDate);
    const noDeadline = apps.filter((a) => colOf(a) !== '结束').map((a) => ({ a, v: getPos(a.positionId) })).filter((x) => x.v && x.v.deadline.kind === 'unknown');
    const hello = S.profile.name + '，';
    // 岗位数据超过 36 小时没同步才提示；正常时不占位置
    const synced = isMe() && S.data.meta?.sources?.[0]?.mtime;
    const staleH = synced ? (Date.now() - Date.parse(synced)) / 3600000 : 0;
    const stale = staleH > 36 ? `<p class="note-line">${icon('alert', 16)}岗位数据是 ${Math.floor(staleH / 24)} 天前同步的，截止和新岗位可能不准。</p>` : '';
    const lead = open.length ? `今天先做 ${open.length} 件事` : '今天的事都做完了';
    return `${pageHead(lead, `${esc(hello)}本周已定向投递 <strong class="tnum">${week}</strong> 个。`)}${stale}
    <dl class="stats">
      <div class="stat"><dt>能投</dt><dd class="tnum">${s.can}</dd></div>
      <div class="stat"><dt>待确认</dt><dd class="tnum">${s.maybe}</dd></div>
      <div class="stat"><dt>7 天内截止</dt><dd class="tnum">${d7}</dd></div>
      <div class="stat"><dt>投递中</dt><dd class="tnum">${apps.filter((a) => !['结束'].includes(colOf(a))).length}</dd></div>
    </dl>
    ${picks.length ? `<section class="block"><h2 class="h2">为你推荐</h2><div class="list">${picks.map((v) => `<a class="row-link" href="#/jobs/${v.id}"><span><strong>${esc(v.company)} · ${esc(displayTitle(v))}</strong><small>${esc(v.rank.reasons[0])}</small></span>${dlChip(v)}${icon('right', 18)}</a>`).join('')}</div></section>` : ''}
    <section class="block"><h2 class="h2">今天先做这几件</h2>
      ${acts.length ? `<ul class="actions">${acts.map((a) => `<li class="act-row ${S.done[a.key] ? 'done' : ''}">
        <button class="check ${S.done[a.key] ? 'on' : ''}" data-act="t-done" data-key="${a.key}" aria-pressed="${!!S.done[a.key]}" aria-label="${S.done[a.key] ? '标为未完成' : '标为完成'}">${icon('check', 16)}</button>
        <a class="act-main" href="${a.href}"><strong>${esc(a.title)}</strong><span>${esc(a.sub)}</span></a>
        <span class="act-date ${a.days <= 2 ? 'urgent' : ''}">${a.days < 0 ? '已过期' : a.days === 0 ? '今天' : `${fmtMD(a.date)}`}<small>${esc(a.tag)}</small></span></li>`).join('')}</ul>` : emptyState('暂时没有待办', '去岗位里挑几个加入投递，这里会出现下一步。', '<a class="btn secondary" href="#/jobs">看岗位</a>')}
    </section>
    ${late.length ? `<section class="block late-block"><h2 class="h2">已过期，待决定<small class="tnum">${late.length} 条</small></h2><ul class="actions">${late.slice(0, 5).map(lateRow).join('')}</ul>${late.length > 5 ? `<details><summary>再看 ${late.length - 5} 条</summary><ul class="actions">${late.slice(5).map(lateRow).join('')}</ul></details>` : ''}</section>` : ''}
    <section class="block"><div class="h-row"><h2 class="h2">即将截止</h2><a class="link" href="#/jobs?tags=soon">全部${icon('right', 16)}</a></div>
      ${soonList.length ? `<div class="hscroll soon">${soonList.map((v) => `<a class="mini" href="#/jobs/${v.id}"><strong>${esc(v.company)}</strong><span>${esc(v.title)}</span><div>${dlChip(v)}${verdictBadge(v)}</div></a>`).join('')}</div>` : `<p class="muted">${SOON_DAYS} 天内没有要截止的岗位。</p>`}
    </section>
    ${!isMe() && noDate.length + noDeadline.length ? `<section class="block"><h2 class="h2">日期待规范</h2><div class="note-panel">${icon('info', 18)}<div>${noDeadline.length ? `<p>${noDeadline.length} 条投递的岗位截止日还没公布，建议去官网确认：</p><ul class="plain">${noDeadline.slice(0, 4).map((x) => `<li><a href="#/jobs/${x.v.id}">${esc(x.a.company)} · ${esc(x.a.role)}</a></li>`).join('')}</ul>` : ''}${noDate.length ? `<p>${noDate.length} 条投递还没有下一步日期。</p>` : ''}</div></div></section>` : ''}`;
  },
};
act('t-end', async (el) => { if ((await moveApp(el.dataset.id, '结束')) !== false) toast('已移到「结束」'); rerender(); });
act('t-done', (el) => { const k = el.dataset.key; S.done[k] = !S.done[k]; persist(); rerender(); });
