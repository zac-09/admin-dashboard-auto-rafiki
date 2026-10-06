import { formatUgx } from '../format';

describe('formatUgx', () => {
  it('formats whole shillings with a thousands separator', () => {
    expect(formatUgx(35000)).toBe('UGX 35,000');
    expect(formatUgx(1_250_000)).toBe('UGX 1,250,000');
    expect(formatUgx(0)).toBe('UGX 0');
  });
});
