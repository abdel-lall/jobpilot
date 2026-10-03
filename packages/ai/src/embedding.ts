import {
  GoogleGenerativeAIEmbeddings,
  type GoogleGenerativeAIEmbeddingsParams,
} from "@langchain/google-genai";

export type EmbeddingClient = {
  embedDocument(text: string): Promise<number[]>;
  embedQuery(text: string): Promise<number[]>;
};

export type EmbeddingClientSelection = {
  embeddingModel: string | undefined;
  apiKey: string | undefined;
  modelName: string | undefined;
};

const EMBEDDING_DIMENSIONS = 768;

function embeddingTask(
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY",
): NonNullable<GoogleGenerativeAIEmbeddingsParams["taskType"]> {
  return taskType as NonNullable<GoogleGenerativeAIEmbeddingsParams["taskType"]>;
}

export function assertUsableEmbedding(value: unknown): number[] {
  if (!Array.isArray(value) || value.length !== EMBEDDING_DIMENSIONS) {
    throw new Error("Invalid embedding");
  }
  let sumOfSquares = 0;
  const vector: number[] = [];
  for (const component of value) {
    if (typeof component !== "number" || !Number.isFinite(component)) {
      throw new Error("Invalid embedding");
    }
    sumOfSquares += component * component;
    vector.push(component);
  }
  if (sumOfSquares === 0) {
    throw new Error("Invalid embedding");
  }
  return vector;
}

function l2Normalize(value: unknown): number[] {
  const vector = assertUsableEmbedding(value);
  let sumOfSquares = 0;
  for (const component of vector) {
    sumOfSquares += component * component;
  }
  const norm = Math.sqrt(sumOfSquares);
  return assertUsableEmbedding(vector.map((component) => component / norm));
}

export function createStubEmbeddingClient(): EmbeddingClient {
  return {
    async embedDocument() {
      return stubVector();
    },
    async embedQuery() {
      return stubVector();
    },
  };
}

function stubVector(): number[] {
  const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  vector[0] = 1;
  return vector;
}

export function createGeminiEmbeddingClient(apiKey: string, modelName: string): EmbeddingClient {
  const documents = new GoogleGenerativeAIEmbeddings({
    apiKey,
    model: modelName,
    taskType: embeddingTask("RETRIEVAL_DOCUMENT"),
    outputDimensionality: EMBEDDING_DIMENSIONS,
    stripNewLines: false,
  });
  documents.stripNewLines = false;
  const queries = new GoogleGenerativeAIEmbeddings({
    apiKey,
    model: modelName,
    taskType: embeddingTask("RETRIEVAL_QUERY"),
    outputDimensionality: EMBEDDING_DIMENSIONS,
    stripNewLines: false,
  });
  queries.stripNewLines = false;
  return {
    async embedDocument(text) {
      return l2Normalize(await documents.embedQuery(text));
    },
    async embedQuery(text) {
      return l2Normalize(await queries.embedQuery(text));
    },
  };
}

export function selectEmbeddingClient(selection: EmbeddingClientSelection): EmbeddingClient | undefined {
  if (selection.embeddingModel === "stub") {
    return createStubEmbeddingClient();
  }
  if (selection.embeddingModel === undefined || selection.embeddingModel === "gemini") {
    if (selection.apiKey !== undefined && selection.apiKey.length > 0) {
      const modelName =
        selection.modelName !== undefined && selection.modelName.length > 0
          ? selection.modelName
          : "gemini-embedding-001";
      return createGeminiEmbeddingClient(selection.apiKey, modelName);
    }
  }
  return undefined;
}
