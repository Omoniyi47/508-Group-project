import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { User, ROLES } from '../src/models/User.js';
import { SystemSetting } from '../src/models/SystemSetting.js';

const app = createApp();

async function loginAs(role) {
  const email = `${role}.${Date.now()}@test.edu`;
  const user = new User({ name: `Test ${role}`, email, role });
  await user.setPassword('Password@123');
  await user.save();
  const res = await request(app).post('/api/auth/login').send({ email, password: 'Password@123' });
  return { token: res.body.data.accessToken };
}

describe('System settings', () => {
  it('rejects non-admins', async () => {
    const { token } = await loginAs(ROLES.TRANSCRIPT_OFFICER);
    const res = await request(app).get('/api/settings').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('returns sensible defaults on first read (singleton auto-created)', async () => {
    const { token } = await loginAs(ROLES.ADMIN);
    const res = await request(app).get('/api/settings').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.institutionName).toBe('University Name');

    const count = await SystemSetting.countDocuments();
    expect(count).toBe(1);
  });

  it('updates settings and keeps a single singleton document (no duplicates on repeated updates)', async () => {
    const { token } = await loginAs(ROLES.ADMIN);

    const update1 = await request(app)
      .put('/api/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ institutionName: 'Greenfield University', institutionAddress: '1 Campus Road', registrarEmail: 'registrar@greenfield.edu' });
    expect(update1.status).toBe(200);
    expect(update1.body.data.institutionName).toBe('Greenfield University');

    const update2 = await request(app)
      .put('/api/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ institutionName: 'Greenfield University (Updated)' });
    expect(update2.status).toBe(200);

    const count = await SystemSetting.countDocuments();
    expect(count).toBe(1);

    const read = await request(app).get('/api/settings').set('Authorization', `Bearer ${token}`);
    expect(read.body.data.institutionName).toBe('Greenfield University (Updated)');
    // fields not sent on the second update should be preserved, not wiped
    expect(read.body.data.institutionAddress).toBe('1 Campus Road');
  });

  it('rejects an invalid registrar email', async () => {
    const { token } = await loginAs(ROLES.ADMIN);
    const res = await request(app)
      .put('/api/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ institutionName: 'Valid Name', registrarEmail: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  it('records an audit entry for settings updates', async () => {
    const { token } = await loginAs(ROLES.ADMIN);
    await request(app).put('/api/settings').set('Authorization', `Bearer ${token}`).send({ institutionName: 'Audited University' });

    const { AuditLog } = await import('../src/models/AuditLog.js');
    const entry = await AuditLog.findOne({ action: 'settings_updated', module: 'SystemSetting' }).sort('-createdAt');
    expect(entry).not.toBeNull();
    expect(entry.newValue.institutionName).toBe('Audited University');
  });
});
