// 自动生成，请改 src/domain/confidence.ts 后运行 npm run build:web
                                                       

                             
                         
                       
                                                                                                   
                                  
                     
                                
                                      
  
                                                                                                                             

const OFFICIAL = /(^|\.)(mp\.weixin\.qq\.com|join\.qq\.com)$|\.gov\.cn$|\.edu\.cn$|mokahr|hotjob|zhiye|51job|zhaopin|iguopin|liepin/;
const FORM = /wjx|jsj/;

function host(u        )                {
  try { return new URL(u).hostname.toLowerCase(); } catch { return null; }
}

export function confidence(c           )             {
  const hosts = c.sourceUrls.filter(Boolean).map((u) => ({ u, h: host(u) }));
  let source        = '低';
  if (hosts.some((x) => x.h && OFFICIAL.test(x.h))) source = '高';
  else if (hosts.some((x) => /^https?:\/\//i.test(x.u))) source = '中';
  else if (hosts.some((x) => x.h && FORM.test(x.h))) source = '中';

  const methodOf = (f        ) => c.provenance.find((p) => p.field === f);
  const keys = ['grad_window', 'degree', 'deadline'].map(methodOf);
  let field       ;
  if (c.deadline.kind === 'unknown' && !c.gradWindow) field = '低';
  else if (keys.some((k) => k && (k.method === 'AI抽取' || k.method === '第三方数据包') && !k.verified_at)) field = '中';
  else if (keys.every((k) => k && (k.method === '人工录入' || k.method === '官方原文' || k.method === '规则解析' || k.verified_at))) field = '高';
  else field = '中';

  const times = [...c.provenance.flatMap((p) => [p.verified_at, p.obtained_at]), ...(c.sourceTimes ?? [])].filter(Boolean)            ;
  let freshness        = '低';
  if (times.length) {
    const latest = times.sort().at(-1) ;
    const days = (Date.parse(c.now) - Date.parse(latest)) / 86400000;
    freshness = days <= 30 ? '高' : days <= 90 ? '中' : '低';
  }
  const all = [source, field, freshness];
  const overall        = all.every((x) => x === '高') ? '高' : all.includes('低') ? '低' : '中';
  const measured = c.provenance.some((p) => p.verified_at);
  return { source, field, freshness, overall, measured, label: measured ? overall : `${overall}（未实测）` };
}
