import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { jobAnalysisSchema, type JobAnalysis } from "@jobpilot/shared";

export type JobAnalysisModelInput = {
  jobDescription: string;
  prompt: string;
};

export type JobAnalysisModel = {
  analyze(input: JobAnalysisModelInput): Promise<unknown>;
};

const AnalysisState = Annotation.Root({
  jobDescription: Annotation<string>,
  analysis: Annotation<JobAnalysis | null>({
    reducer: (_current, update) => update,
    default: () => null,
  }),
});

function jobAnalysisPrompt(jobDescription: string): string {
  return `Analyze this job description. Return required skills, preferred skills, responsibilities, experience requirements, technologies, interview topics in relevance order, and keywords. Use only this description.

Job description:
${jobDescription}`;
}

export async function analyzeJobDescription(
  jobDescription: string,
  model: JobAnalysisModel,
): Promise<JobAnalysis> {
  const graph = new StateGraph(AnalysisState)
    .addNode("analyze", async (state) => {
      const prompt = jobAnalysisPrompt(state.jobDescription);
      const raw = await model.analyze({
        jobDescription: state.jobDescription,
        prompt,
      });
      return { analysis: jobAnalysisSchema.parse(raw) };
    })
    .addEdge(START, "analyze")
    .addEdge("analyze", END)
    .compile();

  const result = await graph.invoke({ jobDescription });
  if (result.analysis === null) {
    throw new Error("Job analysis failed");
  }
  return result.analysis;
}

export function createStubJobAnalysisModel(): JobAnalysisModel {
  return {
    async analyze(input) {
      return {
        requiredSkills: ["stub-required"],
        preferredSkills: ["stub-preferred"],
        responsibilities: ["stub-responsibility"],
        experienceRequirements: ["stub-experience"],
        technologies: ["stub-technology"],
        interviewTopics: ["stub-topic-1", "stub-topic-2"],
        keywords: [input.jobDescription.slice(0, 200)],
      };
    },
  };
}

export function createGeminiJobAnalysisModel(apiKey: string, modelName: string): JobAnalysisModel {
  const chat = new ChatGoogleGenerativeAI({
    apiKey,
    model: modelName,
  });
  const structured = chat.withStructuredOutput(jobAnalysisSchema);
  return {
    async analyze(input) {
      return structured.invoke(input.prompt);
    },
  };
}
