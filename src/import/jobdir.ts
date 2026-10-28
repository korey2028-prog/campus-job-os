import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { getApplication, upsertLocalPosting, type Db } from '../store/db.ts';

export function importJobDir(db: Db, dir: string): { dirs: number; created: number; updated: number } {
  let dirs = 0, created = 0, updated = 0;
  db.exec('BEGIN');
  try {
    for (const name of readdirSync(dir).sort()) {
      const sub = join(dir, name);
      const jd = join(sub, 'jd.md');
      if (!statSync(sub).isDirectory() || !existsSync(jd)) continue;
      const app = getApplication(db, name);
      const r = upsertLocalPosting(db, {
        path: resolve(jd), company: app?.company || name, title: app?.role || name, rawText: readFileSync(jd, 'utf-8'),
      });
      dirs++;
      if (r.created) created++; else updated++;
    }
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  return { dirs, created, updated };
}
