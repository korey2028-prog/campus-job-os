// 工作地归一：第三方表里的“工作地”是手填文本，混有地址、区名、国家名和半截字。
// 规则都放在这些常量里，要加新词改这里。
export const OTHER_CITY = '其他城市';
export const OVERSEAS = '海外';
export const NATIONWIDE = '全国多地';
export const UNFILLED = '未填写';
export const REMOTE = '远程';

// 常见城市：用来识别“杭州萧山”“广州各区域就近分配”这类前缀写法
export const KNOWN_CITIES = [
  '北京', '上海', '天津', '重庆', '深圳', '广州', '杭州', '成都', '南京', '武汉', '西安', '苏州', '长沙', '合肥', '青岛', '济南', '东莞', '无锡', '宁波', '郑州', '厦门',
  '沈阳', '福州', '大连', '佛山', '珠海', '南昌', '昆明', '哈尔滨', '常州', '南通', '贵阳', '石家庄', '乌鲁木齐', '嘉兴', '南宁', '长春', '惠州', '太原', '呼和浩特', '中山',
  '海口', '温州', '兰州', '烟台', '绍兴', '芜湖', '扬州', '金华', '台州', '湖州', '泉州', '潍坊', '江门', '镇江', '徐州', '泰州', '淮安', '洛阳', '盐城', '汕头', '柳州',
  '昆山', '银川', '西宁', '拉萨', '雄安', '香港', '澳门',
];

// 区、镇、园区 → 所在城市（只收没有歧义的）
export const DISTRICT_TO_CITY: Record<string, string> = {
  浦东: '上海', 长宁: '上海', 虹口: '上海', 黄浦: '上海', 静安: '上海', 杨浦: '上海', 宝山: '上海', 青浦: '上海', 奉贤: '上海', 陆家嘴: '上海', 松江: '上海', 徐汇: '上海', 闵行: '上海', 嘉定: '上海', 张江: '上海',
  东城: '北京', 西城: '北京', 海淀: '北京', 昌平: '北京', 房山: '北京', 顺义: '北京', 天通苑: '北京', 亦庄: '北京', 中关村: '北京',
  福田: '深圳', 南山: '深圳', 前海: '深圳', 深汕: '深圳', 深汕合作: '深圳', 宝安: '深圳', 龙岗: '深圳', 西丽: '深圳',
  天河: '广州', 越秀: '广州', 番禺: '广州', 黄埔: '广州',
  滨江: '杭州', 萧山: '杭州', 临安: '杭州', 余杭: '杭州',
  汉口: '武汉', 汉阳: '武汉', 武昌: '武汉', 洪山: '武汉', 江夏: '武汉', 黄陂: '武汉', 东西湖: '武汉',
  台北: '台湾', 红桥: '天津', 电白: '茂名', 东川: '昆明', 温江: '成都', 长清: '济南', 横琴: '珠海', 江宁: '南京', 六合: '南京', 栖霞: '南京',
  禅城: '佛山', 顺德: '佛山', 南海: '佛山', 即墨: '青岛', 平度: '青岛',
};

export const PROVINCES = [
  '河北', '山西', '辽宁', '吉林', '黑龙江', '江苏', '浙江', '安徽', '福建', '江西', '山东', '河南', '湖北', '湖南', '广东', '海南', '四川', '贵州', '云南', '陕西', '甘肃', '青海',
  '台湾', '内蒙古', '广西', '西藏', '宁夏', '新疆', '内蒙',
];
const PROVINCE_ALIAS: Record<string, string> = { 内蒙: '内蒙古' };
const PROVINCE_SUFFIX = /^(省|壮族自治区|回族自治区|维吾尔自治区|特别行政区|自治区|自治)/;

// 自治州、地区、盟：缩成短名；海南州要和海南省分开
export const PREFECTURE_SHORT: Record<string, string> = {
  海南藏族自治州: '海南州', 凉山: '凉山', 海西: '海西', 湘西: '湘西', 甘南: '甘南', 阿坝: '阿坝', 红河: '红河', 恩施: '恩施', 延边: '延边', 克孜勒苏: '克孜勒苏',
  巴音郭楞: '巴音郭楞', 伊犁: '伊犁', 博尔塔拉: '博尔塔拉', 怒江: '怒江', 迪庆: '迪庆', 大理: '大理', 德宏: '德宏', 楚雄: '楚雄', 西双版纳: '西双版纳', 临夏: '临夏',
  黔南: '黔南', 黔东南: '黔东南', 黔西南: '黔西南', 文山: '文山', 海北: '海北', 黄南: '黄南', 玉树: '玉树', 果洛: '果洛', 甘孜: '甘孜', 锡林郭勒: '锡林郭勒', 阿拉善: '阿拉善',
};

// 国家、国外城市、国外大区 → 海外（按前缀匹配）
export const FOREIGN = [
  '美国', '英国', '法国', '德国', '日本', '韩国', '俄罗斯', '加拿大', '澳大利亚', '新西兰', '意大利', '西班牙', '荷兰', '瑞典', '瑞士', '芬兰', '波兰', '捷克', '匈牙利', '罗马尼亚', '塞尔维亚',
  '斯洛伐克', '北马其顿', '波黑', '土耳其', '埃及', '南非', '肯尼亚', '坦桑尼亚', '乌干达', '埃塞俄比亚', '摩洛哥', '阿尔及利亚', '利比亚', '毛里塔尼亚', '赤道几内亚', '几内亚', '刚果', '津巴布韦',
  '安哥拉', '苏丹', '巴布亚新几内亚', '新加坡', '马来西亚', '印度尼西亚', '印尼', '越南', '泰国', '菲律宾', '缅甸', '老挝', '柬埔寨', '文莱', '印度', '巴基斯坦', '孟加拉', '尼泊尔', '阿富汗',
  '哈萨克斯坦', '乌兹别克', '吉尔吉斯', '蒙古', '沙特', '阿联酋', '阿曼', '科威特', '伊拉克', '利雅得', '迪拜', '马尔代夫', '墨西哥', '巴西', '阿根廷', '智利', '秘鲁', '哥伦比亚',
  '东京', '大阪', '首尔', '釜山', '曼谷', '雅加达', '吉隆坡', '河内', '马尼拉', '悉尼', '伦敦', '巴黎', '莫斯科', '法兰克福', '汉堡', '海尔布隆', '莫尔斯比港', '硅谷', '西雅图', '波士顿',
  '圣何塞', '洛杉矶', '底特律', '泗水',
  '东南亚', '东亚', '南亚', '西亚', '中亚', '中东', '北非', '非洲', '欧洲', '欧美', '美洲', '北美', '南美', '拉美', '大洋洲', '澳新', '独联体', '全球', '国外', '海外',
];
// 越南海防这类“国家+城市”被前缀匹配；单独的“海防”“河内”也在上面

// 国内大区：不是城市，归其他城市
export const DOMESTIC_REGIONS = ['华东', '华南', '华北', '华中', '西南', '西北', '东北', '川渝', '成渝', '冀东', '吉黑', '云贵', '粤港澳', '长三角', '珠三角', '京津冀'];

// 提示、占位、地址里常见的词：命中就当不是城市
export const JUNK_WORDS = /[路街道号层楼室栋座]|大厦|大道|中心|园区|基地|校区|大学|高校|广场|项目|调剂|公告|链接|所在地|分子公司|内部|各区域|各市|其他|其它|一二线|全城|地点|见|顶级节点|电工电气|养老金|养者金|国内外|境内外|主要城|中国|总部以外|待定|未定/;
const UNFILLED_WORDS = /^(未注明|未明确|未填写|未填|不限)$/;
const REMOTE_WORDS = /^(线上|远程|线上远程|远程线上)$/;

const clean = (raw: string): string => {
  let s = raw.replace(/[（(][^）)]*[）)]/g, '').replace(/[）)（(]/g, '').trim();
  s = s.replace(/^[^一-龥A-Za-z0-9]+|[^一-龥A-Za-z0-9+]+$/g, '').replace(/^[^:：]{1,4}[:：]/, '').trim();
  return s.replace(/(等地|等|总部|本部)$/, '').trim();
};

// 一个原始地名 → 归一后的名字
export function normalizeCity(raw: string): string {
  let s = clean(raw);
  if (!s) return OTHER_CITY;
  if (UNFILLED_WORDS.test(s)) return UNFILLED;
  if (/^(全国|多地|全国多地|全国各地)/.test(s) && s.length <= 6) return NATIONWIDE;
  if (REMOTE_WORDS.test(s)) return REMOTE;
  if (FOREIGN.some((f) => s.startsWith(f))) return OVERSEAS;
  for (const [k, v] of Object.entries(PREFECTURE_SHORT)) if (s.startsWith(k) && (s === k || /(自治州|地区|盟|州)$/.test(s) || /自治州/.test(s))) return v;
  s = s.replace(/(地区|盟)$/, '').replace(/(特别行政区)$/, '');
  if (s === '雄安新区') return '雄安';
  if (s === '贵安新区') return '贵安';
  if (/^[\p{P}\s.]+$/u.test(s) || s.length < 2) return OTHER_CITY;
  // 先看常见城市前缀（杭州萧山、广州各区域就近分配、嘉兴嘉善）
  const city = [...KNOWN_CITIES].sort((a, b) => b.length - a.length).find((c) => s.startsWith(c));
  if (city) return city;
  const dist = Object.keys(DISTRICT_TO_CITY).find((d) => s.startsWith(d));
  if (dist && (s === dist || /^(区|新区|街道|镇)/.test(s.slice(dist.length)) )) return DISTRICT_TO_CITY[dist];
  if (dist && s.length <= dist.length + 1) return DISTRICT_TO_CITY[dist];
  // 省名（可带省/自治区），后面如果跟着城市就取城市
  const prov = [...PROVINCES].sort((a, b) => b.length - a.length).find((p) => s.startsWith(p));
  if (prov) {
    const rest = s.slice(prov.length).replace(PROVINCE_SUFFIX, '');
    const name = PROVINCE_ALIAS[prov] ?? prov;
    if (!rest || JUNK_WORDS.test(rest) || rest.length < 2) return name;
    const sub = normalizeCity(rest);
    return sub === OTHER_CITY || sub === OVERSEAS ? name : sub;
  }
  if (DOMESTIC_REGIONS.some((r) => s.startsWith(r))) return OTHER_CITY;
  if (JUNK_WORDS.test(s) || /[0-9+.]/.test(s) || /^[A-Za-z]/.test(s)) return OTHER_CITY;
  s = s.replace(/市$/, '').replace(/(区|县)$/, (m) => (s.length > 3 ? '' : m));
  return s.length < 2 ? OTHER_CITY : s;
}

// 整个单元格 → 城市列表。其他城市只在没有别的城市时保留
export function normalizeCities(cell: string): string[] {
  const list = [...new Set(cell.replace(/[（(][^）)]*[）)]/g, '').split(/[、，,;；\s/]+/).filter(Boolean).map(normalizeCity))];
  const real = list.filter((c) => c !== OTHER_CITY);
  return real.length ? real : list;
}
