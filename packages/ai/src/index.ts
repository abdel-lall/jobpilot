export const packageName = "@jobpilot/ai" as const;

export {
  analyzeJobDescription,
  createGeminiJobAnalysisModel,
  createStubJobAnalysisModel,
  type JobAnalysisModel,
  type JobAnalysisModelInput,
} from "./job-analysis.js";
export {
  assertUsableEmbedding,
  createGeminiEmbeddingClient,
  createStubEmbeddingClient,
  selectEmbeddingClient,
  type EmbeddingClient,
  type EmbeddingClientSelection,
} from "./embedding.js";
export {
  assertTailoredResumeGrounded,
  createGeminiResumeModel,
  createStubResumeModel,
  tailorResume,
  type GroundingProfile,
  type ResumeTailoringModel,
  type ResumeTailoringModelInput,
  type ResumeToolClient,
  type ResumeToolResults,
} from "./tailored-resume.js";
export {
  createGeminiInterviewPlanModel,
  createStubInterviewPlanModel,
  planInterview,
  type InterviewPlanModel,
  type InterviewPlanModelInput,
} from "./interview-plan.js";
export {
  createGeminiInterviewQuestionModel,
  createStubInterviewQuestionModel,
  generateInterviewQuestions,
  interviewQuestionCounts,
  type GeneratedInterviewQuestion,
  type InterviewQuestionModel,
  type InterviewQuestionModelInput,
} from "./interview-questions.js";
export {
  createGeminiAnswerEvaluationModel,
  createStubAnswerEvaluationModel,
  evaluateAnswer,
  type AnswerEvaluationModel,
  type AnswerEvaluationModelInput,
} from "./answer-evaluation.js";
