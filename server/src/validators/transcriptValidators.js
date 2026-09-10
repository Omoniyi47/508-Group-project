import { z } from 'zod';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

export const createTranscriptRequestSchema = z.object({
  student: objectId,
  purpose: z.string().trim().optional(),
});

export const rejectTranscriptRequestSchema = z.object({
  reason: z.string().trim().min(3, 'A rejection reason is required'),
});
