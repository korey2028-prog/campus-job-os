import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, normalize, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { existsSync, readFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { mePaths, loadLive, handleApi } from '../src/me/live.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'web');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };

const json = (res, status, body, req) => {
  const buf = Buffer.from(JSON.stringify(body));
  // 个人模式的数据有几 MB，手机上走 gzip
  if (req && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) { res.writeHead(status, { 'content-type': TYPES['.json'], 'cache-control': 'no-store', 'content-encoding': 'gzip' }).end(gzipSync(buf)); return; }
  res.writeHead(status, { 'content-type': TYPES['.json'], 'cache-control': 'no-store' }).end(buf);
};
function readBody(req) {
  return new Promise((ok, no) => {
    let n = 0; const chunks = [];
    req.on('data', (c) => { n += c.length; if (n > 1e6) { no(new Error('body too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => ok(Buffer.concat(chunks).toString('utf8')));
    req.on('error', no);
  });
}

// me=true：个人模式，/data/demo.json 换成本人数据，并开放写回接口（只监听本机）
export function start(port = 5178, host = '127.0.0.1', { me = false } = {}) {
  const paths = me ? mePaths(join(root, '..', '..')) : null;
  const server = createServer(async (req, res) => {
    try {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (me) {
        if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) { json(res, 403, { error: 'bad origin' }); return; }
        if (p.startsWith('/api/')) {
          let body = null;
          if (req.method === 'POST') { try { body = JSON.parse((await readBody(req)) || 'null'); } catch { json(res, 400, { error: '请求体不是 JSON' }); return; } }
          const r = handleApi(paths, req.method, p, body);
          json(res, r.status, r.body); return;
        }
        if (p === '/data/demo.json') { json(res, 200, loadLive(paths), req); return; }
      }
      if (p.endsWith('/')) p += 'index.html';
      const file = normalize(join(root, p));
      if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
      await stat(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
      let buf = await readFile(file);
      if (me && p === '/index.html') buf = Buffer.from(buf.toString('utf8').replace('求职控制台 · 演示', '我的求职台'));
      res.end(buf);
    } catch { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not found'); }
  });
  return new Promise((ok) => server.listen(port, host, () => ok(server)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const me = process.argv.includes('--me');
  await start(me ? 5179 : 5178, '127.0.0.1', { me });
  console.log(me ? 'job-os 我的求职台: http://127.0.0.1:5179/' : 'job-os demo: http://127.0.0.1:5178/');
  if (me) autoSync();
}

// 个人模式：求职台开着时自己负责每日同步（launchd 后台进程读不了“文稿”目录）。
// 启动时和之后每 30 分钟看一次，上次成功同步超过 12 小时就跑；同步脚本只在本机，不在仓库里。
function autoSync() {
  const here = dirname(fileURLToPath(import.meta.url));
  const script = join(here, 'sync-feishu.py'), log = join(here, '..', '..', 'data-private', '同步日志.jsonl');
  if (!existsSync(script)) return;
  let running = false;
  const lastOk = () => {
    try { const ok = readFileSync(log, 'utf8').trim().split('\n').map((l) => JSON.parse(l)).filter((e) => e.ok).pop(); return ok ? Date.parse(ok.at) : 0; } catch { return 0; }
  };
  const tick = () => {
    if (running || Date.now() - lastOk() < 12 * 3600e3) return;
    running = true;
    console.log('开始同步岗位数据…');
    execFile('python3', [script], { timeout: 15 * 60e3 }, (err, out, errOut) => {
      running = false;
      console.log(err ? `同步失败：${(errOut || err.message).trim().split('\n').pop()}` : out.trim());
    });
  };
  tick();
  setInterval(tick, 30 * 60e3).unref();
}
