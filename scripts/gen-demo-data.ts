// 生成虚构演示数据集 apps/web/data/demo.json（确定性随机，所有公司与链接均为虚构）
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const TODAY = '2026-10-27';
let seed = 20261027;
function rnd(): number {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const pick = <T,>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)];
function wpick<T>(items: [T, number][]): T {
  const sum = items.reduce((s, x) => s + x[1], 0);
  let r = rnd() * sum;
  for (const [v, w] of items) { if ((r -= w) <= 0) return v; }
  return items[items.length - 1][0];
}
function shuffle<T>(a: T[]): T[] { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = int(0, i); [r[i], r[j]] = [r[j], r[i]]; } return r; }
function addDays(d: string, n: number): string {
  const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10);
}
const slash = (d: string) => d.replace(/-/g, '/');

const PREFIX = ['星河', '青禾', '远岚', '云栖', '澜川', '拓海', '衡泰', '恒屿', '瑞丰', '明澈', '晨舟', '知行', '凌霄', '禾木', '沐风', '启元', '越川', '松禾', '汇泽', '汀兰', '碧海', '鸿启', '盛屿', '弘毅', '嘉禾', '澄远', '墨石', '玖安', '翰川', '朗曜', '岚山', '栖霞', '听潮', '半岛', '望舒', '以太', '长汀', '听松', '白鹭', '山禾', '观澜', '素问', '苍野', '赤霄', '渡舟', '如意', '锦川', '新叶', '枫桥', '微澜', '千屿', '鹿鸣', '归帆', '拾光', '惟一', '芥子', '易安', '承光'];

type Ind = { name: string; sfx: string[]; funcs: string[] };
const INDUSTRIES: Record<string, Ind> = {
  '互联网/科技': { name: '互联网/科技', sfx: ['科技', '网络', '数字科技', '信息技术', '智能'], funcs: ['产品助理', '用户运营', '数据分析', '内容运营', '市场营销管培生', '前端开发', '后端开发', '算法工程师', '商务拓展', '品牌策划', '增长运营'] },
  '半导体/电子': { name: '半导体/电子', sfx: ['半导体', '电子', '微电子', '光电'], funcs: ['产品助理', '芯片设计工程师', '工艺工程师', '市场营销管培生', '供应链专员', '销售工程师', '质量工程师', '采购专员'] },
  '新能源/制造': { name: '新能源/制造', sfx: ['新能源', '动力', '智造', '装备', '材料'], funcs: ['储能研发工程师', '设备工程师', '市场营销管培生', '供应链专员', '销售管培生', '采购专员', '生产管理培训生', '财务管培生'] },
  '快消/零售': { name: '快消/零售', sfx: ['消费', '食品', '生活', '商贸', '美妆'], funcs: ['市场营销管培生', '品牌专员', '销售管培生', '电商运营', '新媒体运营', '渠道运营', '数据分析', '供应链专员', '客户成功'] },
  '金融/银行': { name: '金融/银行', sfx: ['银行', '农商银行', '证券', '保险', '金融科技'], funcs: ['综合管培生', '客户经理', '风险管理', '运营管理', '理财经理', '金融科技岗', '市场营销岗', '综合柜员'] },
  '能源/电力': { name: '能源/电力', sfx: ['能源', '电力', '燃气', '水务', '油气'], funcs: ['电气工程师', '综合管理', '财务', '人力资源', '法务', '市场营销', '运行值班员', '项目管理'] },
  '汽车/出行': { name: '汽车/出行', sfx: ['汽车', '出行', '车联', '动力总成'], funcs: ['产品经理', '市场营销管培生', '销售管培生', '用户运营', '研发工程师', '供应链专员', '品牌策划', '数据分析'] },
  '医药/医疗': { name: '医药/医疗', sfx: ['医药', '生物', '医疗', '健康'], funcs: ['医学联络官', '市场营销', '销售代表', '注册专员', '质量管理', '数据分析', '品牌专员'] },
  '咨询/专业服务': { name: '咨询/专业服务', sfx: ['咨询', '会计师事务所', '管理顾问', '人力资源'], funcs: ['咨询助理', '审计助理', '市场分析', '商务拓展', '人力资源专员', '项目助理'] },
  '地产/建筑': { name: '地产/建筑', sfx: ['置业', '建设', '城建', '设计院'], funcs: ['营销策划', '土建工程师', '造价工程师', '招商专员', '财务', '综合管理', '客户关系'] },
  '教育/文化': { name: '教育/文化', sfx: ['教育', '传媒', '文化', '出版'], funcs: ['内容编辑', '新媒体运营', '课程运营', '市场营销', '品牌策划', '活动策划'] },
  '物流/供应链': { name: '物流/供应链', sfx: ['物流', '供应链', '速运', '港务'], funcs: ['运营管培生', '供应链专员', '市场营销', '客户经理', '数据分析', '仓储管理'] },
};
const IND_KEYS = Object.keys(INDUSTRIES);
const IND_W: [string, number][] = [['互联网/科技', 16], ['半导体/电子', 8], ['新能源/制造', 11], ['快消/零售', 11], ['金融/银行', 10], ['能源/电力', 9], ['汽车/出行', 7], ['医药/医疗', 7], ['咨询/专业服务', 4], ['地产/建筑', 6], ['教育/文化', 4], ['物流/供应链', 7]];
const STATE_SFX = ['集团', '集团', '集团有限公司', '控股集团'];

const CITIES = ['上海', '杭州', '北京', '深圳', '广州', '成都', '南京', '苏州', '武汉', '西安', '天津', '合肥', '长沙', '青岛'];
const CITY_W: [string, number][] = [['上海', 18], ['杭州', 13], ['北京', 15], ['深圳', 12], ['广州', 8], ['成都', 7], ['南京', 6], ['苏州', 5], ['武汉', 4], ['西安', 3], ['天津', 3], ['合肥', 2], ['长沙', 2], ['青岛', 2]];

const MAJOR_GROUPS: Record<string, string[]> = {
  商科: ['市场营销', '工商管理', '电子商务', '国际贸易', '经济学'],
  财经: ['会计学', '财务管理', '金融学', '经济学'],
  工科: ['电气工程', '机械工程', '材料科学', '自动化', '电子信息'],
  计算机: ['计算机科学', '软件工程', '数据科学', '电子信息'],
  文传: ['新闻传播', '汉语言文学', '广告学', '市场营销'],
  医药: ['药学', '生物工程', '临床医学', '护理学'],
  管理: ['人力资源管理', '行政管理', '工商管理', '法学'],
};
function funcMajors(f: string): string[] {
  if (/(研发|工程师|工艺|芯片|算法|开发|设备|质量|造价|土建|电气|储能|运行|注册)/.test(f)) {
    if (/(算法|开发|芯片)/.test(f)) return MAJOR_GROUPS.计算机;
    if (/(注册|医学)/.test(f)) return MAJOR_GROUPS.医药;
    return MAJOR_GROUPS.工科;
  }
  if (/(财务|审计|风险|理财)/.test(f)) return MAJOR_GROUPS.财经;
  if (/(法务|人力|行政|综合管理)/.test(f)) return MAJOR_GROUPS.管理;
  if (/(内容|编辑)/.test(f)) return MAJOR_GROUPS.文传;
  return [];
}
const isOpenFunc = (f: string) => /(营销|运营|销售|品牌|管培|商务|客户|产品助理|市场|招商|渠道|策划|增长|项目助理)/.test(f);

type Own = '民企' | '央国企' | '银行' | '外企' | '合资' | '事业单位' | '其他';
const OWN_W: [Own, number][] = [['民企', 55], ['央国企', 25], ['银行', 7], ['外企', 5], ['合资', 3], ['事业单位', 3], ['其他', 2]];

const used = new Set<string>();
function companyName(ind: string, own: Own): string {
  for (let i = 0; i < 50; i++) {
    const p = pick(PREFIX);
    let s: string;
    if (own === '央国企') s = pick(['能源', '电力', '建设', '轨道', '航空装备', '通信', '交通投资']) + pick(STATE_SFX);
    else if (own === '银行') s = pick(['银行', '农商银行', '城商银行', '消费金融']);
    else if (own === '事业单位') s = pick(['研究院', '科学院', '医院', '检测中心']);
    else if (own === '外企' || own === '合资') s = pick(INDUSTRIES[ind].sfx) + pick(['（中国）有限公司', '亚太', '中国区', '']);
    else s = pick(INDUSTRIES[ind].sfx);
    const name = p + s;
    if (!used.has(name)) { used.add(name); return name; }
  }
  return pick(PREFIX) + int(1, 99) + '科技';
}

const WEIXIN = () => `https://mp.weixin.qq.com/s/demo-${int(100000, 999999).toString(36)}${int(10, 99)}`;
const SLUG = (i: number) => `co${i}`;

type Prov = { field: string; method: string; source: string; obtained_at: string; verified_at: string | null };

const posts: any[] = [];
const positions: any[] = [];
let posId = 1000;
let postId = 100;

type Q = 'good' | 'verified' | 'mid' | 'poor';

function mkProv(q: Q, url: string, hasDate: boolean, method: string, obtained: string): Prov[] {
  const m = (field: string): Prov => {
    let me = method;
    if (field === 'deadline' && !hasDate) me = '规则解析';
    if (q === 'poor') me = pick(['AI抽取', '第三方数据包']);
    if (q === 'mid' && rnd() < 0.5) me = pick(['AI抽取', '规则解析', '官方原文']);
    const ver = q === 'verified' ? addDays(TODAY, -int(1, 12)) : null;
    return { field, method: me, source: url, obtained_at: obtained, verified_at: ver };
  };
  return ['grad_window', 'degree', 'deadline', 'majors', 'cities'].map(m);
}

function makeCompany(i: number) {
  const ind = wpick(IND_W);
  let own = wpick(OWN_W);
  if (ind === '金融/银行' && rnd() < 0.5) own = '银行';
  if (own === '银行') { /* 银行归金融行业 */ }
  const indFinal = own === '银行' ? '金融/银行' : ind;
  const company = companyName(indFinal, own);
  const tier = rnd() < (own === '央国企' ? 0.12 : 0.13);
  return { ind: indFinal, own, company, tier, i };
}

const N_COMPANIES = 235;
const companies = Array.from({ length: N_COMPANIES }, (_, i) => makeCompany(i));

// 截止日分配：约 25% 有明确日期
function drawDeadline(): { raw: string; q: 'date' | 'rolling' | 'unknown' } {
  const r = rnd();
  if (r < 0.055) return { raw: slash(addDays(TODAY, -int(1, 40))), q: 'date' };          // 已过期
  if (r < 0.105) return { raw: slash(addDays(TODAY, int(0, 6))), q: 'date' };           // 7 天内
  if (r < 0.175) return { raw: slash(addDays(TODAY, int(7, 30))), q: 'date' };          // 30 天内
  if (r < 0.215) return { raw: slash(addDays(TODAY, int(31, 75))), q: 'date' };
  if (r < 0.29) return { raw: '招满即止', q: 'rolling' };
  return { raw: pick(['尽快投递', '', '尽快投递', '以官网为准']), q: 'unknown' };
}

const RISKS = [
  { kind: '疑似培训收费', note: '可能是培训招生，投递前看清是否收费' },
  { kind: '疑似承诺包就业', note: '公告里出现"包就业"类说法，投递前向官方渠道确认' },
  { kind: '来源为问卷表单', note: '来源是问卷表单，不是企业官方渠道，建议先去官网核实' },
];

const TITLES_INTERN = ['市场营销实习生', '运营实习生', '产品实习生', '数据分析实习生', '品牌实习生'];

function makePosting(c: ReturnType<typeof makeCompany>, idx: number): number {
  const id = postId++;
  const q: Q = wpick([['good', 22], ['verified', 14], ['mid', 40], ['poor', 24]] as [Q, number][]);
  const official = q === 'good' || q === 'verified' || rnd() < 0.3;
  const slug = `${SLUG(c.i)}`;
  let url: string, kind: string;
  const rr = rnd();
  if (q === 'poor') {
    if (rr < 0.35) { url = ''; kind = '第三方整理'; } else if (rr < 0.7) { url = `https://share.tongxue-demo.cn/p/${slug}-${id}`; kind = '第三方整理'; } else { url = `https://wjx-demo.cn/vm/${slug}${id}.aspx`; kind = '问卷表单'; }
  } else if (official && rr < 0.5) { url = WEIXIN(); kind = '公众号推文'; }
  else if (official && rr < 0.75) { url = `https://${slug}.hotjob-demo.cn/campus/${id}`; kind = '招聘系统'; }
  else { url = `https://careers.${slug}-demo.cn/campus/2027`; kind = '企业官网'; }
  const gap = q === 'good' || q === 'verified' ? int(2, 22) : q === 'mid' ? int(15, 70) : int(80, 160);
  const obtained = addDays(TODAY, -gap);
  const upd = rnd() < 0.55 ? addDays(TODAY, -int(0, 29)) : addDays(TODAY, -gap);
  posts.push({
    id, company: c.company, title: `${c.company.replace(/（中国）有限公司|有限公司/, '')}2027届校园招聘`,
    sources: url ? [{ url, kind }] : [], sourceUpdatedAt: upd, lastVerifiedAt: q === 'verified' ? addDays(TODAY, -int(1, 12)) : null, quality: q,
  });
  (posts[posts.length - 1] as any)._o = { obtained, url };
  return id;
}

// ---------- 岗位 ----------
let idxC = 0;
const target = 395;
const ordered = shuffle(companies);
while (positions.length < target) {
  const c = ordered[idxC % ordered.length]; idxC++;
  const pid = makePosting(c, idxC);
  const post = posts[posts.length - 1];
  const { obtained, url } = post._o;
  const q: Q = post.quality;
  const nPos = wpick([[1, 55], [2, 30], [3, 15]] as [number, number][]);
  const funcs = shuffle(INDUSTRIES[c.ind].funcs).slice(0, nPos);
  // 一个公告共用批次与截止
  const dl = drawDeadline();
  const batch = wpick([['27届秋招', 52], ['27届提前批', 16], ['27届补录', 8], ['27/28届实习', 14], ['27届春招', 10]] as [string, number][]);
  const isIntern = batch.includes('实习');
  const grad = isIntern ? '27/28届' : wpick([['27届', 70], ['26/27届', 11], ['27/28届', 6], ['25/26/27届', 5], ['25/26届', 4], ['26届', 4]] as [string, number][]);
  const national = rnd() < 0.1;
  const cityPool = national ? ['全国多地'] : (() => { const k = wpick([[1, 55], [2, 30], [3, 15]] as [number, number][]); const s = new Set<string>(); while (s.size < k) s.add(wpick(CITY_W)); return [...s]; })();
  const free = rnd() < 0.15 ? '免' : rnd() < 0.05 ? '部分' : '需';
  const degree = wpick([['本科', 62], ['硕士', 30], ['博士', 3], ['大专', 5]] as [string, number][]);
  const compat = rnd() < 0.88;
  for (const f of funcs) {
    let title = isIntern ? pick(TITLES_INTERN) : f;
    if (c.own === '银行' && !isIntern) title = pick(INDUSTRIES['金融/银行'].funcs);
    let majors: string[] = [];
    if (!isOpenFunc(title)) majors = funcMajors(title);
    else if (rnd() < 0.35) majors = ['不限专业'];
    else if (rnd() < 0.3) majors = pick([MAJOR_GROUPS.商科, MAJOR_GROUPS.文传, MAJOR_GROUPS.管理]);
    if (majors.length === 0 && !isOpenFunc(title)) majors = ['不限专业'];
    const degrees = compat ? [] : [degree];
    const risk = rnd() < 0.03 ? pick(RISKS) : null;
    const method = q === 'good' || q === 'verified' ? pick(['官方原文', '规则解析']) : 'AI抽取';
    const hasDate = dl.q === 'date';
    const prov = mkProv(q, url, hasDate, method, obtained);
    const row = {
      id: posId++, postingId: pid, company: post.company, title, batch, gradRaw: grad,
      minDegree: degree, downwardCompatible: compat, degrees, majors, cities: cityPool,
      deadlineRaw: dl.raw, industry: c.ind, ownership: c.own, writtenTest: free, tier: c.tier,
      internship: isIntern, updatedAt: post.sourceUpdatedAt, provenance: prov,
      conflicts: [] as any[], risk: risk ?? null, applyUrl: url || `https://careers.${SLUG(c.i)}-demo.cn/apply`,
      note: '',
    };
    if (risk) { row.provenance = row.provenance.map((p: Prov) => ({ ...p, method: '第三方数据包', verified_at: null })); }
    positions.push(row);
    if (positions.length >= target) break;
  }
}

// 冲突：几条岗位在截止日/学历上出现不同来源的不同说法
const conflictable = positions.filter((p) => /^\d{4}\//.test(p.deadlineRaw));
for (const p of shuffle(conflictable).slice(0, 7)) {
  const other = slash(addDays(p.deadlineRaw.replace(/\//g, '-'), pick([-5, -3, 7, 10])));
  p.conflicts.push({ field: 'deadline', values: [{ value: p.deadlineRaw, source: p.provenance[2].source || '招聘系统页' }, { value: other, source: `https://share.tongxue-demo.cn/p/c${p.id}` }] });
}
for (const p of shuffle(positions.filter((x) => !x.conflicts.length)).slice(0, 3)) {
  p.conflicts.push({ field: 'degree', values: [{ value: p.minDegree + '及以上', source: p.provenance[1].source || '公告正文' }, { value: p.minDegree === '本科' ? '硕士及以上' : '本科及以上', source: `https://share.tongxue-demo.cn/p/d${p.id}` }] });
}

// 重复行：约 6%，同岗位换了名称写法、来自第三方整理（演示去重键）
const dupSrc = shuffle(positions.filter((p) => p.ownership === '民企')).slice(0, 24);
for (const p of dupSrc) {
  const alias = p.company.replace(/（中国）有限公司$/, '') + pick(['有限公司', '股份有限公司', '（官方招聘）', '集团']);
  const pid = postId++;
  posts.push({ id: pid, company: alias, title: `${alias}校招汇总`, sources: [{ url: `https://share.tongxue-demo.cn/p/dup-${pid}`, kind: '第三方整理' }], sourceUpdatedAt: addDays(TODAY, -int(0, 40)), lastVerifiedAt: null, quality: 'poor' });
  positions.push({ ...p, id: posId++, postingId: pid, company: alias, provenance: p.provenance.map((x: Prov) => ({ ...x, method: '第三方数据包', source: `https://share.tongxue-demo.cn/p/dup-${pid}`, verified_at: null })), conflicts: [], risk: null, dupOf: p.id });
}
for (const p of positions) delete (p as any).dupOf;
for (const p of posts) delete p._o;

// ---------- 26 届存档 ----------
const archive: any[] = [];
const ARCH_GRAD: [string, number][] = [['26届', 30], ['26/27届', 6], ['25/26届', 14], ['24/25/26届', 12], ['25/26/27届', 5], ['23/24/25/26届', 8], ['24/25届', 6], ['不限届', 4], ['26/27/28届', 5], ['27届', 3], ['24/25/26/27届', 7]];
const ARCH_OWN = [['民企', 58], ['央国企', 24], ['银行', 6], ['外企', 6], ['合资', 3], ['事业单位', 3]] as [Own, number][];
for (let i = 0; i < 200; i++) {
  const ind = wpick(IND_W); const own = wpick(ARCH_OWN);
  const company = companyName(own === '银行' ? '金融/银行' : ind, own);
  const city = rnd() < 0.1 ? '多地' : wpick(CITY_W);
  archive.push({
    id: 5000 + i, company, title: pick(INDUSTRIES[own === '银行' ? '金融/银行' : ind].funcs), batch: wpick([['26届秋招', 60], ['26届提前批', 20], ['26届补录', 10], ['26届春招', 10]] as [string, number][]),
    gradRaw: wpick(ARCH_GRAD), minDegree: '本科', downwardCompatible: true, degrees: [], majors: rnd() < 0.3 ? ['不限专业'] : [], cities: [city],
    deadlineRaw: rnd() < 0.3 ? slash(addDays('2025-10-01', int(0, 200))) : '尽快投递', industry: own === '银行' ? '金融/银行' : ind, ownership: own,
    writtenTest: rnd() < 0.14 ? '免' : '需', tier: rnd() < 0.12, internship: false, updatedAt: addDays('2025-09-01', int(0, 200)), provenance: [], conflicts: [], risk: null, applyUrl: '',
  });
}

// ---------- 事实库 ----------
const facts = [
  { id: 'F-01', title: '校园社团新媒体账号运营', role: '负责', stage: '有结果数据', detail: '负责学院公众号选题与排期，一学期发布 36 篇，单篇最高阅读 1.2 万。', source: '后台截图 + 社团负责人证明', status: '已确认', confirmedAt: '2026-10-12' },
  { id: 'F-02', title: '快消品牌校园推广实习', role: '参与', stage: '上线', detail: '实习两个月，参与 3 场校园快闪活动的物料与现场执行。', source: '实习证明', status: '已确认', confirmedAt: '2026-10-12' },
  { id: 'F-03', title: '市场调研课程项目', role: '主导', stage: '有结果数据', detail: '带 4 人小组完成 300 份问卷，输出 20 页报告，课程评分 92。', source: '课程报告 PDF', status: '已确认', confirmedAt: '2026-10-13' },
  { id: 'F-04', title: '电商店铺运营小实验', role: '负责', stage: '上线', detail: '在平台开过一个小店，上架 12 款商品，完成 47 单。', source: '店铺后台导出', status: '已确认', confirmedAt: '2026-10-14' },
  { id: 'F-05', title: '校园活动策划大赛', role: '参与', stage: '原型', detail: '参与方案撰写，进入校级复赛，未获奖。', source: '参赛通知', status: '已确认', confirmedAt: '2026-10-14' },
  { id: 'F-06', title: '短视频账号内容实验', role: '负责', stage: '计划', detail: '计划做一个校园生活账号，目前只有 5 条草稿。', source: '本人口述', status: '待确认', confirmedAt: null },
  { id: 'F-07', title: '英语六级 560 分', role: '—', stage: '有结果数据', detail: '2025 年 12 月，成绩单已上传。', source: '成绩单', status: '已确认', confirmedAt: '2026-10-12' },
  { id: 'F-08', title: '数据分析工具使用', role: '参与', stage: '原型', detail: '课程里用过表格工具做透视分析，没有独立项目。', source: '本人口述', status: '待确认', confirmedAt: null },
];
const factGaps = [
  { id: 'G-01', text: '缺少"独立完成的数据分析项目"证据（F-08 只有课程练习）', suggest: '补一份可展示的分析作业，或如实写成"熟悉基础分析"' },
  { id: 'G-02', text: 'F-06 还只是计划，不能写成"运营过账号"', suggest: '先发布 10 条再确认，或不写' },
  { id: 'G-03', text: '没有任何带数字结果的实习产出（F-02 只有执行描述）', suggest: '向实习带教确认能否给一个活动人数或曝光数字' },
];
const factFixes = [
  { id: 'C-01', date: '2026-10-14', text: 'F-01 原写"阅读量过万"，更正为"单篇最高 1.2 万，平均约 2,300"', by: '林同学' },
  { id: 'C-02', date: '2026-10-13', text: 'F-03 原写"带领团队"，更正为"带 4 人小组"', by: '林同学' },
];

// ---------- 投递 ----------
const pickPos = (pred: (p: any) => boolean, n: number) => positions.filter(pred).slice(n, n + 1)[0];
const today27 = positions.filter((p) => /^\d{4}\//.test(p.deadlineRaw) && p.deadlineRaw.replace(/\//g, '-') >= TODAY && p.gradRaw.includes('27') && (p.majors.includes('不限专业') || p.majors.length === 0) && p.minDegree !== '硕士' && p.minDegree !== '博士');
const appRaw: [number, string, string, string][] = [
  [0, '已交流', '看一眼公告的投递要求', addDays(TODAY, 1)],
  [1, '未核验', '核对截止日期和专业要求', addDays(TODAY, 2)],
  [2, '仅核官网，定向材料准备中', '确认 F-03 能否写进简历', addDays(TODAY, 1)],
  [3, '定向材料草稿', '过一遍逐句体检', addDays(TODAY, 3)],
  [4, '已投递', '等待笔试通知', addDays(TODAY, 6)],
  [5, '已投递', '留意邮箱', addDays(TODAY, 8)],
  [6, '一面已约', '准备自我介绍与 F-01 追问', addDays(TODAY, 4)],
  [7, '二面通过，等待终面', '确认终面时间', addDays(TODAY, 9)],
  [8, '本人决定不投', '—', ''],
  [9, '来源关闭', '—', ''],
];
const applications = appRaw.map(([k, stageRaw, next, nextDate], i) => {
  const p = today27[(k * 3) % today27.length];
  return { localId: `A-${String(i + 1).padStart(2, '0')}`, positionId: p.id, company: p.company, role: p.title, stageRaw, nextAction: next, nextActionDate: nextDate, lastEventAt: addDays(TODAY, -int(0, 12)), notes: i === 4 ? '官网投递，已收到确认邮件' : '' };
});

// ---------- 定向材料 ----------
const mA = applications[2], mB = applications[3];
const materials = [mA, mB].map((a, k) => ({
  id: `M-0${k + 1}`, applicationId: a.localId, positionId: a.positionId, company: a.company, role: a.role,
  jd: {
    summary: k === 0 ? '负责品牌活动策划与执行，协同线上线下渠道，跟踪活动数据并复盘。' : '支持产品迭代，做用户调研与竞品分析，输出需求文档并跟进上线。',
    asks: k === 0
      ? ['品牌或活动策划经验', '数据复盘能力', '跨部门沟通', '较强文字表达', '熟悉新媒体平台']
      : ['用户调研与分析', '竞品分析', '需求文档写作', '数据敏感度', '沟通协作'],
  },
  matches: k === 0
    ? [
      { ask: '品牌或活动策划经验', status: '已匹配', fact: 'F-05', note: '有校级复赛经历，但未获奖，不要写成"获奖"' },
      { ask: '数据复盘能力', status: '已匹配', fact: 'F-03', note: '问卷 300 份，有结果数据' },
      { ask: '跨部门沟通', status: '表达缺口', fact: 'F-02', note: '事实有，但简历里没写出协作对象' },
      { ask: '较强文字表达', status: '已匹配', fact: 'F-01', note: '36 篇推文' },
      { ask: '熟悉新媒体平台', status: '证据不足', fact: 'F-06', note: '只有计划，不能写成"运营过"' },
    ]
    : [
      { ask: '用户调研与分析', status: '已匹配', fact: 'F-03', note: '课程项目主导' },
      { ask: '竞品分析', status: '证据不足', fact: '—', note: '没有对应事实，建议补一个小练习' },
      { ask: '需求文档写作', status: '真实缺口', fact: '—', note: '没有做过，面试里如实说明' },
      { ask: '数据敏感度', status: '待确认', fact: 'F-08', note: '课程练习，需你确认能否写' },
      { ask: '沟通协作', status: '已匹配', fact: 'F-02', note: '活动执行协作' },
    ],
  advice: k === 0 ? { level: '建议投递', reason: '核心要求大多有事实支撑，缺口可以通过表达补上。' } : { level: '谨慎投递', reason: '有两项真实缺口，需要准备好面试里的说法。' },
  resume: k === 0
    ? [
      { text: '负责学院公众号选题与排期，一学期发布 36 篇推文，单篇最高阅读 1.2 万。', facts: ['F-01'], confirmed: true },
      { text: '带 4 人小组完成 300 份问卷调研，输出 20 页报告并用于课程答辩。', facts: ['F-03'], confirmed: true },
      { text: '参与 3 场校园快闪活动的物料准备与现场执行。', facts: ['F-02'], confirmed: true },
      { text: '运营校园生活短视频账号，累计发布内容 5 条。', facts: ['F-06'], confirmed: false },
    ]
    : [
      { text: '主导市场调研课程项目，回收 300 份问卷并输出 20 页分析报告。', facts: ['F-03'], confirmed: true },
      { text: '参与校级活动策划大赛，负责方案撰写并进入复赛。', facts: ['F-05'], confirmed: true },
      { text: '使用透视表完成课程数据分析练习。', facts: ['F-08'], confirmed: false },
    ],
  interview: k === 0
    ? [
      { q: '你说发布了 36 篇，选题怎么来的？', hint: '用 F-01：说清选题来源和一次失败的选题', facts: ['F-01'] },
      { q: '快闪活动里你具体做了什么？', hint: '只讲你负责的物料和现场执行，不夸大决策', facts: ['F-02'] },
      { q: '复赛没获奖，你觉得差在哪？', hint: '如实讲，并说清下一次会怎么改', facts: ['F-05'] },
    ]
    : [
      { q: '300 份问卷你怎么保证样本不偏？', hint: '准备样本来源与剔除规则的说法', facts: ['F-03'] },
      { q: '没有写过需求文档，你打算怎么补？', hint: '真实缺口，给出具体学习计划', facts: [] },
    ],
  checklist: ['确认 F-06 是否真的发布到 10 条以上，否则删除相关句', '核对公告里的截止日期', '简历文件名改为"姓名-岗位"', '提交前再看一遍逐句体检'],
  runs: [
    { skill: 'resume-claim-guard', version: 'v1.0', model: '演示模型', facts: k === 0 ? ['F-01', 'F-02', 'F-03', 'F-05'] : ['F-03', 'F-05', 'F-08'], at: addDays(TODAY, -(1 + k)) + ' 21:' + (14 + k * 7), confirmedBy: '林同学' },
    { skill: 'interview-coach', version: 'v0.4', model: '演示模型', facts: k === 0 ? ['F-01', 'F-02'] : ['F-03'], at: addDays(TODAY, -(1 + k)) + ' 21:' + (40 + k), confirmedBy: '待确认' },
  ],
}));

// ---------- 渠道 & 专业 ----------
const channels = [
  { type: '企业官网', items: [
    { name: '企业招聘官网', fit: '最准确的岗位与截止日，投递也在这里完成' },
    { name: '企业校招专题页', fit: '看批次安排与宣讲会时间' } ] },
  { type: '招聘系统', items: [
    { name: '企业使用的招聘系统入口', fit: '一次登录可投同系统的多家企业' },
    { name: '校招直通入口', fit: '部分企业会在这里先放出提前批' } ] },
  { type: '公众号', items: [
    { name: '企业校招公众号', fit: '第一时间看到公告与笔试通知' },
    { name: '学校就业公众号', fit: '往往带有校友内推与专场宣讲' } ] },
  { type: '政府与国资委', items: [
    { name: '地方人社局与国资委公告', fit: '国企、事业单位的统一招聘' },
    { name: '公务员与事业单位考试网站', fit: '报名时间固定，别错过' } ] },
  { type: '高校就业网', items: [
    { name: '本校就业信息网', fit: '企业直发的专场岗位，竞争相对少' },
    { name: '兄弟院校就业网', fit: '部分对外开放，可看到更多公告' } ] },
];
const majorMap = [
  { major: '市场营销', roles: ['市场营销管培生', '品牌专员', '销售管培生', '渠道运营', '新媒体运营'], tip: '大多数营销与运营岗位不限专业，重点看实习与项目。' },
  { major: '会计学', roles: ['财务管培生', '审计助理', '会计专员', '风险管理'], tip: '银行与央国企的财务岗位占比高，注意证书要求。' },
  { major: '计算机科学', roles: ['后端开发', '前端开发', '算法工程师', '数据分析'], tip: '互联网与半导体岗位多，提前批更集中。' },
  { major: '电气工程', roles: ['电气工程师', '设备工程师', '运行值班员', '研发工程师'], tip: '能源与制造类企业偏好，央国企多地招聘。' },
  { major: '汉语言文学', roles: ['内容运营', '新媒体运营', '内容编辑', '品牌策划'], tip: '内容与传媒类岗位对作品集更看重。' },
  { major: '法学', roles: ['法务', '合规专员', '人力资源专员', '综合管理'], tip: '银行与央国企的法务岗位竞争激烈，建议早准备。' },
  { major: '人力资源管理', roles: ['人力资源专员', '招聘专员', '培训专员', '行政管理'], tip: '行政与人力岗位不限专业的比例较高。' },
  { major: '药学', roles: ['医学联络官', '注册专员', '质量管理', '销售代表'], tip: '医药企业岗位通常限专业，请看清专业栏。' },
];

const out = {
  meta: { today: TODAY, fictional: true, version: 'demo-1', note: '所有公司、链接与人物均为虚构，仅用于演示。' },
  profile: { name: '林同学', gradDate: '2027-06', degree: '本科', major: '市场营销', cities: ['上海', '杭州'] },
  postings: posts, positions, archive, facts, factGaps, factFixes, applications, materials, channels, majorMap,
};
const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'web', 'data');
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'demo.json'), JSON.stringify(out));
const own = (k: string) => positions.filter((p) => p.ownership === k).length;
console.log(`positions ${positions.length}, postings ${posts.length}, archive ${archive.length}, 民企 ${own('民企')}, 央国企 ${own('央国企')}, 银行 ${own('银行')}, dated ${positions.filter((p) => /^\d{4}\//.test(p.deadlineRaw)).length}, risk ${positions.filter((p) => p.risk).length}`);
