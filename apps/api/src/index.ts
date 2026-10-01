import { createApp } from "./app.js";

function requireEnv(name: string): void {
  const value = process.env[name];
  if (value === undefined || value.trim().length === 0) {
    throw new Error(`${name} is required`);
  }
}

requireEnv("DATABASE_URL");
requireEnv("JWT_SECRET");

const port = Number(process.env.PORT ?? 3000);

if (!Number.isInteger(port) || port <= 0) {
  throw new Error("PORT must be a positive integer");
}

const app = createApp();

app.listen(port, "0.0.0.0", () => {
  console.log(`API listening on port ${port}`);
});
