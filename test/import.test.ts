import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseCsv, parseCsvRecords } from '../src/import/csv.ts';
import { importLedger, LEDGER_HEADER } from '../src/import/ledger.ts';
import { importJobDir } from '../src/import/jobdir.ts';
import { openDb, listApplications, listPostings } from '../src/store/db.ts';

test('csv parser edge cases', () => {
  assert.deepEqual(parseCsv('﻿a,b\r\n1,2\r\n'), [['a', 'b'], ['1', '2']]);
  assert.deepEqual(parseCsv('a,b\n"x,y","he said ""hi"""\n'), [['a', 'b'], ['x,y', 'he said "hi"']]);
  assert.deepEqual(parseCsv('a\n"l1\nl2"\n'), [['a'], ['l1\nl2']]);
  assert.deepEqual(parseCsv('a,b\n1,\n\n2,3'), [['a', 'b'], ['1', ''], ['2', '3']]);
  assert.deepEqual(parseCsv('a,b\n"",x'), [['a', 'b'], ['', 'x']]);
  assert.deepEqual(parseCsv('a,"unterminated'), [['a', 'unterminated']]);
  assert.deepEqual(parseCsvRecords(''), []);
  assert.deepEqual(parseCsvRecords('a,b\n'), []);
  assert.deepEqual(parseCsvRecords('a,b\n1'), [{ a: '1', b: '' }]);
  assert.deepEqual(parseCsvRecords('h1,h2\n"x,y","he said ""hi"""'), [{ h1: 'x,y', h2: 'he said "hi"' }]);
});

const sha = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex');

test('ledger import is idempotent and read-only', () => {
  const csv = fileURLToPath(new URL('../examples/ledger.sample.csv', import.meta.url));
  const before = sha(csv);
  const db = openDb(':memory:');
  const r1 = importLedger(db, csv);
  assert.equal(r1.rows, 5);
  assert.equal(r1.inserted, 5);
  assert.deepEqual(r1.unmappedStages, ['神秘阶段']);
  const r2 = importLedger(db, csv);
  assert.equal(r2.inserted, 0);
  assert.equal(r2.updated, 5);
  const apps = listApplications(db);
  assert.equal(apps.length, 5);
  assert.match(apps[0].company, /示例科技/);
  assert.equal(apps[0].stage_enum, 'verify');
  assert.equal(sha(csv), before);
});

test('job dir import', () => {
  const csv = fileURLToPath(new URL('../examples/ledger.sample.csv', import.meta.url));
  const dir = fileURLToPath(new URL('../examples/jobs', import.meta.url));
  const db = openDb(':memory:');
  importLedger(db, csv);
  const a = importJobDir(db, dir);
  assert.deepEqual(a, { dirs: 1, created: 1, updated: 0 });
  const b = importJobDir(db, dir);
  assert.deepEqual(b, { dirs: 1, created: 0, updated: 1 });
  const p = listPostings(db);
  assert.equal(p.length, 1);
  assert.equal(p[0].title, '产品经理');
});

test('ledger import rejects a bad header and skips blank ids', () => {
  const dir = mkdtempSync(join(tmpdir(), 'import-'));
  const bad = join(dir, 'bad.csv');
  writeFileSync(bad, 'a,b\n1,2\n');
  const db = openDb(':memory:');
  assert.throws(() => importLedger(db, bad), /表头/);
  assert.equal(listApplications(db).length, 0);

  const ok = join(dir, 'ok.csv');
  writeFileSync(ok, `${LEDGER_HEADER}\n,示例,空编号,,,,,,,,,,,\nDEMO-9,示例公司,设计,,,,未核验,,,,,,\n`);
  const before = sha(ok);
  const r = importLedger(db, ok);
  assert.equal(r.rows, 2);
  assert.equal(r.inserted, 1);
  assert.equal(listApplications(db).length, 1);
  assert.equal(listApplications(db)[0].local_id, 'DEMO-9');
  assert.equal(listApplications(db)[0].stage_enum, 'verify');
  assert.equal(sha(ok), before);
});

test('job dir import ignores entries without jd.md and does not rewrite the file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'jobs-'));
  writeFileSync(join(dir, 'notes.txt'), '不是目录');
  mkdirSync(join(dir, 'empty-dir'));
  mkdirSync(join(dir, 'HAS-JD'));
  const jd = join(dir, 'HAS-JD', 'jd.md');
  writeFileSync(jd, '# 虚构 JD\n');
  const before = sha(jd);
  const db = openDb(':memory:');
  assert.deepEqual(importJobDir(db, dir), { dirs: 1, created: 1, updated: 0 });
  assert.equal(sha(jd), before);
  assert.equal(listPostings(db)[0].title, 'HAS-JD');
  assert.deepEqual(importJobDir(db, dir), { dirs: 1, created: 0, updated: 1 });
});
