import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { transcriptDocumentApi } from '../../api/transcriptDocumentApi';
import { PageHeader } from '../../components/common/PageHeader';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Textarea } from '../../components/common/Textarea';
import { StudentPicker } from '../../components/common/StudentPicker';
import { FileDropzone } from '../../components/common/FileDropzone';
import { DataTable } from '../../components/common/DataTable';
import { Pagination } from '../../components/common/Pagination';
import { EmptyState } from '../../components/common/EmptyState';
import { Spinner } from '../../components/common/Spinner';
import { Modal } from '../../components/common/Modal';
import { ROLE_LABELS } from '../../constants/roles';

const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif';
const EXTENSIONS = /\.(pdf|jpe?g|png|webp|heic|heif)$/i;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_FILES = 5;

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatUploader(user) {
  if (!user) return '—';
  const role = ROLE_LABELS[user.role] || user.role;
  const parts = [role, user.department?.name].filter(Boolean);
  return `${user.name} (${parts.join(' · ')})`;
}

function StudentDetailsCard({ student }) {
  if (!student) return null;
  const exitLabel = student.status === 'graduated' ? student.graduationSession?.name || 'Graduated' : student.status;
  const fields = [
    ['Department', student.department?.name],
    ['Faculty', student.department?.faculty?.name],
    ['Entry Session', student.entrySession?.name],
    ['Current Level', student.currentLevel?.name],
    ['Exit / Status', exitLabel],
  ];
  return (
    <div className="rounded-lg border border-slate/15 bg-off-white p-4">
      <p className="text-sm font-semibold text-navy">
        {student.firstName} {student.lastName} <span className="font-normal text-slate">({student.matricNumber})</span>
      </p>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
        {fields.map(([term, value]) => (
          <div key={term}>
            <dt className="text-xs text-slate">{term}</dt>
            <dd className="text-sm capitalize text-navy">{value || '—'}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function TranscriptScansPage() {
  const [studentId, setStudentId] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [label, setLabel] = useState('');
  const [notes, setNotes] = useState('');
  const [pendingFiles, setPendingFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  const [filterStudentId, setFilterStudentId] = useState('');
  const [documents, setDocuments] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [viewingDoc, setViewingDoc] = useState(null);

  const latestRequestRef = useRef(0);

  const load = async () => {
    const requestId = ++latestRequestRef.current;
    setIsLoading(true);
    try {
      const params = { page, limit: 10 };
      if (filterStudentId) params.student = filterStudentId;
      const res = await transcriptDocumentApi.list(params);
      if (requestId !== latestRequestRef.current) return;
      setDocuments(res.data.data);
      setMeta(res.data.meta);
    } catch {
      if (requestId === latestRequestRef.current) toast.error('Failed to load transcript scans');
    } finally {
      if (requestId === latestRequestRef.current) setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filterStudentId]);

  const addFiles = (files) => {
    const incoming = Array.isArray(files) ? files : [files];
    setPendingFiles((current) => {
      const combined = [...current, ...incoming];
      if (combined.length > MAX_FILES) {
        toast.error(`You can attach up to ${MAX_FILES} files per transcript scan`);
        return combined.slice(0, MAX_FILES);
      }
      return combined;
    });
  };

  const removeFile = (index) => {
    setPendingFiles((current) => current.filter((_, i) => i !== index));
  };

  const resetUploadForm = () => {
    setStudentId('');
    setSelectedStudent(null);
    setLabel('');
    setNotes('');
    setPendingFiles([]);
  };

  const handleUpload = async () => {
    if (!studentId) return toast.error('Select a student first');
    if (pendingFiles.length === 0) return toast.error('Add at least one photo or file');
    setIsUploading(true);
    try {
      await transcriptDocumentApi.upload(studentId, pendingFiles, { label, notes });
      toast.success('Transcript scan uploaded');
      resetUploadForm();
      setPage(1);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload transcript scan');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Transcript Scans"
        description="Digitize an old paper transcript by photo or file, and hold it on the student's record for later retrieval."
      />

      <div className="mb-6 flex flex-col gap-6 rounded-xl border border-slate/15 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-navy">Upload a transcript scan</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StudentPicker
            value={studentId}
            onChange={(id, student) => {
              setStudentId(id);
              setSelectedStudent(student);
            }}
          />
          <Input label="Label (optional)" placeholder="e.g. 2015 transcript" value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <StudentDetailsCard student={selectedStudent} />
        <Textarea
          label="Notes (optional)"
          placeholder="Any context useful for whoever retrieves this later"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <div>
          <p className="mb-2 text-sm font-semibold text-navy">Add pages</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FileDropzone
              key="camera"
              multiple
              capture="environment"
              accept="image/*"
              supportedExtensions={EXTENSIONS}
              maxFileSizeBytes={MAX_FILE_BYTES}
              acceptedFormatsText="Take a photo with your camera (max 8MB each)"
              label="Tap to take a photo"
              onFileSelected={addFiles}
              onFileError={toast.error}
            />
            <FileDropzone
              key="browse"
              multiple
              accept={ACCEPT}
              supportedExtensions={EXTENSIONS}
              maxFileSizeBytes={MAX_FILE_BYTES}
              acceptedFormatsText={`Accepted: PDF, JPG, PNG, WebP, HEIC (max 8MB each, up to ${MAX_FILES} files)`}
              label="Choose from device"
              onFileSelected={addFiles}
              onFileError={toast.error}
            />
          </div>
        </div>

        {pendingFiles.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {pendingFiles.map((file, index) => (
              <li key={`${file.name}-${index}`} className="flex items-center gap-2 rounded-lg bg-off-white px-3 py-1.5 text-xs text-navy">
                <span>{file.name}</span>
                <span className="text-slate">{formatBytes(file.size)}</span>
                <button type="button" onClick={() => removeFile(index)} className="text-slate hover:text-danger" aria-label={`Remove ${file.name}`}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        <div>
          <Button isLoading={isUploading} disabled={!studentId || pendingFiles.length === 0} onClick={handleUpload}>
            Upload scan
          </Button>
        </div>
      </div>

      <div className="mb-4 max-w-sm">
        <StudentPicker
          label="Filter by student"
          value={filterStudentId}
          onChange={(id) => {
            setPage(1);
            setFilterStudentId(id);
          }}
        />
      </div>

      <div className="rounded-xl border border-slate/15 bg-white">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : documents.length === 0 ? (
          <EmptyState title="No transcript scans found" />
        ) : (
          <>
            <DataTable
              columns={[
                {
                  key: 'student',
                  label: 'Student',
                  render: (d) => (d.student ? `${d.student.firstName} ${d.student.lastName} (${d.student.matricNumber})` : 'Student record deleted'),
                },
                { key: 'department', label: 'Department', render: (d) => d.student?.department?.name || '—' },
                { key: 'label', label: 'Label', render: (d) => d.label || '—' },
                { key: 'files', label: 'Files', render: (d) => `${d.files.length} file${d.files.length === 1 ? '' : 's'}` },
                { key: 'uploadedBy', label: 'Uploaded By', render: (d) => formatUploader(d.uploadedBy) },
                { key: 'createdAt', label: 'Uploaded On', render: (d) => new Date(d.createdAt).toLocaleDateString() },
              ]}
              rows={documents}
              actions={(row) => (
                <Button variant="ghost" size="sm" onClick={() => setViewingDoc(row)}>
                  View
                </Button>
              )}
            />
            <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={setPage} />
          </>
        )}
      </div>

      <Modal open={!!viewingDoc} onClose={() => setViewingDoc(null)} title="Transcript scan files" size="md">
        {viewingDoc && (
          <div className="flex flex-col gap-3">
            <StudentDetailsCard student={viewingDoc.student} />
            <p className="text-xs text-slate">
              Uploaded by <span className="font-medium text-navy">{formatUploader(viewingDoc.uploadedBy)}</span> on{' '}
              {new Date(viewingDoc.createdAt).toLocaleString()}
            </p>
            {viewingDoc.notes && <p className="text-sm text-slate">{viewingDoc.notes}</p>}
            <ul className="flex flex-col gap-2">
              {viewingDoc.files.map((file) => (
                <li key={file._id} className="flex items-center justify-between rounded-lg border border-slate/15 px-3 py-2 text-sm">
                  <span className="truncate text-navy">{file.filename}</span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => transcriptDocumentApi.downloadFile(viewingDoc._id, file._id, file.filename)}
                  >
                    Download
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Modal>
    </div>
  );
}
