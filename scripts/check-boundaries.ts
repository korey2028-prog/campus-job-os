// 分层和私有数据检查。零依赖：Node 直接跑这份 TypeScript。
// 方向从现有代码归纳：domain 在最底下，cli / scripts / apps/web 在最外面。
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, extname, join, posix, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export type Layer = 'domain' | 'store' | 'import' | 'ledger' | 'me' | 'cli' | 'web' | 'scripts';

const CODE_EXT = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.mts']);
const SCAN_ROOTS = ['src', 'apps/web', 'scripts'];

// 这一层允许的 node: 内置模块。'all' 表示命令行入口和脚本可以做进程级的事。
const NODE_OK: Record<Layer, 'all' | 'none' | readonly string[]> = {
  domain: 'none',
  store: ['sqlite', 'fs', 'path', 'os'],
  import: ['fs', 'path'],
  ledger: ['fs', 'path'],
  me: ['fs', 'path'],
  cli: 'all',
  web: 'none',
  scripts: 'all',
};

// 运行时不装 npm 包。截图脚本在本机可选地 require playwright，不进 dependencies。
const PKG_ALLOW: Record<string, readonly string[]> = {
  'scripts/screenshot.mjs': ['playwright'],
};

const PERSONAL = new Set([
  'SPEC_我的求职台.md',
  'scripts/sync-feishu.py',
  'scripts/com.korey.jobos-feishu-sync.plist',
]);

export function layerOf(file: string): Layer | null {
  const p = file.replaceAll('\\', '/').replace(/^\.\//, '');
  if (p === 'src/cli.ts') return 'cli';
  if (p.startsWith('src/domain/')) return 'domain';
  if (p.startsWith('src/store/')) return 'store';
  if (p.startsWith('src/import/')) return 'import';
  if (p.startsWith('src/ledger/')) return 'ledger';
  if (p.startsWith('src/me/')) return 'me';
  if (p.startsWith('apps/web/')) return 'web';
  if (p.startsWith('scripts/')) return 'scripts';
  return null;
}

export function resolveSpecifier(fromFile: string, specifier: string): string {
  if (specifier.startsWith('node:')) return specifier;
  if (specifier.startsWith('.')) {
    return posix.normalize(posix.join(posix.dirname(fromFile), specifier));
  }
  return `pkg:${specifier}`;
}

function stripExt(p: string): string {
  return p.replace(/\.(tsx?|mjs|cjs|jsx?)$/, '');
}

function nodeBuiltin(spec: string): string | null {
  if (!spec.startsWith('node:')) return null;
  const name = spec.slice('node:'.length).split('/')[0];
  return name || null;
}

function internalOk(from: Layer, target: string): boolean {
  const t = layerOf(target);
  const csv = stripExt(target) === 'src/import/csv';
  switch (from) {
    case 'domain':
      return t === 'domain';
    case 'store':
      return t === 'domain' || t === 'store';
    case 'import':
      return t === 'domain' || t === 'store' || t === 'import';
    case 'ledger':
      return t === 'domain' || t === 'ledger' || csv;
    case 'me':
      return t === 'domain' || t === 'me' || t === 'ledger' || csv;
    case 'cli':
      return t === 'domain' || t === 'store' || t === 'import' || t === 'ledger' || t === 'me';
    case 'web':
      return t === 'web';
    case 'scripts':
      return t === 'scripts' || target.startsWith('src/');
    default:
      return false;
  }
}

function fixLine(fix: string): string {
  return `  改法：${fix}`;
}

function explain(fromFile: string, resolved: string): { why: string; fix: string } {
  const from = layerOf(fromFile);
  const builtin = nodeBuiltin(resolved);
  if (resolved.startsWith('pkg:')) {
    const name = resolved.slice(4);
    return {
      why: `运行时代码不依赖 npm 包（package.json 没有 dependencies），不能引用 \`${name}\`。`,
      fix: '改用 node: 内置模块或 src/ 里的代码。本机可选的截图工具只允许 scripts/screenshot.mjs 引用 playwright，且不能写进 dependencies。',
    };
  }
  if (from === 'domain') {
    return {
      why: 'src/domain 是资格、排序和解析用的纯函数，网页生成物和 CLI 共用它。它不能读数据库、文件、台账或个人模式。',
      fix: '让 src/store、src/import、src/ledger、src/me 或 src/cli.ts 去调用 domain，把已经准备好的数据传进去。',
    };
  }
  if (from === 'web') {
    return {
      why: 'apps/web 在浏览器里运行，只能引用 apps/web 里面的模块。',
      fix: '领域逻辑改 src/domain，然后运行 npm run build:web，页面引用生成出来的 apps/web/lib/*.js。',
    };
  }
  if (from === 'ledger' && resolved.startsWith('src/me/')) {
    return {
      why: 'src/ledger 把台账写回磁盘；src/me 是个人模式，live.ts 会调用 writer。ledger 再去 import me，两层就缠在一起。',
      fix: '两边都要用的纯函数下沉到 src/domain，ledger 和 me 都引用 domain。',
    };
  }
  if (from === 'store' && (resolved.startsWith('src/import/') || resolved.startsWith('src/ledger/') || resolved.startsWith('src/me/') || resolved.startsWith('src/cli.ts'))) {
    return {
      why: 'src/store 只把领域数据放进 SQLite。导入、台账写回和个人模式应该调用 store，而不是被 store 调用。',
      fix: '在 src/import、src/ledger 或 src/me 里调用 store 已经导出的函数。',
    };
  }
  if (from === 'import' && (resolved.startsWith('src/me/') || resolved.startsWith('src/ledger/') || resolved === 'src/cli.ts' || resolved.startsWith('scripts/') || resolved.startsWith('apps/'))) {
    return {
      why: 'src/import 把外部文件读进 store。台账写回和个人模式在这一层上面。',
      fix: '在 src/ledger 或 src/me 里调用 import。共用的 CSV 解析只放在 src/import/csv.ts。',
    };
  }
  if (from === 'me' && (resolved.startsWith('src/store/') || (resolved.startsWith('src/import/') && stripExt(resolved) !== 'src/import/csv'))) {
    return {
      why: '个人模式走 CSV 台账和 private/ 数据，不走 CLI 的 SQLite，也不调用 import 里那些写入数据库的入口。',
      fix: '解析 CSV 用 src/import/csv.ts，写台账用 src/ledger，判断规则用 src/domain。',
    };
  }
  if (from === 'cli' && (resolved.startsWith('apps/') || resolved.startsWith('scripts/'))) {
    return {
      why: 'src/cli.ts 是命令行入口，不引用浏览器包，也不引用 scripts。',
      fix: '把要共用的逻辑放进 src/，让 cli 和 scripts 各自引用 src。',
    };
  }
  if (from === 'scripts' && resolved.startsWith('apps/')) {
    return {
      why: 'scripts 可以组合 src 和 Node 内置模块，但不引用浏览器包 apps/web。',
      fix: '脚本直接读文件或调用 src。浏览器代码留在 apps/web。',
    };
  }
  if (builtin && from) {
    const ok = NODE_OK[from];
    const allowed = ok === 'all' ? '任意 node: 内置模块' : ok === 'none' ? '不能使用 node: 内置模块' : ok.map((m) => `node:${m}`).join('、');
    return {
      why: `${fromFile} 属于 ${from}。这一层${ok === 'none' ? '不能碰 Node 内置模块' : `只能使用 ${allowed}`}，不能使用 ${resolved}。`,
      fix: '把这种访问挪到已经负责它的层：SQLite 在 src/store，进程级的事在 src/cli.ts 或 scripts/。',
    };
  }
  return {
    why: `${from ?? '未知层'} 不能依赖 ${resolved}。允许的方向是 domain ← store ← import；domain 和 src/import/csv.ts ← ledger；domain、src/import/csv.ts、ledger ← me；最外层是 src/cli.ts、scripts、apps/web。`,
    fix: '把被依赖的纯逻辑下移到更低的层，或者在更高的层调用低层，不要反向 import。',
  };
}

export function importViolation(fromFile: string, line: number, specifier: string): string | null {
  const from = layerOf(fromFile);
  if (!from) {
    if (fromFile.startsWith('src/')) {
      return [
        `${fromFile}:${line}`,
        `  禁止的 import：${specifier}`,
        '  原因：src 下面只允许 domain、store、import、ledger、me 和 cli.ts。这个文件没有分层，检查无法判断它能依赖谁。',
        fixLine('放到已有的层里。如果确实要新的一层，先改 scripts/check-boundaries.ts，并同步 README 和 AGENTS.md。'),
      ].join('\n');
    }
    return null;
  }
  const resolved = resolveSpecifier(fromFile, specifier);
  if (resolved.startsWith('pkg:')) {
    const name = resolved.slice(4);
    if (PKG_ALLOW[fromFile]?.includes(name)) return null;
  } else if (nodeBuiltin(resolved)) {
    const ok = NODE_OK[from];
    const mod = nodeBuiltin(resolved)!;
    if (ok === 'all' || (ok !== 'none' && ok.includes(mod))) return null;
  } else if (internalOk(from, resolved)) {
    return null;
  } else if (!resolved.startsWith('src/') && !resolved.startsWith('apps/') && !resolved.startsWith('scripts/') && !resolved.startsWith('pkg:') && !resolved.startsWith('node:')) {
    // absolute or escaped path
  }
  const { why, fix } = explain(fromFile, resolved);
  return [
    `${fromFile}:${line}`,
    `  禁止的 import：${specifier}`,
    `  解析到：${resolved}`,
    `  原因：${why}`,
    fixLine(fix),
  ].join('\n');
}

export function privatePathViolation(trackedPath: string): string | null {
  const p = trackedPath.replaceAll('\\', '/');
  const base = p.slice(p.lastIndexOf('/') + 1);
  const inExamples = p === 'examples' || p.startsWith('examples/');
  const problem = (why: string, fix: string) => [`已跟踪的私有文件 ${p}`, `  原因：${why}`, fixLine(fix)].join('\n');

  if (/\.(db|sqlite|sqlite3|db-wal|db-shm)$/i.test(base)) {
    return problem(
      '*.db / *.sqlite 是本地数据库。仓库只放代码和虚构示例，不放运行时数据。',
      '运行 git rm --cached -- 这个文件，并确认 .gitignore 含有 *.db。数据库放在 ~/.job-os/。',
    );
  }
  if (p === 'data' || p.startsWith('data/')) {
    return problem(
      '根目录 data/ 是本机数据。演示数据在 apps/web/data/，不要把两者混在一起。',
      '运行 git rm -r --cached -- data，并保留 .gitignore 里的 /data/。',
    );
  }
  if (p === 'private' || p.startsWith('private/') || p === 'data-private' || p.startsWith('data-private/')) {
    return problem(
      'private/ 和 data-private/ 是个人模式的本机数据，不能进仓库。',
      '运行 git rm -r --cached 去掉这些路径。个人数据留在仓库外面。',
    );
  }
  if (PERSONAL.has(p)) {
    return problem(
      '这是个人工具或本机配置，.gitignore 已经把它们排除在外。',
      '运行 git rm --cached -- 这个文件，不要把它加回来。',
    );
  }
  const resumeName = base.toLowerCase();
  if (!inExamples && (p.includes('简历') || resumeName.includes('resume') || /^cv\.[a-z0-9]+$/.test(resumeName))) {
    return problem(
      '文件名看起来是真实简历。仓库里的示例只能是虚构的，并且放在 examples/。',
      '把文件移出 git。如果只是虚构样本，放到 examples/ 并改成明显的示例名，例如 examples/resume.sample.pdf。',
    );
  }
  if (!inExamples && p.includes('台账')) {
    return problem(
      '文件名里的「台账」看起来是真实投递记录。仓库只保留 examples/ 下的虚构样本。',
      '把文件移出仓库。虚构样本用 examples/ledger.sample.csv 这种路径。',
    );
  }
  return null;
}

type Spec = { line: number; specifier: string };

const EXPR_AFTER = new Set(['return', 'case', 'throw', 'typeof', 'void', 'delete', 'await', 'yield', 'new', 'in', 'of', 'else', 'extends', 'instanceof']);

export function listSpecifiers(source: string): Spec[] {
  const out: Spec[] = [];
  const s = source;
  const n = s.length;
  let i = 0;
  let line = 1;
  let exprAllowed = true;

  function skipSpaces(markBreak: { value: boolean } | null): void {
    while (i < n) {
      const c = s[i];
      if (c === ' ' || c === '\t' || c === '\r' || c === '\f') { i++; continue; }
      if (c === '\n') { line++; i++; if (markBreak) markBreak.value = true; continue; }
      if (c === '/' && s[i + 1] === '/') { while (i < n && s[i] !== '\n') i++; continue; }
      if (c === '/' && s[i + 1] === '*') {
        i += 2;
        while (i + 1 < n && !(s[i] === '*' && s[i + 1] === '/')) { if (s[i] === '\n') line++; i++; }
        i = Math.min(n, i + 2);
        continue;
      }
      return;
    }
  }

  function readIdent(): string {
    const start = i;
    i++;
    while (i < n && /[A-Za-z0-9_$]/.test(s[i] ?? '')) i++;
    return s.slice(start, i);
  }

  function peekIdent(): string {
    let j = i;
    const start = j;
    j++;
    while (j < n && /[A-Za-z0-9_$]/.test(s[j] ?? '')) j++;
    return s.slice(start, j);
  }

  function readPlain(q: '"' | "'"): string {
    i++;
    let v = '';
    while (i < n && s[i] !== '\n') {
      if (s[i] === '\\') { v += s[i + 1] ?? ''; i += 2; continue; }
      if (s[i] === q) { i++; return v; }
      v += s[i++];
    }
    return v;
  }

  function skipRegex(): void {
    i++;
    while (i < n && s[i] !== '\n') {
      if (s[i] === '\\') { i += 2; continue; }
      if (s[i] === '[') {
        i++;
        while (i < n && s[i] !== '\n' && s[i] !== ']') { if (s[i] === '\\') i += 2; else i++; }
        if (s[i] === ']') i++;
        continue;
      }
      if (s[i] === '/') { i++; break; }
      i++;
    }
    while (i < n && /[dgimsuvy]/.test(s[i] ?? '')) i++;
  }

  function scanTemplate(): void {
    i++;
    while (i < n) {
      if (s[i] === '\\') { i += 2; continue; }
      if (s[i] === '\n') { line++; i++; continue; }
      if (s[i] === '`') { i++; return; }
      if (s[i] === '$' && s[i + 1] === '{') { i += 2; scanUntilBrace(); continue; }
      i++;
    }
  }

  function scanUntilBrace(): void {
    let depth = 1;
    while (i < n && depth > 0) {
      skipSpaces(null);
      if (i >= n) return;
      const c = s[i];
      if (c === '{') { depth++; i++; continue; }
      if (c === '}') { depth--; i++; continue; }
      if (c === "'" || c === '"') { readPlain(c); continue; }
      if (c === '`') { scanTemplate(); continue; }
      if (c === '/' && s[i + 1] !== '/' && s[i + 1] !== '*') { skipRegex(); continue; }
      if (/[A-Za-z_$]/.test(c)) {
        const startLine = line;
        const word = readIdent();
        if (word === 'import' || word === 'require') takeCall(word, startLine);
        continue;
      }
      i++;
    }
  }

  function takeCall(word: string, startLine: number): void {
    const save = i;
    const saveLine = line;
    skipSpaces(null);
    if (word === 'import' && s[i] === '.') { i = save; line = saveLine; return; }
    if (s[i] !== '(') { i = save; line = saveLine; return; }
    i++;
    skipSpaces(null);
    if (s[i] === '"' || s[i] === "'") out.push({ line: startLine, specifier: readPlain(s[i] as '"' | "'") });
  }

  function consumeDeclaration(kind: 'import' | 'export', startLine: number): void {
    let depth = 0;
    let sawFrom = false;
    let sawIdent = false;
    const br = { value: false };
    while (i < n) {
      br.value = false;
      skipSpaces(br);
      if (i >= n) return;
      if (depth === 0 && br.value && /[A-Za-z_$]/.test(s[i] ?? '')) {
        const peek = peekIdent();
        if (peek === 'import' || peek === 'export') return;
      }
      const c = s[i];
      if (c === ';' && depth === 0) { i++; return; }
      if (c === '{' || c === '(' || c === '[') { depth++; i++; continue; }
      if (c === '}' || c === ')' || c === ']') { depth--; i++; continue; }
      if (c === "'" || c === '"') {
        const specLine = line;
        const lit = readPlain(c);
        if (depth === 0 && (sawFrom || (kind === 'import' && !sawIdent))) out.push({ line: specLine, specifier: lit });
        if (depth === 0 && (sawFrom || (kind === 'import' && !sawIdent))) return;
        continue;
      }
      if (c === '`') { scanTemplate(); continue; }
      if (c === '/' && s[i + 1] !== '/' && s[i + 1] !== '*') { skipRegex(); continue; }
      if (/[A-Za-z_$]/.test(c)) {
        const word = readIdent();
        sawIdent = true;
        if (word === 'from' && depth === 0) sawFrom = true;
        else if ((word === 'import' || word === 'require') && depth > 0) takeCall(word, line);
        continue;
      }
      i++;
    }
  }

  while (i < n) {
    skipSpaces(null);
    if (i >= n) break;
    const c = s[i];
    if (c === "'" || c === '"') { readPlain(c); exprAllowed = false; continue; }
    if (c === '`') { scanTemplate(); exprAllowed = false; continue; }
    if (c === '/' && s[i + 1] === '/') { while (i < n && s[i] !== '\n') i++; continue; }
    if (c === '/' && s[i + 1] === '*') {
      i += 2;
      while (i + 1 < n && !(s[i] === '*' && s[i + 1] === '/')) { if (s[i] === '\n') line++; i++; }
      i = Math.min(n, i + 2);
      continue;
    }
    if (c === '/' && exprAllowed) { skipRegex(); exprAllowed = false; continue; }
    if (/[A-Za-z_$]/.test(c)) {
      const startLine = line;
      const word = readIdent();
      if (exprAllowed && word === 'import') {
        const save = i;
        const saveLine = line;
        skipSpaces(null);
        if (s[i] === '.') { i = save; line = saveLine; exprAllowed = false; continue; }
        if (s[i] === '(') { i = save; line = saveLine; takeCall('import', startLine); exprAllowed = false; continue; }
        consumeDeclaration('import', startLine);
        exprAllowed = true;
        continue;
      }
      if (exprAllowed && word === 'export') {
        consumeDeclaration('export', startLine);
        exprAllowed = true;
        continue;
      }
      if (word === 'require' && exprAllowed) { takeCall('require', startLine); exprAllowed = false; continue; }
      exprAllowed = EXPR_AFTER.has(word);
      continue;
    }
    if ('([{=,:;?+-*%^~!&|<>'.includes(c)) { exprAllowed = true; i++; continue; }
    if (c === ')' || c === ']' || c === '}') { exprAllowed = false; i++; continue; }
    if (c >= '0' && c <= '9') {
      while (i < n && /[0-9A-Za-z_.]/.test(s[i] ?? '')) i++;
      exprAllowed = false;
      continue;
    }
    i++;
  }
  return out;
}

function toPosix(root: string, file: string): string {
  return relative(root, file).split(sep).join('/');
}

function walk(dir: string, acc: string[]): void {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const ent of entries) {
    if (ent.name === 'node_modules' || ent.name.startsWith('.')) continue;
    const p = join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (CODE_EXT.has(extname(ent.name))) acc.push(p);
  }
}

export function checkSource(file: string, source: string): string[] {
  const messages: string[] = [];
  if (file.startsWith('src/') && !layerOf(file)) {
    messages.push([
      file,
      '  原因：src 下面只允许 domain、store、import、ledger、me 和 cli.ts。这个文件没有分层。',
      fixLine('放到已有的层里。如果确实要新的一层，先改 scripts/check-boundaries.ts，并同步 README 和 AGENTS.md。'),
    ].join('\n'));
  }
  for (const spec of listSpecifiers(source)) {
    const msg = importViolation(file, spec.line, spec.specifier);
    if (msg) messages.push(msg);
  }
  return messages;
}

function trackedFiles(root: string): string[] {
  const r = spawnSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr || 'git ls-files 失败');
  return r.stdout.split('\0').filter(Boolean);
}

export function checkRepo(root: string): string[] {
  const messages: string[] = [];
  const files: string[] = [];
  for (const dir of SCAN_ROOTS) walk(join(root, dir), files);
  for (const file of files) {
    let source: string;
    try {
      if (!statSync(file).isFile()) continue;
      source = readFileSync(file, 'utf8');
    } catch (e) {
      messages.push(`${toPosix(root, file)}\n  原因：读不到这个文件（${(e as Error).message}）。\n${fixLine('确认文件还在，并且是文本。')}`);
      continue;
    }
    messages.push(...checkSource(toPosix(root, file), source));
  }
  let tracked: string[];
  try { tracked = trackedFiles(root); }
  catch (e) {
    messages.push(`git ls-files\n  原因：无法列出已跟踪文件（${(e as Error).message}）。\n${fixLine('在仓库根目录运行这个检查。')}`);
    return messages;
  }
  for (const p of tracked) {
    const msg = privatePathViolation(p);
    if (msg) messages.push(msg);
  }
  return messages;
}

const isDirect = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const messages = checkRepo(root);
  if (messages.length) {
    console.error(messages.join('\n\n'));
    console.error(`\n${messages.length} 个边界问题。`);
    process.exit(1);
  }
  console.log('boundaries: ok');
}
