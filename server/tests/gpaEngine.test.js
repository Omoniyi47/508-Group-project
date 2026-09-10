import { describe, it, expect } from 'vitest';
import { scoreToGrade, computeGpa, buildAcademicHistory, classify } from '../src/services/gpaEngine.js';

const gradingRule = {
  gradeBands: [
    { grade: 'A', minScore: 70, maxScore: 100, point: 5 },
    { grade: 'B', minScore: 60, maxScore: 69, point: 4 },
    { grade: 'C', minScore: 50, maxScore: 59, point: 3 },
    { grade: 'D', minScore: 45, maxScore: 49, point: 2 },
    { grade: 'E', minScore: 40, maxScore: 44, point: 1 },
    { grade: 'F', minScore: 0, maxScore: 39, point: 0 },
  ],
  classificationBands: [
    { classification: 'First Class', minCgpa: 4.5, maxCgpa: 5.0 },
    { classification: 'Second Class Upper', minCgpa: 3.5, maxCgpa: 4.49 },
    { classification: 'Second Class Lower', minCgpa: 2.4, maxCgpa: 3.49 },
    { classification: 'Third Class', minCgpa: 1.5, maxCgpa: 2.39 },
    { classification: 'Pass', minCgpa: 1.0, maxCgpa: 1.49 },
  ],
};

function course(id, creditUnit) {
  return { _id: id, code: id, creditUnit };
}

function session(id, name, startDate) {
  return { _id: id, name, startDate };
}

function semester(id, name, order) {
  return { _id: id, name, order };
}

describe('scoreToGrade', () => {
  it('maps scores to the correct grade and point at each boundary', () => {
    expect(scoreToGrade(100, gradingRule)).toEqual({ grade: 'A', point: 5 });
    expect(scoreToGrade(70, gradingRule)).toEqual({ grade: 'A', point: 5 });
    expect(scoreToGrade(69, gradingRule)).toEqual({ grade: 'B', point: 4 });
    expect(scoreToGrade(60, gradingRule)).toEqual({ grade: 'B', point: 4 });
    expect(scoreToGrade(59, gradingRule)).toEqual({ grade: 'C', point: 3 });
    expect(scoreToGrade(45, gradingRule)).toEqual({ grade: 'D', point: 2 });
    expect(scoreToGrade(44, gradingRule)).toEqual({ grade: 'E', point: 1 });
    expect(scoreToGrade(40, gradingRule)).toEqual({ grade: 'E', point: 1 });
    expect(scoreToGrade(39, gradingRule)).toEqual({ grade: 'F', point: 0 });
    expect(scoreToGrade(0, gradingRule)).toEqual({ grade: 'F', point: 0 });
  });

  it('throws when a score falls outside every configured band', () => {
    const gappyRule = { gradeBands: [{ grade: 'A', minScore: 50, maxScore: 100, point: 5 }] };
    expect(() => scoreToGrade(30, gappyRule)).toThrow(/does not fall within/);
  });
});

describe('computeGpa', () => {
  it('computes a correct credit-weighted average', () => {
    const results = [
      { course: course('c1', 3), gradePoint: 5 }, // 15
      { course: course('c2', 2), gradePoint: 3 }, // 6
      { course: course('c3', 3), gradePoint: 4 }, // 12
    ];
    // total points = 33, total units = 8 -> gpa = 4.125 -> rounds to 4.13
    const { gpa, totalCreditUnits } = computeGpa(results);
    expect(totalCreditUnits).toBe(8);
    expect(gpa).toBe(4.13);
  });

  it('returns 0 gpa for an empty result set', () => {
    expect(computeGpa([]).gpa).toBe(0);
  });
});

describe('classify', () => {
  it('maps CGPA to the correct classification at each boundary', () => {
    expect(classify(5.0, gradingRule)).toBe('First Class');
    expect(classify(4.5, gradingRule)).toBe('First Class');
    expect(classify(4.49, gradingRule)).toBe('Second Class Upper');
    expect(classify(3.5, gradingRule)).toBe('Second Class Upper');
    expect(classify(2.4, gradingRule)).toBe('Second Class Lower');
    expect(classify(1.5, gradingRule)).toBe('Third Class');
    expect(classify(1.0, gradingRule)).toBe('Pass');
    expect(classify(0.5, gradingRule)).toBeNull();
  });
});

describe('buildAcademicHistory', () => {
  const s2022 = session('s2022', '2022/2023', '2022-09-01');
  const s2023 = session('s2023', '2023/2024', '2023-09-01');
  const harmattan = semester('sem1', 'Harmattan', 1);
  const rain = semester('sem2', 'Rain', 2);
  const level100 = { _id: 'lvl100', name: '100' };
  const level200 = { _id: 'lvl200', name: '200' };

  it('computes semester GPA and a running CGPA across multiple semesters', () => {
    const results = [
      // 100L Harmattan: CSC101 (3 units, A=5) + MTH101 (3 units, B=4)
      { session: s2022, semester: harmattan, level: level100, course: course('CSC101', 3), score: 75, grade: 'A', gradePoint: 5 },
      { session: s2022, semester: harmattan, level: level100, course: course('MTH101', 3), score: 65, grade: 'B', gradePoint: 4 },
      // 100L Rain: CSC102 (3 units, C=3)
      { session: s2022, semester: rain, level: level100, course: course('CSC102', 3), score: 55, grade: 'C', gradePoint: 3 },
    ];

    const history = buildAcademicHistory(results, gradingRule);

    expect(history.semesters).toHaveLength(2);
    expect(history.semesters[0].semesterGpa).toBe(4.5); // (5*3 + 4*3) / 6
    expect(history.semesters[0].cumulativeGpa).toBe(4.5);
    expect(history.semesters[1].semesterGpa).toBe(3);
    // cumulative: (27 + 9) / (6 + 3) = 36/9 = 4.0
    expect(history.semesters[1].cumulativeGpa).toBe(4);
    expect(history.cgpa).toBe(4);
    expect(history.totalCreditUnits).toBe(9);
    expect(history.classification).toBe('Second Class Upper');
  });

  it('orders semesters chronologically regardless of input order', () => {
    const results = [
      { session: s2023, semester: harmattan, level: level200, course: course('CSC201', 3), score: 80, grade: 'A', gradePoint: 5 },
      { session: s2022, semester: harmattan, level: level100, course: course('CSC101', 3), score: 60, grade: 'B', gradePoint: 4 },
    ];
    const history = buildAcademicHistory(results, gradingRule);
    expect(history.semesters[0].session.name).toBe('2022/2023');
    expect(history.semesters[1].session.name).toBe('2023/2024');
  });

  it('only counts the latest attempt of a repeated course toward CGPA and credits', () => {
    const results = [
      // Failed CSC101 in 100L Harmattan 2022/2023
      { session: s2022, semester: harmattan, level: level100, course: course('CSC101', 3), score: 30, grade: 'F', gradePoint: 0 },
      // Retook and passed CSC101 in 100L Harmattan 2023/2024
      { session: s2023, semester: harmattan, level: level100, course: course('CSC101', 3), score: 75, grade: 'A', gradePoint: 5 },
    ];

    const history = buildAcademicHistory(results, gradingRule);

    // both attempts appear in their own semester listing
    expect(history.semesters[0].courses).toHaveLength(1);
    expect(history.semesters[1].courses).toHaveLength(1);

    // only the passing retake counts toward credits/CGPA
    expect(history.totalCreditUnits).toBe(3);
    expect(history.cgpa).toBe(5);

    // no longer appears as a failed course since the latest attempt passed
    expect(history.failedCourses).toHaveLength(0);
  });

  it('still reports a course as failed if the latest attempt is still failing', () => {
    const results = [
      { session: s2022, semester: harmattan, level: level100, course: course('CSC101', 3), score: 45, grade: 'D', gradePoint: 2 },
      { session: s2023, semester: harmattan, level: level100, course: course('CSC101', 3), score: 20, grade: 'F', gradePoint: 0 },
    ];
    const history = buildAcademicHistory(results, gradingRule);
    expect(history.failedCourses).toHaveLength(1);
    expect(history.failedCourses[0].course._id).toBe('CSC101');
  });

  it('returns an empty history with 0 cgpa for no results', () => {
    const history = buildAcademicHistory([], gradingRule);
    expect(history.semesters).toHaveLength(0);
    expect(history.cgpa).toBe(0);
    expect(history.classification).toBeNull();
  });
});
