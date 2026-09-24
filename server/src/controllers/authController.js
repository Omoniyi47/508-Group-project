import { User } from '../models/User.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { recordAudit, AUDIT_ACTIONS } from '../services/auditService.js';
import {
  signAccessToken,
  generateOpaqueToken,
  hashToken,
  refreshTokenExpiryDate,
  refreshCookieMaxAgeMs,
} from '../services/tokenService.js';
import { env } from '../config/env.js';

const REFRESH_COOKIE_NAME = 'refreshToken';

// sessionClient (client/src/api/axiosClient.js) only ever reaches this route
// through a same-origin proxy - Vite in dev, Vercel rewrites in production -
// so this cookie is first-party in both environments and never needs
// SameSite=None. `secure` must match whether the browser's own connection to
// the page is HTTPS: true in production, false for a local `npm run dev`
// server (plain http://localhost). A `Secure` cookie sent over that dev
// connection is silently dropped by the browser, which breaks session
// recovery on every reload - so this must not key off CLIENT_URL's scheme.
function refreshCookieOptions({ clear = false } = {}) {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    ...(clear ? {} : { maxAge: refreshCookieMaxAgeMs() }),
    path: '/api/auth',
  };
}

async function issueTokens(res, user, req) {
  const accessToken = signAccessToken(user);
  const rawRefreshToken = generateOpaqueToken();

  await RefreshToken.create({
    user: user._id,
    tokenHash: hashToken(rawRefreshToken),
    expiresAt: refreshTokenExpiryDate(),
    createdByIp: req.ip,
  });

  res.cookie(REFRESH_COOKIE_NAME, rawRefreshToken, refreshCookieOptions());
  return accessToken;
}

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+passwordHash');
  const passwordMatches = user ? await user.comparePassword(password) : false;

  if (!user || !passwordMatches) {
    await recordAudit(req, {
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      module: 'auth',
      reason: !user ? 'Unknown email' : 'Incorrect password',
    });
    throw ApiError.unauthorized('Invalid email or password');
  }

  if (!user.isActive) {
    throw ApiError.forbidden('This account has been deactivated. Contact an administrator.');
  }

  const accessToken = await issueTokens(res, user, req);
  user.lastLoginAt = new Date();
  await user.save();
  if (user.department) {
    await user.populate('department', 'name code');
  }

  await recordAudit(req, { action: AUDIT_ACTIONS.LOGIN_SUCCESS, module: 'auth', actorOverride: user });

  return sendSuccess(res, {
    message: 'Login successful',
    data: { accessToken, user },
  });
});

export const refresh = asyncHandler(async (req, res) => {
  const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!rawToken) {
    throw ApiError.unauthorized('No refresh token provided');
  }

  const tokenHash = hashToken(rawToken);
  // Atomically claim the token by flipping revokedAt away from null in the same
  // query that checks it. Two concurrent refresh requests replaying the same
  // single-use token could otherwise both pass a separate findOne+isActive()
  // check before either write landed, each minting a new session from one token.
  const stored = await RefreshToken.findOneAndUpdate(
    { tokenHash, revokedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { revokedAt: new Date() } }
  );

  if (!stored) {
    res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions({ clear: true }));
    throw ApiError.unauthorized('Refresh token is invalid or has expired');
  }

  const user = await User.findById(stored.user);
  if (!user || !user.isActive) {
    throw ApiError.unauthorized('Account is inactive or no longer exists');
  }
  if (user.department) {
    await user.populate('department', 'name code');
  }

  const accessToken = signAccessToken(user);
  const rawRefreshToken = generateOpaqueToken();
  const newTokenHash = hashToken(rawRefreshToken);
  await RefreshToken.updateOne({ _id: stored._id }, { replacedByTokenHash: newTokenHash });

  await RefreshToken.create({
    user: user._id,
    tokenHash: newTokenHash,
    expiresAt: refreshTokenExpiryDate(),
    createdByIp: req.ip,
  });

  res.cookie(REFRESH_COOKIE_NAME, rawRefreshToken, refreshCookieOptions());

  return sendSuccess(res, { message: 'Token refreshed', data: { accessToken, user } });
});

export const logout = asyncHandler(async (req, res) => {
  const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
  if (rawToken) {
    await RefreshToken.updateOne({ tokenHash: hashToken(rawToken) }, { revokedAt: new Date() });
  }
  res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions({ clear: true }));

  if (req.user) {
    await recordAudit(req, { action: AUDIT_ACTIONS.LOGOUT, module: 'auth' });
  }

  return sendSuccess(res, { message: 'Logged out successfully' });
});

export const me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (user.department) {
    await user.populate('department', 'name code');
  }
  return sendSuccess(res, { data: { user } });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select('+passwordHash');
  const matches = await user.comparePassword(currentPassword);
  if (!matches) {
    throw ApiError.badRequest('Current password is incorrect');
  }

  await user.setPassword(newPassword);
  user.mustChangePassword = false;
  await user.save();

  await recordAudit(req, { action: AUDIT_ACTIONS.PASSWORD_CHANGED, module: 'auth', entityId: user._id, entityModel: 'User' });

  return sendSuccess(res, { message: 'Password changed successfully' });
});
