// 自动生成，请改 src/domain/stage.ts 后运行 npm run build:web
                                                   

const RULES                        = [
  [/本人决定不投|资格不符|暂不推进/, 'stopped'],
  [/来源关闭/, 'closed_source'],
  [/面/, 'interviewing'],
  [/已投递/, 'submitted'],
  [/现场简历已收|收纸质简历/, 'offline_received'],
  [/草稿/, 'drafted'],
  [/定向材料|官网已核|仅核官网/, 'preparing'],
  [/未核验|待核验/, 'verify'],
  [/已交流/, 'candidate'],
];

export function mapStage(raw        )        {
  const r = (raw ?? '').trim();
  for (const [re, e] of RULES) if (re.test(r)) return { enum: e, raw: r };
  return { enum: 'unknown', raw: r };
}
