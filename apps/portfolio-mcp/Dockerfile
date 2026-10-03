FROM node:22-alpine
WORKDIR /app
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @jobpilot/shared build
RUN pnpm --filter @jobpilot/database build
RUN pnpm --filter @jobpilot/ai build
RUN pnpm --filter @jobpilot/portfolio-mcp build
ENV MCP_PORT=3010
EXPOSE 3010
CMD ["node", "apps/portfolio-mcp/dist/index.js"]
