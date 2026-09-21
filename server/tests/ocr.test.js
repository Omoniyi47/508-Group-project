import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TextractClient, StartDocumentAnalysisCommand, GetDocumentAnalysisCommand } from '@aws-sdk/client-textract';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { env } from '../src/config/env.js';
import { logger } from '../src/config/logger.js';
import { extractResultRowsFromScan } from '../src/services/ocrService.js';
import { textractTable, textractTestConfig } from './fixtures/textractTables.js';

const originalOcr = env.ocr;
const scan = { originalname: 'results.pdf', mimetype: 'application/pdf', buffer: Buffer.from('mock PDF sent only to mocked AWS') };
const defaultBlocks = () => textractTable('table-1', [
  ['Matric No.', 'Score', 'Student Name'], ['CSC/2023/001', '75', 'Ada Lovelace'],
]);
let s3Send;
let textractSend;

function analysisResponses(...responses) {
  textractSend.mockImplementation(async (command) => command instanceof StartDocumentAnalysisCommand
    ? { JobId: 'test-job' } : responses.shift());
}

beforeEach(() => {
  env.ocr = structuredClone(textractTestConfig);
  s3Send = vi.spyOn(S3Client.prototype, 'send').mockImplementation(async (command) =>
    command instanceof PutObjectCommand ? { VersionId: 'test-version' } : {});
  textractSend = vi.spyOn(TextractClient.prototype, 'send');
  analysisResponses({ JobStatus: 'SUCCEEDED', Blocks: defaultBlocks(), DocumentMetadata: { Pages: 1 } });
});

afterEach(() => {
  env.ocr = originalOcr;
  vi.restoreAllMocks();
});

describe('Amazon Textract OCR service', () => {
  it('returns the existing draft-row contract and deletes the exact uploaded version', async () => {
    const result = await extractResultRowsFromScan(scan);
    expect(result).toEqual({ provider: 'amazon_textract', pageCount: 1, tableCount: 1, averageConfidence: 98,
      rows: [{ matricNumber: 'CSC/2023/001', score: '75', fullName: 'Ada Lovelace', ocrConfidence: 98 }] });
    const upload = s3Send.mock.calls[0][0];
    expect(upload).toBeInstanceOf(PutObjectCommand);
    expect(upload.input).toMatchObject({ Bucket: 'test-ocr-bucket', Body: scan.buffer, ContentType: 'application/pdf', ServerSideEncryption: 'AES256' });
    expect(upload.input.Key).toMatch(/^ocr-input\/[a-f0-9-]+\.pdf$/);
    const start = textractSend.mock.calls[0][0];
    expect(start.input).toMatchObject({ FeatureTypes: ['TABLES'], DocumentLocation: { S3Object: {
      Bucket: 'test-ocr-bucket', Name: upload.input.Key, Version: 'test-version',
    } } });
    const deletion = s3Send.mock.calls.at(-1)[0];
    expect(deletion).toBeInstanceOf(DeleteObjectCommand);
    expect(deletion.input).toEqual({ Bucket: 'test-ocr-bucket', Key: upload.input.Key, VersionId: 'test-version' });
  });

  it('waits for completion and retrieves all blocks, including cross-response cell references', async () => {
    const blocks = [...defaultBlocks(), ...textractTable('table-2', [['Matric', 'Marks'], ['CSC/2023/002', '0']], { page: 2 })];
    analysisResponses(
      { JobStatus: 'IN_PROGRESS' },
      { JobStatus: 'SUCCEEDED', Blocks: blocks.slice(0, 2), NextToken: 'next-page', DocumentMetadata: { Pages: 2 } },
      { JobStatus: 'SUCCEEDED', Blocks: blocks.slice(2), DocumentMetadata: { Pages: 2 } },
    );
    const result = await extractResultRowsFromScan(scan);
    expect(result).toMatchObject({ pageCount: 2, tableCount: 2, rows: [
      { matricNumber: 'CSC/2023/001', score: '75' }, { matricNumber: 'CSC/2023/002', score: '0' },
    ] });
    expect(textractSend.mock.calls.at(-1)[0]).toBeInstanceOf(GetDocumentAnalysisCommand);
    expect(textractSend.mock.calls.at(-1)[0].input.NextToken).toBe('next-page');
  });

  it('uses row/column indexes, skips title/repeated header rows, and retains incomplete rows', async () => {
    const blocks = textractTable('table', [
      ['Transcript results', '', ''], ['Score', 'Student Name', 'Registration Number'],
      ['62.5', 'Ada Lovelace', 'CSC/001'], ['Score', 'Student Name', 'Registration Number'],
      [null, 'Grace Hopper', 'CSC/002'], ['', '', ''],
    ]).reverse();
    analysisResponses({ JobStatus: 'SUCCEEDED', Blocks: blocks, DocumentMetadata: { Pages: 1 } });
    const result = await extractResultRowsFromScan(scan);
    expect(result.rows).toEqual([
      { matricNumber: 'CSC/001', score: '62.5', fullName: 'Ada Lovelace', ocrConfidence: 98 },
      { matricNumber: 'CSC/002', score: '', fullName: 'Grace Hopper', ocrConfidence: 98 },
    ]);
  });

  it('does not turn Textract confidence below one percent into a high confidence', async () => {
    analysisResponses({ JobStatus: 'SUCCEEDED', Blocks: textractTable('table', [['Matric', 'Score'], ['CSC/001', '70']], { confidence: 0.7 }) });
    expect((await extractResultRowsFromScan(scan)).averageConfidence).toBe(0.7);
  });

  it('keeps absent confidence unknown', async () => {
    const blocks = defaultBlocks().map(({ Confidence: _confidence, ...block }) => block);
    analysisResponses({ JobStatus: 'SUCCEEDED', Blocks: blocks });
    const result = await extractResultRowsFromScan(scan);
    expect(result.averageConfidence).toBeNull();
    expect(result.rows[0].ocrConfidence).toBeNull();
  });

  it('rejects tables without both required column headings and still deletes the scan', async () => {
    analysisResponses({ JobStatus: 'SUCCEEDED', Blocks: textractTable('table', [['Name', 'Grade'], ['Ada', 'A']]) });
    await expect(extractResultRowsFromScan(scan)).rejects.toMatchObject({ statusCode: 400 });
    expect(s3Send.mock.calls.at(-1)[0]).toBeInstanceOf(DeleteObjectCommand);
  });

  it.each(['FAILED', 'PARTIAL_SUCCESS'])('rejects %s jobs instead of importing partial records', async (JobStatus) => {
    analysisResponses({ JobStatus, Blocks: defaultBlocks() });
    await expect(extractResultRowsFromScan(scan)).rejects.toMatchObject({ statusCode: 502 });
    expect(s3Send.mock.calls.at(-1)[0]).toBeInstanceOf(DeleteObjectCommand);
  });

  it('rejects successful jobs with page warnings', async () => {
    analysisResponses({ JobStatus: 'SUCCEEDED', Blocks: defaultBlocks(), Warnings: [{ ErrorCode: 'PAGE_ERROR', Pages: [2] }] });
    await expect(extractResultRowsFromScan(scan)).rejects.toMatchObject({ statusCode: 502 });
  });

  it('times out processing and uses a fresh signal to clean up the scan', async () => {
    env.ocr.textract.timeoutMs = 20;
    textractSend.mockImplementation(async (command) => command instanceof StartDocumentAnalysisCommand ? { JobId: 'test-job' } : { JobStatus: 'IN_PROGRESS' });
    await expect(extractResultRowsFromScan(scan)).rejects.toMatchObject({ statusCode: 504 });
    expect(s3Send.mock.calls[0][1].abortSignal.aborted).toBe(true);
    expect(s3Send.mock.calls.at(-1)[1].abortSignal.aborted).toBe(false);
  });

  it('reports missing credentials before contacting AWS', async () => {
    env.ocr.textract.secretAccessKey = '';
    await expect(extractResultRowsFromScan(scan)).rejects.toMatchObject({ statusCode: 503 });
    expect(s3Send).not.toHaveBeenCalled();
    expect(textractSend).not.toHaveBeenCalled();
  });

  it('keeps OCR optional', async () => {
    env.ocr.provider = 'none';
    await expect(extractResultRowsFromScan(scan)).rejects.toMatchObject({ statusCode: 503 });
    expect(s3Send).not.toHaveBeenCalled();
  });

  it('does not leak AWS error messages or credentials', async () => {
    textractSend.mockRejectedValue(Object.assign(new Error('SECRET_PROVIDER_DETAILS'), { name: 'AccessDeniedException' }));
    const error = await extractResultRowsFromScan(scan).catch((failure) => failure);
    expect(error.statusCode).toBe(503);
    expect(error.message).not.toContain('SECRET_PROVIDER_DETAILS');
    expect(s3Send.mock.calls.at(-1)[0]).toBeInstanceOf(DeleteObjectCommand);
  });

  it('attempts cleanup even when an upload fails after possibly reaching S3', async () => {
    s3Send.mockRejectedValueOnce(Object.assign(new Error('upload failure'), { name: 'TimeoutError' })).mockResolvedValueOnce({});
    await expect(extractResultRowsFromScan(scan)).rejects.toMatchObject({ statusCode: 504 });
    expect(s3Send.mock.calls.at(-1)[0]).toBeInstanceOf(DeleteObjectCommand);
    expect(textractSend).not.toHaveBeenCalled();
  });

  it('logs cleanup failure without discarding a successful draft', async () => {
    const warning = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    s3Send.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('cannot delete'));
    expect((await extractResultRowsFromScan(scan)).rows).toHaveLength(1);
    expect(warning).toHaveBeenCalledOnce();
  });

  it('converts WebP to TIFF while preserving image dimensions', async () => {
    const buffer = await sharp({ create: { width: 32, height: 48, channels: 3, background: 'white' } }).webp().toBuffer();
    await extractResultRowsFromScan({ originalname: 'scan.webp', mimetype: 'image/webp', buffer });
    const upload = s3Send.mock.calls[0][0].input;
    expect(upload.ContentType).toBe('image/tiff');
    expect(await sharp(upload.Body).metadata()).toMatchObject({ format: 'tiff', width: 32, height: 48 });
  });

  it('preserves the 15MB upload contract by converting images above the Textract JPEG/PNG limit', async () => {
    const png = await sharp({ create: { width: 32, height: 32, channels: 3, background: 'white' } }).png().toBuffer();
    const buffer = Buffer.concat([png, Buffer.alloc(10 * 1024 * 1024)]);
    await extractResultRowsFromScan({ originalname: 'large.png', mimetype: 'image/png', buffer });
    expect(s3Send.mock.calls[0][0].input.ContentType).toBe('image/tiff');
  });

  it('rejects corrupt WebP input before uploading anything', async () => {
    await expect(extractResultRowsFromScan({ ...scan, originalname: 'broken.webp', mimetype: 'image/webp' })).rejects.toMatchObject({ statusCode: 400 });
    expect(s3Send).not.toHaveBeenCalled();
  });
});
