import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { homedir } from 'node:os';
import type { Application, Deadline, Degree, GradWindow, Position } from '../domain/types.ts';
import { normalizeCompany, positionKey } from '../domain/dedupe.ts';

export type Db = DatabaseSync;

export const DEFAULT_DB = `${homedir()}/.job-os/job-os.db`;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS postings(
  id INTEGER PRIMARY KEY, company TEXT NOT NULL, company_norm TEXT NOT NULL, title TEXT NOT NULL,
  raw_text TEXT, source_updated_at TEXT, last_verified_at TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sources(
  id INTEGER PRIMARY KEY, posting_id INTEGER NOT NULL REFERENCES postings(id), url TEXT NOT NULL, kind TEXT NOT NULL,
  fetched_at TEXT, UNIQUE(posting_id, url, kind));
CREATE TABLE IF NOT EXISTS positions(
  id INTEGER PRIMARY KEY, posting_id INTEGER NOT NULL REFERENCES postings(id), title TEXT NOT NULL, batch TEXT,
  grad_from TEXT, grad_to TEXT, min_degree TEXT, downward_compatible INTEGER NOT NULL DEFAULT 1,
  degrees_json TEXT, majors_json TEXT, cities_json TEXT,
  deadline_kind TEXT, deadline_date TEXT, deadline_raw TEXT, position_key TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS field_conflicts(
  id INTEGER PRIMARY KEY, position_id INTEGER NOT NULL REFERENCES positions(id), field TEXT NOT NULL,
  existing TEXT, incoming TEXT, source_id INTEGER, at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS field_provenance(
  position_id INTEGER NOT NULL REFERENCES positions(id), field TEXT NOT NULL, source_id INTEGER,
  method TEXT NOT NULL CHECK(method IN ('官方原文','规则解析','AI抽取','人工录入','第三方数据包')),
  obtained_at TEXT NOT NULL, confidence_source TEXT, confidence_field TEXT, verified_at TEXT, raw_value TEXT,
  PRIMARY KEY(position_id, field));
CREATE TABLE IF NOT EXISTS applications(
  local_id TEXT PRIMARY KEY, position_id INTEGER REFERENCES positions(id), company TEXT, role TEXT, official_url TEXT,
  stage_enum TEXT, stage_raw TEXT, next_action TEXT, next_action_date TEXT, last_event_at TEXT,
  resume_path TEXT, notes TEXT, imported_from TEXT, imported_at TEXT);
`;

export function openDb(path: string = DEFAULT_DB): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(SCHEMA);
  return db;
}

const now = () => new Date().toISOString();

export const METHODS = ['官方原文', '规则解析', 'AI抽取', '人工录入', '第三方数据包'] as const;
export type Method = (typeof METHODS)[number];
export type FieldName = 'grad_window' | 'degree' | 'majors' | 'cities' | 'deadline';
export type Prov = { method: Method; raw?: string };

export type PositionInput = Omit<Position, 'id'> & {
  rawText?: string; url?: string; sourceKind?: string; obtainedAt?: string;
  prov?: Partial<Record<FieldName, Prov>>;
};

const DL_RANK = { date: 3, rolling: 2, unknown: 1 } as const;
const dlText = (d: Deadline) => (d.kind === 'date' ? d.date : d.kind === 'rolling' ? '招满即止' : `未知(${d.raw})`);

export function sourceConfidence(url: string): '高' | '中' | '低' {
  if (!url) return '低';
  return /^https?:\/\//i.test(url) ? '中' : '低';
}
export function fieldConfidence(m: Method): '高' | '中' {
  return m === 'AI抽取' || m === '第三方数据包' ? '中' : '高';
}

function writeProv(db: Db, positionId: number, field: FieldName, p: Prov, sourceId: number | null, at: string, url: string): void {
  db.prepare(`INSERT OR REPLACE INTO field_provenance(position_id,field,source_id,method,obtained_at,confidence_source,confidence_field,verified_at,raw_value)
    VALUES(?,?,?,?,?,?,?,NULL,?)`).run(positionId, field, sourceId, p.method, at, sourceConfidence(url), fieldConfidence(p.method), p.raw ?? null);
}

export function upsertPosition(db: Db, p: PositionInput): { positionId: number; postingId: number; created: boolean; sourceAdded: boolean; conflicts: number } {
  const key = positionKey(p.company, p.title, p.batch, p.gradWindow);
  const url = p.url ?? '';
  const kind = p.sourceKind ?? 'manual';
  const at = p.obtainedAt ?? now();
  const existing = db.prepare('SELECT id, posting_id FROM positions WHERE position_key=?').get(key) as { id: number; posting_id: number } | undefined;
  let postingId: number;
  let positionId: number;
  let created = false;
  if (existing) {
    postingId = existing.posting_id;
    positionId = existing.id;
  } else {
    postingId = Number(db.prepare('INSERT INTO postings(company,company_norm,title,raw_text,created_at) VALUES(?,?,?,?,?)')
      .run(p.company, normalizeCompany(p.company), p.title, p.rawText ?? null, now()).lastInsertRowid);
    const d = p.deadline;
    positionId = Number(db.prepare(`INSERT INTO positions(posting_id,title,batch,grad_from,grad_to,min_degree,downward_compatible,
      degrees_json,majors_json,cities_json,deadline_kind,deadline_date,deadline_raw,position_key) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(postingId, p.title, p.batch, p.gradWindow?.from ?? null, p.gradWindow?.to ?? null, p.minDegree ?? null,
        p.downwardCompatible ? 1 : 0, JSON.stringify(p.degrees), JSON.stringify(p.majors), JSON.stringify(p.cities),
        d.kind, d.kind === 'date' ? d.date : null, d.kind === 'unknown' ? d.raw : null, key).lastInsertRowid);
    created = true;
  }
  let sourceAdded = false;
  let sourceId: number | null = null;
  if (url) {
    const r = db.prepare('INSERT OR IGNORE INTO sources(posting_id,url,kind,fetched_at) VALUES(?,?,?,?)').run(postingId, url, kind, at);
    sourceAdded = Number(r.changes) > 0;
    sourceId = (db.prepare('SELECT id FROM sources WHERE posting_id=? AND url=? AND kind=?').get(postingId, url, kind) as { id: number }).id;
  }
  const prov = p.prov ?? {};
  let conflicts = 0;
  const conflict = (field: string, ex: string, inc: string) => {
    conflicts++;
    db.prepare('INSERT INTO field_conflicts(position_id,field,existing,incoming,source_id,at) VALUES(?,?,?,?,?,?)').run(positionId, field, ex, inc, sourceId, at);
  };
  const setProv = (f: FieldName) => { if (prov[f]) writeProv(db, positionId, f, prov[f]!, sourceId, at, url); };

  if (created) {
    (['grad_window', 'degree', 'majors', 'cities', 'deadline'] as FieldName[]).forEach(setProv);
  } else {
    const cur = listPositions(db).find((x) => x.id === positionId)!;
    // deadline
    const a = cur.deadline, b = p.deadline;
    let take = false;
    if (DL_RANK[b.kind] > DL_RANK[a.kind]) take = true;
    else if (a.kind === 'date' && b.kind === 'date' && a.date !== b.date) {
      const prev = db.prepare("SELECT obtained_at FROM field_provenance WHERE position_id=? AND field='deadline'").get(positionId) as { obtained_at: string } | undefined;
      take = at > (prev?.obtained_at ?? '');
      conflict('deadline', dlText(a), dlText(b));
    }
    if (take) {
      db.prepare('UPDATE positions SET deadline_kind=?, deadline_date=?, deadline_raw=? WHERE id=?')
        .run(b.kind, b.kind === 'date' ? b.date : null, b.kind === 'unknown' ? b.raw : null, positionId);
      setProv('deadline');
    }
    // degree
    if (p.minDegree) {
      if (!cur.minDegree) {
        db.prepare('UPDATE positions SET min_degree=?, downward_compatible=?, degrees_json=? WHERE id=?')
          .run(p.minDegree, p.downwardCompatible ? 1 : 0, JSON.stringify(cur.degrees.length ? cur.degrees : p.degrees), positionId);
        setProv('degree');
      } else if (cur.minDegree !== p.minDegree) conflict('degree', cur.minDegree, p.minDegree);
    }
    // lists
    for (const [f, col, curV, incV] of [['majors', 'majors_json', cur.majors, p.majors], ['cities', 'cities_json', cur.cities, p.cities]] as const) {
      if (!incV.length) continue;
      if (!curV.length) {
        db.prepare(`UPDATE positions SET ${col}=? WHERE id=?`).run(JSON.stringify(incV), positionId);
        setProv(f);
      } else if (JSON.stringify(curV) !== JSON.stringify(incV)) conflict(f, curV.join(','), incV.join(','));
    }
  }
  return { positionId, postingId, created, sourceAdded, conflicts };
}

export type Detail = {
  sourceUrls: string[];
  sources: { id: number; url: string; kind: string; obtained_at: string | null }[];
  provenance: { field: string; source_id: number | null; method: Method; obtained_at: string; confidence_source: string; confidence_field: string; verified_at: string | null; raw_value: string | null }[];
  conflicts: { field: string; existing: string; incoming: string; source_id: number | null; at: string }[];
};

export function getDetail(db: Db, positionId: number): Detail {
  const pid = (db.prepare('SELECT posting_id FROM positions WHERE id=?').get(positionId) as { posting_id: number }).posting_id;
  const sources = db.prepare('SELECT id,url,kind,fetched_at AS obtained_at FROM sources WHERE posting_id=? ORDER BY id').all(pid) as Detail['sources'];
  return {
    sources, sourceUrls: sources.map((s) => s.url),
    provenance: db.prepare('SELECT field,source_id,method,obtained_at,confidence_source,confidence_field,verified_at,raw_value FROM field_provenance WHERE position_id=? ORDER BY field').all(positionId) as Detail['provenance'],
    conflicts: db.prepare('SELECT field,existing,incoming,source_id,at FROM field_conflicts WHERE position_id=? ORDER BY id').all(positionId) as Detail['conflicts'],
  };
}

export function linkApplication(db: Db, localId: string, positionId: number): void {
  if (!db.prepare('SELECT 1 FROM positions WHERE id=?').get(positionId)) throw new Error(`岗位 #${positionId} 不存在`);
  const r = db.prepare('UPDATE applications SET position_id=? WHERE local_id=?').run(positionId, localId);
  if (Number(r.changes) === 0) throw new Error(`申请 ${localId} 不存在`);
}

export function upsertLocalPosting(db: Db, o: { path: string; company: string; title: string; rawText: string }): { postingId: number; created: boolean } {
  const row = db.prepare("SELECT posting_id FROM sources WHERE url=? AND kind='local-file'").get(o.path) as { posting_id: number } | undefined;
  if (row) {
    db.prepare('UPDATE postings SET company=?, company_norm=?, title=?, raw_text=? WHERE id=?')
      .run(o.company, normalizeCompany(o.company), o.title, o.rawText, row.posting_id);
    return { postingId: row.posting_id, created: false };
  }
  const id = Number(db.prepare('INSERT INTO postings(company,company_norm,title,raw_text,created_at) VALUES(?,?,?,?,?)')
    .run(o.company, normalizeCompany(o.company), o.title, o.rawText, now()).lastInsertRowid);
  db.prepare("INSERT INTO sources(posting_id,url,kind,fetched_at) VALUES(?,?,'local-file',?)").run(id, o.path, now());
  return { postingId: id, created: true };
}

export function upsertApplication(db: Db, a: Application, importedFrom: string): 'inserted' | 'updated' {
  const exists = db.prepare('SELECT 1 FROM applications WHERE local_id=?').get(a.localId);
  db.prepare(`INSERT INTO applications(local_id,position_id,company,role,official_url,stage_enum,stage_raw,next_action,next_action_date,
    last_event_at,resume_path,notes,imported_from,imported_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(local_id) DO UPDATE SET company=excluded.company, role=excluded.role, official_url=excluded.official_url,
    stage_enum=excluded.stage_enum, stage_raw=excluded.stage_raw, next_action=excluded.next_action,
    next_action_date=excluded.next_action_date, last_event_at=excluded.last_event_at, resume_path=excluded.resume_path,
    notes=excluded.notes, imported_from=excluded.imported_from, imported_at=excluded.imported_at`)
    .run(a.localId, a.positionId, a.company, a.role, a.officialUrl, a.stage.enum, a.stage.raw, a.nextAction, a.nextActionDate,
      a.lastEventAt, a.resumePath, a.notes, importedFrom, now());
  return exists ? 'updated' : 'inserted';
}

export function getApplication(db: Db, localId: string): { company: string; role: string } | undefined {
  return db.prepare('SELECT company, role FROM applications WHERE local_id=?').get(localId) as { company: string; role: string } | undefined;
}

export type PositionRow = Position & { id: number; postingId: number; sourceCount: number };

export function listPositions(db: Db): PositionRow[] {
  const rows = db.prepare(`SELECT p.*, g.company AS company,
    (SELECT COUNT(*) FROM sources s WHERE s.posting_id=p.posting_id) AS sc
    FROM positions p JOIN postings g ON g.id=p.posting_id ORDER BY p.id`).all() as Record<string, any>[];
  return rows.map((r) => {
    const gradWindow: GradWindow | null = r.grad_from ? { from: r.grad_from, to: r.grad_to } : null;
    const deadline: Deadline = r.deadline_kind === 'date' ? { kind: 'date', date: r.deadline_date }
      : r.deadline_kind === 'rolling' ? { kind: 'rolling' } : { kind: 'unknown', raw: r.deadline_raw ?? '' };
    return {
      id: r.id, postingId: r.posting_id, sourceCount: r.sc, company: r.company, title: r.title, batch: r.batch ?? '',
      gradWindow, minDegree: (r.min_degree ?? undefined) as Degree | undefined, downwardCompatible: r.downward_compatible === 1,
      degrees: JSON.parse(r.degrees_json ?? '[]'), majors: JSON.parse(r.majors_json ?? '[]'),
      cities: JSON.parse(r.cities_json ?? '[]'), deadline,
    };
  });
}

export type AppRow = {
  position_id: number | null; local_id: string; company: string; role: string; stage_enum: string; stage_raw: string;
  next_action: string; next_action_date: string; last_event_at: string;
};

export function listApplications(db: Db): AppRow[] {
  return db.prepare('SELECT position_id,local_id,company,role,stage_enum,stage_raw,next_action,next_action_date,last_event_at FROM applications ORDER BY local_id').all() as AppRow[];
}

export function listPostings(db: Db): { id: number; company: string; title: string; sources: number }[] {
  return db.prepare('SELECT g.id, g.company, g.title, (SELECT COUNT(*) FROM sources s WHERE s.posting_id=g.id) AS sources FROM postings g ORDER BY g.id').all() as any;
}
