import { describe, expect, it, vi } from "vitest";

const createdEmbeddings = vi.hoisted(() => ({
  instances: [] as Array<{ stripNewLines: boolean }>,
}));

vi.mock("@langchain/google-genai", async () => {
  const actual = await vi.importActual<typeof import("@langchain/google-genai")>(
    "@langchain/google-genai",
  );
  return {
    ...actual,
    GoogleGenerativeAIEmbeddings: class extends actual.GoogleGenerativeAIEmbeddings {
      constructor(fields?: ConstructorParameters<typeof actual.GoogleGenerativeAIEmbeddings>[0]) {
        super(fields);
        createdEmbeddings.instances.push(this);
      }
    },
  };
});

import { createGeminiEmbeddingClient, createStubEmbeddingClient } from "./embedding.js";

delete process.env.GEMINI_API_KEY;

function euclideanNorm(vector: number[]): number {
  return Math.sqrt(vector.reduce((sum, component) => sum + component * component, 0));
}

describe("stub embedding client", () => {
  it("returns the same 768-dimension unit vector for every string", async () => {
    expect(process.env.GEMINI_API_KEY).toBeUndefined();
    const client = createStubEmbeddingClient();
    const expected = new Array<number>(768).fill(0);
    expected[0] = 1;

    for (const text of ["", "a", "Employer: Example\nJob title: Engineer"]) {
      const document = await client.embedDocument(text);
      const query = await client.embedQuery(text);
      expect(document).toEqual(expected);
      expect(query).toEqual(expected);
      expect(document).toHaveLength(768);
      expect(document.every((component) => Number.isFinite(component))).toBe(true);
      expect(euclideanNorm(document)).toBe(1);
      expect(euclideanNorm(query)).toBe(1);
    }
  });
});

describe("gemini embedding client", () => {
  it("keeps newlines on the document and query embedding instances", () => {
    expect(process.env.GEMINI_API_KEY).toBeUndefined();
    createdEmbeddings.instances.length = 0;
    createGeminiEmbeddingClient("dummy-key", "dummy-model");
    expect(createdEmbeddings.instances).toHaveLength(2);
    expect(createdEmbeddings.instances.every((instance) => instance.stripNewLines === false)).toBe(true);
  });
});
