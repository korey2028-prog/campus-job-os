// 本地日历日 YYYY-MM-DD。ledger 和 me 都要用，所以放在 domain，避免 ledger 反向依赖 me。
export function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
