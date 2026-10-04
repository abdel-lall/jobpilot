import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import {
  interviewQuestionModelItemSchema,
  interviewQuestionModelOutputSchema,
  interviewQuestionStructuredSchema,
  normalizeQuestionText,
  type InterviewPlan,
  type InterviewPlanCategory,
} from "@jobpilot/shared";

export type GeneratedInterviewQuestion = {
  text: string;
  category: InterviewPlanCategory;
  expectedConcepts: string[];
  rubric: string;
};

export type InterviewQuestionModelInput = {
  category: InterviewPlanCategory;
  count: number;
  plan: InterviewPlan;
  avoidedQuestionTexts: string[];
  prompt: string;
};

export type InterviewQuestionModel = {
  generate(input: InterviewQuestionModelInput): Promise<unknown>;
};

const QuestionState = Annotation.Root({
  plan: Annotation<InterviewPlan>,
  storedQuestionTexts: Annotation<string[]>,
});

export function interviewQuestionCounts(categories: readonly InterviewPlanCategory[]): number[] {
  const categoryCount = categories.length;
  if (categoryCount < 1 || categoryCount > 7) {
    throw new Error("Interview question counts require 1 through 7 categories");
  }
  const base = Math.floor(8 / categoryCount);
  const extra = 8 % categoryCount;
  return categories.map((_, index) => base + (index < extra ? 1 : 0));
}

function interviewQuestionPrompt(input: {
  category: InterviewPlanCategory;
  count: number;
  plan: InterviewPlan;
  avoidedQuestionTexts: readonly string[];
}): string {
  const avoided =
    input.avoidedQuestionTexts.length === 0
      ? "Questions to avoid: (none)"
      : `Questions to avoid:\n${input.avoidedQuestionTexts.map((text) => `- ${text}`).join("\n")}`;
  return [
    "Write interview questions for one category. Return only questions for the requested category and count. Use only this plan and the questions to avoid. Do not use a candidate profile.",
    "",
    `Category: ${input.category}`,
    `Count: ${input.count}`,
    `Plan categories: ${input.plan.categories.join(", ")}`,
    `Interview topics: ${input.plan.interviewTopics.join(", ")}`,
    avoided,
  ].join("\n");
}

function acceptQuestions(
  raw: unknown,
  category: InterviewPlanCategory,
  need: number,
  avoidedNormalized: Set<string>,
): GeneratedInterviewQuestion[] {
  const envelope = interviewQuestionModelOutputSchema.safeParse(raw);
  if (!envelope.success) {
    return [];
  }
  const kept: GeneratedInterviewQuestion[] = [];
  for (const element of envelope.data.questions) {
    if (kept.length >= need) {
      break;
    }
    const item = interviewQuestionModelItemSchema.safeParse(element);
    if (!item.success) {
      continue;
    }
    const normalized = normalizeQuestionText(item.data.text);
    if (avoidedNormalized.has(normalized)) {
      continue;
    }
    avoidedNormalized.add(normalized);
    kept.push({
      text: item.data.text,
      category,
      expectedConcepts: item.data.expectedConcepts,
      rubric: item.data.rubric,
    });
  }
  return kept;
}

async function generateFromPlan(
  plan: InterviewPlan,
  storedQuestionTexts: readonly string[],
  model: InterviewQuestionModel,
): Promise<GeneratedInterviewQuestion[]> {
  const counts = interviewQuestionCounts(plan.categories);
  const accepted: GeneratedInterviewQuestion[][] = plan.categories.map(() => []);
  const avoidedTexts = [...storedQuestionTexts];
  const avoidedNormalized = new Set(storedQuestionTexts.map((text) => normalizeQuestionText(text)));

  for (let round = 0; round < 3; round += 1) {
    const missing = counts.some((count, index) => accepted[index].length < count);
    if (!missing) {
      break;
    }
    for (let index = 0; index < plan.categories.length; index += 1) {
      const need = counts[index] - accepted[index].length;
      if (need <= 0) {
        continue;
      }
      const category = plan.categories[index];
      const prompt = interviewQuestionPrompt({
        category,
        count: need,
        plan,
        avoidedQuestionTexts: avoidedTexts,
      });
      const raw = await model.generate({
        category,
        count: need,
        plan,
        avoidedQuestionTexts: [...avoidedTexts],
        prompt,
      });
      const kept = acceptQuestions(raw, category, need, avoidedNormalized);
      for (const question of kept) {
        accepted[index].push(question);
        avoidedTexts.push(question.text);
      }
      if (accepted.reduce((sum, group) => sum + group.length, 0) >= 8) {
        return accepted.flat();
      }
    }
  }

  const questions = accepted.flat();
  if (questions.length !== 8) {
    throw new Error("Interview question generation failed");
  }
  return questions;
}

export async function generateInterviewQuestions(
  plan: InterviewPlan,
  storedQuestionTexts: string[],
  model: InterviewQuestionModel,
): Promise<GeneratedInterviewQuestion[]> {
  let questions: GeneratedInterviewQuestion[] | null = null;
  const graph = new StateGraph(QuestionState)
    .addNode("generate", async (state) => {
      questions = await generateFromPlan(state.plan, state.storedQuestionTexts, model);
      return {};
    })
    .addEdge(START, "generate")
    .addEdge("generate", END)
    .compile();

  await graph.invoke({ plan, storedQuestionTexts });
  if (questions === null) {
    throw new Error("Interview question generation failed");
  }
  return questions;
}

export function createStubInterviewQuestionModel(): InterviewQuestionModel {
  return {
    async generate(input) {
      const questions = [];
      for (let index = 1; index <= input.count; index += 1) {
        questions.push({
          text: `Stub ${input.category} question ${index}`,
          category: "Frontend",
          expectedConcepts: ["stub-concept"],
          rubric: "stub-rubric",
        });
      }
      return { questions };
    },
  };
}

export function createGeminiInterviewQuestionModel(
  apiKey: string,
  modelName: string,
): InterviewQuestionModel {
  const chat = new ChatGoogleGenerativeAI({
    apiKey,
    model: modelName,
  });
  const structured = chat.withStructuredOutput(interviewQuestionStructuredSchema);
  return {
    async generate(input) {
      return structured.invoke(input.prompt);
    },
  };
}
