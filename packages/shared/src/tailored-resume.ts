import { z } from "zod";
import { calendarDateSchema } from "./profile.js";

function trimmedString(min: number, max: number) {
  return z.string().trim().min(min).max(max);
}

const sourceIdSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);

const urlSchema = trimmedString(1, 500).refine((value) => {
  const UrlCtor = (globalThis as { URL?: new (input: string) => { protocol: string } }).URL;
  if (UrlCtor === undefined) {
    return false;
  }
  try {
    const url = new UrlCtor(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
});

const skillItemSchema = z
  .object({
    sourceId: sourceIdSchema,
    name: trimmedString(1, 80),
  })
  .strict();

const experienceItemSchema = z
  .object({
    sourceId: sourceIdSchema,
    employer: trimmedString(1, 200),
    jobTitle: trimmedString(1, 200),
    startDate: calendarDateSchema,
    endDate: calendarDateSchema.nullable(),
    accomplishments: z.array(trimmedString(1, 500)).max(20),
    technologies: z.array(trimmedString(1, 80)).max(30),
  })
  .strict();

const projectItemSchema = z
  .object({
    sourceId: sourceIdSchema,
    name: trimmedString(1, 200),
    description: trimmedString(1, 2000),
    url: urlSchema.nullable(),
    startDate: calendarDateSchema.nullable(),
    endDate: calendarDateSchema.nullable(),
    accomplishments: z.array(trimmedString(1, 500)).max(20),
    technologies: z.array(trimmedString(1, 80)).max(30),
  })
  .strict();

const educationItemSchema = z
  .object({
    sourceId: sourceIdSchema,
    institution: trimmedString(1, 200),
    degree: trimmedString(1, 200),
    fieldOfStudy: trimmedString(1, 200),
    startDate: calendarDateSchema,
    endDate: calendarDateSchema.nullable(),
  })
  .strict();

const certificationItemSchema = z
  .object({
    sourceId: sourceIdSchema,
    name: trimmedString(1, 200),
    issuer: trimmedString(1, 200),
    issuedOn: calendarDateSchema,
    expiresOn: calendarDateSchema.nullable(),
  })
  .strict();

export const tailoredResumeSchema = z
  .object({
    skills: z.array(skillItemSchema).max(50),
    experience: z.array(experienceItemSchema).max(50),
    projects: z.array(projectItemSchema).max(50),
    education: z.array(educationItemSchema).max(50),
    certifications: z.array(certificationItemSchema).max(50),
  })
  .strict();

export type TailoredResume = z.infer<typeof tailoredResumeSchema>;
