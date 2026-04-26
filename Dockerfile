FROM node:22-slim AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY src/ src/
COPY config/ config/
COPY public/ public/
COPY tsconfig.json ./

EXPOSE 3001
CMD ["node", "--import", "tsx", "src/index.ts"]
