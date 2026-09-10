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
import { Result } from '../src/models/Result.js';
import { GradingRule } from '../src/models/GradingRule.js';

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
      { classification: 'Second Class Upper', minCgpa: 3.5, maxCgpa: 4.49 },
      { classification: 'Pass', minCgpa: 1, maxCgpa: 1.49 },
    ],
  });
  await Result.create({
    student: student._id,
    department: csc._id,
    course: course._id,
    session: session._id,
    semester: harmattan._id,
    level: level._id,
    score: 75,
    grade: 'A',
    gradePoint: 5,
    enteredBy: student._id,
    status: 'approved',
    approvedBy: student._id,
  });
  return { csc, mth, session, harmattan, level, course, student };
}

async function loginAs(role, department) {
  const email = `${role}.${Date.now()}.${Math.random().toString(36).slice(2)}@test.edu`;
  const user = new User({ name: `Test ${role}`, email, role, department: department?._id });
  await user.setPassword('Password@123');
  await user.save();
  const res = await request(app).post('/api/auth/login').send({ email, password: 'Password@123' });
  return { token: res.body.data.accessToken, user: res.body.data.user };
}

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

describe('Transcript preview', () => {
  it('computes a live transcript reflecting only approved results', async () => {
    const { csc, student } = await setupAcademics();
    const { token } = await loginAs(ROLES.TRANSCRIPT_OFFICER);

    const res = await request(app).get(`/api/transcripts/${student._id}/preview`).set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.data.history.cgpa).toBe(5);
    expect(res.body.data.history.classification).toBe('First Class');
    void csc;
  });
});

describe('Transcript request workflow', () => {
  it('walks a request through requested -> verified -> approved and freezes a snapshot', async () => {
    const { csc, student } = await setupAcademics();
    const officer = await loginAs(ROLES.TRANSCRIPT_OFFICER);
    const hod = await loginAs(ROLES.HOD, csc);

    const create = await request(app).post('/api/transcripts/requests').set(auth(officer.token)).send({ student: student._id, purpose: 'NYSC' });
    expect(create.status).toBe(201);
    const id = create.body.data._id;

    const approveTooSoon = await request(app).post(`/api/transcripts/requests/${id}/approve`).set(auth(hod.token));
    expect(approveTooSoon.status).toBe(409);

    const verify = await request(app).post(`/api/transcripts/requests/${id}/verify`).set(auth(officer.token));
    expect(verify.status).toBe(200);
    expect(verify.body.data.status).toBe('verified');

    const approve = await request(app).post(`/api/transcripts/requests/${id}/approve`).set(auth(hod.token));
    expect(approve.status).toBe(200);
    expect(approve.body.data.status).toBe('approved');
    expect(approve.body.data.snapshotData.cgpa).toBe(5);

    // add a new, failing approved result for a DIFFERENT course after approval - this would pull
    // the live-computed CGPA down, but the already-approved snapshot must stay frozen at 5.
    const mth101 = await Course.create({
      code: 'MTH101',
      title: 'Elementary Mathematics',
      creditUnit: 3,
      department: csc._id,
      level: (await Level.findOne({ name: '100' }))._id,
      semester: (await Semester.findOne({ name: 'Harmattan' }))._id,
    });
    await Result.create({
      student: student._id,
      department: csc._id,
      course: mth101._id,
      session: (await Session.findOne({ name: '2023/2024' }))._id,
      semester: (await Semester.findOne({ name: 'Harmattan' }))._id,
      level: (await Level.findOne({ name: '100' }))._id,
      score: 30,
      grade: 'F',
      gradePoint: 0,
      enteredBy: student._id,
      status: 'approved',
    });

    const livePreview = await request(app).get(`/api/transcripts/${student._id}/preview`).set(auth(officer.token));
    expect(livePreview.body.data.history.cgpa).toBeLessThan(5);

    const detail = await request(app).get(`/api/transcripts/requests/${id}`).set(auth(officer.token));
    expect(detail.body.data.snapshotData.cgpa).toBe(5); // frozen, unaffected by the new result
  });

  it('rejects creating a duplicate in-progress request for the same student', async () => {
    const { student } = await setupAcademics();
    const { token } = await loginAs(ROLES.TRANSCRIPT_OFFICER);

    const first = await request(app).post('/api/transcripts/requests').set(auth(token)).send({ student: student._id });
    expect(first.status).toBe(201);

    const second = await request(app).post('/api/transcripts/requests').set(auth(token)).send({ student: student._id });
    expect(second.status).toBe(409);
  });

  it('allows a new request after a rejection', async () => {
    const { csc, student } = await setupAcademics();
    const officer = await loginAs(ROLES.TRANSCRIPT_OFFICER);
    const hod = await loginAs(ROLES.HOD, csc);

    const create = await request(app).post('/api/transcripts/requests').set(auth(officer.token)).send({ student: student._id });
    const reject = await request(app)
      .post(`/api/transcripts/requests/${create.body.data._id}/reject`)
      .set(auth(hod.token))
      .send({ reason: 'Outstanding fees on record' });
    expect(reject.status).toBe(200);
    expect(reject.body.data.status).toBe('rejected');

    const second = await request(app).post('/api/transcripts/requests').set(auth(officer.token)).send({ student: student._id });
    expect(second.status).toBe(201);
  });

  it('prevents a HOD from another department from approving', async () => {
    const { csc, mth, student } = await setupAcademics();
    const officer = await loginAs(ROLES.TRANSCRIPT_OFFICER);
    const outsiderHod = await loginAs(ROLES.HOD, mth);

    const create = await request(app).post('/api/transcripts/requests').set(auth(officer.token)).send({ student: student._id });
    await request(app).post(`/api/transcripts/requests/${create.body.data._id}/verify`).set(auth(officer.token));

    const approve = await request(app).post(`/api/transcripts/requests/${create.body.data._id}/approve`).set(auth(outsiderHod.token));
    expect(approve.status).toBe(403);
    void csc;
  });

  it('blocks PDF/Excel export until the request is approved', async () => {
    const { student } = await setupAcademics();
    const { token } = await loginAs(ROLES.TRANSCRIPT_OFFICER);

    const create = await request(app).post('/api/transcripts/requests').set(auth(token)).send({ student: student._id });
    const pdf = await request(app).get(`/api/transcripts/requests/${create.body.data._id}/pdf`).set(auth(token));
    expect(pdf.status).toBe(409);
  });

  it('does not approve or issue an official transcript while any result is awaiting approval', async () => {
    const { csc, session, harmattan, level, student } = await setupAcademics();
    const officer = await loginAs(ROLES.TRANSCRIPT_OFFICER);
    const hod = await loginAs(ROLES.HOD, csc);
    const pendingCourse = await Course.create({
      code: 'CSC102',
      title: 'Programming Fundamentals',
      creditUnit: 3,
      department: csc._id,
      level: level._id,
      semester: harmattan._id,
    });

    await Result.create({
      student: student._id,
      department: csc._id,
      course: pendingCourse._id,
      session: session._id,
      semester: harmattan._id,
      level: level._id,
      score: 62,
      grade: 'B',
      gradePoint: 4,
      enteredBy: student._id,
      status: 'submitted',
    });

    const create = await request(app).post('/api/transcripts/requests').set(auth(officer.token)).send({ student: student._id });
    await request(app).post(`/api/transcripts/requests/${create.body.data._id}/verify`).set(auth(officer.token));
    const approve = await request(app).post(`/api/transcripts/requests/${create.body.data._id}/approve`).set(auth(hod.token));

    expect(approve.status).toBe(409);
    expect(approve.body.message).toContain('until all results are approved');
  });

  it('generates a downloadable PDF and Excel file once approved', async () => {
    const { csc, student } = await setupAcademics();
    const officer = await loginAs(ROLES.TRANSCRIPT_OFFICER);
    const hod = await loginAs(ROLES.HOD, csc);

    const create = await request(app).post('/api/transcripts/requests').set(auth(officer.token)).send({ student: student._id });
    const id = create.body.data._id;
    await request(app).post(`/api/transcripts/requests/${id}/verify`).set(auth(officer.token));
    await request(app).post(`/api/transcripts/requests/${id}/approve`).set(auth(hod.token));

    const pdf = await request(app).get(`/api/transcripts/requests/${id}/pdf`).set(auth(officer.token));
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect(pdf.body.length).toBeGreaterThan(1000);

    const excel = await request(app).get(`/api/transcripts/requests/${id}/excel`).set(auth(officer.token));
    expect(excel.status).toBe(200);
    expect(excel.headers['content-type']).toContain('spreadsheetml');

    const detail = await request(app).get(`/api/transcripts/requests/${id}`).set(auth(officer.token));
    expect(detail.body.data.status).toBe('released');
  }, 20000);
});
