import type { ReactNode } from "react";
import type {
  ResumeCertificationPreview,
  ResumeEducationPreview,
  ResumeExperiencePreview,
  ResumePreview,
  ResumeProjectPreview,
  ResumeSectionPreview,
  ResumeSkillPreview,
} from "@/jobs/resume-preview";

function SectionHeading({ title }: { title: string }) {
  return (
    <h3 className="border-b border-[#D1D5DB] pb-1 text-sm font-semibold tracking-wide text-[#172033]">
      {title}
    </h3>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-3">
      <SectionHeading title={title} />
      {children}
    </section>
  );
}

function PrimaryLine({ primary, meta }: { primary: string; meta: string | null }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <p className="min-w-0 font-semibold break-words">{primary}</p>
      {meta !== null ? <p className="text-sm break-words">{meta}</p> : null}
    </div>
  );
}

function Bullets({ items }: { items: string[] }) {
  if (items.length === 0) {
    return null;
  }
  return (
    <ul className="list-disc space-y-1 pl-5">
      {items.map((item, index) => (
        <li key={`${index}-${item}`} className="break-words">
          {item}
        </li>
      ))}
    </ul>
  );
}

function Technologies({ label }: { label: string | null }) {
  if (label === null) {
    return null;
  }
  return <p className="text-sm break-words">{label}</p>;
}

function SkillsBlock({ skills }: { skills: ResumeSkillPreview[] }) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      {skills.map((skill, index) => (
        <span key={`${index}-${skill.name}`} className="inline-flex items-baseline gap-2">
          {index > 0 ? <span aria-hidden="true">•</span> : null}
          <span data-testid="resume-skill">{skill.name}</span>
        </span>
      ))}
    </p>
  );
}

function ExperienceBlock({ item }: { item: ResumeExperiencePreview }) {
  return (
    <article data-testid="resume-experience" className="grid gap-1">
      <PrimaryLine primary={item.employer} meta={item.dates} />
      <p>{item.jobTitle}</p>
      <Bullets items={item.accomplishments} />
      <Technologies label={item.technologies} />
    </article>
  );
}

function ProjectBlock({ item }: { item: ResumeProjectPreview }) {
  return (
    <article data-testid="resume-project" className="grid gap-1">
      <PrimaryLine primary={item.name} meta={item.dates} />
      <p className="break-words">{item.description}</p>
      {item.url !== null ? (
        <a href={item.url} className="text-sm break-all underline">
          {item.url}
        </a>
      ) : null}
      <Bullets items={item.accomplishments} />
      <Technologies label={item.technologies} />
    </article>
  );
}

function EducationBlock({ item }: { item: ResumeEducationPreview }) {
  return (
    <article data-testid="resume-education" className="grid gap-1">
      <PrimaryLine primary={item.institution} meta={item.dates} />
      <p className="break-words">
        {item.degree}, {item.fieldOfStudy}
      </p>
    </article>
  );
}

function CertificationBlock({ item }: { item: ResumeCertificationPreview }) {
  return (
    <article data-testid="resume-certification" className="grid gap-1">
      <p className="font-semibold break-words">{item.name}</p>
      <p className="break-words">{item.issuer}</p>
      <p>{item.issued}</p>
      {item.expires !== null ? <p>{item.expires}</p> : null}
    </article>
  );
}

function ResumeSectionView({ section }: { section: ResumeSectionPreview }) {
  if (section.kind === "skills") {
    return (
      <Section title={section.title}>
        <SkillsBlock skills={section.skills} />
      </Section>
    );
  }
  if (section.kind === "experience") {
    return (
      <Section title={section.title}>
        <div className="grid gap-4">
          {section.items.map((item, index) => (
            <ExperienceBlock key={`${index}-${item.employer}`} item={item} />
          ))}
        </div>
      </Section>
    );
  }
  if (section.kind === "projects") {
    return (
      <Section title={section.title}>
        <div className="grid gap-4">
          {section.items.map((item, index) => (
            <ProjectBlock key={`${index}-${item.name}`} item={item} />
          ))}
        </div>
      </Section>
    );
  }
  if (section.kind === "education") {
    return (
      <Section title={section.title}>
        <div className="grid gap-4">
          {section.items.map((item, index) => (
            <EducationBlock key={`${index}-${item.institution}`} item={item} />
          ))}
        </div>
      </Section>
    );
  }
  return (
    <Section title={section.title}>
      <div className="grid gap-4">
        {section.items.map((item, index) => (
          <CertificationBlock key={`${index}-${item.name}`} item={item} />
        ))}
      </div>
    </Section>
  );
}

export function ResumeDocument({ preview }: { preview: ResumePreview }) {
  return (
    <div
      data-testid="resume-document"
      className="mx-auto w-full min-w-0 max-w-[816px] border border-[#E5E7EB] bg-white p-4 text-[#172033] shadow-sm sm:p-8"
    >
      <div className="mb-5 text-center">
        <p data-testid="resume-candidate-name" className="text-xl font-semibold break-words">
          {preview.name}
        </p>
        <p data-testid="resume-contact" className="mt-1 text-sm break-words">
          {preview.contact}
        </p>
      </div>
      <div className="grid gap-5">
        {preview.sections.map((section) => (
          <ResumeSectionView key={section.kind} section={section} />
        ))}
      </div>
    </div>
  );
}
