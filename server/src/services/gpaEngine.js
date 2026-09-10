/**
 * Pure GPA/CGPA computation functions. No DB access here - callers fetch the
 * active GradingRule and the relevant Result rows, and pass plain data in.
 *
 * Repeat-course policy: when a course was attempted more than once (e.g. failed
 * then retaken in a later session), only the LATEST attempt counts toward CGPA
 * and earned credits. All attempts still appear in their own semester's listing
 * and in the failed-course history. This is a fixed institutional policy for
 * this system (not currently end-user configurable) - see README.
 */

export function scoreToGrade(score, gradingRule) {
  const band = gradingRule.gradeBands.find((b) => score >= b.minScore && score <= b.maxScore);
  if (!band) {
    throw new Error(`Score ${score} does not fall within any configured grade band`);
  }
  return { grade: band.grade, point: band.point };
}

export function isPassingGrade(gradePoint, gradingRule) {
  const passable = gradingRule.gradeBands.filter((b) => b.point > 0);
  if (passable.length === 0) return gradePoint > 0;
  return gradePoint > 0;
}

/**
 * results: [{ course: { _id, creditUnit }, gradePoint }]
 */
export function computeGpa(results) {
  const totalCreditUnits = results.reduce((sum, r) => sum + r.course.creditUnit, 0);
  const totalGradePoints = results.reduce((sum, r) => sum + r.gradePoint * r.course.creditUnit, 0);
  const gpa = totalCreditUnits > 0 ? totalGradePoints / totalCreditUnits : 0;
  return { gpa: round2(gpa), totalCreditUnits, totalGradePoints };
}

/**
 * Groups results by session+semester in chronological order and computes each
 * semester's GPA plus the running cumulative GPA after that semester.
 *
 * results: [{ session: {_id, name, startDate}, semester: {_id, name, order}, course: {_id, code, creditUnit}, gradePoint, grade, score }]
 */
export function buildAcademicHistory(results, gradingRule) {
  const bySemesterKey = new Map();

  for (const result of results) {
    const key = `${result.session._id}:${result.semester._id}`;
    if (!bySemesterKey.has(key)) {
      bySemesterKey.set(key, {
        session: result.session,
        semester: result.semester,
        level: result.level,
        results: [],
      });
    }
    bySemesterKey.get(key).results.push(result);
  }

  const semesterGroups = [...bySemesterKey.values()].sort((a, b) => {
    const dateDiff = new Date(a.session.startDate) - new Date(b.session.startDate);
    if (dateDiff !== 0) return dateDiff;
    return a.semester.order - b.semester.order;
  });

  const latestAttemptPerCourse = new Map();
  for (const group of semesterGroups) {
    for (const result of group.results) {
      const courseId = String(result.course._id);
      const existing = latestAttemptPerCourse.get(courseId);
      if (!existing || new Date(group.session.startDate) >= new Date(existing.sessionStartDate)) {
        latestAttemptPerCourse.set(courseId, { result, sessionStartDate: group.session.startDate });
      }
    }
  }

  let cumulativeCreditUnits = 0;
  let cumulativeGradePoints = 0;

  const history = semesterGroups.map((group) => {
    const semesterGpa = computeGpa(group.results);

    const creditedResults = group.results.filter(
      (r) => latestAttemptPerCourse.get(String(r.course._id))?.result === r
    );
    const creditedTotals = computeGpa(creditedResults);
    cumulativeCreditUnits += creditedTotals.totalCreditUnits;
    cumulativeGradePoints += creditedTotals.totalGradePoints;
    const cgpa = cumulativeCreditUnits > 0 ? round2(cumulativeGradePoints / cumulativeCreditUnits) : 0;

    return {
      session: group.session,
      semester: group.semester,
      level: group.level,
      courses: group.results.map((r) => ({
        course: r.course,
        score: r.score,
        grade: r.grade,
        gradePoint: r.gradePoint,
      })),
      semesterGpa: semesterGpa.gpa,
      semesterCreditUnits: semesterGpa.totalCreditUnits,
      cumulativeGpa: cgpa,
      cumulativeCreditUnits,
    };
  });

  const finalCgpa = history.length > 0 ? history[history.length - 1].cumulativeGpa : 0;
  const finalCreditUnits = history.length > 0 ? history[history.length - 1].cumulativeCreditUnits : 0;

  const failedCourses = [...latestAttemptPerCourse.values()]
    .filter(({ result }) => result.gradePoint <= 0)
    .map(({ result }) => ({
      course: result.course,
      session: result.session,
      semester: result.semester,
      score: result.score,
      grade: result.grade,
    }));

  const specialElectiveCreditUnits = [...latestAttemptPerCourse.values()]
    .map(({ result }) => result)
    .filter((result) => result.course.courseType === 'special_elective' && result.gradePoint > 0)
    .reduce((sum, result) => sum + result.course.creditUnit, 0);

  return {
    semesters: history,
    cgpa: finalCgpa,
    totalCreditUnits: finalCreditUnits,
    specialElectiveCreditUnits,
    failedCourses,
    classification: classify(finalCgpa, gradingRule),
  };
}

export function classify(cgpa, gradingRule) {
  const band = gradingRule.classificationBands.find((b) => cgpa >= b.minCgpa && cgpa <= b.maxCgpa);
  return band ? band.classification : null;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}
