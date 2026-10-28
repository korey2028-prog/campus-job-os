// 自动生成，请改 src/domain/rank.ts 后运行 npm run build:web
                                                    

                             
const LV                        = { 低: 0, 中: 1, 高: 2 };

// 以下常量是排序规则的全部可调项，按以后的反馈改这里
export const A_MIN_CONFIDENCE        = '中'; // 低于这个可信度不进 A
export const URGENT_DAYS = 7;          // 截止日在这么多天内算紧迫
export const A_TOP_CITY = 0;           // 强方向 + 这个位置的城市（第 1 优先）→ A
export const A_BONUS_CITY = 1;         // 方向命中 + 前两个城市 + 至少一项加分 → A
export const BIG_INDUSTRIES = ['互联网/科技'];
export const FOREIGN_OWNERS = ['外企', '合资'];
export const SOE_OWNERS = ['央国企'];
export const PRODUCT_ROLE = /产品(经理|助理|运营|专员|管培|实习)/;
const AI = '(?<![A-Za-z])AI(?![a-z])|人工智能|大模型|AIGC|LLM|智能';
// AI 词和“产品”在同一个岗位名里紧挨着（6 个字符以内），不然是一长串类别名连在一起
export const AI_PRODUCT = new RegExp(`(${AI})[^、，,；;\\s]{0,6}产品|产品[^、，,；;\\s]{0,6}(${AI})`);
export const MAX_ROLE_LEN = 30;       // 更长的、或含 3 个以上“类”的多半是没拆开的一串类别名，不参与匹配

                                   
                                                                                                                                     
                                                                       
                                                                               

                                                        

// 在公告列出的每个岗位名上找方向，括号里的说明文字不参与匹配
const clean = (role        ) => role.replace(/^【[^】]*】[:：]?/, '');
const MAX_MATCHED = 3;

function directionHit(roles          , directions          )                                      {
  let best                = null;
  const strong           = [], plain           = [];
  for (const role of roles) {
    if (role.length > MAX_ROLE_LEN || /类.*类.*类/.test(role)) continue;
    const t = role.replace(/[（(][^）)]*[）)]/g, '');
    for (const d of directions) {
      let hit                = null;
      if (/AI|人工智能|大模型/i.test(d) && /产品/.test(d)) {
        if (AI_PRODUCT.test(t)) hit = { level: 'strong', role };
      } else if (/产品/.test(d)) {
        if (PRODUCT_ROLE.test(t)) hit = { level: 'hit', role };
      } else {
        const key = d.replace(/经理$/, '');
        if (key && t.includes(key)) hit = { level: 'hit', role };
      }
      if (hit) (hit.level === 'strong' ? strong : plain).push(clean(role));
      if (hit && (!best || (hit.level === 'strong' && best.level !== 'strong'))) best = hit;
    }
  }
  if (!best) return null;
  const all = [...new Set([...strong, ...plain])].slice(0, MAX_MATCHED);
  return { ...best, role: clean(best.role), all };
}

function cityIndex(cities          , prefs          )         {
  for (let i = 0; i < prefs.length; i++) if (cities.some((c) => c === prefs[i] || c.startsWith(prefs[i]))) return i;
  return -1;
}

const dayDiff = (a        , b        ) => Math.round((Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) / 86400000);

export function rankPosition(p           , profile             , today        )       {
  if (p.verdict === '不可投') return { tier: null, reasons: [], matched: [] };
  const dir = directionHit(p.roles?.length ? p.roles : [p.title], profile.directions ?? []);
  const ci = cityIndex(p.cities, profile.cities ?? []);
  const days = p.deadline.kind === 'date' ? dayDiff(p.deadline.date, today) : null;
  const urgent = days != null && days >= 0 && days <= URGENT_DAYS;

  const bonus           = [];
  if (p.industry && BIG_INDUSTRIES.includes(p.industry)) bonus.push('大厂');
  if (p.ownership && FOREIGN_OWNERS.includes(p.ownership)) bonus.push('外企');
  if (p.ownership && SOE_OWNERS.includes(p.ownership)) bonus.push('央国企');
  if (urgent) bonus.push('紧迫'); // 只参与升档；截止日期交给卡片上的截止徽标，不写进推荐理由
  if (p.confidence === '高') bonus.push('来源可信度高');

  const solid = p.verdict === '可投' && LV[p.confidence ?? '中'] >= LV[A_MIN_CONFIDENCE];
  let tier       = 'C';
  if (dir && ci >= 0) {
    tier = 'B';
    if (solid && ((dir.level === 'strong' && ci <= A_TOP_CITY) || (ci <= A_BONUS_CITY && bonus.length > 0))) tier = 'A';
  }
  const reasons = [ci >= 0 ? (profile.cities ?? [])[ci] : '', dir ? `含 ${dir.role}` : '', ...bonus.filter((b) => b !== '紧迫')].filter(Boolean);
  return { tier, reasons: reasons.length ? [reasons.join(' · ')] : [], matched: dir?.all ?? [] };
}
