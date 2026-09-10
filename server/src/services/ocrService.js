import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

const MATRIC_ALIASES = ['matric', 'matricnumber', 'matricno', 'regnumber', 'regno', 'registrationnumber'];
const SCORE_ALIASES = ['score', 'marks', 'mark', 'result', 'total'];
const NAME_ALIASES = ['name', 'fullname', 'studentname', 'studentfullname'];

function normalizeHeader(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function textFromAnchor(fullText, anchor) {
  if (!anchor?.textSegments?.length) return '';
  return anchor.textSegments
    .map((segment) => fullText.slice(Number(segment.startIndex || 0), Number(segment.endIndex || 0)))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

function confidencePercent(...cells) {
  const values = cells
    .map((cell) => Number(cell?.layout?.confidence))
    .filter((value) => Number.isFinite(value) && value >= 0)
    .map((value) => (value <= 1 ? value * 100 : value));
  if (!values.length) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

function headerIndex(headers, aliases) {
  return headers.findIndex((header) => aliases.includes(normalizeHeader(header)));
}

function detectMimeType(file) {
  if (file.mimetype && file.mimetype !== 'application/octet-stream') return file.mimetype;
  const name = file.originalname.toLowerCase();
  if (name.endsWith('.pdf')) return 'application/pdf';
  if (/\.jpe?g$/.test(name)) return 'image/jpeg';
  if (name.endsWith('.png')) return 'image/png';
  if (/\.tiff?$/.test(name)) return 'image/tiff';
  if (name.endsWith('.webp')) return 'image/webp';
  throw ApiError.badRequest('Could not determine the scanned file type');
}

function googleConfig() {
  const config = env.ocr.google;
  if (env.ocr.provider !== 'google_document_ai') {
    throw new ApiError(503, 'OCR is not enabled. Ask an administrator to configure Google Document AI in the server environment.');
  }
  if (!config.projectId || !config.location || !config.processorId || !config.serviceAccountJsonBase64) {
    throw new ApiError(503, 'OCR is not fully configured. Set the Google Document AI project, location, processor, and service-account configuration.');
  }

  try {
    const credentials = JSON.parse(Buffer.from(config.serviceAccountJsonBase64, 'base64').toString('utf8'));
    if (!credentials.client_email || !credentials.private_key) throw new Error('missing account fields');
    return { ...config, credentials };
  } catch {
    throw new ApiError(503, 'The Google Document AI service-account configuration is invalid.');
  }
}

async function getGoogleAccessToken(credentials) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign(
    {
      iss: credentials.client_email,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      aud: 'https://oauth2.googleapis.com/token',
      iat: issuedAt,
      exp: issuedAt + 3600,
    },
    credentials.private_key,
    { algorithm: 'RS256' }
  );

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    throw new ApiError(502, 'The OCR provider could not authenticate the configured service account.');
  }
  return data.access_token;
}

function rowsFromGoogleDocument(document) {
  const fullText = document?.text || '';
  const rows = [];
  let tableCount = 0;

  for (const page of document?.pages || []) {
    for (const table of page.tables || []) {
      tableCount += 1;
      let headers = (table.headerRows || []).at(-1)?.cells?.map((cell) => textFromAnchor(fullText, cell.layout?.textAnchor)) || [];
      let bodyRows = table.bodyRows || [];

      // Some old result sheets have no formal table-header annotation. In that
      // case, use the first visual row only when it clearly identifies the two
      // fields needed for a safe result import.
      if (!headers.length && bodyRows.length) {
        headers = bodyRows[0].cells.map((cell) => textFromAnchor(fullText, cell.layout?.textAnchor));
        bodyRows = bodyRows.slice(1);
      }

      const matricIndex = headerIndex(headers, MATRIC_ALIASES);
      const scoreIndex = headerIndex(headers, SCORE_ALIASES);
      const nameIndex = headerIndex(headers, NAME_ALIASES);
      if (matricIndex < 0 || scoreIndex < 0) continue;

      for (const tableRow of bodyRows) {
        const cells = tableRow.cells || [];
        const matricCell = cells[matricIndex];
        const scoreCell = cells[scoreIndex];
        const nameCell = nameIndex >= 0 ? cells[nameIndex] : null;
        const matricNumber = textFromAnchor(fullText, matricCell?.layout?.textAnchor);
        const score = textFromAnchor(fullText, scoreCell?.layout?.textAnchor).replace(/[^0-9.\-]/g, '');
        const fullName = textFromAnchor(fullText, nameCell?.layout?.textAnchor);

        // Ignore genuinely blank table rows, while leaving partially-read rows
        // for the staff review screen to report and correct.
        if (!matricNumber && !score && !fullName) continue;
        rows.push({
          matricNumber,
          score,
          fullName,
          ocrConfidence: confidencePercent(matricCell, scoreCell, nameCell),
        });
      }
    }
  }

  if (!rows.length) {
    throw ApiError.badRequest(
      'OCR could not find a result table with both a matric-number and score column. Use a clearer scan or correct the sheet into CSV/Excel instead.'
    );
  }

  const confidenceValues = rows.map((row) => row.ocrConfidence).filter((value) => value !== null);
  return {
    rows,
    pageCount: document?.pages?.length || 0,
    tableCount,
    averageConfidence: confidenceValues.length
      ? Math.round((confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length) * 10) / 10
      : null,
  };
}

/**
 * Sends a scan to the configured table-aware OCR provider and returns only
 * extracted draft data. It never creates Result records or stores the scan.
 */
export async function extractResultRowsFromScan(file) {
  const config = googleConfig();
  const accessToken = await getGoogleAccessToken(config.credentials);
  const endpoint = `https://${config.location}-documentai.googleapis.com/v1/projects/${encodeURIComponent(config.projectId)}/locations/${encodeURIComponent(config.location)}/processors/${encodeURIComponent(config.processorId)}:process`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      rawDocument: {
        content: file.buffer.toString('base64'),
        mimeType: detectMimeType(file),
      },
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.document) {
    throw new ApiError(502, 'The OCR provider could not process this scan. Check scan quality and the configured processor.');
  }
  return { provider: 'google_document_ai', ...rowsFromGoogleDocument(data.document) };
}
