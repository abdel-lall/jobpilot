export type ScoredInterviewQuestion = {
  score: number;
  category: string;
};

export type InterviewReadiness = {
  overallScore: number;
  passed: boolean;
};

export function assessInterviewReadiness(
  questions: readonly ScoredInterviewQuestion[],
): InterviewReadiness {
  if (questions.length !== 8) {
    throw new Error("Interview readiness requires 8 questions");
  }

  let sum = 0;
  const categories = new Map<string, { sum: number; count: number }>();
  for (const question of questions) {
    if (!Number.isInteger(question.score) || question.score < 0 || question.score > 100) {
      throw new Error("Interview readiness requires an integer score from 0 through 100");
    }
    sum += question.score;
    const current = categories.get(question.category) ?? { sum: 0, count: 0 };
    current.sum += question.score;
    current.count += 1;
    categories.set(question.category, current);
  }

  let categoriesPass = true;
  for (const category of categories.values()) {
    if (category.sum < 70 * category.count) {
      categoriesPass = false;
    }
  }

  return {
    overallScore: sum / 8,
    passed: sum >= 80 * 8 && categoriesPass,
  };
}
