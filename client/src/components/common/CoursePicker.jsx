import { useEffect, useId, useRef, useState } from 'react';
import { courseApi } from '../../api/courseApi';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { Input } from './Input';

const TYPE_LABELS = {
  core: 'Core',
  elective: 'Elective',
  restricted_elective: 'Restricted elective',
  special_elective: 'Special elective',
  practicum: 'Practicum',
  industrial_training: 'Industrial training',
  project: 'Project',
  other: 'Other',
};

function courseLabel(course) {
  return `${course.code} - ${course.title}`;
}

function isProgrammeCourse(course, departmentId) {
  return String(course.department?._id || course.department || '') === String(departmentId || '');
}

export function CoursePicker({ value, onChange, error, label = 'Course', departmentId, levelId, semesterId, requireDepartmentContext = false }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [options, setOptions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const inputId = useId();
  const debouncedQuery = useDebouncedValue(query, 250);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    if (requireDepartmentContext && !departmentId) {
      setOptions([]);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setLoadError('');
    const courseParams = {
      search: selected ? undefined : debouncedQuery || undefined,
      isActive: true,
      isUndergraduate: true,
      department: departmentId || undefined,
      level: levelId || undefined,
      semester: semesterId || undefined,
      limit: 100,
    };
    courseApi
      .list({ ...courseParams, page: 1 })
      .then(async (res) => {
        const totalPages = res.data.meta?.totalPages || 1;
        const remainingPages = await Promise.all(
          Array.from({ length: Math.max(0, totalPages - 1) }, (_, index) => courseApi.list({ ...courseParams, page: index + 2 }))
        );
        if (!cancelled) setOptions([res.data.data, ...remainingPages.map((response) => response.data.data)].flat());
      })
      .catch(() => {
        if (!cancelled) {
          setOptions([]);
          setLoadError('Unable to load courses. Close and reopen this list to retry.');
        }
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [debouncedQuery, selected, departmentId, levelId, semesterId, requireDepartmentContext, isOpen]);

  // Selecting a student supplies the programme context. Open its mapped
  // curriculum immediately, so a result officer does not need to type a code.
  useEffect(() => {
    if (departmentId && !selected) setIsOpen(true);
  }, [departmentId, levelId, semesterId, selected]);

  useEffect(() => {
    if (!value && selected) {
      setSelected(null);
      setQuery('');
    }
  }, [value, selected]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectCourse = (course) => {
    setSelected(course);
    setQuery(courseLabel(course));
    setIsOpen(false);
    onChange(course._id, course);
  };

  // Keep each student's programme first while keeping shared requirements
  // available for departments that use the same university-wide course.
  const programmeCourses = options.filter((course) => isProgrammeCourse(course, departmentId));
  const sharedCourses = options.filter((course) => !isProgrammeCourse(course, departmentId));
  const courseGroups = [
    { label: 'Programme courses - core, required and elective options', courses: programmeCourses },
    { label: 'University-wide and shared courses', courses: sharedCourses },
  ].filter((group) => group.courses.length > 0);

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
          onChange={(event) => {
            setQuery(event.target.value);
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
          placeholder={requireDepartmentContext && !departmentId ? 'Select a student first...' : 'Search by code or course title...'}
          error={error}
          className="flex-1"
        />
        {selected && (
          <button type="button" onClick={() => { setSelected(null); setQuery(''); setIsOpen(true); onChange('', null); }} className="text-sm text-slate hover:text-danger">
            Clear
          </button>
        )}
      </div>
      {selected && (
        <div className="rounded-lg border border-teal/25 bg-teal/5 px-3 py-2 text-sm text-navy" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <span className="font-semibold">{courseLabel(selected)}</span>
            <span className="rounded-full bg-teal/15 px-2 py-0.5 text-xs font-semibold text-teal">
              {selected.creditUnit} credit {Number(selected.creditUnit) === 1 ? 'unit' : 'units'}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate">
            {TYPE_LABELS[selected.courseType] || 'Core'} course · Student programme: {selected.department?.name || 'University-wide'}
            {' · '}Offered by: {selected.offeringDepartment?.name || selected.offeringUnit || 'Not specified'}
          </p>
          <p className="mt-0.5 text-xs text-slate">Semester: {selected.semester?.name || 'Semester not yet assigned'}</p>
          <p className="mt-0.5 text-xs text-slate">Level: {selected.level?.name || 'Level not yet assigned'}</p>
          {selected.curriculumContext && <p className="mt-0.5 text-xs text-slate">Curriculum: {selected.curriculumContext}</p>}
        </div>
      )}
      {isOpen && (
        <ul id={`${inputId}-options`} className="relative z-20 mt-1 max-h-80 w-full overflow-y-auto rounded-lg border border-slate/20 bg-white shadow-lg">
          {requireDepartmentContext && !departmentId ? (
            <li role="status" className="px-3 py-2 text-sm text-slate">Select a student first to see their programme courses.</li>
          ) : isLoading || loadError || options.length === 0 ? (
            <li role="status" className="px-3 py-2 text-sm text-slate">
              {isLoading ? 'Loading courses...' : loadError || 'No courses match the selected programme, level, semester, or search.'}
            </li>
          ) : courseGroups.map((group) => (
            <li key={group.label} className="border-b border-slate/10 last:border-b-0">
              <p className="bg-off-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate">{group.label}</p>
              <ul>
                {group.courses.map((course) => (
                  <li key={course._id}>
              <button type="button" onClick={() => selectCourse(course)} className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-off-white">
                <span className="text-sm font-medium text-navy">{courseLabel(course)}</span>
                <span className="mt-0.5 text-xs text-slate">
                  {TYPE_LABELS[course.courseType] || 'Core'} · {course.creditUnit} units · Student programme: {course.department?.name || 'University-wide'}
                </span>
                      <span className="text-xs text-slate">Semester: {course.semester?.name || 'Semester not yet assigned'}</span>
                      <span className="text-xs text-slate">Level: {course.level?.name || 'Level not yet assigned'}</span>
                      {course.curriculumContext && <span className="text-xs text-slate">Curriculum: {course.curriculumContext}</span>}
                <span className="text-xs text-slate">Offered by: {course.offeringDepartment?.name || course.offeringUnit || 'Not specified'}</span>
              </button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
