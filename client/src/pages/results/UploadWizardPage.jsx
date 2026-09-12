import { useEffect, useState } from 'react';
import { loadDropdownOptions } from '../../api/dropdownOptions';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { resultApi } from '../../api/resultApi';
import { courseApi } from '../../api/courseApi';
import { sessionApi } from '../../api/sessionApi';
import { semesterApi } from '../../api/semesterApi';
import { levelApi } from '../../api/levelApi';
import { PageHeader } from '../../components/common/PageHeader';
import { Button } from '../../components/common/Button';
import { Select } from '../../components/common/Select';
import { Input } from '../../components/common/Input';
import { FileDropzone } from '../../components/common/FileDropzone';
import { Spinner } from '../../components/common/Spinner';
import { Modal } from '../../components/common/Modal';
import { CoursePicker } from '../../components/common/CoursePicker';

const ROW_STYLES = { valid: 'bg-success/5', warning: 'bg-warning/5', error: 'bg-danger/5' };

export default function UploadWizardPage() {
  const navigate = useNavigate();
  const [lookups, setLookups] = useState({ courses: [], sessions: [], semesters: [], levels: [] });
  const [context, setContext] = useState({ course: '', session: '', semester: '', level: '' });
  const [sourceMode, setSourceMode] = useState('spreadsheet');
  const [file, setFile] = useState(null);
  const [batch, setBatch] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isLoadingLookups, setIsLoadingLookups] = useState(true);
  const [confirmResult, setConfirmResult] = useState(null);
  const [editingRow, setEditingRow] = useState(null);
  const [correction, setCorrection] = useState({ matricNumber: '', score: '' });
  const [isSavingCorrection, setIsSavingCorrection] = useState(false);
  const [scanPreviewUrl, setScanPreviewUrl] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function loadLookups() {
      try {
        const [courseRes, sessionRes, semesterRes, levelRes] = await Promise.all([
          loadDropdownOptions(courseApi), loadDropdownOptions(sessionApi), loadDropdownOptions(semesterApi), loadDropdownOptions(levelApi),
        ]);
        if (!cancelled) setLookups({
          courses: courseRes.data.data,
          sessions: sessionRes.data.data.map((item) => ({ value: item._id, label: item.name })),
          semesters: semesterRes.data.data.map((item) => ({ value: item._id, label: item.name })),
          levels: levelRes.data.data.map((item) => ({ value: item._id, label: item.name })),
        });
      } catch {
        if (!cancelled) toast.error('Could not load the academic setup data needed for this import');
      } finally {
        if (!cancelled) setIsLoadingLookups(false);
      }
    }
    loadLookups();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (sourceMode !== 'ocr' || !file) {
      setScanPreviewUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setScanPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file, sourceMode]);

  const contextReady = context.course && context.session && context.semester && context.level;
  const isOcrBatch = batch?.sourceType === 'ocr';

  const handleUpload = async () => {
    if (!file) return toast.error('Select a file first');
    setIsUploading(true);
    try {
      const response = sourceMode === 'ocr' ? await resultApi.previewOcrUpload(file, context) : await resultApi.previewUpload(file, context);
      setBatch(response.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to ${sourceMode === 'ocr' ? 'read the scan' : 'parse file'}`);
    } finally { setIsUploading(false); }
  };

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      const response = await resultApi.confirmUpload(batch._id);
      setConfirmResult(response.data.data);
      toast.success(response.data.message);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to commit import');
    } finally { setIsConfirming(false); }
  };

  const startOver = () => { setFile(null); setBatch(null); setConfirmResult(null); };
  const changeSourceMode = (nextMode) => { setSourceMode(nextMode); setFile(null); setBatch(null); setConfirmResult(null); };
  const openCorrection = (row) => {
    setEditingRow(row);
    setCorrection({ matricNumber: row.matricNumber === '(missing)' ? '' : row.matricNumber, score: row.score ?? '' });
  };
  const saveCorrection = async () => {
    if (!editingRow) return;
    setIsSavingCorrection(true);
    try {
      const response = await resultApi.correctOcrRow(batch._id, editingRow.rowNumber, correction);
      setBatch(response.data.data);
      setEditingRow(null);
      toast.success('OCR row corrected and revalidated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not correct this OCR row');
    } finally { setIsSavingCorrection(false); }
  };

  return (
    <div>
      <PageHeader
        title={sourceMode === 'ocr' ? 'OCR Result Sheet Scan' : 'Bulk Result Upload'}
        description={sourceMode === 'ocr' ? 'Read a scanned result sheet, verify every extraction, then submit it for approval.' : 'Import results from a CSV or Excel file, with validation before saving.'}
        actions={<Link to="/results"><Button variant="secondary">Back to results</Button></Link>}
      />

      {confirmResult ? (
        <div className="rounded-xl border border-slate/15 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-navy">Import complete</h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            {[["border-l-success", confirmResult.created, 'Created'], ["border-l-teal", confirmResult.updated, 'Updated'], ["border-l-danger", confirmResult.skipped.length, 'Skipped']].map(([borderClass, count, label]) => <div key={label} className={`rounded-lg border-l-4 ${borderClass} bg-off-white p-4`}><p className="text-2xl font-semibold text-navy">{count}</p><p className="text-sm text-slate">{label}</p></div>)}
          </div>
          {confirmResult.skipped.length > 0 && <div className="mt-4"><p className="mb-2 text-sm font-medium text-navy">Skipped rows:</p><ul className="flex flex-col gap-1 text-sm text-slate">{confirmResult.skipped.map((row, index) => <li key={index}>{row.matricNumber}: {row.messages.join('; ')}</li>)}</ul></div>}
          <div className="mt-6 flex gap-3"><Button onClick={startOver}>Import another file</Button><Button variant="secondary" onClick={() => navigate('/results')}>Go to results</Button></div>
        </div>
      ) : batch ? (
        <div className="rounded-xl border border-slate/15 bg-white p-6 shadow-sm">
          {isOcrBatch && <div className="mb-5 rounded-xl border border-indigo/20 bg-indigo/5 p-4 text-sm text-navy"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold">OCR-assisted import - review required</p><p className="mt-1 text-slate">{batch.ocr?.pageCount || 0} page(s), {batch.ocr?.tableCount || 0} table(s){batch.ocr?.averageConfidence !== null && batch.ocr?.averageConfidence !== undefined ? `, ${batch.ocr.averageConfidence}% average confidence` : ''}. Correct doubtful rows before saving. Nothing is approved automatically.</p></div>{scanPreviewUrl && <a href={scanPreviewUrl} target="_blank" rel="noreferrer"><Button variant="secondary" size="sm">View scanned sheet</Button></a>}</div></div>}
          <div className="mb-4 flex flex-wrap gap-4"><div className="rounded-lg bg-off-white px-4 py-2 text-sm"><span className="font-semibold text-navy">{batch.summary.total}</span> total</div><div className="rounded-lg bg-success px-4 py-2 text-sm text-navy"><span className="font-semibold">{batch.summary.validCount}</span> valid</div><div className="rounded-lg bg-warning px-4 py-2 text-sm text-navy"><span className="font-semibold">{batch.summary.warningCount}</span> warnings</div><div className="rounded-lg bg-danger px-4 py-2 text-sm text-white"><span className="font-semibold">{batch.summary.errorCount}</span> errors</div></div>
          <div className="max-h-96 overflow-y-auto rounded-lg border border-slate/15"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-off-white"><tr><th className="px-3 py-2">Row</th><th className="px-3 py-2">Matric No.</th><th className="px-3 py-2">Student</th>{isOcrBatch && <th className="px-3 py-2">OCR name / confidence</th>}<th className="px-3 py-2">Score</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Messages</th>{isOcrBatch && <th className="px-3 py-2">Review</th>}</tr></thead><tbody>{batch.rows.map((row) => <tr key={row.rowNumber} className={ROW_STYLES[row.status]}><td className="px-3 py-2">{row.rowNumber}</td><td className="px-3 py-2">{row.matricNumber}</td><td className="px-3 py-2">{row.studentName || '-'}</td>{isOcrBatch && <td className="px-3 py-2 text-xs text-slate"><div>{row.extractedName || 'No name extracted'}</div><div>{row.ocrConfidence === null || row.ocrConfidence === undefined ? 'Confidence unavailable' : `${row.ocrConfidence}% confidence`}</div></td>}<td className="px-3 py-2">{row.score ?? '-'}</td><td className="px-3 py-2 capitalize">{row.status}</td><td className="px-3 py-2 text-xs text-slate">{row.messages.join('; ')}</td>{isOcrBatch && <td className="px-3 py-2"><Button variant="ghost" size="sm" onClick={() => openCorrection(row)}>Correct</Button></td>}</tr>)}</tbody></table></div>
          <div className="mt-6 flex gap-3"><Button variant="secondary" onClick={startOver}>Start over</Button><Button isLoading={isConfirming} disabled={batch.summary.validCount + batch.summary.warningCount === 0} onClick={handleConfirm}>Confirm &amp; Save ({batch.summary.validCount + batch.summary.warningCount} row(s))</Button></div>
        </div>
      ) : (
        <div className="flex flex-col gap-6 rounded-xl border border-slate/15 bg-white p-6 shadow-sm">
          <div><p className="mb-2 text-sm font-semibold text-navy">Choose import method</p><div className="flex flex-wrap gap-2"><Button variant={sourceMode === 'spreadsheet' ? 'primary' : 'secondary'} size="sm" onClick={() => changeSourceMode('spreadsheet')}>CSV / Excel upload</Button><Button variant={sourceMode === 'ocr' ? 'primary' : 'secondary'} size="sm" onClick={() => changeSourceMode('ocr')}>Scan result sheet (OCR)</Button></div></div>
          <div><div className="mb-3 flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo text-xs font-bold text-white">1</span><h2 className="text-sm font-semibold text-navy">Select academic context</h2>{isLoadingLookups && <Spinner size="sm" />}</div><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"><CoursePicker value={context.course} onChange={(courseId, course) => setContext({ ...context, course: courseId, semester: course?.semester?._id || context.semester, level: course?.level?._id || context.level })} /><Select label="Session" required disabled={isLoadingLookups} options={lookups.sessions} value={context.session} onChange={(event) => setContext({ ...context, session: event.target.value })} /><Select label="Semester" required disabled={isLoadingLookups} options={lookups.semesters} value={context.semester} onChange={(event) => setContext({ ...context, semester: event.target.value })} /><Select label="Level" required disabled={isLoadingLookups} options={lookups.levels} value={context.level} onChange={(event) => setContext({ ...context, level: event.target.value })} /></div></div>
          <div><div className="mb-3 flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo text-xs font-bold text-white">2</span><h2 className="text-sm font-semibold text-navy">{sourceMode === 'ocr' ? 'Upload scanned result sheet' : 'Upload result sheet'}</h2></div><FileDropzone key={sourceMode} onFileSelected={setFile} onFileError={toast.error} selectedFileName={file?.name} accept={sourceMode === 'ocr' ? '.pdf,.png,.jpg,.jpeg,.tif,.tiff,.webp' : '.csv,.xlsx,.xls'} supportedExtensions={sourceMode === 'ocr' ? /\.(pdf|png|jpe?g|tiff?|webp)$/i : /\.(csv|xlsx?|)$/i} maxFileSizeBytes={sourceMode === 'ocr' ? 15 * 1024 * 1024 : 5 * 1024 * 1024} acceptedFormatsText={sourceMode === 'ocr' ? 'Accepted formats: PDF, PNG, JPG, TIFF, WebP (max 15MB)' : 'Accepted formats: .csv, .xlsx, .xls (max 5MB)'} />{sourceMode === 'ocr' ? <p className="mt-2 text-xs text-slate">Use a flat, well-lit 300 dpi scan. OCR must find a table headed with matric number and score; review every row before saving.</p> : <p className="mt-2 text-xs text-slate">Expected columns: <strong>matricNumber</strong> and <strong>score</strong> (header names are matched flexibly).</p>}</div>
          <div>{isUploading ? <div className="flex justify-center py-4"><Spinner /></div> : <Button disabled={isLoadingLookups || !contextReady || !file} onClick={handleUpload}>{sourceMode === 'ocr' ? 'Read & preview scan' : 'Preview file'}</Button>}</div>
        </div>
      )}

      <Modal open={!!editingRow} onClose={() => setEditingRow(null)} title="Correct OCR extraction" size="sm" footer={<><Button variant="secondary" onClick={() => setEditingRow(null)}>Cancel</Button><Button isLoading={isSavingCorrection} onClick={saveCorrection}>Save correction</Button></>}><div className="space-y-4"><p className="text-sm text-slate">Compare this row with the scanned sheet, then correct the matriculation number or score. It will be validated again before saving.</p><Input label="Matric number" required value={correction.matricNumber} onChange={(event) => setCorrection((current) => ({ ...current, matricNumber: event.target.value }))} /><Input label="Score" required type="number" min="0" max="100" value={correction.score} onChange={(event) => setCorrection((current) => ({ ...current, score: event.target.value }))} /></div></Modal>
    </div>
  );
}
