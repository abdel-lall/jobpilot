import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { answerEvaluationModelOutputSchema } from "@jobpilot/shared";

export type AnswerEvaluationModelInput = {
  questionText: string;
  rubric: string;
  answer: string;
  prompt: string;
};

export type AnswerEvaluationModel = {
  evaluate(input: AnswerEvaluationModelInput): Promise<unknown>;
};

const AnswerState = Annotation.Root({
  questionText: Annotation<string>,
  rubric: Annotation<string>,
  answer: Annotation<string>,
});

function answerEvaluationPrompt(questionText: string, rubric: string, answer: string): string {
  return [
    "Evaluate this interview answer. Return feedback and an integer score from 0 through 100. Use only the question, the rubric, and the answer. Do not use a candidate profile.",
    "",
    `Question: ${questionText}`,
    `Rubric: ${rubric}`,
    `Answer: ${answer}`,
  ].join("\n");
}

export async function evaluateAnswer(
  questionText: string,
  rubric: string,
  answer: string,
  model: AnswerEvaluationModel,
): Promise<{ feedback: string; score: number }> {
  let result: { feedback: string; score: number } | null = null;
  const graph = new StateGraph(AnswerState)
    .addNode("evaluate", async (state) => {
      const prompt = answerEvaluationPrompt(state.questionText, state.rubric, state.answer);
      const raw = await model.evaluate({
        questionText: state.questionText,
        rubric: state.rubric,
        answer: state.answer,
        prompt,
      });
      result = answerEvaluationModelOutputSchema.parse(raw);
      return {};
    })
    .addEdge(START, "evaluate")
    .addEdge("evaluate", END)
    .compile();

  await graph.invoke({ questionText, rubric, answer });
  if (result === null) {
    throw new Error("Answer evaluation failed");
  }
  return result;
}

export function createStubAnswerEvaluationModel(): AnswerEvaluationModel {
  return {
    async evaluate() {
      return { feedback: "stub-feedback", score: 80 };
    },
  };
}

export function createGeminiAnswerEvaluationModel(
  apiKey: string,
  modelName: string,
): AnswerEvaluationModel {
  const chat = new ChatGoogleGenerativeAI({
    apiKey,
    model: modelName,
  });
  const structured = chat.withStructuredOutput(answerEvaluationModelOutputSchema);
  return {
    async evaluate(input) {
      return structured.invoke(input.prompt);
    },
  };
}
