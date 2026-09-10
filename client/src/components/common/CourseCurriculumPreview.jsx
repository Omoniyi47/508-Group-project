import { useEffect, useMemo, useState } from 'react';
import { courseApi } from '../../api/courseApi';
import { systemSettingApi } from '../../api/systemSettingApi';
import { Spinner } from './Spinner';

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

function semesterKey(course) {
  return `${course.level?._id || course.level || 'shared'}:${course.semester?._id || course.semester || 'unassigned'}`;
}

/**
 * Read-only curriculum preview used while staff register a student. Courses
 * remain centrally managed; saving a student does not create result records.
 */
export function CourseCurriculumPreview({ departmentId, levelId }) {
  const [courses, setCourses] = useState([]);
  const [requiredSpecialElectiveUnits, setRequiredSpecialElectiveUnits] = useState(12);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;

    if (!departmentId) {
      setCourses([]);
      setLoadError('');
      return undefined;
    }

    setIsLoading(true);
    setLoadError('');
    const courseParams = { department: departmentId, level: levelId || undefined, isActive: true, isUndergraduate: true, limit: 100 };
    Promise.all([
      courseApi.list({ ...courseParams, page: 1 }),
      systemSettingApi.get(),
    ])
      .then(async ([courseResponse, settingsResponse]) => {
        const totalPages = courseResponse.data.meta?.totalPages || 1;
        const remainingPages = await Promise.all(
          Array.from({ length: Math.max(0, totalPages - 1) }, (_, index) => courseApi.list({ ...courseParams, page: index + 2 }))
        );
        if (cancelled) return;
        setCourses([courseResponse.data.data, ...remainingPages.map((response) => response.data.data)].flat());
        setRequiredSpecialElectiveUnits(settingsResponse.data.data.specialElectiveRequiredUnits ?? 12);
      })
      .catch(() => {
        if (!cancelled) {
          setCourses([]);
          setLoadError('The programme course map could not be loaded. Please try again.');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [departmentId, levelId]);

  const semesters = useMemo(() => {
    const grouped = new Map();
    for (const course of courses) {
      const key = semesterKey(course);
      if (!grouped.has(key)) {
        const levelName = course.level?.name || 'Shared requirement';
        const semesterName = course.semester?.name || 'Semester not assigned';
        grouped.set(key, {
          name: `${levelName} - ${semesterName}`,
          order: (course.level?.order ?? 99) * 100 + (course.semester?.order ?? 99),
          courses: [],
        });
      }
      grouped.get(key).courses.push(course);
    }
    return [...grouped.values()]
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
      .map((group) => ({ ...group, courses: group.courses.sort((a, b) => a.code.localeCompare(b.code)) }));
  }, [courses]);

  const coreAndRequiredCount = courses.filter((course) => !['elective', 'restricted_elective', 'special_elective'].includes(course.courseType)).length;
  const electiveOptionCount = courses.length - coreAndRequiredCount;

  if (!departmentId) {
    return (
      <div className="sm:col-span-2 rounded-lg border border-dashed border-slate/30 bg-off-white px-4 py-3 text-sm text-slate">
        Select the student's department to load the mapped course curriculum automatically. Select a current level to narrow it to the courses this student should take now.
      </div>
    );
  }

  return (
    <section className="sm:col-span-2 rounded-xl border border-teal/25 bg-teal/5 p-4" aria-live="polite">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-navy">Mapped course curriculum</h3>
          <p className="mt-0.5 text-xs text-slate">
            {levelId
              ? 'These active undergraduate courses will be available automatically when staff enter this student’s results.'
              : 'This is the active department course map. Select a current level to narrow it to the courses this student should take now.'}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-navy">{coreAndRequiredCount} core / required</span>
          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-navy">{electiveOptionCount} elective options</span>
          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-teal">Special electives: {requiredSpecialElectiveUnits} units required</span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-5 text-sm text-slate"><Spinner size="sm" /> Loading course map...</div>
      ) : loadError ? (
        <p className="mt-3 text-sm text-danger">{loadError}</p>
      ) : courses.length === 0 ? (
        <p className="mt-3 text-sm text-slate">No active courses are mapped to this department{levelId ? ' and level' : ''} yet. An administrator should add or activate the course placements first.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {semesters.map((semester) => (
            <div key={semester.name} className="rounded-lg border border-white/80 bg-white/80 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-navy">{semester.name}</h4>
                <span className="text-xs text-slate">{semester.courses.length} course{semester.courses.length === 1 ? '' : 's'}</span>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {semester.courses.map((course) => (
                  <div key={course._id} className="rounded-md border border-slate/10 px-2.5 py-2 text-xs">
                    <p className="font-semibold text-navy">{course.code} - {course.title}</p>
                    <p className="mt-0.5 text-slate">{course.creditUnit} units · {TYPE_LABELS[course.courseType] || 'Core'} · {course.department?.name || 'University-wide'}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
