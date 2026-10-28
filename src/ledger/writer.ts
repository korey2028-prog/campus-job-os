// 台账写回：每次重新读文件，核对 before，备份后原子写入，并追加变更日志
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync, appendFileSync, openSync, fsyncSync, closeSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';
import { parseCsv } from '../import/csv.ts';
import { localDate } from '../me/mapper.ts';

export const EDITABLE = ['stage', 'next_action', 'next_action_date', 'notes'] as const;
export type Editable = Record<(typeof EDITABLE)[number], string>;
export class LedgerError extends Error {
  status: 400 | 404 | 409;
  detail?: unknown;
  constructor(status: 400 | 404 | 409, message: string, detail?: unknown) { super(message); this.status = status; this.detail = detail; }
}

type Rec = { raw: string; fields: string[] };

// 按记录切开并保留原文（含行尾），没改的行写回时逐字不变
function splitRecords(text: string): Rec[] {
  const out: Rec[] = [];
  let start = 0, inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') inQ = !inQ;
    else if (!inQ && (c === '\n' || c === '\r')) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      out.push({ raw: text.slice(start, i + 1), fields: [] });
      start = i + 1;
    }
  }
  if (start < text.length) out.push({ raw: text.slice(start), fields: [] });
  for (const r of out) r.fields = parseCsv(r.raw)[0] ?? [];
  return out;
}

const quote = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const eolOf = (text: string) => (text.includes('\r\n') ? '\r\n' : '\n');
const stamp = (d: Date) => `${localDate(d).replace(/-/g, '')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`;

export function sidecars(ledgerPath: string) {
  return { backupDir: join(dirname(ledgerPath), '.backup'), logPath: join(dirname(ledgerPath), '台账变更日志.jsonl') };
}

export function backupFile(path: string, dir: string, now: Date): string {
  mkdirSync(dir, { recursive: true });
  const ext = extname(path), base = basename(path, ext);
  let n = 0, target: string;
  do { target = join(dir, `${base}_${stamp(now)}${n ? '-' + n : ''}${ext}`); n++; } while (existsSync(target));
  writeFileSync(target, readFileSync(path));
  return target;
}

function atomicWrite(path: string, text: string) {
  const tmp = join(dirname(path), `.${basename(path)}.tmp-${process.pid}`);
  writeFileSync(tmp, text);
  const fd = openSync(tmp, 'r+'); fsyncSync(fd); closeSync(fd);
  renameSync(tmp, path);
}

function load(ledgerPath: string) {
  const text = readFileSync(ledgerPath, 'utf-8');
  const recs = splitRecords(text);
  const head = recs[0]?.fields ?? [];
  const idx = Object.fromEntries(head.map((h, i) => [h, i]));
  for (const k of ['local_id', ...EDITABLE, 'last_event_at']) if (!(k in idx)) throw new LedgerError(400, `台账缺少列 ${k}`);
  return { text, recs, head, idx };
}

function commit(ledgerPath: string, text: string, next: string, now: Date, entry: object) {
  const { backupDir, logPath } = sidecars(ledgerPath);
  // 备份到写入之间若文件被别处改了，放弃
  if (readFileSync(ledgerPath, 'utf-8') !== text) throw new LedgerError(409, '台账在写入前被改动');
  backupFile(ledgerPath, backupDir, now);
  atomicWrite(ledgerPath, next);
  appendFileSync(logPath, JSON.stringify({ at: now.toISOString(), ...entry, by: 'job-os' }) + '\n');
}

const pick = (fields: string[], idx: Record<string, number>): Editable =>
  Object.fromEntries(EDITABLE.map((k) => [k, fields[idx[k]] ?? ''])) as Editable;

export function updateRow(ledgerPath: string, localId: string, before: Editable, after: Editable, now = new Date()) {
  for (const k of EDITABLE) if (typeof after?.[k] !== 'string' || typeof before?.[k] !== 'string') throw new LedgerError(400, `缺少字段 ${k}`);
  const { text, recs, head, idx } = load(ledgerPath);
  const at = recs.findIndex((r, i) => i > 0 && r.fields[idx.local_id] === localId);
  if (at < 0) throw new LedgerError(404, `找不到 ${localId}`);
  const cur = pick(recs[at].fields, idx);
  if (EDITABLE.some((k) => cur[k] !== before[k])) throw new LedgerError(409, '台账在别处被改过', cur);
  const fields = [...recs[at].fields];
  while (fields.length < head.length) fields.push('');
  for (const k of EDITABLE) fields[idx[k]] = after[k];
  fields[idx.last_event_at] = localDate(now);
  const eol = eolOf(text);
  const hadEol = /[\r\n]$/.test(recs[at].raw);
  recs[at] = { raw: fields.map(quote).join(',') + (hadEol ? eol : ''), fields };
  commit(ledgerPath, text, recs.map((r) => r.raw).join(''), now, { local_id: localId, before: cur, after: pick(fields, idx) });
  return pick(fields, idx);
}

// 给 Agent 用的局部写回：可改除 local_id 外的任意列；expect 里列出的旧值对不上就 409
export function patchRow(ledgerPath: string, localId: string, changes: Record<string, string>, expect: Record<string, string> = {}, now = new Date(), by = 'agent') {
  const { text, recs, head, idx } = load(ledgerPath);
  for (const k of [...Object.keys(changes), ...Object.keys(expect)]) if (k === 'local_id' || !(k in idx)) throw new LedgerError(400, `不能写列 ${k}`);
  const at = recs.findIndex((r, i) => i > 0 && r.fields[idx.local_id] === localId);
  if (at < 0) throw new LedgerError(404, `找不到 ${localId}`);
  const fields = [...recs[at].fields];
  while (fields.length < head.length) fields.push('');
  const cur = Object.fromEntries(head.map((h, i) => [h, fields[i]]));
  const stale = Object.keys(expect).filter((k) => cur[k] !== expect[k]);
  if (stale.length) throw new LedgerError(409, `台账在别处被改过：${stale.join('、')}`, cur);
  const before = Object.fromEntries(Object.keys(changes).map((k) => [k, cur[k]]));
  for (const [k, v] of Object.entries(changes)) fields[idx[k]] = v;
  fields[idx.last_event_at] = localDate(now);
  const hadEol = /[\r\n]$/.test(recs[at].raw);
  recs[at] = { raw: fields.map(quote).join(',') + (hadEol ? eolOf(text) : ''), fields };
  const { backupDir, logPath } = sidecars(ledgerPath);
  if (readFileSync(ledgerPath, 'utf-8') !== text) throw new LedgerError(409, '台账在写入前被改动');
  backupFile(ledgerPath, backupDir, now);
  atomicWrite(ledgerPath, recs.map((r) => r.raw).join(''));
  appendFileSync(logPath, JSON.stringify({ at: now.toISOString(), local_id: localId, before, after: changes, by }) + '\n');
  return Object.fromEntries(head.map((h, i) => [h, fields[i]]));
}

export type NewRow ={ company: string; role: string; official_url?: string; next_action?: string; next_action_date?: string; notes?: string };

export function addRow(ledgerPath: string, input: NewRow, now = new Date()): { local_id: string; existed: boolean } {
  if (!input?.company?.trim() || !input?.role?.trim()) throw new LedgerError(400, '缺少公司或岗位');
  const { text, recs, head, idx } = load(ledgerPath);
  const body = recs.slice(1);
  const dup = body.find((r) => r.fields[idx.company] === input.company && r.fields[idx.role] === input.role);
  if (dup) return { local_id: dup.fields[idx.local_id], existed: true };
  let n = 0;
  for (const r of body) { const m = /^JOS-(\d+)$/.exec(r.fields[idx.local_id] ?? ''); if (m) n = Math.max(n, Number(m[1])); }
  const local_id = `JOS-${String(n + 1).padStart(3, '0')}`;
  const row: Record<string, string> = {
    local_id, company: input.company, role: input.role, official_url: input.official_url ?? '', stage: '未核验', last_event_at: localDate(now),
    next_action: input.next_action ?? '', next_action_date: input.next_action_date ?? '', notes: input.notes ?? '',
  };
  const eol = eolOf(text);
  const line = head.map((h) => quote(row[h] ?? '')).join(',') + eol;
  const next = text + (text === '' || /[\r\n]$/.test(text) ? '' : eol) + line;
  commit(ledgerPath, text, next, now, { local_id, before: null, after: pick(head.map((h) => row[h] ?? ''), idx) });
  return { local_id, existed: false };
}
