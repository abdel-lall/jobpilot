import { assertUsableEmbedding } from "@jobpilot/ai";
import { getPrisma } from "./db.js";
import { publicExperienceByIds, publicProjectByIds } from "./profile.js";

function vectorLiteral(values: number[]): string {
  return `[${values.join(",")}]`;
}

export async function searchCandidateExperience(userId: string, vector: number[]) {
  const usable = assertUsableEmbedding(vector);
  const ranked = await getPrisma().$queryRaw<Array<{ kind: string; id: string }>>`
    SELECT kind, id
    FROM (
      SELECT 'experience'::text AS kind, id, embedding, "createdAt"
      FROM "WorkExperience"
      WHERE "userId" = ${userId} AND embedding IS NOT NULL
      UNION ALL
      SELECT 'project'::text AS kind, id, embedding, "createdAt"
      FROM "Project"
      WHERE "userId" = ${userId} AND embedding IS NOT NULL
    ) AS candidates
    ORDER BY embedding <=> ${vectorLiteral(usable)}::vector ASC, "createdAt" ASC, id ASC
    LIMIT 8
  `;

  const experienceIds = ranked.filter((row) => row.kind === "experience").map((row) => row.id);
  const projectIds = ranked.filter((row) => row.kind === "project").map((row) => row.id);
  const [experiences, projects] = await Promise.all([
    publicExperienceByIds(userId, experienceIds),
    publicProjectByIds(userId, projectIds),
  ]);

  const matches = [];
  for (const row of ranked) {
    if (row.kind === "experience") {
      const experience = experiences.get(row.id);
      if (experience === undefined) {
        throw new Error("Search failed");
      }
      matches.push({ kind: "experience", experience });
      continue;
    }
    if (row.kind === "project") {
      const project = projects.get(row.id);
      if (project === undefined) {
        throw new Error("Search failed");
      }
      matches.push({ kind: "project", project });
      continue;
    }
    throw new Error("Search failed");
  }
  return matches;
}
