import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseCsvRecords } from './csv.ts';
import { mapStage } from '../domain/stage.ts';
import { upsertApplication, type Db } from '../store/db.ts';

export const LEDGER_HEADER = 'local_id,company,role,official_url,jd_checked_at,hard_conditions,stage,resume_path,submission_evidence,last_event_at,next_action,next_action_date,notes';

export function importLedger(db: Db, csvPath: string): { rows: number; inserted: number; updated: number; unmappedStages: string[] } {
  const text = readFileSync(csvPath, 'utf-8');
  const first = text.replace(/^﻿/, '').split(/\r?\n/, 1)[0].trim();
  if (first !== LEDGER_HEADER) throw new Error('台账表头与预期不一致');
  const recs = parseCsvRecords(text);
  const unmapped = new Set<string>();
  let inserted = 0, updated = 0;
  db.exec('BEGIN');
  try {
    for (const r of recs) {
      if (!r.local_id) continue;
      const stage = mapStage(r.stage);
      if (stage.enum === 'unknown' && stage.raw) unmapped.add(stage.raw);
      const res = upsertApplication(db, {
        localId: r.local_id, positionId: null, company: r.company, role: r.role, officialUrl: r.official_url, stage,
        nextAction: r.next_action, nextActionDate: r.next_action_date, lastEventAt: r.last_event_at,
        resumePath: r.resume_path, notes: r.notes,
      }, resolve(csvPath));
      if (res === 'inserted') inserted++; else updated++;
    }
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  return { rows: recs.length, inserted, updated, unmappedStages: [...unmapped] };
}
