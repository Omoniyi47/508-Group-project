import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { User, ROLES } from '../src/models/User.js';
import { Faculty } from '../src/models/Faculty.js';
import { Department } from '../src/models/Department.js';
import { Session } from '../src/models/Session.js';
import { Level } from '../src/models/Level.js';
import { Student } from '../src/models/Student.js';
import { TranscriptDocument } from '../src/models/TranscriptDocument.js';

const app = createApp();

async function setupStudents() {
  const faculty = await Faculty.create({ name: 'Faculty of Science', code: 'SCI' });
  const csc = await Department.create({ name: 'Computer Science', code: 'CSC', faculty: faculty._id });
  const mth = await Department.create({ name: 'Mathematics', code: 'MTH', faculty: faculty._id });
  const session = await Session.create({ name: '2023/2024', startDate: '2023-09-01', endDate: '2024-07-31', isCurrent: true });
  const level = await Level.create({ name: '100', order: 100 });
  const cscStudent = await Student.create({
    matricNumber: 'CSC/2023/001',
    firstName: 'Ada',
    lastName: 'Lovelace',
    department: csc._id,
    entrySession: session._id,
    currentLevel: level._id,
  });
  const mthStudent = await Student.create({
    matricNumber: 'MTH/2023/001',
    firstName: 'Alan',
    lastName: 'Turing',
    department: mth._id,
    entrySession: session._id,
    currentLevel: level._id,
  });
  return { csc, mth, cscStudent, mthStudent };
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

describe('Transcript scan holding storage', () => {
  it('uploads, lists, and downloads a multi-file transcript scan for an in-department student', async () => {
    const { csc, cscStudent } = await setupStudents();
    const { token } = await loginAs(ROLES.RESULT_OFFICER, csc);

    const uploadRes = await request(app)
      .post('/api/transcript-documents')
      .set(auth(token))
      .field('student', String(cscStudent._id))
      .field('label', '2015 transcript')
      .attach('files', Buffer.from('fake page one'), { filename: 'page1.jpg', contentType: 'image/jpeg' })
      .attach('files', Buffer.from('fake page two'), { filename: 'page2.pdf', contentType: 'application/pdf' });

    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body.data.files).toHaveLength(2);
    expect(uploadRes.body.data.files[0].data).toBeUndefined();

    const stored = await TranscriptDocument.findById(uploadRes.body.data._id).select('+files.data');
    expect(stored.files[1].data.toString()).toBe('fake page two');

    const listRes = await request(app).get('/api/transcript-documents').set(auth(token));
    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);
    expect(listRes.body.data[0].files[0].data).toBeUndefined();

    const fileId = uploadRes.body.data.files[1]._id;
    const downloadRes = await request(app)
      .get(`/api/transcript-documents/${uploadRes.body.data._id}/files/${fileId}`)
      .set(auth(token));
    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers['content-disposition']).toContain('page2.pdf');
    expect(Buffer.from(downloadRes.body).toString()).toBe('fake page two');
  });

  it('blocks a Result Officer/HOD from accessing another department\'s transcript scan', async () => {
    const { csc, mth, mthStudent } = await setupStudents();
    const { token: mthOfficerToken } = await loginAs(ROLES.RESULT_OFFICER, mth);
    const { token: cscOfficerToken } = await loginAs(ROLES.RESULT_OFFICER, csc);

    const uploadRes = await request(app)
      .post('/api/transcript-documents')
      .set(auth(mthOfficerToken))
      .field('student', String(mthStudent._id))
      .attach('files', Buffer.from('scan'), { filename: 'page1.jpg', contentType: 'image/jpeg' });
    expect(uploadRes.status).toBe(201);

    const forbidden = await request(app)
      .get(`/api/transcript-documents/${uploadRes.body.data._id}`)
      .set(auth(cscOfficerToken));
    expect(forbidden.status).toBe(403);
  });

  it('rejects an upload with no files, and rejects files that together exceed the size cap', async () => {
    const { csc, cscStudent } = await setupStudents();
    const { token } = await loginAs(ROLES.RESULT_OFFICER, csc);

    const noFiles = await request(app)
      .post('/api/transcript-documents')
      .set(auth(token))
      .field('student', String(cscStudent._id));
    expect(noFiles.status).toBe(400);

    const oversized = await request(app)
      .post('/api/transcript-documents')
      .set(auth(token))
      .field('student', String(cscStudent._id))
      .attach('files', Buffer.alloc(8 * 1024 * 1024, 'a'), { filename: 'page1.pdf', contentType: 'application/pdf' })
      .attach('files', Buffer.alloc(7 * 1024 * 1024, 'b'), { filename: 'page2.pdf', contentType: 'application/pdf' });
    expect(oversized.status).toBe(400);
    expect(oversized.body.message).toMatch(/too large/i);
  });

  it('only lets an Admin delete a stored transcript scan', async () => {
    const { csc, cscStudent } = await setupStudents();
    const { token: officerToken } = await loginAs(ROLES.RESULT_OFFICER, csc);
    const { token: adminToken } = await loginAs(ROLES.ADMIN);

    const uploadRes = await request(app)
      .post('/api/transcript-documents')
      .set(auth(officerToken))
      .field('student', String(cscStudent._id))
      .attach('files', Buffer.from('scan'), { filename: 'page1.jpg', contentType: 'image/jpeg' });
    const documentId = uploadRes.body.data._id;

    const deniedDelete = await request(app).delete(`/api/transcript-documents/${documentId}`).set(auth(officerToken));
    expect(deniedDelete.status).toBe(403);

    const allowedDelete = await request(app).delete(`/api/transcript-documents/${documentId}`).set(auth(adminToken));
    expect(allowedDelete.status).toBe(200);
    expect(await TranscriptDocument.findById(documentId)).toBeNull();
  });
});
