/** Money is UGX, whole shillings: `UGX 35,000`. */
export function formatUgx(value: number): string {
  return `UGX ${Math.round(value).toLocaleString('en-US')}`;
}
