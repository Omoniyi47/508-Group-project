import { connectDB, disconnectDB } from '../config/db.js';
import { seedStudentReferenceData } from './studentReferenceData.js';

try {
  await connectDB();
  console.log('Student reference data:', await seedStudentReferenceData());
} catch (error) {
  console.error('Student reference setup failed:', error.message);
  process.exitCode = 1;
} finally {
  await disconnectDB();
}
