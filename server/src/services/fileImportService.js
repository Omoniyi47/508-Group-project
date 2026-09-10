import Papa from 'papaparse';
import ExcelJS from 'exceljs';
import { Student } from '../models/Student.js';
import { Result } from '../models/Result.js';

const MATRIC_ALIASES = ['matric', 'matricnumber', 'matricno', 'regnumber', 'regno', 'registrationnumber'];
const SCORE_ALIASES = ['score', 'marks', 'mark', 'result', 'total'];
const NAME_ALIASES = ['name', 'fullname', 'studentname', 'studentfullname'];

function normalizeHeader(header) {
  return String(header).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function extractField(row, aliases) {
  for (const key of Object.keys(row)) {
    if (aliases.includes(normalizeHeader(key))) return row[key];
  }
  return undefined;
}

function comparableName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(' ');
}

export function parseCsvBuffer(buffer) {
  const text = buffer.toString('utf-8');
  const { data } = Papa.parse(text, { header: true, skipEmptyLines: true });
  return data;
}

export async function parseExcelBuffer(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const headerRow = sheet.getRow(1).values.slice(1).map((h) => String(h ?? ''));
  const rows = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values = row.values.slice(1);
    const record = {};
    headerRow.forEach((header, index) => {
      record[header] = values[index] ?? '';
    });
    rows.push(record);
  });
  return rows;
}

export function parseUploadedFile(buffer, originalName) {
  const isExcel = /\.xlsx?$/i.test(originalName);
  return isExcel ? parseExcelBuffer(buffer) : Promise.resolve(parseCsvBuffer(buffer));
}

/**
 * Validates raw parsed rows against a specific (course, session, semester) context,
 * resolving each row's student by matric number and flagging errors/warnings.
 * Returns row descriptors shaped for UploadBatch.rows, plus a summary.
 */
export async function validateRows(rawRows, { course, session, semester, departmentId = null }) {
  const seenMatrics = new Set();
  const rows = [];

  for (let i = 0; i < rawRows.length; i += 1) {
    const raw = rawRows[i];
    const rowNumber = i + 2; // account for the header row
    const matricRaw = extractField(raw, MATRIC_ALIASES);
    const scoreRaw = extractField(raw, SCORE_ALIASES);
    const nameRaw = extractField(raw, NAME_ALIASES);
    const messages = [];

    const matricNumber = String(matricRaw ?? '').trim().toUpperCase();
    if (!matricNumber) {
      rows.push({
        rowNumber,
        matricNumber: '(missing)',
        score: scoreRaw ?? null,
        extractedName: String(nameRaw ?? '').trim() || null,
        ocrConfidence: Number.isFinite(Number(raw.ocrConfidence)) ? Number(raw.ocrConfidence) : null,
        status: 'error',
        messages: ['Matric number is missing'],
      });
      continue;
    }

    if (seenMatrics.has(matricNumber)) {
      messages.push('Duplicate matric number within this file');
    }
    seenMatrics.add(matricNumber);

    const score = Number(scoreRaw);
    if (scoreRaw === undefined || scoreRaw === '' || Number.isNaN(score)) {
      messages.push('Score is missing or not a number');
    } else if (score < 0 || score > 100) {
      messages.push('Score must be between 0 and 100');
    }

    // A departmental Result Officer must only ever see or process students in
    // their department.  Keep the lookup scoped rather than resolving a student
    // first and checking it afterwards, which would reveal another department's
    // records in the upload preview.
    const studentFilter = { matricNumber };
    if (departmentId) studentFilter.department = departmentId;
    const student = await Student.findOne(studentFilter);
    if (!student) {
      messages.push(`No student found with matric number ${matricNumber}`);
    } else if (course.department && String(course.department) !== String(student.department)) {
      messages.push('The selected course is not mapped to this student programme');
    } else if (nameRaw && comparableName(nameRaw) !== comparableName(`${student.firstName} ${student.lastName}`)) {
      messages.push('Extracted name differs from the student record; verify the scan before saving');
    }

    let existingResultStatus = null;
    if (student) {
      const existing = await Result.findOne({ student: student._id, course: course._id, session: session._id, semester: semester._id });
      if (existing) {
        existingResultStatus = existing.status;
        if (!['draft', 'rejected'].includes(existing.status)) {
          messages.push(`An existing ${existing.status} result cannot be overwritten by bulk import`);
        } else {
          messages.push(`This will update the existing ${existing.status} result for this student`);
        }
      }
    }

    const hasBlockingError = messages.some(
      (m) =>
        m.includes('missing') ||
        m.includes('Duplicate') ||
        m.includes('No student found') ||
        m.includes('cannot be overwritten') ||
        m.includes('must be between')
    );

    rows.push({
      rowNumber,
      matricNumber,
      score: Number.isNaN(score) ? null : score,
      studentId: student?._id || null,
      studentName: student ? `${student.firstName} ${student.lastName}` : null,
      extractedName: String(nameRaw ?? '').trim() || null,
      ocrConfidence: Number.isFinite(Number(raw.ocrConfidence)) ? Number(raw.ocrConfidence) : null,
      status: hasBlockingError ? 'error' : existingResultStatus ? 'warning' : 'valid',
      messages,
    });
  }

  const summary = {
    total: rows.length,
    validCount: rows.filter((r) => r.status === 'valid').length,
    warningCount: rows.filter((r) => r.status === 'warning').length,
    errorCount: rows.filter((r) => r.status === 'error').length,
  };

  return { rows, summary };
}
