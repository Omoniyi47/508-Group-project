# Dropdown audit — 24 September 2026

All native dropdowns use `Select`. Database-backed dropdowns share `useDropdowns`
and the paginated `loadDropdownOptions` loader. Each source loads independently;
failed requests provide an inline retry, and empty results provide setup guidance.
Optional unassigned values and unfiltered searches remain valid selections.

| Area | Options | Result |
| --- | --- | --- |
| Students | Department, entry/graduation session, current level | Real database IDs; refresh on form opening; loading and setup/retry states |
| Students | Gender, student status, mode of entry, status filter | Fixed nonempty lists |
| Users | Role | Fixed role list |
| Users | Faculty → department | Database options filtered by selected faculty; prerequisite/setup guidance; reload preserves form values |
| Departments | Faculty, HOD | Independent lookups; optional “No HOD assigned”; create real HOD accounts under Users |
| Courses | Programme department, offering department, level, semester | Database lookup options with setup/retry states |
| Courses | Requirement type | Fixed nonempty list |
| Results | Course, session, semester, status filters | Paginated database lists plus fixed statuses |
| Manual result entry | Student, course, session, semester, level | Searchable record pickers and academic lookups; course list retains available pages on partial failure |
| Upload wizard | Course, session, semester, level | Searchable course picker and independent academic lookups |
| Transcript requests | Status, manual/online retrieval | Fixed nonempty lists |
| Audit trail | Module, action | Fixed nonempty lists |
| Notifications | Type, read status | Fixed nonempty lists |

Initial database audit found 14 faculties, 97 departments, 65 sessions, six levels,
but zero semesters, courses, students, or HOD accounts. Academic reference setup now
includes only Harmattan and Rain; the course import is described in
[the catalogue report](oau-course-catalogue.md).

Students and staff are operational records: no fabricated students or HOD accounts
are created to fill a selector. Empty department-specific course searches can still
occur where an approved curriculum has not been imported, or filters exclude all
records. These states now explain the next action instead of silently showing a
blank list.

Historical vacation placements retain their original references in storage. They
are excluded from active course selectors and new imports; new academic records
must use Harmattan or Rain. They are not reassigned to a different semester.
