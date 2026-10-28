export type GradWindow = { from: string; to: string };
export type Deadline =
  | { kind: 'date'; date: string }
  | { kind: 'rolling' }
  | { kind: 'unknown'; raw: string };
export type Degree = '大专' | '本科' | '硕士' | '博士';
export type Verdict = '可投' | '不可投' | '待确认';
export type Eligibility = { verdict: Verdict; reasons: string[] };
export type SourceRef = { url: string; kind: string; fetchedAt?: string };
export type Posting = {
  id?: number;
  company: string;
  title: string;
  rawText?: string;
  sources: SourceRef[];
};
export type Position = {
  id?: number;
  company: string;
  title: string;
  batch: string;
  gradWindow: GradWindow | null;
  minDegree?: Degree;
  downwardCompatible: boolean;
  degrees: Degree[];
  majors: string[];
  cities: string[];
  deadline: Deadline;
};
export type CandidateProfile = {
  gradDate: string;
  degree: Degree;
  major?: string;
  city?: string;
};
export const STAGES = [
  'candidate', 'verify', 'preparing', 'drafted', 'submitted',
  'offline_received', 'interviewing', 'closed_source', 'stopped', 'unknown',
] as const;
export type StageEnum = (typeof STAGES)[number];
export type Stage = { enum: StageEnum; raw: string };
export type Application = {
  localId: string;
  positionId: number | null;
  company: string;
  role: string;
  officialUrl: string;
  stage: Stage;
  nextAction: string;
  nextActionDate: string;
  lastEventAt: string;
  resumePath: string;
  notes: string;
};
