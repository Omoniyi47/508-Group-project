import { z } from 'zod';

export const manualResultSchema = z.object({
  student: z.string().min(1, 'Select a student'),
  course: z.string().min(1, 'Select a course'),
  session: z.string().min(1, 'Select a session'),
  semester: z.string().min(1, 'Select a semester'),
  level: z.string().min(1, 'Select a level'),
  score: z.coerce.number().min(0, 'Score must be at least 0').max(100, 'Score cannot exceed 100'),
});

export const rejectResultSchema = z.object({
  reason: z.string().trim().min(3, 'A rejection reason is required'),
});
