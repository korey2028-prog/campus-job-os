// 把 src/domain/*.ts 转成浏览器可用的 apps/web/lib/*.js（同一份逻辑，不另写一套）
import { stripTypeScriptTypes } from 'node:module';
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname, resolve } from 'node:path';

export function buildWeb(domainDir: string, outDir: string): number {
  mkdirSync(outDir, { recursive: true });
  let n = 0;
  for (const f of readdirSync(domainDir).filter((x) => x.endsWith('.ts'))) {
    let code = stripTypeScriptTypes(readFileSync(join(domainDir, f), 'utf8'), { mode: 'strip' });
    code = code.replace(/(from\s+['"][^'"]+)\.ts(['"])/g, '$1.js$2');
    writeFileSync(join(outDir, f.replace(/\.ts$/, '.js')), `// 自动生成，请改 src/domain/${f} 后运行 npm run build:web\n${code}`);
    n++;
  }
  return n;
}

const isDirect = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const n = buildWeb(join(root, 'src/domain'), join(root, 'apps/web/lib'));
  console.log(`built ${n} domain modules -> apps/web/lib`);
}
