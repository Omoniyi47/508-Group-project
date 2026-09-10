import multer from 'multer';
import { ApiError } from '../utils/ApiError.js';

const ALLOWED_MIME_TYPES = new Set([
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream', // some browsers send this for .csv
]);

const OCR_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/tiff',
  'image/webp',
  'application/octet-stream',
]);

const storage = multer.memoryStorage();

export const uploadResultFile = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const hasValidExtension = /\.(csv|xlsx?|)$/i.test(file.originalname);
    if (!ALLOWED_MIME_TYPES.has(file.mimetype) && !hasValidExtension) {
      return cb(ApiError.badRequest('Only CSV or Excel (.xlsx) files are supported'));
    }
    return cb(null, true);
  },
}).single('file');

export const uploadOcrResultFile = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const hasValidExtension = /\.(pdf|png|jpe?g|tiff?|webp)$/i.test(file.originalname);
    if (!OCR_MIME_TYPES.has(file.mimetype) && !hasValidExtension) {
      return cb(ApiError.badRequest('Only scanned PDF, PNG, JPG, TIFF, or WebP files are supported for OCR'));
    }
    return cb(null, true);
  },
}).single('file');
