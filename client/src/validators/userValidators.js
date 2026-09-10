import { z } from 'zod';
import { ROLES } from '../constants/roles';

const DEPARTMENT_SCOPED_ROLES = [ROLES.RESULT_OFFICER, ROLES.HOD];

export const userCreateSchema = z
  .object({
    name: z.string().trim().min(2, 'Name is required'),
    email: z.string().trim().toLowerCase().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    role: z.enum(Object.values(ROLES), { message: 'Role is required' }),
    department: z.string().optional(),
  })
  .refine((data) => !DEPARTMENT_SCOPED_ROLES.includes(data.role) || !!data.department, {
    message: 'Department is required for this role',
    path: ['department'],
  });

export const userUpdateSchema = z
  .object({
    name: z.string().trim().min(2, 'Name is required'),
    role: z.enum(Object.values(ROLES), { message: 'Role is required' }),
    department: z.string().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => !DEPARTMENT_SCOPED_ROLES.includes(data.role) || !!data.department, {
    message: 'Department is required for this role',
    path: ['department'],
  });

export const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});
