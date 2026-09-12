import { useEffect, useId, useRef, useState } from 'react';
import { studentApi } from '../../api/studentApi';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { Input } from './Input';

export function StudentPicker({ label = 'Student', value, onChange, error }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [options, setOptions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const inputId = useId();
  const debouncedQuery = useDebouncedValue(query, 300);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const search = selected ? '' : debouncedQuery.trim();
    const isMatricLike = /[0-9/]/.test(search);
    const params = !search ? { limit: 8 } : isMatricLike ? { matric: search, limit: 8 } : { name: search, limit: 8 };
    setIsLoading(true);
    setLoadError('');
    studentApi.list(params)
      .then((res) => { if (!cancelled) setOptions(res.data.data); })
      .catch(() => {
        if (!cancelled) {
          setOptions([]);
          setLoadError('Unable to load students. Close and reopen this list to retry.');
        }
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [debouncedQuery, selected, isOpen]);

  useEffect(() => {
    if (!value && selected) {
      setSelected(null);
      setQuery('');
    }
  }, [value, selected]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectStudent = (student) => {
    setSelected(student);
    setQuery(`${student.firstName} ${student.lastName} (${student.matricNumber})`);
    setIsOpen(false);
    onChange(student._id, student);
  };

  const clearSelection = () => {
    setSelected(null);
    setQuery('');
    setIsOpen(true);
    onChange('', null);
  };

  return (
    <div ref={containerRef} className="relative flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-medium text-navy">
        {label}
        <span className="text-danger"> *</span>
      </label>
      <div className="flex gap-2">
        <Input
          id={inputId}
          aria-expanded={isOpen}
          aria-controls={`${inputId}-options`}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(null);
            if (value) onChange('', null);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onClick={() => setIsOpen(true)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') { event.preventDefault(); setIsOpen(true); }
            if (event.key === 'Escape' && isOpen) { event.stopPropagation(); setIsOpen(false); }
          }}
          placeholder="Search by matric number or name..."
          error={error}
          className="flex-1"
        />
        {selected && (
          <button type="button" onClick={clearSelection} className="text-sm text-slate hover:text-danger">
            Clear
          </button>
        )}
      </div>

      {isOpen && (
        <ul id={`${inputId}-options`} className="relative z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate/20 bg-white shadow-lg">
          {isLoading || loadError || options.length === 0 ? (
            <li role="status" className="px-3 py-2 text-sm text-slate">
              {isLoading ? 'Loading students...' : loadError || 'No matching students found.'}
            </li>
          ) : options.map((student) => (
            <li key={student._id}>
              <button
                type="button"
                onClick={() => selectStudent(student)}
                className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-off-white"
              >
                <span className="font-medium text-navy">
                  {student.firstName} {student.lastName}
                </span>
                <span className="text-xs text-slate">
                  {student.matricNumber} &middot; {student.department?.name}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
