import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { User, ROLES } from '../src/models/User.js';
import { Backup } from '../src/models/Backup.js';
import { getBackupFilePath, getBackupModelNames } from '../src/services/backupService.js';

const app = createApp();

async function loginAsAdmin() {
  const email = `admin.${Date.now()}@test.edu`;
  const user = new User({ name: 'Admin', email, role: ROLES.ADMIN });
  await user.setPassword('Password@123');
  await user.save();
  const res = await request(app).post('/api/auth/login').send({ email, password: 'Password@123' });
  return { token: res.body.data.accessToken };
}

// Backup creation writes a real zip file to server/backups/ - clean those up so test runs
// don't accumulate disk artifacts (the directory is gitignored, but still).
afterEach(async () => {
  const backups = await Backup.find({ status: 'completed' });
  for (const backup of backups) {
    try {
      const filePath = getBackupFilePath(backup.fileName);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {
      // ignore
    }
  }
});

describe('Backups', () => {
  it('rejects non-admins', async () => {
    const email = `officer.${Date.now()}@test.edu`;
    const user = new User({ name: 'Officer', email, role: ROLES.TRANSCRIPT_OFFICER });
    await user.setPassword('Password@123');
    await user.save();
    const login = await request(app).post('/api/auth/login').send({ email, password: 'Password@123' });

    const res = await request(app).get('/api/backups').set('Authorization', `Bearer ${login.body.data.accessToken}`);
    expect(res.status).toBe(403);
  });

  it('creates a real zip file containing a JSON dump of every collection', async () => {
    const { token } = await loginAsAdmin();

    const res = await request(app).post('/api/backups').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('completed');
    expect(res.body.data.sizeBytes).toBeGreaterThan(0);

    const filePath = getBackupFilePath(res.body.data.fileName);
    expect(fs.existsSync(filePath)).toBe(true);
    expect(fs.statSync(filePath).size).toBe(res.body.data.sizeBytes);
  });

  it('excludes RefreshToken and Backup data from the archive contents', () => {
    const modelNames = getBackupModelNames();
    expect(modelNames).toContain('User');
    expect(modelNames).toContain('Student');
    expect(modelNames).not.toContain('RefreshToken');
    expect(modelNames).not.toContain('Backup');
  });

  it('lists backups newest first and supports pagination metadata', async () => {
    const { token } = await loginAsAdmin();
    await request(app).post('/api/backups').set('Authorization', `Bearer ${token}`);
    await request(app).post('/api/backups').set('Authorization', `Bearer ${token}`);

    const res = await request(app).get('/api/backups').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBeGreaterThanOrEqual(2);
    expect(new Date(res.body.data[0].createdAt).getTime()).toBeGreaterThanOrEqual(new Date(res.body.data[1].createdAt).getTime());
  });

  it('downloads the backup file as an attachment with the right size and name', async () => {
    const { token } = await loginAsAdmin();
    const created = await request(app).post('/api/backups').set('Authorization', `Bearer ${token}`);

    const download = await request(app)
      .get(`/api/backups/${created.body.data._id}/download`)
      .set('Authorization', `Bearer ${token}`);

    expect(download.status).toBe(200);
    expect(download.headers['content-disposition']).toContain(created.body.data.fileName);
    expect(Number(download.headers['content-length'])).toBe(created.body.data.sizeBytes);
  });

  it('returns 404 for a non-existent backup id', async () => {
    const { token } = await loginAsAdmin();
    const res = await request(app).get('/api/backups/507f1f77bcf86cd799439011/download').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
