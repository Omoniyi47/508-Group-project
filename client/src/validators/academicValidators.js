import { z } from 'zod';

export const facultySchema = z.object({
  name: z.string().trim().min(2, 'Name is required'),
  code: z.string().trim().min(1, 'Code is required').max(10),
});

export const departmentSchema = z.object({
  name: z.string().trim().min(2, 'Name is required'),
  code: z.string().trim().min(1, 'Code is required').max(10),
  faculty: z.string().min(1, 'Faculty is required'),
});

export const sessionSchema = z
  .object({
    name: z.string().regex(/^\d{4}\/\d{4}$/, 'Format must be YYYY/YYYY'),
    startDate: z.string().min(1, 'Start date is required'),
    endDate: z.string().min(1, 'End date is required'),
    isCurrent: z.boolean().optional(),
  })
  .refine((data) => new Date(data.endDate) > new Date(data.startDate), {
    message: 'End date must be after start date',
    path: ['endDate'],
  });

export const semesterSchema = z.object({
  name: z.string().trim().min(2, 'Name is required'),
  order: z.coerce.number().int().min(1, 'Order must be at least 1'),
});

export const levelSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  order: z.coerce.number().int().min(1, 'Order must be at least 1'),
});

const gradeBandSchema = z.object({
  grade: z.string().trim().min(1, 'Required'),
  minScore: z.coerce.number().min(0).max(100),
  maxScore: z.coerce.number().min(0).max(100),
  point: z.coerce.number().min(0),
});

const classificationBandSchema = z.object({
  classification: z.string().trim().min(1, 'Required'),
  minCgpa: z.coerce.number().min(0),
  maxCgpa: z.coerce.number().min(0),
});

export const gradingRuleSchema = z.object({
  name: z.string().trim().min(2, 'Name is required'),
  isActive: z.boolean().optional(),
  gradeBands: z.array(gradeBandSchema).min(1, 'At least one grade band is required'),
  classificationBands: z.array(classificationBandSchema).min(1, 'At least one classification band is required'),
});

export const courseSchema = z.object({
  code: z.string().trim().min(2, 'Course code is required'),
  title: z.string().trim().min(2, 'Title is required'),
  creditUnit: z.coerce.number().min(0, 'Credit units cannot be negative').max(10).refine((value) => Number.isInteger(value * 2), 'Use whole or half credit units'),
  department: z.string().optional(),
  level: z.string().optional(),
  semester: z.string().optional(),
  curriculumContext: z.string().trim().max(180).optional(),
  curriculumVersion: z.string().trim().max(180).optional(),
  offeringDepartment: z.string().optional(),
  offeringUnit: z.string().trim().max(160).optional(),
  courseType: z.enum(['core', 'elective', 'restricted_elective', 'special_elective', 'practicum', 'industrial_training', 'project', 'other']).optional(),
  isElective: z.boolean().optional(),
  isUndergraduate: z.boolean().optional(),
  isActive: z.boolean().optional(),
});
