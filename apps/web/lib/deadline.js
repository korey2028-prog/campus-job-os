// 自动生成，请改 src/domain/deadline.ts 后运行 npm run build:web
                                           

const ROLLING = /招满即止|额满即止|招满为止/;

function iso(y        , m        , d        )                {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return null;
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function parseDeadline(input        , refYear         )           {
  const raw = (input ?? '').trim();
  if (ROLLING.test(raw)) return { kind: 'rolling' };
  let m = raw.match(/^(\d{4})\s*[/.\-年]\s*(\d{1,2})\s*[/.\-月]\s*(\d{1,2})\s*日?$/);
  if (m) {
    const d = iso(Number(m[1]), Number(m[2]), Number(m[3]));
    if (d) return { kind: 'date', date: d };
  }
  m = raw.match(/^(\d{1,2})\s*月\s*(\d{1,2})\s*日?$/);
  if (m && refYear !== undefined) {
    const d = iso(refYear, Number(m[1]), Number(m[2]));
    if (d) return { kind: 'date', date: d };
  }
  return { kind: 'unknown', raw };
}

export function isExpired(deadline          , today        )          {
  return deadline.kind === 'date' && deadline.date < today;
}
