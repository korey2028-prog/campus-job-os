// 自动生成，请改 src/domain/grad.ts 后运行 npm run build:web
                                             

const TOKEN = '(?:\\d{4}|\\d{2})届?';
const FULL = new RegExp(`^${TOKEN}(?:\\s*[/、,，]\\s*${TOKEN})*$`);

export function parseGradWindow(input        )                    {
  const s = (input ?? '').trim();
  if (!s || !s.includes('届') || !FULL.test(s)) return null;
  const years = [...s.matchAll(/(\d{4}|\d{2})/g)].map((m) => {
    const n = Number(m[1]);
    return n >= 100 ? n : 2000 + n;
  });
  if (years.some((y) => y < 2000 || y > 2099)) return null;
  const lo = Math.min(...years);
  const hi = Math.max(...years);
  return { from: `${lo - 1}-09`, to: `${hi}-08` };
}
