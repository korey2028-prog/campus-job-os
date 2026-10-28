// 个人模式的运行时：基础数据 private/me.json + 实时读取的台账与画像；写回接口
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { applicationsFromLedger, applyLedgerLinks, resumeFilesFromLedger, parseLedger, localDate } from './mapper.ts';
import { updateRow, addRow, backupFile, LedgerError } from '../ledger/writer.ts';

export type MePaths = { ledger: string; profile: string; data: string; facts: string; r27: string; scored: string; links: string; idMap: string };

export function mePaths(root: string, env: Record<string, string | undefined> = process.env): MePaths {
  const career = join(root, '..', 'career-workflow');
  // 每日同步（scripts/sync-feishu.py）把 _latest 指向最新一份导出；还没同步过就用首次导出
  const priv = join(root, '..', 'data-private');
  const src = join(priv, existsSync(join(priv, 'feishu-27届校招_latest')) ? 'feishu-27届校招_latest' : 'feishu-27届校招_2026-10-27');
  return {
    ledger: env.LEDGER_PATH || join(career, '岗位台账.csv'),
    profile: env.PROFILE_PATH || join(root, 'private', 'profile.json'),
    data: env.ME_DATA_PATH || join(root, 'private', 'me.json'),
    facts: env.FACTS_PATH || join(career, '事实底稿.md'),
    r27: env.R27_DIR || join(src, 'r27'),
    scored: env.R27_SCORED || join(src, 'confidence', 'r27_scored.csv'),
    links: env.LEDGER_LINKS_PATH || join(root, 'private', 'ledger-links.json'),
    idMap: env.ID_MAP_PATH || join(root, 'private', 'id-map.json'),
  };
}

let baseCache: { mtime: number; data: any } | null = null;
function base(p: MePaths) {
  const mtime = statSync(p.data).mtimeMs;
  if (!baseCache || baseCache.mtime !== mtime) baseCache = { mtime, data: JSON.parse(readFileSync(p.data, 'utf-8')) };
  return baseCache.data;
}

export const readLinks = (p: MePaths): Record<string, string> => (existsSync(p.links) ? JSON.parse(readFileSync(p.links, 'utf-8')) : {});

// 先写临时文件再改名，服务不会读到写了一半的文件
export function writeAtomic(path: string, text: string) {
  const tmp = `${path}.tmp-${process.pid}`;
  writeFileSync(tmp, text);
  renameSync(tmp, path);
}

export function loadLive(p: MePaths, now = new Date()) {
  const d = base(p);
  const rows = parseLedger(readFileSync(p.ledger, 'utf-8'));
  const profile = JSON.parse(readFileSync(p.profile, 'utf-8'));
  return {
    ...d,
    meta: { ...d.meta, today: localDate(now) },
    profile,
    applications: applyLedgerLinks(applicationsFromLedger(rows, d.positions), d.positions, readLinks(p)),
    resumeFiles: resumeFilesFromLedger(rows),
  };
}

const DEGREES = ['大专', '本科', '硕士', '博士'];
function checkProfile(o: any) {
  if (!o || typeof o !== 'object') throw new LedgerError(400, '画像格式不对');
  const out: any = {};
  if (o.name !== undefined) out.name = String(o.name);
  if (o.major !== undefined) out.major = String(o.major);
  if (o.gradDate !== undefined) { if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(o.gradDate)) throw new LedgerError(400, '毕业时间格式应为 YYYY-MM'); out.gradDate = o.gradDate; }
  if (o.degree !== undefined) { if (!DEGREES.includes(o.degree)) throw new LedgerError(400, '学历不在范围内'); out.degree = o.degree; }
  if (o.cities !== undefined) { if (!Array.isArray(o.cities) || o.cities.some((c: unknown) => typeof c !== 'string')) throw new LedgerError(400, '城市应为字符串数组'); out.cities = o.cities; }
  if (o.directions !== undefined) { if (!Array.isArray(o.directions) || o.directions.some((c: unknown) => typeof c !== 'string')) throw new LedgerError(400, '方向应为字符串数组'); out.directions = o.directions; }
  return out;
}

export function writeProfile(p: MePaths, patch: unknown, now = new Date()) {
  const cur = existsSync(p.profile) ? JSON.parse(readFileSync(p.profile, 'utf-8')) : {};
  const next = { ...cur, ...checkProfile(patch) };
  if (existsSync(p.profile)) backupFile(p.profile, join(dirname(p.profile), '.backup'), now);
  mkdirSync(dirname(p.profile), { recursive: true });
  writeFileSync(p.profile, JSON.stringify(next, null, 2) + '\n');
  return next;
}

export type ApiResult = { status: number; body: unknown };

export function handleApi(p: MePaths, method: string, path: string, body: any, now = new Date()): ApiResult | null {
  if (!path.startsWith('/api/')) return null;
  if (method !== 'POST') return { status: 405, body: { error: '只支持 POST' } };
  try {
    let m: RegExpMatchArray | null;
    if ((m = path.match(/^\/api\/ledger\/([^/]+)$/))) {
      const row = updateRow(p.ledger, decodeURIComponent(m[1]), body?.before, body?.after, now);
      return { status: 200, body: { ok: true, row } };
    }
    if (path === '/api/ledger') return { status: 200, body: { ok: true, ...addRow(p.ledger, body, now) } };
    if (path === '/api/profile') return { status: 200, body: { ok: true, profile: writeProfile(p, body, now) } };
    return { status: 404, body: { error: '没有这个接口' } };
  } catch (e) {
    if (e instanceof LedgerError) return { status: e.status, body: { error: e.message, current: e.detail } };
    throw e;
  }
}
