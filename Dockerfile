# syntax=docker/dockerfile:1.7
# surviv.io rebirth: the game server serving the built client, in one image (docs/deploy.md).
#   docker build -t surviv-rebirth .                                       # without the original art (placeholders)
#   docker build --build-arg WITH_ORIGINAL_ASSETS=1 -t surviv-rebirth .    # runs pnpm survev:fetch && pnpm assets
#   docker run -p 8001:8001 -v rebirth-data:/app/data surviv-rebirth
# Node 22.18+ runs the TypeScript sources directly (type stripping): there is no compile step for the server.
ARG NODE_IMAGE=node:22-bookworm-slim

FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
# pnpm at the version pinned by package.json "packageManager"
RUN corepack enable
WORKDIR /app

# workspace manifests only: the dependency layers stay cached until a package.json or the lockfile changes
FROM base AS manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/client/package.json apps/client/
COPY apps/server/package.json apps/server/
COPY packages/bots/package.json packages/bots/
COPY packages/core/package.json packages/core/
COPY packages/defs/package.json packages/defs/
COPY packages/protocol/package.json packages/protocol/
COPY packages/sim/package.json packages/sim/

# every dependency (Vite, PixiJS...) and the client build (apps/client/dist)
FROM manifests AS build
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile
COPY . .
# The original surviv.io art and audio are not in the repository. With WITH_ORIGINAL_ASSETS=1 the build clones survev
# at the pinned commit and copies them into apps/client/public/assets (needs git and network access to github.com and
# surviv.io); the default image has none and the client draws placeholders. ffmpeg reads the owner's WebP line-art
# sheets in assets-user/ (when the build context has them), which pnpm assets cuts into the new guns' loot icons.
ARG WITH_ORIGINAL_ASSETS=0
RUN if [ "$WITH_ORIGINAL_ASSETS" = "1" ]; then \
        apt-get update && apt-get install -y --no-install-recommends git ca-certificates ffmpeg && \
        rm -rf /var/lib/apt/lists/* && \
        pnpm survev:fetch && pnpm assets; \
    fi
RUN pnpm build

# production dependencies of the server and of the workspace packages it runs from source
FROM manifests AS prod-deps
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --filter "@rebirth/server..."

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8001
WORKDIR /app
# node_modules trees (pnpm symlinks into node_modules/.pnpm and to the workspace packages)
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=prod-deps /app/packages ./packages
# sources (.dockerignore keeps host node_modules out, so the trees above stay)
COPY package.json pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/server ./apps/server
COPY --from=build /app/apps/client/dist ./apps/client/dist
# reports, bans and anti-cheat flags (REPORTS_FILE, BAN_FILE, SUSPECTS_FILE default to ./data)
RUN mkdir -p /app/data && chown node:node /app/data
VOLUME ["/app/data"]
USER node
EXPOSE 8001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
    CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||8001)+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["node", "apps/server/src/index.ts"]
