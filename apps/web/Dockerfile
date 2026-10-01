FROM node:22-alpine
WORKDIR /app
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile
EXPOSE 5173
CMD ["pnpm", "--filter", "@jobpilot/web", "dev"]
