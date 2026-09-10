import { z } from 'zod';
import { STUDENT_STATUSES } from '../models/Student.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

export const studentCreateSchema = z.object({
  matricNumber: z.string().trim().min(3, 'Matric number is required'),
  regNumber: z.string().trim().nullable().optional(),
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  otherNames: z.string().trim().nullable().optional(),
  gender: z.enum(['male', 'female', 'other']).nullable().optional(),
  dateOfBirth: z.coerce.date().nullable().optional(),
  department: objectId.nullable().optional(), // required unless the requester's role forces it server-side (see createStudent)
  entrySession: objectId,
  currentLevel: objectId,
  graduationSession: objectId.nullable().optional(),
  status: z.enum(Object.values(STUDENT_STATUSES)).optional(),
  contactEmail: z.string().trim().toLowerCase().email().nullable().optional().or(z.literal('')),
  contactPhone: z.string().trim().nullable().optional(),
});

export const studentUpdateSchema = studentCreateSchema.partial();

export const verificationResolveSchema = z.object({
  action: z.enum(['merge', 'distinct']),
  keep: z.enum(['student', 'matchedStudent']).optional(),
  notes: z.string().trim().optional(),
});
