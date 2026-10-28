#!/usr/bin/env python3
# 把本机最新一份校招表导出成公开数据集 dataset/27届校招岗位.csv（只保留岗位事实，去掉推广类公式列）。
# 用法：python3 scripts/export-dataset.py [导出目录]   默认读 ../data-private/feishu-27届校招_latest/r27
import csv, glob, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(ROOT), 'data-private', 'feishu-27届校招_latest', 'r27')
OUT = os.path.join(ROOT, 'dataset')

# 输出列名 ← 原表列名
COLS = [
    ('岗位ID', '岗位ID'), ('公司', '公司名称'), ('岗位', '可投岗位'), ('届次', '届次'), ('招聘类型', '招聘类型'), ('学历', '学历'),
    ('工作地', '工作地'), ('截止时间', '截止时间'), ('截止日期', '即将截止'), ('企业性质', '企业性质'), ('所属行业', '所属行业'),
    ('知名企业', '知名企业'), ('免笔试', '免笔试'), ('部分岗位免笔试', '部分岗位免笔试'), ('不限专业', '不限专业'),
    ('公告链接', '校招公告'), ('投递链接', '投递 渠道'), ('投递渠道备注', '投递渠道1'), ('更新日期', '更新日期'),
]
LINK = re.compile(r'\]\((https?://[^)\s]+)\)')


def cell(v):
    if v is None:
        return ''
    if isinstance(v, bool):
        return '是' if v else ''
    if isinstance(v, list):
        return '、'.join(cell(x) for x in v if x is not None)
    s = str(v).strip()
    if re.match(r'^\d{4}-\d{2}-\d{2}T', s):
        return s[:10]
    m = LINK.findall(s)
    return ' '.join(m) if m else s


def main():
    pages = [json.load(open(f), strict=False)['data'] for f in sorted(glob.glob(os.path.join(SRC, 'p*.json')))]
    if not pages:
        sys.exit(f'没有找到数据：{SRC}')
    fields = pages[0]['fields']
    idx = {name: fields.index(src) for name, src in COLS if src in fields}
    missing = [name for name, _ in COLS if name not in idx]
    if missing:
        sys.exit(f'原表缺列：{"、".join(missing)}')
    # 原表顶部有说明/导航用的模板行，打分时已标出，不算岗位
    scored = os.path.join(os.path.dirname(SRC), 'confidence', 'r27_scored.csv')
    template = {x['record_id'] for x in csv.DictReader(open(scored, encoding='utf-8')) if x.get('template') == '1'} if os.path.exists(scored) else set()
    rows = []
    for d in pages:
        for rid, r in zip(d['record_id_list'], d['data']):
            out = {name: cell(r[i]) for name, i in idx.items()}
            if rid not in template and out['公司'] and out['岗位']:
                rows.append(out)
    rows.sort(key=lambda x: (x['更新日期'], x['岗位ID']), reverse=True)
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, '27届校招岗位.csv')
    tmp = path + '.tmp'
    # utf-8-sig：Excel 直接双击打开不乱码
    with open(tmp, 'w', newline='', encoding='utf-8-sig') as f:
        w = csv.DictWriter(f, fieldnames=[n for n, _ in COLS])
        w.writeheader()
        w.writerows(rows)
    os.replace(tmp, path)
    print(f'导出 {len(rows)} 条 → {os.path.relpath(path, ROOT)}')


if __name__ == '__main__':
    main()
