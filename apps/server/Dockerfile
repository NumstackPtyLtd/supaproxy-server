FROM node:20-slim AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# Copy workspace root files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./

# Copy package.json files for all workspace packages
COPY apps/server/package.json apps/server/
COPY packages/shared/package.json packages/shared/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/shared/ packages/shared/
COPY apps/server/ apps/server/

WORKDIR /app/apps/server
EXPOSE 3001
CMD ["node", "--import", "tsx", "src/index.ts"]
