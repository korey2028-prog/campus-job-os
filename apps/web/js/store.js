// 数据与状态：所有"能不能投 / 截止 / 可信度 / 去重"都调用 lib/ 里由领域代码转出的函数
import { parseGradWindow } from '../lib/grad.js';
import { parseDeadline, isExpired } from '../lib/deadline.js';
import { checkEligibility } from '../lib/eligibility.js';
import { confidence } from '../lib/confidence.js';
import { positionKey } from '../lib/dedupe.js';
import { mapStage } from '../lib/stage.js';
import { rankPosition } from '../lib/rank.js';
import { safeGet, safeSet, safeDel, diffDays, addDays, toast } from './util.js';

let KEY = 'jobos.demo.v1';
export const isMe = () => S.data?.meta?.mode === 'me';
export const COLS = ['想投', '准备中', '已投递', '笔试面试', '结束'];
export const S = {
  data: null, today: '2026-10-27',
  profile: null, onboarded: false,
  favs: [], appsAdded: [], moves: {}, verified: {}, added: [], done: {}, factOk: {}, feedback: [], events: [],
  storageOk: true,
};
let cache = null;

export async function load() {
  const res = await fetch('data/demo.json', { cache: 'no-store' });
  S.data = await res.json();
  S.today = S.data.meta.today;
  S.profile = { ...S.data.profile };
  if (isMe()) { KEY = 'jobos.me.v1'; S.onboarded = true; }
  try {
    const raw = safeGet(KEY);
    if (raw) {
      const o = JSON.parse(raw);
      // 个人模式的画像、投递来自本机文件，不读浏览器里的旧值
      const skip = isMe() ? ['onboarded', 'profile', 'appsAdded', 'moves'] : [];
      for (const k of ['onboarded', 'profile', 'favs', 'appsAdded', 'moves', 'verified', 'added', 'done', 'factOk', 'feedback', 'events']) if (o[k] !== undefined && !skip.includes(k)) S[k] = o[k];
    }
  } catch { /* 读不到时按默认值 */ }
  S.storageOk = safeSet(KEY + '.probe', '1');
  safeDel(KEY + '.probe');
  build();
}

// 个人模式：写回后重新拉台账和画像
export async function reloadData() {
  const res = await fetch('data/demo.json', { cache: 'no-store' });
  S.data = await res.json();
  S.today = S.data.meta.today;
  S.profile = { ...S.data.profile };
  build();
}
async function post(url, body) {
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  } catch { return { status: 0, body: {} }; }
}
const LEDGER_FIELDS = (a) => ({ stage: a.stageRaw ?? '', next_action: a.nextAction ?? '', next_action_date: a.nextActionDate ?? '', notes: a.notes ?? '' });
// 返回 true 表示已写入；409 说明台账在别处被改过，刷新后返回 false
async function ledgerPatch(localId, patch) {
  const a = S.data.applications.find((x) => x.localId === localId);
  if (!a) return false;
  const before = LEDGER_FIELDS(a);
  const r = await post(`/api/ledger/${encodeURIComponent(localId)}`, { before, after: { ...before, ...patch } });
  if (r.status === 409) { toast('台账在别处被改过，已刷新'); await reloadData(); return false; }
  if (r.status !== 200) { toast(`写入台账失败（${r.body.error || r.status}）`); return false; }
  await reloadData();
  return true;
}
const COL_STAGE = { 想投: '未核验', 准备中: '官网已核；未提交', 已投递: '已投递（用户确认）', 笔试面试: '笔试面试中', 结束: '本人决定不投' };

export function persist() {
  const { onboarded, profile, favs, appsAdded, moves, verified, added, done, factOk, feedback, events } = S;
  safeSet(KEY, JSON.stringify({ onboarded, profile, favs, appsAdded, moves, verified, added, done, factOk, feedback, events }));
}
export function resetAll() { safeDel(KEY); S.profile = { ...S.data.profile }; S.onboarded = false; S.favs = []; S.appsAdded = []; S.moves = {}; S.verified = {}; S.added = []; S.done = {}; S.factOk = {}; S.feedback = []; S.events = []; build(); }
export function invalidate() { build(); }

const OWN_GROUP = (o) => (o === '合资' || o === '外企' ? '外企' : o === '事业单位' || o === '其他' ? '其他' : o);
export { OWN_GROUP };

// 个人模式的数据为了体积省掉了空字段，这里补默认值（演示数据字段齐全，不受影响）
const ROW_DEFAULTS = { conflicts: [], risk: null, degrees: [], downwardCompatible: true, majors: [], tier: false, internship: false, batch: '' };
function toVM(r0, { archive = false } = {}) {
  const r = { ...ROW_DEFAULTS, ...r0 };
  const grad = r.cohortDoubt ? null : parseGradWindow(r.gradRaw);
  const deadline = parseDeadline(r.deadlineRaw, archive ? 2025 : 2026);
  const domain = { company: r.company, title: r.title, batch: r.batch, gradWindow: grad, minDegree: r.minDegree, downwardCompatible: r.downwardCompatible, degrees: r.degrees, majors: r.majors, cities: r.cities, deadline };
  return { ...r, archive, grad, deadline, domain, key: positionKey(r.company, r.title, r.batch, grad), sources: [], postingIds: [r.postingId] };
}

function build() {
  const d = S.data;
  const postById = new Map(d.postings.map((p) => [p.id, p]));
  const rows = [...d.positions.map((r) => toVM(r)), ...S.added.map((r) => ({ ...toVM(r), mine: true }))];
  const groups = new Map();
  for (const v of rows) { if (!groups.has(v.key)) groups.set(v.key, []); groups.get(v.key).push(v); }
  const list = [];
  const dupGroups = [];
  for (const g of groups.values()) {
    const p = g[0];
    const seen = new Set();
    for (const v of g) {
      const post = postById.get(v.postingId);
      for (const s of post?.sources ?? v.userSources ?? []) if (!seen.has(s.url)) { seen.add(s.url); p.sources.push({ ...s, company: v.company }); }
      if (v !== p) { p.postingIds.push(v.postingId); if (v.updatedAt > p.updatedAt) p.updatedAt = v.updatedAt; }
    }
    p.merged = g.length;
    if (g.length > 1) dupGroups.push(g);
    list.push(p);
  }
  for (const v of list) decorate(v, postById.get(v.postingId));
  const arch = d.archive.map((r) => toVM(r, { archive: true }));
  for (const v of arch) { v.sources = []; v.conf = null; v.elig = null; v.expired = true; v.daysLeft = null; }
  cache = { list, byId: new Map([...list, ...arch].map((v) => [v.id, v])), arch, dupGroups, rawCount: rows.length, postById };
}

// 个人模式的岗位不带逐字段出处（文件太大），按公告和记录 ID 现场拼
const PROV_FIELDS = ['grad_window', 'degree', 'deadline', 'majors', 'cities'];
export const provOf = (v) => v.provenance ?? PROV_FIELDS.map((field) => ({ field, method: '第三方数据包', source: v.sources[0]?.url || '', record_id: v.recordId, obtained_at: v.updatedAt, verified_at: null }));

function decorate(v, post) {
  const ver = S.verified[v.id];
  if (!v.applyUrl && post?.sources?.length) v.applyUrl = post.sources.at(-1).url;
  if (post?.scored) {
    // 个人模式：直接用可信度先验表里的等级
    const sc = post.scored;
    v.conf = { source: sc.source, field: sc.field, freshness: sc.freshness, overall: sc.overall, measured: !!ver, label: ver ? sc.overall : `${sc.overall}（未实测）`, basis: sc.basis };
  } else {
    const prov = v.provenance.map((p) => (ver ? { ...p, verified_at: ver } : p));
    v.conf = confidence({
      sourceUrls: v.sources.map((s) => s.url), provenance: prov,
      sourceTimes: [post?.sourceUpdatedAt ?? v.updatedAt, post?.lastVerifiedAt ?? null], deadline: v.deadline, gradWindow: v.grad, now: S.today,
    });
  }
  v.userVerified = ver || null;
  v.elig = checkEligibility(v.domain, profileForDomain(), S.today);
  v.expired = isExpired(v.deadline, S.today);
  // 排序档位只在个人模式用（需要方向和城市偏好）
  v.rank = isMe() ? rankPosition({ ...v.domain, roles: v.roles, ownership: v.ownership, industry: v.industry, verdict: v.elig.verdict, confidence: v.conf.overall }, S.profile, S.today) : null;
  v.daysLeft = v.deadline.kind === 'date' ? diffDays(v.deadline.date, S.today) : null;
}
const profileForDomain = () => ({ gradDate: S.profile.gradDate, degree: S.profile.degree, major: S.profile.major || undefined });
export function refresh() { build(); }

export const positions = () => cache.list;
export const archive = () => cache.arch;
export const dupGroups = () => cache.dupGroups;
export const rawCount = () => cache.rawCount;
export const getPos = (id) => cache.byId.get(Number(id));
export const siblings = (v) => cache.list.filter((x) => x.postingIds.some((p) => v.postingIds.includes(p)) && x.id !== v.id);

export function dlText(v) {
  if (v.archive) return v.deadline.kind === 'date' ? `截止 ${v.deadline.date}` : '未公布';
  if (v.deadline.kind === 'rolling') return '招满即止';
  if (v.deadline.kind === 'unknown') return '未公布';
  const n = v.daysLeft;
  if (n < 0) return `已截止 ${-n} 天`;
  if (n === 0) return '今天截止';
  return `还剩 ${n} 天`;
}
export const dlUrgent = (v) => v.daysLeft != null && v.daysLeft >= 0 && v.daysLeft <= 7;

const VR = { 可投: 0, 待确认: 1, 不可投: 2 };
const TIER_ORDER = { A: 0, B: 1, C: 2 };
// 个人模式：命中方向的岗位名排在标题最前面
export function displayTitle(v) {
  const m = isMe() ? v.rank?.matched : null;
  if (!m?.length || !v.roles) return v.title;
  return v.roles.length > m.length ? `${m.join('、')} 等 ${v.roles.length} 个岗位` : m.join('、');
}
export const defaultSort = () => (isMe() ? 'rec' : 'rel');
export function sortJobs(list, mode) {
  const a = [...list];
  if (mode === 'rec') {
    const dk = (v) => (v.deadline.kind === 'date' ? v.daysLeft : v.deadline.kind === 'rolling' ? 900 : 999);
    const tk = (v) => TIER_ORDER[v.rank?.tier] ?? 3;
    return a.sort((x, y) => (tk(x) - tk(y)) || (dk(x) - dk(y)) || (y.updatedAt > x.updatedAt ? 1 : y.updatedAt < x.updatedAt ? -1 : 0) || x.id - y.id);
  }
  if (mode === 'new') return a.sort((x, y) => (y.updatedAt > x.updatedAt ? 1 : y.updatedAt < x.updatedAt ? -1 : x.id - y.id));
  const dk = (v) => (v.deadline.kind === 'date' ? v.daysLeft : v.deadline.kind === 'rolling' ? 900 : 999);
  return a.sort((x, y) => (VR[x.elig.verdict] - VR[y.elig.verdict]) || (dk(x) - dk(y)) || (y.updatedAt > x.updatedAt ? 1 : -1) || x.id - y.id);
}

// ---------- 筛选 ----------
// 即将截止统一 7 天（和排序里的 URGENT_DAYS 一致）
export const SOON_DAYS = 7;
export const TAGS = [
  { id: 'can', label: '我能投', f: (v) => v.elig.verdict === '可投' },
  { id: 'free', label: '免笔试', f: (v) => v.writtenTest === '免' },
  // 个人模式的数据里空专业是“没写”，只有明确标了不限专业的才算
  { id: 'open', label: '不限专业', f: (v) => (isMe() ? v.majors.includes('不限专业') : v.majors.length === 0 || v.majors.includes('不限专业')) },
  { id: 'soon', label: '即将截止', f: (v) => v.daysLeft != null && v.daysLeft >= 0 && v.daysLeft <= SOON_DAYS },
  { id: 'soe', label: '央国企', own: ['央国企'] },
  { id: 'foreign', label: '外企', own: ['外企', '合资'] },
  { id: 'big', label: '大厂', f: (v) => v.industry === '互联网/科技' },
  { id: 'bank', label: '银行', own: ['银行'] },
  { id: 'intern', label: '实习', f: (v) => v.internship },
  { id: 'multi', label: '全国多地', f: (v) => v.cities.includes('全国多地') },
];
// 一键直投：投递链接指向招聘系统页（不是公众号文章、问卷或文档），只按域名判断
export const ATS_HOST = /(mokahr|hotjob|zhiye|51job|zhaopin|iguopin|liepin|italent|beisen|dayee|yingjiesheng|zhipin)/;
const hostOf = (u) => { try { return new URL(u).hostname.toLowerCase(); } catch { return ''; } };
// 省事筛选：只用数据里有的字段。has 返回 false（字段整体缺失）时不显示
export const EASY_TAGS = [
  { id: 'free', label: '免笔试', f: (v) => v.writtenTest === '免' },
  { id: 'partial', label: '部分免笔试', f: (v) => v.writtenTest === '部分', has: (l) => l.some((v) => v.writtenTest === '部分') },
  { id: 'freeany', label: '免笔试（含部分）', f: (v) => v.writtenTest === '免' || v.writtenTest === '部分' },
  { id: 'open', label: '不限专业', f: (v) => v.majors.includes('不限专业') },
  { id: 'lowdeg', label: '学历不限 / 大专可投', f: (v) => !v.minDegree || v.minDegree === '大专' },
  { id: 'soon7', label: '7 天内截止', f: (v) => v.daysLeft != null && v.daysLeft >= 0 && v.daysLeft <= SOON_DAYS },
  { id: 'dlunk', label: '截止日不明', f: (v) => v.deadline.kind === 'unknown' },
  { id: 'famous', label: '知名企业', f: (v) => v.tier },
  { id: 'intern', label: '实习', f: (v) => v.internship },
  { id: 'fall', label: '秋招', f: (v) => /秋招/.test(v.batch), has: (l) => l.some((v) => /秋招/.test(v.batch)) },
  { id: 'spring', label: '春招', f: (v) => /春招/.test(v.batch), has: (l) => l.some((v) => /春招/.test(v.batch)) },
  { id: 'direct', label: '一键直投', f: (v) => !!v.applyUrl && ATS_HOST.test(hostOf(v.applyUrl)), has: (l) => l.some((v) => v.applyUrl) },
];
export const easyTags = () => EASY_TAGS.filter((t) => !t.has || t.has(cache.list));
// 省事组合 = 能投 + 免笔试或部分免笔试 + 截止未过（已截止默认隐藏）
export const EASY_COMBO = ['can', 'freeany'];
// 碰运气 = 省事组合 + 7 天内截止：门槛低、马上截止，投一下试试
export const LUCK_COMBO = [...EASY_COMBO, 'soon7'];
export const EXTRA_TAGS = [
  { id: 'famous', label: '名企', f: (v) => v.tier },
  { id: 'past', label: '往届生可投', f: (v) => v.grad && v.grad.to < S.profile.gradDate && v.grad.from < '2026-09' },
  { id: 'verify', label: '待核验', f: (v) => v.conf.overall === '低' && !v.userVerified },
  { id: 'pending', label: '待确认', f: (v) => v.elig.verdict === '待确认' },
];
const ALLTAGS = [...TAGS, ...EXTRA_TAGS, ...EASY_TAGS.filter((t) => !TAGS.some((x) => x.id === t.id) && !EXTRA_TAGS.some((x) => x.id === t.id))];
// 原站 16 个视图 → 预设筛选
export const PRESETS = [
  { name: '倒计时', was: '倒计时 / 倒计时', q: { tags: 'soon', sort: 'due' } },
  { name: '免笔试', was: '免笔试', q: { tags: 'free' } },
  { name: '免笔试 · 名企', was: '免笔', q: { tags: 'free,famous' } },
  { name: '互联网', was: '互联网', q: { tags: 'big' } },
  { name: '央国企 / 银行 / 事业单位', was: '国企/银行', q: { own: '央国企,银行,事业单位' } },
  { name: '外企', was: '外企', q: { tags: 'foreign' } },
  { name: '实习', was: '实习', q: { tags: 'intern' } },
  { name: '不限专业', was: '不限专业', q: { tags: 'open' } },
  { name: '全国多地', was: 'Base全国', q: { tags: 'multi' } },
  { name: '名企', was: '名企', q: { tags: 'famous' } },
  { name: '往届生可投', was: '往届 / 25/26届', q: { tags: 'past', expired: '1' } },
  { name: '全部（含已截止）', was: '汇总', q: { expired: '1' } },
  { name: '待核验', was: '录入', q: { tags: 'verify' } },
];

export function parseFilters(params) {
  const g = (k) => params.get(k) || '';
  return {
    q: g('q'), tags: new Set(g('tags').split(',').filter(Boolean)), own: new Set(g('own').split(',').filter(Boolean)),
    ind: g('ind'), city: g('city'), sort: g('sort') || defaultSort(), expired: g('expired') === '1', risk: g('risk') === 'show', mine: g('mine') === '1',
  };
}
export function filtersToParams(f) {
  const p = new URLSearchParams();
  if (f.q) p.set('q', f.q);
  if (f.tags.size) p.set('tags', [...f.tags].join(','));
  if (f.own.size) p.set('own', [...f.own].join(','));
  if (f.ind) p.set('ind', f.ind);
  if (f.city) p.set('city', f.city);
  if (f.sort && f.sort !== defaultSort()) p.set('sort', f.sort);
  if (f.expired) p.set('expired', '1');
  if (f.risk) p.set('risk', 'show');
  if (f.mine) p.set('mine', '1');
  return p;
}
const ownSet = (f) => {
  const s = new Set(f.own);
  for (const t of TAGS) if (t.own && f.tags.has(t.id)) t.own.forEach((o) => s.add(o));
  return s;
};
export function matchBase(v, f) {
  if (!f.expired && v.expired) return false;
  if (!f.risk && v.risk) return false;
  if (f.mine && !v.mine) return false;
  if (f.q) {
    const q = f.q.trim().toLowerCase();
    const hay = (v.company + v.title + (v.roles || []).join('') + v.industry + v.majors.join('') + v.cities.join('') + v.batch).toLowerCase();
    if (!q.split(/\s+/).every((w) => hay.includes(w))) return false;
  }
  if (f.ind && v.industry !== f.ind) return false;
  // 选“远程”时不算全国多地，那是线下多城市
  if (f.city && !v.cities.includes(f.city) && !(f.city !== '远程' && v.cities.includes('全国多地'))) return false;
  return true;
}
export function matchTags(v, f, skip) {
  for (const id of f.tags) {
    if (id === skip) continue;
    const t = ALLTAGS.find((x) => x.id === id);
    if (t?.f && !t.f(v)) return false;
  }
  const os = ownSet(f);
  if (os.size && !(skip && TAGS.find((t) => t.id === skip)?.own) && !os.has(v.ownership)) return false;
  return true;
}
export const filterJobs = (list, f) => list.filter((v) => matchBase(v, f) && matchTags(v, f));
export function tagCount(list, f, tag) {
  const t = ALLTAGS.find((x) => x.id === tag);
  return list.filter((v) => {
    if (!matchBase(v, f)) return false;
    if (t.f && !t.f(v)) return false;
    if (t.own && !t.own.includes(v.ownership)) return false;
    return matchTags(v, f, tag);
  }).length;
}

// ---------- 画像 / 收藏 / 核验 ----------
export function setProfile(p) {
  S.profile = { ...S.profile, ...p }; persist(); build();
  if (isMe()) post('/api/profile', p).then((r) => { if (r.status !== 200) toast('画像没有写入文件'); });
}
export function recordEvent(kind, label, meta = {}) {
  S.events.unshift({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, at: S.today, kind, label, meta });
  S.events = S.events.slice(0, 200);
  persist();
}
export function importState(input) {
  if (!input || typeof input !== 'object') throw new Error('文件不是 JSON 对象');
  const keys = ['profile', 'favs', 'appsAdded', 'moves', 'verified', 'added', 'done', 'factOk', 'feedback', 'events'];
  for (const k of keys) if (input[k] !== undefined) S[k] = input[k];
  if (!S.profile || typeof S.profile !== 'object' || !S.profile.gradDate || !S.profile.degree) throw new Error('缺少有效画像');
  S.events = Array.isArray(S.events) ? S.events.slice(0, 200) : [];
  persist(); build();
}
export function toggleFav(id) { const i = S.favs.indexOf(id); if (i >= 0) S.favs.splice(i, 1); else S.favs.push(id); recordEvent('favorite', i >= 0 ? '取消收藏岗位' : '收藏岗位', { positionId: id }); return i < 0; }
export const isFav = (id) => S.favs.includes(id);
export function verify(id) { if (S.verified[id]) { delete S.verified[id]; recordEvent('verify', '撤销岗位核验', { positionId: id }); } else { S.verified[id] = S.today; recordEvent('verify', '完成岗位核验', { positionId: id }); } build(); return !!S.verified[id]; }

// ---------- 投递 ----------
// 台账里的下一步常是写给 Agent 的流程话（“本人…”“否则归档”），页面上只显示人话；台账原文不动
export function humanNext(t, col, linked = false) {
  let s = String(t ?? '').trim();
  if (!s || s === '—') return '';
  if (col === '结束' || /^(归档|停止本轮投递|归档，不继续投入)$/.test(s)) return '';
  // 已关联到表里这家的在招公告时，直接点开看
  if (/官网搜索.*找不到则归档|是否改投核验记录中的在线岗位/.test(s)) return linked ? '这家在招，点开看能不能改投' : /官网搜索/.test(s) ? '去官网找这个岗位' : '看要不要改投还在招的岗位';
  s = s.replace(/^需本人确认[:：]\s*/, '').replace(/^本人/, '').replace(/[；;，,]\s*(否则|找不到则)归档$/, '');
  return s;
}
export function appsAll() { return [...S.data.applications, ...S.appsAdded].map((a) => ({ ...a, stage: mapStage(a.stageRaw) })); }
export function colOf(a) {
  if (S.moves[a.localId]) return S.moves[a.localId];
  switch (a.stage.enum) {
    case 'preparing': case 'drafted': return '准备中';
    case 'submitted': case 'offline_received': return '已投递';
    case 'interviewing': return '笔试面试';
    case 'stopped': case 'closed_source': return '结束';
    default: return '想投';
  }
}
export const appFor = (posId) => appsAll().find((a) => a.positionId === posId);
export async function addApp(v) {
  const ex = appFor(v.id);
  if (ex) return ex;
  if (isMe()) {
    const r = await post('/api/ledger', { company: v.company, role: v.title, official_url: v.applyUrl || '', next_action: '看公告并确认要求', next_action_date: addDays(S.today, 2) });
    if (r.status !== 200) { toast(`写入台账失败（${r.body.error || r.status}）`); return null; }
    await reloadData();
    return appFor(v.id) || appsAll().find((a) => a.localId === r.body.local_id);
  }
  const n = S.data.applications.length + S.appsAdded.length + 1;
  const a = { localId: `A-${String(n).padStart(2, '0')}`, positionId: v.id, company: v.company, role: v.title, stageRaw: '想投', nextAction: '看公告并确认要求', nextActionDate: addDays(S.today, 2), lastEventAt: S.today, notes: '' };
  S.appsAdded.push(a); recordEvent('application', '加入投递台账', { localId: a.localId, positionId: v.id, stage: '想投' });
  return a;
}
export async function updateApp(localId, patch) {
  if (isMe()) {
    const p = {};
    if (patch.nextAction !== undefined) p.next_action = String(patch.nextAction ?? '').trim();
    if (patch.nextActionDate !== undefined) p.next_action_date = String(patch.nextActionDate ?? '').trim();
    if (patch.notes !== undefined) p.notes = String(patch.notes ?? '').trim();
    return ledgerPatch(localId, p);
  }
  const all = [...S.data.applications, ...S.appsAdded].find((a) => a.localId === localId);
  if (!all) return false;
  const allowed = ['nextAction', 'nextActionDate', 'notes'];
  for (const k of allowed) if (patch[k] !== undefined) all[k] = String(patch[k] ?? '').trim();
  all.lastEventAt = S.today;
  recordEvent('application', '更新投递下一步', { localId, nextAction: all.nextAction, nextActionDate: all.nextActionDate });
  return true;
}
export async function moveApp(localId, col) {
  if (isMe()) {
    const a = appsAll().find((x) => x.localId === localId);
    if (!a || colOf(a) === col) return true;
    return ledgerPatch(localId, { stage: COL_STAGE[col] });
  }
  S.moves[localId] = col; const all = [...S.data.applications, ...S.appsAdded].find((a) => a.localId === localId); if (all) all.lastEventAt = S.today; recordEvent('application', `投递状态移到「${col}」`, { localId, stage: col }); }

// ---------- 我添加的岗位 ----------
export function addUserPosition({ company, title, url, gradRaw, deadlineRaw, degree, majors, autoFields }) {
  const id = 9000 + S.added.length + 1;
  const m = (f) => (autoFields.includes(f) ? '规则解析' : '人工录入');
  const prov = ['grad_window', 'degree', 'deadline', 'majors', 'cities'].map((f) => ({ field: f, method: m(f), source: url || '', obtained_at: S.today, verified_at: null }));
  S.added.push({
    id, postingId: -id, company, title, batch: '我添加的', gradRaw, minDegree: degree, downwardCompatible: true, degrees: [], majors, cities: ['未填写'],
    deadlineRaw, industry: '未分类', ownership: '其他', writtenTest: '需', tier: false, internship: /实习/.test(title), updatedAt: S.today,
    provenance: prov, conflicts: [], risk: null, applyUrl: url || '', userSources: url ? [{ url, kind: '我添加的链接' }] : [], note: '',
  });
  recordEvent('position', '添加岗位', { positionId: id, company, title }); build();
  return id;
}
export const summary = () => {
  const l = cache.list.filter((v) => !v.expired && !v.risk);
  return { can: l.filter((v) => v.elig.verdict === '可投').length, maybe: l.filter((v) => v.elig.verdict === '待确认').length };
};
