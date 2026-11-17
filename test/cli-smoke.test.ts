import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const cli = fileURLToPath(new URL('../src/cli.ts', import.meta.url));

function run(args: string[]) {
  return spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', cli, ...args], { encoding: 'utf8', cwd: root });
}

test('cli smoke uses a temp database', () => {
  const db = join(mkdtempSync(join(tmpdir(), 'job-os-cli-')), 'job-os.db');
  const usage = run([]);
  assert.equal(usage.status, 0, usage.stderr);
  assert.match(usage.stdout, /用法/);

  const unknown = run(['--db', db, 'nope']);
  assert.equal(unknown.status, 1);
  assert.match(unknown.stdout, /用法/);
  assert.equal(unknown.stderr, '');

  const init = run(['--db', db, 'init']);
  assert.equal(init.status, 0, init.stderr);
  assert.equal(init.stderr, '');
  assert.match(init.stdout, /已初始化/);

  const missing = run(['--db', db, 'add-posting', '--title', '只有标题']);
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /需要 --company/);

  const add = run(['--db', db, 'add-posting', '--company', '示例科技', '--title', '产品经理', '--grad', '27届', '--degree', '本科', '--as-of', '2026-10-27']);
  assert.equal(add.status, 0, add.stderr);
  assert.match(add.stdout, /已新增岗位/);

  const eligible = run(['--db', db, 'eligible', '--grad', '2027-06', '--degree', '硕士', '--as-of', '2026-10-27']);
  assert.equal(eligible.status, 0, eligible.stderr);
  assert.match(eligible.stdout, /示例科技/);
  assert.match(eligible.stdout, /可投/);

  const today = run(['--db', db, 'today', '--as-of', '2026-10-27']);
  assert.equal(today.status, 0, today.stderr);
  assert.match(today.stdout, /已逾期的下一步/);

  const csv = fileURLToPath(new URL('../examples/ledger.sample.csv', import.meta.url));
  const imported = run(['--db', db, 'import-ledger', csv]);
  assert.equal(imported.status, 0, imported.stderr);
  const list = run(['--db', db, 'list']);
  assert.equal(list.status, 0, list.stderr);
  assert.match(list.stdout, /DEMO-001/);
  assert.match(list.stdout, /示例科技/);
});
