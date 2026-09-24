import { z } from 'zod';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

export const createTranscriptRequestSchema = z.object({
  student: objectId,
  purpose: z.string().trim().optional(),
  retrievalMethod: z.enum(['manual', 'online']).default('online'),
});

export const rejectTranscriptRequestSchema = z.object({
  reason: z.string().trim().min(3, 'A rejection reason is required'),
});

export const collectTranscriptRequestSchema = z.object({
  collectedByName: z.string().trim().min(2, 'Collector name is required').max(150),
  collectionReference: z.string().trim().min(3, 'Collection receipt/reference is required').max(150),
});
