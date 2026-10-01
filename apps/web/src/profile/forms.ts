import {
  createCertificationBodySchema,
  createEducationBodySchema,
  createProjectBodySchema,
  createWorkExperienceBodySchema,
  updateCertificationBodySchema,
  updateEducationBodySchema,
  updateProjectBodySchema,
  updateWorkExperienceBodySchema,
  type Certification,
  type CreateCertificationBody,
  type CreateEducationBody,
  type CreateProjectBody,
  type CreateWorkExperienceBody,
  type Education,
  type Project,
  type UpdateCertificationBody,
  type UpdateEducationBody,
  type UpdateProjectBody,
  type UpdateWorkExperienceBody,
  type WorkExperience,
} from "@jobpilot/shared";
import type { FieldError, FieldErrors, FieldValues, Resolver, ResolverResult } from "react-hook-form";
import type { ZodError, ZodTypeAny } from "zod";

export type EducationFormValues = {
  institution: string;
  degree: string;
  fieldOfStudy: string;
  startDate: string;
  endDate: string;
};

export type ExperienceFormValues = {
  employer: string;
  jobTitle: string;
  startDate: string;
  endDate: string;
  accomplishments: string;
  technologies: string;
};

export type ProjectFormValues = {
  name: string;
  description: string;
  url: string;
  startDate: string;
  endDate: string;
  accomplishments: string;
  technologies: string;
};

export type CertificationFormValues = {
  name: string;
  issuer: string;
  issuedOn: string;
  expiresOn: string;
};

export const emptyEducation: EducationFormValues = {
  institution: "",
  degree: "",
  fieldOfStudy: "",
  startDate: "",
  endDate: "",
};

export const emptyExperience: ExperienceFormValues = {
  employer: "",
  jobTitle: "",
  startDate: "",
  endDate: "",
  accomplishments: "",
  technologies: "",
};

export const emptyProject: ProjectFormValues = {
  name: "",
  description: "",
  url: "",
  startDate: "",
  endDate: "",
  accomplishments: "",
  technologies: "",
};

export const emptyCertification: CertificationFormValues = {
  name: "",
  issuer: "",
  issuedOn: "",
  expiresOn: "",
};

export function lines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function omittedOrValue(value: string): { include: false } | { include: true; value: string } {
  if (value === "") {
    return { include: false };
  }
  return { include: true, value };
}

function educationCreateBody(values: EducationFormValues): unknown {
  const endDate = omittedOrValue(values.endDate);
  return {
    institution: values.institution,
    degree: values.degree,
    fieldOfStudy: values.fieldOfStudy,
    startDate: values.startDate,
    ...(endDate.include ? { endDate: endDate.value } : {}),
  };
}

function educationEditBody(values: EducationFormValues): unknown {
  return {
    institution: values.institution,
    degree: values.degree,
    fieldOfStudy: values.fieldOfStudy,
    startDate: values.startDate,
    endDate: values.endDate === "" ? null : values.endDate,
  };
}

function experienceCreateBody(values: ExperienceFormValues): unknown {
  const endDate = omittedOrValue(values.endDate);
  return {
    employer: values.employer,
    jobTitle: values.jobTitle,
    startDate: values.startDate,
    ...(endDate.include ? { endDate: endDate.value } : {}),
    accomplishments: lines(values.accomplishments),
    technologies: lines(values.technologies),
  };
}

function experienceEditBody(values: ExperienceFormValues): unknown {
  return {
    employer: values.employer,
    jobTitle: values.jobTitle,
    startDate: values.startDate,
    endDate: values.endDate === "" ? null : values.endDate,
    accomplishments: lines(values.accomplishments),
    technologies: lines(values.technologies),
  };
}

function projectCreateBody(values: ProjectFormValues): unknown {
  const url = omittedOrValue(values.url);
  const startDate = omittedOrValue(values.startDate);
  const endDate = omittedOrValue(values.endDate);
  return {
    name: values.name,
    description: values.description,
    ...(url.include ? { url: url.value } : {}),
    ...(startDate.include ? { startDate: startDate.value } : {}),
    ...(endDate.include ? { endDate: endDate.value } : {}),
    accomplishments: lines(values.accomplishments),
    technologies: lines(values.technologies),
  };
}

function projectEditBody(values: ProjectFormValues): unknown {
  return {
    name: values.name,
    description: values.description,
    url: values.url === "" ? null : values.url,
    startDate: values.startDate === "" ? null : values.startDate,
    endDate: values.endDate === "" ? null : values.endDate,
    accomplishments: lines(values.accomplishments),
    technologies: lines(values.technologies),
  };
}

function certificationCreateBody(values: CertificationFormValues): unknown {
  const expiresOn = omittedOrValue(values.expiresOn);
  return {
    name: values.name,
    issuer: values.issuer,
    issuedOn: values.issuedOn,
    ...(expiresOn.include ? { expiresOn: expiresOn.value } : {}),
  };
}

function certificationEditBody(values: CertificationFormValues): unknown {
  return {
    name: values.name,
    issuer: values.issuer,
    issuedOn: values.issuedOn,
    expiresOn: values.expiresOn === "" ? null : values.expiresOn,
  };
}

function toFieldErrors<TValues extends FieldValues>(error: ZodError): FieldErrors<TValues> {
  const errors: Record<string, FieldError> = {};
  for (const issue of error.issues) {
    const head = issue.path[0];
    const field = typeof head === "string" ? head : "root";
    if (errors[field] === undefined) {
      errors[field] = { type: issue.code, message: issue.message };
    }
  }
  return errors as FieldErrors<TValues>;
}

function invalid<TValues extends FieldValues>(error: ZodError): ResolverResult<TValues, never> {
  return {
    values: {} as Record<string, never>,
    errors: toFieldErrors<TValues>(error),
  };
}

function schemaResolver<TValues extends FieldValues, TOutput>(
  normalize: (values: TValues) => unknown,
  schema: ZodTypeAny,
): Resolver<TValues, unknown, TOutput> {
  return (values) => {
    const parsed = schema.safeParse(normalize(values));
    if (!parsed.success) {
      return invalid(parsed.error);
    }
    return {
      values: parsed.data as TOutput,
      errors: {},
    };
  };
}

function editResolver<TValues extends FieldValues, TOutput>(
  normalize: (values: TValues) => unknown,
  createSchema: ZodTypeAny,
  updateSchema: ZodTypeAny,
): Resolver<TValues, unknown, TOutput> {
  return (values) => {
    const body = normalize(values);
    const created = createSchema.safeParse(body);
    if (!created.success) {
      return invalid(created.error);
    }
    const updated = updateSchema.safeParse(body);
    if (!updated.success) {
      return invalid(updated.error);
    }
    return {
      values: updated.data as TOutput,
      errors: {},
    };
  };
}

export const educationCreateResolver = schemaResolver<EducationFormValues, CreateEducationBody>(
  educationCreateBody,
  createEducationBodySchema,
);

export const educationEditResolver = editResolver<EducationFormValues, UpdateEducationBody>(
  educationEditBody,
  createEducationBodySchema,
  updateEducationBodySchema,
);

export const experienceCreateResolver = schemaResolver<ExperienceFormValues, CreateWorkExperienceBody>(
  experienceCreateBody,
  createWorkExperienceBodySchema,
);

export const experienceEditResolver = editResolver<ExperienceFormValues, UpdateWorkExperienceBody>(
  experienceEditBody,
  createWorkExperienceBodySchema,
  updateWorkExperienceBodySchema,
);

export const projectCreateResolver = schemaResolver<ProjectFormValues, CreateProjectBody>(
  projectCreateBody,
  createProjectBodySchema,
);

export const projectEditResolver = editResolver<ProjectFormValues, UpdateProjectBody>(
  projectEditBody,
  createProjectBodySchema,
  updateProjectBodySchema,
);

export const certificationCreateResolver = schemaResolver<CertificationFormValues, CreateCertificationBody>(
  certificationCreateBody,
  createCertificationBodySchema,
);

export const certificationEditResolver = editResolver<CertificationFormValues, UpdateCertificationBody>(
  certificationEditBody,
  createCertificationBodySchema,
  updateCertificationBodySchema,
);

export function educationFormValues(record: Education): EducationFormValues {
  return {
    institution: record.institution,
    degree: record.degree,
    fieldOfStudy: record.fieldOfStudy,
    startDate: record.startDate,
    endDate: record.endDate ?? "",
  };
}

export function experienceFormValues(record: WorkExperience): ExperienceFormValues {
  return {
    employer: record.employer,
    jobTitle: record.jobTitle,
    startDate: record.startDate,
    endDate: record.endDate ?? "",
    accomplishments: record.accomplishments.join("\n"),
    technologies: record.technologies.join("\n"),
  };
}

export function projectFormValues(record: Project): ProjectFormValues {
  return {
    name: record.name,
    description: record.description,
    url: record.url ?? "",
    startDate: record.startDate ?? "",
    endDate: record.endDate ?? "",
    accomplishments: record.accomplishments.join("\n"),
    technologies: record.technologies.join("\n"),
  };
}

export function certificationFormValues(record: Certification): CertificationFormValues {
  return {
    name: record.name,
    issuer: record.issuer,
    issuedOn: record.issuedOn,
    expiresOn: record.expiresOn ?? "",
  };
}
