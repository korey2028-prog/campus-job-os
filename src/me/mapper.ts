// 个人模式的映射层：第三方数据包 / 台账 / 事实底稿 → 网页读的数据结构（形状与 demo.json 一致）
import { parseGradWindow } from '../domain/grad.ts';
import { parseDeadline, isExpired } from '../domain/deadline.ts';
import { normalizeCompany } from '../domain/dedupe.ts';
import { parseCsvRecords } from '../import/csv.ts';
import { normalizeCities } from './cities.ts';

const OPEN = '[（(【\\[]';
const CLOSE = '[）)】\\]]';

// 岗位列表是第三方手填的文本：按顿号、逗号、分号、空白切开，括号里的不切
export function splitRoles(input: string | null | undefined): string[] {
  const s = (input ?? '').trim();
  if (!s) return [];
  const cut = (text: string, respectBrackets: boolean): string[] => {
    const out: string[] = [];
    let depth = 0, cur = '';
    for (const ch of text) {
      if (respectBrackets && new RegExp(OPEN).test(ch)) depth++;
      else if (respectBrackets && new RegExp(CLOSE).test(ch)) depth = Math.max(0, depth - 1);
      if (depth === 0 && /[、，,；;\s\n]/.test(ch)) { out.push(cur); cur = ''; } else cur += ch;
    }
    out.push(cur);
    if (respectBrackets && depth > 0) return cut(text, false);
    return out;
  };
  const seen = new Set<string>();
  const res: string[] = [];
  for (const raw of cut(s, true)) {
    let t = raw.trim().replace(/^[\d①-⑩]+[.、)）]\s*/, '').replace(/^[^：:（(]{1,8}[：:]/, '').replace(/[.。;；:：,，、\s]+$/, '').trim();
    if (t.length < 2 || /^[\p{P}\s]+$/u.test(t)) continue;
    if (seen.has(t)) continue;
    seen.add(t); res.push(t);
  }
  return res;
}

// 届别：含 27 届或写了不限届的保留
export function keepsCohort27(cohorts: string | null | undefined): boolean {
  const s = (cohorts ?? '').trim();
  if (!s) return false;
  if (/不限/.test(s)) return true;
  if (!s.includes('届')) return false;
  return [...s.matchAll(/(\d{4}|\d{2})/g)].some((m) => Number(m[1]) === 27 || Number(m[1]) === 2027);
}

const OWNERS = new Set(['民企', '央国企', '事业单位', '外企', '银行', '合资']);
const DEGREES = ['大专', '本科', '硕士', '博士'] as const;
const hostOf = (u: string) => { try { return new URL(u).hostname.toLowerCase(); } catch { return ''; } };
// 源表里混进过 prompt 残留（如“请提供需要判断所属行业的完整企业名称。”），一律当未分类
export const INDUSTRY_JUNK = /请提供|所属行业|企业名称|完整|需要判断|无法判断|未知|待补充/;
const industryOf = (s: string | null) => (!s || INDUSTRY_JUNK.test(s) ? '未分类' : /IT|互联网/.test(s) ? '互联网/科技' : s);
const localDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export { localDate };

// 飞书多选/文本单元格 → 字符串；链接是 markdown [文字](url)
const text = (v: unknown): string => (Array.isArray(v) ? String(v[0] ?? '') : v == null ? '' : String(v)).trim();
export const linkOf = (v: unknown): string => text(v).match(/\]\(([^\s)]+)/)?.[1] ?? '';

export type Scored = { source: string; field: string; freshness: string; overall: string; basis: string };
export type R27Input = { fields: string[]; rows: unknown[][]; ids: string[]; scored: Record<string, string>[] };
export type MapOpts = { today: string; readAt: string; positionIdStart?: number };
export type MapResult = { postings: any[]; positions: any[]; archive: any[]; stats: { records: number; template: number; kept: number; otherCohort: number; doubt: number; roles: number } };

export function mapR27(input: R27Input, opts: MapOpts): MapResult {
  const { fields, rows, ids, scored } = input;
  const col = Object.fromEntries(fields.map((f, i) => [f, i]));
  const sc = new Map(scored.map((r) => [r.record_id, r]));
  const postings: any[] = [], positions: any[] = [], archive: any[] = [];
  let postId = 1, posId = opts.positionIdStart ?? 100000;
  const stats = { records: rows.length, template: 0, kept: 0, otherCohort: 0, doubt: 0, roles: 0 };
  rows.forEach((row, n) => {
    const g = (name: string) => row[col[name]];
    const rid = ids[n];
    const s = sc.get(rid);
    if (s?.template === '1' || String(g('岗位ID') ?? '').startsWith('2026070300')) { stats.template++; return; }
    const cohort = text(g('届次'));
    const is27 = keepsCohort27(cohort);
    // 届次不含 27 但招聘类型写的是 27届秋招：未过期的留在当前列表，标“届次存疑”，可信度强制为低
    const doubt = !is27 && /27届秋招/.test(text(g('招聘类型')));
    if (is27) stats.kept++; else if (doubt) stats.doubt++; else stats.otherCohort++;
    const company = text(g('公司名称'));
    const batch = text(g('招聘类型'));
    const notice = linkOf(g('校招公告')), channel = linkOf(g('投递 渠道')) || linkOf(g('投递渠道1'));
    const sources = [...new Set([notice, channel].filter(Boolean))].map((url) => ({ url, kind: url === notice ? (hostOf(url) === 'mp.weixin.qq.com' ? '公众号推文' : '招聘公告') : '投递入口' }));
    const updated = text(g('更新日期')).slice(0, 10);
    const id = postId++;
    postings.push({
      id, sources, sourceUpdatedAt: updated, lastVerifiedAt: null,
      scored: s ? { source: s['来源可信度'], field: s['字段可靠度'], freshness: s['时效'], overall: doubt ? '低' : s['总等级'], basis: doubt ? `届次存疑（${cohort}），先看公告；${s['依据']}` : s['依据'] } : null,
    });
    const deadlineRaw = text(g('截止时间'));
    const expired = (!is27 && !doubt) || isExpired(parseDeadline(deadlineRaw, 2026), opts.today);
    const deg = DEGREES.find((d) => text(g('学历')).includes(d));
    const cities = normalizeCities(text(g('工作地')));
    const owner = text(g('企业性质'));
    // 一行原表 = 一个岗位；可投岗位列表拆成 roles，只用来搜索和匹配方向
    const roles = splitRoles(text(g('可投岗位'))).slice(0, 40);
    stats.roles += roles.length;
    const title = roles.length === 0 ? '岗位未列明' : roles.length <= 3 ? roles.join('、') : `${roles.slice(0, 3).join('、')} 等 ${roles.length} 个岗位`;
    const out: any = {
      id: posId++, postingId: id, recordId: rid, company, title, roles, gradRaw: cohort, deadlineRaw,
      cities: cities.length ? cities : ['未填写'], industry: industryOf(text(g('所属行业'))), ownership: OWNERS.has(owner) ? owner : '其他',
      writtenTest: g('免笔试') === true ? '免' : g('部分岗位免笔试') === true ? '部分' : g('免笔试') === false ? '需' : '未知',
      updatedAt: updated,
    };
    if (batch) out.batch = batch; else out.batch = '';
    if (deg) out.minDegree = deg;
    if (g('不限专业') === true) out.majors = ['不限专业'];
    if (g('知名企业') === true) out.tier = true;
    if (/实习/.test(batch)) out.internship = true;
    if (doubt) out.cohortDoubt = true;
    (expired ? archive : positions).push(out);
  });
  return { postings, positions, archive, stats };
}

// ---------- 台账 ----------
export type LedgerRow = Record<string, string>;
export function parseLedger(text: string): LedgerRow[] {
  return parseCsvRecords(text).filter((r) => r.local_id);
}

type PosLike = { id: number; company: string; title: string; applyUrl?: string };
export function applicationsFromLedger(rows: LedgerRow[], positions: PosLike[]) {
  const byName = new Map<string, number>();
  const byUrl = new Map<string, number | null>();
  for (const p of positions) {
    const k = `${normalizeCompany(p.company)}|${p.title.trim()}`;
    if (!byName.has(k)) byName.set(k, p.id);
    if (p.applyUrl) byUrl.set(p.applyUrl, byUrl.has(p.applyUrl) ? null : p.id);
  }
  return rows.map((r) => {
    const positionId = byName.get(`${normalizeCompany(r.company)}|${(r.role ?? '').trim()}`) ?? (r.official_url ? byUrl.get(r.official_url) ?? null : null);
    return {
      localId: r.local_id, positionId, company: r.company, role: r.role, officialUrl: r.official_url, stageRaw: r.stage,
      nextAction: r.next_action, nextActionDate: r.next_action_date, lastEventAt: r.last_event_at, notes: r.notes,
      resumePath: r.resume_path, jdCheckedAt: r.jd_checked_at, hardConditions: r.hard_conditions,
    };
  });
}
export const resumeFilesFromLedger = (rows: LedgerRow[]) =>
  rows.filter((r) => r.resume_path).map((r) => ({ localId: r.local_id, company: r.company, role: r.role, path: r.resume_path }));

// ---------- 事实底稿 ----------
export function parseFacts(md: string) {
  const lines = md.split(/\r?\n/);
  const facts: any[] = [], factFixes: any[] = [], factGaps: any[] = [];
  for (const l of lines) {
    if (!/^\|\s*F\d+\s*\|/.test(l)) continue;
    const c = l.split('|').slice(1, -1).map((x) => x.trim());
    const title = c[1].split(/[，；]/)[0].slice(0, 28);
    facts.push({ id: c[0], title, role: '—', stage: '—', detail: c[1], source: c[2], boundary: c[3] ?? '', status: '已确认', confirmedAt: null });
  }
  let date: string | null = null, inGaps = false;
  for (const l of lines) {
    const h = l.match(/^##\s+(.*)$/);
    if (h) {
      const m = h[1].match(/^(\d{4}-\d{2}-\d{2})\s*本人/);
      date = m ? m[1] : null;
      inGaps = /补证清单/.test(h[1]);
      continue;
    }
    if (date) {
      const b = l.match(/^-\s+(.*)$/);
      if (b) factFixes.push({ id: `C-${String(factFixes.length + 1).padStart(2, '0')}`, date, text: b[1].trim(), by: '本人' });
    } else if (inGaps) {
      const g = l.match(/^\d+\.\s+(.*)$/);
      if (g) factGaps.push({ id: `G-${String(factGaps.length + 1).padStart(2, '0')}`, text: g[1].trim(), suggest: '' });
    }
  }
  return { facts, factFixes, factGaps };
}

export const CHANNELS = [
  { type: '企业官网', items: [{ name: '企业招聘官网', fit: '最准确的岗位与截止日，投递也在这里完成' }, { name: '企业校招专题页', fit: '看批次安排与宣讲会时间' }] },
  { type: '招聘系统', items: [{ name: '企业使用的招聘系统入口', fit: '一次登录可投同系统的多家企业' }, { name: '校招直通入口', fit: '部分企业会在这里先放出提前批' }] },
  { type: '公众号', items: [{ name: '企业校招公众号', fit: '第一时间看到公告与笔试通知' }, { name: '学校就业公众号', fit: '往往带有校友内推与专场宣讲' }] },
  { type: '政府与国资委', items: [{ name: '地方人社局与国资委公告', fit: '国企、事业单位的统一招聘' }, { name: '公务员与事业单位考试网站', fit: '报名时间固定，别错过' }] },
  { type: '高校就业网', items: [{ name: '本校就业信息网', fit: '企业直发的专场岗位，竞争相对少' }, { name: '兄弟院校就业网', fit: '部分对外开放，可看到更多公告' }] },
];

// 台账里公司/岗位名和表里对不上的，按 private/ledger-links.json（local_id → 飞书记录 ID）补关联；生成和实时读取共用
export function applyLedgerLinks<T extends { localId: string; positionId: number | null }>(apps: T[], positions: { id: number; recordId: string }[], links: Record<string, string>): T[] {
  const byRec = new Map(positions.map((v) => [v.recordId, v.id]));
  for (const a of apps) if (!a.positionId && links[a.localId] && byRec.has(links[a.localId])) a.positionId = byRec.get(links[a.localId])!;
  return apps;
}
