import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, copyFileSync, readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { updateRow, addRow, LedgerError, sidecars } from '../src/ledger/writer.ts';

const HEAD = 'local_id,company,role,official_url,jd_checked_at,hard_conditions,stage,resume_path,submission_evidence,last_event_at,next_action,next_action_date,notes';
const SAMPLE = [
  HEAD,
  'A-1,甲公司,产品实习,https://a.example,2026-10-01,,未核验,,,2026-10-01,看公告,2026-10-30,"备注,含逗号"',
  'JOS-007,乙公司,运营,,,,已交流,,,2026-10-02,,,"多行\n备注"',
  'A-3,丙公司,"带""引号""岗位",,,,已投递,,,2026-10-03,等通知,2026-11-01,',
].join('\r\n') + '\r\n';

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'ledger-'));
  const path = join(dir, '岗位台账.csv');
  writeFileSync(path, SAMPLE);
  return { dir, path };
}
const NOW = new Date(2026, 9, 28, 9, 30, 15);
const state = { stage: '未核验', next_action: '看公告', next_action_date: '2026-10-30', notes: '备注,含逗号' };

test('写入：只改目标行，其余逐字不变，有备份和日志', () => {
  const { path } = fixture();
  const orig = readFileSync(path, 'utf-8');
  const after = { ...state, stage: '已投递（用户确认）', notes: '改了\n两行, "引号"' };
  updateRow(path, 'A-1', state, after, NOW);
  const next = readFileSync(path, 'utf-8');
  const oldLines = orig.split('\r\n'), newLines = next.split('\r\n');
  assert.equal(newLines.length, oldLines.length);
  assert.notEqual(newLines[1], oldLines[1]);
  assert.equal(next.slice(next.indexOf('JOS-007')), orig.slice(orig.indexOf('JOS-007')));
  assert.match(next, /A-1,甲公司,产品实习,https:\/\/a\.example,2026-10-01,,已投递（用户确认）,,,2026-10-28,看公告,2026-10-30,"改了\n两行, ""引号"""\r\n/);
  const { backupDir, logPath } = sidecars(path);
  const backups = readdirSync(backupDir);
  assert.equal(backups.length, 1);
  assert.match(backups[0], /^岗位台账_20261028-093015\.csv$/);
  assert.equal(readFileSync(join(backupDir, backups[0]), 'utf-8'), orig);
  const log = readFileSync(logPath, 'utf-8').trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(log.length, 1);
  assert.equal(log[0].local_id, 'A-1');
  assert.equal(log[0].by, 'job-os');
  assert.deepEqual(log[0].before, state);
  assert.equal(log[0].after.stage, '已投递（用户确认）');
});

test('before 不一致返回 409 且不写', () => {
  const { path } = fixture();
  const orig = readFileSync(path, 'utf-8');
  assert.throws(() => updateRow(path, 'A-1', { ...state, stage: '别人改过' }, { ...state, stage: '已投递' }, NOW), (e) => e instanceof LedgerError && e.status === 409);
  assert.equal(readFileSync(path, 'utf-8'), orig);
  assert.equal(existsSync(sidecars(path).backupDir), false);
  assert.throws(() => updateRow(path, 'NOPE', state, state, NOW), (e) => e instanceof LedgerError && e.status === 404);
});

test('新增行：编号接在 JOS 最大号之后，旧行不变', () => {
  const { path } = fixture();
  const orig = readFileSync(path, 'utf-8');
  const r = addRow(path, { company: '丁公司', role: 'AI产品经理', official_url: 'https://d.example' }, NOW);
  assert.deepEqual(r, { local_id: 'JOS-008', existed: false });
  const next = readFileSync(path, 'utf-8');
  assert.ok(next.startsWith(orig));
  assert.equal(next.slice(orig.length), 'JOS-008,丁公司,AI产品经理,https://d.example,,,未核验,,,2026-10-28,,,\r\n');
  assert.deepEqual(addRow(path, { company: '丁公司', role: 'AI产品经理' }, NOW), { local_id: 'JOS-008', existed: true });
  const r2 = addRow(path, { company: '戊公司', role: 'X' }, NOW);
  assert.equal(r2.local_id, 'JOS-009');
});

test('没有 JOS 行时从 001 开始', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ledger-'));
  const path = join(dir, '岗位台账.csv');
  copyFileSync(new URL('../examples/ledger.sample.csv', import.meta.url), path);
  assert.equal(addRow(path, { company: '某公司', role: 'Y' }, NOW).local_id, 'JOS-001');
});
