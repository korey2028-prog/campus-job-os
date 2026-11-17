import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { checkRepo, checkSource, importViolation, listSpecifiers, privatePathViolation } from '../scripts/check-boundaries.ts';

const root = fileURLToPath(new URL('..', import.meta.url));

test('specifier scanner ignores strings, comments, import.meta, and member require', () => {
  const src = [
    "import { a } from './ok.ts';",
    "import type { T } from './type.ts';",
    "export { localDate } from '../domain/local-date.ts';",
    "const s = \"import x from 'evil'\";",
    "// import { a } from 'nope'",
    'const re = /import\\(/;',
    "const { x } = await import('./dyn.ts');",
    'const p = import.meta.url;',
    "const { chromium } = require('playwright');",
    "foo.require('not-a-call-expression');",
  ].join('\n');
  assert.deepEqual(listSpecifiers(src).map((x) => x.specifier), [
    './ok.ts', './type.ts', '../domain/local-date.ts', './dyn.ts', 'playwright',
  ]);
});

test('multiline import keeps the specifier line', () => {
  assert.deepEqual(listSpecifiers("import {\n  a,\n  type B,\n} from './m.ts';\n"), [{ line: 4, specifier: './m.ts' }]);
});

test('layer violations name the file, the import, why, and how to fix', () => {
  const msg = importViolation('src/domain/rank.ts', 1, '../store/db.ts');
  assert.ok(msg);
  assert.match(msg, /src\/domain\/rank\.ts:1/);
  assert.match(msg, /\.\.\/store\/db\.ts/);
  assert.match(msg, /src\/store\/db\.ts/);
  assert.match(msg, /原因/);
  assert.match(msg, /改法/);
  assert.equal(importViolation('src/domain/eligibility.ts', 2, './deadline.ts'), null);
  assert.equal(importViolation('src/ledger/writer.ts', 1, '../domain/local-date.ts'), null);
  assert.match(importViolation('src/ledger/writer.ts', 1, '../me/mapper.ts') ?? '', /src\/me/);
  assert.equal(importViolation('src/me/live.ts', 1, '../ledger/writer.ts'), null);
  assert.equal(importViolation('src/me/mapper.ts', 1, '../import/csv.ts'), null);
  assert.match(importViolation('src/me/mapper.ts', 1, '../import/ledger.ts') ?? '', /原因：/);
  assert.equal(importViolation('src/cli.ts', 1, './store/db.ts'), null);
  assert.match(importViolation('apps/web/js/store.js', 1, 'node:fs') ?? '', /浏览器/);
  assert.match(importViolation('src/domain/x.ts', 1, 'lodash') ?? '', /npm/);
  assert.equal(importViolation('scripts/screenshot.mjs', 1, 'playwright'), null);
  assert.match(importViolation('scripts/ledger.ts', 1, 'lodash') ?? '', /npm/);
  assert.match(importViolation('src/store/db.ts', 1, 'node:http') ?? '', /node:http/);
  assert.equal(importViolation('src/store/db.ts', 1, 'node:sqlite'), null);
  assert.equal(importViolation('src/import/csv.ts', 1, './ledger.ts'), null);
});

test('private paths cover databases, data/, resumes and ledgers', () => {
  assert.match(privatePathViolation('job-os.db') ?? '', /原因：/);
  assert.match(privatePathViolation('nested/job.sqlite') ?? '', /\.db|\.sqlite|数据库/);
  assert.match(privatePathViolation('data/secret.csv') ?? '', /data/);
  assert.equal(privatePathViolation('apps/web/data/demo.json'), null);
  assert.equal(privatePathViolation('dataset/27届校招岗位.csv'), null);
  assert.equal(privatePathViolation('examples/ledger.sample.csv'), null);
  assert.match(privatePathViolation('private/profile.json') ?? '', /private/);
  assert.match(privatePathViolation('data-private/feishu.csv') ?? '', /data-private/);
  assert.match(privatePathViolation('notes/我的简历.pdf') ?? '', /简历/);
  assert.equal(privatePathViolation('examples/resume.sample.pdf'), null);
  assert.match(privatePathViolation('career/岗位台账.csv') ?? '', /台账/);
  assert.match(privatePathViolation('SPEC_我的求职台.md') ?? '', /原因：/);
  for (const msg of [privatePathViolation('job-os.db'), privatePathViolation('career/岗位台账.csv')]) {
    assert.match(msg ?? '', /改法：/);
  }
});

test('cli imports are exactly the modules it composes', () => {
  const src = readFileSync(fileURLToPath(new URL('../src/cli.ts', import.meta.url)), 'utf8');
  assert.deepEqual(listSpecifiers(src).map((x) => x.specifier), [
    'node:util', './store/db.ts', './domain/confidence.ts', './import/ledger.ts', './import/jobdir.ts',
    './domain/grad.ts', './domain/deadline.ts', './domain/eligibility.ts', './domain/types.ts',
  ]);
});

test('a domain file importing the store is rejected with a fix', () => {
  const msgs = checkSource('src/domain/bad.ts', "import { openDb } from '../store/db.ts';\n");
  assert.equal(msgs.length, 1);
  assert.match(msgs[0], /改法：/);
});

test('this repo passes the boundary check', () => {
  assert.deepEqual(checkRepo(root), []);
});
