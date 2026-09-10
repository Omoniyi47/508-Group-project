import fs from 'node:fs';
import path from 'node:path';
import { ZipArchive } from 'archiver';
import mongoose from 'mongoose';

const BACKUPS_DIR = path.resolve('backups');
const EXCLUDED_MODELS = new Set(['RefreshToken', 'Backup']);

function ensureBackupsDir() {
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }
}

export function getBackupModelNames() {
  return mongoose.connection.modelNames().filter((name) => !EXCLUDED_MODELS.has(name));
}

export async function createBackupArchive() {
  ensureBackupsDir();

  const fileName = `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`;
  const filePath = path.join(BACKUPS_DIR, fileName);
  const modelNames = getBackupModelNames();

  const output = fs.createWriteStream(filePath);
  const archive = new ZipArchive({ zlib: { level: 9 } });

  const finished = new Promise((resolve, reject) => {
    output.on('close', resolve);
    archive.on('error', reject);
    output.on('error', reject);
  });

  archive.pipe(output);

  for (const modelName of modelNames) {
    const Model = mongoose.model(modelName);
    const docs = await Model.find().lean();
    archive.append(JSON.stringify(docs, null, 2), { name: `${modelName}.json` });
  }

  await archive.finalize();
  await finished;

  const { size } = fs.statSync(filePath);
  return { fileName, filePath, sizeBytes: size };
}

export function getBackupFilePath(fileName) {
  const resolved = path.join(BACKUPS_DIR, fileName);
  if (path.dirname(resolved) !== BACKUPS_DIR) {
    throw new Error('Invalid backup file name');
  }
  return resolved;
}
