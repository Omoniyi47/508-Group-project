const COLORS = {
  navy: '#0F172A',
  indigo: '#4F46E5',
  teal: '#14B8A6',
  offWhite: '#F8FAFC',
  slate: '#64748B',
  success: '#16A34A',
  warning: '#F59E0B',
  danger: '#DC2626',
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function formatDate(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
}

function renderSemesterTable(semester) {
  const rows = semester.courses
    .map(
      (c) => `
      <tr>
        <td>${escapeHtml(c.course.code)}</td>
        <td>${escapeHtml(c.course.title)}</td>
        <td class="center">${c.course.creditUnit}</td>
        <td class="center">${c.score}</td>
        <td class="center">${escapeHtml(c.grade)}</td>
        <td class="center">${c.gradePoint.toFixed(1)}</td>
      </tr>`
    )
    .join('');

  return `
    <section class="semester-block">
      <h3>${escapeHtml(semester.level.name)} Level &mdash; ${escapeHtml(semester.semester.name)} Semester &mdash; ${escapeHtml(semester.session.name)}</h3>
      <table class="courses-table">
        <thead>
          <tr>
            <th>Code</th><th>Title</th><th>Units</th><th>Score</th><th>Grade</th><th>Point</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="semester-summary">
        Semester GPA: <strong>${semester.semesterGpa.toFixed(2)}</strong> &nbsp;|&nbsp;
        Credit Units: <strong>${semester.semesterCreditUnits}</strong> &nbsp;|&nbsp;
        Cumulative GPA: <strong>${semester.cumulativeGpa.toFixed(2)}</strong>
      </p>
    </section>`;
}

export function renderTranscriptHtml({
  student,
  history,
  transcriptRequest,
  institutionName,
  institutionAddress,
  registrarName,
  registrarEmail,
  registrarPhone,
  footerNote,
  officialTranscriptWatermarkText = '',
  officialTranscriptSealLabel = '',
}) {
  const isOfficial = transcriptRequest && ['approved', 'released'].includes(transcriptRequest.status);
  const watermarkText = isOfficial ? officialTranscriptWatermarkText : 'UNOFFICIAL — NOT YET APPROVED';
  const watermark = watermarkText ? `<div class="watermark">${escapeHtml(watermarkText)}</div>` : '';
  const serialNumber = transcriptRequest?.issueSerial || `PREVIEW-${String(student.matricNumber).replace(/\s+/g, '-')}`;
  const issueDate = transcriptRequest?.releasedAt || transcriptRequest?.approvedAt || new Date();
  const sealLabel = officialTranscriptSealLabel || 'INSTITUTIONAL SEAL RESERVED';

  const failedCoursesSection =
    history.failedCourses.length > 0
      ? `
      <section class="failed-courses">
        <h3>Outstanding / Failed Courses</h3>
        <ul>
          ${history.failedCourses.map((f) => `<li>${escapeHtml(f.course.code)} - ${escapeHtml(f.course.title)} (${escapeHtml(f.session.name)}, ${escapeHtml(f.semester.name)}) &mdash; Grade ${escapeHtml(f.grade)}</li>`).join('')}
        </ul>
      </section>`
      : '';

  const verificationSection = transcriptRequest
    ? `
      <section class="verification">
        <div><strong>Status:</strong> <span class="status-badge status-${transcriptRequest.status}">${transcriptRequest.status.toUpperCase()}</span></div>
        <div><strong>Verified by:</strong> ${escapeHtml(transcriptRequest.verifiedBy?.name)} on ${formatDate(transcriptRequest.verifiedAt)}</div>
        <div><strong>Approved by:</strong> ${escapeHtml(transcriptRequest.approvedBy?.name)} on ${formatDate(transcriptRequest.approvedAt)}</div>
      </section>`
    : '';

  const verificationContacts = [
    registrarName ? `Registrar: ${escapeHtml(registrarName)}` : '',
    registrarEmail ? `Email: ${escapeHtml(registrarEmail)}` : '',
    registrarPhone ? `Phone: ${escapeHtml(registrarPhone)}` : '',
  ].filter(Boolean);
  const footerParts = [
    `Generated ${formatDate(new Date())}`,
    footerNote ? escapeHtml(footerNote) : '',
    verificationContacts.length > 0 ? `For verification, contact ${verificationContacts.join(' &middot; ')}` : '',
  ].filter(Boolean);

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Transcript - ${escapeHtml(student.matricNumber)}</title>
<style>
  @page { size: A4; margin: 18mm 15mm; @bottom-center { content: "Page " counter(page) " of " counter(pages); color: ${COLORS.slate}; font-size: 9px; } }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: ${COLORS.navy}; margin: 0; font-size: 12px; position: relative; }
  .watermark {
    position: fixed; top: 40%; left: 0; right: 0; text-align: center;
    font-size: 42px; font-weight: 700; color: ${COLORS.danger}; opacity: 0.15;
    transform: rotate(-25deg); z-index: -1; pointer-events: none;
  }
  .document-meta { display: flex; justify-content: space-between; gap: 12px; margin: 0 0 12px; color: ${COLORS.slate}; font-size: 10px; }
  header { text-align: center; border-bottom: 3px solid ${COLORS.indigo}; padding-bottom: 12px; margin-bottom: 16px; }
  header h1 { margin: 0; font-size: 20px; color: ${COLORS.navy}; letter-spacing: 0.5px; }
  header p { margin: 4px 0 0; color: ${COLORS.slate}; font-size: 13px; }
  .student-info { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; margin-bottom: 20px; padding: 12px; background: ${COLORS.offWhite}; border-radius: 6px; }
  .student-info div span.label { color: ${COLORS.slate}; }
  .semester-block { margin-bottom: 16px; page-break-inside: avoid; }
  .semester-block h3 { font-size: 13px; margin: 0 0 6px; color: ${COLORS.indigo}; }
  table.courses-table { width: 100%; border-collapse: collapse; }
  table.courses-table th, table.courses-table td { border: 1px solid #E2E8F0; padding: 5px 8px; text-align: left; }
  table.courses-table th { background: ${COLORS.navy}; color: white; font-weight: 600; }
  .center { text-align: center; }
  .semester-summary { margin: 6px 0 0; text-align: right; color: ${COLORS.slate}; }
  .summary-box { margin-top: 20px; padding: 16px; border: 2px solid ${COLORS.indigo}; border-radius: 8px; text-align: center; }
  .summary-box .cgpa { font-size: 28px; font-weight: 700; color: ${COLORS.indigo}; }
  .summary-box .classification { font-size: 16px; font-weight: 600; color: ${COLORS.navy}; margin-top: 4px; }
  .failed-courses { margin-top: 16px; }
  .failed-courses h3 { color: ${COLORS.danger}; font-size: 13px; }
  .verification { margin-top: 24px; padding-top: 12px; border-top: 1px solid #E2E8F0; font-size: 11px; color: ${COLORS.slate}; }
  .authorization { display: flex; justify-content: space-between; align-items: end; gap: 24px; margin-top: 28px; page-break-inside: avoid; }
  .signature { min-width: 220px; border-top: 1px solid ${COLORS.navy}; padding-top: 6px; font-size: 11px; }
  .signature strong { display: block; color: ${COLORS.navy}; }
  .seal { width: 92px; height: 92px; border: 2px dashed ${COLORS.indigo}; border-radius: 50%; display: flex; align-items: center; justify-content: center; text-align: center; padding: 10px; color: ${COLORS.indigo}; font-size: 9px; font-weight: 700; }
  .status-badge { padding: 2px 8px; border-radius: 999px; font-weight: 600; }
  .status-approved, .status-released { background: ${COLORS.success}22; color: ${COLORS.success}; }
  .status-requested, .status-verified { background: ${COLORS.warning}22; color: ${COLORS.warning}; }
  .status-rejected { background: ${COLORS.danger}22; color: ${COLORS.danger}; }
  footer { margin-top: 24px; font-size: 10px; color: ${COLORS.slate}; text-align: center; }
  .integrity-notice { margin-top: 7px; color: ${COLORS.danger}; font-weight: 700; text-transform: uppercase; letter-spacing: .02em; }
</style>
</head>
<body>
  ${watermark}
  <div class="document-meta"><span>Transcript Serial: <strong>${escapeHtml(serialNumber)}</strong></span><span>Issue Date: ${formatDate(issueDate)}</span></div>
  <header>
    <h1>${escapeHtml(institutionName)}</h1>
    ${institutionAddress ? `<p>${escapeHtml(institutionAddress)}</p>` : ''}
    <p>Official Academic Transcript</p>
  </header>

  <div class="student-info">
    <div><span class="label">Name:</span> ${escapeHtml(student.firstName)} ${escapeHtml(student.otherNames)} ${escapeHtml(student.lastName)}</div>
    <div><span class="label">Matric Number:</span> ${escapeHtml(student.matricNumber)}</div>
    <div><span class="label">Department:</span> ${escapeHtml(student.department?.name)}</div>
    <div><span class="label">Faculty:</span> ${escapeHtml(student.department?.faculty?.name)}</div>
    <div><span class="label">Entry Session:</span> ${escapeHtml(student.entrySession?.name)}</div>
    <div><span class="label">Graduation Session:</span> ${escapeHtml(student.graduationSession?.name) || '—'}</div>
    <div><span class="label">Current Level:</span> ${escapeHtml(student.currentLevel?.name)}</div>
    <div><span class="label">Status:</span> ${escapeHtml(student.status)}</div>
  </div>

  ${history.semesters.map(renderSemesterTable).join('')}

  <div class="summary-box">
    <div class="cgpa">CGPA: ${history.cgpa.toFixed(2)}</div>
    <div class="classification">${escapeHtml(history.classification || 'Not yet classified')}</div>
    <p>Total Credit Units Earned: ${history.totalCreditUnits}</p>
  </div>

  ${failedCoursesSection}
  ${verificationSection}

  <section class="authorization">
    <div class="signature">
      <strong>${escapeHtml(registrarName || 'Registrar / Authorized Signatory')}</strong>
      Registrar / Authorized Signatory
    </div>
    <div class="seal">${escapeHtml(sealLabel)}</div>
  </section>

  <footer>${footerParts.join(' &middot; ')}<div class="integrity-notice">This document is invalid if altered.</div></footer>
</body>
</html>`;
}
