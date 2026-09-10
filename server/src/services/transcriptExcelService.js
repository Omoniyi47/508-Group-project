import ExcelJS from 'exceljs';

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
const HEADER_FONT = { color: { argb: 'FFFFFFFF' }, bold: true };

export async function buildTranscriptWorkbook({
  student,
  history,
  transcriptRequest,
  institutionName,
  institutionAddress,
  registrarName,
  registrarEmail,
  registrarPhone,
  footerNote,
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = institutionName;
  const sheet = workbook.addWorksheet('Transcript');

  sheet.columns = [
    { width: 12 },
    { width: 36 },
    { width: 10 },
    { width: 10 },
    { width: 8 },
    { width: 10 },
  ];

  sheet.mergeCells('A1:F1');
  sheet.getCell('A1').value = institutionName;
  sheet.getCell('A1').font = { bold: true, size: 14 };

  let row = 2;
  if (institutionAddress) {
    sheet.mergeCells(`A${row}:F${row}`);
    sheet.getCell(`A${row}`).value = institutionAddress;
    sheet.getCell(`A${row}`).font = { color: { argb: 'FF64748B' } };
    row += 1;
  }

  sheet.mergeCells(`A${row}:F${row}`);
  sheet.getCell(`A${row}`).value = 'Official Academic Transcript';
  sheet.getCell(`A${row}`).font = { italic: true, color: { argb: 'FF64748B' } };
  row += 1;
  if (transcriptRequest?.issueSerial) {
    sheet.mergeCells(`A${row}:F${row}`);
    sheet.getCell(`A${row}`).value = `Transcript Serial: ${transcriptRequest.issueSerial}   |   Issue Date: ${new Date(transcriptRequest.releasedAt || transcriptRequest.approvedAt || Date.now()).toLocaleDateString('en-GB')}`;
    sheet.getCell(`A${row}`).font = { size: 10, color: { argb: 'FF64748B' } };
    row += 1;
  }
  row += 1;
  const infoLines = [
    ['Name', `${student.firstName} ${student.otherNames || ''} ${student.lastName}`.trim()],
    ['Matric Number', student.matricNumber],
    ['Department', student.department?.name],
    ['Faculty', student.department?.faculty?.name],
    ['Entry Session', student.entrySession?.name],
    ['Graduation Session', student.graduationSession?.name || '—'],
    ['Current Level', student.currentLevel?.name],
    ['Status', student.status],
  ];
  for (const [label, value] of infoLines) {
    sheet.getCell(`A${row}`).value = label;
    sheet.getCell(`A${row}`).font = { bold: true };
    sheet.getCell(`B${row}`).value = value ?? '—';
    row += 1;
  }
  row += 1;

  for (const semester of history.semesters) {
    sheet.mergeCells(`A${row}:F${row}`);
    const titleCell = sheet.getCell(`A${row}`);
    titleCell.value = `${semester.level.name} Level - ${semester.semester.name} Semester - ${semester.session.name}`;
    titleCell.font = { bold: true, color: { argb: 'FF4F46E5' } };
    row += 1;

    const headerRow = sheet.getRow(row);
    headerRow.values = ['Code', 'Title', 'Units', 'Score', 'Grade', 'Point'];
    headerRow.eachCell((cell) => {
      cell.fill = HEADER_FILL;
      cell.font = HEADER_FONT;
    });
    row += 1;

    for (const course of semester.courses) {
      sheet.getRow(row).values = [course.course.code, course.course.title, course.course.creditUnit, course.score, course.grade, course.gradePoint];
      row += 1;
    }

    sheet.mergeCells(`A${row}:F${row}`);
    sheet.getCell(`A${row}`).value = `Semester GPA: ${semester.semesterGpa.toFixed(2)}   |   Credit Units: ${semester.semesterCreditUnits}   |   Cumulative GPA: ${semester.cumulativeGpa.toFixed(2)}`;
    sheet.getCell(`A${row}`).font = { italic: true };
    row += 2;
  }

  sheet.mergeCells(`A${row}:F${row}`);
  sheet.getCell(`A${row}`).value = `CGPA: ${history.cgpa.toFixed(2)}   |   Classification: ${history.classification || 'Not yet classified'}   |   Total Credit Units Earned: ${history.totalCreditUnits}`;
  sheet.getCell(`A${row}`).font = { bold: true, size: 12 };
  row += 2;

  if (history.failedCourses.length > 0) {
    sheet.getCell(`A${row}`).value = 'Outstanding / Failed Courses';
    sheet.getCell(`A${row}`).font = { bold: true, color: { argb: 'FFDC2626' } };
    row += 1;
    for (const f of history.failedCourses) {
      sheet.getCell(`A${row}`).value = `${f.course.code} - ${f.course.title} (${f.session.name}, ${f.semester.name}) - Grade ${f.grade}`;
      row += 1;
    }
    row += 1;
  }

  if (transcriptRequest) {
    sheet.getCell(`A${row}`).value = 'Status';
    sheet.getCell(`A${row}`).font = { bold: true };
    sheet.getCell(`B${row}`).value = transcriptRequest.status;
    row += 1;
    sheet.getCell(`A${row}`).value = 'Verified by';
    sheet.getCell(`B${row}`).value = transcriptRequest.verifiedBy?.name || '—';
    row += 1;
    sheet.getCell(`A${row}`).value = 'Approved by';
    sheet.getCell(`B${row}`).value = transcriptRequest.approvedBy?.name || '—';
  }

  const verificationContacts = [
    registrarName ? `Registrar: ${registrarName}` : '',
    registrarEmail ? `Email: ${registrarEmail}` : '',
    registrarPhone ? `Phone: ${registrarPhone}` : '',
  ].filter(Boolean);
  if (footerNote || verificationContacts.length > 0) {
    row += 2;
    sheet.mergeCells(`A${row}:F${row}`);
    sheet.getCell(`A${row}`).value = [
      footerNote,
      verificationContacts.length > 0 ? `For verification, contact ${verificationContacts.join(' | ')}` : '',
    ]
      .filter(Boolean)
      .join(' | ');
    sheet.getCell(`A${row}`).font = { italic: true, color: { argb: 'FF64748B' } };
  }

  return workbook;
}
