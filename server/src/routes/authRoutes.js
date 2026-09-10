import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { login, refresh, logout, me, changePassword } from '../controllers/authController.js';
import { validate } from '../middleware/validate.js';
import { protect } from '../middleware/auth.js';
import { loginSchema, changePasswordSchema } from '../validators/authValidators.js';
import { env } from '../config/env.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: env.loginRateLimit.windowMs,
  limit: env.loginRateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Please try again later.' },
});

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Log in with email and password
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Access token issued; refresh token set as an httpOnly cookie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string }
 *                 data:
 *                   type: object
 *                   properties:
 *                     accessToken: { type: string }
 *                     user: { type: object }
 *       401:
 *         description: Invalid credentials or deactivated account
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       429:
 *         description: Too many login attempts
 */
router.post('/login', loginLimiter, validate(loginSchema), login);

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Exchange the httpOnly refresh cookie for a new access token (and rotate the cookie)
 *     security: []
 *     responses:
 *       200:
 *         description: New access token issued
 *       401:
 *         description: Missing, invalid, expired, or already-rotated refresh token
 */
router.post('/refresh', refresh);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Revoke the current refresh token and clear the cookie
 *     security: []
 *     responses:
 *       200: { description: Logged out }
 */
router.post('/logout', logout);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get the current authenticated user's profile
 *     responses:
 *       200: { description: Current user }
 *       401: { description: Not authenticated }
 */
router.get('/me', protect, me);

/**
 * @openapi
 * /auth/change-password:
 *   post:
 *     tags: [Auth]
 *     summary: Change your own password (requires the current password)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword: { type: string }
 *               newPassword: { type: string, minLength: 8 }
 *     responses:
 *       200: { description: Password changed }
 *       400: { description: Current password incorrect, or validation failure }
 */
router.post('/change-password', protect, validate(changePasswordSchema), changePassword);

export default router;
