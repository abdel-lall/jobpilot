import { timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer } from "./mcp.js";
import { isLowercaseUuid } from "./uuid.js";

type JsonError = { error: string };

export type ListeningServer = {
  port: number;
  close: () => Promise<void>;
};

function singleHeader(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function sharedSecretMatches(provided: string | undefined): boolean {
  const expected = process.env.MCP_SHARED_SECRET;
  if (expected === undefined || expected.trim().length === 0 || provided === undefined) {
    return false;
  }
  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);
  if (providedBytes.length !== expectedBytes.length) {
    return false;
  }
  return timingSafeEqual(providedBytes, expectedBytes);
}

function pathnameOf(req: IncomingMessage): string | undefined {
  if (req.url === undefined) {
    return undefined;
  }
  try {
    return new URL(req.url, "http://127.0.0.1").pathname;
  } catch {
    return undefined;
  }
}

function sendJson(req: IncomingMessage, res: ServerResponse, status: number, body: JsonError): void {
  req.resume();
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

async function handlePost(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const secret = singleHeader(req.headers["x-jobpilot-mcp-secret"]);
  const userId = singleHeader(req.headers["x-jobpilot-user-id"]);
  if (!sharedSecretMatches(secret) || userId === undefined || !isLowercaseUuid(userId)) {
    sendJson(req, res, 401, { error: "Unauthorized" });
    return;
  }

  const mcp = createMcpServer(userId);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  res.on("close", () => {
    void transport.close();
    void mcp.close();
  });
  await mcp.connect(transport);
  await transport.handleRequest(req, res);
}

async function routeHttpRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const pathname = pathnameOf(req);
  if (pathname !== "/mcp") {
    sendJson(req, res, 404, { error: "Not found" });
    return;
  }
  if (req.method !== "POST") {
    sendJson(req, res, 405, { error: "Method not allowed" });
    return;
  }
  await handlePost(req, res);
}

export function startHttpServer(port: number, host: string): Promise<ListeningServer> {
  const server = createServer((req, res) => {
    void routeHttpRequest(req, res).catch(() => {
      if (!res.headersSent) {
        sendJson(req, res, 500, { error: "Internal server error" });
      }
    });
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        reject(new Error("Expected a TCP address"));
        return;
      }
      resolve({
        port: address.port,
        close: () =>
          new Promise((closeResolve, closeReject) => {
            server.close((error) => {
              if (error) {
                closeReject(error);
                return;
              }
              closeResolve();
            });
          }),
      });
    });
  });
}
