import { connectDB, disconnectDB } from '../config/db.js';
import { seedOfficialCourses } from './officialCourseData.js';

try {
  await connectDB();
  console.log('OAU official course import:', await seedOfficialCourses({ dryRun: !process.argv.includes('--apply') }));
} catch (error) {
  console.error('Course import failed:', error.message);
  process.exitCode = 1;
} finally {
  await disconnectDB();
}
