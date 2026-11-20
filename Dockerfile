# Debian trixie slim: base de Node 24.
FROM node:24-trixie-slim AS base
ENV PNPM_STORE_DIR=/pnpm/store
RUN npm install -g pnpm@11.25.0
WORKDIR /app

# --- dev: source is bind-mounted by docker compose, deps installed at startup ---
FROM base AS dev
ENV NODE_ENV=development CI=true
# procps: nest --watch needs `ps` to kill the previous process on reload.
RUN apt-get update && apt-get install -y --no-install-recommends procps \
    && rm -rf /var/lib/apt/lists/*
EXPOSE 3000
CMD ["sh", "-c", "pnpm install --frozen-lockfile --store-dir $PNPM_STORE_DIR && pnpm start:dev"]

# --- build: compile TypeScript into dist/ ---
FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir $PNPM_STORE_DIR
COPY . .
RUN pnpm build

# --- prod-deps: runtime dependencies only ---
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --store-dir $PNPM_STORE_DIR

# --- prod: minimal runtime image ---
FROM node:24-trixie-slim AS prod
ENV NODE_ENV=production
WORKDIR /app
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./
USER node
EXPOSE 3000
CMD ["node", "dist/main"]
