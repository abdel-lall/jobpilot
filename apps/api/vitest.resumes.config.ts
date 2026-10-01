import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@jobpilot/shared": path.resolve(rootDir, "../../packages/shared/src/index.ts"),
      "@jobpilot/database": path.resolve(rootDir, "../../packages/database/src/index.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/resumes.integration.test.ts"],
  },
});
