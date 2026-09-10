import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';

import { env } from './config/env.js';
import { swaggerSpec } from './config/swagger.js';
import { httpLogStream } from './config/logger.js';
import { sanitizeRequest } from './middleware/sanitize.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import facultyRoutes from './routes/facultyRoutes.js';
import departmentRoutes from './routes/departmentRoutes.js';
import sessionRoutes from './routes/sessionRoutes.js';
import semesterRoutes from './routes/semesterRoutes.js';
import levelRoutes from './routes/levelRoutes.js';
import gradingRuleRoutes from './routes/gradingRuleRoutes.js';
import courseRoutes from './routes/courseRoutes.js';
import studentRoutes from './routes/studentRoutes.js';
import verificationRoutes from './routes/verificationRoutes.js';
import resultRoutes from './routes/resultRoutes.js';
import transcriptRoutes from './routes/transcriptRoutes.js';
import auditLogRoutes from './routes/auditLogRoutes.js';
import systemSettingRoutes from './routes/systemSettingRoutes.js';
import backupRoutes from './routes/backupRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);

  const strictHelmet = helmet();
  const relaxedHelmet = helmet({ contentSecurityPolicy: false }); // swagger-ui-express serves inline <script> tags
  app.use((req, res, next) => (req.path.startsWith('/api/docs') ? relaxedHelmet(req, res, next) : strictHelmet(req, res, next)));

  app.use(
    cors({
      origin: env.clientUrl,
      credentials: true,
    })
  );
  app.use(compression());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));
  app.use(cookieParser());
  app.use(sanitizeRequest);

  if (!env.isTest) {
    app.use(morgan('combined', { stream: httpLogStream }));
  }

  app.get('/api/health', (req, res) => {
    res.status(200).json({ success: true, message: 'API is healthy', timestamp: new Date().toISOString() });
  });

  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/faculties', facultyRoutes);
  app.use('/api/departments', departmentRoutes);
  app.use('/api/sessions', sessionRoutes);
  app.use('/api/semesters', semesterRoutes);
  app.use('/api/levels', levelRoutes);
  app.use('/api/grading-rules', gradingRuleRoutes);
  app.use('/api/courses', courseRoutes);
  app.use('/api/students', studentRoutes);
  app.use('/api/verifications', verificationRoutes);
  app.use('/api/results', resultRoutes);
  app.use('/api/transcripts', transcriptRoutes);
  app.use('/api/audit-logs', auditLogRoutes);
  app.use('/api/settings', systemSettingRoutes);
  app.use('/api/backups', backupRoutes);
  app.use('/api/notifications', notificationRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
