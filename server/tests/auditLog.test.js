import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { User, ROLES } from '../src/models/User.js';

const app = createApp();

async function loginAs(role) {
  const email = `${role}.${Date.now()}.${Math.random()}@test.edu`;
  const user = new User({ name: `Test ${role}`, email, role });
  await user.setPassword('Password@123');
  await user.save();
  const res = await request(app).post('/api/auth/login').send({ email, password: 'Password@123' });
  return { token: res.body.data.accessToken };
}

describe('AuditLog immutability', () => {
  it('blocks updateOne, updateMany, and deleteOne/deleteMany on audit entries', async () => {
    const log = await AuditLog.create({ action: 'login_success', module: 'auth' });

    await expect(AuditLog.updateOne({ _id: log._id }, { action: 'tampered' })).rejects.toThrow(/immutable/);
    await expect(AuditLog.updateMany({}, { action: 'tampered' })).rejects.toThrow(/immutable/);
    await expect(AuditLog.deleteOne({ _id: log._id })).rejects.toThrow(/immutable/);
    await expect(AuditLog.deleteMany({})).rejects.toThrow(/immutable/);

    const stillThere = await AuditLog.findById(log._id);
    expect(stillThere).not.toBeNull();
    expect(stillThere.action).toBe('login_success');
  });
});

describe('GET /api/audit-logs', () => {
  it('rejects non-admins', async () => {
    const { token } = await loginAs(ROLES.TRANSCRIPT_OFFICER);
    const res = await request(app).get('/api/audit-logs').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('filters by module and action', async () => {
    const { token } = await loginAs(ROLES.ADMIN);
    await AuditLog.create({ action: 'create', module: 'Student', actorEmail: 'x@test.edu' });
    await AuditLog.create({ action: 'delete', module: 'Student', actorEmail: 'x@test.edu' });
    await AuditLog.create({ action: 'create', module: 'Course', actorEmail: 'x@test.edu' });

    const res = await request(app)
      .get('/api/audit-logs')
      .query({ module: 'Student', action: 'create' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.every((entry) => entry.module === 'Student' && entry.action === 'create')).toBe(true);
  });

  it('filters by a from/to date range on createdAt', async () => {
    const { token } = await loginAs(ROLES.ADMIN);

    const old = await AuditLog.create({ action: 'create', module: 'Course' });
    await AuditLog.collection.updateOne({ _id: old._id }, { $set: { createdAt: new Date('2020-01-01') } });
    await AuditLog.create({ action: 'create', module: 'Course' });

    const res = await request(app)
      .get('/api/audit-logs')
      .query({ module: 'Course', from: '2023-01-01' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.some((entry) => entry._id === String(old._id))).toBe(false);
  });
});
