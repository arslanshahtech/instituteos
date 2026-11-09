import { readSheet } from 'read-excel-file/browser';

export const MAX_STUDENT_IMPORT_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_STUDENT_IMPORT_ROWS = 1000;
export const MAX_STUDENT_IMPORT_COLUMNS = 50;

export const STUDENT_IMPORT_FIELDS = [
  { value: 'fullName', label: 'Full student name' },
  { value: 'firstName', label: 'First name' },
  { value: 'lastName', label: 'Last name / surname' },
  { value: 'preferredName', label: 'Preferred name' },
  { value: 'dateOfBirth', label: 'Date of birth' },
  { value: 'gender', label: 'Gender' },
  { value: 'contactEmail', label: 'Student email' },
  { value: 'phone', label: 'Student / primary contact phone' },
  { value: 'status', label: 'Status' },
  { value: 'guardianName', label: 'Family contact full name' },
  { value: 'guardianPhone', label: 'Family contact phone' },
  { value: 'guardianEmail', label: 'Family contact email' },
  {
    value: 'guardianRelationship',
    label: 'Relationship (father/mother/guardian/other)',
  },
] as const;

export type StudentImportField =
  (typeof STUDENT_IMPORT_FIELDS)[number]['value'] | 'skip';

export interface ParsedStudentSheetRow {
  rowNumber: number;
  cells: string[];
}

export interface ParsedStudentSheet {
  sheetName: string;
  headers: string[];
  rows: ParsedStudentSheetRow[];
}

function cellToString(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'string') return value.replace(/^\uFEFF/, '').trim();
  if (typeof value === 'number' && !Number.isFinite(value)) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value).trim();
}

function isBlankRow(row: unknown[]): boolean {
  return row.every((cell) => cellToString(cell) === '');
}

function normalizeMatrix(
  matrix: unknown[][],
  sheetName: string,
): ParsedStudentSheet {
  const columnCount = matrix.reduce((max, row) => Math.max(max, row.length), 0);
  if (columnCount > MAX_STUDENT_IMPORT_COLUMNS) {
    throw new Error(
      `Use ${MAX_STUDENT_IMPORT_COLUMNS} columns or fewer per import.`,
    );
  }
  const headerIndex = matrix.findIndex((row) => !isBlankRow(row));
  if (headerIndex < 0) throw new Error('The first worksheet is empty.');

  const rawHeaders = matrix[headerIndex] ?? [];
  const headers = rawHeaders.map((cell, index) => {
    const value = cellToString(cell);
    return value || `Unnamed column ${index + 1}`;
  });
  if (!headers.some((header) => !header.startsWith('Unnamed column '))) {
    throw new Error('The first non-empty row must contain column headings.');
  }

  const rows: ParsedStudentSheetRow[] = [];
  for (let index = headerIndex + 1; index < matrix.length; index += 1) {
    const row = matrix[index] ?? [];
    if (isBlankRow(row)) continue;
    rows.push({
      // Spreadsheet row numbers are one-based and include the header row.
      rowNumber: index + 1,
      cells: headers.map((_header, cellIndex) => cellToString(row[cellIndex])),
    });
    if (rows.length > MAX_STUDENT_IMPORT_ROWS) {
      throw new Error(
        `This import supports up to ${MAX_STUDENT_IMPORT_ROWS} non-empty student rows per batch.`,
      );
    }
  }
  if (rows.length === 0)
    throw new Error('No student rows were found below the headings.');
  return { sheetName, headers, rows };
}

/** Reads the first worksheet from a modern XLSX file. Formula values are never evaluated here. */
export async function parseStudentWorkbook(
  buffer: ArrayBuffer,
): Promise<ParsedStudentSheet> {
  let matrix: unknown[][];
  try {
    matrix = await readSheet(buffer);
  } catch {
    throw new Error(
      'This file could not be read as an Excel .xlsx file. Try re-saving it as .xlsx or exporting it as .csv.',
    );
  }
  return normalizeMatrix(matrix, 'First worksheet');
}

/** Small CSV state machine supports quoted commas, escaped quotes and multiline cells. */
export function parseStudentCsv(text: string): ParsedStudentSheet {
  const source = text.replace(/^\uFEFF/, '');
  const matrix: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index] ?? '';
    if (inQuotes) {
      if (character === '"' && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        inQuotes = false;
      } else {
        cell += character;
      }
      continue;
    }
    if (character === '"' && cell.length === 0) {
      inQuotes = true;
    } else if (character === ',') {
      row.push(cell);
      cell = '';
    } else if (character === '\n' || character === '\r') {
      row.push(cell);
      // Keep blank lines so rowNumber continues to match the source spreadsheet.
      matrix.push(row);
      row = [];
      cell = '';
      if (character === '\r' && source[index + 1] === '\n') index += 1;
    } else {
      cell += character;
    }
  }
  if (inQuotes)
    throw new Error(
      'CSV has an unclosed quoted cell. Check the file and try again.',
    );
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    if (!isBlankRow(row)) matrix.push(row);
  }
  return normalizeMatrix(matrix, 'CSV file');
}

export async function parseStudentImportFile(
  file: File,
): Promise<ParsedStudentSheet> {
  if (file.size === 0) throw new Error('The selected file is empty.');
  if (file.size > MAX_STUDENT_IMPORT_FILE_BYTES) {
    throw new Error(
      'The maximum file size is 5 MB. Split the register into smaller files.',
    );
  }
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith('.csv')) return parseStudentCsv(await file.text());
  if (!lowerName.endsWith('.xlsx')) {
    throw new Error(
      'Use an Excel .xlsx or CSV .csv file. Save older .xls files as .xlsx first.',
    );
  }
  return parseStudentWorkbook(await file.arrayBuffer());
}

function normalizedHeader(header: string): string {
  return header
    .normalize('NFC')
    .toLocaleLowerCase()
    .replace(/[\s_.()\-/#:]+/g, '');
}

export function guessStudentImportField(header: string): StudentImportField {
  const normalized = normalizedHeader(header);
  if (
    /^(fullname|studentname|pupilname|learnername|نامطالبعلم|طالبعلمنام|نام)$/.test(
      normalized,
    )
  )
    return 'fullName';
  if (/^(firstname|studentfirstname|givenname|first|پہلانام)$/.test(normalized))
    return 'firstName';
  if (
    /^(lastname|studentlastname|surname|familyname|last|خاندانینام)$/.test(
      normalized,
    )
  )
    return 'lastName';
  if (/^(preferredname|nickname|callname)$/.test(normalized))
    return 'preferredName';
  if (/^(dateofbirth|dob|birthdate|datebirth|تاریخپیدائش)$/.test(normalized))
    return 'dateOfBirth';
  if (/^(gender|sex|جنس)$/.test(normalized)) return 'gender';
  if (/^(email|studentemail|contactemail|emailaddress)$/.test(normalized))
    return 'contactEmail';
  if (
    /^(phone|studentphone|studentmobile|mobile|mobileno|mobilenumber|phonenumber|contactnumber|فون|mobilephone)$/.test(
      normalized,
    )
  )
    return 'phone';
  if (
    /^(status|studentstatus|enrolmentstatus|enrollmentstatus)$/.test(normalized)
  )
    return 'status';
  if (
    /^(guardianname|parentname|fathername|mothername|parentguardianname)$/.test(
      normalized,
    )
  )
    return 'guardianName';
  if (
    /^(guardianphone|parentphone|fatherphone|motherphone|guardianmobile|parentmobile)$/.test(
      normalized,
    )
  )
    return 'guardianPhone';
  if (/^(guardianemail|parentemail|fatheremail|motheremail)$/.test(normalized))
    return 'guardianEmail';
  if (
    /^(guardianrelationship|parentrelationship|relationship)$/.test(normalized)
  )
    return 'guardianRelationship';
  return 'skip';
}

export function suggestStudentImportMappings(
  headers: string[],
): StudentImportField[] {
  const used = new Set<StudentImportField>();
  return headers.map((header) => {
    const suggested = guessStudentImportField(header);
    if (suggested === 'skip' || used.has(suggested)) return 'skip';
    used.add(suggested);
    return suggested;
  });
}
