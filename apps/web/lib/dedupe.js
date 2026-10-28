// 自动生成，请改 src/domain/dedupe.ts 后运行 npm run build:web
                                             

export function normalizeCompany(name        )         {
  let s = (name ?? '').replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/　/g, ' ');
  s = s.replace(/\s+/g, '');
  s = s.replace(/[(\[][^)\]]*[)\]]/g, '');
  const suffix = /(有限责任公司|股份有限公司|有限公司|集团|公司)$/;
  while (suffix.test(s)) s = s.replace(suffix, '');
  return s.toLowerCase();
}

export function positionKey(company        , title        , batch        , grad                   )         {
  return [normalizeCompany(company), title.trim(), (batch ?? '').trim(), grad ? `${grad.from}-${grad.to}` : ''].join('|');
}
