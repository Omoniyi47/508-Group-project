import { connectDB, disconnectDB } from '../config/db.js';
import { seedGradingRule } from './gradingRuleData.js';

try {
  await connectDB();
  console.log('Grading rule:', await seedGradingRule());
} catch (error) {
  console.error('Grading rule seed failed:', error.message);
  process.exitCode = 1;
} finally {
  await disconnectDB();
}
