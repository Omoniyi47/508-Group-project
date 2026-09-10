import { connectDB, disconnectDB } from '../config/db.js';
import { logger } from '../config/logger.js';
import { Course } from '../models/Course.js';
import { Department } from '../models/Department.js';

// Some historical student records use an earlier programme name. Keep their
// identity unchanged, but mirror the verified modern curriculum placements so
// result entry still shows the core and required courses they are entitled to.
const PROGRAMME_ALIASES = [
  { legacy: 'Computer Science', source: 'Computer Science and Cyber Security' },
];

async function run() {
  await connectDB();
  try {
    let synced = 0;
    for (const { legacy, source } of PROGRAMME_ALIASES) {
      const [legacyDepartment, sourceDepartment] = await Promise.all([
        Department.findOne({ name: legacy }),
        Department.findOne({ name: source }),
      ]);
      if (!legacyDepartment || !sourceDepartment) {
        logger.warn(`Skipped course alias ${legacy} <- ${source}: department not found.`);
        continue;
      }

      const sourceCourses = await Course.find({ department: sourceDepartment._id, isUndergraduate: true }).lean();
      const operations = sourceCourses.map(({ _id, __v, createdAt, updatedAt, department, ...course }) => {
        const record = { ...course, department: legacyDepartment._id };
        return {
          updateOne: {
            filter: {
              code: record.code,
              department: legacyDepartment._id,
              level: record.level,
              semester: record.semester,
              curriculumContext: record.curriculumContext || '',
              curriculumVersion: record.curriculumVersion || '',
            },
            update: { $set: record },
            upsert: true,
          },
        };
      });
      if (operations.length) {
        const result = await Course.bulkWrite(operations, { ordered: false });
        synced += result.upsertedCount + result.modifiedCount;
        logger.info(`${legacy}: ${sourceCourses.length} verified programme course placements synchronized from ${source}.`);
      }
    }
    logger.info(`Programme course alias synchronization complete: ${synced} placement(s) inserted or updated.`);
  } finally {
    await disconnectDB();
  }
}

run().catch((error) => {
  logger.error(`Programme course alias synchronization failed: ${error.stack}`);
  process.exit(1);
});
