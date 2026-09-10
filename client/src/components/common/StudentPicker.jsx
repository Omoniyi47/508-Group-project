import { useEffect, useRef, useState } from 'react';
import { studentApi } from '../../api/studentApi';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { Input } from './Input';

export function StudentPicker({ label = 'Student', value, onChange, error }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [options, setOptions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const debouncedQuery = useDebouncedValue(query, 300);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!debouncedQuery || selected) {
      setOptions([]);
      return;
    }
    const isMatricLike = /^[a-z0-9/]+$/i.test(debouncedQuery);
    const params = isMatricLike ? { matric: debouncedQuery, limit: 8 } : { name: debouncedQuery, limit: 8 };
    studentApi.list(params).then((res) => setOptions(res.data.data));
  }, [debouncedQuery, selected]);

  useEffect(() => {
    if (!value) {
      setSelected(null);
      setQuery('');
    }
  }, [value]);

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
    onChange('', null);
  };

  return (
    <div ref={containerRef} className="relative flex flex-col gap-1">
      <label className="text-sm font-medium text-navy">
        {label}
        <span className="text-danger"> *</span>
      </label>
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(null);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
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

      {isOpen && options.length > 0 && (
        <ul className="absolute top-full z-10 mt-1 w-full rounded-lg border border-slate/20 bg-white shadow-lg">
          {options.map((student) => (
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
