// 台账命令行：给各个 Agent 写回投递状态用，和页面走同一套备份、原子写入、变更日志
// 用法：
//   node scripts/ledger.ts show <local_id>
//   node scripts/ledger.ts find <公司关键词>
//   node scripts/ledger.ts add --company 懂车帝 --role 大模型产品经理 [--url ...] [--by grok]
//   node scripts/ledger.ts set <local_id> --stage 已投递（用户确认） [--submission_evidence ...] [--expect-stage 网申草稿未提交] [--by grok]
// 列名用台账原列名；--expect-<列> 表示写之前该列必须等于这个值。LEDGER_PATH 可指向副本测试。
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mePaths } from '../src/me/live.ts';
import { parseLedger } from '../src/me/mapper.ts';
import { addRow, patchRow, LedgerError } from '../src/ledger/writer.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ledger = mePaths(root).ledger;
const [cmd, ...rest] = process.argv.slice(2);
const pos: string[] = [];
const opt: Record<string, string> = {};
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith('--')) opt[rest[i].slice(2)] = rest[++i] ?? '';
  else pos.push(rest[i]);
}
const by = opt.by || 'agent';
delete opt.by;
const out = (v: unknown) => console.log(JSON.stringify(v, null, 2));

try {
  const rows = parseLedger(readFileSync(ledger, 'utf-8')) as any[];
  if (cmd === 'show') out(rows.find((r) => r.local_id === pos[0]) ?? null);
  else if (cmd === 'find') out(rows.filter((r) => r.company.includes(pos[0] ?? '')));
  else if (cmd === 'add') {
    const { company, role, url, next_action, next_action_date, notes } = opt;
    out(addRow(ledger, { company, role, official_url: url, next_action, next_action_date, notes }));
  } else if (cmd === 'set' && pos[0]) {
    const changes: Record<string, string> = {}, expect: Record<string, string> = {};
    for (const [k, v] of Object.entries(opt)) (k.startsWith('expect-') ? (expect[k.slice(7)] = v) : (changes[k] = v));
    if (!Object.keys(changes).length) throw new LedgerError(400, '没有要改的列');
    out(patchRow(ledger, pos[0], changes, expect, new Date(), by));
  } else {
    console.error('用法见文件开头注释');
    process.exit(2);
  }
} catch (e) {
  if (e instanceof LedgerError) { console.error(`${e.status} ${e.message}`); if (e.detail) out(e.detail); process.exit(1); }
  throw e;
}
