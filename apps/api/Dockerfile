FROM node:22-alpine
WORKDIR /app
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @jobpilot/api build
ENV PORT=3000
EXPOSE 3000
CMD ["node", "apps/api/dist/index.js"]
