import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { TextractClient, StartDocumentAnalysisCommand, GetDocumentAnalysisCommand } from '@aws-sdk/client-textract';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { ApiError } from '../utils/ApiError.js';

const MATRIC_ALIASES = ['matric', 'matricnumber', 'matricno', 'regnumber', 'regno', 'registrationnumber'];
const SCORE_ALIASES = ['score', 'marks', 'mark', 'result', 'total'];
const NAME_ALIASES = ['name', 'fullname', 'studentname', 'studentfullname'];
const POLL_INTERVAL_MS = 2000;

function normalizeHeader(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function childrenOf(block, blocks) {
  return (block?.Relationships || [])
    .filter((relationship) => relationship.Type === 'CHILD')
    .flatMap((relationship) => relationship.Ids || [])
    .map((id) => blocks.get(id)).filter(Boolean);
}

function cellText(cell, blocks) {
  return childrenOf(cell, blocks).filter((block) => block.BlockType === 'WORD')
    .map((block) => block.Text || '').join(' ').replace(/\s+/g, ' ').trim();
}

function confidencePercent(...cells) {
  // Textract already returns percentages, including values below 1%.
  const values = cells.map((cell) => cell?.Confidence)
    .filter((value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100);
  if (!values.length) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 10) / 10;
}

function rowsFromTextract(document) {
  const blocks = new Map(document.Blocks.map((block) => [block.Id, block]));
  const tables = document.Blocks.filter((block) => block.BlockType === 'TABLE');
  const rows = [];

  for (const table of tables) {
    const tableRows = new Map();
    for (const cell of childrenOf(table, blocks).filter((block) => block.BlockType === 'CELL')) {
      if (!tableRows.has(cell.RowIndex)) tableRows.set(cell.RowIndex, new Map());
      tableRows.get(cell.RowIndex).set(cell.ColumnIndex, cell);
    }
    let columns;
    for (const [, cells] of [...tableRows].sort(([a], [b]) => a - b)) {
      const findColumn = (aliases) => [...cells].find(([, cell]) => aliases.includes(normalizeHeader(cellText(cell, blocks))))?.[0];
      const matricColumn = findColumn(MATRIC_ALIASES);
      const scoreColumn = findColumn(SCORE_ALIASES);
      // Skip title rows and repeated headers, and never guess column positions.
      if (matricColumn !== undefined && scoreColumn !== undefined) {
        columns = { matric: matricColumn, score: scoreColumn, name: findColumn(NAME_ALIASES) };
        continue;
      }
      if (!columns) continue;
      if ([...cells.values()].some((cell) => cell.EntityTypes?.some((type) =>
        ['TABLE_TITLE', 'TABLE_FOOTER', 'TABLE_SECTION_TITLE', 'TABLE_SUMMARY', 'COLUMN_HEADER'].includes(type)))) continue;

      const matricCell = cells.get(columns.matric);
      const scoreCell = cells.get(columns.score);
      const nameCell = cells.get(columns.name);
      const matricNumber = cellText(matricCell, blocks);
      const score = cellText(scoreCell, blocks).replace(/[^0-9.-]/g, '');
      const fullName = cellText(nameCell, blocks);
      // Keep incomplete rows for the existing staff correction/validation flow.
      if (!matricNumber && !score && !fullName) continue;
      rows.push({ matricNumber, score, fullName, ocrConfidence: confidencePercent(matricCell, scoreCell, nameCell) });
    }
  }

  if (!rows.length) {
    throw ApiError.badRequest(
      'OCR could not find a result table with both a matric-number and score column. Use a clearer scan or correct the sheet into CSV/Excel instead.'
    );
  }
  const confidences = rows.map((row) => row.ocrConfidence).filter((value) => value !== null);
  return {
    rows,
    pageCount: document.DocumentMetadata?.Pages || document.Blocks.filter((block) => block.BlockType === 'PAGE').length,
    tableCount: tables.length,
    averageConfidence: confidences.length
      ? Math.round(confidences.reduce((sum, value) => sum + value, 0) / confidences.length * 10) / 10 : null,
  };
}

function textractConfig() {
  if (env.ocr.provider !== 'amazon_textract') {
    throw new ApiError(503, 'OCR is not enabled. Set OCR_PROVIDER=amazon_textract in the server environment.');
  }
  const config = env.ocr.textract;
  if (!config.region || !config.accessKeyId || !config.secretAccessKey || !config.bucket) {
    throw new ApiError(503, 'Amazon Textract is not fully configured. Set AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_TEXTRACT_S3_BUCKET.');
  }
  if (!Number.isInteger(config.timeoutMs) || config.timeoutMs <= 0 || config.timeoutMs > 600000) {
    throw new ApiError(503, 'OCR_TEXTRACT_TIMEOUT_MS must be an integer between 1 and 600000.');
  }
  return config;
}

async function prepareScan(file) {
  if (!file?.buffer?.length) throw ApiError.badRequest('A scanned PDF or image is required');
  if (file.buffer.length > 15 * 1024 * 1024) throw ApiError.badRequest('OCR scans must be no larger than 15MB');
  const formats = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', tif: 'image/tiff', tiff: 'image/tiff', webp: 'image/webp' };
  const extension = file.originalname?.split('.').at(-1)?.toLowerCase();
  const mimeType = !file.mimetype || file.mimetype === 'application/octet-stream' ? formats[extension] : file.mimetype;
  if (!Object.values(formats).includes(mimeType)) throw ApiError.badRequest('Only scanned PDF, PNG, JPG, TIFF, or WebP files are supported for OCR');

  // Preserve WebP and 15MB uploads. Asynchronous TIFF avoids Textract's 10MB
  // JPEG/PNG limit without reducing scan resolution.
  if (mimeType === 'image/webp' || (['image/png', 'image/jpeg'].includes(mimeType) && file.buffer.length > 10 * 1024 * 1024)) {
    try {
      const buffer = await sharp(file.buffer, { limitInputPixels: 100_000_000 })
        .rotate().flatten({ background: '#ffffff' }).tiff({ compression: 'lzw' }).toBuffer();
      return { buffer, mimeType: 'image/tiff', extension: 'tiff' };
    } catch {
      throw ApiError.badRequest('The scanned image could not be converted for Amazon Textract. Try a clear PDF, PNG, JPG, or TIFF scan.');
    }
  }
  return { buffer: file.buffer, mimeType, extension: Object.keys(formats).find((key) => formats[key] === mimeType) };
}

async function collectAnalysis(client, jobId, signal) {
  const document = { Blocks: [], DocumentMetadata: {} };
  let nextToken;
  do {
    const response = await client.send(new GetDocumentAnalysisCommand({ JobId: jobId, MaxResults: 1000, ...(nextToken ? { NextToken: nextToken } : {}) }), { abortSignal: signal });
    if (response.JobStatus === 'IN_PROGRESS') {
      await delay(POLL_INTERVAL_MS, undefined, { signal });
      continue;
    }
    if (response.JobStatus !== 'SUCCEEDED' || response.Warnings?.length) {
      throw new ApiError(502, 'Amazon Textract could not read the entire scan. Try a clearer scan or split it into smaller files. No partial extraction was imported.');
    }
    document.Blocks.push(...(response.Blocks || []));
    if (response.DocumentMetadata) document.DocumentMetadata = response.DocumentMetadata;
    nextToken = response.NextToken;
    if (!nextToken) return document;
  } while (!signal.aborted);
  signal.throwIfAborted();
}

function providerError(error) {
  if (error instanceof ApiError) return error;
  if (['AbortError', 'TimeoutError'].includes(error.name)) return new ApiError(504, 'Amazon Textract took too long to process this scan. Try a smaller file.');
  if (['AccessDenied', 'AccessDeniedException', 'InvalidAccessKeyId', 'SignatureDoesNotMatch', 'UnrecognizedClientException', 'ExpiredToken', 'ExpiredTokenException', 'InvalidS3ObjectException', 'NoSuchBucket'].includes(error.name)) {
    return new ApiError(503, 'Amazon Textract could not access its AWS credentials or S3 bucket. Check the server OCR configuration and AWS permissions.');
  }
  if (['UnsupportedDocumentException', 'BadDocumentException', 'DocumentTooLargeException'].includes(error.name)) {
    return ApiError.badRequest('Amazon Textract could not read this document. Use an unencrypted PDF or a clear supported image within the scan limits.');
  }
  return new ApiError(502, 'Amazon Textract could not process this scan. Please try again.');
}

/** Returns the same draft-row contract used by the existing preview/review flow. */
export async function extractResultRowsFromScan(file) {
  const config = textractConfig();
  const scan = await prepareScan(file);
  const clientOptions = {
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      ...(config.sessionToken ? { sessionToken: config.sessionToken } : {}),
    },
    maxAttempts: 3,
  };
  const s3 = new S3Client(clientOptions);
  const textract = new TextractClient(clientOptions);
  const key = `ocr-input/${randomUUID()}.${scan.extension}`;
  const signal = AbortSignal.timeout(config.timeoutMs);
  let versionId;
  try {
    const uploaded = await s3.send(new PutObjectCommand({
      Bucket: config.bucket, Key: key, Body: scan.buffer, ContentType: scan.mimeType, ServerSideEncryption: 'AES256',
    }), { abortSignal: signal });
    versionId = uploaded.VersionId;
    const started = await textract.send(new StartDocumentAnalysisCommand({
      DocumentLocation: { S3Object: { Bucket: config.bucket, Name: key, ...(versionId ? { Version: versionId } : {}) } },
      FeatureTypes: ['TABLES'],
      ClientRequestToken: randomUUID(),
    }), { abortSignal: signal });
    if (!started.JobId) throw new ApiError(502, 'Amazon Textract did not return a processing job. Please try again.');
    const document = await collectAnalysis(textract, started.JobId, signal);
    return { provider: 'amazon_textract', ...rowsFromTextract(document) };
  } catch (error) {
    throw providerError(error);
  } finally {
    // Also attempt deletion after an upload timeout: S3 may have accepted it.
    try {
      await s3.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key, ...(versionId ? { VersionId: versionId } : {}) }), { abortSignal: AbortSignal.timeout(10000) });
    } catch {
      logger.warn('Could not remove a temporary OCR scan from S3. Check the ocr-input/ bucket lifecycle and delete permissions.');
    }
    s3.destroy();
    textract.destroy();
  }
}
