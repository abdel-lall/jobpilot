import type { TailoredResume } from "@jobpilot/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ActivityCloseButton } from "@/jobs/activity-close";
import { jobsQueryKey, requestErrorMessage } from "@/jobs/requests";
import {
  generateTailoredResume,
  readTailoredResume,
  tailoredResumeQueryKey,
} from "@/jobs/tailored-resume";

function visibleText(parts: Array<string | null>): string {
  const present: string[] = [];
  for (const part of parts) {
    if (part !== null) {
      present.push(part);
    }
  }
  return present.join(" ");
}

function ResumeSection({
  title,
  empty,
  children,
}: {
  title: string;
  empty: boolean;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-2">
      <h4>{title}</h4>
      {empty ? <p>None</p> : children}
    </section>
  );
}

function ResumeDocument({ resume }: { resume: TailoredResume }) {
  return (
    <div className="grid gap-4">
      <ResumeSection title="Skills" empty={resume.skills.length === 0}>
        <ul className="grid gap-2">
          {resume.skills.map((skill) => (
            <li key={skill.sourceId} data-testid="resume-skill">
              {skill.name}
            </li>
          ))}
        </ul>
      </ResumeSection>
      <ResumeSection title="Experience" empty={resume.experience.length === 0}>
        <ul className="grid gap-2">
          {resume.experience.map((item) => (
            <li key={item.sourceId} data-testid="resume-experience">
              {visibleText([
                item.employer,
                item.jobTitle,
                item.startDate,
                item.endDate,
                ...item.accomplishments,
                ...item.technologies,
              ])}
            </li>
          ))}
        </ul>
      </ResumeSection>
      <ResumeSection title="Projects" empty={resume.projects.length === 0}>
        <ul className="grid gap-2">
          {resume.projects.map((item) => (
            <li key={item.sourceId} data-testid="resume-project">
              {visibleText([
                item.name,
                item.description,
                item.url,
                item.startDate,
                item.endDate,
                ...item.accomplishments,
                ...item.technologies,
              ])}
            </li>
          ))}
        </ul>
      </ResumeSection>
      <ResumeSection title="Education" empty={resume.education.length === 0}>
        <ul className="grid gap-2">
          {resume.education.map((item) => (
            <li key={item.sourceId} data-testid="resume-education">
              {visibleText([
                item.institution,
                item.degree,
                item.fieldOfStudy,
                item.startDate,
                item.endDate,
              ])}
            </li>
          ))}
        </ul>
      </ResumeSection>
      <ResumeSection title="Certifications" empty={resume.certifications.length === 0}>
        <ul className="grid gap-2">
          {resume.certifications.map((item) => (
            <li key={item.sourceId} data-testid="resume-certification">
              {visibleText([item.name, item.issuer, item.issuedOn, item.expiresOn])}
            </li>
          ))}
        </ul>
      </ResumeSection>
    </div>
  );
}

export function TailoredResumePanel({
  userId,
  jobId,
  accessToken,
  onClose,
}: {
  userId: string;
  jobId: string;
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
  const resume = query.isSuccess && query.data !== null ? query.data : null;
  const showGenerate = showEmpty || resume !== null;

  return (
    <div data-testid="tailored-resume-panel" className="grid gap-3">
      <ActivityCloseButton testId="close-tailored-resume" onClick={onClose} />
      <h2 className="pr-10 text-lg font-semibold text-[var(--jp-ink)]">Tailored resume</h2>
      {showLoading ? <p data-testid="tailored-resume-loading">Loading resume…</p> : null}
      {query.isError ? <p>{requestErrorMessage(query.error)}</p> : null}
      {showEmpty ? <p data-testid="tailored-resume-empty">No tailored resume yet.</p> : null}
      {resume !== null ? <ResumeDocument resume={resume} /> : null}
      {showGenerate ? (
        <Button
          type="button"
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
