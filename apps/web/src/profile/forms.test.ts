import type { Project, WorkExperience } from "@jobpilot/shared";
import type { FieldValues, Resolver, ResolverResult } from "react-hook-form";
import { describe, expect, it } from "vitest";
import {
  experienceCreateResolver,
  experienceEditResolver,
  experienceFormValues,
  lines,
  parseTechnologies,
  projectCreateResolver,
  projectEditResolver,
  projectFormValues,
  type ExperienceFormValues,
  type ProjectFormValues,
} from "./forms";

const resolverOptions = {
  fields: {},
  shouldUseNativeValidation: false,
} as never;

const emptyTechnologyMessage = "Remove empty technology entries.";

async function resolve<TValues extends FieldValues, TOutput>(
  resolver: Resolver<TValues, unknown, TOutput>,
  values: TValues,
): Promise<ResolverResult<TValues, TOutput>> {
  return resolver(values, undefined, resolverOptions);
}

function experienceValues(technologies: string): ExperienceFormValues {
  return {
    employer: "Example Co",
    jobTitle: "Engineer",
    startDate: "2021-01-04",
    endDate: "",
    accomplishments: "Shipped the billing service\nMentored engineers",
    technologies,
  };
}

function projectValues(technologies: string): ProjectFormValues {
  return {
    name: "JobPilot",
    description: "A job application assistant.",
    url: "",
    startDate: "",
    endDate: "",
    accomplishments: "Shipped the billing service\nMentored engineers",
    technologies,
  };
}

const experienceRecord: WorkExperience = {
  id: "experience-1",
  userId: "user-1",
  employer: "Example Co",
  jobTitle: "Engineer",
  startDate: "2021-01-04",
  endDate: null,
  accomplishments: ["Shipped the billing service", "Mentored engineers"],
  technologies: ["TypeScript", "React", "Node.js"],
  createdAt: "2021-01-04T00:00:00.000Z",
  updatedAt: "2021-01-04T00:00:00.000Z",
};

const projectRecord: Project = {
  id: "project-1",
  userId: "user-1",
  name: "JobPilot",
  description: "A job application assistant.",
  url: null,
  startDate: null,
  endDate: null,
  accomplishments: ["Shipped the billing service", "Mentored engineers"],
  technologies: ["TypeScript", "React", "Node.js"],
  createdAt: "2021-01-04T00:00:00.000Z",
  updatedAt: "2021-01-04T00:00:00.000Z",
};

describe("profile technologies", () => {
  it("accepts a comma-separated list and keeps accomplishments on separate lines", async () => {
    expect(parseTechnologies("TypeScript, React, Node.js")).toEqual([
      "TypeScript",
      "React",
      "Node.js",
    ]);
    expect(lines("Shipped the billing service\nMentored engineers")).toEqual([
      "Shipped the billing service",
      "Mentored engineers",
    ]);
    expect(lines("TypeScript, React, Node.js")).toEqual(["TypeScript, React, Node.js"]);

    const created = await resolve(experienceCreateResolver, experienceValues("TypeScript, React, Node.js"));
    expect(created.errors).toEqual({});
    expect(created.values).toMatchObject({
      technologies: ["TypeScript", "React", "Node.js"],
      accomplishments: ["Shipped the billing service", "Mentored engineers"],
    });

    const edited = await resolve(projectEditResolver, projectValues("TypeScript, React, Node.js"));
    expect(edited.errors).toEqual({});
    expect(edited.values).toMatchObject({
      technologies: ["TypeScript", "React", "Node.js"],
      accomplishments: ["Shipped the billing service", "Mentored engineers"],
    });
  });

  it("trims whitespace around comma-separated technologies", async () => {
    const input = "  TypeScript ,  React ,   Node.js  ";
    expect(parseTechnologies(input)).toEqual(["TypeScript", "React", "Node.js"]);

    const created = await resolve(experienceCreateResolver, experienceValues(input));
    expect(created.errors).toEqual({});
    expect(created.values).toMatchObject({
      technologies: ["TypeScript", "React", "Node.js"],
    });

    const blank = await resolve(projectCreateResolver, projectValues("   "));
    expect(blank.errors).toEqual({});
    expect(blank.values).toMatchObject({ technologies: [] });
  });

  it("rejects empty technology entries", async () => {
    for (const input of ["React,,Node.js", "React, ,Node.js"]) {
      expect(parseTechnologies(input)).toContain("");

      const experience = await resolve(experienceCreateResolver, experienceValues(input));
      expect(experience.values).toEqual({});
      expect(experience.errors.technologies?.message).toBe(emptyTechnologyMessage);

      const project = await resolve(projectEditResolver, projectValues(input));
      expect(project.values).toEqual({});
      expect(project.errors.technologies?.message).toBe(emptyTechnologyMessage);
    }
  });

  it("rejects a trailing comma", async () => {
    for (const input of ["TypeScript, React,", "TypeScript, React, "]) {
      expect(parseTechnologies(input)).toEqual(["TypeScript", "React", ""]);

      const experience = await resolve(experienceEditResolver, experienceValues(input));
      expect(experience.values).toEqual({});
      expect(experience.errors.technologies?.message).toBe(emptyTechnologyMessage);

      const project = await resolve(projectCreateResolver, projectValues(input));
      expect(project.values).toEqual({});
      expect(project.errors.technologies?.message).toBe(emptyTechnologyMessage);
    }
  });

  it("serializes saved technologies as a comma-separated list when editing", () => {
    expect(experienceFormValues(experienceRecord).technologies).toBe("TypeScript, React, Node.js");
    expect(experienceFormValues(experienceRecord).accomplishments).toBe(
      "Shipped the billing service\nMentored engineers",
    );
    expect(projectFormValues(projectRecord).technologies).toBe("TypeScript, React, Node.js");
    expect(projectFormValues(projectRecord).accomplishments).toBe(
      "Shipped the billing service\nMentored engineers",
    );
  });
});
