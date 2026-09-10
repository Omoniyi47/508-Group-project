import { useRef, useState } from 'react';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const SUPPORTED_EXTENSIONS = /\.(csv|xlsx?|)$/i;

export function FileDropzone({
  onFileSelected,
  onFileError,
  accept = '.csv,.xlsx,.xls',
  selectedFileName,
  supportedExtensions = SUPPORTED_EXTENSIONS,
  maxFileSizeBytes = MAX_FILE_SIZE_BYTES,
  acceptedFormatsText = 'Accepted formats: .csv, .xlsx, .xls (max 5MB)',
}) {
  const inputRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFiles = (files) => {
    const file = files?.[0];
    if (!file) return;

    if (!supportedExtensions.test(file.name)) {
      onFileError?.(`Choose a supported file: ${acceptedFormatsText.replace(/^Accepted formats:\s*/i, '').replace(/\s*\(max.*$/i, '')}.`);
      return;
    }
    if (file.size > maxFileSizeBytes) {
      onFileError?.(`That file is larger than ${Math.round(maxFileSizeBytes / (1024 * 1024))} MB. Please upload a smaller result sheet.`);
      return;
    }
    onFileSelected(file);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        handleFiles(e.dataTransfer.files);
      }}
      className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
        isDragOver ? 'border-indigo bg-indigo/5' : 'border-slate/30 hover:border-indigo/50'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <p className="text-sm font-medium text-navy">{selectedFileName || 'Drop a result sheet here, or click to browse'}</p>
      <p className="text-xs text-slate">{acceptedFormatsText}</p>
    </div>
  );
}
