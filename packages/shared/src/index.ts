export const packageName = "@jobpilot/shared" as const;

export {
  loginBodySchema,
  publicUserSchema,
  refreshSessionSchema,
  registerBodySchema,
  type LoginBody,
  type PublicUser,
  type RefreshSessionRecord,
  type RegisterBody,
} from "./auth.js";

export {
  certificationSchema,
  createCertificationBodySchema,
  createEducationBodySchema,
  createProjectBodySchema,
  createSkillBodySchema,
  createWorkExperienceBodySchema,
  educationSchema,
  projectSchema,
  skillSchema,
  updateCertificationBodySchema,
  updateEducationBodySchema,
  updateProjectBodySchema,
  updateSkillBodySchema,
  updateWorkExperienceBodySchema,
  workExperienceSchema,
  type Certification,
  type CreateCertificationBody,
  type CreateEducationBody,
  type CreateProjectBody,
  type CreateSkillBody,
  type CreateWorkExperienceBody,
  type Education,
  type Project,
  type Skill,
  type UpdateCertificationBody,
  type UpdateEducationBody,
  type UpdateProjectBody,
  type UpdateSkillBody,
  type UpdateWorkExperienceBody,
  type WorkExperience,
} from "./profile.js";

export { resumeFileSchema, type ResumeFile } from "./resume-file.js";

export {
  createJobBodySchema,
  jobSchema,
  jobStatusSchema,
  updateJobBodySchema,
  type CreateJobBody,
  type Job,
  type JobStatus,
  type UpdateJobBody,
} from "./job.js";

