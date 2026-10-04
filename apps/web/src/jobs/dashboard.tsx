import type { CreateJobBody, Job, UpdateJobBody } from "@jobpilot/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState, type FormEvent } from "react";
import { useForm, type Control, type FieldPath, type FieldValues } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  emptyJob,
  jobCreateResolver,
  jobEditResolver,
  jobFormValues,
  type JobFormValues,
} from "@/jobs/forms";
import {
  createJob,
  deleteJob,
  jobsQueryKey,
  listJobs,
  requestErrorMessage,
  updateJob,
} from "@/jobs/requests";
import { InterviewPlanPanel } from "@/jobs/interview-plan-panel";
import { interviewPlanQueryKey } from "@/jobs/interview-plan";
import { tailoredResumeQueryKey } from "@/jobs/tailored-resume";
import { TailoredResumePanel } from "@/jobs/tailored-resume-panel";

type DashboardProps = {
  userId: string;
  accessToken: string | null;
};

type Runner = (action: () => Promise<void>) => Promise<void>;

function requireToken(accessToken: string | null): string {
  if (accessToken === null || accessToken.length === 0) {
    throw new Error("Request failed");
  }
  return accessToken;
}

function notAvailable(value: boolean | null): "Not available" {
  return value === false || value === null ? "Not available" : "Not available";
}

function tailoredResumeLabel(present: boolean): "Present" | "Not available" {
  return present ? "Present" : "Not available";
}

function interviewPlanLabel(present: boolean): "Present" | "Not available" {
  return present ? "Present" : "Not available";
}

function analysisLabel(current: boolean): "Current" | "Not available" {
  return current ? "Current" : "Not available";
}

function fieldControl<T extends FieldValues, TTransformedValues>(
  control: Control<T, unknown, TTransformedValues>,
): Control<T> {
  return control as unknown as Control<T>;
}

function formProps(label: string, onSubmit: (event: FormEvent<HTMLFormElement>) => void) {
  return {
    "aria-label": label,
    noValidate: true,
    className: "grid gap-4",
    onSubmit,
  };
}

function TextField({
  control,
  name,
  label,
  description,
}: {
  control: Control<JobFormValues>;
  name: FieldPath<JobFormValues>;
  label: string;
  description?: string;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input {...field} value={field.value} />
          </FormControl>
          {description !== undefined ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function DescriptionField({ control }: { control: Control<JobFormValues> }) {
  return (
    <FormField
      control={control}
      name="jobDescription"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Job description</FormLabel>
          <FormControl>
            <Textarea {...field} value={field.value} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function JobFields({ control }: { control: Control<JobFormValues> }) {
  return (
    <>
      <TextField control={control} name="companyName" label="Company name" />
      <TextField control={control} name="jobTitle" label="Job title" />
      <DescriptionField control={control} />
      <TextField control={control} name="jobLocation" label="Job location" />
      <TextField
        control={control}
        name="jobUrl"
        label="Job URL"
        description="Leave blank if there is no URL."
      />
    </>
  );
}

function RootMessage({ message }: { message: string | undefined }) {
  if (message === undefined || message.length === 0) {
    return null;
  }
  return <p data-slot="form-message">{message}</p>;
}

function SubmitRow({
  label,
  submitting,
  onCancel,
}: {
  label: string;
  submitting: boolean;
  onCancel?: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="submit" disabled={submitting}>
        {label}
      </Button>
      {onCancel !== undefined ? (
        <Button type="button" onClick={onCancel}>
          Cancel
        </Button>
      ) : null}
    </div>
  );
}

function CreateJobForm({
  accessToken,
  run,
  onCreated,
}: {
  accessToken: string | null;
  run: Runner;
  onCreated: () => Promise<unknown>;
}) {
  const form = useForm<JobFormValues, unknown, CreateJobBody>({
    resolver: jobCreateResolver,
    defaultValues: emptyJob,
  });

  return (
    <Form {...form}>
      <form
        {...formProps(
          "Add job",
          form.handleSubmit(async (values) => {
            await run(async () => {
              await createJob(requireToken(accessToken), values);
              form.reset();
              await onCreated();
            });
          }),
        )}
      >
        <JobFields control={fieldControl(form.control)} />
        <RootMessage message={form.formState.errors.root?.message} />
        <SubmitRow label="Add job" submitting={form.formState.isSubmitting} />
      </form>
    </Form>
  );
}

function EditJobForm({
  accessToken,
  job,
  run,
  onCancel,
  onSaved,
}: {
  accessToken: string | null;
  job: Job;
  run: Runner;
  onCancel: () => void;
  onSaved: () => Promise<unknown>;
}) {
  const form = useForm<JobFormValues, unknown, UpdateJobBody>({
    resolver: jobEditResolver,
    defaultValues: jobFormValues(job),
  });

  return (
    <Form {...form}>
      <form
        {...formProps(
          "Edit job",
          form.handleSubmit(async (values) => {
            await run(async () => {
              await updateJob(requireToken(accessToken), job.id, values);
              onCancel();
              await onSaved();
            });
          }),
        )}
      >
        <JobFields control={fieldControl(form.control)} />
        <RootMessage message={form.formState.errors.root?.message} />
        <SubmitRow label="Save job" submitting={form.formState.isSubmitting} onCancel={onCancel} />
      </form>
    </Form>
  );
}

function JobRow({
  userId,
  job,
  accessToken,
  editing,
  resumeOpen,
  planOpen,
  run,
  onEdit,
  onCancel,
  onOpenResume,
  onOpenPlan,
  onClose,
  onChanged,
  onPanelRefetch,
}: {
  userId: string;
  job: Job;
  accessToken: string | null;
  editing: boolean;
  resumeOpen: boolean;
  planOpen: boolean;
  run: Runner;
  onEdit: () => void;
  onCancel: () => void;
  onOpenResume: () => void;
  onOpenPlan: () => void;
  onClose: () => void;
  onChanged: () => Promise<unknown>;
  onPanelRefetch: () => Promise<unknown>;
}) {
  return (
    <li data-testid="job-row" className="grid gap-3">
      <p>
        <span className="text-muted-foreground">Company </span>
        <span data-testid="job-company">{job.companyName}</span>
      </p>
      <p>
        <span className="text-muted-foreground">Title </span>
        <span data-testid="job-title">{job.jobTitle}</span>
      </p>
      <p>
        <span className="text-muted-foreground">Location </span>
        <span data-testid="job-location">{job.jobLocation}</span>
      </p>
      <p>
        <span className="text-muted-foreground">Description </span>
        <span data-testid="job-description">{job.jobDescription}</span>
      </p>
      {job.jobUrl !== null ? (
        <p>
          <span className="text-muted-foreground">URL </span>
          <span data-testid="job-url">{job.jobUrl}</span>
        </p>
      ) : null}
      <p>
        Analysis <span data-testid="job-analysis">{analysisLabel(job.status.analysisCurrent)}</span>
      </p>
      <p>
        Tailored resume{" "}
        <span data-testid="job-tailored-resume">
          {tailoredResumeLabel(job.status.tailoredResumePresent)}
        </span>
      </p>
      <p>
        Interview plan{" "}
        <span data-testid="job-interview-plan">
          {interviewPlanLabel(job.status.interviewPlanPresent)}
        </span>
      </p>
      <p>
        Score <span data-testid="job-score">{notAvailable(job.status.latestOverallScore)}</span>
      </p>
      <p>
        Readiness <span data-testid="job-readiness">{notAvailable(job.status.readinessBadge)}</span>
      </p>
      {resumeOpen ? (
        <TailoredResumePanel
          userId={userId}
          jobId={job.id}
          accessToken={accessToken}
          onClose={onClose}
        />
      ) : (
        <Button type="button" data-testid="open-tailored-resume" onClick={onOpenResume}>
          Tailored resume
        </Button>
      )}
      {planOpen ? (
        <InterviewPlanPanel
          userId={userId}
          jobId={job.id}
          accessToken={accessToken}
          onClose={onClose}
        />
      ) : (
        <Button type="button" data-testid="open-interview-plan" onClick={onOpenPlan}>
          Interview plan
        </Button>
      )}
      {editing ? (
        <EditJobForm
          accessToken={accessToken}
          job={job}
          run={run}
          onCancel={onCancel}
          onSaved={async () => {
            await onChanged();
            await onPanelRefetch();
          }}
        />
      ) : (
        <Button type="button" onClick={onEdit}>
          Edit job
        </Button>
      )}
      <Button
        type="button"
        onClick={() => {
          void run(async () => {
            await deleteJob(requireToken(accessToken), job.id);
            if (editing) {
              onCancel();
            }
            if (resumeOpen || planOpen) {
              onClose();
            }
            await onChanged();
          });
        }}
      >
        Delete job
      </Button>
    </li>
  );
}

export function Dashboard({ userId, accessToken }: DashboardProps) {
  const queryClient = useQueryClient();
  const accessTokenRef = useRef(accessToken);
  accessTokenRef.current = accessToken;
  const [requestError, setRequestError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [openPanel, setOpenPanel] = useState<{ jobId: string; kind: "resume" | "plan" } | null>(
    null,
  );
  const openPanelRef = useRef(openPanel);
  openPanelRef.current = openPanel;

  const query = useQuery({
    queryKey: jobsQueryKey(userId),
    enabled: accessToken !== null && accessToken.length > 0,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: () => {
      const token = accessTokenRef.current;
      if (token === null || token.length === 0) {
        throw new Error("Request failed");
      }
      return listJobs(token);
    },
  });

  const refetch = useCallback(() => {
    return queryClient.refetchQueries({ queryKey: jobsQueryKey(userId) });
  }, [queryClient, userId]);

  const run = useCallback<Runner>(async (action) => {
    setRequestError(null);
    try {
      await action();
    } catch (error) {
      setRequestError(requestErrorMessage(error));
    }
  }, []);

  const data = query.data;
  const showLoading = data === undefined && query.isFetching;
  const showEmpty = query.isSuccess && data !== undefined && data.length === 0;
  const listError = query.isError ? requestErrorMessage(query.error) : null;

  return (
    <section data-testid="dashboard">
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Dashboard</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {showLoading ? <p data-testid="jobs-loading">Loading jobs…</p> : null}
          {listError !== null ? <p role="alert">{listError}</p> : null}
          {showEmpty ? <p data-testid="jobs-empty">No jobs yet.</p> : null}
          {data !== undefined && data.length > 0 ? (
            <ul className="grid gap-4">
              {data.map((job) => (
                <JobRow
                  key={job.id}
                  userId={userId}
                  job={job}
                  accessToken={accessToken}
                  editing={editingId === job.id}
                  resumeOpen={openPanel?.jobId === job.id && openPanel.kind === "resume"}
                  planOpen={openPanel?.jobId === job.id && openPanel.kind === "plan"}
                  run={run}
                  onEdit={() => setEditingId(job.id)}
                  onCancel={() => setEditingId(null)}
                  onOpenResume={() => setOpenPanel({ jobId: job.id, kind: "resume" })}
                  onOpenPlan={() => setOpenPanel({ jobId: job.id, kind: "plan" })}
                  onClose={() => setOpenPanel(null)}
                  onChanged={refetch}
                  onPanelRefetch={() => {
                    const open = openPanelRef.current;
                    if (open === null || open.jobId !== job.id) {
                      return Promise.resolve();
                    }
                    const queryKey =
                      open.kind === "resume"
                        ? tailoredResumeQueryKey(userId, job.id)
                        : interviewPlanQueryKey(userId, job.id);
                    return queryClient.refetchQueries({ queryKey });
                  }}
                />
              ))}
            </ul>
          ) : null}
          {requestError !== null ? <p role="alert">{requestError}</p> : null}
          <CreateJobForm accessToken={accessToken} run={run} onCreated={refetch} />
        </CardContent>
      </Card>
    </section>
  );
}
