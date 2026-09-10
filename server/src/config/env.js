import dotenv from 'dotenv';

// quiet: true suppresses dotenv's own promotional console tips on every load
dotenv.config({ quiet: true });

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function defined(name) {
  const value = process.env[name];
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function requiredNumber(name) {
  const value = Number(required(name));
  if (!Number.isFinite(value)) {
    throw new Error(`Environment variable ${name} must be a number`);
  }
  return value;
}

const nodeEnv = required('NODE_ENV');

export const env = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  isTest: nodeEnv === 'test',
  port: requiredNumber('PORT'),
  clientUrl: required('CLIENT_URL'),

  mongoUri: required('MONGO_URI'),

  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET'),
    accessExpiresIn: required('JWT_ACCESS_EXPIRES_IN'),
    refreshSecret: required('JWT_REFRESH_SECRET'),
    refreshExpiresIn: required('JWT_REFRESH_EXPIRES_IN'),
  },

  bcryptSaltRounds: requiredNumber('BCRYPT_SALT_ROUNDS'),

  loginRateLimit: {
    windowMs: requiredNumber('LOGIN_RATE_LIMIT_WINDOW_MS'),
    max: requiredNumber(nodeEnv === 'test' ? 'TEST_LOGIN_RATE_LIMIT_MAX' : 'LOGIN_RATE_LIMIT_MAX'),
  },

  logLevel: required('LOG_LEVEL'),

  systemSettings: {
    institutionName: required('SYSTEM_INSTITUTION_NAME'),
    institutionAddress: defined('SYSTEM_INSTITUTION_ADDRESS'),
    registrarName: process.env.SYSTEM_REGISTRAR_NAME || '',
    registrarEmail: defined('SYSTEM_REGISTRAR_EMAIL'),
    registrarPhone: defined('SYSTEM_REGISTRAR_PHONE'),
    transcriptFooterNote: required('SYSTEM_TRANSCRIPT_FOOTER_NOTE'),
  },

  // OCR is deliberately opt-in. The application remains usable without an
  // external OCR account; a scan attempt then returns a clear setup message.
  ocr: {
    provider: process.env.OCR_PROVIDER || 'none',
    google: {
      projectId: process.env.GOOGLE_DOCUMENT_AI_PROJECT_ID || '',
      location: process.env.GOOGLE_DOCUMENT_AI_LOCATION || '',
      processorId: process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID || '',
      serviceAccountJsonBase64: process.env.GOOGLE_DOCUMENT_AI_SERVICE_ACCOUNT_JSON_BASE64 || '',
    },
  },

  seed: {
    admin: {
      name: required('ADMIN_NAME'),
      email: required('ADMIN_EMAIL').trim().toLowerCase(),
      password: required('ADMIN_PASSWORD'),
    },
  },
};
