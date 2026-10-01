import {
  createJobBodySchema,
  updateJobBodySchema,
  type CreateJobBody,
  type Job,
  type UpdateJobBody,
} from "@jobpilot/shared";
import type { FieldError, FieldErrors, FieldValues, Resolver, ResolverResult } from "react-hook-form";
import type { ZodError, ZodTypeAny } from "zod";

export type JobFormValues = {
  companyName: string;
  jobTitle: string;
  jobDescription: string;
  jobLocation: string;
  jobUrl: string;
};

export const emptyJob: JobFormValues = {
  companyName: "",
  jobTitle: "",
  jobDescription: "",
  jobLocation: "",
  jobUrl: "",
};

function createBody(values: JobFormValues): unknown {
  return {
    companyName: values.companyName,
    jobTitle: values.jobTitle,
    jobDescription: values.jobDescription,
    jobLocation: values.jobLocation,
    ...(values.jobUrl === "" ? {} : { jobUrl: values.jobUrl }),
  };
}

function editBody(values: JobFormValues): unknown {
  return {
    companyName: values.companyName,
    jobTitle: values.jobTitle,
    jobDescription: values.jobDescription,
    jobLocation: values.jobLocation,
    jobUrl: values.jobUrl === "" ? null : values.jobUrl,
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

export const jobCreateResolver = schemaResolver<JobFormValues, CreateJobBody>(
  createBody,
  createJobBodySchema,
);

export const jobEditResolver = schemaResolver<JobFormValues, UpdateJobBody>(
  editBody,
  updateJobBodySchema,
);

export function jobFormValues(job: Job): JobFormValues {
  return {
    companyName: job.companyName,
    jobTitle: job.jobTitle,
    jobDescription: job.jobDescription,
    jobLocation: job.jobLocation,
    jobUrl: job.jobUrl ?? "",
  };
}
