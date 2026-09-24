import { z } from 'zod';
import { ENTRY_MODE_OPTIONS } from '../constants/student';

const studentBaseSchema = z.object({
  matricNumber: z.string().trim().min(3, 'Matric number is required'),
  regNumber: z.string().trim().optional().or(z.literal('')),
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  otherNames: z.string().trim().optional().or(z.literal('')),
  gender: z.enum(['male', 'female', 'other']).optional().or(z.literal('')),
  dateOfBirth: z.string().optional().or(z.literal('')),
  entrySession: z.string().min(1, 'Entry session is required'),
  modeOfEntry: z.enum(ENTRY_MODE_OPTIONS.map((option) => option.value)).optional().or(z.literal('')),
  currentLevel: z.string().min(1, 'Current level is required'),
  graduationSession: z.string().optional().or(z.literal('')),
  status: z.string().optional(),
  contactEmail: z.string().trim().toLowerCase().email('Invalid email').optional().or(z.literal('')),
  contactPhone: z.string().trim().optional().or(z.literal('')),
});

// The server requires a department on create for every role (result officers
// have theirs filled in automatically) but allows it to be cleared on update.
export const studentCreateSchema = studentBaseSchema.extend({
  department: z.string().min(1, 'Department is required'),
});

export const studentUpdateSchema = studentBaseSchema.extend({
  department: z.string().optional().or(z.literal('')),
});
