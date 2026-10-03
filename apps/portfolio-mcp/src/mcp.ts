import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getProject,
  listCertifications,
  listEducation,
  listExperience,
  listProjects,
  listSkills,
} from "./profile.js";
import { isLowercaseUuid } from "./uuid.js";

const emptyInputSchema = z.object({}).strip();
const projectDetailsInputSchema = z
  .object({
    projectId: z.unknown().optional(),
  })
  .strip();

function jsonResult(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value) }],
    isError: false as const,
  };
}

function toolError(text: "Invalid input" | "Not found") {
  return {
    content: [{ type: "text" as const, text }],
    isError: true as const,
  };
}

export function createMcpServer(userId: string): McpServer {
  const server = new McpServer({ name: "jobpilot-portfolio", version: "1.0.0" });

  server.registerTool(
    "get_candidate_profile",
    {
      description: "Return skills, experience, projects, education, and certifications.",
      inputSchema: emptyInputSchema,
    },
    async () => {
      const skills = await listSkills(userId);
      const experience = await listExperience(userId);
      const projects = await listProjects(userId);
      const education = await listEducation(userId);
      const certifications = await listCertifications(userId);
      return jsonResult({ skills, experience, projects, education, certifications });
    },
  );

  server.registerTool(
    "get_skills",
    {
      description: "Return skills.",
      inputSchema: emptyInputSchema,
    },
    async () => jsonResult({ skills: await listSkills(userId) }),
  );

  server.registerTool(
    "get_experience",
    {
      description: "Return work experience.",
      inputSchema: emptyInputSchema,
    },
    async () => jsonResult({ experience: await listExperience(userId) }),
  );

  server.registerTool(
    "get_projects",
    {
      description: "Return projects.",
      inputSchema: emptyInputSchema,
    },
    async () => jsonResult({ projects: await listProjects(userId) }),
  );

  server.registerTool(
    "get_project_details",
    {
      description: "Return one project.",
      inputSchema: projectDetailsInputSchema,
    },
    async (args) => {
      if (typeof args.projectId !== "string" || !isLowercaseUuid(args.projectId)) {
        return toolError("Invalid input");
      }
      const project = await getProject(userId, args.projectId);
      if (project === null) {
        return toolError("Not found");
      }
      return jsonResult({ project });
    },
  );

  server.registerTool(
    "get_education",
    {
      description: "Return education.",
      inputSchema: emptyInputSchema,
    },
    async () => jsonResult({ education: await listEducation(userId) }),
  );

  server.registerTool(
    "get_certifications",
    {
      description: "Return certifications.",
      inputSchema: emptyInputSchema,
    },
    async () => jsonResult({ certifications: await listCertifications(userId) }),
  );

  return server;
}
