import type { TailoredResume } from "@jobpilot/shared";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const EN_DASH = "\u2013";

export function formatResumeMonthYear(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(isoDate);
  if (match === null) {
    return isoDate;
  }
  const month = MONTHS[Number(match[2]) - 1];
  if (month === undefined) {
    return isoDate;
  }
  return `${month} ${match[1]}`;
}

function rangeWithStart(start: string, end: string | null): string {
  const startLabel = formatResumeMonthYear(start);
  if (end === null) {
    return `${startLabel} ${EN_DASH} Present`;
  }
  return `${startLabel} ${EN_DASH} ${formatResumeMonthYear(end)}`;
}

function optionalRange(start: string | null, end: string | null): string | null {
  if (start === null && end === null) {
    return null;
  }
  if (start === null) {
    return end === null ? null : formatResumeMonthYear(end);
  }
  return rangeWithStart(start, end);
}

function technologiesLabel(values: string[]): string | null {
  if (values.length === 0) {
    return null;
  }
  return `Technologies: ${values.join(", ")}`;
}

export type ResumeSkillPreview = {
  name: string;
};

export type ResumeExperiencePreview = {
  employer: string;
  dates: string;
  jobTitle: string;
  accomplishments: string[];
  technologies: string | null;
};

export type ResumeProjectPreview = {
  name: string;
  dates: string | null;
  description: string;
  url: string | null;
  accomplishments: string[];
  technologies: string | null;
};

export type ResumeEducationPreview = {
  institution: string;
  dates: string;
  degree: string;
  fieldOfStudy: string;
};

export type ResumeCertificationPreview = {
  name: string;
  issuer: string;
  issued: string;
  expires: string | null;
};

export type ResumeSectionPreview =
  | { kind: "skills"; title: "SKILLS"; skills: ResumeSkillPreview[] }
  | { kind: "experience"; title: "EXPERIENCE"; items: ResumeExperiencePreview[] }
  | { kind: "projects"; title: "PROJECTS"; items: ResumeProjectPreview[] }
  | { kind: "education"; title: "EDUCATION"; items: ResumeEducationPreview[] }
  | {
      kind: "certifications";
      title: "CERTIFICATIONS";
      items: ResumeCertificationPreview[];
    };

export type ResumePreview = {
  name: "Your Name";
  contact: string;
  sections: ResumeSectionPreview[];
};

export function resumeContactLine(email: string): string {
  return [email, "Phone", "Location", "LinkedIn", "Portfolio"].join(" \u2022 ");
}

export function buildResumePreview(resume: TailoredResume, email: string): ResumePreview {
  const sections: ResumeSectionPreview[] = [];
  if (resume.skills.length > 0) {
    sections.push({
      kind: "skills",
      title: "SKILLS",
      skills: resume.skills.map((skill) => ({ name: skill.name })),
    });
  }
  if (resume.experience.length > 0) {
    sections.push({
      kind: "experience",
      title: "EXPERIENCE",
      items: resume.experience.map((item) => ({
        employer: item.employer,
        dates: rangeWithStart(item.startDate, item.endDate),
        jobTitle: item.jobTitle,
        accomplishments: [...item.accomplishments],
        technologies: technologiesLabel(item.technologies),
      })),
    });
  }
  if (resume.projects.length > 0) {
    sections.push({
      kind: "projects",
      title: "PROJECTS",
      items: resume.projects.map((item) => ({
        name: item.name,
        dates: optionalRange(item.startDate, item.endDate),
        description: item.description,
        url: item.url,
        accomplishments: [...item.accomplishments],
        technologies: technologiesLabel(item.technologies),
      })),
    });
  }
  if (resume.education.length > 0) {
    sections.push({
      kind: "education",
      title: "EDUCATION",
      items: resume.education.map((item) => ({
        institution: item.institution,
        dates: rangeWithStart(item.startDate, item.endDate),
        degree: item.degree,
        fieldOfStudy: item.fieldOfStudy,
      })),
    });
  }
  if (resume.certifications.length > 0) {
    sections.push({
      kind: "certifications",
      title: "CERTIFICATIONS",
      items: resume.certifications.map((item) => ({
        name: item.name,
        issuer: item.issuer,
        issued: `Issued ${formatResumeMonthYear(item.issuedOn)}`,
        expires: item.expiresOn === null ? null : `Expires ${formatResumeMonthYear(item.expiresOn)}`,
      })),
    });
  }
  return {
    name: "Your Name",
    contact: resumeContactLine(email),
    sections,
  };
}

function sanitizeFilenamePart(value: string): string {
  return value.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function resumePdfFilename(companyName: string, jobTitle: string): string {
  const parts = [sanitizeFilenamePart(companyName), sanitizeFilenamePart(jobTitle)].filter(
    (part) => part.length > 0,
  );
  if (parts.length === 0) {
    return "Resume.pdf";
  }
  return `${parts.join("-")}-Resume.pdf`;
}
