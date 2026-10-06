import { jsPDF } from "jspdf";
import type {
  ResumeCertificationPreview,
  ResumeEducationPreview,
  ResumeExperiencePreview,
  ResumePreview,
  ResumeProjectPreview,
  ResumeSectionPreview,
} from "@/jobs/resume-preview";

const MARGIN = 54;
const INK = { r: 23, g: 32, b: 51 };
const RULE = { r: 209, g: 213, b: 219 };

type Pen = {
  doc: jsPDF;
  y: number;
  width: number;
};

function wrappedLines(doc: jsPDF, text: string, width: number): string[] {
  const wrapped: unknown = doc.splitTextToSize(text, width);
  if (typeof wrapped === "string") {
    return [wrapped];
  }
  if (!Array.isArray(wrapped)) {
    return [text];
  }
  const lines: string[] = [];
  for (const line of wrapped) {
    if (typeof line === "string") {
      lines.push(line);
    }
  }
  return lines.length > 0 ? lines : [text];
}

function pageLimit(doc: jsPDF): number {
  return doc.internal.pageSize.getHeight() - MARGIN;
}

function ensure(pen: Pen, needed: number): void {
  if (pen.y + needed > pageLimit(pen.doc)) {
    pen.doc.addPage();
    pen.y = MARGIN;
  }
}

function writeLines(
  pen: Pen,
  text: string,
  size: number,
  style: "normal" | "bold",
  align: "left" | "center",
): void {
  const doc = pen.doc;
  doc.setFont("times", style);
  doc.setFontSize(size);
  doc.setTextColor(INK.r, INK.g, INK.b);
  const lineHeight = size + 4;
  const lines = wrappedLines(doc, text, pen.width);
  for (const line of lines) {
    ensure(pen, lineHeight);
    const x = align === "center" ? MARGIN + pen.width / 2 : MARGIN;
    doc.text(line, x, pen.y, { align });
    pen.y += lineHeight;
  }
}

function writePrimaryLine(pen: Pen, primary: string, meta: string | null): void {
  const doc = pen.doc;
  const size = 12;
  const lineHeight = size + 4;
  doc.setFontSize(size);
  doc.setTextColor(INK.r, INK.g, INK.b);
  ensure(pen, lineHeight);
  if (meta === null) {
    doc.setFont("times", "bold");
    const lines = wrappedLines(doc, primary, pen.width);
    doc.text(lines[0] ?? primary, MARGIN, pen.y);
    pen.y += lineHeight;
    for (const extra of lines.slice(1)) {
      ensure(pen, lineHeight);
      doc.text(extra, MARGIN, pen.y);
      pen.y += lineHeight;
    }
    return;
  }
  doc.setFont("times", "normal");
  const metaWidth = doc.getTextWidth(meta);
  doc.setFont("times", "bold");
  const primaryWidth = Math.max(pen.width * 0.45, pen.width - metaWidth - 16);
  const lines = wrappedLines(doc, primary, primaryWidth);
  doc.text(lines[0] ?? primary, MARGIN, pen.y);
  doc.setFont("times", "normal");
  doc.text(meta, MARGIN + pen.width, pen.y, { align: "right" });
  pen.y += lineHeight;
  doc.setFont("times", "bold");
  for (const extra of lines.slice(1)) {
    ensure(pen, lineHeight);
    doc.text(extra, MARGIN, pen.y);
    pen.y += lineHeight;
  }
}

function writeHeading(pen: Pen, title: string): void {
  const doc = pen.doc;
  const size = 11;
  doc.setFont("times", "bold");
  doc.setFontSize(size);
  doc.setTextColor(INK.r, INK.g, INK.b);
  ensure(pen, size + 16);
  doc.text(title, MARGIN, pen.y);
  pen.y += 5;
  doc.setDrawColor(RULE.r, RULE.g, RULE.b);
  doc.setLineWidth(0.6);
  doc.line(MARGIN, pen.y, MARGIN + pen.width, pen.y);
  pen.y += 14;
}

function writeBullets(pen: Pen, items: string[]): void {
  for (const item of items) {
    writeLines(pen, `\u2022 ${item}`, 11, "normal", "left");
  }
}

function writeExperience(pen: Pen, item: ResumeExperiencePreview): void {
  writePrimaryLine(pen, item.employer, item.dates);
  writeLines(pen, item.jobTitle, 11, "normal", "left");
  writeBullets(pen, item.accomplishments);
  if (item.technologies !== null) {
    writeLines(pen, item.technologies, 10, "normal", "left");
  }
  pen.y += 8;
}

function writeProject(pen: Pen, item: ResumeProjectPreview): void {
  writePrimaryLine(pen, item.name, item.dates);
  writeLines(pen, item.description, 11, "normal", "left");
  if (item.url !== null) {
    writeLines(pen, item.url, 10, "normal", "left");
  }
  writeBullets(pen, item.accomplishments);
  if (item.technologies !== null) {
    writeLines(pen, item.technologies, 10, "normal", "left");
  }
  pen.y += 8;
}

function writeEducation(pen: Pen, item: ResumeEducationPreview): void {
  writePrimaryLine(pen, item.institution, item.dates);
  writeLines(pen, `${item.degree}, ${item.fieldOfStudy}`, 11, "normal", "left");
  pen.y += 8;
}

function writeCertification(pen: Pen, item: ResumeCertificationPreview): void {
  writeLines(pen, item.name, 12, "bold", "left");
  writeLines(pen, item.issuer, 11, "normal", "left");
  writeLines(pen, item.issued, 11, "normal", "left");
  if (item.expires !== null) {
    writeLines(pen, item.expires, 11, "normal", "left");
  }
  pen.y += 8;
}

function writeSection(pen: Pen, section: ResumeSectionPreview): void {
  writeHeading(pen, section.title);
  if (section.kind === "skills") {
    writeLines(pen, section.skills.map((skill) => skill.name).join(" \u2022 "), 11, "normal", "left");
    pen.y += 8;
    return;
  }
  if (section.kind === "experience") {
    for (const item of section.items) {
      writeExperience(pen, item);
    }
    return;
  }
  if (section.kind === "projects") {
    for (const item of section.items) {
      writeProject(pen, item);
    }
    return;
  }
  if (section.kind === "education") {
    for (const item of section.items) {
      writeEducation(pen, item);
    }
    return;
  }
  for (const item of section.items) {
    writeCertification(pen, item);
  }
}

function drawResume(preview: ResumePreview): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter", compress: false });
  const pen: Pen = {
    doc,
    y: MARGIN,
    width: doc.internal.pageSize.getWidth() - MARGIN * 2,
  };
  writeLines(pen, preview.name, 18, "bold", "center");
  writeLines(pen, preview.contact, 10, "normal", "center");
  pen.y += 10;
  for (const section of preview.sections) {
    writeSection(pen, section);
  }
  return doc;
}

export function downloadResumePdf(preview: ResumePreview, filename: string): void {
  drawResume(preview).save(filename);
}
