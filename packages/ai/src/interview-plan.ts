import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import {
  interviewPlanModelOutputSchema,
  interviewPlanSchema,
  type InterviewPlan,
  type JobAnalysis,
} from "@jobpilot/shared";

export type InterviewPlanModelInput = {
  analysis: JobAnalysis;
  prompt: string;
};

export type InterviewPlanModel = {
  plan(input: InterviewPlanModelInput): Promise<unknown>;
};

const PlanState = Annotation.Root({
  analysis: Annotation<JobAnalysis>,
});

function labeledList(label: string, items: readonly string[]): string {
  const joined = items.join(", ");
  if (joined.length === 0) {
    return `${label}:`;
  }
  return `${label}: ${joined}`;
}

function interviewPlanPrompt(analysis: JobAnalysis): string {
  return [
    "Select the relevant interview categories for this job analysis, in relevance order. Choose only from: Data structures and algorithms, Frontend, Backend, System design, Machine learning, AI/LLM systems, Behavioral questions. Return categories only. Use only this analysis.",
    "",
    labeledList("Required skills", analysis.requiredSkills),
    labeledList("Preferred skills", analysis.preferredSkills),
    labeledList("Responsibilities", analysis.responsibilities),
    labeledList("Experience requirements", analysis.experienceRequirements),
    labeledList("Technologies", analysis.technologies),
    labeledList("Interview topics", analysis.interviewTopics),
    labeledList("Keywords", analysis.keywords),
  ].join("\n");
}

export async function planInterview(
  analysis: JobAnalysis,
  model: InterviewPlanModel,
): Promise<InterviewPlan> {
  let plan: InterviewPlan | null = null;
  const graph = new StateGraph(PlanState)
    .addNode("plan", async (state) => {
      const prompt = interviewPlanPrompt(state.analysis);
      const raw = await model.plan({
        analysis: state.analysis,
        prompt,
      });
      const output = interviewPlanModelOutputSchema.parse(raw);
      plan = interviewPlanSchema.parse({
        categories: output.categories,
        interviewTopics: state.analysis.interviewTopics,
      });
      return {};
    })
    .addEdge(START, "plan")
    .addEdge("plan", END)
    .compile();

  await graph.invoke({ analysis });
  if (plan === null) {
    throw new Error("Interview plan failed");
  }
  return plan;
}

export function createStubInterviewPlanModel(): InterviewPlanModel {
  return {
    async plan() {
      return { categories: ["Backend", "Behavioral questions"] };
    },
  };
}

export function createGeminiInterviewPlanModel(
  apiKey: string,
  modelName: string,
): InterviewPlanModel {
  const chat = new ChatGoogleGenerativeAI({
    apiKey,
    model: modelName,
  });
  const structured = chat.withStructuredOutput(interviewPlanModelOutputSchema);
  return {
    async plan(input) {
      return structured.invoke(input.prompt);
    },
  };
}
