// 把 src/domain/*.ts 转成浏览器可用的 apps/web/lib/*.js（同一份逻辑，不另写一套）
import { stripTypeScriptTypes } from 'node:module';
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src/domain');
const out = join(root, 'apps/web/lib');
mkdirSync(out, { recursive: true });
let n = 0;
for (const f of readdirSync(src).filter((x) => x.endsWith('.ts'))) {
  let code = stripTypeScriptTypes(readFileSync(join(src, f), 'utf8'), { mode: 'strip' });
  code = code.replace(/(from\s+['"][^'"]+)\.ts(['"])/g, '$1.js$2');
  writeFileSync(join(out, f.replace(/\.ts$/, '.js')), `// 自动生成，请改 src/domain/${f} 后运行 npm run build:web\n${code}`);
  n++;
}
console.log(`built ${n} domain modules -> apps/web/lib`);
