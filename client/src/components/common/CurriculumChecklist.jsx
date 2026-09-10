import { useMemo } from 'react';

const STATUS_META = {
  completed: { label: 'Completed', tone: 'bg-success/10 text-success' },
  pending: { label: 'Pending', tone: 'bg-warning/10 text-warning' },
  failed: { label: 'Failed', tone: 'bg-danger/10 text-danger' },
  repeated: { label: 'Repeated', tone: 'bg-indigo/10 text-indigo' },
  not_yet_taken: { label: 'Not Yet Taken', tone: 'bg-slate/10 text-slate' },
};

function statusForCourse(course, attempts) {
  if (!attempts.length) return 'not_yet_taken';
  const ordered = [...attempts].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const latest = ordered.at(-1);
  if (attempts.length > 1) return 'repeated';
  if (latest.status !== 'approved') return 'pending';
  return latest.gradePoint <= 0 ? 'failed' : 'completed';
}

export function CurriculumChecklist({ courses, results }) {
  const { groups, counts } = useMemo(() => {
    const attemptsByCourse = new Map();
    for (const result of results) {
      const courseId = String(result.course?._id || result.course || '');
      if (!courseId) continue;
      const attempts = attemptsByCourse.get(courseId) || [];
      attempts.push(result);
      attemptsByCourse.set(courseId, attempts);
    }

    const grouped = new Map();
    const nextCounts = Object.fromEntries(Object.keys(STATUS_META).map((key) => [key, 0]));
    for (const course of courses) {
      const status = statusForCourse(course, attemptsByCourse.get(String(course._id)) || []);
      nextCounts[status] += 1;
      const groupName = `${course.level?.name || 'Shared requirements'} - ${course.semester?.name || 'Semester not assigned'}`;
      const order = (course.level?.order ?? 99) * 100 + (course.semester?.order ?? 99);
      if (!grouped.has(groupName)) grouped.set(groupName, { name: groupName, order, rows: [] });
      grouped.get(groupName).rows.push({ course, status });
    }
    return {
      groups: [...grouped.values()]
        .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
        .map((group) => ({ ...group, rows: group.rows.sort((a, b) => a.course.code.localeCompare(b.course.code)) })),
      counts: nextCounts,
    };
  }, [courses, results]);

  if (courses.length === 0) return null;

  return (
    <section className="mt-6 rounded-xl border border-slate/15 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-navy">Curriculum Checklist</h2>
          <p className="mt-1 text-sm text-slate">Mapped programme courses compared with this student’s entered result history.</p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs">
          {Object.entries(STATUS_META).map(([key, meta]) => (
            <span key={key} className={`rounded-full px-2 py-1 font-medium ${meta.tone}`}>{counts[key]} {meta.label}</span>
          ))}
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {groups.map((group) => (
          <details key={group.name} className="rounded-lg border border-slate/15" open={group.order < 300}>
            <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-navy">{group.name} <span className="ml-1 text-xs font-normal text-slate">({group.rows.length} courses)</span></summary>
            <div className="border-t border-slate/10">
              {group.rows.map(({ course, status }) => (
                <div key={course._id} className="flex items-center justify-between gap-3 border-b border-slate/10 px-3 py-2 text-sm last:border-0">
                  <span><strong className="text-navy">{course.code}</strong><span className="text-slate"> - {course.title} ({course.creditUnit} units)</span></span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_META[status].tone}`}>{STATUS_META[status].label}</span>
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
