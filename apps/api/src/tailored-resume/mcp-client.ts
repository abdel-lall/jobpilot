import type { ResumeToolClient } from "@jobpilot/ai";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

function readToolText(result: unknown): string {
  if (result === null || typeof result !== "object") {
    throw new Error("Tool call failed");
  }
  if ("isError" in result && result.isError === true) {
    throw new Error("Tool call failed");
  }
  if (!("content" in result) || !Array.isArray(result.content)) {
    throw new Error("Tool call failed");
  }
  for (const part of result.content) {
    if (
      typeof part === "object" &&
      part !== null &&
      "type" in part &&
      part.type === "text" &&
      "text" in part &&
      typeof part.text === "string"
    ) {
      return part.text;
    }
  }
  throw new Error("Tool call failed");
}

export function createResumeToolClient(options: {
  url: string;
  secret: string;
  userId: string;
}): ResumeToolClient {
  return {
    async callTool(name, args) {
      const client = new Client({ name: "jobpilot-api", version: "1.0.0" });
      const transport = new StreamableHTTPClientTransport(new URL(options.url), {
        requestInit: {
          headers: {
            "x-jobpilot-mcp-secret": options.secret,
            "x-jobpilot-user-id": options.userId,
          },
        },
      });
      try {
        await client.connect(transport);
        const result = await client.callTool({ name, arguments: args });
        return readToolText(result);
      } finally {
        try {
          await client.close();
        } catch {
          // Keep the tool-call failure as the rejection reason.
        }
      }
    },
  };
}
