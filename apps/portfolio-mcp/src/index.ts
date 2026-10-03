import { startHttpServer } from "./http.js";

function requireDatabaseUrl(): void {
  const value = process.env.DATABASE_URL;
  if (value === undefined || value.trim().length === 0) {
    throw new Error("DATABASE_URL is required");
  }
}

function readMcpPort(value: string | undefined): number {
  if (value === undefined || value.length === 0) {
    return 3010;
  }
  if (!/^\d+$/.test(value)) {
    return 3010;
  }
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535 || String(port) !== value) {
    return 3010;
  }
  return port;
}

requireDatabaseUrl();

const port = readMcpPort(process.env.MCP_PORT);
const listening = await startHttpServer(port, "0.0.0.0");
console.log(`portfolio-mcp listening on port ${listening.port}`);
