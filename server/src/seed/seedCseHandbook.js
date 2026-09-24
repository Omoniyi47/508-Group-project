import { connectDB, disconnectDB } from '../config/db.js';
import { seedCseHandbook } from './cseHandbookData.js';

try {
  await connectDB();
  console.log('CSE handbook import:', await seedCseHandbook({ dryRun: !process.argv.includes('--apply') }));
} catch (error) {
  console.error('CSE handbook import failed:', error.message);
  process.exitCode = 1;
} finally { await disconnectDB(); }
