import { connectDB, disconnectDB } from '../config/db.js';
import { logger } from '../config/logger.js';
import { Student } from '../models/Student.js';
import { nameForKey } from './nigerianNamesData.js';

// One-off repair for Student records created by importOauHistoricalResults.js
// before it assigned generated names: those records have matricNumber used
// as a literal firstName/lastName placeholder. This finds exactly that
// pattern (firstName === matricNumber) and replaces it with a generic
// Nigerian name, deterministic per matric number so re-running is a no-op.
//
// Usage: node src/seed/assignPlaceholderStudentNames.js [--apply]

async function run() {
  const apply = process.argv.includes('--apply');
  await connectDB();
  try {
    const placeholders = await Student.find({ $expr: { $eq: ['$firstName', '$matricNumber'] } });
    logger.info(`Found ${placeholders.length} students with a matric-number placeholder name.`);

    const operations = placeholders.map((student) => {
      const { firstName, otherNames, lastName } = nameForKey(student.matricNumber);
      return {
        updateOne: {
          filter: { _id: student._id },
          update: { $set: { firstName, otherNames, lastName } },
        },
      };
    });

    if (!apply) {
      logger.info(`DRY RUN — pass --apply to write. Sample reassignments:`);
      for (const student of placeholders.slice(0, 5)) {
        const name = nameForKey(student.matricNumber);
        logger.info(`  ${student.matricNumber} -> ${name.firstName} ${name.otherNames} ${name.lastName}`);
      }
      return;
    }

    const result = operations.length ? await Student.bulkWrite(operations, { ordered: false }) : null;
    logger.info(`Renamed ${result?.modifiedCount ?? 0} students.`);
  } finally {
    await disconnectDB();
  }
}

run().catch((error) => { logger.error(`Placeholder name assignment failed: ${error.stack}`); process.exit(1); });
