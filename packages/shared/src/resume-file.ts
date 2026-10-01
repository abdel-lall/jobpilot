import { z } from "zod";

const timestampSchema = z.string().datetime();

const resumeFileNameSchema = z
  .string()
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,200}\.pdf$/i);

export const resumeFileSchema = z
  .object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    fileName: resumeFileNameSchema,
    contentType: z.literal("application/pdf"),
    byteSize: z.number().int().nonnegative(),
    createdAt: timestampSchema,
  })
  .strict();

export type ResumeFile = z.infer<typeof resumeFileSchema>;
