import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildWeb } from '../scripts/build-web.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const domain = join(root, 'src/domain');
const lib = join(root, 'apps/web/lib');
const js = (dir: string) => readdirSync(dir).filter((f) => f.endsWith('.js')).sort();

test('build-web smoke matches the committed apps/web/lib', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'web-lib-'));
  const n = buildWeb(domain, tmp);
  const names = js(tmp);
  assert.equal(n, names.length);
  assert.ok(names.includes('eligibility.js'));
  assert.ok(names.includes('local-date.js'));
  assert.deepEqual(js(lib), names, '运行 npm run build:web 并把 apps/web/lib 一起提交');
  for (const f of names) assert.equal(readFileSync(join(lib, f), 'utf8'), readFileSync(join(tmp, f), 'utf8'), f);

  const ran = spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', join(root, 'scripts/build-web.ts')], { cwd: root, encoding: 'utf8' });
  assert.equal(ran.status, 0, ran.stderr);
  assert.match(ran.stdout, /built \d+ domain modules -> apps\/web\/lib/);
  for (const f of names) assert.equal(readFileSync(join(lib, f), 'utf8'), readFileSync(join(tmp, f), 'utf8'), f);
});
