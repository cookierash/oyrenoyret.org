import { z } from 'zod';

export const contactMessageSchema = z.object({
  name: z.string().trim().max(100).optional(),
  email: z.string().trim().email().max(254),
  subject: z.string().trim().max(200).optional(),
  message: z.string().trim().min(1).max(5000),
});

export type ContactMessageInput = z.infer<typeof contactMessageSchema>;

