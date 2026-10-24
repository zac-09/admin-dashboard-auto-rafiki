import { compareValues, matchesQuery, nextSort } from '../sort';

describe('sorting', () => {
  it('numbers by size, text naturally, blanks always last in either direction', () => {
    const values = [3, null, 10, 1];
    expect([...values].sort((a, b) => compareValues(a, b, 'asc'))).toEqual([1, 3, 10, null]);
    expect([...values].sort((a, b) => compareValues(a, b, 'desc'))).toEqual([10, 3, 1, null]);
    const names = ['garage 10', 'Garage 2', '', 'abc'];
    expect([...names].sort((a, b) => compareValues(a, b, 'asc'))).toEqual([
      'abc',
      'Garage 2',
      'garage 10',
      '',
    ]);
  });

  it('a header click goes ascending, descending, then back to the list order', () => {
    let s = nextSort<'a' | 'b'>({ key: null, dir: 'asc' }, 'a');
    expect(s).toEqual({ key: 'a', dir: 'asc' });
    s = nextSort(s, 'a');
    expect(s).toEqual({ key: 'a', dir: 'desc' });
    expect(nextSort(s, 'a')).toEqual({ key: null, dir: 'asc' });
    expect(nextSort(s, 'b')).toEqual({ key: 'b', dir: 'asc' });
  });
});

describe('filtering', () => {
  const okello = ['Okéllo Auto Rescue', '+256772123456', 'Flat tyre, Dead battery'];
  it('every word must match, ignoring case, accents and spacing', () => {
    expect(matchesQuery('', okello)).toBe(true);
    expect(matchesQuery('  okello   battery ', okello)).toBe(true);
    expect(matchesQuery('okello towing', okello)).toBe(false);
  });

  it('phone numbers match however they are typed', () => {
    expect(matchesQuery('0772 123', okello)).toBe(true);
    expect(matchesQuery('+256 772123456', okello)).toBe(true);
    expect(matchesQuery('0701', okello)).toBe(false);
  });
});
