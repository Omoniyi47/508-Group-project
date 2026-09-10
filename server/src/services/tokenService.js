import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { env } from '../config/env.js';

const DURATION_UNITS = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };

function parseDurationToMs(duration) {
  const match = /^(\d+)([smhd])$/.exec(duration);
  if (!match) throw new Error(`Invalid duration string: ${duration}`);
  const [, amount, unit] = match;
  return Number(amount) * DURATION_UNITS[unit];
}

export function signAccessToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), role: user.role, department: user.department?.toString() || null },
    env.jwt.accessSecret,
    { expiresIn: env.jwt.accessExpiresIn }
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.jwt.accessSecret);
}

export function generateOpaqueToken() {
  return crypto.randomBytes(40).toString('hex');
}

export function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function refreshTokenExpiryDate() {
  return new Date(Date.now() + parseDurationToMs(env.jwt.refreshExpiresIn));
}

export function refreshCookieMaxAgeMs() {
  return parseDurationToMs(env.jwt.refreshExpiresIn);
}
