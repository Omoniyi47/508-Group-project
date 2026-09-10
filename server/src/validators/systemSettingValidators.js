import { z } from 'zod';

export const systemSettingUpdateSchema = z.object({
  institutionName: z.string().trim().min(2, 'Institution name is required'),
  institutionAddress: z.string().trim().optional(),
  registrarName: z.string().trim().optional(),
  registrarEmail: z.union([z.literal(''), z.string().trim().email('Invalid email address')]).optional(),
  registrarPhone: z.string().trim().optional(),
  transcriptFooterNote: z.string().trim().optional(),
  officialTranscriptWatermarkText: z.string().trim().max(120).optional(),
  officialTranscriptSealLabel: z.string().trim().max(120).optional(),
  specialElectiveRequiredUnits: z.coerce.number().int().min(0).max(60).optional(),
});
