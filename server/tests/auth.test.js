import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { User, ROLES } from '../src/models/User.js';
import { authorize } from '../src/middleware/auth.js';
import { ApiError } from '../src/utils/ApiError.js';
import { env } from '../src/config/env.js';

const app = createApp();

async function createUser({ email = 'admin@test.edu', password = 'Password@123', role = ROLES.ADMIN } = {}) {
  const user = new User({ name: 'Test User', email, role });
  await user.setPassword(password);
  await user.save();
  return user;
}

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await createUser();
  });

  it('logs in successfully with correct credentials and returns a JWT', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.edu', password: 'Password@123' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.accessToken.split('.')).toHaveLength(3);
    expect(res.body.data.user.email).toBe('admin@test.edu');
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(res.headers['set-cookie'][0]).toMatch(/refreshToken=/);
  });

  it('rejects an incorrect password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.edu', password: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('sets and clears a secure cross-site refresh cookie in production', async () => {
    const previousProduction = env.isProduction;
    env.isProduction = true;
    try {
      const login = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@test.edu', password: 'Password@123' });
      expect(login.status).toBe(200);
      const cookie = login.headers['set-cookie'][0];
      expect(cookie).toContain('SameSite=None');
      expect(cookie).toContain('Secure');
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('Path=/api/auth');

      const refresh = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', cookie.split(';')[0]);
      expect(refresh.status).toBe(200);
      expect(refresh.headers['set-cookie'][0]).toContain('SameSite=None');
      expect(refresh.headers['set-cookie'][0]).toContain('Secure');

      const logout = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', refresh.headers['set-cookie'][0].split(';')[0]);
      expect(logout.status).toBe(200);
      const cleared = logout.headers['set-cookie'][0];
      expect(cleared).toContain('SameSite=None');
      expect(cleared).toContain('Secure');
      expect(cleared).toContain('Expires=Thu, 01 Jan 1970');
      expect(cleared).not.toContain('Max-Age=');
    } finally {
      env.isProduction = previousProduction;
    }
  });

  it('rejects an unknown email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.edu', password: 'Password@123' });

    expect(res.status).toBe(401);
  });

  it('rejects a malformed email with a 400 validation error', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'not-an-email', password: 'Password@123' });

    expect(res.status).toBe(400);
    expect(res.body.errors).toBeDefined();
  });

  it('rejects login for a deactivated account', async () => {
    await User.updateOne({ email: 'admin@test.edu' }, { isActive: false });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.edu', password: 'Password@123' });

    expect(res.status).toBe(403);
  });
});

describe('GET /api/auth/me', () => {
  it('returns 401 when no token is provided', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 for a malformed token', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  it('returns the current user profile for a valid token', async () => {
    await createUser();
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.edu', password: 'Password@123' });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.data.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('admin@test.edu');
  });
});

describe('POST /api/auth/refresh', () => {
  it('issues a valid new access token and rotates the refresh cookie', async () => {
    await createUser();
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.edu', password: 'Password@123' });

    const cookie = login.headers['set-cookie'];
    const res = await request(app).post('/api/auth/refresh').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken.split('.')).toHaveLength(3);
    expect(res.headers['set-cookie'][0]).toMatch(/refreshToken=/);
    expect(res.headers['set-cookie'][0]).not.toBe(cookie[0]);
  });

  it('rejects reuse of a refresh token after it has been rotated', async () => {
    await createUser();
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.edu', password: 'Password@123' });

    const originalCookie = login.headers['set-cookie'];
    await request(app).post('/api/auth/refresh').set('Cookie', originalCookie);

    const reuse = await request(app).post('/api/auth/refresh').set('Cookie', originalCookie);
    expect(reuse.status).toBe(401);
  });

  it('rejects refresh when no cookie is present', async () => {
    const res = await request(app).post('/api/auth/refresh');
    expect(res.status).toBe(401);
  });
});

describe('authorize middleware (role-based access control)', () => {
  function runAuthorize(role, allowedRoles) {
    return new Promise((resolve) => {
      const req = { user: { role } };
      const next = (err) => resolve(err);
      authorize(...allowedRoles)(req, {}, next);
    });
  }

  it('calls next() with no error when the user role is allowed', async () => {
    const err = await runAuthorize(ROLES.ADMIN, [ROLES.ADMIN, ROLES.HOD]);
    expect(err).toBeUndefined();
  });

  it('calls next() with a 403 ApiError when the user role is not allowed', async () => {
    const err = await runAuthorize(ROLES.RESULT_OFFICER, [ROLES.ADMIN, ROLES.HOD]);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.statusCode).toBe(403);
  });
});
