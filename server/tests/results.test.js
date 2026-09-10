import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { User, ROLES } from '../src/models/User.js';
import { Faculty } from '../src/models/Faculty.js';
import { Department } from '../src/models/Department.js';
import { Session } from '../src/models/Session.js';
import { Semester } from '../src/models/Semester.js';
import { Level } from '../src/models/Level.js';
import { Course } from '../src/models/Course.js';
import { Student } from '../src/models/Student.js';
import { GradingRule } from '../src/models/GradingRule.js';
import { Result } from '../src/models/Result.js';

const app = createApp();

async function setupAcademics() {
  const faculty = await Faculty.create({ name: 'Faculty of Science', code: 'SCI' });
  const csc = await Department.create({ name: 'Computer Science', code: 'CSC', faculty: faculty._id });
  const mth = await Department.create({ name: 'Mathematics', code: 'MTH', faculty: faculty._id });
  const session = await Session.create({ name: '2023/2024', startDate: '2023-09-01', endDate: '2024-07-31', isCurrent: true });
  const harmattan = await Semester.create({ name: 'Harmattan', order: 1 });
  const level = await Level.create({ name: '100', order: 100 });
  const course = await Course.create({ code: 'CSC101', title: 'Intro to CS', creditUnit: 3, department: csc._id, level: level._id, semester: harmattan._id });
  const student = await Student.create({
    matricNumber: 'CSC/2023/001',
    firstName: 'Ada',
    lastName: 'Lovelace',
    department: csc._id,
    entrySession: session._id,
    currentLevel: level._id,
  });
  await GradingRule.create({
    name: 'Standard Scale',
    isActive: true,
    gradeBands: [
      { grade: 'A', minScore: 70, maxScore: 100, point: 5 },
      { grade: 'B', minScore: 60, maxScore: 69, point: 4 },
      { grade: 'C', minScore: 50, maxScore: 59, point: 3 },
      { grade: 'D', minScore: 45, maxScore: 49, point: 2 },
      { grade: 'E', minScore: 40, maxScore: 44, point: 1 },
      { grade: 'F', minScore: 0, maxScore: 39, point: 0 },
    ],
    classificationBands: [
      { classification: 'First Class', minCgpa: 4.5, maxCgpa: 5 },
      { classification: 'Pass', minCgpa: 1, maxCgpa: 1.49 },
    ],
  });
  return { faculty, csc, mth, session, harmattan, level, course, student };
}

async function loginAs(role, department) {
  const email = `${role}.${Date.now()}.${Math.random().toString(36).slice(2)}@test.edu`;
  const user = new User({ name: `Test ${role}`, email, role, department: department?._id });
  await user.setPassword('Password@123');
  await user.save();
  const res = await request(app).post('/api/auth/login').send({ email, password: 'Password@123' });
  return { token: res.body.data.accessToken, user: res.body.data.user, doc: user };
}

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

describe('Manual result entry lifecycle', () => {
  it('creates a draft result with grade/gradePoint computed from the active grading rule', async () => {
    const { csc, session, harmattan, level, course, student } = await setupAcademics();
    const { token } = await loginAs(ROLES.RESULT_OFFICER, csc);

    const res = await request(app)
      .post('/api/results')
      .set(auth(token))
      .send({ student: student._id, course: course._id, session: session._id, semester: harmattan._id, level: level._id, score: 75 });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('draft');
    expect(res.body.data.grade).toBe('A');
    expect(res.body.data.gradePoint).toBe(5);
  });

  it('rejects a duplicate result for the same student/course/session/semester', async () => {
    const { csc, session, harmattan, level, course, student } = await setupAcademics();
    const { token } = await loginAs(ROLES.RESULT_OFFICER, csc);
    const payload = { student: student._id, course: course._id, session: session._id, semester: harmattan._id, level: level._id, score: 60 };

    const first = await request(app).post('/api/results').set(auth(token)).send(payload);
    expect(first.status).toBe(201);

    const second = await request(app).post('/api/results').set(auth(token)).send(payload);
    expect(second.status).toBe(409);
  });

  it('walks a result through submit -> approve and blocks edits once approved', async () => {
    const { csc, session, harmattan, level, course, student } = await setupAcademics();
    const officer = await loginAs(ROLES.RESULT_OFFICER, csc);
    const hod = await loginAs(ROLES.HOD, csc);

    const create = await request(app)
      .post('/api/results')
      .set(auth(officer.token))
      .send({ student: student._id, course: course._id, session: session._id, semester: harmattan._id, level: level._id, score: 55 });
    const id = create.body.data._id;

    const submit = await request(app).post(`/api/results/${id}/submit`).set(auth(officer.token));
    expect(submit.status).toBe(200);
    expect(submit.body.data.status).toBe('submitted');

    const editWhileSubmitted = await request(app).put(`/api/results/${id}`).set(auth(officer.token)).send({ score: 80 });
    expect(editWhileSubmitted.status).toBe(409);

    const approve = await request(app).post(`/api/results/${id}/approve`).set(auth(hod.token));
    expect(approve.status).toBe(200);
    expect(approve.body.data.status).toBe('approved');
    expect(approve.body.data.approvedBy).toBe(hod.user._id);

    const editAfterApproval = await request(app).put(`/api/results/${id}`).set(auth(officer.token)).send({ score: 90 });
    expect(editAfterApproval.status).toBe(409);
  });

  it('lets an officer correct and resubmit a rejected result', async () => {
    const { csc, session, harmattan, level, course, student } = await setupAcademics();
    const officer = await loginAs(ROLES.RESULT_OFFICER, csc);
    const hod = await loginAs(ROLES.HOD, csc);

    const create = await request(app)
      .post('/api/results')
      .set(auth(officer.token))
      .send({ student: student._id, course: course._id, session: session._id, semester: harmattan._id, level: level._id, score: 55 });
    const id = create.body.data._id;
    await request(app).post(`/api/results/${id}/submit`).set(auth(officer.token));

    const reject = await request(app).post(`/api/results/${id}/reject`).set(auth(hod.token)).send({ reason: 'Score looks like a typo' });
    expect(reject.status).toBe(200);
    expect(reject.body.data.status).toBe('rejected');

    const edit = await request(app).put(`/api/results/${id}`).set(auth(officer.token)).send({ score: 85 });
    expect(edit.status).toBe(200);
    expect(edit.body.data.status).toBe('draft'); // editing a rejected result returns it to draft
    expect(edit.body.data.grade).toBe('A');

    const resubmit = await request(app).post(`/api/results/${id}/submit`).set(auth(officer.token));
    expect(resubmit.status).toBe(200);
    expect(resubmit.body.data.status).toBe('submitted');
  });

  it('prevents a result officer or HOD from another department from touching this result', async () => {
    const { csc, mth, session, harmattan, level, course, student } = await setupAcademics();
    const officer = await loginAs(ROLES.RESULT_OFFICER, csc);
    const outsiderOfficer = await loginAs(ROLES.RESULT_OFFICER, mth);
    const outsiderHod = await loginAs(ROLES.HOD, mth);

    const create = await request(app)
      .post('/api/results')
      .set(auth(officer.token))
      .send({ student: student._id, course: course._id, session: session._id, semester: harmattan._id, level: level._id, score: 65 });
    const id = create.body.data._id;
    await request(app).post(`/api/results/${id}/submit`).set(auth(officer.token));

    const view = await request(app).get(`/api/results/${id}`).set(auth(outsiderOfficer.token));
    expect(view.status).toBe(403);

    const approve = await request(app).post(`/api/results/${id}/approve`).set(auth(outsiderHod.token));
    expect(approve.status).toBe(403);
  });

  it('only allows deleting a draft result (non-admin)', async () => {
    const { csc, session, harmattan, level, course, student } = await setupAcademics();
    const { token } = await loginAs(ROLES.RESULT_OFFICER, csc);

    const create = await request(app)
      .post('/api/results')
      .set(auth(token))
      .send({ student: student._id, course: course._id, session: session._id, semester: harmattan._id, level: level._id, score: 65 });
    const id = create.body.data._id;
    await request(app).post(`/api/results/${id}/submit`).set(auth(token));

    const del = await request(app).delete(`/api/results/${id}`).set(auth(token));
    expect(del.status).toBe(409);
  });
});

describe('CSV upload wizard', () => {
  it('previews a file with a mix of valid, warning, and error rows, then commits only the good ones', async () => {
    const { csc, session, harmattan, level, course, student } = await setupAcademics();
    const secondStudent = await Student.create({
      matricNumber: 'CSC/2023/002',
      firstName: 'Grace',
      lastName: 'Hopper',
      department: csc._id,
      entrySession: session._id,
      currentLevel: level._id,
    });
    const { token } = await loginAs(ROLES.RESULT_OFFICER, csc);

    const csvContent = [
      'matricNumber,score',
      `${student.matricNumber},85`, // valid
      `${secondStudent.matricNumber},110`, // invalid score
      'CSC/2099/999,70', // student does not exist
      `${student.matricNumber},60`, // duplicate matric within the file
    ].join('\n');

    const preview = await request(app)
      .post('/api/results/upload-batches/preview')
      .set(auth(token))
      .field('course', course._id.toString())
      .field('session', session._id.toString())
      .field('semester', harmattan._id.toString())
      .field('level', level._id.toString())
      .attach('file', Buffer.from(csvContent), 'results.csv');

    expect(preview.status).toBe(201);
    expect(preview.body.data.summary.total).toBe(4);
    expect(preview.body.data.summary.validCount).toBe(1);
    expect(preview.body.data.summary.errorCount).toBe(3);

    const batchId = preview.body.data._id;
    const confirm = await request(app).post(`/api/results/upload-batches/${batchId}/confirm`).set(auth(token));

    expect(confirm.status).toBe(200);
    expect(confirm.body.data.created).toBe(1);
    expect(confirm.body.data.skipped).toHaveLength(3);

    const created = await request(app)
      .get('/api/results')
      .set(auth(token))
      .query({ student: student._id.toString() });
    expect(created.body.data).toHaveLength(1);
    expect(created.body.data[0].status).toBe('submitted');
    expect(created.body.data[0].sourceType).toBe('csv');
  });

  it('flags a warning (not an error) when a row would update an existing draft result', async () => {
    const { csc, session, harmattan, level, course, student } = await setupAcademics();
    const { token } = await loginAs(ROLES.RESULT_OFFICER, csc);

    await request(app)
      .post('/api/results')
      .set(auth(token))
      .send({ student: student._id, course: course._id, session: session._id, semester: harmattan._id, level: level._id, score: 50 });

    const csvContent = `matricNumber,score\n${student.matricNumber},92`;
    const preview = await request(app)
      .post('/api/results/upload-batches/preview')
      .set(auth(token))
      .field('course', course._id.toString())
      .field('session', session._id.toString())
      .field('semester', harmattan._id.toString())
      .field('level', level._id.toString())
      .attach('file', Buffer.from(csvContent), 'results.csv');

    expect(preview.body.data.summary.warningCount).toBe(1);
    expect(preview.body.data.rows[0].status).toBe('warning');

    const batchId = preview.body.data._id;
    const confirm = await request(app).post(`/api/results/upload-batches/${batchId}/confirm`).set(auth(token));
    expect(confirm.body.data.updated).toBe(1);

    const updated = await request(app).get('/api/results').set(auth(token)).query({ student: student._id.toString() });
    expect(updated.body.data[0].score).toBe(92);
    expect(updated.body.data[0].status).toBe('submitted');
  });

  it('does not reveal or import students from another department in a Result Officer upload', async () => {
    const { csc, mth, session, harmattan, level, course } = await setupAcademics();
    const outsideStudent = await Student.create({
      matricNumber: 'MTH/2023/001',
      firstName: 'Grace',
      lastName: 'Hopper',
      department: mth._id,
      entrySession: session._id,
      currentLevel: level._id,
    });
    const { token } = await loginAs(ROLES.RESULT_OFFICER, csc);

    const preview = await request(app)
      .post('/api/results/upload-batches/preview')
      .set(auth(token))
      .field('course', course._id.toString())
      .field('session', session._id.toString())
      .field('semester', harmattan._id.toString())
      .field('level', level._id.toString())
      .attach('file', Buffer.from(`matricNumber,score\n${outsideStudent.matricNumber},78`), 'results.csv');

    expect(preview.status).toBe(201);
    expect(preview.body.data.department).toBe(csc._id.toString());
    expect(preview.body.data.rows[0].status).toBe('error');
    expect(preview.body.data.rows[0].studentName).toBeNull();
    expect(preview.body.data.rows[0].messages).toContain(`No student found with matric number ${outsideStudent.matricNumber}`);
  });

  it('blocks a bulk upload from overwriting a submitted result', async () => {
    const { csc, session, harmattan, level, course, student } = await setupAcademics();
    const { token } = await loginAs(ROLES.RESULT_OFFICER, csc);
    const created = await request(app)
      .post('/api/results')
      .set(auth(token))
      .send({ student: student._id, course: course._id, session: session._id, semester: harmattan._id, level: level._id, score: 55 });
    await request(app).post(`/api/results/${created.body.data._id}/submit`).set(auth(token));

    const preview = await request(app)
      .post('/api/results/upload-batches/preview')
      .set(auth(token))
      .field('course', course._id.toString())
      .field('session', session._id.toString())
      .field('semester', harmattan._id.toString())
      .field('level', level._id.toString())
      .attach('file', Buffer.from(`matricNumber,score\n${student.matricNumber},92`), 'results.csv');

    expect(preview.status).toBe(201);
    expect(preview.body.data.rows[0].status).toBe('error');
    expect(preview.body.data.rows[0].messages[0]).toContain('submitted result cannot be overwritten');
  });
});

describe('Grade distribution stats', () => {
  async function makeApprovedResult({ csc, session, harmattan, level, course }, matric, grade, gradePoint) {
    const student = await Student.create({
      matricNumber: matric,
      firstName: 'Test',
      lastName: matric,
      department: csc._id,
      entrySession: session._id,
      currentLevel: level._id,
    });
    const officer = new User({ name: 'Officer', email: `officer.${matric}.${Date.now()}@test.edu`, role: ROLES.RESULT_OFFICER, department: csc._id });
    await officer.setPassword('Password@123');
    await officer.save();

    await Result.create({
      student: student._id,
      department: csc._id,
      course: course._id,
      session: session._id,
      semester: harmattan._id,
      level: level._id,
      score: 0,
      grade,
      gradePoint,
      status: 'approved',
      enteredBy: officer._id,
      approvedBy: officer._id,
    });
  }

  it('counts only approved results, scoped to the requesting department, in grade-band order', async () => {
    const ctx = await setupAcademics();
    const mthCourse = await Course.create({
      code: 'MTH101',
      title: 'Elementary Maths',
      creditUnit: 3,
      department: ctx.mth._id,
      level: ctx.level._id,
      semester: ctx.harmattan._id,
    });

    await makeApprovedResult(ctx, 'CSC/D/001', 'A', 5);
    await makeApprovedResult(ctx, 'CSC/D/002', 'A', 5);
    await makeApprovedResult(ctx, 'CSC/D/003', 'C', 3);
    await makeApprovedResult({ ...ctx, csc: ctx.mth, course: mthCourse }, 'MTH/D/001', 'F', 0); // different department - must be excluded

    const { token } = await loginAs(ROLES.HOD, ctx.csc);
    const res = await request(app).get('/api/results/stats/grade-distribution').set(auth(token));

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      { grade: 'A', count: 2 },
      { grade: 'B', count: 0 },
      { grade: 'C', count: 1 },
      { grade: 'D', count: 0 },
      { grade: 'E', count: 0 },
      { grade: 'F', count: 0 },
    ]);
  });
});
