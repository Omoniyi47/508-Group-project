import { z } from 'zod';
import { ROLES } from '../models/User.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

export const userCreateSchema = z
  .object({
    name: z.string().trim().min(2, 'Name is required'),
    email: z.string().trim().toLowerCase().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    role: z.enum(Object.values(ROLES)),
    department: objectId.nullable().optional(),
    confirmDuplicate: z.boolean().optional(),
  })
  .refine((data) => ![ROLES.RESULT_OFFICER, ROLES.HOD].includes(data.role) || !!data.department, {
    message: 'Department is required for this role',
    path: ['department'],
  });

export const userUpdateSchema = z
  .object({
    name: z.string().trim().min(2).optional(),
    role: z.enum(Object.values(ROLES)).optional(),
    department: objectId.nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => !data.role || ![ROLES.RESULT_OFFICER, ROLES.HOD].includes(data.role) || data.department !== null, {
    message: 'Department is required for this role',
    path: ['department'],
  });

export const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});
