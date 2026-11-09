import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  parseStudentCsv,
  parseStudentImportFile,
  parseStudentWorkbook,
  suggestStudentImportMappings,
} from './student-import-parser.js';

const excelMocks = vi.hoisted(() => ({ readSheet: vi.fn() }));
vi.mock('read-excel-file/browser', () => ({ readSheet: excelMocks.readSheet }));

const emptyBuffer = () => new ArrayBuffer(8);

describe('student import spreadsheet parser', () => {
  beforeEach(() => vi.clearAllMocks());

  it('preserves Urdu text and blank optional cells while recording source row numbers', async () => {
    excelMocks.readSheet.mockResolvedValue([
      ['Student Name', 'Date of Birth', 'Gender', 'Phone', 'Unused column'],
      [
        'علی رضا',
        new Date('2012-04-10T00:00:00.000Z'),
        'Male',
        '03001234567',
        'Keep as note later',
      ],
      ['', '', '', '', ''],
      ['Ayesha Khan', '', 'Female', '03007654321', ''],
    ]);
    const parsed = await parseStudentWorkbook(emptyBuffer());

    expect(parsed.sheetName).toBe('First worksheet');
    expect(parsed.headers).toEqual([
      'Student Name',
      'Date of Birth',
      'Gender',
      'Phone',
      'Unused column',
    ]);
    expect(parsed.rows).toEqual([
      {
        rowNumber: 2,
        cells: [
          'علی رضا',
          '2012-04-10',
          'Male',
          '03001234567',
          'Keep as note later',
        ],
      },
      {
        rowNumber: 4,
        cells: ['Ayesha Khan', '', 'Female', '03007654321', ''],
      },
    ]);
    expect(excelMocks.readSheet).toHaveBeenCalledWith(emptyBuffer());
  });

  it('guesses common English headings, skips unknown or duplicate mappings', () => {
    expect(
      suggestStudentImportMappings([
        'Student Name',
        'DOB',
        'Gender',
        'Mobile No',
        'Class',
        'Student Name',
        'Father Name',
        'Family contact Phone',
        'Parent Email',
        'Relationship',
      ]),
    ).toEqual([
      'fullName',
      'dateOfBirth',
      'gender',
      'phone',
      'skip',
      'skip',
      'guardianName',
      'guardianPhone',
      'guardianEmail',
      'guardianRelationship',
    ]);
  });

  it('handles escaped quotes, quoted commas, line breaks and formula-like CSV text as values only', () => {
    const parsed = parseStudentCsv(
      'Student Name,Notes\r\n"Ali, Raza","Said ""hello"""\r\n"=HYPERLINK(""https://example.test"")",\r\n"Ayesha\nKhan",Ready\r\n',
    );
    expect(parsed.rows).toEqual([
      { rowNumber: 2, cells: ['Ali, Raza', 'Said "hello"'] },
      { rowNumber: 3, cells: ['=HYPERLINK("https://example.test")', ''] },
      { rowNumber: 4, cells: ['Ayesha\nKhan', 'Ready'] },
    ]);
  });

  it('preserves original CSV line numbers when blank lines appear between students', () => {
    const parsed = parseStudentCsv(
      'Student Name,Phone\r\nAli Raza,03001234567\r\n\r\nAyesha Khan,03007654321\r\n',
    );
    expect(parsed.rows).toEqual([
      { rowNumber: 2, cells: ['Ali Raza', '03001234567'] },
      { rowNumber: 4, cells: ['Ayesha Khan', '03007654321'] },
    ]);
  });

  it('rejects an unclosed quoted CSV cell, an empty workbook and worksheets with too many columns', async () => {
    expect(() => parseStudentCsv('Name,Phone\n"Ali,0300')).toThrow(
      /unclosed quoted cell/i,
    );
    excelMocks.readSheet.mockResolvedValue([]);
    await expect(parseStudentWorkbook(emptyBuffer())).rejects.toThrow(/empty/i);
    excelMocks.readSheet.mockResolvedValue([
      Array.from({ length: 51 }, (_value, index) => `Column ${index + 1}`),
    ]);
    await expect(parseStudentWorkbook(emptyBuffer())).rejects.toThrow(
      /50 columns/i,
    );
  });

  it('rejects a batch with more than 1,000 rows before offering an import preview', async () => {
    const rows: string[][] = [['First name', 'Last name']];
    for (let index = 0; index < 1001; index += 1) {
      rows.push([`Student${index}`, `Family${index}`]);
    }
    excelMocks.readSheet.mockResolvedValue(rows);
    await expect(parseStudentWorkbook(emptyBuffer())).rejects.toThrow(/1000/);
  });

  it('rejects legacy .xls and files with unsupported extensions', async () => {
    await expect(
      parseStudentImportFile(new File(['legacy'], 'register.xls')),
    ).rejects.toThrow(/Save older .xls files as .xlsx/i);
    await expect(
      parseStudentImportFile(new File(['macro'], 'register.xlsm')),
    ).rejects.toThrow(/Use an Excel .xlsx or CSV .csv/i);
    expect(excelMocks.readSheet).not.toHaveBeenCalled();
  });
});
