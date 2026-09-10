import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { User, ROLES } from '../src/models/User.js';
import { Faculty } from '../src/models/Faculty.js';
import { Department } from '../src/models/Department.js';

const app = createApp();

async function loginAsAdmin() {
  const user = new User({ name: 'Admin', email: 'admin@test.edu', role: ROLES.ADMIN });
  await user.setPassword('Password@123');
  await user.save();
  const res = await request(app).post('/api/auth/login').send({ email: 'admin@test.edu', password: 'Password@123' });
  return { token: res.body.data.accessToken, user: res.body.data.user };
}

async function makeDepartment() {
  const faculty = await Faculty.create({ name: 'Faculty of Science', code: 'SCI' });
  return Department.create({ name: 'Computer Science', code: 'CSC', faculty: faculty._id });
}

describe('User management', () => {
  it('rejects non-admins from listing users', async () => {
    const officer = new User({ name: 'Officer', email: 'officer@test.edu', role: ROLES.TRANSCRIPT_OFFICER });
    await officer.setPassword('Password@123');
    await officer.save();
    const login = await request(app).post('/api/auth/login').send({ email: 'officer@test.edu', password: 'Password@123' });

    const res = await request(app).get('/api/users').set('Authorization', `Bearer ${login.body.data.accessToken}`);
    expect(res.status).toBe(403);
  });

  it('creates a user with a hashed password that can then log in', async () => {
    const { token } = await loginAsAdmin();
    const dept = await makeDepartment();

    const create = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Jane HOD',
        email: 'jane.hod@test.edu',
        password: 'InitialPass@1',
        role: ROLES.HOD,
        department: dept._id.toString(),
      });

    expect(create.status).toBe(201);
    expect(create.body.data.passwordHash).toBeUndefined();

    const stored = await User.findOne({ email: 'jane.hod@test.edu' }).select('+passwordHash');
    expect(stored.passwordHash).not.toBe('InitialPass@1');
    expect(await stored.comparePassword('InitialPass@1')).toBe(true);

    const login = await request(app).post('/api/auth/login').send({ email: 'jane.hod@test.edu', password: 'InitialPass@1' });
    expect(login.status).toBe(200);
  });

  it('rejects creating a department-scoped role without a department', async () => {
    const { token } = await loginAsAdmin();
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'No Dept HOD', email: 'nodept@test.edu', password: 'Password@123', role: ROLES.HOD });
    expect(res.status).toBe(400);
  });

  it('prevents an admin from deactivating their own account', async () => {
    const { token, user } = await loginAsAdmin();
    const res = await request(app)
      .put(`/api/users/${user._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: false });
    expect(res.status).toBe(400);
  });

  it('resets a user password via the admin endpoint', async () => {
    const { token } = await loginAsAdmin();
    const dept = await makeDepartment();
    const target = new User({ name: 'Reset Me', email: 'reset@test.edu', role: ROLES.RESULT_OFFICER, department: dept._id });
    await target.setPassword('OldPass@123');
    await target.save();

    const res = await request(app)
      .post(`/api/users/${target._id}/reset-password`)
      .set('Authorization', `Bearer ${token}`)
      .send({ newPassword: 'BrandNewPass@1' });
    expect(res.status).toBe(200);

    const login = await request(app).post('/api/auth/login').send({ email: 'reset@test.edu', password: 'BrandNewPass@1' });
    expect(login.status).toBe(200);
    expect(login.body.data.user.mustChangePassword).toBe(true);
  });

  it('does not expose a delete route for users', async () => {
    const { token } = await loginAsAdmin();
    const dept = await makeDepartment();
    const target = await User.create({ name: 'X', email: 'x@test.edu', role: ROLES.RESULT_OFFICER, department: dept._id, passwordHash: 'irrelevant' });

    const res = await request(app).delete(`/api/users/${target._id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  describe('duplicate-account prevention', () => {
    it('rejects a duplicate email even with different casing and surrounding whitespace', async () => {
      const { token } = await loginAsAdmin();
      const dept = await makeDepartment();
      await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Original Person', email: 'someone@test.edu', password: 'Password@123', role: ROLES.RESULT_OFFICER, department: dept._id.toString() });

      const dup = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Different Name', email: '  SomeOne@Test.EDU  ', password: 'Password@123', role: ROLES.RESULT_OFFICER, department: dept._id.toString() });

      expect(dup.status).toBe(409);
      expect(dup.body.message.toLowerCase()).toContain('already exists');
    });

    it('flags a very similar existing name and blocks creation until explicitly confirmed', async () => {
      const { token } = await loginAsAdmin();
      const dept = await makeDepartment();
      await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Chinedu Okafor', email: 'chinedu.o@test.edu', password: 'Password@123', role: ROLES.RESULT_OFFICER, department: dept._id.toString() });

      const flagged = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Chinedu Okafo', email: 'c.okafo@test.edu', password: 'Password@123', role: ROLES.HOD, department: dept._id.toString() });

      expect(flagged.status).toBe(409);
      expect(flagged.body.duplicates).toBeDefined();
      expect(flagged.body.duplicates.length).toBeGreaterThan(0);
      expect(flagged.body.duplicates[0].name).toBe('Chinedu Okafor');

      const confirmed = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Chinedu Okafo',
          email: 'c.okafo@test.edu',
          password: 'Password@123',
          role: ROLES.HOD,
          department: dept._id.toString(),
          confirmDuplicate: true,
        });
      expect(confirmed.status).toBe(201);
    });

    it('does not flag clearly distinct names', async () => {
      const { token } = await loginAsAdmin();
      const dept = await makeDepartment();
      await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Amaka Bello', email: 'amaka@test.edu', password: 'Password@123', role: ROLES.TRANSCRIPT_OFFICER });

      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Segun Adewale', email: 'segun@test.edu', password: 'Password@123', role: ROLES.TRANSCRIPT_OFFICER });

      expect(res.status).toBe(201);
    });
  });
});
