export const packageName = "@jobpilot/ai" as const;

export {
  analyzeJobDescription,
  createGeminiJobAnalysisModel,
  createStubJobAnalysisModel,
  type JobAnalysisModel,
  type JobAnalysisModelInput,
} from "./job-analysis.js";
