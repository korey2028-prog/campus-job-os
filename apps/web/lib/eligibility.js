// 自动生成，请改 src/domain/eligibility.ts 后运行 npm run build:web
                                                                                           
import { isExpired } from './deadline.js';

const RANK                         = { 大专: 1, 本科: 2, 硕士: 3, 博士: 4 };
const SEV                          = { 可投: 0, 待确认: 1, 不可投: 2 };

export function checkEligibility(position          , profile                  , today         )              {
  const reasons           = [];
  let verdict          = '可投';
  const worsen = (v         ) => { if (SEV[v] > SEV[verdict]) verdict = v; };

  // deadline
  const dl = position.deadline;
  if (today && isExpired(dl, today)) {
    worsen('不可投');
    reasons.push(`已截止（${dl.kind === 'date' ? dl.date : ''}）`);
  } else if (dl.kind === 'date') reasons.push(`截止日期 ${dl.date}，未过期`);
  else if (dl.kind === 'rolling') reasons.push('招满即止，截止日不固定');
  else reasons.push('截止日期未知');

  // grad window
  const w = position.gradWindow;
  if (!w) {
    worsen('待确认');
    reasons.push('届次无法解析');
  } else if (profile.gradDate < w.from || profile.gradDate > w.to) {
    worsen('不可投');
    reasons.push(`毕业时间 ${profile.gradDate} 不在 ${w.from} ~ ${w.to} 范围内`);
  } else reasons.push(`毕业时间 ${profile.gradDate} 在 ${w.from} ~ ${w.to} 范围内`);

  // degree
  const mine = RANK[profile.degree];
  if (position.downwardCompatible) {
    if (!position.minDegree) reasons.push('未限制学历');
    else if (mine >= RANK[position.minDegree]) reasons.push(`学历 ${profile.degree} 满足 ${position.minDegree}及以上`);
    else { worsen('不可投'); reasons.push(`学历 ${profile.degree} 低于要求 ${position.minDegree}`); }
  } else {
    const allowed           = position.degrees.length ? position.degrees : position.minDegree ? [position.minDegree] : [];
    if (!allowed.length) reasons.push('未限制学历');
    else if (allowed.includes(profile.degree)) reasons.push(`学历 ${profile.degree} 在要求之内（${allowed.join('/')}）`);
    else { worsen('不可投'); reasons.push(`学历 ${profile.degree} 不在要求之内（${allowed.join('/')}），不向下兼容`); }
  }

  // majors
  const majors = position.majors;
  if (majors.length === 0 || majors.includes('不限专业')) reasons.push('专业不限');
  else if (!profile.major) { worsen('待确认'); reasons.push(`岗位限专业（${majors.join('/')}），未提供本人专业`); }
  else if (majors.some((m) => m.includes(profile.major ) || profile.major .includes(m))) reasons.push(`专业 ${profile.major} 匹配`);
  else { worsen('待确认'); reasons.push(`专业 ${profile.major} 与要求（${majors.join('/')}）无明显匹配`); }

  return { verdict, reasons };
}
