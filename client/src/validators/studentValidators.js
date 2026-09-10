import { z } from 'zod';

export const studentSchema = z.object({
  matricNumber: z.string().trim().min(3, 'Matric number is required'),
  regNumber: z.string().trim().optional().or(z.literal('')),
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  otherNames: z.string().trim().optional().or(z.literal('')),
  gender: z.enum(['male', 'female', 'other']).optional().or(z.literal('')),
  dateOfBirth: z.string().optional().or(z.literal('')),
  department: z.string().optional().or(z.literal('')),
  entrySession: z.string().min(1, 'Entry session is required'),
  currentLevel: z.string().min(1, 'Current level is required'),
  graduationSession: z.string().optional().or(z.literal('')),
  status: z.string().optional(),
  contactEmail: z.string().trim().toLowerCase().email('Invalid email').optional().or(z.literal('')),
  contactPhone: z.string().trim().optional().or(z.literal('')),
});
