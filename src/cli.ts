import { parseArgs } from 'node:util';
import { openDb, DEFAULT_DB, upsertPosition, listPositions, listApplications, listPostings, getDetail, linkApplication, type Db, type PositionRow, type Prov, type FieldName } from './store/db.ts';
import { confidence } from './domain/confidence.ts';
import { importLedger } from './import/ledger.ts';
import { importJobDir } from './import/jobdir.ts';
import { parseGradWindow } from './domain/grad.ts';
import { parseDeadline, isExpired } from './domain/deadline.ts';
import { checkEligibility } from './domain/eligibility.ts';
import type { Degree } from './domain/types.ts';

const DEGREES = ['大专', '本科', '硕士', '博士'];

function esc(s: unknown): string {
  return String(s ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}
function table(headers: string[], rows: unknown[][]): string {
  if (!rows.length) return '（无）';
  return [`| ${headers.join(' | ')} |`, `|${headers.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.map(esc).join(' | ')} |`)].join('\n');
}
function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function conf(db: Db, p: PositionRow, asOf: string) {
  const d = getDetail(db, p.id);
  return confidence({ sourceUrls: d.sourceUrls, provenance: d.provenance, sourceTimes: d.sources.map((x) => x.obtained_at),
    deadline: p.deadline, gradWindow: p.gradWindow, now: `${asOf}T23:59:59Z` });
}
function linksOf(db: Db): Map<number, string[]> {
  const m = new Map<number, string[]>();
  for (const a of db.prepare('SELECT local_id, position_id FROM applications WHERE position_id IS NOT NULL').all() as { local_id: string; position_id: number }[])
    m.set(a.position_id, [...(m.get(a.position_id) ?? []), a.local_id]);
  return m;
}
const split = (s?: string) => (s ?? '').split(/[,，、]/).map((x) => x.trim()).filter(Boolean);

function main(argv: string[]): void {
  const { values, positionals } = parseArgs({
    args: argv, allowPositionals: true,
    options: {
      db: { type: 'string' }, company: { type: 'string' }, title: { type: 'string' }, url: { type: 'string' },
      grad: { type: 'string' }, degree: { type: 'string' }, 'no-compat': { type: 'boolean' }, majors: { type: 'string' },
      cities: { type: 'string' }, deadline: { type: 'string' }, batch: { type: 'string' }, major: { type: 'string' },
      'as-of': { type: 'string' }, all: { type: 'boolean' },
    },
  });
  const [cmd, arg] = positionals;
  const db = openDb(values.db ?? DEFAULT_DB);
  const asOf = values['as-of'] ?? localToday();

  switch (cmd) {
    case 'init':
      console.log(`已初始化数据库：${values.db ?? DEFAULT_DB}`);
      break;
    case 'import-ledger': {
      if (!arg) throw new Error('用法：import-ledger <csv>');
      const r = importLedger(db, arg);
      console.log(table(['总行数', '新增', '更新', '未识别阶段数'], [[r.rows, r.inserted, r.updated, r.unmappedStages.length]]));
      if (r.unmappedStages.length) console.log(`\n未识别阶段：${r.unmappedStages.join('；')}`);
      break;
    }
    case 'import-jobs': {
      if (!arg) throw new Error('用法：import-jobs <dir>');
      const r = importJobDir(db, arg);
      console.log(table(['JD 目录数', '新增', '更新'], [[r.dirs, r.created, r.updated]]));
      break;
    }
    case 'add-posting': {
      if (!values.company || !values.title) throw new Error('需要 --company 和 --title');
      if (values.degree && !DEGREES.includes(values.degree)) throw new Error(`--degree 必须是 ${DEGREES.join('/')}`);
      const degree = values.degree as Degree | undefined;
      const prov: Partial<Record<FieldName, Prov>> = {};
      if (values.grad) prov.grad_window = { method: '规则解析', raw: values.grad };
      if (degree) prov.degree = { method: '人工录入' };
      if (split(values.majors).length) prov.majors = { method: '人工录入' };
      if (split(values.cities).length) prov.cities = { method: '人工录入' };
      if (values.deadline) prov.deadline = { method: '规则解析', raw: values.deadline };
      const r = upsertPosition(db, { prov,
        company: values.company, title: values.title, batch: values.batch ?? '',
        gradWindow: parseGradWindow(values.grad ?? ''), minDegree: degree, downwardCompatible: !values['no-compat'],
        degrees: degree ? [degree] : [], majors: split(values.majors), cities: split(values.cities),
        deadline: parseDeadline(values.deadline ?? '', Number(asOf.slice(0, 4))), url: values.url, sourceKind: 'manual',
      });
      console.log(r.created ? `已新增岗位 #${r.positionId}` : `岗位已存在 #${r.positionId}${r.sourceAdded ? '，已追加来源' : ''}${r.conflicts ? `，记录 ${r.conflicts} 处字段冲突` : ''}`);
      break;
    }
    case 'eligible': {
      if (!values.grad || !values.degree || !DEGREES.includes(values.degree)) throw new Error('需要 --grad YYYY-MM 和 --degree 大专/本科/硕士/博士');
      const profile = { gradDate: values.grad, degree: values.degree as Degree, major: values.major };
      const links = linksOf(db);
      const rows = listPositions(db)
        .filter((p) => values.all || !isExpired(p.deadline, asOf))
        .map((p) => {
          const e = checkEligibility(p, profile, asOf);
          return [p.id, p.company, p.title, e.verdict, conf(db, p, asOf).label, (links.get(p.id) ?? []).join('、'), e.reasons.join('；')];
        });
      console.log(table(['ID', '公司', '岗位', '结论', '等级', '关联申请', '理由'], rows));
      break;
    }
    case 'today': {
      const soon = addDays(asOf, 7);
      const apps = listApplications(db).filter((a) => a.stage_enum !== 'stopped' && a.stage_enum !== 'closed_source');
      const dateOf = (a: { next_action_date: string }) => {
        const raw = a.next_action_date.trim();
        const d = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? parseDeadline(raw) : null;
        return d && d.kind === 'date' ? d.date : '';
      };
      const groups: Record<string, typeof apps> = { '已逾期的下一步': [], '7 天内到期': [], '待核验': [], '日期待规范': [], '其他': [] };
      for (const a of apps) {
        const d = dateOf(a);
        if (a.next_action_date.trim() && !d) groups['日期待规范'].push(a);
        else if (d && d < asOf) groups['已逾期的下一步'].push(a);
        else if (d && d <= soon) groups['7 天内到期'].push(a);
        else if (a.stage_enum === 'verify') groups['待核验'].push(a);
        else groups['其他'].push(a);
      }
      for (const [name, list] of Object.entries(groups)) {
        console.log(`## ${name}（${list.length}）\n`);
        console.log(table(['编号', '公司', '岗位', '阶段', '下一步', '日期', '关联岗位'],
          list.map((a) => [a.local_id, a.company, a.role, a.stage_raw || a.stage_enum, a.next_action, a.next_action_date, a.position_id ? `#${a.position_id}` : ''])));
        console.log('');
      }
      break;
    }
    case 'link': {
      const [, localId, pos] = positionals;
      if (!localId || !pos) throw new Error('用法：link <local_id> <position_id>');
      linkApplication(db, localId, Number(pos));
      console.log(`已关联 ${localId} -> 岗位 #${Number(pos)}`);
      break;
    }
    case 'show': {
      const p = listPositions(db).find((x) => x.id === Number(arg));
      if (!p) throw new Error('用法：show <position_id>（岗位不存在）');
      const c = conf(db, p, asOf);
      const d = getDetail(db, p.id);
      console.log(`## 岗位 #${p.id} ${p.company} / ${p.title}\n`);
      console.log(`置信度：${c.label}（来源可信度 ${c.source}；字段可靠度 ${c.field}；时效 ${c.freshness}）\n`);
      console.log(table(['字段', '方式', '取得时间', '来源', '来源可信度', '字段可靠度', '核验时间', '原始值'],
        d.provenance.map((x) => [x.field, x.method, x.obtained_at, d.sources.find((s) => s.id === x.source_id)?.url ?? '无', x.confidence_source, x.confidence_field, x.verified_at ?? '未核验', x.raw_value ?? ''])));
      console.log('\n### 来源\n');
      console.log(table(['ID', 'URL', '类型', '取得时间'], d.sources.map((s) => [s.id, s.url, s.kind, s.obtained_at])));
      console.log('\n### 字段冲突\n');
      console.log(table(['字段', '现有值', '新值', '来源', '时间'], d.conflicts.map((x) => [x.field, x.existing, x.incoming, x.source_id ?? '', x.at])));
      break;
    }
    case 'list': {
      console.log('## 岗位\n');
      console.log(table(['ID', '公司', '岗位', '届次', '截止', '来源数', '等级'], listPositions(db).map((p) => [
        p.id, p.company, p.title, p.gradWindow ? `${p.gradWindow.from}~${p.gradWindow.to}` : '无法解析',
        p.deadline.kind === 'date' ? p.deadline.date : p.deadline.kind === 'rolling' ? '招满即止' : '未知', p.sourceCount, conf(db, p, asOf).label])));
      console.log('\n## 岗位原文（Postings）\n');
      console.log(table(['ID', '公司', '标题', '来源数'], listPostings(db).map((p) => [p.id, p.company, p.title, p.sources])));
      console.log('\n## 申请\n');
      console.log(table(['编号', '公司', '岗位', '阶段'], listApplications(db).map((a) => [a.local_id, a.company, a.role, a.stage_enum])));
      break;
    }
    default:
      console.log('用法：init | import-ledger <csv> | import-jobs <dir> | add-posting | eligible | today | list | show <id> | link <local_id> <position_id>  （均可加 --db <path>）');
      process.exitCode = cmd ? 1 : 0;
  }
}

try { main(process.argv.slice(2)); } catch (e) {
  console.error(`错误：${(e as Error).message}`);
  process.exitCode = 1;
}
