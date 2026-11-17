import { describe, expect, it } from 'vitest';
import { serializeImportCsv } from './import-file-utils.js';

describe('import CSV utilities', () => {
  it('quotes cells and escapes commas, quotes and line breaks', () => {
    expect(
      serializeImportCsv([
        ['Name', 'Notes'],
        ['Ayesha Khan', 'Says "hello", then leaves'],
      ]),
    ).toBe(
      '\uFEFF"Name","Notes"\r\n"Ayesha Khan","Says ""hello"", then leaves"',
    );
  });

  it('protects spreadsheet formula values in issue exports', () => {
    expect(serializeImportCsv([['=1+1', ' +SUM(A1:A2)']])).toBe(
      '\uFEFF"\'=1+1","\' +SUM(A1:A2)"',
    );
  });

  it('keeps literal template values unchanged when formula protection is disabled', () => {
    expect(serializeImportCsv([['+923001234567']], false)).toBe(
      '\uFEFF"+923001234567"',
    );
  });
});
