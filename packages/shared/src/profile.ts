import { z } from "zod";

export const calendarDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const year = Number(value.slice(0, 4));
    const month = Number(value.slice(5, 7));
    const day = Number(value.slice(8, 10));
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  });

function trimmedString(min: number, max: number) {
  return z.string().trim().min(min).max(max);
}

const technologySchema = trimmedString(1, 80);
const accomplishmentSchema = trimmedString(1, 500);

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

const timestampSchema = z.string().datetime();

function hasAtLeastOneField(body: object): boolean {
  return Object.keys(body).length >= 1;
}

function rangeIsValid(start: string | null | undefined, end: string | null | undefined): boolean {
  if (start == null || end == null) {
    return true;
  }
  return end >= start;
}

export const skillSchema = z
  .object({
    id: z.string(),
    userId: z.string(),
    name: z.string(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

export const createSkillBodySchema = z
  .object({
    name: trimmedString(1, 80),
  })
  .strict();

export const updateSkillBodySchema = z
  .object({
    name: trimmedString(1, 80).optional(),
  })
  .strict()
  .refine(hasAtLeastOneField);

export const educationSchema = z
  .object({
    id: z.string(),
    userId: z.string(),
    institution: z.string(),
    degree: z.string(),
    fieldOfStudy: z.string(),
    startDate: calendarDateSchema,
    endDate: calendarDateSchema.nullable(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

export const createEducationBodySchema = z
  .object({
    institution: trimmedString(1, 200),
    degree: trimmedString(1, 200),
    fieldOfStudy: trimmedString(1, 200),
    startDate: calendarDateSchema,
    endDate: calendarDateSchema.nullable().optional(),
  })
  .strict()
  .refine((body) => rangeIsValid(body.startDate, body.endDate));

export const updateEducationBodySchema = z
  .object({
    institution: trimmedString(1, 200).optional(),
    degree: trimmedString(1, 200).optional(),
    fieldOfStudy: trimmedString(1, 200).optional(),
    startDate: calendarDateSchema.optional(),
    endDate: calendarDateSchema.nullable().optional(),
  })
  .strict()
  .refine(hasAtLeastOneField);

export const workExperienceSchema = z
  .object({
    id: z.string(),
    userId: z.string(),
    employer: z.string(),
    jobTitle: z.string(),
    startDate: calendarDateSchema,
    endDate: calendarDateSchema.nullable(),
    accomplishments: z.array(z.string()),
    technologies: z.array(z.string()),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

export const createWorkExperienceBodySchema = z
  .object({
    employer: trimmedString(1, 200),
    jobTitle: trimmedString(1, 200),
    startDate: calendarDateSchema,
    endDate: calendarDateSchema.nullable().optional(),
    accomplishments: z.array(accomplishmentSchema).min(1).max(20),
    technologies: z.array(technologySchema).min(0).max(30),
  })
  .strict()
  .refine((body) => rangeIsValid(body.startDate, body.endDate));

export const updateWorkExperienceBodySchema = z
  .object({
    employer: trimmedString(1, 200).optional(),
    jobTitle: trimmedString(1, 200).optional(),
    startDate: calendarDateSchema.optional(),
    endDate: calendarDateSchema.nullable().optional(),
    accomplishments: z.array(accomplishmentSchema).min(1).max(20).optional(),
    technologies: z.array(technologySchema).min(0).max(30).optional(),
  })
  .strict()
  .refine(hasAtLeastOneField);

export const projectSchema = z
  .object({
    id: z.string(),
    userId: z.string(),
    name: z.string(),
    description: z.string(),
    url: z.string().nullable(),
    startDate: calendarDateSchema.nullable(),
    endDate: calendarDateSchema.nullable(),
    accomplishments: z.array(z.string()),
    technologies: z.array(z.string()),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

export const createProjectBodySchema = z
  .object({
    name: trimmedString(1, 200),
    description: trimmedString(1, 2000),
    url: urlSchema.nullable().optional(),
    startDate: calendarDateSchema.nullable().optional(),
    endDate: calendarDateSchema.nullable().optional(),
    accomplishments: z.array(accomplishmentSchema).min(0).max(20),
    technologies: z.array(technologySchema).min(0).max(30),
  })
  .strict()
  .refine((body) => rangeIsValid(body.startDate, body.endDate));

export const updateProjectBodySchema = z
  .object({
    name: trimmedString(1, 200).optional(),
    description: trimmedString(1, 2000).optional(),
    url: urlSchema.nullable().optional(),
    startDate: calendarDateSchema.nullable().optional(),
    endDate: calendarDateSchema.nullable().optional(),
    accomplishments: z.array(accomplishmentSchema).min(0).max(20).optional(),
    technologies: z.array(technologySchema).min(0).max(30).optional(),
  })
  .strict()
  .refine(hasAtLeastOneField);

export const certificationSchema = z
  .object({
    id: z.string(),
    userId: z.string(),
    name: z.string(),
    issuer: z.string(),
    issuedOn: calendarDateSchema,
    expiresOn: calendarDateSchema.nullable(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

export const createCertificationBodySchema = z
  .object({
    name: trimmedString(1, 200),
    issuer: trimmedString(1, 200),
    issuedOn: calendarDateSchema,
    expiresOn: calendarDateSchema.nullable().optional(),
  })
  .strict()
  .refine((body) => rangeIsValid(body.issuedOn, body.expiresOn));

export const updateCertificationBodySchema = z
  .object({
    name: trimmedString(1, 200).optional(),
    issuer: trimmedString(1, 200).optional(),
    issuedOn: calendarDateSchema.optional(),
    expiresOn: calendarDateSchema.nullable().optional(),
  })
  .strict()
  .refine(hasAtLeastOneField);

export type Skill = z.infer<typeof skillSchema>;
export type CreateSkillBody = z.infer<typeof createSkillBodySchema>;
export type UpdateSkillBody = z.infer<typeof updateSkillBodySchema>;
export type Education = z.infer<typeof educationSchema>;
export type CreateEducationBody = z.infer<typeof createEducationBodySchema>;
export type UpdateEducationBody = z.infer<typeof updateEducationBodySchema>;
export type WorkExperience = z.infer<typeof workExperienceSchema>;
export type CreateWorkExperienceBody = z.infer<typeof createWorkExperienceBodySchema>;
export type UpdateWorkExperienceBody = z.infer<typeof updateWorkExperienceBodySchema>;
export type Project = z.infer<typeof projectSchema>;
export type CreateProjectBody = z.infer<typeof createProjectBodySchema>;
export type UpdateProjectBody = z.infer<typeof updateProjectBodySchema>;
export type Certification = z.infer<typeof certificationSchema>;
export type CreateCertificationBody = z.infer<typeof createCertificationBodySchema>;
export type UpdateCertificationBody = z.infer<typeof updateCertificationBodySchema>;
