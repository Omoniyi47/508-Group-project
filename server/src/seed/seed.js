import { connectDB, disconnectDB } from '../config/db.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { User, ROLES } from '../models/User.js';
import { Faculty } from '../models/Faculty.js';
import { Department } from '../models/Department.js';
import { SystemSetting } from '../models/SystemSetting.js';
import { ACADEMIC_STRUCTURE } from './academicStructureData.js';

async function seedAdministrator() {
  const { name, email, password } = env.seed.admin;
  const existing = await User.findOne({ email });

  if (existing) {
    logger.info(`Administrator already exists (${email}), skipping`);
    return;
  }

  const admin = new User({ name, email, role: ROLES.ADMIN });
  await admin.setPassword(password);
  await admin.save();
  logger.info(`Administrator created: ${email}`);
}

async function seedAcademicStructure() {
  let facultyCount = 0;
  let departmentCount = 0;

  for (const facultyData of ACADEMIC_STRUCTURE) {
    let faculty = await Faculty.findOne({ code: facultyData.code });
    if (!faculty) {
      faculty = await Faculty.create({ name: facultyData.name, code: facultyData.code });
      facultyCount += 1;
    }

    for (const [name, code] of facultyData.departments) {
      const existing = await Department.findOne({ $or: [{ code }, { name }] });
      if (existing) continue;
      await Department.create({ name, code, faculty: faculty._id });
      departmentCount += 1;
    }
  }

  logger.info(`${env.systemSettings.institutionName} academic structure ready: ${facultyCount} faculty/faculties and ${departmentCount} department(s) created.`);
}

async function seedSystemSettings() {
  const settings = await SystemSetting.getSingleton();
  const seededValues = {
    institutionName: env.systemSettings.institutionName,
    institutionAddress: env.systemSettings.institutionAddress,
    registrarName: env.systemSettings.registrarName,
    registrarEmail: env.systemSettings.registrarEmail,
    registrarPhone: env.systemSettings.registrarPhone,
    transcriptFooterNote: env.systemSettings.transcriptFooterNote,
  };
  // Populate first-run/default values without replacing later details entered
  // by an administrator from System Settings.
  const legacyDefaults = { institutionName: 'University Name' };
  let changed = false;
  for (const [key, value] of Object.entries(seededValues)) {
    if (!value) continue;
    if (!settings[key] || settings[key] === legacyDefaults[key]) {
      settings[key] = value;
      changed = true;
    }
  }
  if (changed) await settings.save();
  logger.info(`${env.systemSettings.institutionName} system settings ${changed ? 'initialized from environment defaults' : 'already configured; preserved administrator values'}.`);
}

async function run() {
  await connectDB();
  try {
    await seedAdministrator();
    await seedAcademicStructure();
    await seedSystemSettings();
    logger.info(`Seed complete for ${env.systemSettings.institutionName}. No staff users, students, results, courses, sessions, or grading rules were created.`);
  } finally {
    await disconnectDB();
  }
}

run().catch((err) => {
  logger.error(`Administrator seed failed: ${err.stack}`);
  process.exit(1);
});
