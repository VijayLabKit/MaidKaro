import { z } from 'zod';

export const updateCustomerProfileSchema = z.object({
  fullName: z.string().min(2).max(80).optional(),
  email: z.string().email().optional(),
});

export const createAddressSchema = z.object({
  label: z.string().min(2).max(40),
  line1: z.string().min(3).max(200),
  line2: z.string().max(200).optional(),
  pincode: z.string().regex(/^\d{6}$/, 'Indian PIN codes are 6 digits'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  isDefault: z.boolean().optional(),
});

export const updateAddressSchema = createAddressSchema.partial();
