import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { Notification } from '../src/models/Notification.js';
import { User, ROLES } from '../src/models/User.js';

const app = createApp();

async function loginUser(role = ROLES.RESULT_OFFICER) {
  const email = `${role}.${Date.now()}.${Math.random().toString(36).slice(2)}@test.edu`;
  const user = new User({ name: 'Notification Recipient', email, role, department: role === ROLES.RESULT_OFFICER ? '507f1f77bcf86cd799439011' : null });
  await user.setPassword('Password@123');
  await user.save();
  const login = await request(app).post('/api/auth/login').send({ email, password: 'Password@123' });
  return { user, token: login.body.data.accessToken };
}

describe('Notifications', () => {
  it('returns only the signed-in user’s unread notifications and can mark them read', async () => {
    const recipient = await loginUser(ROLES.ADMIN);
    const other = await loginUser(ROLES.ADMIN);
    const ownNotification = await Notification.create({
      recipient: recipient.user._id,
      title: 'Result awaiting approval',
      message: 'A submitted result needs review.',
      type: 'result_submitted',
      link: '/results?status=submitted',
    });
    await Notification.create({
      recipient: other.user._id,
      title: 'Private notification',
      message: 'This must not be visible to another user.',
      type: 'result_submitted',
    });

    const list = await request(app).get('/api/notifications').set('Authorization', `Bearer ${recipient.token}`);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.meta.unread).toBe(1);

    const markRead = await request(app)
      .patch(`/api/notifications/${ownNotification._id}/read`)
      .set('Authorization', `Bearer ${recipient.token}`);
    expect(markRead.status).toBe(200);
    expect(markRead.body.data.readAt).toBeTruthy();
  });
});
