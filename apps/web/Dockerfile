FROM node:22-slim AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# Copy workspace root files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./

# Copy package.json files for all workspace packages
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/sdk/package.json packages/sdk/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/shared/ packages/shared/
COPY packages/sdk/ packages/sdk/
COPY apps/web/ apps/web/

# Build Astro
WORKDIR /app/apps/web
RUN pnpm build

EXPOSE 4322
ENV HOST=0.0.0.0
ENV PORT=4322
CMD ["node", "dist/server/entry.mjs"]
