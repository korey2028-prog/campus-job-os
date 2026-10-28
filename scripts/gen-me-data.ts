// 生成个人模式数据 private/me.json（读 Korey 的画像、岗位数据包、台账、事实底稿；全部只读）
import { readFileSync, readdirSync, writeFileSync, mkdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mapR27, parseLedger, applicationsFromLedger, applyLedgerLinks, resumeFilesFromLedger, parseFacts, CHANNELS, localDate } from '../src/me/mapper.ts';
import { parseCsvRecords } from '../src/import/csv.ts';
import { mePaths, readLinks, writeAtomic } from '../src/me/live.ts';
import { checkEligibility } from '../src/domain/eligibility.ts';
import { parseGradWindow } from '../src/domain/grad.ts';
import { parseDeadline } from '../src/domain/deadline.ts';
import { rankPosition } from '../src/domain/rank.ts';
import { positionKey } from '../src/domain/dedupe.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const p = mePaths(root);
const now = new Date();
const today = localDate(now);

// 个人模式要本机私有数据；克隆下来的仓库没有，给一句能看懂的提示
for (const [name, path] of [['画像', p.profile], ['岗位数据', p.r27], ['台账', p.ledger]]) {
  if (!existsSync(path)) { console.error(`个人模式需要本机私有数据，缺少${name}：${path}\n只想看看的话用 npm run web（虚构演示数据）。`); process.exit(1); }
}
const profile = JSON.parse(readFileSync(p.profile, 'utf-8'));
// 飞书导出：每页 data.fields 是列名，data.data 是按列排的行，data.record_id_list 是记录 ID
const pages = readdirSync(p.r27).filter((f) => /^p\d+\.json$/.test(f)).sort().map((f) => JSON.parse(readFileSync(join(p.r27, f), 'utf-8')).data);
const fields: string[] = pages[0].fields;
if (pages.some((d) => JSON.stringify(d.fields) !== JSON.stringify(fields))) throw new Error('各页列名不一致');
const rows = pages.flatMap((d) => d.data), ids: string[] = pages.flatMap((d) => d.record_id_list);
const scored = parseCsvRecords(readFileSync(p.scored, 'utf-8'));
const { postings, positions, archive, stats } = mapR27({ fields, rows, ids, scored }, { today, readAt: now.toISOString() });
// 岗位编号跟着飞书记录 ID 走：每天同步后收藏、勾选、详情链接都不错位。新记录接着最大号往下编
// 编号表丢了不静默重建（会让收藏错位），要重建就手动删掉后加 ID_MAP_INIT=1
if (!existsSync(p.idMap) && !process.env.ID_MAP_INIT) throw new Error(`找不到 ${p.idMap}；首次生成请加 ID_MAP_INIT=1`);
const idMap: Record<string, number> = existsSync(p.idMap) ? JSON.parse(readFileSync(p.idMap, 'utf-8')) : {};
let nextId = Math.max(99999, ...Object.values(idMap)) + 1;
for (const v of [...positions, ...archive]) v.id = idMap[v.recordId] ??= nextId++;
writeAtomic(p.idMap, JSON.stringify(idMap));
const ledger = parseLedger(readFileSync(p.ledger, 'utf-8'));
const apps = applicationsFromLedger(ledger, positions);
applyLedgerLinks(apps, positions, readLinks(p));
const { facts, factGaps, factFixes } = parseFacts(readFileSync(p.facts, 'utf-8'));

const src = (name: string, path: string, count: number) => ({ name, path, readAt: now.toISOString(), mtime: statSync(path).mtime.toISOString(), count });
const out = {
  meta: {
    mode: 'me', today, fictional: false, version: 'me-1', note: '个人模式：岗位来自第三方整理的公开校招表，投递来自本人台账。',
    sources: [src('27届主表', p.r27, rows.length), src('可信度先验', p.scored, scored.length), src('投递台账', p.ledger, ledger.length), src('事实底稿', p.facts, facts.length), src('画像', p.profile, 1)],
  },
  profile, postings, positions, archive, facts, factGaps, factFixes, applications: apps, resumeFiles: resumeFilesFromLedger(ledger),
  materials: [], channels: CHANNELS, majorMap: [],
};
mkdirSync(dirname(p.data), { recursive: true });
writeAtomic(p.data, JSON.stringify(out));

// 与网页一致：同一去重键只算一个岗位，再逐个判断能否投
const seen = new Set<string>();
const post = new Map(postings.map((x) => [x.id, x]));
const count = { 可投: 0, 待确认: 0, 不可投: 0 };
const aList: string[] = [];
const tiers: Record<string, number> = { A: 0, B: 0, C: 0, 无: 0 };
const domainProfile = { gradDate: profile.gradDate, degree: profile.degree, major: profile.major || undefined };
for (const r of positions) {
  const grad = r.cohortDoubt ? null : parseGradWindow(r.gradRaw);
  const k = positionKey(r.company, r.title, r.batch, grad);
  if (seen.has(k)) continue;
  seen.add(k);
  const dom = { downwardCompatible: true, degrees: [], majors: [], ...r, gradWindow: grad, deadline: parseDeadline(r.deadlineRaw, 2026) };
  const verdict = checkEligibility(dom, domainProfile, today).verdict;
  count[verdict]++;
  const rk = rankPosition({ ...dom, verdict, confidence: post.get(r.postingId)?.scored?.overall }, profile, today);
  const t = rk.tier;
  tiers[t ?? '无']++;
  if (t === 'A') aList.push(`${r.company} | ${r.title} | ${rk.reasons[0]}`);
}
console.log(`原始记录 ${stats.records}，模板行丢弃 ${stats.template}，届次含 27 ${stats.kept}，不含 27 的转往届存档 ${stats.otherCohort}，届次存疑（招聘类型 27届秋招）${stats.doubt}`);
console.log(`岗位 ${seen.size}（去重前 ${positions.length}），其中 能投 ${count.可投} / 待确认 ${count.待确认} / 不可投 ${count.不可投}`);
console.log(`推荐档位 A ${tiers.A} / B ${tiers.B} / C ${tiers.C} / 不可投不分档 ${tiers.无}`);
for (const l of aList.slice(0, Number(process.env.A_LIST ?? 0))) console.log('A  ' + l);
console.log(`往届存档（已过截止日）${archive.length}，公告 ${postings.length}，投递 ${apps.length}（已关联岗位 ${apps.filter((a) => a.positionId).length}），事实 ${facts.length}`);
console.log(`写入 ${p.data}`);
