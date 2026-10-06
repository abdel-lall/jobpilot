import type { TailoredResume } from "@jobpilot/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { ActivityCloseButton } from "@/jobs/activity-close";
import { jobsQueryKey, requestErrorMessage } from "@/jobs/requests";
import { ResumeDocument } from "@/jobs/resume-document";
import { downloadResumePdf } from "@/jobs/resume-pdf";
import {
  buildResumePreview,
  resumePdfFilename,
  type ResumePreview,
} from "@/jobs/resume-preview";
import {
  generateTailoredResume,
  readTailoredResume,
  tailoredResumeQueryKey,
} from "@/jobs/tailored-resume";

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M5 12.5 9.5 17 19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function NeedsRegenerationIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v5" strokeLinecap="round" />
      <path d="M12 16.5h.01" strokeLinecap="round" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <path d="M12 4v10" strokeLinecap="round" />
      <path d="m8 10 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 19h14" strokeLinecap="round" />
    </svg>
  );
}

function ResumeFreshness({ present }: { present: boolean }) {
  const accessibleName = present ? "Resume up to date" : "Resume needs regeneration";
  const visibleText = present ? "Up to date" : "Needs regeneration";
  const color = present ? "text-[#166534]" : "text-[#9A3412]";
  return (
    <span
      data-testid="resume-freshness"
      role="img"
      aria-label={accessibleName}
      className={`inline-flex max-w-[11rem] items-center gap-1 text-right text-xs font-medium ${color}`}
    >
      {present ? <CheckIcon /> : <NeedsRegenerationIcon />}
      <span>{visibleText}</span>
    </span>
  );
}

function DownloadResumeButton({
  preview,
  filename,
}: {
  preview: ResumePreview;
  filename: string;
}) {
  return (
    <button
      type="button"
      data-testid="download-tailored-resume"
      aria-label="Download resume PDF"
      className="auth-focus inline-flex size-8 shrink-0 items-center justify-center rounded-md text-[var(--jp-logout)] hover:bg-[#F3F4F6]"
      onClick={() => {
        downloadResumePdf(preview, filename);
      }}
    >
      <DownloadIcon />
    </button>
  );
}

export function TailoredResumePanel({
  userId,
  jobId,
  email,
  companyName,
  jobTitle,
  tailoredResumePresent,
  accessToken,
  onClose,
}: {
  userId: string;
  jobId: string;
  email: string;
  companyName: string;
  jobTitle: string;
  tailoredResumePresent: boolean;
  accessToken: string | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const accessTokenRef = useRef(accessToken);
  accessTokenRef.current = accessToken;
  const queryKey = tailoredResumeQueryKey(userId, jobId);

  const query = useQuery({
    queryKey,
    enabled: accessToken !== null && accessToken.length > 0,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: () => {
      const token = accessTokenRef.current;
      if (token === null || token.length === 0) {
        throw new Error("Request failed");
      }
      return readTailoredResume(token, jobId);
    },
  });

  const generate = useMutation({
    mutationFn: () => {
      const token = accessTokenRef.current;
      if (token === null || token.length === 0) {
        throw new Error("Request failed");
      }
      return generateTailoredResume(token, jobId);
    },
    onSuccess: async (resume) => {
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData(queryKey, resume);
      await queryClient.refetchQueries({ queryKey: jobsQueryKey(userId) });
    },
  });

  const showLoading = query.isPending && query.isFetching;
  const showEmpty = query.isSuccess && query.data === null;
  const resume: TailoredResume | null = query.isSuccess && query.data !== null ? query.data : null;
  const showGenerate = showEmpty || resume !== null;
  const preview = resume === null ? null : buildResumePreview(resume, email);

  return (
    <div data-testid="tailored-resume-panel" className="grid gap-3">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold text-[var(--jp-ink)]">Tailored resume</h2>
        <div className="flex shrink-0 items-start gap-2">
          <ResumeFreshness present={tailoredResumePresent} />
          {preview !== null ? (
            <DownloadResumeButton preview={preview} filename={resumePdfFilename(companyName, jobTitle)} />
          ) : null}
          <ActivityCloseButton inline testId="close-tailored-resume" onClick={onClose} />
        </div>
      </div>
      {showLoading ? <p data-testid="tailored-resume-loading">Loading resume…</p> : null}
      {query.isError ? <p>{requestErrorMessage(query.error)}</p> : null}
      {showEmpty ? <p data-testid="tailored-resume-empty">No tailored resume yet.</p> : null}
      {preview !== null ? <ResumeDocument preview={preview} /> : null}
      {showGenerate ? (
        <Button
          type="button"
          variant="accent"
          data-testid="generate-tailored-resume"
          disabled={generate.isPending}
          onClick={() => {
            generate.mutate();
          }}
        >
          Generate resume
        </Button>
      ) : null}
      {generate.isError ? <p>{requestErrorMessage(generate.error)}</p> : null}
    </div>
  );
}
