import type { GradWindow } from './types.ts';

export function normalizeCompany(name: string): string {
  let s = (name ?? '').replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/　/g, ' ');
  s = s.replace(/\s+/g, '');
  s = s.replace(/[(\[][^)\]]*[)\]]/g, '');
  const suffix = /(有限责任公司|股份有限公司|有限公司|集团|公司)$/;
  while (suffix.test(s)) s = s.replace(suffix, '');
  return s.toLowerCase();
}

export function positionKey(company: string, title: string, batch: string, grad: GradWindow | null): string {
  return [normalizeCompany(company), title.trim(), (batch ?? '').trim(), grad ? `${grad.from}-${grad.to}` : ''].join('|');
}
