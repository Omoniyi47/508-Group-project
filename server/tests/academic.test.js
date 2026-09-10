import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { User, ROLES } from '../src/models/User.js';
import { Faculty } from '../src/models/Faculty.js';
import { Department } from '../src/models/Department.js';

const app = createApp();

async function loginAs(role, overrides = {}) {
  const email = `${role}@test.edu`;
  const user = new User({ name: `Test ${role}`, email, role, ...overrides });
  await user.setPassword('Password@123');
  await user.save();

  const res = await request(app).post('/api/auth/login').send({ email, password: 'Password@123' });
  return { token: res.body.data.accessToken, user: res.body.data.user };
}

describe('Faculty CRUD + RBAC', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/faculties');
    expect(res.status).toBe(401);
  });

  it('allows a non-admin to list but not create', async () => {
    const { token } = await loginAs(ROLES.TRANSCRIPT_OFFICER);

    const list = await request(app).get('/api/faculties').set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);

    const create = await request(app)
      .post('/api/faculties')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Faculty of Science', code: 'SCI' });
    expect(create.status).toBe(403);
  });

  it('allows an admin to create, update, and delete a faculty', async () => {
    const { token } = await loginAs(ROLES.ADMIN);

    const create = await request(app)
      .post('/api/faculties')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Faculty of Science', code: 'SCI' });
    expect(create.status).toBe(201);
    const id = create.body.data._id;

    const update = await request(app)
      .put(`/api/faculties/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Faculty of Natural Sciences' });
    expect(update.status).toBe(200);
    expect(update.body.data.name).toBe('Faculty of Natural Sciences');

    const del = await request(app).delete(`/api/faculties/${id}`).set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(200);
  });

  it('rejects duplicate faculty codes with a 409', async () => {
    const { token } = await loginAs(ROLES.ADMIN);
    await request(app).post('/api/faculties').set('Authorization', `Bearer ${token}`).send({ name: 'Faculty A', code: 'FA' });

    const dup = await request(app)
      .post('/api/faculties')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Faculty B', code: 'FA' });
    expect(dup.status).toBe(409);
  });

  it('blocks deleting a faculty that has departments', async () => {
    const { token } = await loginAs(ROLES.ADMIN);
    const faculty = await Faculty.create({ name: 'Faculty of Science', code: 'SCI' });
    await Department.create({ name: 'Computer Science', code: 'CSC', faculty: faculty._id });

    const del = await request(app).delete(`/api/faculties/${faculty._id}`).set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(409);
  });
});

describe('Session isCurrent exclusivity', () => {
  it('only ever keeps one session marked as current', async () => {
    const { token } = await loginAs(ROLES.ADMIN);

    const s1 = await request(app)
      .post('/api/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '2023/2024', startDate: '2023-09-01', endDate: '2024-07-31', isCurrent: true });
    expect(s1.status).toBe(201);

    const s2 = await request(app)
      .post('/api/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '2024/2025', startDate: '2024-09-01', endDate: '2025-07-31', isCurrent: true });
    expect(s2.status).toBe(201);

    const list = await request(app).get('/api/sessions').set('Authorization', `Bearer ${token}`);
    const currentSessions = list.body.data.filter((s) => s.isCurrent);
    expect(currentSessions).toHaveLength(1);
    expect(currentSessions[0].name).toBe('2024/2025');
  });

  it('rejects a session name that is not in YYYY/YYYY format', async () => {
    const { token } = await loginAs(ROLES.ADMIN);
    const res = await request(app)
      .post('/api/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '2023-2024', startDate: '2023-09-01', endDate: '2024-07-31' });
    expect(res.status).toBe(400);
  });
});

describe('GradingRule validation and exclusivity', () => {
  const validRule = {
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
  };

  it('creates a valid grading rule and enforces single active rule', async () => {
    const { token } = await loginAs(ROLES.ADMIN);

    const first = await request(app).post('/api/grading-rules').set('Authorization', `Bearer ${token}`).send(validRule);
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/grading-rules')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validRule, name: 'Alt Scale' });
    expect(second.status).toBe(201);

    const list = await request(app).get('/api/grading-rules').set('Authorization', `Bearer ${token}`);
    const active = list.body.data.filter((r) => r.isActive);
    expect(active).toHaveLength(1);
    expect(active[0].name).toBe('Alt Scale');
  });

  it('rejects overlapping grade bands', async () => {
    const { token } = await loginAs(ROLES.ADMIN);
    const res = await request(app)
      .post('/api/grading-rules')
      .set('Authorization', `Bearer ${token}`)
      .send({
        ...validRule,
        gradeBands: [
          { grade: 'A', minScore: 60, maxScore: 100, point: 5 },
          { grade: 'B', minScore: 65, maxScore: 75, point: 4 },
        ],
      });
    expect(res.status).toBe(400);
  });

  it('rejects grade bands that leave a gap in score coverage', async () => {
    const { token } = await loginAs(ROLES.ADMIN);
    const res = await request(app)
      .post('/api/grading-rules')
      .set('Authorization', `Bearer ${token}`)
      .send({
        ...validRule,
        gradeBands: [
          { grade: 'A', minScore: 70, maxScore: 100, point: 5 },
          { grade: 'B', minScore: 60, maxScore: 69, point: 4 },
          { grade: 'F', minScore: 0, maxScore: 39, point: 0 }, // 40-59 uncovered
        ],
      });
    expect(res.status).toBe(400);
  });

  it('refuses to delete the active grading rule', async () => {
    const { token } = await loginAs(ROLES.ADMIN);
    const create = await request(app).post('/api/grading-rules').set('Authorization', `Bearer ${token}`).send(validRule);
    const id = create.body.data._id;

    const del = await request(app).delete(`/api/grading-rules/${id}`).set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(409);
  });
});
