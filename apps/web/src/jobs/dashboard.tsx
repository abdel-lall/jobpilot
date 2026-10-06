import type { CreateJobBody, Job, JobAnalysis, UpdateJobBody } from "@jobpilot/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState, type FormEvent } from "react";
import { useForm, type Control, type FieldPath, type FieldValues } from "react-hook-form";
import { Button } from "@/components/ui/button";
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
import { ActivityCloseButton } from "@/jobs/activity-close";
import { InterviewAttemptPanel } from "@/jobs/interview-attempt-panel";
import { InterviewPlanPanel } from "@/jobs/interview-plan-panel";
import { interviewPlanQueryKey } from "@/jobs/interview-plan";
import { tailoredResumeQueryKey } from "@/jobs/tailored-resume";
import { TailoredResumePanel } from "@/jobs/tailored-resume-panel";
import {
  DeleteIcon,
  EditIcon,
  profileCardClass,
  RecordIconButton,
} from "@/profile/record-actions";

type DashboardProps = {
  userId: string;
  email: string;
  accessToken: string | null;
};

type Runner = (action: () => Promise<void>) => Promise<void>;

type Activity =
  | { kind: "add" }
  | { kind: "edit"; jobId: string }
  | { kind: "details"; jobId: string }
  | { kind: "resume"; jobId: string }
  | { kind: "plan"; jobId: string }
  | { kind: "attempt"; jobId: string };

type WorkflowKind = "details" | "resume" | "plan" | "attempt";

const activityHeadingClass = "pr-10 text-lg font-semibold text-[var(--jp-ink)]";
const activityCardClass = `${profileCardClass()} relative`;

const analysisSections: Array<{ title: string; key: keyof JobAnalysis }> = [
  { title: "Required skills", key: "requiredSkills" },
  { title: "Preferred skills", key: "preferredSkills" },
  { title: "Responsibilities", key: "responsibilities" },
  { title: "Experience requirements", key: "experienceRequirements" },
  { title: "Technologies", key: "technologies" },
  { title: "Interview topics", key: "interviewTopics" },
  { title: "Keywords", key: "keywords" },
];

function activityJobId(activity: Activity | null): string | null {
  if (activity === null || activity.kind === "add") {
    return null;
  }
  return activity.jobId;
}

function requireToken(accessToken: string | null): string {
  if (accessToken === null || accessToken.length === 0) {
    throw new Error("Request failed");
  }
  return accessToken;
}

function scoreLabel(score: number | null): string {
  return score === null ? "Not available" : String(score);
}

function readinessLabel(badge: "Interview Ready" | null): string {
  return badge === null ? "Not available" : badge;
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
      <Button type="submit" variant="accent" disabled={submitting}>
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

function WorkflowButton({
  testId,
  label,
  pressed,
  onClick,
}: {
  testId: string;
  label: string;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-pressed={pressed}
      className={`auth-focus inline-flex min-w-0 items-center justify-center rounded-md px-2 py-1.5 text-center text-sm font-medium text-[var(--jp-ink)] ${
        pressed ? "bg-[#CEB5FF]" : "bg-[#D3D3FF] hover:brightness-95"
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function JobMenuCard({
  job,
  selected,
  detailsPressed,
  resumePressed,
  planPressed,
  attemptPressed,
  onEdit,
  onDelete,
  onOpenDetails,
  onOpenResume,
  onOpenPlan,
  onOpenAttempt,
}: {
  job: Job;
  selected: boolean;
  detailsPressed: boolean;
  resumePressed: boolean;
  planPressed: boolean;
  attemptPressed: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onOpenDetails: () => void;
  onOpenResume: () => void;
  onOpenPlan: () => void;
  onOpenAttempt: () => void;
}) {
  return (
    <li
      data-testid="job-row"
      className={`grid gap-3 rounded-[8px] border bg-white p-4 ${
        selected ? "border-[#CEB5FF] ring-2 ring-[#CEB5FF] ring-inset" : "border-[var(--border)]"
      }`}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p data-testid="job-company" className="break-words text-base font-semibold text-[var(--jp-ink)]">
            {job.companyName}
          </p>
          <p data-testid="job-title" className="break-words text-sm text-[var(--jp-ink)]">
            {job.jobTitle}
          </p>
          {job.jobLocation.length > 0 ? (
            <p data-testid="job-location" className="break-words text-xs text-[var(--jp-logout)]">
              {job.jobLocation}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0">
          <RecordIconButton label="Edit job" onClick={onEdit}>
            <EditIcon />
          </RecordIconButton>
          <RecordIconButton label="Delete job" onClick={onDelete}>
            <DeleteIcon />
          </RecordIconButton>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <WorkflowButton
          testId="open-job-details"
          label="Details"
          pressed={detailsPressed}
          onClick={onOpenDetails}
        />
        <WorkflowButton
          testId="open-tailored-resume"
          label="Resume"
          pressed={resumePressed}
          onClick={onOpenResume}
        />
        <WorkflowButton
          testId="open-interview-plan"
          label="Plan"
          pressed={planPressed}
          onClick={onOpenPlan}
        />
        <WorkflowButton
          testId="open-interview-attempt"
          label="Interview"
          pressed={attemptPressed}
          onClick={onOpenAttempt}
        />
      </div>
    </li>
  );
}

function AnalysisSections({ analysis }: { analysis: JobAnalysis }) {
  return (
    <div className="grid gap-3">
      {analysisSections.map((section) => {
        const values = analysis[section.key];
        return (
          <section key={section.title} className="grid gap-1">
            <h3 className="text-sm font-semibold text-[var(--jp-ink)]">{section.title}</h3>
            {values.length === 0 ? (
              <p>None</p>
            ) : (
              <ul className="grid gap-1">
                {values.map((value, index) => (
                  <li key={`${section.title}-${index}`}>{value}</li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

function NeutralActivityCard() {
  return (
    <div className={profileCardClass()}>
      <p className="text-sm text-[var(--jp-logout)]">Select a job action to get started.</p>
    </div>
  );
}

function JobDetailsCard({ job, onClose }: { job: Job; onClose: () => void }) {
  return (
    <div className={activityCardClass}>
      <ActivityCloseButton onClick={onClose} />
      <div data-testid="job-details" className="grid gap-3">
        <h2 className={activityHeadingClass}>Job details</h2>
        <p className="break-words text-base font-semibold text-[var(--jp-ink)]">{job.companyName}</p>
        <p className="break-words text-sm text-[var(--jp-ink)]">{job.jobTitle}</p>
        {job.jobLocation.length > 0 ? (
          <p className="break-words text-xs text-[var(--jp-logout)]">{job.jobLocation}</p>
        ) : null}
        <p className="break-words">
          <span className="text-[var(--jp-muted)]">Description </span>
          <span data-testid="job-description">{job.jobDescription}</span>
        </p>
        {job.jobUrl !== null ? (
          <p className="break-words">
            <span className="text-[var(--jp-muted)]">URL </span>
            <span data-testid="job-url" className="break-all">
              {job.jobUrl}
            </span>
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
          Score <span data-testid="job-score">{scoreLabel(job.status.latestOverallScore)}</span>
        </p>
        <p>
          Readiness{" "}
          <span data-testid="job-readiness">{readinessLabel(job.status.readinessBadge)}</span>
        </p>
        {job.analysis !== null ? <AnalysisSections analysis={job.analysis} /> : null}
      </div>
    </div>
  );
}

function ActiveActivity({
  userId,
  email,
  accessToken,
  job,
  activity,
  run,
  onClose,
  onCreated,
  onSaved,
}: {
  userId: string;
  email: string;
  accessToken: string | null;
  job: Job | null;
  activity: Activity;
  run: Runner;
  onClose: () => void;
  onCreated: () => Promise<unknown>;
  onSaved: (jobId: string) => Promise<unknown>;
}) {
  if (activity.kind === "add") {
    return (
      <div className={activityCardClass}>
        <ActivityCloseButton onClick={onClose} />
        <h2 className={activityHeadingClass}>Add job</h2>
        <CreateJobForm accessToken={accessToken} run={run} onCreated={onCreated} />
      </div>
    );
  }

  if (job === null) {
    return <NeutralActivityCard />;
  }

  if (activity.kind === "edit") {
    return (
      <div className={activityCardClass}>
        <ActivityCloseButton onClick={onClose} />
        <h2 className={activityHeadingClass}>Edit job</h2>
        <EditJobForm
          key={job.id}
          accessToken={accessToken}
          job={job}
          run={run}
          onCancel={onClose}
          onSaved={() => onSaved(job.id)}
        />
      </div>
    );
  }

  if (activity.kind === "details") {
    return <JobDetailsCard job={job} onClose={onClose} />;
  }

  if (activity.kind === "resume") {
    return (
      <div className={activityCardClass}>
        <TailoredResumePanel
          key={job.id}
          userId={userId}
          jobId={job.id}
          email={email}
          companyName={job.companyName}
          jobTitle={job.jobTitle}
          tailoredResumePresent={job.status.tailoredResumePresent}
          accessToken={accessToken}
          onClose={onClose}
        />
      </div>
    );
  }

  if (activity.kind === "plan") {
    return (
      <div className={activityCardClass}>
        <InterviewPlanPanel
          key={job.id}
          userId={userId}
          jobId={job.id}
          accessToken={accessToken}
          onClose={onClose}
        />
      </div>
    );
  }

  return (
    <div className={activityCardClass}>
      <InterviewAttemptPanel
        key={job.id}
        userId={userId}
        jobId={job.id}
        accessToken={accessToken}
        onClose={onClose}
      />
    </div>
  );
}

export function Dashboard({ userId, email, accessToken }: DashboardProps) {
  const queryClient = useQueryClient();
  const accessTokenRef = useRef(accessToken);
  accessTokenRef.current = accessToken;
  const [requestError, setRequestError] = useState<string | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);

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

  const refreshStoredDocuments = useCallback(
    (jobId: string) => {
      return Promise.all([
        queryClient.refetchQueries({
          queryKey: tailoredResumeQueryKey(userId, jobId),
          type: "all",
        }),
        queryClient.refetchQueries({
          queryKey: interviewPlanQueryKey(userId, jobId),
          type: "all",
        }),
      ]);
    },
    [queryClient, userId],
  );

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
  const selectedJobId = activityJobId(activity);
  const activeJob =
    selectedJobId === null ? null : (data?.find((job) => job.id === selectedJobId) ?? null);

  function openWorkflow(jobId: string, kind: WorkflowKind) {
    setActivity({ kind, jobId });
  }

  return (
    <section data-testid="dashboard" className="min-w-0">
      <div
        data-testid="dashboard-workspace"
        className="flex min-w-0 flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,71fr)_minmax(0,29fr)] lg:items-start"
      >
        <div
          data-testid="jobs-menu"
          className={`${profileCardClass()} lg:sticky lg:top-5 lg:col-start-2 lg:row-start-1 lg:h-[calc(100dvh-70px-1.25rem-2rem-1.25rem-1.25rem)] lg:overflow-hidden`}
        >
          <button
            type="button"
            data-testid="open-add-job"
            className="auth-focus inline-flex h-9 w-full shrink-0 items-center justify-center rounded-md bg-[#D3D3FF] px-4 text-sm font-medium text-[var(--jp-ink)] hover:brightness-95"
            onClick={() => {
              setActivity({ kind: "add" });
            }}
          >
            Add job
          </button>
          <div
            data-testid="jobs-list"
            className="min-h-0 overflow-y-auto max-lg:max-h-[min(20rem,45dvh)] lg:flex-1"
          >
            {showLoading ? <p data-testid="jobs-loading">Loading jobs…</p> : null}
            {listError !== null ? <p role="alert">{listError}</p> : null}
            {showEmpty ? <p data-testid="jobs-empty">No jobs yet.</p> : null}
            {data !== undefined && data.length > 0 ? (
              <ul className="grid gap-3">
                {data.map((job) => (
                  <JobMenuCard
                    key={job.id}
                    job={job}
                    selected={selectedJobId === job.id}
                    detailsPressed={activity?.kind === "details" && activity.jobId === job.id}
                    resumePressed={activity?.kind === "resume" && activity.jobId === job.id}
                    planPressed={activity?.kind === "plan" && activity.jobId === job.id}
                    attemptPressed={activity?.kind === "attempt" && activity.jobId === job.id}
                    onEdit={() => {
                      setActivity({ kind: "edit", jobId: job.id });
                    }}
                    onDelete={() => {
                      void run(async () => {
                        await deleteJob(requireToken(accessToken), job.id);
                        setActivity((current) =>
                          current !== null && current.kind !== "add" && current.jobId === job.id
                            ? null
                            : current,
                        );
                        await refetch();
                      });
                    }}
                    onOpenDetails={() => {
                      openWorkflow(job.id, "details");
                    }}
                    onOpenResume={() => {
                      openWorkflow(job.id, "resume");
                    }}
                    onOpenPlan={() => {
                      openWorkflow(job.id, "plan");
                    }}
                    onOpenAttempt={() => {
                      openWorkflow(job.id, "attempt");
                    }}
                  />
                ))}
              </ul>
            ) : null}
          </div>
        </div>
        <div data-testid="active-work" className="grid min-w-0 gap-5 lg:col-start-1 lg:row-start-1">
          {requestError !== null ? <p role="alert">{requestError}</p> : null}
          {activity === null ? (
            <NeutralActivityCard />
          ) : (
            <ActiveActivity
              userId={userId}
              email={email}
              accessToken={accessToken}
              job={activeJob}
              activity={activity}
              run={run}
              onClose={() => {
                setActivity(null);
              }}
              onCreated={refetch}
              onSaved={async (jobId) => {
                await refetch();
                await refreshStoredDocuments(jobId);
              }}
            />
          )}
        </div>
      </div>
    </section>
  );
}
