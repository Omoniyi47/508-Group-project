# OAU course catalogue — official sources

The checked-in catalogue contains **382 course placements** across six programme
departments and six faculties. A placement is a course in a particular programme,
level and semester; this count is not a count of distinct university-wide codes.
This is a sourced initial catalogue, not complete coverage of OAU's 97 departments.

The app now offers only Harmattan and Rain. **380 placements** are eligible for
new imports; EEE 200 and EEE 300 are held as source-labelled vacation placements.
Previously imported vacation records are preserved for historical reference and
excluded from active course selectors. The table below describes the source
catalogue, including those two historical placements.

| Programme department | Faculty in this project | Placements | Official source |
| --- | --- | ---: | --- |
| Accounting | Administration | 54 | [Course schedule](https://accounting.oauife.edu.ng/course-content/) |
| Microbiology | Sciences | 49 | [Published course tables](https://nams.oauife.edu.ng/department/courses/) |
| Electronic and Electrical Engineering | Technology | 108 | [Undergraduate curriculum](https://eee.oauife.edu.ng/academics.php) |
| Adult Education and Lifelong Learning | Education | 75 | [2021–2026 handbook, PDF pages 17–22](https://all.oauife.edu.ng/wp-content/uploads/2024/03/Dept_of_ALL_NEW_HANDBOOK11.pdf) |
| Economics | Social Sciences | 54 | [Department handbook, PDF pages 17–21](https://ecn.oauife.edu.ng/wp-content/uploads/2019/10/Department-of-Economics-Handbook.pdf) |
| Linguistics and African Languages | Arts | 42 | [BA Linguistics single honours, PDF pages 17–20](https://linguistic.oauife.edu.ng/wp-content/uploads/2020/08/CURRICULUM-FOR-LINGUISTICS-AND-YORUBA-WEBSITE.pdf) |

## Mapping and limits

- Sources were retrieved on 24 September 2026. Published historical versions are
  retained as `curriculumVersion`; the import does not claim all are the current
  curriculum for every entry cohort.
- Programme department determines faculty through the existing department record.
  The API populates this relationship and the Courses page displays it.
- Credits, levels and semesters come from table entries/headings, never from odd/even
  course-number guesses. Generic “special electives” rows without actual codes are
  excluded. Economics and Linguistics imports include their own coded courses only;
  they do not supply complete service/elective curricula for those programmes.
- Offering department is assigned only for the source department's own course
  prefix. Service-course offering departments remain unconfirmed. No new department
  or faculty is invented for an ambiguous prefix.
- Requirement types are preserved when explicit; unlabelled requirements use
  `other`. Known source anomalies (such as the repeated ALL 301 and ECN 325 in two
  semesters) retain the published labels and separate semester placements.
- Three uncertain entries are excluded in `server/src/seed/data/oauCourseReview.json`.
  Public source access also failed for some other handbooks (including Computing
  DNS failures and Geography/Pharmacy TLS errors); no records were guessed for them.
- No student records, staff accounts, examination results or grades are created.

## Run and extend

From `server/`:

```powershell
npm run seed:student-references
npm run seed:official-courses
node src/seed/seedOfficialCourses.js --apply
```

The second command validates a dry run. The third inserts missing placements and
preserves administrator edits, IDs and timestamps on existing records. The normal
`npm run seed` also initializes the checked-in catalogue after academic setup.

`scripts/fetch_oau_course_sources.py` downloads the six official sources and extracts
the relevant PDF pages (requires Python requests, beautifulsoup4 and pypdf).
`scripts/extract_oau_courses.py` extracts the reviewed rows from source snapshots
in `tmp/oau-sources`. Each record includes its source URL, table/row or PDF page,
retrieval date, programme, level, semester and curriculum version. Imported sources
are linked from the Courses page. Add further verified programme curricula to the
JSON catalogue and rerun the same preflight/import; incomplete mappings fail before
any course write.
