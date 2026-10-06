import { csvCell, toCsv } from '../csv';

describe('csv', () => {
  it('quotes commas, quotes and newlines', () => {
    expect(csvCell('Kampala Road, near Cham Towers')).toBe('"Kampala Road, near Cham Towers"');
    expect(csvCell('He said "soon"')).toBe('"He said ""soon"""');
    expect(csvCell('two\nlines')).toBe('"two\nlines"');
    expect(csvCell(35000)).toBe('35000');
    expect(csvCell(null)).toBe('');
  });

  it('neutralises spreadsheet formulas from user text', () => {
    expect(csvCell('=HYPERLINK("http://evil")')).toBe('"\'=HYPERLINK(""http://evil"")"');
    expect(csvCell('+256772123456')).toBe("'+256772123456");
    expect(csvCell('-1')).toBe("'-1");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
  });

  it('builds CRLF rows with a header', () => {
    expect(toCsv(['a', 'b'], [[1, 'x,y']])).toBe('a,b\r\n1,"x,y"\r\n');
  });
});
