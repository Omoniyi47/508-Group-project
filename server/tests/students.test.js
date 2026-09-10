import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { User, ROLES } from '../src/models/User.js';
import { Faculty } from '../src/models/Faculty.js';
import { Department } from '../src/models/Department.js';
import { Session } from '../src/models/Session.js';
import { Level } from '../src/models/Level.js';
import { Semester } from '../src/models/Semester.js';
import { Course } from '../src/models/Course.js';
import { GradingRule } from '../src/models/GradingRule.js';
import { Student } from '../src/models/Student.js';
import { Result } from '../src/models/Result.js';
import { TranscriptRequest } from '../src/models/TranscriptRequest.js';
import { Verification } from '../src/models/Verification.js';

const app = createApp();

async function setupAcademics() {
  const faculty = await Faculty.create({ name: 'Faculty of Science', code: 'SCI' });
  const csc = await Department.create({ name: 'Computer Science', code: 'CSC', faculty: faculty._id });
  const mth = await Department.create({ name: 'Mathematics', code: 'MTH', faculty: faculty._id });
  const session = await Session.create({ name: '2023/2024', startDate: '2023-09-01', endDate: '2024-07-31', isCurrent: true });
  const level = await Level.create({ name: '100', order: 100 });
  return { csc, mth, session, level };
}

async function loginAs(role, department) {
  const email = `${role}.${Date.now()}@test.edu`;
  const user = new User({ name: `Test ${role}`, email, role, department: department?._id });
  await user.setPassword('Password@123');
  await user.save();
  const res = await request(app).post('/api/auth/login').send({ email, password: 'Password@123' });
  return { token: res.body.data.accessToken, user: res.body.data.user };
}

describe('Student CRUD + department scoping', () => {
  it('lets a result officer create a student, forced into their own department', async () => {
    const { csc, mth, session, level } = await setupAcademics();
    const { token } = await loginAs(ROLES.RESULT_OFFICER, csc);

    const res = await request(app)
      .post('/api/students')
      .set('Authorization', `Bearer ${token}`)
      .send({
        matricNumber: 'CSC/2023/001',
        firstName: 'Ada',
        lastName: 'Lovelace',
        department: mth._id.toString(), // attempt to set a different department
        entrySession: session._id.toString(),
        currentLevel: level._id.toString(),
      });

    expect(res.status).toBe(201);
    expect(res.body.data.department).toBe(csc._id.toString()); // forced to officer's own department
  });

  it('lets a result officer create a student without sending a department at all (as the real form does)', async () => {
    const { csc, session, level } = await setupAcademics();
    const { token } = await loginAs(ROLES.RESULT_OFFICER, csc);

    const res = await request(app)
      .post('/api/students')
      .set('Authorization', `Bearer ${token}`)
      .send({
        matricNumber: 'CSC/2023/003',
        firstName: 'Margaret',
        lastName: 'Hamilton',
        department: null,
        otherNames: null,
        entrySession: session._id.toString(),
        currentLevel: level._id.toString(),
      });

    expect(res.status).toBe(201);
    expect(res.body.data.department).toBe(csc._id.toString());
  });

  it('requires an admin to supply a department explicitly', async () => {
    const { session, level } = await setupAcademics();
    const { token } = await loginAs(ROLES.ADMIN);

    const res = await request(app)
      .post('/api/students')
      .set('Authorization', `Bearer ${token}`)
      .send({
        matricNumber: 'CSC/2023/004',
        firstName: 'Katherine',
        lastName: 'Johnson',
        entrySession: session._id.toString(),
        currentLevel: level._id.toString(),
      });

    expect(res.status).toBe(400);
  });

  it('rejects duplicate matric numbers', async () => {
    const { csc, session, level } = await setupAcademics();
    const { token } = await loginAs(ROLES.ADMIN);

    const payload = {
      matricNumber: 'CSC/2023/002',
      firstName: 'Grace',
      lastName: 'Hopper',
      department: csc._id.toString(),
      entrySession: session._id.toString(),
      currentLevel: level._id.toString(),
    };

    const first = await request(app).post('/api/students').set('Authorization', `Bearer ${token}`).send(payload);
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/students')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...payload, firstName: 'Grace2' });
    expect(second.status).toBe(409);
  });

  it('prevents a result officer from viewing or editing a student outside their department', async () => {
    const { csc, mth, session, level } = await setupAcademics();
    const adminLogin = await loginAs(ROLES.ADMIN);

    const otherDeptStudent = await request(app)
      .post('/api/students')
      .set('Authorization', `Bearer ${adminLogin.token}`)
      .send({
        matricNumber: 'MTH/2023/001',
        firstName: 'Isaac',
        lastName: 'Newton',
        department: mth._id.toString(),
        entrySession: session._id.toString(),
        currentLevel: level._id.toString(),
      });

    const { token } = await loginAs(ROLES.RESULT_OFFICER, csc);

    const view = await request(app)
      .get(`/api/students/${otherDeptStudent.body.data._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(view.status).toBe(403);

    const list = await request(app).get('/api/students').set('Authorization', `Bearer ${token}`);
    expect(list.body.data).toHaveLength(0);
  });

  it('lets a transcript officer view students across all departments', async () => {
    const { csc, mth, session, level } = await setupAcademics();
    const adminLogin = await loginAs(ROLES.ADMIN);

    await request(app)
      .post('/api/students')
      .set('Authorization', `Bearer ${adminLogin.token}`)
      .send({ matricNumber: 'CSC/2023/010', firstName: 'A', lastName: 'B', department: csc._id, entrySession: session._id, currentLevel: level._id });
    await request(app)
      .post('/api/students')
      .set('Authorization', `Bearer ${adminLogin.token}`)
      .send({ matricNumber: 'MTH/2023/010', firstName: 'C', lastName: 'D', department: mth._id, entrySession: session._id, currentLevel: level._id });

    const { token } = await loginAs(ROLES.TRANSCRIPT_OFFICER);
    const list = await request(app).get('/api/students').set('Authorization', `Bearer ${token}`);
    expect(list.body.data.length).toBeGreaterThanOrEqual(2);
  });

  it('supports search by matric number and by name', async () => {
    const { csc, session, level } = await setupAcademics();
    const { token } = await loginAs(ROLES.ADMIN);

    await request(app)
      .post('/api/students')
      .set('Authorization', `Bearer ${token}`)
      .send({ matricNumber: 'CSC/2023/099', firstName: 'Linus', lastName: 'Torvalds', department: csc._id, entrySession: session._id, currentLevel: level._id });

    const byMatric = await request(app).get('/api/students?matric=CSC/2023/099').set('Authorization', `Bearer ${token}`);
    expect(byMatric.body.data).toHaveLength(1);

    const byName = await request(app).get('/api/students?name=torvalds').set('Authorization', `Bearer ${token}`);
    expect(byName.body.data).toHaveLength(1);
  });

  it('deletes a student with no academic history', async () => {
    const { csc, session, level } = await setupAcademics();
    const { token } = await loginAs(ROLES.ADMIN);

    const student = await Student.create({ matricNumber: 'CSC/2023/090', firstName: 'No', lastName: 'History', department: csc._id, entrySession: session._id, currentLevel: level._id });

    const res = await request(app).delete(`/api/students/${student._id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(await Student.findById(student._id)).toBeNull();
  });

  it('refuses to delete a student who has results or transcript requests on file, instead of orphaning them', async () => {
    const { csc, session, level } = await setupAcademics();
    const { token, user: admin } = await loginAs(ROLES.ADMIN);
    const semester = await Semester.create({ name: 'Harmattan', order: 1 });
    const course = await Course.create({ code: 'CSC101', title: 'Intro to CS', creditUnit: 3, department: csc._id, level: level._id, semester: semester._id });

    const student = await Student.create({ matricNumber: 'CSC/2023/091', firstName: 'Has', lastName: 'History', department: csc._id, entrySession: session._id, currentLevel: level._id });
    await Result.create({
      student: student._id, department: csc._id, course: course._id, session: session._id, semester: semester._id, level: level._id,
      score: 70, grade: 'A', gradePoint: 5, enteredBy: admin._id, status: 'approved',
    });

    const res = await request(app).delete(`/api/students/${student._id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(409);

    expect(await Student.findById(student._id)).not.toBeNull();
    expect(await Result.countDocuments({ student: student._id })).toBe(1);
  });
});

describe('Duplicate detection and verification queue', () => {
  it('treats students with the same full name but different matric numbers as different people', async () => {
    const { csc, session, level } = await setupAcademics();
    const { token } = await loginAs(ROLES.ADMIN);

    const first = await request(app)
      .post('/api/students')
      .set('Authorization', `Bearer ${token}`)
      .send({ matricNumber: 'CSC/2023/050', firstName: 'Chinedu', lastName: 'Okafor', department: csc._id, entrySession: session._id, currentLevel: level._id });
    expect(first.body.meta.duplicatesFlagged).toBe(0);

    const second = await request(app)
      .post('/api/students')
      .set('Authorization', `Bearer ${token}`)
      .send({ matricNumber: 'CSC/2023/051', firstName: 'Chinedu', lastName: 'Okafor', department: csc._id, entrySession: session._id, currentLevel: level._id });
    expect(second.body.meta.duplicatesFlagged).toBe(0);

    const queue = await request(app).get('/api/verifications').set('Authorization', `Bearer ${token}`);
    expect(queue.body.data).toHaveLength(0);
  });

  it('resolving as "distinct" leaves both student records intact', async () => {
    const { csc, session, level } = await setupAcademics();
    const { token } = await loginAs(ROLES.ADMIN);

    const first = await request(app)
      .post('/api/students')
      .set('Authorization', `Bearer ${token}`)
      .send({ matricNumber: 'CSC/2023/060', firstName: 'Chinedu', lastName: 'Okafor', department: csc._id, entrySession: session._id, currentLevel: level._id });
    const second = await request(app)
      .post('/api/students')
      .set('Authorization', `Bearer ${token}`)
      .send({ matricNumber: 'CSC/2023/061', firstName: 'Chinedu', lastName: 'Okafor', department: csc._id, entrySession: session._id, currentLevel: level._id });

    await Verification.create({ student: first.body.data._id, matchedStudent: second.body.data._id, confidenceScore: 1 });

    const queue = await request(app).get('/api/verifications').set('Authorization', `Bearer ${token}`);
    const verificationId = queue.body.data[0]._id;

    const resolve = await request(app)
      .post(`/api/verifications/${verificationId}/resolve`)
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'distinct', notes: 'Confirmed two different students' });
    expect(resolve.status).toBe(200);

    const students = await request(app).get('/api/students?matric=CSC/2023/06').set('Authorization', `Bearer ${token}`);
    expect(students.body.data).toHaveLength(2);
  });

  it('resolving as "merge" deletes the duplicate and keeps the matched record', async () => {
    const { csc, session, level } = await setupAcademics();
    const { token } = await loginAs(ROLES.ADMIN);

    const first = await request(app)
      .post('/api/students')
      .set('Authorization', `Bearer ${token}`)
      .send({ matricNumber: 'CSC/2023/070', firstName: 'Amaka', lastName: 'Bello', department: csc._id, entrySession: session._id, currentLevel: level._id });
    const second = await request(app)
      .post('/api/students')
      .set('Authorization', `Bearer ${token}`)
      .send({ matricNumber: 'CSC/2023/071', firstName: 'Amaka', lastName: 'Bello', department: csc._id, entrySession: session._id, currentLevel: level._id });

    await Verification.create({ student: first.body.data._id, matchedStudent: second.body.data._id, confidenceScore: 1 });

    const queue = await request(app).get('/api/verifications').set('Authorization', `Bearer ${token}`);
    const verificationId = queue.body.data[0]._id;

    const resolve = await request(app)
      .post(`/api/verifications/${verificationId}/resolve`)
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'merge', keep: 'matchedStudent' });
    expect(resolve.status).toBe(200);

    const students = await request(app).get('/api/students?matric=CSC/2023/07').set('Authorization', `Bearer ${token}`);
    expect(students.body.data).toHaveLength(1);
  });

  it('merging carries the removed student\'s results and transcript requests over to the kept record instead of orphaning them', async () => {
    const { csc, session, level } = await setupAcademics();
    const { token, user: admin } = await loginAs(ROLES.ADMIN);
    const semester = await Semester.create({ name: 'Harmattan', order: 1 });
    const course = await Course.create({ code: 'CSC101', title: 'Intro to CS', creditUnit: 3, department: csc._id, level: level._id, semester: semester._id });
    const otherCourse = await Course.create({ code: 'CSC102', title: 'Programming', creditUnit: 3, department: csc._id, level: level._id, semester: semester._id });
    await GradingRule.create({
      name: 'Scale',
      isActive: true,
      gradeBands: [{ grade: 'A', minScore: 0, maxScore: 100, point: 5 }],
      classificationBands: [{ classification: 'Pass', minCgpa: 0, maxCgpa: 5 }],
    });

    const keptStudent = await Student.create({ matricNumber: 'CSC/2023/080', firstName: 'Ngozi', lastName: 'Umeh', department: csc._id, entrySession: session._id, currentLevel: level._id });
    const removedStudent = await Student.create({ matricNumber: 'CSC/2023/081', firstName: 'Ngozi', lastName: 'Umeh', department: csc._id, entrySession: session._id, currentLevel: level._id });

    // a result that only exists on the removed student - should carry over cleanly
    const uniqueResult = await Result.create({
      student: removedStudent._id, department: csc._id, course: otherCourse._id, session: session._id, semester: semester._id, level: level._id,
      score: 70, grade: 'A', gradePoint: 5, enteredBy: admin._id, status: 'approved',
    });
    // a result that conflicts with one already on the kept student - the removed copy should be dropped, not duplicated
    await Result.create({
      student: keptStudent._id, department: csc._id, course: course._id, session: session._id, semester: semester._id, level: level._id,
      score: 60, grade: 'A', gradePoint: 5, enteredBy: admin._id, status: 'approved',
    });
    const conflictingResult = await Result.create({
      student: removedStudent._id, department: csc._id, course: course._id, session: session._id, semester: semester._id, level: level._id,
      score: 65, grade: 'A', gradePoint: 5, enteredBy: admin._id, status: 'approved',
    });

    const transcriptRequest = await TranscriptRequest.create({ student: removedStudent._id, department: csc._id, requestedBy: admin._id });

    const verification = await Verification.create({ student: keptStudent._id, matchedStudent: removedStudent._id, confidenceScore: 0.9 });
    const resolve = await request(app)
      .post(`/api/verifications/${verification._id}/resolve`)
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'merge', keep: 'student' });
    expect(resolve.status).toBe(200);

    const refreshedRequest = await TranscriptRequest.findById(transcriptRequest._id);
    expect(String(refreshedRequest.student)).toBe(String(keptStudent._id));

    const refreshedUniqueResult = await Result.findById(uniqueResult._id);
    expect(String(refreshedUniqueResult.student)).toBe(String(keptStudent._id));

    const conflictStillExists = await Result.findById(conflictingResult._id);
    expect(conflictStillExists).toBeNull();

    const keptResultsForCourse = await Result.find({ student: keptStudent._id, course: course._id });
    expect(keptResultsForCourse).toHaveLength(1);

    const removedStudentStillExists = await Student.findById(removedStudent._id);
    expect(removedStudentStillExists).toBeNull();
  });
});
