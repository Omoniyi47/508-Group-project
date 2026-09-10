import { z } from 'zod';
import { COURSE_TYPES } from '../models/Course.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

export const facultyCreateSchema = z.object({
  name: z.string().trim().min(2, 'Name is required'),
  code: z.string().trim().min(1).max(10),
});
export const facultyUpdateSchema = facultyCreateSchema.partial();

export const departmentCreateSchema = z.object({
  name: z.string().trim().min(2, 'Name is required'),
  code: z.string().trim().min(1).max(10),
  faculty: objectId,
  hod: objectId.nullable().optional(),
});
export const departmentUpdateSchema = departmentCreateSchema.partial();

export const sessionCreateSchema = z
  .object({
    name: z.string().regex(/^\d{4}\/\d{4}$/, 'Session name must be in the form YYYY/YYYY'),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    isCurrent: z.boolean().optional(),
  })
  .refine((data) => data.endDate > data.startDate, { message: 'End date must be after start date', path: ['endDate'] });
export const sessionUpdateSchema = z.object({
  name: z.string().regex(/^\d{4}\/\d{4}$/, 'Session name must be in the form YYYY/YYYY').optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  isCurrent: z.boolean().optional(),
});

export const semesterCreateSchema = z.object({
  name: z.string().trim().min(2, 'Name is required'),
  order: z.coerce.number().int().min(1),
});
export const semesterUpdateSchema = semesterCreateSchema.partial();

export const levelCreateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  order: z.coerce.number().int().min(1),
});
export const levelUpdateSchema = levelCreateSchema.partial();

const gradeBandSchema = z.object({
  grade: z.string().trim().min(1),
  minScore: z.coerce.number().min(0).max(100),
  maxScore: z.coerce.number().min(0).max(100),
  point: z.coerce.number().min(0),
});

const classificationBandSchema = z.object({
  classification: z.string().trim().min(1),
  minCgpa: z.coerce.number().min(0),
  maxCgpa: z.coerce.number().min(0),
});

export const gradingRuleCreateSchema = z.object({
  name: z.string().trim().min(2, 'Name is required'),
  isActive: z.boolean().optional(),
  gradeBands: z.array(gradeBandSchema).min(1, 'At least one grade band is required'),
  classificationBands: z.array(classificationBandSchema).min(1, 'At least one classification band is required'),
});
export const gradingRuleUpdateSchema = gradingRuleCreateSchema.partial();

export const courseCreateSchema = z.object({
  code: z.string().trim().min(2, 'Course code is required'),
  title: z.string().trim().min(2, 'Title is required'),
  creditUnit: z.coerce.number().min(0).max(10).refine((value) => Number.isInteger(value * 2), 'Credit units must use whole or half units'),
  department: z.union([objectId, z.literal(''), z.null()]).optional().transform((value) => value || null),
  level: z.union([objectId, z.literal(''), z.null()]).optional().transform((value) => value || null),
  semester: z.union([objectId, z.literal(''), z.null()]).optional().transform((value) => value || null),
  curriculumContext: z.string().trim().max(180).optional(),
  curriculumVersion: z.string().trim().max(180).optional(),
  titleAliases: z.array(z.string().trim().min(2).max(200)).optional(),
  offeringDepartment: z.union([objectId, z.literal(''), z.null()]).optional().transform((value) => value || null),
  offeringUnit: z.string().trim().max(160).optional(),
  courseType: z.enum(Object.values(COURSE_TYPES)).optional(),
  isElective: z.boolean().optional(),
  isUndergraduate: z.boolean().optional(),
  isActive: z.boolean().optional(),
});
export const courseUpdateSchema = courseCreateSchema.partial();
