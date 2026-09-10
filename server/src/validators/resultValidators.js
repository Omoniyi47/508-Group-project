import { z } from 'zod';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

export const resultCreateSchema = z.object({
  student: objectId,
  course: objectId,
  session: objectId,
  semester: objectId,
  level: objectId,
  score: z.coerce.number().min(0, 'Score must be at least 0').max(100, 'Score cannot exceed 100'),
});

export const resultUpdateSchema = z.object({
  score: z.coerce.number().min(0).max(100),
});

export const rejectResultSchema = z.object({
  reason: z.string().trim().min(3, 'A rejection reason is required'),
});

export const submitBatchSchema = z.object({
  ids: z.array(objectId).min(1, 'At least one result id is required'),
});

export const uploadContextSchema = z.object({
  course: objectId,
  session: objectId,
  semester: objectId,
  level: objectId,
});

export const ocrBatchRowUpdateSchema = z
  .object({
    matricNumber: z.string().trim().min(1, 'Matric number is required').optional(),
    score: z.coerce.number().min(0, 'Score must be at least 0').max(100, 'Score cannot exceed 100').optional(),
  })
  .refine((data) => data.matricNumber !== undefined || data.score !== undefined, {
    message: 'Provide a matric number or score to correct',
  });
