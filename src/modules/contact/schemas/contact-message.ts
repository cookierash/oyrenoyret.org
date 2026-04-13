import { z } from 'zod';

export const contactMessageSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  email: z.string().trim().email().max(254),
  subject: z.string().trim().min(1, 'Subject is required').max(200),
  message: z.string().trim().min(1).max(5000),
});

export type ContactMessageInput = z.infer<typeof contactMessageSchema>;
