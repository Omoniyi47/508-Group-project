import { z } from 'zod';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

export const uploadTranscriptDocumentSchema = z.object({
  student: objectId,
  label: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(500).optional(),
});
