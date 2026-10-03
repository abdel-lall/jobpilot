import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@jobpilot/shared": path.resolve(rootDir, "../../packages/shared/src/index.ts"),
      "@jobpilot/database": path.resolve(rootDir, "../../packages/database/src/index.ts"),
      "@jobpilot/ai": path.resolve(rootDir, "../../packages/ai/src/index.ts"),
    },
  },
  test: {
    environment: "node",
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/cypress/**",
      "**/.{idea,git,cache,output,temp}/**",
      "**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*",
      "**/*.integration.test.ts",
    ],
  },
});
